// Demo classifier (spec §6): a transparent keyword-based stand-in for production ML models.
import type { TopicId } from './taxonomy'
import type { Keyword, Language, Page, PageProfile, RiskFlag } from './types'

export const TOPIC_KEYWORDS: Partial<Record<TopicId, string[]>> = {
  smartphones: ['smartphone', 'smartphones', 'phone', 'phones', 'android', 'iphone', 'camera', 'battery', '5G', 'display', 'processor', 'chipset', 'flagship', 'selfie', 'charging', 'mAh', 'megapixel', 'screen'],
  tablets: ['tablet', 'tablets', 'ipad', 'stylus', 'touchscreen', 'e-reader', 'drawing tablet', 'keyboard case', 'split-screen', 'handwriting', 'note-taking', 'pen input', 'sketch', 'annotate', 'annotating'],
  laptops: ['laptop', 'laptops', 'notebook', 'keyboard', 'trackpad', 'ultrabook', 'chromebook', 'RAM', 'SSD', 'operating system', 'coding', 'spreadsheet', 'spreadsheets', 'webcam', 'hinge', 'ports', 'thunderbolt'],
  'digital-wallets': ['wallet', 'digital wallet', 'payment app', 'UPI', 'contactless', 'tap to pay', 'payments', 'transfer', 'transfers', 'QR code', 'merchant', 'cashback', 'PIN', 'peer-to-peer', 'mobile payment', 'checkout'],
  'personal-finance': ['savings', 'budget', 'budgeting', 'loan', 'mortgage', 'credit score', 'credit card', 'retirement', 'pension', 'interest rate', 'debt', 'invest', 'investing', 'emergency fund', 'tax', 'income', 'salary'],
  flights: ['flight', 'flights', 'airline', 'airlines', 'airport', 'fare', 'fares', 'runway', 'aircraft', 'boarding', 'layover', 'baggage', 'check-in', 'pilot', 'cabin', 'departure', 'round trip', 'booking'],
  hotels: ['hotel', 'hotels', 'resort', 'room', 'suite', 'hostel', 'stay', 'guesthouse', 'room service', 'front desk', 'amenities', 'pool', 'breakfast included', 'villa', 'bed and breakfast', 'concierge', 'minibar'],
  running: ['running', 'runner', 'runners', 'marathon', 'half marathon', '5k', '10k', 'pace', 'long run', 'running shoes', 'jog', 'jogging', 'stride', 'training plan', 'tempo run', 'intervals', 'race day', 'sprint'],
  'urban-living': ['city', 'cities', 'apartment', 'neighbourhood', 'neighborhood', 'commute', 'downtown', 'rent', 'flat', 'subway', 'metro', 'landlord', 'roommate', 'urban', 'café', 'public transport', 'noise', 'bus'],
}

export const RISK_KEYWORDS: Record<Exclude<RiskFlag, 'low-quality'>, string[]> = {
  fraud: ['fraud', 'scam', 'phishing', 'stolen'],
  crime: ['arrested', 'murder', 'assault'],
  tragedy: ['crash', 'killed', 'dead', 'disaster'],
}

export const HINGLISH_MARKERS = ['hai', 'kya', 'kaunsa', 'lena', 'ke liye', 'chahiye']

export const MIN_WORDS = 80
export const STUFFING_LIMIT = 0.04

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Case-insensitive, word-boundary match (Unicode-aware so "café" works). */
export function termRegex(term: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escape(term)}(?![\\p{L}\\p{N}])`, 'giu')
}

export function countTerm(text: string, term: string): number {
  return (text.match(termRegex(term)) ?? []).length
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export interface TermHit {
  term: string
  topic: TopicId
  count: number
}

export type ClassifyResult =
  | {
      status: 'too-short'
      words: number
      profile: PageProfile
    }
  | {
      status: 'scored'
      words: number
      profile: PageProfile
      flags: RiskFlag[]
      language: Language
      hits: TermHit[]
      topicHits: { topic: TopicId; hits: number; share: number }[]
      stuffedTerm: { term: string; density: number } | null
      hinglishMarkers: number
      rawConfidence: number
    }

export const SITE_FALLBACK: PageProfile = {
  topics: [],
  confidence: null,
  source: 'site-fallback',
  modelVersion: 'site profile',
  scoredAgo: 'n/a',
  confidenceNote: 'No confidence claim. Existing run-of-site rules apply.',
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

export function classify(text: string): ClassifyResult {
  const words = wordCount(text)
  if (words < MIN_WORDS) {
    return {
      status: 'too-short',
      words,
      profile: { ...SITE_FALLBACK, confidenceNote: 'Too short to score. Using site-level fallback.' },
    }
  }

  // 1–2. Keyword hits and topic shares.
  const hits: TermHit[] = []
  const perTopic = new Map<TopicId, number>()
  for (const [topic, terms] of Object.entries(TOPIC_KEYWORDS) as [TopicId, string[]][]) {
    for (const term of terms) {
      const count = countTerm(text, term)
      if (count > 0) {
        hits.push({ term, topic, count })
        perTopic.set(topic, (perTopic.get(topic) ?? 0) + count)
      }
    }
  }
  const total = [...perTopic.values()].reduce((a, b) => a + b, 0)
  const topicHits = [...perTopic.entries()]
    .map(([topic, h]) => ({ topic, hits: h, share: total ? h / total : 0 }))
    .sort((a, b) => b.share - a.share)
  const kept = topicHits.filter((t) => t.share >= 0.15).slice(0, 2)

  // 3. Confidence.
  const s1 = kept[0]?.share ?? 0
  const s2 = kept[1]?.share ?? 0
  const rawConfidence = clamp(0.5 + 0.5 * (s1 - s2) * Math.min(1, words / 300), 0.3, 0.98)
  let confidence = rawConfidence
  const notes: string[] = []
  const flags: RiskFlag[] = []

  // 4a. Keyword stuffing: any single term above 4% of words.
  let stuffedTerm: { term: string; density: number } | null = null
  for (const h of hits) {
    const density = h.count / words
    if (density > STUFFING_LIMIT && (!stuffedTerm || density > stuffedTerm.density)) {
      stuffedTerm = { term: h.term, density }
    }
  }
  if (stuffedTerm) {
    confidence /= 2
    flags.push('low-quality')
    notes.push(`Halved: "${stuffedTerm.term}" is ${(stuffedTerm.density * 100).toFixed(1)}% of words (keyword stuffing).`)
  }

  // 4b. Hinglish or Hindi.
  const devanagari = /[ऀ-ॿ]/.test(text)
  const hinglishMarkers = HINGLISH_MARKERS.reduce((a, m) => a + countTerm(text, m), 0)
  const language: Language = devanagari || hinglishMarkers >= 3 ? 'hi-en' : 'en'
  if (language === 'hi-en' && confidence > 0.6) {
    confidence = 0.6
    notes.push('Capped at 0.60: Hindi / Hinglish is not yet validated for this model.')
  } else if (language === 'hi-en') {
    notes.push('Hindi / Hinglish detected: confidence capped at 0.60.')
  }

  // 5. Risk flags.
  for (const [flag, terms] of Object.entries(RISK_KEYWORDS) as [RiskFlag, string[]][]) {
    if (terms.some((t) => countTerm(text, t) > 0)) flags.push(flag)
  }

  if (kept.length === 0) {
    return {
      status: 'scored',
      words,
      profile: { ...SITE_FALLBACK, confidenceNote: 'No topic keywords found. Using site-level fallback.' },
      flags,
      language,
      hits,
      topicHits,
      stuffedTerm,
      hinglishMarkers,
      rawConfidence,
    }
  }

  if (notes.length === 0) notes.push('Gap between top two topics, scaled by article length.')

  return {
    status: 'scored',
    words,
    profile: {
      topics: kept.map((t) => ({ topic: t.topic, share: t.share })),
      confidence,
      source: 'demo-classifier',
      modelVersion: 'demo classifier',
      scoredAgo: 'just now',
      confidenceNote: notes.join(' '),
    },
    flags,
    language,
    hits,
    topicHits,
    stuffedTerm,
    hinglishMarkers,
    rawConfidence,
  }
}

/** Turn pasted text into a Page the engine can run, exactly like a curated page. */
export function pageFromText(text: string): Page {
  const result = classify(text)
  const paragraphs = text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  const firstLine = paragraphs[0] ?? 'Your article'
  const title = firstLine.length > 80 ? `${firstLine.slice(0, 77).trimEnd()}…` : firstLine
  const keywords: Keyword[] =
    result.status === 'scored'
      ? [...result.hits].sort((a, b) => b.count - a.count).slice(0, 5).map((h) => ({ term: h.term, topic: h.topic }))
      : []
  return {
    id: 'custom',
    title,
    description: 'Your pasted article, scored by the demo classifier.',
    tag: 'Your article',
    publication: 'Your site',
    byline: 'Pasted text',
    published: 'Analysed just now',
    body: paragraphs,
    keywords,
    flags: result.status === 'scored' ? result.flags : [],
    language: result.status === 'scored' ? result.language : 'en',
    floor: 0.5,
    profile: result.profile,
    stuffed: result.status === 'scored' && !!result.stuffedTerm,
  }
}

export const SAMPLE_ARTICLE = `How to choose your first pair of running shoes

Walk into any sports shop and the wall of running shoes can feel overwhelming. The good news is that most beginners only need to answer three questions before they buy.

First, where will you run? Road shoes are lighter and smoother underfoot. Trail shoes have deeper grip and a tougher upper for mud and rocks. If you mostly jog around the park on paths, road shoes are fine.

Second, how much cushioning feels right? There is no single correct answer. Try a soft pair and a firmer pair back to back, and jog a few steps in each. Your legs will usually tell you within a minute.

Third, does the shoe fit at the end of a long run? Feet swell, so leave a thumb's width of space at the toe. Buy in the afternoon, wear your usual socks, and ignore the colour until everything else is right.

Once you have a pair, rotate them with an older pair if you can, and replace them after about 600 kilometres. Your knees will thank you on race day.`
