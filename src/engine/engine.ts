// ContextIQ decision engine (spec §4). Pure functions; every number in the UI comes from here.
import { closeness, relationship, type Relationship, type TopicId, isWithin } from './taxonomy'
import {
  FLAG_REASON,
  type Band,
  type Campaign,
  type Page,
  type PageProfile,
  type PageTopic,
  type Preset,
  type ReasonCode,
  type Strategy,
} from './types'

export const STRICT_MIN_CONFIDENCE = 0.7
const EPS = 1e-9

export interface EngineOptions {
  /** Exclude unvalidated-language pages for contextual campaigns (SUIT-LANG). Applies to both strategies. */
  strictSuitability: boolean
}

export const DEFAULT_OPTIONS: EngineOptions = { strictSuitability: false }

export interface FitResult {
  fit: number
  closeness: number
  topic: PageTopic | null
  relationship: Relationship
}

/** Fit = max over page topics of Closeness(T, C) × (0.5 + 0.5 × share_T). */
export function fitFor(profile: PageProfile, target: TopicId): FitResult {
  let best: FitResult = { fit: 0, closeness: 0, topic: null, relationship: 'none' }
  for (const t of profile.topics) {
    const c = closeness(t.topic, target)
    const f = c * (0.5 + 0.5 * t.share)
    if (f > best.fit + EPS || best.topic === null) {
      best = { fit: f, closeness: c, topic: t, relationship: relationship(t.topic, target) }
    }
  }
  return best
}

export function matchProbability(profile: PageProfile, target: TopicId): number {
  if (profile.confidence === null) return 0
  return profile.confidence * fitFor(profile, target).fit
}

export function bandOf(p: number): Band {
  if (p >= 0.8 - EPS) return 'specific'
  if (p >= 0.5 - EPS) return 'broad'
  return 'fallback'
}

/** Share of base bid paid at a given P(match), by preset curve. */
export function curveMultiplier(preset: Preset, p: number): number {
  return preset === 'broad' ? 0.5 + 0.5 * p : p
}

export function scaledBid(campaign: Campaign, p: number): number {
  if (campaign.kind === 'ron' || !campaign.preset) return campaign.baseBid
  return campaign.baseBid * curveMultiplier(campaign.preset, p)
}

/** Today's rule: primary topic inside the campaign's target branch and confidence ≥ 0.70. */
export function strictChecks(profile: PageProfile, campaign: Campaign) {
  const primary = profile.topics[0]
  const strictTopicPass = !!primary && campaign.target !== null && isWithin(primary.topic, campaign.target)
  const strictConfidencePass = profile.confidence !== null && profile.confidence >= STRICT_MIN_CONFIDENCE - EPS
  return { strictTopicPass, strictConfidencePass, eligible: strictTopicPass && strictConfidencePass }
}

export function suitabilityCheck(
  page: Pick<Page, 'flags' | 'language'>,
  campaign: Campaign,
  opts: EngineOptions,
): { pass: boolean; reasons: ReasonCode[] } {
  const reasons: ReasonCode[] = page.flags
    .filter((f) => campaign.excludes.includes(f))
    .map((f) => FLAG_REASON[f])
  if (opts.strictSuitability && campaign.kind === 'contextual' && page.language !== 'en') {
    reasons.push('SUIT-LANG')
  }
  return { pass: reasons.length === 0, reasons }
}

export type Outcome = 'won' | 'lost' | 'excluded' | 'no-bid'

/**
 * Where a bid came from under ContextIQ.
 * protected: Strict-eligible, bids its full base bid exactly as today (threshold and curve never apply).
 * incremental: not Strict-eligible, admitted by the ContextIQ threshold and priced by the preset curve.
 */
export type Provenance = 'protected' | 'incremental'

export interface CampaignEval {
  campaign: Campaign
  fit: FitResult
  pMatch: number
  band: Band
  suitability: { pass: boolean; reasons: ReasonCode[] }
  /** null when the step doesn't apply (run-of-network) or wasn't reached. */
  thresholdPass: boolean | null
  /** Strict matching: topic and confidence checks. */
  strictTopicPass?: boolean
  strictConfidencePass?: boolean
  /** The campaign's base bid (what it would pay at full price). */
  originalBid: number
  bid: number | null
  /** Set for contextual bids under ContextIQ; null otherwise. */
  provenance: Provenance | null
  floorPass: boolean | null
  outcome: Outcome
  reason: ReasonCode | null
}

export interface Decision {
  strategy: Strategy
  page: Page
  profile: PageProfile
  evals: CampaignEval[]
  winner: CampaignEval | null
  price: number
}

/**
 * Run one impression on a page.
 * @param ronBids whether the run-of-network bidder participates in this request (seeded 50%).
 */
export function decide(
  page: Page,
  profile: PageProfile,
  campaigns: Campaign[],
  strategy: Strategy,
  opts: EngineOptions = DEFAULT_OPTIONS,
  ronBids = true,
): Decision {
  const evals: CampaignEval[] = campaigns.map((c) => {
    const fit: FitResult =
      c.target === null
        ? { fit: 0, closeness: 0, topic: null, relationship: 'none' }
        : fitFor(profile, c.target)
    const pMatch = profile.confidence === null ? 0 : profile.confidence * fit.fit
    const suitability = suitabilityCheck(page, c, opts)
    const base: CampaignEval = {
      campaign: c,
      fit,
      pMatch,
      band: bandOf(pMatch),
      suitability,
      thresholdPass: null,
      originalBid: c.baseBid,
      bid: null,
      provenance: null,
      floorPass: null,
      outcome: 'excluded',
      reason: null,
    }

    // 1. Suitability gate: absolute, never priced.
    if (!suitability.pass) return { ...base, reason: suitability.reasons[0] }

    if (c.kind === 'ron') {
      if (!ronBids) return { ...base, outcome: 'no-bid', reason: 'NO-BID' }
      return { ...base, bid: c.baseBid }
    }

    // Strict matching checks run under both strategies: under ContextIQ they decide protection.
    const { strictTopicPass, strictConfidencePass, eligible } = strictChecks(profile, c)
    const checked = { ...base, strictTopicPass, strictConfidencePass }

    if (strategy === 'contextiq') {
      // 2. Protected: a Strict-eligible campaign bids its full base bid, exactly as today. One bid per campaign.
      if (eligible) return { ...checked, bid: c.baseBid, provenance: 'protected' as const }
      // 3. Incremental: threshold, then price by preset curve.
      const thresholdPass = pMatch >= c.threshold - EPS
      if (!thresholdPass) return { ...checked, thresholdPass, reason: 'BELOW-THRESHOLD' as const }
      return { ...checked, thresholdPass, bid: scaledBid(c, pMatch), provenance: 'incremental' as const }
    }

    // Strict matching (today): primary topic inside target branch, confidence ≥ 0.70, full base bid.
    if (!strictTopicPass) return { ...checked, reason: 'OFF-TOPIC' as const }
    if (!strictConfidencePass) return { ...checked, reason: 'LOW-CONFIDENCE' as const }
    return { ...checked, bid: c.baseBid }
  })

  // 4. First-price auction: drop bids below floor; highest wins; ties to higher P(match).
  let winner: CampaignEval | null = null
  for (const e of evals) {
    if (e.bid === null) continue
    e.floorPass = e.bid >= page.floor - EPS
    if (!e.floorPass) {
      e.outcome = 'lost'
      e.reason = 'BELOW-FLOOR'
      continue
    }
    if (
      !winner ||
      e.bid > winner.bid! + EPS ||
      (Math.abs(e.bid - winner.bid!) <= EPS && e.pMatch > winner.pMatch)
    ) {
      winner = e
    }
  }
  for (const e of evals) {
    if (e.bid !== null && e.floorPass) e.outcome = e === winner ? 'won' : 'lost'
  }

  return { strategy, page, profile, evals, winner, price: winner ? winner.bid! : 0 }
}

/** Convenience: is a win a suitability violation? (Must never happen.) */
export function isViolation(page: Pick<Page, 'flags'>, winner: Campaign | null): boolean {
  if (!winner) return false
  return page.flags.some((f) => winner.excludes.includes(f))
}
