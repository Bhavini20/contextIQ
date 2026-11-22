import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CAMPAIGNS, getPage } from '../engine/data'
import { DEFAULT_OPTIONS, decide, type Decision, type EngineOptions } from '../engine/engine'
import { inventory } from '../engine/inventory'
import { compare, type Comparison } from '../engine/metrics'
import { mulberry32, SEED } from '../engine/prng'
import type { Campaign, Page, PageProfile, Preset, RiskFlag, Strategy } from '../engine/types'

export type View = 'story' | 'pages' | 'campaigns' | 'tradeoffs' | 'reports' | 'how'
export const VIEWS: View[] = ['story', 'pages', 'campaigns', 'tradeoffs', 'reports', 'how']
export type ReportTab = 'advertiser' | 'publisher'

export interface AppState {
  view: View
  pageId: string
  strategy: Strategy
  focus: string // campaign id or 'all'
  campaigns: Campaign[]
  opts: EngineOptions
  rescored: string[]
  reportTab: ReportTab
  guided: number | null
  run: number
}

const FLAG_CODE: Record<RiskFlag, string> = { fraud: 'f', crime: 'c', tragedy: 't', 'low-quality': 'l' }
const CODE_FLAG = Object.fromEntries(Object.entries(FLAG_CODE).map(([k, v]) => [v, k])) as Record<string, RiskFlag>
const PRESET_CODE: Record<Preset, string> = { strict: 's', balanced: 'b', broad: 'r' }
const CODE_PRESET = Object.fromEntries(Object.entries(PRESET_CODE).map(([k, v]) => [v, k])) as Record<string, Preset>

function encodeCampaigns(cs: Campaign[]): string {
  return cs
    .filter((c) => c.kind === 'contextual')
    .filter((c) => {
      const d = CAMPAIGNS.find((x) => x.id === c.id)!
      return (
        d.preset !== c.preset ||
        Math.abs(d.threshold - c.threshold) > 1e-9 ||
        Math.abs(d.baseBid - c.baseBid) > 1e-9 ||
        [...d.excludes].sort().join() !== [...c.excludes].sort().join()
      )
    })
    .map((c) => `${c.id}~${PRESET_CODE[c.preset!]}~${c.threshold.toFixed(2)}~${c.baseBid.toFixed(2)}~${c.excludes.map((f) => FLAG_CODE[f]).join('')}`)
    .join('.')
}

function decodeCampaigns(s: string | null): Campaign[] {
  const out = CAMPAIGNS.map((c) => ({ ...c, excludes: [...c.excludes] }))
  if (!s) return out
  for (const part of s.split('.')) {
    const [id, p, t, b, f = ''] = part.split('~')
    const c = out.find((x) => x.id === id && x.kind === 'contextual')
    if (!c) continue
    if (CODE_PRESET[p]) c.preset = CODE_PRESET[p]
    const tn = Number(t)
    if (Number.isFinite(tn)) c.threshold = Math.min(0.95, Math.max(0.3, tn))
    const bn = Number(b)
    if (Number.isFinite(bn) && bn > 0) c.baseBid = Math.min(20, bn)
    c.excludes = [...f].map((x) => CODE_FLAG[x]).filter(Boolean)
  }
  return out
}

function fromUrl(): AppState {
  const q = new URLSearchParams(window.location.search)
  const view = (VIEWS as string[]).includes(q.get('view') ?? '') ? (q.get('view') as View) : 'story'
  const page = q.get('page') ?? 'P1'
  const focus = q.get('campaign') ?? 'nova'
  const campaigns = decodeCampaigns(q.get('cfg'))
  // ?threshold=0.70 applies to the focused campaign (or all).
  const t = Number(q.get('threshold'))
  if (q.get('threshold') && Number.isFinite(t)) {
    for (const c of campaigns)
      if (c.kind === 'contextual' && (focus === 'all' || c.id === focus)) c.threshold = Math.min(0.95, Math.max(0.3, t))
  }
  const up = Number(q.get('uplift') ?? 0)
  return {
    view,
    pageId: getPage(page) ? page : 'P1',
    strategy: q.get('mode') === 'strict' ? 'strict' : 'contextiq',
    focus: focus === 'all' || CAMPAIGNS.some((c) => c.id === focus && c.kind === 'contextual') ? focus : 'nova',
    campaigns,
    opts: {
      strictSuitability: q.get('ss') === '1',
      trustUplift: Number.isFinite(up) ? Math.min(0.2, Math.max(0, up)) : 0,
    },
    rescored: (q.get('rescored') ?? '').split(',').filter((x) => x === 'P4'),
    reportTab: q.get('report') === 'publisher' ? 'publisher' : 'advertiser',
    guided: null,
    run: 1,
  }
}

function toUrl(s: AppState): string {
  const q = new URLSearchParams()
  if (s.view !== 'story') q.set('view', s.view)
  if (s.pageId !== 'P1' && s.pageId !== 'custom') q.set('page', s.pageId)
  if (s.strategy === 'strict') q.set('mode', 'strict')
  if (s.focus !== 'nova') q.set('campaign', s.focus)
  const cfg = encodeCampaigns(s.campaigns)
  if (cfg) q.set('cfg', cfg)
  if (s.opts.strictSuitability) q.set('ss', '1')
  if (s.opts.trustUplift > 0) q.set('uplift', s.opts.trustUplift.toFixed(2))
  if (s.rescored.length) q.set('rescored', s.rescored.join(','))
  if (s.view === 'reports' && s.reportTab === 'publisher') q.set('report', 'publisher')
  const str = q.toString()
  return `${window.location.pathname}${str ? `?${str}` : ''}`
}

/** Seeded per-request draw: does run-of-network bid on request #n? */
export function ronBidsOn(run: number): boolean {
  return mulberry32(SEED * 1000 + run)() < 0.5
}

interface Ctx {
  state: AppState
  set: (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void
  page: Page
  profile: PageProfile
  custom: Page | null
  setCustom: (p: Page | null) => void
  updateCampaign: (id: string, patch: Partial<Campaign>) => void
  resetCampaigns: () => void
  decision: Decision
  strictDecision: Decision
  ciqDecision: Decision
  ronBids: boolean
  comparison: Comparison
  runImpression: () => void
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(fromUrl)
  const [custom, setCustom] = useState<Page | null>(null)
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light',
  )

  const set = useCallback<Ctx['set']>((patch) => {
    setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))
  }, [])

  // URL sync (replaceState; view changes push so Back works).
  const lastView = useRef(state.view)
  useEffect(() => {
    const url = toUrl(state)
    if (url === `${window.location.pathname}${window.location.search}`) return
    if (lastView.current !== state.view) window.history.pushState(null, '', url)
    else window.history.replaceState(null, '', url)
    lastView.current = state.view
  }, [state])
  useEffect(() => {
    const onPop = () => setState((s) => ({ ...fromUrl(), guided: s.guided, run: s.run }))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === 'light' ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      try {
        localStorage.setItem('ciq-theme', next)
      } catch {
        /* incognito */
      }
      return next
    })
  }, [])

  const page = (state.pageId === 'custom' && custom) || getPage(state.pageId) || getPage('P1')!
  const profile = state.rescored.includes(page.id) && page.rescored ? page.rescored : page.profile
  const ronBids = ronBidsOn(state.run)

  const ciqDecision = useMemo(
    () => decide(page, profile, state.campaigns, 'contextiq', state.opts, ronBids),
    [page, profile, state.campaigns, state.opts, ronBids],
  )
  const strictDecision = useMemo(
    () => decide(page, profile, state.campaigns, 'strict', state.opts, ronBids),
    [page, profile, state.campaigns, state.opts, ronBids],
  )
  const comparison = useMemo(() => compare(inventory(), state.campaigns, state.opts), [state.campaigns, state.opts])

  const updateCampaign = useCallback((id: string, patch: Partial<Campaign>) => {
    setState((s) => ({ ...s, campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  }, [])
  const resetCampaigns = useCallback(() => {
    setState((s) => ({ ...s, campaigns: decodeCampaigns(null), opts: DEFAULT_OPTIONS }))
  }, [])
  const runImpression = useCallback(() => setState((s) => ({ ...s, run: s.run + 1 })), [])

  const value: Ctx = {
    state,
    set,
    page,
    profile,
    custom,
    setCustom,
    updateCampaign,
    resetCampaigns,
    decision: state.strategy === 'strict' ? strictDecision : ciqDecision,
    strictDecision,
    ciqDecision,
    ronBids,
    comparison,
    runImpression,
    theme,
    toggleTheme,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside provider')
  return c
}
