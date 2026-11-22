import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { BookOpen, Check, Command, Link2, Moon, Play, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Logo, SimPill } from '../components/ui'
import { Campaigns } from '../features/campaigns/Campaigns'
import { HowItWorks } from '../features/how/HowItWorks'
import { Landing } from '../features/landing/Landing'
import { PagesView } from '../features/pages/PagesView'
import { Reports } from '../features/reports/Reports'
import { Tradeoffs } from '../features/tradeoffs/Tradeoffs'
import { AUTHOR_NAME, PROPOSAL_PDF_URL } from '../lib/format'
import { CommandBar } from './CommandBar'
import { GuidedBar } from './Guided'
import { useApp, type View } from './state'

export const NAV: { view: View; label: string; hint: string }[] = [
  { view: 'pages', label: 'Pages', hint: 'Analyse a page, see its signals, run an impression' },
  { view: 'campaigns', label: 'Campaigns', hint: 'Objective presets, thresholds and bid curves' },
  { view: 'tradeoffs', label: 'Trade-offs', hint: 'Threshold vs fill, revenue and relevance' },
  { view: 'reports', label: 'Reports', hint: 'Advertiser and publisher views' },
  { view: 'how', label: 'How it works', hint: 'Production architecture and OpenRTB' },
]

export function App() {
  const { state } = useApp()
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmdOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [state.view, state.pageId])

  return (
    <MotionConfig reducedMotion="user">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      {state.view === 'story' ? (
        <Landing />
      ) : (
        <div className="min-h-dvh">
          <Header onCommand={() => setCmdOpen(true)} />
          <main id="main" className={`mx-auto max-w-[1320px] px-4 pt-6 sm:px-6 lg:px-8 ${state.guided !== null ? 'pb-44' : 'pb-16'}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={state.view}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {state.view === 'pages' && <PagesView />}
                {state.view === 'campaigns' && <Campaigns />}
                {state.view === 'tradeoffs' && <Tradeoffs />}
                {state.view === 'reports' && <Reports />}
                {state.view === 'how' && <HowItWorks />}
              </motion.div>
            </AnimatePresence>
          </main>
          <Footer />
        </div>
      )}
      <GuidedBar />
      <CommandBar open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </MotionConfig>
  )
}

function Header({ onCommand }: { onCommand: () => void }) {
  const { state, set, theme, toggleTheme } = useApp()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        <button onClick={() => set({ view: 'story' })} className="flex items-center gap-2.5" aria-label="ContextIQ home">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">ContextIQ</span>
          <span className="hidden whitespace-nowrap text-sm text-ink-3 2xl:inline">Quality Score for contextual</span>
        </button>
        <nav aria-label="Console" className="ml-2 hidden items-center gap-0.5 whitespace-nowrap md:flex">
          {NAV.map((n) => (
            <NavButton key={n.view} {...n} active={state.view === n.view} onClick={() => set({ view: n.view })} />
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <SimPill className="hidden sm:inline-flex" />
          <button
            onClick={onCommand}
            className="hidden items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-ink-3 hover:text-ink lg:inline-flex"
            aria-label="Open command bar"
          >
            <Command size={12} /> K
          </button>
          <IconBtn label={copied ? 'Link copied' : 'Copy link to this view'} onClick={copy}>
            {copied ? <Check size={16} className="text-pos" /> : <Link2 size={16} />}
          </IconBtn>
          <IconBtn label={theme === 'light' ? 'Dark mode' : 'Light mode'} onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </IconBtn>
          {state.guided === null && (
            <button
              onClick={() => set({ guided: 2 })}
              className="ml-1 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-line-2 px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-sunken"
            >
              <Play size={13} className="text-accent" /> <span className="hidden xl:inline">Guided demo</span>
            </button>
          )}
          <a
            href={PROPOSAL_PDF_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-1 hidden items-center gap-1.5 whitespace-nowrap rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:opacity-90 sm:inline-flex"
          >
            <BookOpen size={14} /> <span className="hidden lg:inline">Read the proposal</span><span className="lg:hidden">Proposal</span>
          </a>
        </div>
      </div>
      {/* Mobile nav: horizontal, thumb-reachable */}
      <nav aria-label="Console" className="no-scrollbar flex gap-1 overflow-x-auto border-t border-line px-3 py-1.5 md:hidden">
        {NAV.map((n) => (
          <NavButton key={n.view} {...n} active={state.view === n.view} onClick={() => set({ view: n.view })} />
        ))}
        <SimPill className="ml-1 shrink-0 sm:hidden" />
      </nav>
    </header>
  )
}

function NavButton({ label, active, onClick, hint }: { label: string; active: boolean; onClick: () => void; hint: string }) {
  return (
    <button
      onClick={onClick}
      title={hint}
      aria-current={active ? 'page' : undefined}
      className={`relative shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${active ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}
    >
      {active && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-md bg-sunken" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
      <span className="relative">{label}</span>
    </button>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="grid h-8 w-8 place-items-center rounded-md text-ink-3 hover:bg-sunken hover:text-ink">
      {children}
    </button>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>ContextIQ concept prototype · PM case study for Media.net · {AUTHOR_NAME}</span>
        <span>Fictional brands and publishers. Simulated, seeded data (seed 42).</span>
      </div>
    </footer>
  )
}
