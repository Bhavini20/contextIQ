// Labelling rules (spec §10): money $ CPM two decimals, probabilities two decimals, percentages one decimal.
export const money = (x: number) => `$${x.toFixed(2)}`
export const prob = (x: number) => x.toFixed(2)
export const pct = (x: number) => `${(x * 100).toFixed(1)}%`
export const pts = (x: number) => `${Math.abs(x * 100).toFixed(1)} pts`
export const signed = (x: number, f: (n: number) => string) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${f(Math.abs(x))}`
export const signedMoney = (x: number) => signed(x, (n) => `$${n.toFixed(2)}`)
export const signedPct = (x: number) => signed(x, (n) => `${(n * 100).toFixed(1)}%`)
export const signedPts = (x: number) => signed(x, (n) => `${(n * 100).toFixed(1)} pts`)

export const PROPOSAL_PDF_URL = 'PROPOSAL_PDF_URL' // TODO: replace with the hosted proposal PDF link
export const AUTHOR_NAME = '[YOUR NAME]' // TODO: replace with your name

export const FOOTNOTE = 'Simulated inventory of 1,000 requests. Not Media.net data and not a forecast.'
