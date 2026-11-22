// Metrics over the 1,000 simulated requests (spec §7). Same requests, both strategies.
import { decide, isViolation, type Decision, type EngineOptions } from './engine'
import type { Inventory, Request } from './inventory'
import type { Band, Campaign, Page, ReasonCode, Strategy } from './types'

export const CTR_RELEVANT = 0.018
export const CTR_IRRELEVANT = 0.003
export const CVR_RELEVANT = 0.012
export const CVR_IRRELEVANT = 0.001

export interface RequestResult {
  request: Request
  decision: Decision
  winner: Campaign | null
  price: number
  pMatch: number
  band: Band | null
  contextual: boolean
  relevant: boolean | null
}

/** Run every request through one strategy. Decisions are memoised per page × RON participation. */
export function simulate(
  inv: Inventory,
  campaigns: Campaign[],
  strategy: Strategy,
  opts: EngineOptions,
): RequestResult[] {
  const memo = new Map<string, Decision>()
  return inv.requests.map((r) => {
    const key = `${r.page.id}|${r.ronBids ? 1 : 0}`
    let d = memo.get(key)
    if (!d) {
      d = decide(r.page, r.page.profile, campaigns, strategy, opts, r.ronBids)
      memo.set(key, d)
    }
    const w = d.winner
    const contextual = !!w && w.campaign.kind === 'contextual'
    return {
      request: r,
      decision: d,
      winner: w ? w.campaign : null,
      price: d.price,
      pMatch: w ? w.pMatch : 0,
      band: contextual ? w!.band : null,
      contextual,
      relevant: contextual ? r.truth[w!.campaign.id] : null,
    }
  })
}

export interface Summary {
  requests: number
  filled: number
  fillRate: number
  /** Sum of winning CPMs ÷ 1,000. With 1,000 requests this is revenue per 1,000 requests ($). */
  revenue: number
  ecpm: number
  contextualWins: number
  relevantWins: number
  precision: number
  violations: number
}

export function summarize(results: RequestResult[]): Summary {
  let filled = 0
  let cpmSum = 0
  let contextualWins = 0
  let relevantWins = 0
  let violations = 0
  for (const r of results) {
    if (!r.winner) continue
    filled++
    cpmSum += r.price
    if (r.contextual) {
      contextualWins++
      if (r.relevant) relevantWins++
    }
    if (isViolation(r.request.page, r.winner)) violations++
  }
  const n = results.length
  const revenue = (cpmSum / 1000) * (1000 / n)
  return {
    requests: n,
    filled,
    fillRate: filled / n,
    revenue,
    ecpm: filled ? (cpmSum / 1000 / filled) * 1000 : 0,
    contextualWins,
    relevantWins,
    precision: contextualWins ? relevantWins / contextualWins : 0,
    violations,
  }
}

export interface Comparison {
  ciq: Summary
  strict: Summary
  /** Revenue on requests Strict filled with a contextual campaign (guardrail). */
  alreadySelling: { ciq: number; strict: number; requests: number }
  /** ContextIQ revenue on requests Strict left unfilled or to run-of-network. */
  newDemand: { ciq: number; strict: number; requests: number }
  ciqResults: RequestResult[]
  strictResults: RequestResult[]
}

export function compare(inv: Inventory, campaigns: Campaign[], opts: EngineOptions): Comparison {
  const ciqResults = simulate(inv, campaigns, 'contextiq', opts)
  const strictResults = simulate(inv, campaigns, 'strict', opts)
  return compareResults(ciqResults, strictResults)
}

export function compareResults(ciqResults: RequestResult[], strictResults: RequestResult[]): Comparison {
  const already = { ciq: 0, strict: 0, requests: 0 }
  const fresh = { ciq: 0, strict: 0, requests: 0 }
  strictResults.forEach((s, i) => {
    const c = ciqResults[i]
    const bucket = s.contextual ? already : fresh
    bucket.ciq += c.price / 1000
    bucket.strict += s.price / 1000
    bucket.requests++
  })
  return {
    ciq: summarize(ciqResults),
    strict: summarize(strictResults),
    alreadySelling: already,
    newDemand: fresh,
    ciqResults,
    strictResults,
  }
}

export function withThreshold(campaigns: Campaign[], id: string | 'all', t: number): Campaign[] {
  return campaigns.map((c) =>
    c.kind === 'contextual' && (id === 'all' || c.id === id) ? { ...c, threshold: t } : c,
  )
}

export const SWEEP = Array.from({ length: 14 }, (_, i) => Math.round((0.3 + i * 0.05) * 100) / 100)

export interface SweepPoint {
  threshold: number
  fillRate: number
  revenue: number
  precision: number
  violations: number
}

/** Re-run ContextIQ at each threshold 0.30 → 0.95 for the selected campaign (or all). */
export function sweep(
  inv: Inventory,
  campaigns: Campaign[],
  id: string | 'all',
  opts: EngineOptions,
): SweepPoint[] {
  return SWEEP.map((t) => {
    const s = summarize(simulate(inv, withThreshold(campaigns, id, t), 'contextiq', opts))
    return { threshold: t, fillRate: s.fillRate, revenue: s.revenue, precision: s.precision, violations: s.violations }
  })
}

// ---------- Calibration (§7) ----------

export interface CalibrationBin {
  mid: number
  /** Scored pages only. */
  scored: { n: number; relevant: number; rate: number }
  /** Section-fallback and keyword-stuffed pages. */
  risky: { n: number; relevant: number; rate: number }
  all: { n: number; relevant: number; rate: number }
}

export function calibration(results: RequestResult[]): CalibrationBin[] {
  const bins: CalibrationBin[] = Array.from({ length: 10 }, (_, i) => ({
    mid: i / 10 + 0.05,
    scored: { n: 0, relevant: 0, rate: 0 },
    risky: { n: 0, relevant: 0, rate: 0 },
    all: { n: 0, relevant: 0, rate: 0 },
  }))
  for (const r of results) {
    if (!r.contextual) continue
    const b = bins[Math.min(9, Math.floor(r.pMatch * 10))]
    const risky = r.request.page.profile.source !== 'scored' || !!r.request.page.stuffed
    for (const g of [risky ? b.risky : b.scored, b.all]) {
      g.n++
      if (r.relevant) g.relevant++
    }
  }
  for (const b of bins) for (const g of [b.scored, b.risky, b.all]) g.rate = g.n ? g.relevant / g.n : 0
  return bins
}

// ---------- Advertiser report ----------

export interface BandStats {
  band: Band
  impressions: number
  share: number
  avgCpm: number
  ctr: number
  cvr: number
  spend: number
  savings: number
  conversions: number
}

export interface AdvertiserReport {
  campaign: Campaign
  impressions: number
  spend: number
  conversions: number
  savings: number
  ctr: number
  cvr: number
  bands: BandStats[]
  exclusions: { reason: ReasonCode; count: number }[]
  strictImpressions: number
  strictSpend: number
  strictConversions: number
}

function expected(relevant: boolean) {
  return {
    ctr: relevant ? CTR_RELEVANT : CTR_IRRELEVANT,
    cvr: relevant ? CVR_RELEVANT : CVR_IRRELEVANT,
  }
}

export function campaignWins(results: RequestResult[], id: string) {
  let impressions = 0
  let cpm = 0
  let conversions = 0
  for (const r of results) {
    if (r.winner?.id !== id) continue
    impressions++
    cpm += r.price
    conversions += expected(!!r.relevant).cvr
  }
  return { impressions, spend: cpm / 1000, conversions }
}

export function advertiserReport(cmp: Comparison, campaign: Campaign): AdvertiserReport {
  const wins = cmp.ciqResults.filter((r) => r.winner?.id === campaign.id)
  const bands: BandStats[] = (['specific', 'broad', 'fallback'] as Band[]).map((band) => {
    const rs = wins.filter((r) => r.band === band)
    let cpm = 0, ctr = 0, cvr = 0, savings = 0
    for (const r of rs) {
      const e = expected(!!r.relevant)
      cpm += r.price
      ctr += e.ctr
      cvr += e.cvr
      savings += campaign.baseBid - r.price
    }
    const n = rs.length
    return {
      band,
      impressions: n,
      share: wins.length ? n / wins.length : 0,
      avgCpm: n ? cpm / n : 0,
      ctr: n ? ctr / n : 0,
      cvr: n ? cvr / n : 0,
      spend: cpm / 1000,
      savings: savings / 1000,
      conversions: cvr,
    }
  })

  // Exclusions on requests where the page had some relevance to this campaign.
  const counts = new Map<ReasonCode, number>()
  for (const r of cmp.ciqResults) {
    const e = r.decision.evals.find((x) => x.campaign.id === campaign.id)
    if (!e || e.outcome !== 'excluded' || !e.reason) continue
    if (e.fit.fit <= 0 && !e.reason.startsWith('SUIT')) continue
    counts.set(e.reason, (counts.get(e.reason) ?? 0) + 1)
  }

  const impressions = wins.length
  const spend = bands.reduce((a, b) => a + b.spend, 0)
  const conversions = bands.reduce((a, b) => a + b.conversions, 0)
  const strict = campaignWins(cmp.strictResults, campaign.id)
  return {
    campaign,
    impressions,
    spend,
    conversions,
    savings: bands.reduce((a, b) => a + b.savings, 0),
    ctr: impressions ? bands.reduce((a, b) => a + b.ctr * b.impressions, 0) / impressions : 0,
    cvr: impressions ? conversions / impressions : 0,
    bands,
    exclusions: [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    strictImpressions: strict.impressions,
    strictSpend: strict.spend,
    strictConversions: strict.conversions,
  }
}

// ---------- Suggested threshold (§7) ----------

export interface Suggestion {
  threshold: number
  current: number
  convPerDollar: number
  currentConvPerDollar: number
  impressions: number
  currentImpressions: number
  reason: string
}

export function suggestThreshold(
  inv: Inventory,
  campaigns: Campaign[],
  id: string,
  opts: EngineOptions,
): Suggestion | null {
  const campaign = campaigns.find((c) => c.id === id)
  if (!campaign || campaign.kind !== 'contextual') return null
  const now = campaignWins(simulate(inv, campaigns, 'contextiq', opts), id)
  if (now.impressions === 0) return null
  const nowCpd = now.spend ? now.conversions / now.spend : 0
  let best: { t: number; cpd: number; imps: number } | null = null
  for (let i = 0; i <= 10; i++) {
    const t = Math.round((0.4 + i * 0.05) * 100) / 100
    const w = campaignWins(simulate(inv, withThreshold(campaigns, id, t), 'contextiq', opts), id)
    if (w.impressions < 0.5 * now.impressions || w.spend === 0) continue
    const cpd = w.conversions / w.spend
    if (!best || cpd > best.cpd + 1e-12) best = { t, cpd, imps: w.impressions }
  }
  if (!best) return null
  const convChange = nowCpd ? best.cpd / nowCpd - 1 : 0
  const impChange = best.imps / now.impressions - 1
  const same = Math.abs(best.t - campaign.threshold) < 1e-9
  const pct = (x: number) => `${Math.abs(x * 100).toFixed(1)}%`
  const reason = same
    ? `${best.t.toFixed(2)}: your current threshold already gets the most conversions per $ while keeping at least half your impressions.`
    : `${best.t.toFixed(2)}: ${pct(convChange)} ${convChange >= 0 ? 'more' : 'fewer'} conversions per $, ${pct(impChange)} ${impChange <= 0 ? 'fewer' : 'more'} impressions.`
  return {
    threshold: best.t,
    current: campaign.threshold,
    convPerDollar: best.cpd,
    currentConvPerDollar: nowCpd,
    impressions: best.imps,
    currentImpressions: now.impressions,
    reason,
  }
}

// ---------- Publisher report ----------

export interface PageRevenue {
  page: Page
  requests: number
  ciq: number
  strict: number
  ciqNew: number
  ciqAlready: number
  strictAlready: number
  delta: number
}

export function publisherPages(cmp: Comparison): PageRevenue[] {
  const map = new Map<string, PageRevenue>()
  cmp.strictResults.forEach((s, i) => {
    const c = cmp.ciqResults[i]
    const page = s.request.page
    let row = map.get(page.id)
    if (!row) {
      row = { page, requests: 0, ciq: 0, strict: 0, ciqNew: 0, ciqAlready: 0, strictAlready: 0, delta: 0 }
      map.set(page.id, row)
    }
    row.requests++
    row.ciq += c.price / 1000
    row.strict += s.price / 1000
    if (s.contextual) {
      row.ciqAlready += c.price / 1000
      row.strictAlready += s.price / 1000
    } else {
      row.ciqNew += c.price / 1000
    }
  })
  return [...map.values()].map((r) => ({ ...r, delta: r.ciq - r.strict }))
}

// ---------- Break-even trust uplift ----------

/**
 * Smallest advertiser trust uplift (0–50%) at which ContextIQ revenue matches Strict.
 * Returns 0 if ContextIQ already leads, null if it never catches up in range.
 */
export function breakEvenUplift(inv: Inventory, campaigns: Campaign[], opts: EngineOptions): number | null {
  const strictRev = summarize(simulate(inv, campaigns, 'strict', opts)).revenue
  const rev = (u: number) => summarize(simulate(inv, campaigns, 'contextiq', { ...opts, trustUplift: u })).revenue
  if (rev(0) >= strictRev) return 0
  if (rev(0.5) < strictRev) return null
  let lo = 0, hi = 0.5
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (rev(mid) >= strictRev) hi = mid
    else lo = mid
  }
  return hi
}
