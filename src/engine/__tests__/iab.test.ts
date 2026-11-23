import { describe, expect, it } from 'vitest'
import { IAB_CT2, NODES } from '../taxonomy'

// IDs checked against IAB Tech Lab "Content Taxonomy 2.2.tsv" (identical in 2.0).
describe('IAB Content Taxonomy 2.2 mapping', () => {
  it('maps every demo topic', () => {
    for (const t of NODES) expect(IAB_CT2[t.id], t.id).toBeDefined()
  })
  it('uses the official IDs', () => {
    const ids = Object.fromEntries(Object.entries(IAB_CT2).map(([k, v]) => [k, v.id]))
    expect(ids).toEqual({
      technology: '596', mobile: '632', smartphones: '635', tablets: '636', computing: '599', laptops: '630',
      finance: '391', payments: '392', 'digital-wallets': '392', 'personal-finance': '396',
      travel: '653', flights: '672', hotels: '668', health: '223', running: '227', lifestyle: '441', 'urban-living': '442',
    })
  })
})
