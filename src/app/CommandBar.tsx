import { AnimatePresence, motion } from 'framer-motion'
import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PAGES } from '../engine/data'
import { useApp, type View } from './state'

interface Item {
  id: string
  label: string
  group: string
  hint?: string
  run: () => void
}

export function CommandBar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, set, toggleTheme, runImpression } = useApp()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  const items = useMemo<Item[]>(() => {
    const views: [View, string][] = [
      ['story', 'Story (landing)'],
      ['pages', 'Pages and decision trace'],
      ['campaigns', 'Campaign setup'],
      ['tradeoffs', 'Trade-off explorer'],
      ['reports', 'Reports'],
      ['how', 'How it works'],
    ]
    return [
      ...views.map(([v, label]) => ({ id: `v-${v}`, label, group: 'Go to', run: () => set({ view: v }) })),
      ...PAGES.map((p) => ({ id: `p-${p.id}`, label: p.title, group: 'Pages', hint: `${p.id} · ${p.tag}`, run: () => set({ view: 'pages', pageId: p.id }) })),
      ...state.campaigns
        .filter((c) => c.kind === 'contextual')
        .map((c) => ({ id: `c-${c.id}`, label: `${c.name}: trade-offs`, group: 'Campaigns', run: () => set({ view: 'tradeoffs', focus: c.id }) })),
      { id: 'a-run', label: 'Run impression', group: 'Actions', hint: 'R', run: () => { set({ view: 'pages' }); runImpression() } },
      { id: 'a-guided', label: 'Start guided demo', group: 'Actions', run: () => set({ guided: 2 }) },
      { id: 'a-strict', label: `Show ${state.strategy === 'strict' ? 'ContextIQ' : 'Strict matching'} in the trace`, group: 'Actions', run: () => set({ view: 'pages', strategy: state.strategy === 'strict' ? 'contextiq' : 'strict' }) },
      { id: 'a-theme', label: 'Toggle dark mode', group: 'Actions', run: toggleTheme },
    ]
  }, [set, state.campaigns, state.strategy, toggleTheme, runImpression])

  const filtered = items.filter((it) => `${it.label} ${it.hint ?? ''} ${it.group}`.toLowerCase().includes(q.toLowerCase()))

  useEffect(() => {
    if (open) {
      setQ('')
      setI(0)
      setTimeout(() => input.current?.focus(), 10)
    }
  }, [open])
  useEffect(() => setI(0), [q])

  const choose = (it: Item | undefined) => {
    if (!it) return
    it.run()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-start justify-center bg-ink/20 px-4 pt-[12vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            role="dialog"
            aria-label="Command bar"
            initial={{ y: -8, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-[560px] overflow-hidden rounded-xl border border-line-2 bg-surface shadow-[0_24px_80px_rgb(0_0_0/0.2)]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search size={16} className="text-ink-3" />
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(filtered.length - 1, x + 1)) }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)) }
                  else if (e.key === 'Enter') choose(filtered[i])
                  else if (e.key === 'Escape') onClose()
                }}
                placeholder="Jump to a page, campaign or view…"
                aria-label="Search commands"
                className="h-12 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-4"
              />
              <kbd className="rounded border border-line px-1.5 font-mono text-[10px] text-ink-3">Esc</kbd>
            </div>
            <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-3">Nothing matches “{q}”.</li>}
              {filtered.map((it, k) => (
                <li key={it.id} role="option" aria-selected={k === i}>
                  <button
                    onMouseEnter={() => setI(k)}
                    onClick={() => choose(it)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${k === i ? 'bg-sunken text-ink' : 'text-ink-2'}`}
                  >
                    <span className="w-20 shrink-0 text-[11px] text-ink-4">{it.group}</span>
                    <span className="flex-1 truncate">{it.label}</span>
                    {it.hint && <span className="font-mono text-[11px] text-ink-4">{it.hint}</span>}
                    {k === i && <CornerDownLeft size={13} className="text-ink-4" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
