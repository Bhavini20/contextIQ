// Labelling rules (spec §10): money $ CPM two decimals, probabilities two decimals, percentages one decimal.
export const money = (x: number) => `$${x.toFixed(2)}`
export const prob = (x: number) => x.toFixed(2)
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`
export const pts = (x: number) => `${Math.abs(x * 100).toFixed(1)} pts`
export const signed = (x: number, f: (n: number) => string) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${f(Math.abs(x))}`
export const signedMoney = (x: number) => signed(x, (n) => `$${n.toFixed(2)}`)
export const signedPct = (x: number) => signed(x, (n) => `${(n * 100).toFixed(1)}%`)
export const signedPts = (x: number) => signed(x, (n) => `${(n * 100).toFixed(1)} pts`)

/** Served from public/ContextIQ-proposal.pdf. */
export const PROPOSAL_PDF_URL = '/ContextIQ-proposal.pdf'
export const AUTHOR_NAME = 'Bhavini Singh'

/** Three decimals, for numbers inside a written-out formula ("$4.00 × 0.883 = $3.53"). */
export const prob3 = (x: number) => x.toFixed(3)

/**
 * A P(match) that never contradicts its band or threshold: if two-decimal rounding would carry
 * the value across a cut-off (0.50, 0.80, or a given threshold), show it truncated to three decimals (0.799, not 0.80).
 */
export function pm(p: number, ...cuts: (number | null | undefined)[]): string {
  const r = Number(p.toFixed(2))
  for (const c of [0.5, 0.8, ...cuts]) {
    if (c == null) continue
    if (p < c - 1e-9 && r >= c - 1e-9) return (Math.floor(p * 1000) / 1000).toFixed(3)
  }
  return p.toFixed(2)
}

/** Dollars with thousands separators; cents only under $1,000. */
export const usd = (x: number) => {
  const big = Math.abs(x) >= 1000
  return `$${x.toLocaleString('en-US', { minimumFractionDigits: big ? 0 : 2, maximumFractionDigits: big ? 0 : 2 })}`
}
export const signedUsd = (x: number) => signed(x, usd)
export const count = (x: number) => Math.round(x).toLocaleString('en-US')

/** The simulation runs 1,000 requests; reports scale totals to a readable 1 million requests. */
export const PER_M = 1000
export const PER_M_LABEL = 'per 1M requests'

export const FOOTNOTE ='Simulated inventory of 1,000 requests. Not Media.net data and not a forecast.'
