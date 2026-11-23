import { useEffect, useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useApp } from '../../app/state'
import { countTerm } from '../../engine/classifier'
import { topicName, type TopicId } from '../../engine/taxonomy'
import type { Keyword } from '../../engine/types'

function escape(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlight(text: string, keywords: Keyword[], on: boolean, offset: { n: number }) {
  if (!keywords.length) return [text]
  const sorted = [...keywords].sort((a, b) => b.term.length - a.term.length)
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${sorted.map((k) => escape(k.term)).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  const out: React.ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const i = m.index!
    if (i > last) out.push(text.slice(last, i))
    const kw = sorted.find((k) => k.term.toLowerCase() === m[0].toLowerCase())!
    const n = offset.n++
    out.push(
      <mark
        key={i}
        className="hl text-inherit"
        data-on={on}
        title={`${topicName(kw.topic)} keyword`}
        style={{ ['--hl' as string]: `var(--t-${kw.topic})`, color: 'inherit', transitionDelay: `${Math.min(n * 45, 900)}ms` }}
      >
        {m[0]}
      </mark>,
    )
    last = i + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Article() {
  const { page } = useApp()
  const reduce = useReducedMotion()
  const [on, setOn] = useState(!!reduce)
  useEffect(() => {
    setOn(!!reduce)
    if (reduce) return
    const t = setTimeout(() => setOn(true), 250)
    return () => clearTimeout(t)
  }, [page.id, reduce])

  const counts = useMemo(() => {
    const text = page.body.join('\n')
    return page.keywords.map((k) => ({ ...k, count: countTerm(text, k.term) }))
  }, [page])

  const offset = { n: 0 }
  return (
    <article aria-label="Publisher page" className="min-w-0">
      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {/* Publisher chrome */}
        <div className="flex items-center justify-between border-b border-line px-5 py-2.5 sm:px-8">
          <span className="font-serif text-[15px] font-semibold tracking-tight text-ink">{page.publication}</span>
          <span className="text-xs text-ink-3">{page.published}</span>
        </div>
        <div className="px-5 pt-6 pb-7 sm:px-8 sm:pt-8">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
            <span className="rounded border border-line px-1.5 py-px font-mono text-[11px]">{page.id === 'custom' ? 'Your page' : page.id}</span>
            {page.description && <span>{page.description}</span>}
          </div>
          <h1 className="font-serif text-[28px] leading-[1.15] font-medium tracking-[-0.01em] text-ink sm:text-[34px]">{page.title}</h1>
          {page.byline && <p className="mt-3 text-sm text-ink-3">{page.byline}</p>}
          <div className="mt-6 space-y-4 font-serif text-[17px] leading-[1.65] text-ink-2 sm:text-[18px]" lang={page.language === 'hi-en' ? 'hi-Latn' : 'en'}>
            {page.body.map((para, i) => (
              <p key={`${page.id}-${i}`}>{highlight(para, page.keywords, on, offset)}</p>
            ))}
          </div>
        </div>
        {counts.length > 0 && (
          <div className="border-t border-line bg-sunken/60 px-5 py-4 sm:px-8">
            <div className="label mb-2.5">Top keywords that drove the topics</div>
            <ul className="flex flex-wrap gap-2">
              {counts.map((k) => (
                <li
                  key={k.term}
                  className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-[13px] text-ink"
                  style={{ background: `var(--t-${k.topic})` }}
                >
                  <span>{k.term}</span>
                  <span className="font-mono text-[11px] text-ink-2">
                    ×{k.count} · {topicName(k.topic as TopicId)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  )
}
