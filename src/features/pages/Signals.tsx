import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleDashed, Database, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../app/state'
import { BandTag, MatchMeter, Num, ReasonChip, Tip, Why } from '../../components/ui'
import { fitFor, suitabilityCheck } from '../../engine/engine'
import { topicPath, RELATIONSHIP_LABEL } from '../../engine/taxonomy'
import { FLAG_REASON } from '../../engine/types'
import { prob } from '../../lib/format'

const STEPS = ['Queued', 'Extracting', 'Scoring', 'Cached'] as const

export function Signals() {
  const { page, profile, state, set } = useApp()
  const [matchFor, setMatchFor] = useState(state.focus === 'all' ? 'nova' : state.focus)
  const campaigns = state.campaigns.filter((c) => c.kind === 'contextual')
  const campaign = campaigns.find((c) => c.id === matchFor) ?? campaigns[0]

  const specificity = profile.topics[0]?.share ?? 0
  const fit = campaign.target ? fitFor(profile, campaign.target) : null
  const p = profile.confidence !== null && fit ? profile.confidence * fit.fit : 0
  const suit = suitabilityCheck(page, campaign, state.opts)

  return (
    <section aria-label="Page profile" className="min-w-0 xl:sticky xl:top-20 xl:self-start">
      <h2 className="label">Page profile</h2>
      <div className="mt-1.5">
        <SourceLine />
      </div>
      <Rescore />

      {/* Topics */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h3 className="text-sm font-medium text-ink">Topics</h3>
          <span className="text-xs text-ink-3">share of topic signal</span>
        </div>
        {profile.topics.length === 0 ? (
          <p className="text-sm text-ink-3">No topic claim. Site-level fallback; existing run-of-site rules apply.</p>
        ) : (
          <ul className="space-y-2.5">
            {profile.topics.map((t) => (
              <li key={t.topic}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-ink-2">{topicPath(t.topic)}</span>
                  <span className="font-mono text-ink">{Math.round(t.share * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-sunken">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `var(--t-${t.topic})`, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.06)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${t.share * 100}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Three signals, kept separate */}
      <div className="mt-5 grid grid-cols-3 divide-x divide-line border-y border-line">
        <Signal
          name="Specificity"
          tip="How focused the page is on its top topic: the top topic's share. A detailed comparison is high; a passing mention is low."
          value={profile.topics.length ? <Num value={specificity} format={prob} /> : '—'}
          note="Top-topic share"
        />
        <Signal
          name="Confidence"
          tip="How much to trust our own labels. Calibrated: 0.80 should be right about 80% of the time."
          value={profile.confidence === null ? '—' : <Num value={profile.confidence} format={prob} />}
          note={profile.confidenceNote}
          warn={profile.source !== 'scored' || page.language !== 'en' || !!page.stuffed}
        />
        <Signal
          name="Suitability"
          tip="Page × advertiser. A pass/fail gate with reason codes. Never priced, never overridden."
          value={
            page.flags.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-pos">
                <ShieldCheck size={16} /> <span className="text-[15px]">Suitable</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-neg">
                <ShieldAlert size={16} /> <span className="text-[15px]">Flagged</span>
              </span>
            )
          }
          note={
            page.flags.length ? (
              <span className="flex flex-wrap gap-1">
                {page.flags.map((f) => (
                  <ReasonChip key={f} code={FLAG_REASON[f]} />
                ))}
              </span>
            ) : page.language !== 'en' ? (
              'No risk flags. Language hi-en not yet validated.'
            ) : (
              'No risk flags found.'
            )
          }
        />
      </div>

      {/* Match probability for one campaign */}
      <div className="mt-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink">Match probability for</h3>
          <select
            value={campaign.id}
            onChange={(e) => setMatchFor(e.target.value)}
            aria-label="Campaign for match probability"
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <MatchMeter p={p} threshold={campaign.threshold} confidence={profile.confidence ?? 0} fit={fit?.fit ?? 0} muted={!suit.pass} />
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
          <Tip tip={`${prob(profile.confidence ?? 0)} confidence × ${prob(fit?.fit ?? 0)} fit`}>
            <span className="font-mono text-ink">P(match) = {prob(p)}</span>
          </Tip>
          <BandTag band={p >= 0.8 ? 'specific' : p >= 0.5 ? 'broad' : 'fallback'} muted={!suit.pass} />
          <span className="text-ink-3">
            threshold <span className="font-mono text-ink-2">{prob(campaign.threshold)}</span>
          </span>
          {!suit.pass && <ReasonChip code={suit.reasons[0]} />}
        </div>
        {fit?.topic && (
          <p className="mt-2 text-xs leading-relaxed text-ink-3">
            Best topic: {topicPath(fit.topic.topic).split(' → ').pop()} {Math.round(fit.topic.share * 100)}% → {RELATIONSHIP_LABEL[fit.relationship]} for a{' '}
            {topicPath(campaign.target!).split(' → ').pop()} campaign (closeness {fit.closeness.toFixed(2)}).{' '}
            <Why>
              Fit = closeness × (0.5 + 0.5 × topic share), taking the best topic on the page. Match probability = confidence × fit. In production it is
              learned and calibrated against human-labelled page–campaign pairs; this formula is how we explain it.
            </Why>
          </p>
        )}
      </div>
      <button
        onClick={() => set({ view: 'campaigns' })}
        className="mt-4 text-xs font-medium text-accent-ink hover:underline"
      >
        Edit {campaign.name}'s threshold and preset →
      </button>
    </section>
  )
}

function Signal({ name, tip, value, note, warn }: { name: string; tip: string; value: React.ReactNode; note: React.ReactNode; warn?: boolean }) {
  return (
    <div className="min-w-0 px-3 py-3.5 first:pl-0 last:pr-0">
      <Tip tip={tip}>
        <span className="label cursor-help border-b border-dotted border-ink-4">{name}</span>
      </Tip>
      <div className="mt-1.5 font-mono text-[22px] leading-7 text-ink [&_span]:font-sans">{value}</div>
      <div className={`mt-1 text-[11.5px] leading-snug ${warn ? 'text-warn' : 'text-ink-3'}`}>{note}</div>
    </div>
  )
}

function SourceLine() {
  const { profile } = useApp()
  if (profile.source === 'scored')
    return (
      <Tip tip="Background scoring wrote this profile to a low-latency cache. The ad request only does a lookup." side="bottom">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
          <Database size={12} /> Scored · model {profile.modelVersion} · {profile.scoredAgo} · cache lookup 3 ms <span className="text-ink-4">(simulated)</span>
        </span>
      </Tip>
    )
  if (profile.source === 'section-fallback')
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-warn">
        <CircleDashed size={12} /> Section fallback · page queued for scoring
      </span>
    )
  if (profile.source === 'demo-classifier')
    return <span className="text-xs text-ink-3">Demo classifier · keyword-based stand-in</span>
  return <span className="text-xs text-warn">Site-level fallback</span>
}

function Rescore() {
  const { page, profile, set } = useApp()
  const [step, setStep] = useState<number | null>(null)
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => setStep(null), [page.id])

  if (!page.rescored) return null
  const done = profile.source === 'scored'

  const start = () => {
    setStep(0)
    STEPS.forEach((_, i) => {
      timers.current.push(window.setTimeout(() => setStep(i), i * 520))
    })
    timers.current.push(
      window.setTimeout(() => {
        set((s) => ({ rescored: [...new Set([...s.rescored, page.id])], run: s.run + 1 }))
        setStep(null)
      }, STEPS.length * 520 + 100),
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-line bg-surface px-3.5 py-3">
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink-2">
              <Check size={14} className="mr-1 inline text-pos" />
              Rescored in the background. Profile upgraded from section to page level.
            </span>
            <button onClick={() => set((s) => ({ rescored: s.rescored.filter((x) => x !== page.id), run: s.run + 1 }))} className="shrink-0 text-xs text-ink-3 hover:text-ink">
              Reset
            </button>
          </motion.div>
        ) : step === null ? (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between gap-3">
            <span className="text-[13px] leading-snug text-ink-2">Published 5 minutes ago. The request didn't wait: it used the Mobile section's profile, with lower confidence.</span>
            <button onClick={start} className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-ink">
              <RefreshCw size={14} /> Rescore now
            </button>
          </motion.div>
        ) : (
          <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} aria-live="polite">
            <ol className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <li key={s} className="flex flex-1 items-center gap-2">
                  <span className={`text-xs whitespace-nowrap ${i <= step ? 'text-ink' : 'text-ink-4'}`}>{s}</span>
                  {i < STEPS.length - 1 && (
                    <span className="relative h-px flex-1 bg-line-2">
                      <motion.span
                        className="absolute inset-y-0 left-0 bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: i < step ? '100%' : 0 }}
                        transition={{ duration: 0.45 }}
                      />
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-ink-3">Kafka queue → extract → score → write to cache. Background path only; the ad request never waits.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
