// Metrics over the 1,000 simulated requests (spec §7). Same requests, both strategies.
import { decide, isViolation, type Decision, type EngineOptions } from './engine'
import type { Inventory, Request } from './inventory'
import type { Band, Campaign, Page, Preset, ReasonCode, Strategy } from './types'

export const CTR_RELEVANT = 0.018
export const CTR_IRRELEVANT = 0.003
/** Post-click conversion rates: conversions = impressions × CTR × post-click CVR. */
export const CVR_RELEVANT = 0.03
export const CVR_IRRELEVANT = 0.01

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
  /** Wins that came from a ContextIQ-only (incremental) match. 0 = every win was protected at full price. */
  incrementalWins: number
  strictImpressions: number
  strictSpend: number
  strictConversions: number
  relevant: number
  strictRelevant: number
}

function expected(relevant: boolean) {
  const ctr = relevant ? CTR_RELEVANT : CTR_IRRELEVANT
  const cvr = relevant ? CVR_RELEVANT : CVR_IRRELEVANT
  /** Expected conversions per impression. */
  return { ctr, cvr, conv: ctr * cvr }
}

export function campaignWins(results: RequestResult[], id: string) {
  let impressions = 0
  let cpm = 0
  let conversions = 0
  let relevant = 0
  for (const r of results) {
    if (r.winner?.id !== id) continue
    impressions++
    cpm += r.price
    conversions += expected(!!r.relevant).conv
    if (r.relevant) relevant++
  }
  return { impressions, spend: cpm / 1000, conversions, relevant }
}

export function advertiserReport(cmp: Comparison, campaign: Campaign): AdvertiserReport {
  const wins = cmp.ciqResults.filter((r) => r.winner?.id === campaign.id)
  const bands: BandStats[] = (['specific', 'broad', 'fallback'] as Band[]).map((band) => {
    const rs = wins.filter((r) => r.band === band)
    let cpm = 0, ctr = 0, conv = 0, savings = 0
    for (const r of rs) {
      const e = expected(!!r.relevant)
      cpm += r.price
      ctr += e.ctr
      conv += e.conv
      savings += campaign.baseBid - r.price
    }
    const n = rs.length
    return {
      band,
      impressions: n,
      share: wins.length ? n / wins.length : 0,
      avgCpm: n ? cpm / n : 0,
      ctr: n ? ctr / n : 0,
      /** Post-click conversion rate: conversions ÷ clicks. */
      cvr: ctr ? conv / ctr : 0,
      spend: cpm / 1000,
      savings: savings / 1000,
      conversions: conv,
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
    cvr: (() => {
      const clicks = bands.reduce((a, b) => a + b.ctr * b.impressions, 0)
      return clicks ? conversions / clicks : 0
    })(),
    incrementalWins: wins.filter((r) => r.decision.winner?.provenance === 'incremental').length,
    bands,
    exclusions: [...counts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    strictImpressions: strict.impressions,
    strictSpend: strict.spend,
    strictConversions: strict.conversions,
    relevant: wins.filter((r) => r.relevant).length,
    strictRelevant: strict.relevant,
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
  /** The current threshold is already the best in range. */
  same: boolean
  /** Search range for the campaign's preset. */
  range: [number, number]
  reason: string
}

/** Where each preset's threshold is allowed to move. */
export const PRESET_RANGE: Record<Preset, [number, number]> = {
  strict: [0.75, 0.9],
  balanced: [0.5, 0.75],
  broad: [0.35, 0.6],
}

/**
 * Within the preset's range, the threshold with the most conversions per $ that keeps at least half of today's
 * impressions and doesn't lower relevance precision. Ties go to the current threshold, then lower.
 */
export function suggestThreshold(
  inv: Inventory,
  campaigns: Campaign[],
  id: string,
  opts: EngineOptions,
): Suggestion | null {
  const campaign = campaigns.find((c) => c.id === id)
  if (!campaign || campaign.kind !== 'contextual' || !campaign.preset) return null
  const now = campaignWins(simulate(inv, campaigns, 'contextiq', opts), id)
  if (now.impressions === 0 || now.spend === 0) return null
  const nowCpd = now.conversions / now.spend
  const nowPrec = now.relevant / now.impressions
  const range = PRESET_RANGE[campaign.preset]
  const steps = Math.round((range[1] - range[0]) / 0.05)
  let best = { t: campaign.threshold, cpd: nowCpd, imps: now.impressions }
  for (let i = 0; i <= steps; i++) {
    const t = Math.round((range[0] + i * 0.05) * 100) / 100
    if (Math.abs(t - campaign.threshold) < 1e-9) continue
    const w = campaignWins(simulate(inv, withThreshold(campaigns, id, t), 'contextiq', opts), id)
    if (w.impressions < 0.5 * now.impressions || w.spend === 0) continue
    if (w.relevant / w.impressions < nowPrec - 1e-9) continue
    const cpd = w.conversions / w.spend
    if (cpd > best.cpd * (1 + 1e-9)) best = { t, cpd, imps: w.impressions }
  }
  const same = Math.abs(best.t - campaign.threshold) < 1e-9
  const convChange = best.cpd / nowCpd - 1
  const impChange = best.imps / now.impressions - 1
  const pct = (x: number) => `${Math.abs(x * 100).toFixed(1)}%`
  const reason = same
    ? `Your current threshold, ${campaign.threshold.toFixed(2)}, is already the best in this preset's range (${range[0].toFixed(2)}⁠–⁠${range[1].toFixed(2)}).`
    : `${best.t.toFixed(2)}: ${pct(convChange)} more conversions per $, ${pct(impChange)} ${impChange <= 0 ? 'fewer' : 'more'} impressions, relevance no lower.`
  return {
    threshold: best.t,
    current: campaign.threshold,
    convPerDollar: best.cpd,
    currentConvPerDollar: nowCpd,
    impressions: best.imps,
    currentImpressions: now.impressions,
    same,
    range,
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

// ---------- Two-sided economics ----------

/** What contextual advertisers pay and get, over the simulated requests. */
export interface AdvertiserEconomics {
  impressions: number
  spend: number
  conversions: number
  relevant: number
  /** $ per expected conversion. */
  cpa: number
  /** $ per 1,000 truly relevant impressions. */
  costPerKRelevant: number
}

export function advertiserEconomics(results: RequestResult[], id?: string): AdvertiserEconomics {
  let impressions = 0
  let cpm = 0
  let conversions = 0
  let relevant = 0
  for (const r of results) {
    if (!r.contextual || !r.winner || (id && r.winner.id !== id)) continue
    impressions++
    cpm += r.price
    conversions += expected(!!r.relevant).conv
    if (r.relevant) relevant++
  }
  const spend = cpm / 1000
  return {
    impressions,
    spend,
    conversions,
    relevant,
    cpa: conversions ? spend / conversions : 0,
    costPerKRelevant: relevant ? (spend / relevant) * 1000 : 0,
  }
}

/** Where ContextIQ's winning bids came from. */
export interface ProvenanceStats {
  /** Wins by a Strict-eligible campaign at its full base bid. */
  protectedWins: number
  /** Wins by a ContextIQ-only match. */
  incrementalWins: number
  /** Revenue ($ over the simulation) from incremental wins. */
  incrementalRevenue: number
  /** Requests where ContextIQ earned exactly what Strict did. */
  sameAsToday: number
  /** Requests where ContextIQ earned more than Strict. */
  gained: number
  /** Requests where ContextIQ earned less than Strict. Must be 0 by design. */
  lost: number
}

export function provenanceStats(cmp: Comparison): ProvenanceStats {
  const out: ProvenanceStats = { protectedWins: 0, incrementalWins: 0, incrementalRevenue: 0, sameAsToday: 0, gained: 0, lost: 0 }
  cmp.ciqResults.forEach((c, i) => {
    const s = cmp.strictResults[i]
    const w = c.decision.winner
    if (w?.provenance === 'protected') out.protectedWins++
    if (w?.provenance === 'incremental') {
      out.incrementalWins++
      out.incrementalRevenue += c.price / 1000
    }
    const d = c.price - s.price
    if (d > 1e-9) out.gained++
    else if (d < -1e-9) out.lost++
    else out.sameAsToday++
  })
  return out
}

/** Both sides of the market at one configuration. */
export interface Market {
  cmp: Comparison
  adv: { ciq: AdvertiserEconomics; strict: AdvertiserEconomics }
  /** 1 − CPA_ciq ÷ CPA_strict. Positive = advertisers pay less per conversion. */
  savings: number
  provenance: ProvenanceStats
}

export function market(inv: Inventory, campaigns: Campaign[], opts: EngineOptions): Market {
  const cmp = compare(inv, campaigns, opts)
  const strict = advertiserEconomics(cmp.strictResults)
  const ciq = advertiserEconomics(cmp.ciqResults)
  return {
    cmp,
    adv: { ciq, strict },
    savings: strict.cpa ? 1 - ciq.cpa / strict.cpa : 0,
    provenance: provenanceStats(cmp),
  }
}

/** Shift every contextual campaign's own threshold by δ (clamped), leaving the saved configs untouched. */
export function shifted(campaigns: Campaign[], delta: number): Campaign[] {
  if (Math.abs(delta) < 1e-9) return campaigns
  return campaigns.map((c) =>
    c.kind === 'contextual' ? { ...c, threshold: Math.round(Math.min(0.95, Math.max(0.05, c.threshold + delta)) * 1000) / 1000 } : c,
  )
}

export const SHIFTS = Array.from({ length: 11 }, (_, i) => Math.round((-0.2 + i * 0.05) * 100) / 100)

export interface MarketPoint extends SweepPoint {
  x: number
  cpa: number
}

/** Sweep one knob (a threshold, or a shift of all thresholds). */
export function marketSweep(inv: Inventory, xs: number[], campaignsAt: (x: number) => Campaign[], opts: EngineOptions): MarketPoint[] {
  return xs.map((x) => {
    const res = simulate(inv, campaignsAt(x), 'contextiq', opts)
    const s = summarize(res)
    return { x, threshold: x, fillRate: s.fillRate, revenue: s.revenue, precision: s.precision, violations: s.violations, cpa: advertiserEconomics(res).cpa }
  })
}
