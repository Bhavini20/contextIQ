// Simplified content taxonomy, modelled on the IAB content taxonomy (spec §3).

export type TopicId =
  | 'technology'
  | 'mobile'
  | 'smartphones'
  | 'tablets'
  | 'computing'
  | 'laptops'
  | 'finance'
  | 'payments'
  | 'digital-wallets'
  | 'personal-finance'
  | 'travel'
  | 'flights'
  | 'hotels'
  | 'health'
  | 'running'
  | 'lifestyle'
  | 'urban-living'

interface Node {
  id: TopicId
  name: string
  parent: TopicId | null
}

const NODES: Node[] = [
  { id: 'technology', name: 'Technology', parent: null },
  { id: 'mobile', name: 'Mobile', parent: 'technology' },
  { id: 'smartphones', name: 'Smartphones', parent: 'mobile' },
  { id: 'tablets', name: 'Tablets', parent: 'mobile' },
  { id: 'computing', name: 'Computing', parent: 'technology' },
  { id: 'laptops', name: 'Laptops', parent: 'computing' },
  { id: 'finance', name: 'Finance', parent: null },
  { id: 'payments', name: 'Payments', parent: 'finance' },
  { id: 'digital-wallets', name: 'Digital wallets', parent: 'payments' },
  { id: 'personal-finance', name: 'Personal finance', parent: 'finance' },
  { id: 'travel', name: 'Travel', parent: null },
  { id: 'flights', name: 'Flights', parent: 'travel' },
  { id: 'hotels', name: 'Hotels', parent: 'travel' },
  { id: 'health', name: 'Health & Fitness', parent: null },
  { id: 'running', name: 'Running', parent: 'health' },
  { id: 'lifestyle', name: 'Lifestyle', parent: null },
  { id: 'urban-living', name: 'Urban living', parent: 'lifestyle' },
]

const BY_ID = new Map(NODES.map((n) => [n.id, n]))

export const LEAF_TOPICS: TopicId[] = NODES.filter(
  (n) => n.parent !== null && !NODES.some((m) => m.parent === n.id),
).map((n) => n.id)

export function topicName(id: TopicId): string {
  return BY_ID.get(id)!.name
}

export function parentOf(id: TopicId): TopicId | null {
  return BY_ID.get(id)!.parent
}

/** Ancestors from the node itself up to the vertical (root). */
export function lineage(id: TopicId): TopicId[] {
  const out: TopicId[] = []
  let cur: TopicId | null = id
  while (cur) {
    out.push(cur)
    cur = parentOf(cur)
  }
  return out
}

/** Human-readable path, e.g. "Technology → Mobile → Smartphones". */
export function topicPath(id: TopicId): string {
  return lineage(id).reverse().map(topicName).join(' → ')
}

export function verticalOf(id: TopicId): TopicId {
  const l = lineage(id)
  return l[l.length - 1]
}

export function isWithin(topic: TopicId, branch: TopicId): boolean {
  return lineage(topic).includes(branch)
}

export type Relationship = 'same' | 'inside' | 'above' | 'sibling' | 'vertical' | 'none'

export const CLOSENESS: Record<Relationship, number> = {
  same: 1.0,
  inside: 0.85,
  above: 0.6,
  sibling: 0.4,
  vertical: 0.2,
  none: 0.0,
}

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  same: 'exact match',
  inside: 'inside campaign branch',
  above: 'page is broader',
  sibling: 'sibling topic',
  vertical: 'same vertical',
  none: 'different vertical',
}

/** Relationship between a page topic T and a campaign target C (spec §4 step 1). */
export function relationship(t: TopicId, c: TopicId): Relationship {
  if (t === c) return 'same'
  if (lineage(t).includes(c)) return 'inside'
  if (lineage(c).includes(t)) return 'above'
  const pt = parentOf(t)
  if (pt !== null && pt === parentOf(c)) return 'sibling'
  if (verticalOf(t) === verticalOf(c)) return 'vertical'
  return 'none'
}

export function closeness(t: TopicId, c: TopicId): number {
  return CLOSENESS[relationship(t, c)]
}
