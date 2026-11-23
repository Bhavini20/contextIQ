import { useState } from 'react'
import { PAGES } from '../../engine/data'
import { useApp } from '../../app/state'
import { Article } from './Article'
import { PastePanel } from './PastePanel'
import { Signals } from './Signals'
import { Trace } from './Trace'
import { FileText, Plus } from 'lucide-react'

export function PagesView() {
  const { state, set, custom } = useApp()
  const [pasting, setPasting] = useState(false)

  const select = (id: string) => {
    setPasting(false)
    set({ pageId: id })
  }

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Page rail: the content analyser */}
      <aside aria-label="Pages" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">Publisher pages</h2>
          <span className="text-xs text-ink-4">{PAGES.length} curated</span>
        </div>
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:px-0">
          {PAGES.map((p) => {
            const active = state.pageId === p.id && !pasting
            return (
              <li key={p.id} className="shrink-0 lg:shrink">
                <button
                  onClick={() => select(p.id)}
                  aria-current={active ? 'true' : undefined}
                  className={`group w-[220px] rounded-lg border px-3 py-2.5 text-left transition-colors lg:w-full ${
                    active ? 'border-line-2 bg-surface shadow-soft' : 'border-transparent hover:bg-sunken'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[11px] ${active ? 'text-cta-ink' : 'text-ink-4'}`}>{p.id}</span>
                    <span className="truncate text-[11px] text-ink-3">{p.tag}</span>
                  </div>
                  <div className={`mt-0.5 line-clamp-2 text-[13px] leading-snug ${active ? 'text-ink' : 'text-ink-2'}`}>{p.title}</div>
                </button>
              </li>
            )
          })}
          {custom && (
            <li className="shrink-0 lg:shrink">
              <button
                onClick={() => select('custom')}
                className={`w-[220px] rounded-lg border px-3 py-2.5 text-left lg:w-full ${
                  state.pageId === 'custom' && !pasting ? 'border-line-2 bg-surface shadow-soft' : 'border-transparent hover:bg-sunken'
                }`}
              >
                <div className="flex items-center gap-2 text-[11px] text-ink-3">
                  <FileText size={12} /> Your article
                </div>
                <div className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-2">{custom.title}</div>
              </button>
            </li>
          )}
          <li className="shrink-0 lg:mt-3 lg:shrink lg:border-t lg:border-line lg:pt-3">
            <button
              onClick={() => setPasting(true)}
              className={`flex h-full w-[180px] items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-left text-[13px] lg:w-full ${
                pasting ? 'border-cta text-cta-ink' : 'border-line-2 text-ink-2 hover:border-ink-4'
              }`}
            >
              <Plus size={14} /> Paste your own article
            </button>
          </li>
        </ul>
      </aside>

      <div className="min-w-0">
        {pasting ? (
          <PastePanel onDone={() => setPasting(false)} />
        ) : (
          <>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
              <Article />
              <Signals />
            </div>
            <Trace />
          </>
        )}
      </div>
    </div>
  )
}
