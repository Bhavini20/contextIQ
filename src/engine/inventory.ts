// Seeded simulated inventory (spec §3): 55 pages, 1,000 requests, hidden ground truth.
import { CAMPAIGNS, PAGES } from './data'
import { fitFor } from './engine'
import { mulberry32, SEED } from './prng'
import { LEAF_TOPICS, parentOf, type TopicId } from './taxonomy'
import { RISK_FLAGS, type Page, type PageProfile, type RiskFlag } from './types'

const SYNTHETIC_TITLES: Record<string, string[]> = {
  smartphones: [
    'The camera phone that surprised us this year',
    'How long should a phone battery really last?',
    'Five settings to change on a new Android phone',
    'Foldable phones, two years on',
    'Is 5G worth paying extra for yet?',
  ],
  tablets: [
    'The best tablets for reading comics',
    'Can a tablet replace your sketchbook?',
    'Kids’ tablets with parental controls that work',
    'Tablet keyboards, tested and ranked',
    'Why tablets are back in the classroom',
  ],
  laptops: [
    'Thin-and-light laptops for under $900',
    'What to look for in a coding laptop',
    'How we test laptop battery life',
    'The quietest laptops we have used',
    'Should you buy a refurbished laptop?',
  ],
  'digital-wallets': [
    'Tap to pay abroad: what fees to expect',
    'Splitting bills with friends, the easy way',
    'How QR payments took over street markets',
    'Setting up a wallet for a teenager',
    'Do loyalty points belong in your wallet app?',
  ],
  'personal-finance': [
    'Building an emergency fund on a tight budget',
    'Fixed or floating: choosing a home loan',
    'A beginner’s guide to index funds',
    'How to read your credit report',
    'Budgeting apps compared',
  ],
  flights: [
    'Window or aisle? What frequent flyers choose',
    'How airlines price last-minute seats',
    'Surviving a long layover in comfort',
    'Carry-on rules, airline by airline',
    'The new direct routes worth knowing',
  ],
  hotels: [
    'Boutique hotels worth the detour',
    'When to book a hotel for the best rate',
    'Hostels that feel like hotels',
    'What “resort fee” really means',
    'Hotel loyalty programmes, ranked',
  ],
  running: [
    'Your first 5k: an eight-week plan',
    'How to choose running shoes',
    'Running in the heat without burning out',
    'Interval sessions for busy weeks',
    'Stretching after a long run: does it help?',
  ],
  'urban-living': [
    'Small-apartment storage ideas that work',
    'The quiet streets of a loud city',
    'Renting your first flat: a checklist',
    'Commuting by bike in winter',
    'Neighbourhood guides: where to live next',
  ],
}

export interface Request {
  index: number
  page: Page
  /** Does run-of-network bid on this request? */
  ronBids: boolean
  /** Hidden ground truth: is this impression truly relevant to each contextual campaign? */
  truth: Record<string, boolean>
}

export interface Inventory {
  pages: Page[]
  requests: Request[]
}

/** True confidence: model confidence for scored pages, −0.10 for fallback, −0.25 for stuffed. */
export function trueConfidence(page: Page, profile: PageProfile): number {
  const c = profile.confidence ?? 0
  let t = c
  if (profile.source === 'section-fallback') t = c - 0.1
  if (page.stuffed) t = c - 0.25
  return Math.max(0, t)
}

function makeSyntheticPages(rng: () => number): Page[] {
  const out: Page[] = []
  let n = 0
  for (const leaf of LEAF_TOPICS) {
    for (let j = 0; j < 5; j++) {
      n++
      const focused = rng() < 0.6
      let topics: { topic: TopicId; share: number }[]
      if (focused) {
        topics = [{ topic: leaf, share: 0.75 + 0.2 * rng() }]
      } else {
        const primary = 0.45 + 0.2 * rng()
        const others = LEAF_TOPICS.filter((t) => t !== leaf)
        const other = others[Math.floor(rng() * others.length)]
        topics = [
          { topic: leaf, share: primary },
          { topic: other, share: 1 - primary },
        ]
      }
      const confidence = 0.6 + 0.38 * rng()
      const unscored = rng() < 0.1
      const flagged = rng() < 0.08
      const flag: RiskFlag | null = flagged ? RISK_FLAGS[Math.floor(rng() * RISK_FLAGS.length)] : null
      const floor = rng() < 0.25 ? 1.0 : 0.5

      const profile: PageProfile = unscored
        ? {
            topics: [{ topic: parentOf(leaf)!, share: topics[0].share }],
            confidence,
            source: 'section-fallback',
            modelVersion: 'v1.3 (section profile)',
            scoredAgo: 'Section profile',
            confidenceNote: 'Borrowed from the section; page queued for scoring.',
          }
        : {
            topics,
            confidence,
            source: 'scored',
            modelVersion: 'v1.3',
            scoredAgo: 'scored',
            confidenceNote: 'Calibrated on human-labelled pages in this category.',
          }

      out.push({
        id: `S${String(n).padStart(2, '0')}`,
        title: SYNTHETIC_TITLES[leaf][j],
        description: 'Synthetic page in the simulated inventory.',
        tag: 'Synthetic',
        publication: 'Simulated publisher',
        byline: '',
        published: '',
        body: [],
        keywords: [],
        flags: flag ? [flag] : [],
        language: 'en',
        floor,
        profile,
        stuffed: flag === 'low-quality',
        synthetic: true,
      })
    }
  }
  return out
}

export function buildInventory(seed = SEED): Inventory {
  const rng = mulberry32(seed)
  const synthetic = makeSyntheticPages(rng)
  const pages = [...PAGES, ...synthetic]

  // 20 requests per curated page, the remaining 800 spread evenly over synthetic pages.
  const plan: Page[] = []
  for (const p of PAGES) for (let i = 0; i < 20; i++) plan.push(p)
  const remaining = 1000 - plan.length
  const per = Math.floor(remaining / synthetic.length)
  const extra = remaining - per * synthetic.length
  synthetic.forEach((p, i) => {
    const k = per + (i < extra ? 1 : 0)
    for (let j = 0; j < k; j++) plan.push(p)
  })

  const contextual = CAMPAIGNS.filter((c) => c.kind === 'contextual')
  const requests: Request[] = plan.map((page, index) => {
    const ronBids = rng() < 0.5
    const truth: Record<string, boolean> = {}
    const tc = trueConfidence(page, page.profile)
    for (const c of contextual) {
      const fit = fitFor(page.profile, c.target!).fit
      truth[c.id] = rng() < fit * tc
    }
    return { index, page, ronBids, truth }
  })

  return { pages, requests }
}

let cached: Inventory | null = null
export function inventory(): Inventory {
  if (!cached) cached = buildInventory()
  return cached
}
