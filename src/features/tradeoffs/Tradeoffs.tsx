import { ChevronDown } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useApp } from '../../app/state'
import { Footnote, Num, Slider, Switch, Tip } from '../../components/ui'
import { inventory } from '../../engine/inventory'
import {
  calibration,
  market as computeMarket,
  marketSweep,
  shifted,
  SHIFTS,
  SWEEP,
  withThreshold,
  type Comparison,
  type Market,
} from '../../engine/metrics'
import { count, money, pct, prob, signedMoney, signedPct, signedPts, usd, PER_M, PER_M_LABEL, signedUsd } from '../../lib/format'

const signedShift = (d: number) => (Math.abs(d) < 1e-9 ? '±0.00' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}`)
const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`
const pts1 = (x: number) => `${Math.abs(x * 100).toFixed(1)} pts`

export function Tradeoffs() {
  const { state, set, market: saved } = useApp()
  const contextual = state.campaigns.filter((c) => c.kind === 'contextual')
  const focusCampaign = contextual.find((c) => c.id === state.focus)
  const all = !focusCampaign
  const shift = all ? state.shift : 0

  // "All campaigns" shifts each campaign's own threshold; the saved configs are never rewritten.
  const m: Market = useMemo(
    () => (Math.abs(shift) > 1e-9 ? computeMarket(inventory(), shifted(state.campaigns, shift), state.opts) : saved),
    [shift, state.campaigns, state.opts, saved],
  )
  const cmp = m.cmp
  const xs = all ? SHIFTS : SWEEP
  const x = all ? shift : focusCampaign.threshold
  const xfmt = all ? signedShift : prob

  const setX = (v: number) => {
    if (all) set({ shift: Math.round(Math.min(0.3, Math.max(-0.2, v)) * 20) / 20 })
    else {
      const t = Math.round(Math.min(0.95, Math.max(0.3, v)) * 20) / 20
      set((s) => ({ campaigns: withThreshold(s.campaigns, s.focus, t) }))
    }
  }

  // The sweep doesn't depend on the current position on the x axis: memo on everything else.
  const sweepKey = JSON.stringify([
    state.focus,
    state.opts,
    state.campaigns.map((c) => [c.id, c.preset, c.baseBid, c.excludes, !all && c.id === state.focus ? 0 : c.threshold]),
  ])
  const points = useMemo(
    () =>
      marketSweep(
        inventory(),
        xs,
        all ? (d) => shifted(state.campaigns, d) : (t) => withThreshold(state.campaigns, state.focus, t),
        state.opts,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sweepKey],
  )
  const calib = useMemo(() => calibration(cmp.ciqResults), [cmp])

  const setting = all ? (
    Math.abs(shift) < 1e-9 ? (
      <>each campaign's own threshold</>
    ) : (
      <>
        every threshold <Em>{signedShift(shift)}</Em> from its preset
      </>
    )
  ) : (
    <>
      <Em>{prob(focusCampaign.threshold)}</Em> for {focusCampaign.name}
    </>
  )

  return (
    <div>
      <div className="label mb-3">Trade-off explorer</div>
      <Headline m={m} setting={setting} />

      {/* Controls */}
      <div className="mt-8 grid gap-6 border-y border-line py-5 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <label className="flex flex-col gap-1.5 text-xs text-ink-3">
          Campaign
          <select
            value={state.focus}
            onChange={(e) => set({ focus: e.target.value })}
            className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
          >
            <option value="all">All campaigns</option>
            {contextual.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <div className="flex items-baseline justify-between gap-3 text-xs text-ink-3">
            {all ? (
              <Tip tip="Moves every contextual campaign's threshold up or down from its own preset (Balanced 0.60, Broad reach 0.40, Strict 0.80). Saved campaign settings are not changed.">
                <span className="border-b border-dotted border-ink-4">Shift every threshold from its preset</span>
              </Tip>
            ) : (
              <span>Minimum match probability (threshold)</span>
            )}
            <span className="font-mono text-lg text-accent-ink">{xfmt(x)}</span>
          </div>
          <Slider
            label={all ? 'Threshold shift' : 'Threshold'}
            value={x}
            min={xs[0]}
            max={xs[xs.length - 1]}
            step={0.05}
            onChange={setX}
            format={xfmt}
          />
          <div className="flex justify-between font-mono text-[10px] text-ink-4">
            {all ? (
              <>
                <span>−0.20 broader</span>
                <span>+0.30 stricter</span>
              </>
            ) : (
              <>
                <span>0.30 broad</span>
                <span>0.95 strict</span>
              </>
            )}
          </div>
          {all && (
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-3">
              {contextual.map((c) => `${c.name.split(' ')[0]} ${prob(Math.min(0.95, Math.max(0.05, c.threshold + shift)))}`).join(' · ')}
            </p>
          )}
        </div>
        <div className="space-y-3">
          <Switch
            checked={state.opts.strictSuitability}
            onChange={(v) => set((s) => ({ opts: { ...s.opts, strictSuitability: v } }))}
            label={
              <Tip tip="Also exclude pages in languages the model isn't validated on (SUIT-LANG), e.g. Hinglish.">
                <span>Strict suitability</span>
              </Tip>
            }
          />
          <p className="text-xs leading-relaxed text-ink-3">
            Strict-eligible bids are protected: they bid in full and the threshold never touches them. The threshold only decides which extra matches join.
          </p>
        </div>
      </div>

      <Kpis m={m} />
      <PublisherNote className="mt-3" />

      {/* Main chart: aligned small multiples, one cursor */}
      <section aria-label="Threshold sweep" className="mt-10 scroll-mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">What the threshold trades</h2>
          <p className="text-sm text-ink-3">Drag across any chart to move the {all ? 'shift' : 'threshold'}. Dashed grey: Strict matching, which has no threshold.</p>
        </div>
        <div className="mt-5 grid gap-8 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          <Multiple title="Fill rate" side="Publisher" xs={xs} xfmt={xfmt} ys={points.map((p) => p.fillRate)} strict={cmp.strict.fillRate} fmt={pct} value={x} onChange={setX} note={note(xs, xfmt, points.map((p) => p.fillRate), cmp.strict.fillRate, 'fill')} />
          <Multiple title="Revenue per 1,000 requests" side="Publisher" xs={xs} xfmt={xfmt} ys={points.map((p) => p.revenue)} strict={cmp.strict.revenue} fmt={money} value={x} onChange={setX} note={note(xs, xfmt, points.map((p) => p.revenue), cmp.strict.revenue, 'revenue')} />
          <Multiple title="Cost per conversion" side="Advertiser" xs={xs} xfmt={xfmt} ys={points.map((p) => p.cpa)} strict={m.adv.strict.cpa} fmt={money} value={x} onChange={setX} note={note(xs, xfmt, points.map((p) => p.cpa), m.adv.strict.cpa, 'cpa')} />
          <Multiple title="Relevance precision" side="Advertiser" xs={xs} xfmt={xfmt} ys={points.map((p) => p.precision)} strict={cmp.strict.precision} fmt={pct} value={x} onChange={setX} note={note(xs, xfmt, points.map((p) => p.precision), cmp.strict.precision, 'relevance')} />
        </div>
        <p className="mt-4 text-sm text-ink-2">
          <span className="font-medium text-ink">What to notice:</span> a lower threshold admits more incremental matches, buying reach with some relevance; a higher
          one admits fewer. Revenue never drops below Strict anywhere on the curve, because protected bids don't move, and suitability violations stay at 0.
        </p>
        <Footnote className="mt-1.5" />
      </section>

      <Breakdown cmp={cmp} />
      <Calibration bins={calib} />
    </div>
  )
}

/* ---------- The sentence that rewrites itself ---------- */
function Headline({ m, setting }: { m: Market; setting: React.ReactNode }) {
  const c = m.cmp
  const fill = c.ciq.fillRate - c.strict.fillRate
  const rev = c.strict.revenue ? c.ciq.revenue / c.strict.revenue - 1 : 0
  const v = c.ciq.violations
  const p = m.provenance
  const rel = c.ciq.precision - c.strict.precision
  return (
    <div aria-live="polite">
      <p className="max-w-5xl font-serif text-[24px] leading-[1.3] tracking-[-0.01em] text-ink sm:text-[32px]">
        At {setting}, ContextIQ fills <Em tone="pos">{pts1(fill)}</Em> more requests and adds <Em tone="pos">{pct1(rev)}</Em> publisher revenue, with{' '}
        {v === 0 ? <Em tone="pos">zero</Em> : <Em tone="neg">{v}</Em>} suitability violations.
      </p>
      <p className="mt-3 max-w-4xl text-[15px] leading-relaxed text-ink-2">
        Every page Strict sells today still sells at full price: <span className="font-mono text-ink">{p.protectedWins}</span> protected wins, plus{' '}
        <span className="font-mono text-ink">{p.incrementalWins}</span> incremental wins Strict couldn't make. {p.gained} requests earn more than today, the other{' '}
        {p.sameAsToday} earn the same. Advertisers pay <Delta v={m.savings} fmt={pct1} words={['less', 'more']} /> per conversion; relevance is{' '}
        <Delta v={rel} fmt={pts1} words={['higher', 'lower']} /> than Strict.
      </p>
    </div>
  )
}

/** The honesty note that sits under every publisher number. */
export function PublisherNote({ className = '' }: { className?: string }) {
  return (
    <p className={`max-w-3xl text-xs leading-relaxed text-ink-3 ${className}`}>
      Guaranteed in this deterministic simulation under unchanged auction rules. A live pilot measures it; production revenue can still vary.
    </p>
  )
}

function Delta({ v, fmt, words }: { v: number; fmt: (n: number) => string; words: [string, string] }) {
  const up = v >= 0
  return (
    <span className={`font-mono ${Math.abs(v) < 5e-4 || !up ? 'text-ink' : 'text-pos'}`}>
      {fmt(Math.abs(v))} {up ? words[0] : words[1]}
    </span>
  )
}

function Em({ children, tone }: { children: React.ReactNode; tone?: 'pos' | 'neg' }) {
  const mk = tone === 'pos' ? 'var(--pos-soft)' : tone === 'neg' ? 'var(--neg-soft)' : 'var(--accent-soft)'
  return (
    <span
      className={`marker font-sans font-medium tnum ${tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-accent-ink'}`}
      style={{ fontSize: '0.82em', ['--mk' as string]: mk }}
    >
      {children}
    </span>
  )
}

function note(xs: number[], xfmt: (n: number) => string, ys: number[], strict: number, kind: 'fill' | 'revenue' | 'relevance' | 'cpa'): string {
  if (kind === 'revenue') {
    const above = xs.filter((_, i) => ys[i] >= strict - 1e-9)
    if (above.length === xs.length) return 'At or above Strict at every threshold: protected bids never move.'
    return `At or above Strict at ${above.length} of ${xs.length} settings.`
  }
  if (kind === 'cpa') {
    const below = xs.filter((_, i) => ys[i] <= strict + 1e-9)
    if (below.length === xs.length) return 'At or below Strict per conversion everywhere: incremental matches are priced by fit.'
    if (below.length === 0) return 'Costs more per conversion than Strict everywhere.'
    return `At or below Strict per conversion from ${xfmt(Math.min(...below))} up.`
  }
  let best = 0
  let at = 0
  for (let i = 1; i < ys.length; i++) {
    const drop = kind === 'fill' ? ys[i - 1] - ys[i] : ys[i] - ys[i - 1]
    if (drop > best) {
      best = drop
      at = i
    }
  }
  if (best < 0.005) return kind === 'fill' ? 'Flat: other demand picks up what this campaign drops.' : 'Little change across the range.'
  return kind === 'fill'
    ? `Steepest loss of reach between ${xfmt(xs[at - 1])} and ${xfmt(xs[at])}.`
    : `Biggest relevance gain between ${xfmt(xs[at - 1])} and ${xfmt(xs[at])}.`
}

function Multiple({
  title,
  side,
  xs,
  xfmt,
  ys,
  strict,
  fmt,
  value,
  onChange,
  note,
}: {
  title: string
  side: 'Publisher' | 'Advertiser'
  xs: number[]
  xfmt: (n: number) => string
  ys: number[]
  strict: number
  fmt: (n: number) => string
  value: number
  onChange: (t: number) => void
  note: string
}) {
  const W = 360
  const H = 200
  const pad = { l: 8, r: 8, t: 30, b: 22 }
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const dragging = useRef(false)
  const x0 = xs[0]
  const x1 = xs[xs.length - 1]
  const step = xs[1] - xs[0]

  const lo = Math.min(strict, ...ys)
  const hi = Math.max(strict, ...ys)
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 0.01)
  const y0 = lo - span * 0.25
  const y1 = hi + span * 0.25
  const x = (t: number) => pad.l + ((t - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  const line = xs.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(' ')
  const area = `${line} L${x(x1)},${H - pad.b} L${x(x0)},${H - pad.b} Z`
  const idx = Math.max(0, Math.min(ys.length - 1, Math.round((value - x0) / step)))
  const cur = ys[idx]
  const hi_ = hover ?? idx
  const hv = ys[hi_]
  const ticks = x0 < 0 ? [x0, 0, x1] : [0.3, 0.5, 0.8, 0.95].filter((t) => t >= x0 && t <= x1)

  const tFromEvent = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const t = x0 + ((px - pad.l) / (W - pad.l - pad.r)) * (x1 - x0)
    return Math.round(Math.min(x1, Math.max(x0, t)) / step) * step
  }

  return (
    <figure className="m-0 min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <figcaption className="text-sm font-medium text-ink">
          {title} <span className="ml-1 text-[10px] font-normal tracking-wide text-ink-4 uppercase">{side}</span>
        </figcaption>
        <div className="shrink-0 text-right">
          <Num value={cur} format={fmt} className="font-mono text-[15px] text-accent-ink" />
          <span className="ml-2 font-mono text-xs text-ink-3">vs {fmt(strict)}</span>
        </div>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="mt-1 touch-none overflow-visible select-none"
        role="img"
        aria-label={`${title}: ContextIQ ${fmt(cur)} at ${xfmt(value)}; Strict ${fmt(strict)}`}
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          onChange(tFromEvent(e))
        }}
        onPointerMove={(e) => {
          const t = tFromEvent(e)
          setHover(Math.round((t - x0) / step))
          if (dragging.current) onChange(t)
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => {
          setHover(null)
          dragging.current = false
        }}
        style={{ cursor: 'ew-resize' }}
      >
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line-2)" />
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 6} fontSize="10" textAnchor={t === x0 ? 'start' : t === x1 ? 'end' : 'middle'} fill="var(--ink-3)" className="tnum">
            {xfmt(t)}
          </text>
        ))}
        <defs>
          <linearGradient id={`fill-${title.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--violet)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id={`line-${title.replace(/\W/g, '')}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--violet)" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#fill-${title.replace(/\W/g, '')})`} />
        <line x1={pad.l} x2={W - pad.r} y1={y(strict)} y2={y(strict)} stroke="var(--strict)" strokeDasharray="4 4" strokeWidth={1.25} />
        <text x={W - pad.r} y={y(strict) - 5} fontSize="10" textAnchor="end" fill="var(--ink-3)">
          Strict
        </text>
        <path d={line} fill="none" stroke={`url(#line-${title.replace(/\W/g, '')})`} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <text x={pad.l} y={Math.max(12, y(ys[0]) - 8)} fontSize="10" fill="var(--accent-ink)">
          ContextIQ
        </text>
        {hover !== null && hover !== idx && (
          <g>
            <line x1={x(xs[hover])} x2={x(xs[hover])} y1={pad.t - 6} y2={H - pad.b} stroke="var(--ink-4)" strokeWidth={1} />
            <circle cx={x(xs[hover])} cy={y(hv)} r={3} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={1.5} />
          </g>
        )}
        <line x1={x(value)} x2={x(value)} y1={pad.t - 10} y2={H - pad.b} stroke="var(--ink)" strokeWidth={1.5} style={{ transition: 'all 150ms ease-out' }} />
        <circle cx={x(value)} cy={y(cur)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} style={{ transition: 'all 150ms ease-out' }} />
        {hover !== null && (
          <g>
            <rect x={Math.min(W - 160, Math.max(0, x(xs[hi_]) - 80))} y={0} width={160} height={18} rx={4} fill="var(--ink)" />
            <text x={Math.min(W - 80, Math.max(80, x(xs[hi_])))} y={12.5} fontSize="10.5" textAnchor="middle" fill="var(--paper)" className="tnum">
              {xfmt(xs[hi_])}: {fmt(hv)} · Strict {fmt(strict)}
            </text>
          </g>
        )}
      </svg>
      <p className="mt-1.5 text-xs leading-snug text-ink-3">{note}</p>
    </figure>
  )
}

type Kpi = {
  label: string
  side: 'Publisher' | 'Advertiser' | 'Guardrail'
  tip: string
  ciq: number
  strict: number
  fmt: (n: number) => string
  delta: string
  good: boolean | null
  note?: string
}

function Kpis({ m }: { m: Market }) {
  const cmp = m.cmp
  const a = m.adv
  const rel = (c: number, s: number) => signedPct(s ? c / s - 1 : 0)
  const items: Kpi[] = [
    {
      label: 'Revenue / 1,000 requests',
      side: 'Publisher',
      tip: 'North star for publishers. Sum of winning CPMs ÷ 1,000, over exactly 1,000 requests.',
      ciq: cmp.ciq.revenue,
      strict: cmp.strict.revenue,
      fmt: money,
      delta: rel(cmp.ciq.revenue, cmp.strict.revenue),
      good: cmp.ciq.revenue >= cmp.strict.revenue,
    },
    {
      label: 'Fill rate',
      side: 'Publisher',
      tip: 'Filled requests ÷ 1,000.',
      ciq: cmp.ciq.fillRate,
      strict: cmp.strict.fillRate,
      fmt: pct,
      delta: signedPts(cmp.ciq.fillRate - cmp.strict.fillRate),
      good: cmp.ciq.fillRate >= cmp.strict.fillRate,
    },
    {
      label: 'eCPM',
      side: 'Publisher',
      tip: 'Revenue ÷ filled impressions × 1,000.',
      ciq: cmp.ciq.ecpm,
      strict: cmp.strict.ecpm,
      fmt: money,
      delta: signedMoney(cmp.ciq.ecpm - cmp.strict.ecpm),
      good: null,
    },
    {
      label: 'Cost per conversion',
      side: 'Advertiser',
      tip: 'North star for advertisers. Contextual spend ÷ expected conversions, all contextual campaigns. Conversions = impressions × CTR (1.8% relevant, 0.3% not) × post-click conversion rate (3% relevant, 1% not).',
      ciq: a.ciq.cpa,
      strict: a.strict.cpa,
      fmt: money,
      delta: rel(a.ciq.cpa, a.strict.cpa),
      good: a.ciq.cpa <= a.strict.cpa + 1e-12,
    },
    {
      label: 'Relevant impressions delivered',
      side: 'Advertiser',
      tip: 'Contextual wins that are truly relevant (hidden ground truth), per 1,000 simulated requests.',
      ciq: cmp.ciq.relevantWins,
      strict: cmp.strict.relevantWins,
      fmt: (n) => count(n),
      delta: `${cmp.ciq.relevantWins - cmp.strict.relevantWins >= 0 ? '+' : '−'}${count(Math.abs(cmp.ciq.relevantWins - cmp.strict.relevantWins))}`,
      good: cmp.ciq.relevantWins >= cmp.strict.relevantWins,
    },
    {
      label: 'Relevance precision',
      side: 'Advertiser',
      tip: 'Contextual wins that are truly relevant (hidden ground truth) ÷ all contextual wins. Run-of-network excluded.',
      ciq: cmp.ciq.precision,
      strict: cmp.strict.precision,
      fmt: pct,
      delta: signedPts(cmp.ciq.precision - cmp.strict.precision),
      good: null,
      note: "Precision dips because incremental matches are broader by design; the advertiser's threshold controls how many join.",
    },
    {
      label: 'Cost / 1,000 relevant impressions',
      side: 'Advertiser',
      tip: 'Contextual spend ÷ truly relevant impressions (hidden ground truth) × 1,000. What a relevant audience costs.',
      ciq: a.ciq.costPerKRelevant,
      strict: a.strict.costPerKRelevant,
      fmt: money,
      delta: rel(a.ciq.costPerKRelevant, a.strict.costPerKRelevant),
      good: a.ciq.costPerKRelevant <= a.strict.costPerKRelevant + 1e-12,
    },
    {
      label: 'Revenue on already-selling',
      side: 'Guardrail',
      tip: 'Revenue per 1,000 requests on requests that Strict filled with a contextual campaign. Strict-eligible bids are protected, so this can never drop; a drop would be cannibalisation.',
      ciq: cmp.alreadySelling.ciq,
      strict: cmp.alreadySelling.strict,
      fmt: money,
      delta: cmp.alreadySelling.ciq >= cmp.alreadySelling.strict - 1e-9 ? `Guardrail held · ${signedMoney(cmp.alreadySelling.ciq - cmp.alreadySelling.strict)}` : 'BREACH',
      good: cmp.alreadySelling.ciq >= cmp.alreadySelling.strict - 1e-9,
    },
    {
      label: 'Suitability violations',
      side: 'Guardrail',
      tip: "Wins where a page flag is in the winner's exclusions. Must always be 0 (enforced by a unit test).",
      ciq: cmp.ciq.violations,
      strict: cmp.strict.violations,
      fmt: (n) => Math.round(n).toString(),
      delta: cmp.ciq.violations === 0 ? 'Guardrail held' : 'BREACH',
      good: cmp.ciq.violations === 0,
    },
  ]
  return (
    <div className="mt-8 grid grid-cols-2 border-t border-line sm:grid-cols-3">
      {items.map((k) => (
        <div
          key={k.label}
          className={`border-b border-line py-4 pr-3 pl-3 sm:border-r sm:pl-4 sm:[&:nth-child(3n)]:border-r-0 ${k.side === 'Advertiser' ? 'bg-[linear-gradient(180deg,var(--accent-soft),transparent)]' : ''}`}
        >
          <div>
            <span className={`text-[10px] tracking-wide uppercase ${k.side === 'Guardrail' ? 'rounded bg-sunken px-1 py-px text-ink-3' : k.side === 'Advertiser' ? 'text-accent-ink' : 'text-ink-4'}`}>
              {k.side}
            </span>
          </div>
          <Tip tip={k.tip} className="mt-1 flex">
            <span className="border-b border-dotted border-ink-4 text-xs text-ink-3">{k.label}</span>
          </Tip>
          <div className="mt-1.5 text-[26px] leading-8 font-medium tracking-[-0.02em] text-ink">
            <Num value={k.ciq} format={k.fmt} />
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 font-mono text-xs">
            <span className={k.good === null ? 'text-ink-2' : k.good ? 'text-pos' : k.side === 'Guardrail' ? 'text-neg' : 'text-ink-2'}>{k.delta}</span>
            <span className="text-ink-3">Strict {k.fmt(k.strict)}</span>
          </div>
          {k.note && <p className="mt-1.5 text-[11px] leading-snug text-ink-3">{k.note}</p>}
        </div>
      ))}
    </div>
  )
}

/** Revenue split by already-selling vs new demand. `perMillion` scales totals from 1,000 to 1M requests. */
export function Breakdown({ cmp, perMillion = false }: { cmp: Comparison; perMillion?: boolean }) {
  const k = perMillion ? PER_M : 1
  const f = perMillion ? usd : money
  const sf = perMillion ? signedUsd : signedMoney
  const max = Math.max(cmp.ciq.revenue, cmp.strict.revenue) * 1.05
  const w = (v: number) => `${(v / max) * 100}%`
  const lossAlready = cmp.alreadySelling.ciq - cmp.alreadySelling.strict
  const gainNew = cmp.newDemand.ciq - cmp.newDemand.strict
  const total = cmp.alreadySelling.requests + cmp.newDemand.requests
  const rows = [
    { label: 'Strict (today)', already: cmp.alreadySelling.strict, other: cmp.newDemand.strict, otherLabel: 'run-of-network', strict: true },
    { label: 'ContextIQ', already: cmp.alreadySelling.ciq, other: cmp.newDemand.ciq, otherLabel: 'new demand', strict: false },
  ]
  return (
    <section aria-label="Revenue breakdown" className="mt-12">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">Where the revenue comes from</h2>
      <p className="mt-1 text-sm text-ink-3">
        {perMillion ? 'Publisher revenue per 1M network requests' : 'Per 1,000 requests'}, split by whether Strict matching already sold the request to a
        contextual campaign ({pct(total ? cmp.alreadySelling.requests / total : 0)} of requests) or not ({pct(total ? cmp.newDemand.requests / total : 0)}).
      </p>
      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[96px_1fr_72px] items-center gap-3 sm:grid-cols-[120px_1fr_80px]">
            <span className={`text-sm ${r.strict ? 'text-ink-3' : 'font-medium text-ink'}`}>{r.label}</span>
            <div className="flex h-7 overflow-hidden rounded-md bg-sunken">
              <div className={`h-full transition-[width] duration-300 ${r.strict ? 'bg-ink-4/60' : 'bg-accent'}`} style={{ width: w(r.already) }} title={`Already selling: ${f(r.already * k)}`} />
              <div className={`h-full transition-[width] duration-300 ${r.strict ? 'bg-ink-4/25' : 'bg-band-broad'}`} style={{ width: w(r.other) }} title={`${r.otherLabel}: ${f(r.other * k)}`} />
            </div>
            <span className="text-right font-mono text-sm text-ink">{f((r.already + r.other) * k)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-accent" />
          <span className="text-ink-2">
            Already selling: <span className={`font-mono ${lossAlready < -1e-9 ? 'text-neg' : 'text-pos'}`}>{sf(lossAlready * k)}</span>. Protected: every
            Strict-eligible bid on pages like P1 and P7 still bids in full, so nothing Strict sold today is discounted.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-band-broad" />
          <span className="text-ink-2">
            New demand: <span className={`font-mono ${gainNew >= 0 ? 'text-pos' : 'text-neg'}`}>{sf(gainNew * k)}</span> versus run-of-network on the requests
            Strict couldn't match, like P2.
          </span>
        </div>
      </div>
      <Footnote className="mt-3" />
      {perMillion && <p className="mt-1 text-xs text-ink-3">Scaled {PER_M_LABEL}: the 1,000 simulated requests × 1,000.</p>}
    </section>
  )
}

function Calibration({ bins }: { bins: ReturnType<typeof calibration> }) {
  const [open, setOpen] = useState(false)
  const S = 220
  const p = 28
  const x = (v: number) => p + v * (S - p - 8)
  const y = (v: number) => S - p - v * (S - p - 8)
  const max = Math.max(...bins.map((b) => b.all.n), 1)
  return (
    <section className="mt-12 border-t border-line pt-5">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="text-lg font-semibold tracking-[-0.01em]">Calibration</span>
          <span className="ml-3 text-sm text-ink-3">Does P(match) 0.8 mean right 80% of the time?</span>
        </span>
        <ChevronDown size={18} className={`text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-5 grid gap-6 md:grid-cols-[260px_1fr] md:items-center">
          <svg viewBox={`0 0 ${S} ${S}`} width="100%" className="max-w-[260px]" role="img" aria-label="Calibration chart">
            <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--strict)" strokeDasharray="4 4" />
            <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(0)} stroke="var(--line-2)" />
            <line x1={x(0)} y1={y(0)} x2={x(0)} y2={y(1)} stroke="var(--line-2)" />
            {[0, 0.5, 1].map((v) => (
              <g key={v}>
                <text x={x(v)} y={S - 10} fontSize="10" textAnchor="middle" fill="var(--ink-3)">{v.toFixed(1)}</text>
                <text x={p - 6} y={y(v) + 3} fontSize="10" textAnchor="end" fill="var(--ink-3)">{v.toFixed(1)}</text>
              </g>
            ))}
            <text x={x(0.98)} y={y(0.98) + 14} fontSize="9.5" textAnchor="end" fill="var(--ink-3)">perfect calibration</text>
            {bins.map((b) =>
              b.scored.n ? <circle key={`s${b.mid}`} cx={x(b.mid)} cy={y(b.scored.rate)} r={3 + 6 * Math.sqrt(b.scored.n / max)} fill="var(--accent)" opacity={0.85} /> : null,
            )}
            {bins.map((b) =>
              b.risky.n ? (
                <circle key={`r${b.mid}`} cx={x(b.mid)} cy={y(b.risky.rate)} r={3 + 6 * Math.sqrt(b.risky.n / max)} fill="var(--surface)" stroke="var(--warn)" strokeWidth={2} />
              ) : null,
            )}
          </svg>
          <div className="text-sm leading-relaxed text-ink-2">
            <p>
              Each dot groups ContextIQ wins by P(match) in bins of 0.1 and plots the share that turned out truly relevant. On the diagonal, the score means what
              it says.
            </p>
            <ul className="mt-3 space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Scored pages: close to the line.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-warn" /> Section-fallback and keyword-stuffed pages: below it. Their confidence is
                overstated, which is why fallback confidence is lowered and production recalibrates monthly.
              </li>
            </ul>
            <Footnote className="mt-3" />
          </div>
        </div>
      )}
    </section>
  )
}
