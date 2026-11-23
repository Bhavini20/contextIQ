import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { Check, Minus, Play, X, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { useApp } from '../../app/state'
import { BandTag, MatchMeter, ReasonChip, Segmented, Tip } from '../../components/ui'
import { type CampaignEval, type Decision, type Provenance } from '../../engine/engine'
import { topicName, RELATIONSHIP_LABEL } from '../../engine/taxonomy'
import type { Strategy } from '../../engine/types'
import { money, pm, prob, prob3, signedMoney } from '../../lib/format'

const ORDER = { won: 0, lost: 1, 'no-bid': 2, excluded: 3 } as const

export function Trace() {
  const { state, set, decision, ciqDecision, strictDecision, runImpression, page, profile, ronBids } = useApp()
  const reduce = useReducedMotion()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) runImpression()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [runImpression])

  const replay = `${page.id}-${state.run}-${profile.source}`
  const maxBid = Math.max(...state.campaigns.map((c) => c.baseBid)) * 1.08
  const rows = [...decision.evals].sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || (b.bid ?? 0) - (a.bid ?? 0) || b.pMatch - a.pMatch)
  const strict = state.strategy === 'strict'

  return (
    <section aria-label="Decision trace" className="mt-10 scroll-mt-20">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.01em]">Decision trace</h2>
          <p className="mt-1 text-sm text-ink-3">
            One ad request on <span className="text-ink-2">{page.id === 'custom' ? 'your article' : page.id}</span>. Gate → threshold → price → auction.{' '}
            <span className="font-mono text-xs text-ink-4">request #{String(state.run).padStart(4, '0')}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented<Strategy>
            label="Matching strategy"
            value={state.strategy}
            onChange={(v) => set({ strategy: v })}
            options={[
              { value: 'contextiq', label: 'ContextIQ' },
              { value: 'strict', label: 'Strict (today)' },
            ]}
          />
          <button
            onClick={runImpression}
            className="inline-flex items-center gap-2 rounded-lg bg-cta px-3.5 py-2 text-sm font-medium text-white hover:bg-cta-hover"
            aria-keyshortcuts="R"
          >
            <Play size={14} /> Run impression
            <kbd className="hidden rounded border border-white/30 px-1 font-mono text-[10px] sm:inline">R</kbd>
          </button>
        </div>
      </div>

      <WinnerCard decision={decision} other={strict ? ciqDecision : strictDecision} />

      {/* Bid ladder */}
      <div className="mt-6" role="table" aria-label="Campaign evaluations">
        <div role="row" className="hidden grid-cols-[minmax(150px,1.3fr)_52px_44px_84px_70px_52px_60px_minmax(170px,2fr)_36px_136px] items-end gap-2.5 border-b border-line pb-2 text-[11px] text-ink-3 xl:grid">
          <span role="columnheader">Campaign</span>
          <Tip tip="How close the page's best topic sits to the campaign target in the taxonomy."><span role="columnheader" className="border-b border-dotted border-ink-4">Closeness</span></Tip>
          <Tip tip="Closeness × (0.5 + 0.5 × topic share), best topic on the page."><span role="columnheader" className="border-b border-dotted border-ink-4">Fit</span></Tip>
          <Tip tip="Confidence × fit."><span role="columnheader" className="border-b border-dotted border-ink-4">P(match)</span></Tip>
          <span role="columnheader">Band</span>
          <span role="columnheader">Suitability</span>
          <Tip tip={strict ? 'Primary topic inside the target, and confidence ≥ 0.70.' : 'Applies to incremental bids only. Protected (Strict-eligible) bids skip it.'}>
            <span role="columnheader" className="border-b border-dotted border-ink-4">{strict ? 'Topic, conf.' : 'Threshold'}</span>
          </Tip>
          <span role="columnheader">{strict ? 'Bid (full base)' : 'Bid (original → final)'}</span>
          <span role="columnheader">Floor</span>
          <span role="columnheader" className="text-right">Outcome</span>
        </div>
        <LayoutGroup>
          <div className="relative">
            {/* Floor line across the ladder column (desktop) */}
            <ol>
              {rows.map((e, i) => (
                <Row key={e.campaign.id} e={e} i={i} maxBid={maxBid} floor={page.floor} replay={replay} strict={strict} reduce={!!reduce} ronBids={ronBids} />
              ))}
            </ol>
          </div>
        </LayoutGroup>
      </div>

      {/* Latency strip */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-sunken px-4 py-3 font-mono text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5 font-sans text-ink">
          <Zap size={13} className="text-accent" /> Request path
        </span>
        <span>{profile.source === 'scored' || profile.source === 'demo-classifier' ? 'Cache lookup 3 ms' : 'Cache miss → section profile 4 ms'}</span>
        <span className="text-ink-4">·</span>
        <span>rules 1 ms</span>
        <span className="text-ink-4">·</span>
        <span>auction 2 ms</span>
        <span className="font-sans text-ink-3">(simulated) · no model runs in the request path; scoring happens in the background.</span>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Floor on this page: <span className="font-mono">{money(page.floor)}</span>. Run-of-network bids {money(0.6)} on about half of requests; on this one it{' '}
        {ronBids ? 'bid' : 'sat out'}. Press Run impression to draw another request.
      </p>
    </section>
  )
}

function WinnerCard({ decision, other }: { decision: Decision; other: Decision }) {
  const w = decision.winner
  const strict = decision.strategy === 'strict'
  const delta = decision.price - other.price
  /** ContextIQ minus Strict, whichever side is on screen. */
  const gain = strict ? -delta : delta
  const otherLabel = other.winner ? `${other.winner.campaign.name} ${money(other.price)}` : 'Unfilled'

  let headline: React.ReactNode
  let body: React.ReactNode
  if (!w) {
    headline = <span className="text-ink">Unfilled</span>
    body = (
      <>
        No bid survived. Every campaign, and why:
        <ul className="mt-2 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
          {decision.evals.map((e) => (
            <li key={e.campaign.id} className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 text-ink">{e.campaign.name}</span>
              <span className="min-w-0 text-ink-3">{whyOut(e, decision)}</span>
            </li>
          ))}
        </ul>
      </>
    )
  } else if (w.campaign.kind === 'ron') {
    headline = (
      <>
        Run-of-network fills at <span className="font-mono">{money(w.bid!)}</span>
      </>
    )
    body = 'No contextual campaign qualified, so non-contextual demand takes it at a low price.'
  } else {
    const c = w.campaign
    const target = topicName(c.target!)
    headline = (
      <>
        {c.name} wins at <span className="font-mono">{money(w.bid!)}</span> <span className="text-base font-normal text-ink-3">CPM</span>
      </>
    )
    body = strict ? (
      <>Strict matching: the page's primary topic sits in the {target} target and confidence is at least 0.70, so it pays the full base bid.</>
    ) : w.provenance === 'protected' ? (
      <>
        Strict would accept this bid today (primary topic in {target}, confidence at least 0.70), so it is protected: {c.name} bids its full base{' '}
        {money(c.baseBid)}. The threshold and bid curve never touch protected bids.
      </>
    ) : (
      <>
        Strict wouldn't accept this bid, so ContextIQ adds it as an incremental match. {c.name} pays {money(w.bid!)} because we're{' '}
        {Math.round(w.pMatch * 100)}% sure this page is a {w.band === 'specific' ? 'strong' : w.band === 'broad' ? 'real but partial' : 'weak'}{' '}
        {target.toLowerCase()} match: base {money(c.baseBid)} × {c.preset === 'broad' ? `(0.5 + 0.5 × ${prob3(w.pMatch)})` : prob3(w.pMatch)}
        {c.preset === 'broad' ? ', its Broad reach curve' : ''} = {money(w.bid!)}.
      </>
    )
  }

  return (
    <motion.div
      layout
      className={`mt-5 grid gap-5 rounded-xl border p-5 sm:grid-cols-[1fr_auto] sm:p-6 ${w && !strict && w.campaign.kind === 'contextual' ? 'border-accent/40 bg-accent-soft/50' : 'border-line bg-surface'}`}
      aria-live="polite"
    >
      <div className="min-w-0">
        <div className="label mb-1.5">{strict ? 'Strict matching (today)' : 'ContextIQ'} · winner</div>
        <div className="text-2xl font-semibold tracking-[-0.015em] text-ink sm:text-[28px]">{headline}</div>
        {w && w.campaign.kind === 'contextual' && (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
            {!strict && w.provenance && <ProvenanceTag p={w.provenance} />}
            <BandTag band={w.band} />
            <Tip tip={`${prob3(decision.profile.confidence ?? 0)} confidence × ${prob3(w.fit.fit)} fit = ${prob3(w.pMatch)}`}>
              <span className="font-mono">P(match) {pm(w.pMatch, w.campaign.threshold)}</span>
            </Tip>
            {w.fit.topic && (
              <span>
                Driven by: {topicName(w.fit.topic.topic)} {Math.round(w.fit.topic.share * 100)}% → {RELATIONSHIP_LABEL[w.fit.relationship]}
              </span>
            )}
          </div>
        )}
        <div className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-2">{body}</div>
      </div>
      <div className="border-t border-line pt-4 sm:min-w-[200px] sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
        <div className="label mb-1.5">{strict ? 'ContextIQ would' : 'Strict matching would'}</div>
        <div className="text-[15px] text-ink">{otherLabel}</div>
        <div className={`mt-1 font-mono text-sm ${gain > 0.0001 ? 'text-pos' : gain < -0.0001 ? 'text-neg' : 'text-ink-3'}`}>
          {Math.abs(gain) < 0.0001 ? 'Same as today' : `ContextIQ adds ${signedMoney(gain)}`}
        </div>
      </div>
    </motion.div>
  )
}

export function ProvenanceTag({ p, muted = false }: { p: Provenance; muted?: boolean }) {
  return p === 'protected' ? (
    <Tip tip="Strict would accept this bid today, so it bids its full base bid. The threshold and curve never apply.">
      <span className={`inline-flex whitespace-nowrap rounded border border-line-2 bg-surface px-1.5 py-px text-[10px] font-medium tracking-wide text-ink-2 uppercase ${muted ? 'opacity-60' : ''}`}>
        Protected — Strict eligible
      </span>
    </Tip>
  ) : (
    <Tip tip="Strict wouldn't accept this bid. ContextIQ adds it because P(match) clears the threshold, priced by the preset curve.">
      <span className={`inline-flex whitespace-nowrap rounded border border-accent/30 bg-accent-soft px-1.5 py-px text-[10px] font-medium tracking-wide text-accent-ink uppercase ${muted ? 'opacity-60' : ''}`}>
        Incremental — ContextIQ match
      </span>
    </Tip>
  )
}

function Row({
  e,
  i,
  maxBid,
  floor,
  replay,
  strict,
  reduce,
  ronBids,
}: {
  e: CampaignEval
  i: number
  maxBid: number
  floor: number
  replay: string
  strict: boolean
  reduce: boolean
  ronBids: boolean
}) {
  const c = e.campaign
  const out = e.outcome === 'excluded' || e.outcome === 'no-bid'
  const ron = c.kind === 'ron'
  const pos = (x: number) => `${Math.min(100, (x / maxBid) * 100)}%`
  const delay = reduce ? 0 : 0.15 + i * 0.07

  const outcome =
    e.outcome === 'won' ? (
      <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
        <Check size={12} /> Won
      </span>
    ) : e.outcome === 'lost' ? (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
        {e.reason === 'BELOW-FLOOR' ? <ReasonChip code="BELOW-FLOOR" /> : 'Lost · outbid'}
      </span>
    ) : e.outcome === 'no-bid' ? (
      <ReasonChip code="NO-BID" tone="muted" />
    ) : (
      <span className="inline-flex items-center gap-1.5">
        {e.reason && <ReasonChip code={e.reason} />}
      </span>
    )

  const gate = (pass: boolean | null | undefined, tip: string) =>
    pass == null ? (
      <Minus size={14} className="text-ink-4" aria-label="not reached" />
    ) : (
      <Tip tip={tip}>
        {pass ? <Check size={15} className="text-pos" aria-label="pass" /> : <X size={15} className="text-neg" aria-label="fail" />}
      </Tip>
    )

  const suitPass = e.suitability.pass
  const thrCell = ron ? (
    <span className="text-[11px] text-ink-4">n/a</span>
  ) : strict ? (
    <span className="inline-flex gap-1">
      {gate(suitPass ? e.strictTopicPass ?? null : null, 'Primary topic inside campaign target')}
      {gate(suitPass && e.strictTopicPass ? e.strictConfidencePass ?? null : null, 'Confidence ≥ 0.70')}
    </span>
  ) : e.provenance === 'protected' ? (
    <Tip tip="Protected bid: Strict-eligible, so the threshold doesn't apply.">
      <span className="text-[11px] text-ink-4">skip</span>
    </Tip>
  ) : (
    gate(suitPass ? e.thresholdPass : null, `P(match) ${pm(e.pMatch, c.threshold)} vs threshold ${prob(c.threshold)}`)
  )

  const bar = (
    <div className="relative h-6 w-full">
      <div className="absolute inset-y-[11px] right-0 left-0 rounded-full bg-sunken" />
      {/* floor marker */}
      <span
        className="absolute inset-y-0 w-px border-l border-dashed border-ink-3"
        style={{ left: pos(floor) }}
        title={`Publisher floor ${money(floor)}`}
        aria-hidden
      />
      {/* base bid ghost tick */}
      {!ron && e.bid !== null && (
        <span className="absolute top-1 bottom-1 w-px bg-ink-4/60" style={{ left: pos(c.baseBid) }} aria-hidden title="Base bid" />
      )}
      {e.bid !== null && (
        <motion.div
          key={replay}
          className={`absolute top-[7px] h-2.5 rounded-full ${e.outcome === 'won' ? 'bg-accent' : e.reason === 'BELOW-FLOOR' ? 'bg-ink-4/50' : 'bg-ink-4'}`}
          initial={{ width: reduce ? pos(e.bid) : pos(ron ? e.bid : c.baseBid * (strict ? 1 : 1)) }}
          animate={{ width: pos(e.bid) }}
          transition={{ duration: reduce ? 0 : 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
        />
      )}
    </div>
  )

  return (
    <motion.li
      layout={!reduce}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      className={`border-b border-line py-3 ${e.outcome === 'won' ? 'bg-accent-soft/30' : ''}`}
    >
      <motion.div
        key={replay + c.id}
        initial={{ opacity: 1 }}
        animate={{ opacity: out ? 0.55 : 1 }}
        transition={{ duration: 0.3, delay: out ? delay : 0 }}
        className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-2 xl:grid-cols-[minmax(150px,1.3fr)_52px_44px_84px_70px_52px_60px_minmax(170px,2fr)_36px_136px]"
        role="row"
      >
        <div role="cell" className="min-w-0">
          <div className={`truncate text-sm font-medium ${out ? 'text-ink-3 line-through decoration-ink-4' : 'text-ink'}`}>{c.name}</div>
          <div className="truncate text-[11px] text-ink-3">
            {ron ? (ronBids ? 'Non-contextual · bids this request' : 'Non-contextual · ~50% of requests') : `${topicName(c.target!)} · ${c.preset === 'broad' ? 'Broad reach' : c.preset === 'strict' ? 'Strict' : 'Balanced'}`}
          </div>
          {!strict && e.provenance && (
            <div className="mt-1">
              <ProvenanceTag p={e.provenance} muted={e.outcome !== 'won'} />
            </div>
          )}
        </div>
        <div role="cell" className="text-right xl:hidden">{outcome}</div>

        {/* Desktop cells */}
        <span role="cell" className="hidden font-mono text-[13px] text-ink-2 xl:block">{ron ? '—' : e.fit.closeness.toFixed(2)}</span>
        <span role="cell" className="hidden font-mono text-[13px] text-ink-2 xl:block">{ron ? '—' : e.fit.fit.toFixed(2)}</span>
        <div role="cell" className="hidden xl:block">
          {ron ? (
            <span className="font-mono text-[13px] text-ink-4">—</span>
          ) : (
            <>
              <Tip tip={`${prob3(e.pMatch / (e.fit.fit || 1))} confidence × ${prob3(e.fit.fit)} fit = ${prob3(e.pMatch)}`}>
                <span className="font-mono text-[13px] text-ink">{pm(e.pMatch, strict ? null : c.threshold)}</span>
              </Tip>
              <div className="mt-1">
                <MatchMeter p={e.pMatch} threshold={strict ? null : c.threshold} compact muted={out} />
              </div>
            </>
          )}
        </div>
        <div role="cell" className="hidden xl:block">{ron ? <span className="text-ink-4">—</span> : <BandTag band={e.band} muted={out} />}</div>
        <div role="cell" className="hidden xl:block">{gate(e.suitability.pass, e.suitability.pass ? 'No excluded flags on this page' : `Excluded: ${e.suitability.reasons.join(', ')}`)}</div>
        <div role="cell" className="hidden xl:block">{thrCell}</div>
        <div role="cell" className="col-span-2 flex items-center gap-3 xl:col-span-1">
          <div className="min-w-0 flex-1">{e.bid !== null ? bar : <div className="h-6" />}</div>
          {!strict && !ron && e.bid !== null ? (
            <span className="shrink-0 text-right font-mono text-[12px] whitespace-nowrap" title={`Original bid ${money(e.originalBid)} · final bid ${money(e.bid)}`}>
              <span className="text-ink-3">{money(e.originalBid)}</span>
              <span className="text-ink-4"> → </span>
              <span className={e.outcome === 'won' ? 'font-semibold text-ink' : 'text-ink-2'}>{money(e.bid)}</span>
            </span>
          ) : (
            <span className={`w-11 shrink-0 text-right font-mono text-[13px] ${e.bid === null ? 'text-ink-4' : e.outcome === 'won' ? 'font-semibold text-ink' : 'text-ink-2'}`}>
              {e.bid !== null ? money(e.bid) : '—'}
            </span>
          )}
        </div>
        <div role="cell" className="hidden xl:block">{gate(e.floorPass, e.floorPass ? `Clears ${money(floor)} floor` : `Below ${money(floor)} floor`)}</div>
        <div role="cell" className="hidden text-right xl:block">{outcome}</div>

        {/* Mobile detail line */}
        {!ron && (
          <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-ink-3 xl:hidden">
            <span>closeness {e.fit.closeness.toFixed(2)}</span>
            <span>fit {e.fit.fit.toFixed(2)}</span>
            <span className="text-ink">P {pm(e.pMatch, strict ? null : c.threshold)}</span>
            <BandTag band={e.band} muted={out} />
            {!strict && <span>min {prob(c.threshold)}</span>}
          </div>
        )}
      </motion.div>
    </motion.li>
  )
}

/** One short reason per campaign when a request goes unfilled. */
function whyOut(e: CampaignEval, d: Decision): string {
  const c = e.campaign
  switch (e.reason) {
    case 'SUIT-FRAUD':
    case 'SUIT-CRIME':
    case 'SUIT-TRAGEDY':
    case 'SUIT-LOWQ':
      return `excluded by suitability (${e.reason})`
    case 'SUIT-LANG':
      return 'excluded: page language not yet validated'
    case 'BELOW-THRESHOLD':
      return e.pMatch === 0
        ? 'no topic overlap (P(match) 0.00)'
        : `P(match) ${pm(e.pMatch, c.threshold)} below its ${prob(c.threshold)} threshold`
    case 'OFF-TOPIC':
      return 'primary topic outside its target'
    case 'LOW-CONFIDENCE':
      return 'confidence below 0.70'
    case 'BELOW-FLOOR':
      return `bid ${money(e.bid ?? 0)} below the ${money(d.page.floor)} floor`
    case 'NO-BID':
      return 'sat out this request (bids on about half)'
    default:
      return e.outcome === 'lost' ? 'outbid' : 'did not bid'
  }
}
