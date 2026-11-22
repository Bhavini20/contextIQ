import type { TopicId } from './taxonomy'

export type RiskFlag = 'fraud' | 'crime' | 'tragedy' | 'low-quality'
export const RISK_FLAGS: RiskFlag[] = ['fraud', 'crime', 'tragedy', 'low-quality']

export type Preset = 'strict' | 'balanced' | 'broad'
export type Band = 'specific' | 'broad' | 'fallback'
export type Strategy = 'contextiq' | 'strict'
export type Language = 'en' | 'hi-en'

export type ProfileSource = 'scored' | 'section-fallback' | 'site-fallback' | 'demo-classifier'

export interface PageTopic {
  topic: TopicId
  share: number
}

export interface PageProfile {
  topics: PageTopic[]
  /** null = no confidence claim (site-level fallback, existing rules apply). */
  confidence: number | null
  source: ProfileSource
  modelVersion: string
  /** Human-readable freshness, e.g. "2 h ago". */
  scoredAgo: string
  /** One-line reason shown next to confidence. */
  confidenceNote: string
}

export interface Keyword {
  term: string
  topic: TopicId
}

export interface Page {
  id: string
  title: string
  description: string
  tag: string
  publication: string
  byline: string
  published: string
  body: string[]
  keywords: Keyword[]
  flags: RiskFlag[]
  language: Language
  floor: number
  profile: PageProfile
  /** Profile after background scoring completes (P4 only). */
  rescored?: PageProfile
  /** Keyword-stuffed page: true confidence is 0.25 lower than model confidence. */
  stuffed?: boolean
  synthetic?: boolean
}

export interface Campaign {
  id: string
  name: string
  kind: 'contextual' | 'ron'
  /** null for run-of-network. */
  target: TopicId | null
  preset: Preset | null
  threshold: number
  baseBid: number
  excludes: RiskFlag[]
  /** Run-of-network only: share of requests it bids on. */
  participation?: number
  blurb: string
}

export type ReasonCode =
  | 'SUIT-FRAUD'
  | 'SUIT-CRIME'
  | 'SUIT-TRAGEDY'
  | 'SUIT-LOWQ'
  | 'SUIT-LANG'
  | 'BELOW-THRESHOLD'
  | 'BELOW-FLOOR'
  | 'OFF-TOPIC'
  | 'LOW-CONFIDENCE'
  | 'NO-BID'

export const REASON_TEXT: Record<ReasonCode, string> = {
  'SUIT-FRAUD': 'Page is about fraud, which this advertiser excludes.',
  'SUIT-CRIME': 'Page covers crime, which this advertiser excludes.',
  'SUIT-TRAGEDY': 'Page covers a tragedy, which this advertiser excludes.',
  'SUIT-LOWQ': 'Page looks low quality or keyword-stuffed, which this advertiser excludes.',
  'SUIT-LANG': 'Strict suitability is on and the page language is not yet validated.',
  'BELOW-THRESHOLD': "Match probability is below the advertiser's minimum.",
  'BELOW-FLOOR': "Bid is below the publisher's price floor, so it is dropped.",
  'OFF-TOPIC': "Strict matching: the page's primary topic is outside the campaign target.",
  'LOW-CONFIDENCE': 'Strict matching: classifier confidence is below 0.70.',
  'NO-BID': 'Run-of-network sat out this request (it bids on about half of them).',
}

export const FLAG_REASON: Record<RiskFlag, ReasonCode> = {
  fraud: 'SUIT-FRAUD',
  crime: 'SUIT-CRIME',
  tragedy: 'SUIT-TRAGEDY',
  'low-quality': 'SUIT-LOWQ',
}
