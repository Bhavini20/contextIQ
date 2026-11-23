import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { CAMPAIGNS, getPage } from '../engine/data'
import { decide, type Decision } from '../engine/engine'
import { inventory } from '../engine/inventory'
import { advertiserReport, suggestThreshold } from '../engine/metrics'
import { money, pm, prob, usd, PER_M } from '../lib/format'
import { useApp, type AppState } from './state'

type Set = ReturnType<typeof useApp>['set']

interface Step {
  title: string
  enter: (set: Set) => void
  caption: (s: AppState, ctx: ReturnType<typeof useApp>) => React.ReactNode
}

/** Every campaign back on its saved preset threshold (the sweep in step 6 must never leak into step 7). */
const atPresets = (s: AppState) => ({ campaigns: s.campaigns.map((c) => ({ ...c, threshold: CAMPAIGNS.find((x) => x.id === c.id)?.threshold ?? c.threshold })), shift: 0 })
const ev = (d: Decision, id: string) => d.evals.find((e) => e.campaign.id === id)!
const run = (s: AppState, id: string, opts: AppState['opts']) => {
  const p = getPage(id)!
  return decide(p, s.rescored.includes(id) && p.rescored ? p.rescored : p.profile, s.campaigns, 'contextiq', opts, false)
}
const B = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-ink">{children}</span>
const M = ({ children }: { children: React.ReactNode }) => <span className="font-mono text-[0.95em] text-ink">{children}</span>

export const STEPS: Step[] = [
  {
    title: 'Quality Score for contextual',
    enter: (set) => set({ view: 'story' }),
    caption: () => <>ContextIQ prices every contextual match by how good it is and how sure we are. Press Next to walk the 90-second path.</>,
  },
  {
    title: 'Pick a page',
    enter: (set) => set((s) => ({ view: 'pages', pageId: 'P1', strategy: 'contextiq', rescored: s.rescored.filter((x) => x !== 'P4') })),
    caption: () => {
      const p = getPage('P1')!
      return (
        <>
          A focused buying guide. Its profile: <B>Smartphones</B>, specificity <M>{prob(p.profile.topics[0].share)}</M>, confidence{' '}
          <M>{prob(p.profile.confidence!)}</M>, <B>Suitable</B>. Three signals, kept separate.
        </>
      )
    },
  },
  {
    title: 'Run an impression',
    enter: (set) => set((s) => ({ view: 'pages', pageId: 'P1', strategy: 'contextiq', run: s.run + 1 })),
    caption: (s, ctx) => {
      const d = run(s, 'P1', ctx.opts)
      const w = d.winner
      const volt = ev(d, 'volt')
      const below = d.evals.filter((e) => e.reason === 'BELOW-THRESHOLD')
      const near = below.filter((e) => e.pMatch > 0)
      const zero = below.filter((e) => e.pMatch === 0)
      return (
        <>
          {w ? (
            <>
              <B>{w.campaign.name}</B> wins at <M>{money(w.bid!)}</M> ({w.band === 'specific' ? 'Specific' : w.band === 'broad' ? 'Broad' : 'Fallback'})
              {w.provenance === 'protected' ? ', its full bid: Strict would sell this page too, so the bid is protected' : ''}.{' '}
            </>
          ) : null}
          {volt.bid !== null && (
            <>
              Volt Accessories bids {volt.provenance === 'protected' ? 'its full' : 'a scaled'} <M>{money(volt.bid)}</M>
              {volt.provenance === 'protected' ? ', also protected' : ''}.{' '}
            </>
          )}
          {near.map((e) => (
            <span key={e.campaign.id}>
              {e.campaign.name} is blocked by its threshold (P <M>{pm(e.pMatch, e.campaign.threshold)}</M> vs <M>{prob(e.campaign.threshold)}</M>).{' '}
            </span>
          ))}
          {zero.length > 0 && <>{zero.map((e) => e.campaign.name).join(', ')} score <M>0.00</M> and are blocked too. </>}
          Press <kbd className="rounded border border-line-2 px-1 font-mono text-[11px]">R</kbd> to run another.
        </>
      )
    },
  },
  {
    title: 'Suitability is absolute',
    enter: (set) => set((s) => ({ view: 'pages', pageId: 'P3', strategy: 'contextiq', run: s.run + 1 })),
    caption: (s, ctx) => {
      const d = run(s, 'P3', ctx.opts)
      const pz = ev(d, 'payzen')
      return (
        <>
          A payment-fraud investigation. <B>PayZen Wallet</B> is excluded with <M>{pz.reason ?? 'no exclusion'}</M> even though confidence is{' '}
          <M>{prob(d.profile.confidence!)}</M> and P(match) is <M>{pm(pz.pMatch)}</M>. The gate is never priced.
        </>
      )
    },
  },
  {
    title: 'New demand on a weak-but-real match',
    enter: (set) => set((s) => ({ view: 'pages', pageId: 'P2', strategy: 'contextiq', run: s.run + 1 })),
    caption: (s, ctx) => {
      const d = run(s, 'P2', ctx.opts)
      const nova = ev(d, 'nova')
      return (
        <>
          A city-living list with one phone tip. <B>Nova Phones</B> still qualifies (P <M>{pm(nova.pMatch, nova.campaign.threshold)}</M>) but bids a discounted{' '}
          <M>{nova.bid !== null ? money(nova.bid) : '—'}</M> in the Broad band. Strict matching would leave it to run-of-network. Toggle{' '}
          <B>Strict (today)</B> to compare.
        </>
      )
    },
  },
  {
    title: 'Move the threshold',
    enter: (set) => set({ view: 'tradeoffs', focus: 'nova' }),
    caption: (_s, ctx) => {
      const c = ctx.market.cmp
      const rev = c.strict.revenue ? c.ciq.revenue / c.strict.revenue - 1 : 0
      return (
        <>
          Watch Nova Phones' threshold sweep from <M>0.40</M> to <M>0.90</M>: fill, revenue, cost per conversion and relevance move against the dashed Strict
          baseline. Revenue never dips below it: protected bids don't move, and the threshold only decides which extra matches join. Today ContextIQ adds{' '}
          <M>{(rev * 100).toFixed(1)}%</M> publisher revenue.
        </>
      )
    },
  },
  {
    title: 'The advertiser report',
    enter: (set) => set((s) => ({ view: 'reports', reportTab: 'advertiser', focus: 'nova', ...atPresets(s) })),
    caption: (s, ctx) => {
      const nova = s.campaigns.find((c) => c.id === 'nova')!
      const r = advertiserReport(ctx.comparison, nova)
      const sug = suggestThreshold(inventory(), s.campaigns, 'nova', ctx.opts)
      return (
        <>
          Nova Phones at its preset <M>{prob(nova.threshold)}</M>: cost per conversion against Strict and results by band.{' '}
          {r.incrementalWins > 0 && r.savings > 0 ? (
            <>
              Incremental matches cost <M>{usd(r.savings * PER_M)}</M> less than full bids per 1M requests.{' '}
            </>
          ) : (
            <>All of its wins are protected at full price. </>
          )}
          {sug ? (sug.same ? <>Its threshold is already the best for its preset. </> : <>Suggested threshold: <M>{prob(sug.threshold)}</M>. </>) : null}
          That's the demo. Everything stays explorable.
        </>
      )
    },
  },
]

export function GuidedBar() {
  const ctx = useApp()
  const { state, set, updateCampaign } = ctx
  const reduce = useReducedMotion()
  const g = state.guided
  const timers = useRef<number[]>([])

  // Enter step
  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (g === null) return
    STEPS[g - 1].enter(set)
    if (g >= 3 && g <= 5) {
      timers.current.push(
        window.setTimeout(
          () => document.querySelector('[aria-label="Decision trace"]')?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }),
          350,
        ),
      )
    }
    if (g === 6) {
      timers.current.push(
        window.setTimeout(
          () => document.querySelector('[aria-label="Threshold sweep"]')?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }),
          300,
        ),
      )
      // Sweep Nova's threshold 0.40 → 0.90, then settle back on its preset 0.60.
      if (reduce) return
      const seq = [0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]
      seq.forEach((t, i) => timers.current.push(window.setTimeout(() => updateCampaign('nova', { threshold: t }), 500 + i * 230)))
      timers.current.push(window.setTimeout(() => updateCampaign('nova', { threshold: 0.6 }), 500 + seq.length * 230 + 900))
    }
    return () => {
      timers.current.forEach(clearTimeout)
      // Leaving the sweep early (Next, Back, Esc) must not strand Nova mid-sweep.
      if (g === 6) set(atPresets)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g])

  const go = (n: number | null) => set({ guided: n })
  const next = () => (g === STEPS.length ? go(null) : go((g ?? 0) + 1))
  const back = () => g && g > 1 && go(g - 1)

  useEffect(() => {
    if (g === null) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
      else if (e.key === 'Escape') go(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const step = g ? STEPS[g - 1] : null
  const caption = useMemo(() => (step ? step.caption(state, ctx) : null), [step, state, ctx])

  return (
    <AnimatePresence>
      {step && (
        <motion.div
          role="region"
          aria-label="Guided demo"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-5"
        >
          <div className="mx-auto max-w-[760px] rounded-2xl border border-line-2 bg-surface/95 p-4 shadow-[0_8px_40px_rgb(0_0_0/0.12)] backdrop-blur-md sm:p-5">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-cta-ink">
                Step {g} of {STEPS.length}
              </span>
              <div className="flex flex-1 gap-1" aria-hidden>
                {STEPS.map((_, i) => (
                  <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < g! ? 'bg-cta' : 'bg-line-2'}`} />
                ))}
              </div>
              <button onClick={() => go(null)} aria-label="Exit guided demo" className="grid h-7 w-7 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
                <X size={15} />
              </button>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={g} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.18 }} aria-live="polite">
                <div className="mt-2.5 text-[15px] font-semibold text-ink">{step.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{caption}</p>
              </motion.div>
            </AnimatePresence>
            <div className="mt-3.5 flex items-center justify-between">
              <span className="hidden text-xs text-ink-4 sm:inline">← → to navigate · Esc to exit · explore freely any time</span>
              <div className="ml-auto flex gap-2">
                <button onClick={back} disabled={g === 1} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-sunken disabled:opacity-40">
                  <ArrowLeft size={14} /> Back
                </button>
                <button onClick={next} className="inline-flex items-center gap-1 rounded-lg bg-cta px-3.5 py-1.5 text-sm font-medium text-white hover:bg-cta-hover">
                  {g === STEPS.length ? 'Finish' : 'Next step'} <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
