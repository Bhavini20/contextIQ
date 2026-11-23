import { describe, expect, it } from 'vitest'
import { CAMPAIGNS, PAGES, getPage } from '../data'
import { decide, DEFAULT_OPTIONS, type Decision, type EngineOptions } from '../engine'
import { buildInventory } from '../inventory'
import { compare, sweep, SWEEP, withThreshold, suggestThreshold } from '../metrics'
import { classify, SAMPLE_ARTICLE } from '../classifier'
import { closeness } from '../taxonomy'
import type { Strategy } from '../types'

const run = (id: string, strategy: Strategy = 'contextiq', ronBids = true, rescored = false): Decision => {
  const page = getPage(id)!
  const profile = rescored ? page.rescored! : page.profile
  return decide(page, profile, CAMPAIGNS, strategy, DEFAULT_OPTIONS, ronBids)
}
const ev = (d: Decision, id: string) => d.evals.find((e) => e.campaign.id === id)!

describe('taxonomy closeness', () => {
  it('matches the spec table', () => {
    expect(closeness('smartphones', 'smartphones')).toBe(1)
    expect(closeness('smartphones', 'mobile')).toBe(0.85)
    expect(closeness('mobile', 'smartphones')).toBe(0.6)
    expect(closeness('tablets', 'smartphones')).toBe(0.4)
    expect(closeness('laptops', 'smartphones')).toBe(0.2)
    expect(closeness('running', 'smartphones')).toBe(0)
  })
})

describe('worked results (spec §4)', () => {
  it('P1 smartphone comparison: Nova and Volt protected at full bid; Nova wins $4.00; Strict Nova $4.00', () => {
    const d = run('P1')
    expect(ev(d, 'nova').pMatch).toBeCloseTo(0.9409, 4)
    expect(ev(d, 'nova').provenance).toBe('protected')
    expect(ev(d, 'nova').bid).toBe(4)
    expect(ev(d, 'volt').pMatch).toBeCloseTo(0.7998, 4)
    expect(ev(d, 'volt').provenance).toBe('protected')
    expect(ev(d, 'volt').bid).toBe(2.5)
    expect(d.winner!.campaign.id).toBe('nova')
    expect(d.winner!.band).toBe('specific')
    expect(d.price.toFixed(2)).toBe('4.00')
    expect(ev(d, 'lumen').reason).toBe('BELOW-THRESHOLD')
    expect(ev(d, 'payzen').reason).toBe('BELOW-THRESHOLD')
    expect(ev(d, 'ron').reason).toBe('BELOW-FLOOR')
    const s = run('P1', 'strict')
    expect(s.winner!.campaign.id).toBe('nova')
    expect(s.price).toBe(4)
  })

  it('P2 city living: Nova wins Broad at $2.58; Strict RON half the time else unfilled', () => {
    const d = run('P2')
    expect(ev(d, 'nova').pMatch).toBeCloseTo(0.644, 4)
    expect(ev(d, 'nova').bid).toBeCloseTo(2.576, 4)
    expect(ev(d, 'volt').pMatch).toBeCloseTo(0.5474, 4)
    expect(ev(d, 'volt').bid).toBeCloseTo(1.934, 3)
    expect(d.winner!.campaign.id).toBe('nova')
    expect(d.winner!.band).toBe('broad')
    expect(d.price.toFixed(2)).toBe('2.58')
    const sOn = run('P2', 'strict', true)
    expect(sOn.winner!.campaign.id).toBe('ron')
    expect(sOn.price).toBe(0.6)
    expect(run('P2', 'strict', false).winner).toBeNull()
  })

  it('P3 payment fraud: PayZen excluded SUIT-FRAUD despite P = 0.81', () => {
    for (const strategy of ['contextiq', 'strict'] as Strategy[]) {
      const d = run('P3', strategy)
      expect(ev(d, 'payzen').pMatch).toBeCloseTo(0.8075, 4)
      expect(ev(d, 'payzen').outcome).toBe('excluded')
      expect(ev(d, 'payzen').reason).toBe('SUIT-FRAUD')
      expect(d.winner).toBeNull()
    }
  })

  it('P4 before rescore: Volt wins at $1.98, Nova below threshold (0.35); Strict unfilled', () => {
    const d = run('P4')
    expect(ev(d, 'volt').pMatch).toBeCloseTo(0.585, 4)
    expect(ev(d, 'volt').bid).toBeCloseTo(1.981, 3)
    expect(ev(d, 'nova').pMatch).toBeCloseTo(0.351, 4)
    expect(ev(d, 'nova').reason).toBe('BELOW-THRESHOLD')
    expect(d.winner!.campaign.id).toBe('volt')
    expect(d.price.toFixed(2)).toBe('1.98')
    expect(ev(d, 'ron').reason).toBe('BELOW-FLOOR')
    expect(run('P4', 'strict').winner).toBeNull()
  })

  it('P4 after rescore: Nova protected, wins Specific at $4.00; Strict Nova $4.00', () => {
    const d = run('P4', 'contextiq', true, true)
    expect(ev(d, 'nova').pMatch).toBeCloseTo(0.8835, 4)
    expect(ev(d, 'nova').provenance).toBe('protected')
    expect(ev(d, 'nova').bid).toBe(4)
    expect(d.winner!.campaign.id).toBe('nova')
    expect(d.winner!.band).toBe('specific')
    expect(d.price.toFixed(2)).toBe('4.00')
    const s = run('P4', 'strict', true, true)
    expect(s.winner!.campaign.id).toBe('nova')
    expect(s.price).toBe(4)
  })

  it('P5 Hinglish: Volt wins at $1.84, Nova below threshold (0.56); Strict RON or unfilled', () => {
    const d = run('P5')
    expect(ev(d, 'nova').pMatch).toBeCloseTo(0.555, 4)
    expect(ev(d, 'nova').reason).toBe('BELOW-THRESHOLD')
    expect(ev(d, 'volt').pMatch).toBeCloseTo(0.4718, 4)
    expect(ev(d, 'volt').bid).toBeCloseTo(1.84, 3)
    expect(d.winner!.campaign.id).toBe('volt')
    expect(d.price.toFixed(2)).toBe('1.84')
    expect(run('P5', 'strict', true).winner!.campaign.id).toBe('ron')
    expect(run('P5', 'strict', false).winner).toBeNull()
  })

  it('P5 with strict suitability: contextual campaigns excluded SUIT-LANG', () => {
    const page = getPage('P5')!
    const d = decide(page, page.profile, CAMPAIGNS, 'contextiq', { strictSuitability: true }, false)
    expect(ev(d, 'volt').reason).toBe('SUIT-LANG')
    expect(d.winner).toBeNull()
  })

  it('P6 keyword-stuffed: Nova SUIT-LOWQ, Volt below threshold (0.29), RON at most', () => {
    for (const strategy of ['contextiq', 'strict'] as Strategy[]) {
      const d = run('P6', strategy, true)
      expect(ev(d, 'nova').reason).toBe('SUIT-LOWQ')
      expect(d.winner!.campaign.id).toBe('ron')
      expect(run('P6', strategy, false).winner).toBeNull()
    }
    const d = run('P6')
    expect(ev(d, 'volt').pMatch).toBeCloseTo(0.29, 2)
    expect(ev(d, 'volt').reason).toBe('BELOW-THRESHOLD')
  })

  it('P7 laptop vs tablet: Lumen protected at $3.80 (no longer discounted); Strict Lumen $3.80', () => {
    const d = run('P7')
    expect(ev(d, 'lumen').pMatch).toBeCloseTo(0.65875, 5)
    expect(ev(d, 'lumen').provenance).toBe('protected')
    expect(ev(d, 'lumen').bid).toBe(3.8)
    expect(ev(d, 'volt').pMatch).toBeCloseTo(0.5238, 4)
    expect(ev(d, 'volt').provenance).toBe('incremental')
    expect(ev(d, 'volt').bid).toBeCloseTo(1.905, 3)
    expect(d.winner!.campaign.id).toBe('lumen')
    expect(d.winner!.band).toBe('broad')
    expect(d.price.toFixed(2)).toBe('3.80')
    const s = run('P7', 'strict')
    expect(s.winner!.campaign.id).toBe('lumen')
    expect(s.price).toBe(3.8)
  })

  it('P10 plane crash: SkyHop SUIT-TRAGEDY; unfilled', () => {
    for (const strategy of ['contextiq', 'strict'] as Strategy[]) {
      const d = run('P10', strategy)
      expect(ev(d, 'skyhop').reason).toBe('SUIT-TRAGEDY')
      expect(d.winner).toBeNull()
    }
  })
})

describe('inventory', () => {
  const inv = buildInventory()
  it('has 55 pages and 1,000 requests, 20 per curated page', () => {
    expect(inv.pages).toHaveLength(55)
    expect(inv.requests).toHaveLength(1000)
    for (const p of PAGES) expect(inv.requests.filter((r) => r.page.id === p.id)).toHaveLength(20)
  })
  it('is deterministic', () => {
    const again = buildInventory()
    expect(again.requests.map((r) => `${r.page.id}${r.ronBids}${JSON.stringify(r.truth)}`)).toEqual(
      inv.requests.map((r) => `${r.page.id}${r.ronBids}${JSON.stringify(r.truth)}`),
    )
  })
})

describe('suitability violations are always 0', () => {
  const inv = buildInventory()
  const optsList: EngineOptions[] = []
  for (const strictSuitability of [false, true]) optsList.push({ strictSuitability })

  it('at every slider position, for every campaign and all, under every toggle', () => {
    const ids = ['all', ...CAMPAIGNS.filter((c) => c.kind === 'contextual').map((c) => c.id)]
    for (const opts of optsList) {
      for (const id of ids) {
        for (const t of SWEEP) {
          const cmp = compare(inv, withThreshold(CAMPAIGNS, id, t), opts)
          expect(cmp.ciq.violations).toBe(0)
          expect(cmp.strict.violations).toBe(0)
        }
      }
    }
  }, 120_000)

  it('sweep reports 0 violations', () => {
    for (const p of sweep(inv, CAMPAIGNS, 'all', DEFAULT_OPTIONS)) expect(p.violations).toBe(0)
  })
})

describe('metrics sanity', () => {
  const inv = buildInventory()
  const cmp = compare(inv, CAMPAIGNS, DEFAULT_OPTIONS)
  it('ContextIQ fills more than Strict', () => {
    expect(cmp.ciq.fillRate).toBeGreaterThan(cmp.strict.fillRate)
  })
  it('guardrail revenue splits sum to totals', () => {
    expect(cmp.alreadySelling.ciq + cmp.newDemand.ciq).toBeCloseTo(cmp.ciq.revenue, 6)
    expect(cmp.alreadySelling.strict + cmp.newDemand.strict).toBeCloseTo(cmp.strict.revenue, 6)
  })
  it('suggests a threshold for Nova', () => {
    const s = suggestThreshold(inv, CAMPAIGNS, 'nova', DEFAULT_OPTIONS)
    expect(s).not.toBeNull()
    expect(s!.threshold).toBeGreaterThanOrEqual(0.4)
    expect(s!.threshold).toBeLessThanOrEqual(0.9)
  })
})

describe('demo classifier', () => {
  it('scores the pre-filled sample as running', () => {
    const r = classify(SAMPLE_ARTICLE)
    expect(r.status).toBe('scored')
    if (r.status === 'scored') {
      expect(r.profile.topics[0].topic).toBe('running')
      expect(r.flags).toEqual([])
    }
  })
  it('falls back below 80 words', () => {
    const r = classify('A short note about phones and cameras.')
    expect(r.status).toBe('too-short')
    expect(r.profile.confidenceNote).toBe('Too short to score. Using site-level fallback.')
  })
  it('flags keyword stuffing and halves confidence', () => {
    const r = classify(PAGES.find((p) => p.id === 'P6')!.body.join('\n\n'))
    expect(r.status).toBe('scored')
    if (r.status === 'scored') {
      expect(r.flags).toContain('low-quality')
      expect(r.profile.confidence!).toBeLessThanOrEqual(0.49)
    }
  })
  it('caps Hinglish at 0.60', () => {
    const r = classify(PAGES.find((p) => p.id === 'P5')!.body.join('\n\n'))
    expect(r.status).toBe('scored')
    if (r.status === 'scored') {
      expect(r.language).toBe('hi-en')
      expect(r.profile.confidence!).toBeLessThanOrEqual(0.6)
    }
  })
  it('raises fraud and tragedy flags', () => {
    const fraud = classify(PAGES.find((p) => p.id === 'P3')!.body.join('\n\n'))
    const crash = classify(PAGES.find((p) => p.id === 'P10')!.body.join('\n\n'))
    expect(fraud.status === 'scored' && fraud.flags.includes('fraud')).toBe(true)
    expect(crash.status === 'scored' && crash.flags.includes('tragedy')).toBe(true)
  })
})

describe('curated content', () => {
  it('each curated article is 150–300 words and contains its keywords', () => {
    for (const p of PAGES) {
      const text = p.body.join(' ')
      const words = text.split(/\s+/).length
      expect(words, p.id).toBeGreaterThanOrEqual(150)
      expect(words, p.id).toBeLessThanOrEqual(300)
      for (const k of p.keywords) expect(text.toLowerCase(), `${p.id}: ${k.term}`).toContain(k.term.toLowerCase())
    }
  })
})
