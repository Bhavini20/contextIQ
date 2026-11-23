import { describe, expect, it } from 'vitest'
import { pm } from '../../lib/format'
import { CAMPAIGNS } from '../data'
import { decide, DEFAULT_OPTIONS, type EngineOptions } from '../engine'
import { buildInventory } from '../inventory'
import { advertiserEconomics, compare, market, marketSweep, shifted, SHIFTS, summarize, SWEEP, withThreshold } from '../metrics'
import type { Campaign } from '../types'

const inv = buildInventory()

describe('publisher-safe by design (thresholds 0.30–0.95, toggles on and off)', () => {
  const ids = ['all', ...CAMPAIGNS.filter((c) => c.kind === 'contextual').map((c) => c.id)]
  const configs: { label: string; opts: EngineOptions; campaigns: Campaign[] }[] = []
  for (const strictSuitability of [false, true])
    for (const id of ids)
      for (const t of SWEEP) configs.push({ label: `${id}@${t} strictSuit=${strictSuitability}`, opts: { strictSuitability }, campaigns: withThreshold(CAMPAIGNS, id, t) })

  it('ContextIQ revenue ≥ Strict on every request, fill ≥ Strict per request and in total, zero violations', () => {
    for (const { label, opts, campaigns } of configs) {
      const cmp = compare(inv, campaigns, opts)
      cmp.ciqResults.forEach((c, i) => {
        const s = cmp.strictResults[i]
        expect(c.price, `${label} request ${i}`).toBeGreaterThanOrEqual(s.price - 1e-9)
        if (s.winner) expect(c.winner, `${label} request ${i} fill`).not.toBeNull()
      })
      expect(cmp.ciq.revenue, label).toBeGreaterThanOrEqual(cmp.strict.revenue - 1e-9)
      expect(cmp.ciq.filled, label).toBeGreaterThanOrEqual(cmp.strict.filled)
      expect(cmp.ciq.violations, label).toBe(0)
      expect(cmp.strict.violations, label).toBe(0)
    }
  }, 120_000)

  it('every Strict-eligible campaign keeps its full original bid, and no campaign bids twice', () => {
    for (const { label, opts, campaigns } of configs) {
      const seen = new Set<string>()
      for (const r of inv.requests) {
        const key = `${r.page.id}|${r.ronBids}`
        if (seen.has(key)) continue
        seen.add(key)
        const ciq = decide(r.page, r.page.profile, campaigns, 'contextiq', opts, r.ronBids)
        const strict = decide(r.page, r.page.profile, campaigns, 'strict', opts, r.ronBids)
        expect(new Set(ciq.evals.map((e) => e.campaign.id)).size, label).toBe(ciq.evals.length)
        expect(ciq.evals.length, label).toBe(campaigns.length)
        for (const s of strict.evals) {
          if (s.bid === null || s.campaign.kind !== 'contextual') continue
          const c = ciq.evals.find((e) => e.campaign.id === s.campaign.id)!
          expect(c.provenance, `${label} ${r.page.id} ${s.campaign.id}`).toBe('protected')
          expect(c.bid, `${label} ${r.page.id} ${s.campaign.id}`).toBe(s.campaign.baseBid)
          expect(c.bid).toBe(c.originalBid)
        }
      }
    }
  }, 120_000)

  it('moving a threshold never removes or discounts a protected bid', () => {
    const page = inv.requests.find((r) => r.page.id === 'P1')!.page
    for (const t of SWEEP) {
      const d = decide(page, page.profile, withThreshold(CAMPAIGNS, 'all', t), 'contextiq', DEFAULT_OPTIONS, true)
      expect(d.evals.find((e) => e.campaign.id === 'nova')!.bid).toBe(4)
      expect(d.evals.find((e) => e.campaign.id === 'volt')!.bid).toBe(2.5)
    }
  })
})

describe('two-sided economics', () => {
  const m = market(inv, CAMPAIGNS, DEFAULT_OPTIONS)
  it('reports provenance that adds up and never loses a request', () => {
    expect(m.provenance.lost).toBe(0)
    expect(m.provenance.gained + m.provenance.sameAsToday).toBe(inv.requests.length)
    expect(m.provenance.protectedWins + m.provenance.incrementalWins).toBe(m.cmp.ciq.contextualWins)
  })
  it('advertiserEconomics counts contextual wins only', () => {
    const e = advertiserEconomics(m.cmp.ciqResults)
    expect(e.impressions).toBe(m.cmp.ciq.contextualWins)
    expect(e.relevant).toBe(m.cmp.ciq.relevantWins)
    expect(summarize(m.cmp.ciqResults).violations).toBe(0)
  })
})

describe('all-campaigns threshold shift', () => {
  it('keeps each campaign relative to its own preset and never mutates the saved configs', () => {
    const before = JSON.stringify(CAMPAIGNS)
    const s = shifted(CAMPAIGNS, 0.1)
    expect(JSON.stringify(CAMPAIGNS)).toBe(before)
    for (const c of CAMPAIGNS.filter((c) => c.kind === 'contextual')) {
      expect(s.find((x) => x.id === c.id)!.threshold).toBeCloseTo(Math.min(0.95, c.threshold + 0.1), 9)
    }
    expect(shifted(CAMPAIGNS, 0)).toBe(CAMPAIGNS)
  })

  it('a zero shift reproduces the preset market', () => {
    const pts = marketSweep(inv, SHIFTS, (d) => shifted(CAMPAIGNS, d), DEFAULT_OPTIONS)
    const zero = pts.find((p) => p.x === 0)!
    const m = market(inv, CAMPAIGNS, DEFAULT_OPTIONS)
    expect(zero.revenue).toBeCloseTo(m.cmp.ciq.revenue, 9)
    for (const p of pts) expect(p.violations).toBe(0)
  })
})

describe('P(match) formatting', () => {
  it('never rounds across a band or threshold', () => {
    expect(pm(0.7996)).toBe('0.799')
    expect(pm(0.4999)).toBe('0.499')
    expect(pm(0.5996, 0.6)).toBe('0.599')
    expect(pm(0.883)).toBe('0.88')
    expect(pm(0.8)).toBe('0.80')
  })
})
