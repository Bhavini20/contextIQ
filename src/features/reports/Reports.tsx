import { Check, Flag, Lightbulb } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../app/state'
import { BandTag, Footnote, Num, ReasonChip, SectionTitle, Segmented } from '../../components/ui'
import { inventory } from '../../engine/inventory'
import { advertiserEconomics, advertiserReport, publisherPages, suggestThreshold, type Comparison } from '../../engine/metrics'
import { verticalOf, topicName, type TopicId } from '../../engine/taxonomy'
import type { Page } from '../../engine/types'
import { count, money, pct, prob, signedPct, signedUsd, usd, PER_M, PER_M_LABEL } from '../../lib/format'
import { Breakdown, PublisherNote } from '../tradeoffs/Tradeoffs'

export function Reports() {
  const { state, set } = useApp()
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle eyebrow="Reports" title="Transparency is the product, not a footnote.">
          Advertisers see what each band delivered and what they saved. Publishers see new demand separately from what was already selling, so any loss would show.
        </SectionTitle>
        <div className="mb-6">
          <Segmented
            label="Report"
            value={state.reportTab}
            onChange={(v) => set({ reportTab: v })}
            options={[
              { value: 'advertiser', label: 'Advertiser' },
              { value: 'publisher', label: 'Publisher' },
            ]}
          />
        </div>
      </div>
      {state.reportTab === 'advertiser' ? <Advertiser /> : <Publisher />}
    </div>
  )
}

function Advertiser() {
  const { state, set, comparison, updateCampaign, opts } = useApp()
  const contextual = state.campaigns.filter((c) => c.kind === 'contextual')
  const id = state.focus === 'all' ? 'nova' : state.focus
  const campaign = contextual.find((c) => c.id === id)!
  const report = useMemo(() => advertiserReport(comparison, campaign), [comparison, campaign])
  const suggestion = useMemo(() => suggestThreshold(inventory(), state.campaigns, id, opts), [state.campaigns, id, opts])
  /** No incremental wins: every win is a protected full-price bid, so there is nothing saved or discounted to show. */
  const allProtected = report.impressions > 0 && report.incrementalWins === 0
  const econ = useMemo(
    () => ({ ciq: advertiserEconomics(comparison.ciqResults, id), strict: advertiserEconomics(comparison.strictResults, id) }),
    [comparison, id],
  )
  const M = PER_M
  const rel = (c: number, s: number) => (c && s ? signedPct(c / s - 1) : '—')

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-ink-3" htmlFor="adv">
          Campaign
        </label>
        <select
          id="adv"
          value={id}
          onChange={(e) => set({ focus: e.target.value })}
          className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
        >
          {contextual.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-ink-3">
          {campaign.preset === 'broad' ? 'Broad reach' : campaign.preset === 'strict' ? 'Strict' : 'Balanced'} · threshold{' '}
          <span className="font-mono text-ink-2">{prob(campaign.threshold)}</span> · base <span className="font-mono text-ink-2">{money(campaign.baseBid)}</span>
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 border-t border-line sm:grid-cols-3">
        <Stat label="Impressions won" value={<Num value={report.impressions * M} format={count} />} sub={`Strict: ${count(report.strictImpressions * M)}`} />
        <Stat label="Spend" value={<Num value={report.spend * M} format={usd} />} sub={`Strict: ${usd(report.strictSpend * M)}`} />
        <Stat label="Expected conversions" value={<Num value={report.conversions * M} format={count} />} sub={`Strict: ${count(report.strictConversions * M)}`} />
        <Stat
          label="Cost per conversion"
          value={<Num value={econ.ciq.cpa} format={money} />}
          sub={
            allProtected
              ? 'Same as Strict: every win is protected'
              : `${rel(econ.ciq.cpa, econ.strict.cpa)} · Strict ${econ.strict.cpa ? money(econ.strict.cpa) : '—'}`
          }
          tone={allProtected ? undefined : econ.strict.cpa && econ.ciq.cpa ? (econ.ciq.cpa <= econ.strict.cpa ? 'pos' : 'neg') : undefined}
        />
        <Stat
          label="Cost / 1,000 relevant impressions"
          value={<Num value={econ.ciq.costPerKRelevant} format={money} />}
          sub={
            allProtected
              ? 'Same as Strict: every win is protected'
              : `${rel(econ.ciq.costPerKRelevant, econ.strict.costPerKRelevant)} · Strict ${econ.strict.costPerKRelevant ? money(econ.strict.costPerKRelevant) : '—'}`
          }
          tone={allProtected ? undefined : econ.strict.costPerKRelevant && econ.ciq.costPerKRelevant ? (econ.ciq.costPerKRelevant <= econ.strict.costPerKRelevant ? 'pos' : 'neg') : undefined}
        />
        {allProtected ? (
          <Stat
            label="Saved vs paying full bid"
            value={<span className="text-[15px] leading-snug font-normal text-ink-2">All wins protected at full price</span>}
            sub="No incremental matches at this threshold"
          />
        ) : (
          <Stat
            label="Saved vs paying full bid"
            value={<Num value={report.savings * M} format={usd} />}
            sub={`${((report.savings / (report.spend + report.savings)) * 100).toFixed(1)}% below full price on ${count(report.incrementalWins * M)} incremental wins`}
            tone="pos"
          />
        )}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Totals {PER_M_LABEL} (the 1,000 simulated requests scaled × 1,000). Cost per conversion and per 1,000 relevant impressions are rates, unscaled.
        {econ.strict.impressions === 0 && ' Strict matching wins no impressions for this campaign, so there is no Strict cost to compare.'}
      </p>
      {allProtected && (
        <p className="mt-3 rounded-lg bg-sunken px-4 py-3 text-sm text-ink-2">All wins protected at full price; no incremental matches at this threshold.</p>
      )}

      {/* By band */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="mb-3 text-left text-lg font-semibold tracking-[-0.01em] text-ink">
            Performance by band <span className="ml-1 text-sm font-normal text-ink-3">{PER_M_LABEL}</span>
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-[11px] text-ink-3">
              <th className="py-2 font-normal">Band</th>
              {['Impressions', 'Share', 'Avg CPM paid', 'CTR', 'Post-click conv.', 'Cost / conv.', 'Spend', 'Saved vs full bid'].map((h) => (
                <th key={h} className="py-2 text-right font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.bands
              .filter((b) => b.impressions > 0 || b.band !== 'fallback')
              .map((b) => (
                <tr key={b.band} className="border-b border-line hover:bg-sunken/60">
                  <td className="py-3">
                    <BandTag band={b.band} />
                  </td>
                  <Td>{count(b.impressions * M)}</Td>
                  <Td>{pct(b.share)}</Td>
                  <Td>{b.impressions ? money(b.avgCpm) : '—'}</Td>
                  <Td>{b.impressions ? pct(b.ctr) : '—'}</Td>
                  <Td>{b.impressions ? pct(b.cvr) : '—'}</Td>
                  <Td>{b.conversions ? money(b.spend / b.conversions) : '—'}</Td>
                  <Td>{usd(b.spend * M)}</Td>
                  <Td className={b.savings > 0 ? 'text-pos' : 'text-ink-3'}>{b.savings > 0 ? usd(b.savings * M) : b.impressions ? 'protected' : '—'}</Td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-ink-3">
          Expected values. Conversions = impressions × CTR × post-click conversion rate: CTR 1.8% and post-click 3% when the impression is truly relevant, 0.3%
          and 1% when not. Impressions, spend and savings are scaled {PER_M_LABEL}; a CPM is the price of 1,000 impressions.
        </p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        {/* Suggested threshold */}
        <section aria-label="Suggested threshold" className="ring-gradient rounded-xl bg-[linear-gradient(160deg,var(--accent-soft),var(--surface)_60%)] p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <Lightbulb size={16} className="text-accent" /> Suggested threshold
          </div>
          {suggestion ? (
            <>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono text-[34px] leading-none text-accent-ink">{prob(suggestion.threshold)}</span>
                <span className="text-sm text-ink-3">currently {prob(suggestion.current)}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{suggestion.reason}</p>
              <p className="mt-1 text-xs text-ink-3">
                Rule: within this preset's range ({prob(suggestion.range[0])}–{prob(suggestion.range[1])}), the threshold with the most conversions per $ that keeps
                at least half of today's impressions and doesn't lower relevance precision.
              </p>
              {!suggestion.same ? (
                <button
                  onClick={() => updateCampaign(id, { threshold: suggestion.threshold })}
                  className="mt-4 rounded-lg bg-cta px-3.5 py-2 text-sm font-medium text-white hover:bg-cta-hover"
                >
                  Apply {prob(suggestion.threshold)}
                </button>
              ) : (
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-pos">
                  <Check size={14} /> Already the best for this preset
                </p>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-2">Not enough impressions at the current settings to suggest a threshold.</p>
          )}
        </section>

        {/* Exclusions */}
        <section aria-label="Excluded impressions">
          <h3 className="text-lg font-semibold tracking-[-0.01em]">Excluded impressions by reason</h3>
          <p className="mt-1 text-sm text-ink-3">
            Requests {campaign.name} did not bid on, {PER_M_LABEL}: suitability exclusions on any page, threshold misses on pages with some relevance.
          </p>
          {report.exclusions.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">None.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {report.exclusions.map((x) => {
                const max = report.exclusions[0].count
                return (
                  <li key={x.reason} className="grid grid-cols-[132px_1fr_64px] items-center gap-3">
                    <ReasonChip code={x.reason} />
                    <div className="h-1.5 rounded-full bg-sunken">
                      <div className={`h-full rounded-full ${x.reason.startsWith('SUIT') ? 'bg-neg' : 'bg-ink-4'}`} style={{ width: `${(x.count / max) * 100}%` }} />
                    </div>
                    <span className="text-right font-mono text-sm text-ink-2">{count(x.count * M)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
      <Footnote className="mt-8" />
    </div>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`py-3 text-right font-mono text-[13px] text-ink-2 ${className}`}>{children}</td>
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="border-b border-line py-4 pr-4 sm:border-r sm:pl-4 sm:[&:nth-child(3n)]:border-r-0 sm:[&:nth-child(3n+1)]:pl-0">
      <div className="text-xs text-ink-3">{label}</div>
      <div className="mt-1.5 text-[26px] leading-8 font-medium tracking-[-0.02em] text-ink">{value}</div>
      <div className={`mt-1 font-mono text-xs ${tone === 'pos' ? 'text-pos' : tone === 'neg' ? 'text-neg' : 'text-ink-3'}`}>{sub}</div>
    </div>
  )
}

/* ---------------- Publisher view ---------------- */

const GROUPS: { id: string; label: string; match: (p: Page) => boolean }[] = [
  { id: 'all', label: 'All pages', match: () => true },
  { id: 'curated', label: 'Curated pages', match: (p) => !p.synthetic },
  ...(['technology', 'finance', 'travel', 'health', 'lifestyle'] as TopicId[]).map((v) => ({
    id: v,
    label: topicName(v),
    match: (p: Page) => !!p.profile.topics[0] && verticalOf(p.profile.topics[0].topic) === v,
  })),
]

function Publisher() {
  const { comparison, set } = useApp()
  const [group, setGroup] = useState('all')
  const [flagFor, setFlagFor] = useState<string | null>(null)
  const g = GROUPS.find((x) => x.id === group)!
  const rows = useMemo(() => publisherPages(comparison).filter((r) => g.match(r.page)), [comparison, g])

  const sub: Comparison = useMemo(() => {
    // Restrict the comparison to the selected page group.
    const keep = (i: number) => g.match(comparison.strictResults[i].request.page)
    const already = { ciq: 0, strict: 0, requests: 0 }
    const fresh = { ciq: 0, strict: 0, requests: 0 }
    comparison.strictResults.forEach((s, i) => {
      if (!keep(i)) return
      const b = s.contextual ? already : fresh
      b.ciq += comparison.ciqResults[i].price / 1000
      b.strict += s.price / 1000
      b.requests++
    })
    return {
      ...comparison,
      ciq: { ...comparison.ciq, revenue: already.ciq + fresh.ciq },
      strict: { ...comparison.strict, revenue: already.strict + fresh.strict },
      alreadySelling: already,
      newDemand: fresh,
    }
  }, [comparison, g])

  const gainers = [...rows].filter((r) => r.delta > 0.00001).sort((a, b) => b.delta - a.delta).slice(0, 5)
  const losers = [...rows].filter((r) => r.delta < -0.00001).sort((a, b) => a.delta - b.delta)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="grp" className="text-xs text-ink-3">
          Page group
        </label>
        <select id="grp" value={group} onChange={(e) => setGroup(e.target.value)} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink">
          {GROUPS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-ink-3">{rows.length} pages</span>
      </div>

      <Breakdown cmp={sub} perMillion />
      <PublisherNote className="mt-2" />

      <p className="mt-12 text-xs text-ink-3">Page revenue {PER_M_LABEL} across the network, Strict → ContextIQ.</p>
      <div className="mt-4 grid gap-10 lg:grid-cols-2">
        <PageList title="Pages that gained" tone="pos" rows={gainers} empty="No page gained in this group." onOpen={(id) => set({ view: 'pages', pageId: id })} onFlag={setFlagFor} flagFor={flagFor} />
        <PageList
          title="Pages that lost revenue"
          tone="neg"
          rows={losers}
          empty="No page lost revenue in this group."
          caption="A guardrail, not a forecast: Strict-eligible bids are protected, so this list should stay empty at every threshold."
          onOpen={(id) => set({ view: 'pages', pageId: id })}
          onFlag={setFlagFor}
          flagFor={flagFor}
        />
      </div>
      <section aria-label="Phase 2" className="mt-12 rounded-xl border border-line bg-surface p-5">
        <div className="label mb-1.5">Phase 2 · opt-in</div>
        <h3 className="text-base font-semibold text-ink">Spend-neutral repricing</h3>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-2">
          This pilot never reprices inventory Strict already sells: those bids stay at full price. Repricing existing inventory by match quality comes only after
          the pilot proves the signal, as an opt-in for advertisers and publishers, and designed to keep total spend neutral.
        </p>
      </section>
      <Footnote className="mt-8" />
    </div>
  )
}

function PageList({
  title,
  rows,
  tone,
  empty,
  caption,
  onOpen,
  onFlag,
  flagFor,
}: {
  title: string
  rows: ReturnType<typeof publisherPages>
  tone: 'pos' | 'neg'
  empty: string
  caption?: string
  onOpen: (id: string) => void
  onFlag: (id: string | null) => void
  flagFor: string | null
}) {
  const shown = rows.slice(0, 8)
  return (
    <section>
      <h3 className="text-lg font-semibold tracking-[-0.01em]">{title}</h3>
      {caption && <p className="mt-1 text-sm text-ink-3">{caption}</p>}
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-3">
          {shown.map((r) => (
            <li key={r.page.id} className="border-b border-line py-3">
              <div className="grid grid-cols-[1fr_auto] items-baseline gap-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] text-ink-4">{r.page.id}</span>
                    {r.page.synthetic ? (
                      <span className="truncate text-sm text-ink-2">{r.page.title}</span>
                    ) : (
                      <button onClick={() => onOpen(r.page.id)} className="truncate text-left text-sm text-ink hover:text-cta-ink hover:underline">
                        {r.page.title}
                      </button>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-ink-3">
                    {usd(r.strict * PER_M)} → {usd(r.ciq * PER_M)} · new demand {usd(r.ciqNew * PER_M)} · {pct(r.requests / 1000)} of requests
                  </div>
                </div>
                <span className={`font-mono text-sm ${tone === 'pos' ? 'text-pos' : 'text-neg'}`}>{signedUsd(r.delta * PER_M)}</span>
              </div>
              <button onClick={() => onFlag(flagFor === r.page.id ? null : r.page.id)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
                <Flag size={11} /> Flag a wrong label
              </button>
              {flagFor === r.page.id && <FlagForm page={r.page} onClose={() => onFlag(null)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FlagForm({ page, onClose }: { page: Page; onClose: () => void }) {
  const [sent, setSent] = useState(false)
  const top = page.profile.topics[0]
  if (sent)
    return (
      <div className="mt-3 rounded-lg bg-pos-soft px-3 py-2.5 text-sm text-pos" role="status">
        <Check size={14} className="mr-1 inline" /> Queued for human review and rescoring. (Mock form: a roadmap preview of publisher content insights.)
      </div>
    )
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSent(true)
      }}
      className="mt-3 space-y-3 rounded-lg border border-line bg-surface p-3.5"
    >
      <div className="text-xs text-ink-3">
        Current label: <span className="text-ink-2">{top ? `${topicName(top.topic)} ${Math.round(top.share * 100)}%` : 'none'}</span> · confidence{' '}
        <span className="font-mono">{page.profile.confidence?.toFixed(2) ?? '—'}</span>
      </div>
      <label className="block text-xs text-ink-3">
        What's wrong?
        <select className="mt-1 block w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm text-ink">
          <option>Wrong topic</option>
          <option>Wrong suitability flag</option>
          <option>Content changed since scoring</option>
          <option>Other</option>
        </select>
      </label>
      <label className="block text-xs text-ink-3">
        Note for the reviewer
        <textarea rows={2} className="mt-1 block w-full rounded-md border border-line bg-paper px-2 py-1.5 text-sm text-ink" placeholder="e.g. This is a tablet review, not a laptop one." />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-2 py-1 text-sm text-ink-3 hover:text-ink">
          Cancel
        </button>
        <button type="submit" className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">
          Request rescore
        </button>
      </div>
    </form>
  )
}
