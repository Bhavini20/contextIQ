import { ChevronDown } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useApp } from '../../app/state'
import { Footnote, Num, Slider, Switch, Tip } from '../../components/ui'
import { inventory } from '../../engine/inventory'
import { breakEvenUplift, calibration, sweep, SWEEP, withThreshold, type Comparison } from '../../engine/metrics'
import { money, pct, prob, signedMoney, signedPct, signedPts } from '../../lib/format'

export function Tradeoffs() {
  const { state, set, comparison: cmp } = useApp()
  const contextual = state.campaigns.filter((c) => c.kind === 'contextual')
  const focusCampaign = contextual.find((c) => c.id === state.focus)
  const [allT, setAllT] = useState(() => {
    const ts = [...new Set(contextual.map((c) => c.threshold))]
    return ts.length === 1 ? ts[0] : 0.6
  })
  const threshold = focusCampaign ? focusCampaign.threshold : allT

  const setThreshold = (t: number) => {
    const v = Math.round(Math.min(0.95, Math.max(0.3, t)) * 20) / 20
    if (state.focus === 'all') setAllT(v)
    set((s) => ({ campaigns: withThreshold(s.campaigns, s.focus, v) }))
  }

  // Sweep doesn't depend on the focused threshold itself: memo on everything else.
  const sweepKey = JSON.stringify([
    state.focus,
    state.opts,
    state.campaigns.map((c) => [c.id, c.preset, c.baseBid, c.excludes, state.focus === 'all' || c.id === state.focus ? 0 : c.threshold]),
  ])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const points = useMemo(() => sweep(inventory(), state.campaigns, state.focus, state.opts), [sweepKey])
  const beKey = JSON.stringify([state.campaigns, state.opts.strictSuitability])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const breakEven = useMemo(() => breakEvenUplift(inventory(), state.campaigns, state.opts), [beKey])
  const calib = useMemo(() => calibration(cmp.ciqResults), [cmp])

  const d = {
    fill: cmp.ciq.fillRate - cmp.strict.fillRate,
    rev: cmp.strict.revenue ? cmp.ciq.revenue / cmp.strict.revenue - 1 : 0,
    rel: cmp.ciq.precision - cmp.strict.precision,
  }

  return (
    <div>
      {/* The sentence that rewrites itself */}
      <div className="label mb-3">Trade-off explorer</div>
      <p className="max-w-4xl font-serif text-[24px] leading-[1.3] tracking-[-0.01em] text-ink sm:text-[32px]" aria-live="polite">
        At <Em>{prob(threshold)}</Em>
        {focusCampaign ? <> for {focusCampaign.name}</> : <> for all campaigns</>}, ContextIQ fills <Em tone={d.fill >= 0 ? 'pos' : 'neg'}>{ptsWords(d.fill)}</Em>{' '}
        {d.fill >= 0 ? 'more' : 'fewer'} requests and earns <Em tone={d.rev >= 0 ? 'pos' : 'neg'}>{Math.abs(d.rev * 100).toFixed(1)}%</Em>{' '}
        {d.rev >= 0 ? 'more' : 'less'} per 1,000, with relevance {d.rel >= 0 ? 'up' : 'down'} <Em tone={d.rel >= 0 ? 'pos' : 'neg'}>{ptsWords(d.rel)}</Em>.
      </p>

      {/* Controls */}
      <div className="mt-8 grid gap-6 border-y border-line py-5 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
        <label className="flex flex-col gap-1.5 text-xs text-ink-3">
          Campaign
          <select
            value={state.focus}
            onChange={(e) => {
              const v = e.target.value
              set((s) => ({ focus: v, campaigns: v === 'all' ? withThreshold(s.campaigns, 'all', allT) : s.campaigns }))
            }}
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
          <div className="flex items-baseline justify-between text-xs text-ink-3">
            <span>Minimum match probability (threshold)</span>
            <span className="font-mono text-lg text-accent-ink">{prob(threshold)}</span>
          </div>
          <Slider label="Threshold" value={threshold} min={0.3} max={0.95} step={0.05} onChange={setThreshold} format={prob} />
          <div className="flex justify-between font-mono text-[10px] text-ink-4">
            <span>0.30 broad</span>
            <span>0.95 strict</span>
          </div>
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
          <div>
            <div className="flex items-baseline justify-between text-xs text-ink-3">
              <Tip tip="Assumption, not a result: when advertisers trust that weak matches are discounted, they raise base bids on ContextIQ. This is the Quality Score argument from search.">
                <span className="border-b border-dotted border-ink-4">Advertiser trust uplift (assumption)</span>
              </Tip>
              <span className="font-mono text-ink">+{(state.opts.trustUplift * 100).toFixed(0)}%</span>
            </div>
            <Slider
              label="Advertiser trust uplift"
              value={state.opts.trustUplift}
              min={0}
              max={0.2}
              step={0.01}
              onChange={(v) => set((s) => ({ opts: { ...s.opts, trustUplift: Math.round(v * 100) / 100 } }))}
              format={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
        </div>
      </div>

      <BreakEven breakEven={breakEven} uplift={state.opts.trustUplift} onApply={(u) => set((s) => ({ opts: { ...s.opts, trustUplift: Math.min(0.2, Math.ceil(u * 100) / 100) } }))} />

      <Kpis cmp={cmp} />

      {/* Main chart: three aligned small multiples, one cursor */}
      <section aria-label="Threshold sweep" className="mt-10 scroll-mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-[-0.01em]">What the threshold trades</h2>
          <p className="text-sm text-ink-3">Drag across any chart to move the threshold. Dashed grey: Strict matching, which has no threshold.</p>
        </div>
        <div className="mt-5 grid gap-8 md:grid-cols-3 md:gap-6">
          <Multiple
            title="Fill rate"
            xs={SWEEP}
            ys={points.map((p) => p.fillRate)}
            strict={cmp.strict.fillRate}
            fmt={pct}
            threshold={threshold}
            onThreshold={setThreshold}
            note={note(points.map((p) => p.fillRate), cmp.strict.fillRate, 'fill')}
          />
          <Multiple
            title="Revenue per 1,000 requests"
            xs={SWEEP}
            ys={points.map((p) => p.revenue)}
            strict={cmp.strict.revenue}
            fmt={money}
            threshold={threshold}
            onThreshold={setThreshold}
            note={note(points.map((p) => p.revenue), cmp.strict.revenue, 'revenue')}
          />
          <Multiple
            title="Relevance precision"
            xs={SWEEP}
            ys={points.map((p) => p.precision)}
            strict={cmp.strict.precision}
            fmt={pct}
            threshold={threshold}
            onThreshold={setThreshold}
            note={note(points.map((p) => p.precision), cmp.strict.precision, 'relevance')}
          />
        </div>
        <p className="mt-4 text-sm text-ink-2">
          <span className="font-medium text-ink">What to notice:</span> a lower threshold buys reach with relevance; a higher one protects relevance but gives
          the requests back to run-of-network or to nobody. Suitability violations stay at 0 everywhere on the curve.
        </p>
        <Footnote className="mt-1.5" />
      </section>

      <Breakdown cmp={cmp} />
      <Calibration bins={calib} />
    </div>
  )
}

function ptsWords(x: number) {
  return `${Math.abs(x * 100).toFixed(1)} points`
}

function Em({ children, tone }: { children: React.ReactNode; tone?: 'pos' | 'neg' }) {
  return (
    <span className={`font-sans font-medium tnum ${tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-accent-ink'}`} style={{ fontSize: '0.82em' }}>
      {children}
    </span>
  )
}

function note(ys: number[], strict: number, kind: 'fill' | 'revenue' | 'relevance'): string {
  if (kind === 'revenue') {
    const above = SWEEP.filter((_, i) => ys[i] >= strict)
    if (above.length === 0) return 'Below Strict at every threshold without trust uplift.'
    if (above.length === SWEEP.length) return 'Above Strict at every threshold.'
    return `Matches or beats Strict at thresholds up to ${prob(Math.max(...above))}.`
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
    ? `Steepest loss of reach between ${prob(SWEEP[at - 1])} and ${prob(SWEEP[at])}.`
    : `Biggest relevance gain between ${prob(SWEEP[at - 1])} and ${prob(SWEEP[at])}.`
}

function Multiple({
  title,
  xs,
  ys,
  strict,
  fmt,
  threshold,
  onThreshold,
  note,
}: {
  title: string
  xs: number[]
  ys: number[]
  strict: number
  fmt: (n: number) => string
  threshold: number
  onThreshold: (t: number) => void
  note: string
}) {
  const W = 360
  const H = 200
  const pad = { l: 8, r: 8, t: 30, b: 22 }
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const dragging = useRef(false)

  const lo = Math.min(strict, ...ys)
  const hi = Math.max(strict, ...ys)
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 0.01)
  const y0 = lo - span * 0.25
  const y1 = hi + span * 0.25
  const x = (t: number) => pad.l + ((t - 0.3) / 0.65) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  const line = xs.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(1)},${y(ys[i]).toFixed(1)}`).join(' ')
  const area = `${line} L${x(0.95)},${H - pad.b} L${x(0.3)},${H - pad.b} Z`
  const idx = Math.round((threshold - 0.3) / 0.05)
  const cur = ys[Math.max(0, Math.min(ys.length - 1, idx))]
  const hi_ = hover ?? idx
  const hv = ys[hi_]

  const tFromEvent = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const t = 0.3 + ((px - pad.l) / (W - pad.l - pad.r)) * 0.65
    return Math.round(Math.min(0.95, Math.max(0.3, t)) * 20) / 20
  }

  return (
    <figure className="m-0 min-w-0">
      <div className="flex items-baseline justify-between">
        <figcaption className="text-sm font-medium text-ink">{title}</figcaption>
        <div className="text-right">
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
        aria-label={`${title}: ContextIQ ${fmt(cur)} at threshold ${prob(threshold)}; Strict ${fmt(strict)}`}
        onPointerDown={(e) => {
          dragging.current = true
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
          onThreshold(tFromEvent(e))
        }}
        onPointerMove={(e) => {
          const t = tFromEvent(e)
          setHover(Math.round((t - 0.3) / 0.05))
          if (dragging.current) onThreshold(t)
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => {
          setHover(null)
          dragging.current = false
        }}
        style={{ cursor: 'ew-resize' }}
      >
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--line-2)" />
        {[0.3, 0.5, 0.8, 0.95].map((t) => (
          <text key={t} x={x(t)} y={H - 6} fontSize="10" textAnchor="middle" fill="var(--ink-3)" className="tnum">
            {t.toFixed(2)}
          </text>
        ))}
        <path d={area} fill="var(--accent)" opacity={0.06} />
        {/* Strict baseline */}
        <line x1={pad.l} x2={W - pad.r} y1={y(strict)} y2={y(strict)} stroke="var(--strict)" strokeDasharray="4 4" strokeWidth={1.25} />
        <text x={W - pad.r} y={y(strict) - 5} fontSize="10" textAnchor="end" fill="var(--ink-3)">
          Strict
        </text>
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2.25} strokeLinejoin="round" />
        <text x={pad.l} y={Math.max(12, y(ys[0]) - 8)} fontSize="10" fill="var(--accent-ink)">
          ContextIQ
        </text>
        {/* hover crosshair */}
        {hover !== null && hover !== idx && (
          <g>
            <line x1={x(xs[hover])} x2={x(xs[hover])} y1={pad.t - 6} y2={H - pad.b} stroke="var(--ink-4)" strokeWidth={1} />
            <circle cx={x(xs[hover])} cy={y(hv)} r={3} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={1.5} />
          </g>
        )}
        {/* threshold cursor */}
        <line x1={x(threshold)} x2={x(threshold)} y1={pad.t - 10} y2={H - pad.b} stroke="var(--ink)" strokeWidth={1.5} style={{ transition: 'all 150ms ease-out' }} />
        <circle cx={x(threshold)} cy={y(cur)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} style={{ transition: 'all 150ms ease-out' }} />
        {hover !== null && (
          <g>
            <rect x={Math.min(W - 150, Math.max(0, x(xs[hi_]) - 75))} y={0} width={150} height={18} rx={4} fill="var(--ink)" />
            <text x={Math.min(W - 75, Math.max(75, x(xs[hi_])))} y={12.5} fontSize="10.5" textAnchor="middle" fill="var(--paper)" className="tnum">
              {prob(xs[hi_])}: {fmt(hv)} · Strict {fmt(strict)}
            </text>
          </g>
        )}
      </svg>
      <p className="mt-1.5 text-xs leading-snug text-ink-3">{note}</p>
    </figure>
  )
}

function BreakEven({ breakEven, uplift, onApply }: { breakEven: number | null; uplift: number; onApply: (u: number) => void }) {
  if (breakEven === null)
    return <p className="mt-5 text-sm text-ink-2">At these settings ContextIQ revenue stays below Strict even with a 50% trust uplift.</p>
  if (breakEven === 0)
    return (
      <p className="mt-5 text-sm text-ink-2">
        <span className="font-medium text-pos">ContextIQ out-earns Strict here with no trust uplift.</span> New demand on weak-but-real pages more than covers
        the discount on strong ones.
      </p>
    )
  const met = uplift >= breakEven - 1e-9
  return (
    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <p className="max-w-3xl text-sm leading-relaxed text-ink-2">
        <span className="font-medium text-ink">The honest number.</span> Discounting weak matches costs revenue on pages that were already selling. ContextIQ
        breaks even with Strict once advertisers raise base bids by{' '}
        <span className="font-mono font-medium text-accent-ink">{(breakEven * 100).toFixed(1)}%</span> because they trust the signal.{' '}
        {met ? 'At the current uplift it does.' : 'That is the hypothesis the pilot tests, not a result we assume.'}
      </p>
      {!met && breakEven <= 0.2 && (
        <button onClick={() => onApply(breakEven)} className="shrink-0 rounded-lg border border-line-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-sunken">
          Set uplift to {Math.ceil(breakEven * 100)}%
        </button>
      )}
    </div>
  )
}

function Kpis({ cmp }: { cmp: Comparison }) {
  const items: { label: string; tip: string; ciq: number; strict: number; fmt: (n: number) => string; delta: string; good: boolean | null; guard?: boolean }[] = [
    {
      label: 'Fill rate',
      tip: 'Filled requests ÷ 1,000.',
      ciq: cmp.ciq.fillRate,
      strict: cmp.strict.fillRate,
      fmt: pct,
      delta: signedPts(cmp.ciq.fillRate - cmp.strict.fillRate),
      good: cmp.ciq.fillRate >= cmp.strict.fillRate,
    },
    {
      label: 'Revenue / 1,000 requests',
      tip: 'North star. Sum of winning CPMs ÷ 1,000, over exactly 1,000 requests.',
      ciq: cmp.ciq.revenue,
      strict: cmp.strict.revenue,
      fmt: money,
      delta: signedPct(cmp.strict.revenue ? cmp.ciq.revenue / cmp.strict.revenue - 1 : 0),
      good: cmp.ciq.revenue >= cmp.strict.revenue,
    },
    {
      label: 'eCPM',
      tip: 'Revenue ÷ filled impressions × 1,000.',
      ciq: cmp.ciq.ecpm,
      strict: cmp.strict.ecpm,
      fmt: money,
      delta: signedMoney(cmp.ciq.ecpm - cmp.strict.ecpm),
      good: null,
    },
    {
      label: 'Relevance precision',
      tip: 'Contextual wins that are truly relevant (hidden ground truth) ÷ all contextual wins. Run-of-network excluded.',
      ciq: cmp.ciq.precision,
      strict: cmp.strict.precision,
      fmt: pct,
      delta: signedPts(cmp.ciq.precision - cmp.strict.precision),
      good: cmp.ciq.precision >= cmp.strict.precision,
    },
    {
      label: 'Suitability violations',
      tip: "Wins where a page flag is in the winner's exclusions. Guardrail: must always be 0 (enforced by a unit test).",
      ciq: cmp.ciq.violations,
      strict: cmp.strict.violations,
      fmt: (n) => Math.round(n).toString(),
      delta: cmp.ciq.violations === 0 ? 'Guardrail held' : 'BREACH',
      good: cmp.ciq.violations === 0,
      guard: true,
    },
    {
      label: 'Revenue on already-selling',
      tip: 'Guardrail. Revenue on requests that Strict filled with a contextual campaign, under each strategy. Drops here are cannibalisation.',
      ciq: cmp.alreadySelling.ciq,
      strict: cmp.alreadySelling.strict,
      fmt: money,
      delta: signedMoney(cmp.alreadySelling.ciq - cmp.alreadySelling.strict),
      good: cmp.alreadySelling.ciq >= cmp.alreadySelling.strict - 1e-9,
      guard: true,
    },
  ]
  return (
    <div className="mt-8 grid grid-cols-2 border-t border-line sm:grid-cols-3 xl:grid-cols-6">
      {items.map((k) => (
        <div key={k.label} className="border-b border-line py-4 pr-4 xl:border-r xl:pl-4 xl:first:pl-0 xl:last:border-r-0">
          <Tip tip={k.tip}>
            <span className="flex items-center gap-1.5 text-xs text-ink-3">
              {k.guard && <span className="rounded bg-sunken px-1 py-px text-[10px] tracking-wide text-ink-3 uppercase">Guardrail</span>}
              <span className="border-b border-dotted border-ink-4">{k.label}</span>
            </span>
          </Tip>
          <div className="mt-1.5 text-[26px] leading-8 font-medium tracking-[-0.02em] text-ink">
            <Num value={k.ciq} format={k.fmt} />
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 font-mono text-xs">
            <span className={k.good === null ? 'text-ink-2' : k.good ? 'text-pos' : 'text-neg'}>{k.delta}</span>
            <span className="text-ink-3">Strict {k.fmt(k.strict)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Breakdown({ cmp }: { cmp: Comparison }) {
  const max = Math.max(cmp.ciq.revenue, cmp.strict.revenue) * 1.05
  const w = (v: number) => `${(v / max) * 100}%`
  const lossAlready = cmp.alreadySelling.ciq - cmp.alreadySelling.strict
  const gainNew = cmp.newDemand.ciq - cmp.newDemand.strict
  const rows = [
    { label: 'Strict (today)', already: cmp.alreadySelling.strict, other: cmp.newDemand.strict, otherLabel: 'run-of-network', strict: true },
    { label: 'ContextIQ', already: cmp.alreadySelling.ciq, other: cmp.newDemand.ciq, otherLabel: 'new demand', strict: false },
  ]
  return (
    <section aria-label="Revenue breakdown" className="mt-12">
      <h2 className="text-lg font-semibold tracking-[-0.01em]">Where the revenue comes from</h2>
      <p className="mt-1 text-sm text-ink-3">
        Per 1,000 requests, split by whether Strict matching already sold the request to a contextual campaign ({cmp.alreadySelling.requests} requests) or
        not ({cmp.newDemand.requests}).
      </p>
      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[96px_1fr_64px] items-center gap-3 sm:grid-cols-[120px_1fr_72px]">
            <span className={`text-sm ${r.strict ? 'text-ink-3' : 'font-medium text-ink'}`}>{r.label}</span>
            <div className="flex h-7 overflow-hidden rounded-md bg-sunken">
              <div
                className={`h-full transition-[width] duration-300 ${r.strict ? 'bg-ink-4/60' : 'bg-accent'}`}
                style={{ width: w(r.already) }}
                title={`Already selling: ${money(r.already)}`}
              />
              <div
                className={`h-full transition-[width] duration-300 ${r.strict ? 'bg-ink-4/25' : 'bg-band-broad'}`}
                style={{ width: w(r.other) }}
                title={`${r.otherLabel}: ${money(r.other)}`}
              />
            </div>
            <span className="text-right font-mono text-sm text-ink">{money(r.already + r.other)}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2.5">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-accent" />
          <span className="text-ink-2">
            Already selling: <span className={`font-mono ${lossAlready < 0 ? 'text-neg' : 'text-pos'}`}>{signedMoney(lossAlready)}</span>. Discounts on
            pages Strict already sold, mostly mixed or less-certain pages like P7. Shown, not hidden.
          </span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-band-broad" />
          <span className="text-ink-2">
            New demand: <span className={`font-mono ${gainNew >= 0 ? 'text-pos' : 'text-neg'}`}>{signedMoney(gainNew)}</span> versus run-of-network on the
            requests Strict couldn't match, like P2.
          </span>
        </div>
      </div>
      <Footnote className="mt-3" />
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
