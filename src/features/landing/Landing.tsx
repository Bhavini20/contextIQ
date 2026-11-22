import { motion } from 'framer-motion'
import { ArrowRight, Check, Play, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Footer } from '../../app/App'
import { useApp } from '../../app/state'
import { BandTag, Logo, MatchMeter, Num, ReasonChip, SimPill, Slider } from '../../components/ui'
import { CAMPAIGNS, getPage } from '../../engine/data'
import { bandOf, decide, DEFAULT_OPTIONS, scaledBid } from '../../engine/engine'
import { topicPath } from '../../engine/taxonomy'
import { money, prob } from '../../lib/format'

const fade = {
  initial: { y: 14 },
  whileInView: { y: 0 },
  viewport: { once: true, amount: 0.15 },
  transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] as const },
}

export function Landing() {
  const { set } = useApp()
  const startGuided = () => set({ guided: 2 })
  const openConsole = () => set({ view: 'pages' })

  const examples = useMemo(
    () =>
      ['P1', 'P2', 'P3'].map((id) => {
        const page = getPage(id)!
        const d = decide(page, page.profile, CAMPAIGNS, 'contextiq', DEFAULT_OPTIONS, false)
        const s = decide(page, page.profile, CAMPAIGNS, 'strict', DEFAULT_OPTIONS, false)
        const target = id === 'P3' ? 'payzen' : 'nova'
        const e = d.evals.find((x) => x.campaign.id === target)!
        return { page, d, s, e }
      }),
    [],
  )

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">ContextIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <SimPill className="hidden sm:inline-flex" />
          <button onClick={openConsole} className="text-sm text-ink-2 hover:text-ink">
            Skip to demo →
          </button>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto max-w-[1200px] px-5 pt-14 pb-20 sm:px-8 sm:pt-24 sm:pb-28">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}>
            <div className="label mb-5">A decision layer for contextual ad servers</div>
            <h1 className="max-w-4xl font-serif text-[48px] leading-[1.02] font-normal tracking-[-0.025em] text-ink sm:text-[80px]">
              Quality Score for contextual.
            </h1>
            <p className="mt-7 max-w-2xl text-[18px] leading-relaxed text-ink-2 sm:text-[20px]">
              Contextual advertising shouldn't just decide whether an ad belongs on a page. It should know how sure it is, and price that uncertainty fairly.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <button onClick={startGuided} className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-on-accent shadow-soft hover:bg-accent-ink">
                <Play size={16} /> Start the demo
              </button>
              <button onClick={openConsole} className="inline-flex items-center gap-2 rounded-lg border border-line-2 px-5 py-3 text-[15px] font-medium text-ink hover:bg-sunken">
                Open the console <ArrowRight size={16} />
              </button>
              <span className="text-sm text-ink-3">90 seconds, guided. Explore freely any time.</span>
            </div>
          </motion.div>
        </section>

        {/* Beat 1 */}
        <section className="border-t border-line">
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-24">
            <motion.h2 {...fade} className="max-w-3xl font-serif text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[48px]">
              Three pages. Same keywords. Very different value.
            </motion.h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
              {examples.map(({ page, d, e }, i) => (
                <motion.article key={page.id} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }} className="flex flex-col bg-surface p-6">
                  <div className="text-xs text-ink-3">{page.publication}</div>
                  <h3 className="mt-2 font-serif text-[21px] leading-snug text-ink">{page.title}</h3>
                  <div className="mt-4 text-xs text-ink-3">A classifier sees</div>
                  <div className="mt-1 text-[13px] text-ink-2">{page.profile.topics.map((t) => `${topicPath(t.topic).split(' → ').slice(-1)[0]} ${Math.round(t.share * 100)}%`).join(' · ')}, confidence {prob(page.profile.confidence!)}</div>
                  <div className="mt-auto pt-6">
                    <div className="border-t border-line pt-4">
                      {d.winner && d.winner.campaign.kind === 'contextual' ? (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm text-ink">{d.winner.campaign.name}</span>
                            <span className="font-mono text-xl text-ink">{money(d.price)}</span>
                          </div>
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-3">
                            <BandTag band={d.winner.band} />
                            <span className="font-mono">P(match) {prob(d.winner.pMatch)}</span>
                          </div>
                          <p className="mt-2 text-[13px] text-ink-2">
                            {d.winner.band === 'specific' ? 'Strong, specific match. Worth close to full price.' : 'Real but partial match. Worth something, not full price.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm text-ink">{e.campaign.name}</span>
                            <ReasonChip code={e.reason!} />
                          </div>
                          <p className="mt-2 text-[13px] text-ink-2">
                            Confident ({prob(page.profile.confidence!)}), relevant (P {prob(e.pMatch)}), and still unsuitable. Excluded regardless of match.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        {/* Beat 2 */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <motion.h2 {...fade} className="font-serif text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[48px]">
              Today, an ad server says yes or no. ContextIQ asks: <em>how good, and how sure?</em>
            </motion.h2>
            <motion.div {...fade} className="divide-y divide-line border-y border-line">
              <div className="grid grid-cols-[1fr_88px_1.3fr] gap-4 py-2 text-[11px] text-ink-3">
                <span>Page</span>
                <span>Strict (today)</span>
                <span>ContextIQ, Nova Phones</span>
              </div>
              {examples.map(({ page, s }) => {
                const nova = decide(page, page.profile, CAMPAIGNS, 'contextiq', DEFAULT_OPTIONS, false).evals.find((x) => x.campaign.id === 'nova')!
                const strictYes = s.evals.find((x) => x.campaign.id === 'nova')!.bid !== null
                return (
                  <div key={page.id} className="grid grid-cols-[1fr_88px_1.3fr] items-center gap-4 py-4">
                    <span className="line-clamp-2 text-sm text-ink-2">{page.title}</span>
                    <span className={`inline-flex items-center gap-1 text-sm ${strictYes ? 'text-ink' : 'text-ink-3'}`}>
                      {strictYes ? <Check size={14} /> : <X size={14} />} {strictYes ? 'Yes' : 'No'}
                    </span>
                    <div>
                      <MatchMeter p={nova.pMatch} threshold={0.6} compact muted={!nova.suitability.pass} />
                      <div className="mt-1.5 flex items-center gap-2 font-mono text-xs text-ink-2">
                        {nova.suitability.pass ? <>P {prob(nova.pMatch)} · {bandOf(nova.pMatch) === 'specific' ? 'Specific' : bandOf(nova.pMatch) === 'broad' ? 'Broad' : 'Fallback'}</> : <ReasonChip code={nova.reason!} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </div>
        </section>

        {/* Beat 3 */}
        <PriceBeat onStart={startGuided} onConsole={openConsole} />
      </main>
      <Footer />
    </div>
  )
}

function PriceBeat({ onStart, onConsole }: { onStart: () => void; onConsole: () => void }) {
  const [p, setP] = useState(0.64)
  const nova = CAMPAIGNS.find((c) => c.id === 'nova')!
  const volt = CAMPAIGNS.find((c) => c.id === 'volt')!
  const eligible = p >= nova.threshold - 1e-9
  return (
    <section className="border-t border-line">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <motion.h2 {...fade} className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[56px]">
            Price the uncertainty.
          </motion.h2>
          <motion.p {...fade} className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-2">
            Match probability = confidence × fit. Suitability is a hard gate. The advertiser's threshold decides eligibility, and the bid scales with the match.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onStart} className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-[15px] font-medium text-on-accent hover:bg-accent-ink">
              <Play size={16} /> Start the demo
            </button>
            <button onClick={onConsole} className="inline-flex items-center gap-2 rounded-lg border border-line-2 px-5 py-3 text-[15px] font-medium text-ink hover:bg-sunken">
              Open the console <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <motion.div {...fade} className="rounded-xl border border-line bg-surface p-6 shadow-soft">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-3">Match probability</span>
            <span className="font-mono text-2xl text-ink">{prob(p)}</span>
          </div>
          <div className="mt-3">
            <MatchMeter p={p} threshold={nova.threshold} />
          </div>
          <div className="mt-2">
            <Slider label="Match probability" value={p} min={0} max={1} step={0.01} onChange={setP} format={prob} />
          </div>
          <div className="mt-5 divide-y divide-line border-t border-line">
            <div className="flex items-baseline justify-between py-3.5">
              <div>
                <div className="text-sm text-ink">Nova Phones · Balanced</div>
                <div className="font-mono text-xs text-ink-3">$4.00 × P(match), min 0.60</div>
              </div>
              {eligible ? (
                <Num value={scaledBid(nova, p)} format={money} className="font-mono text-2xl text-accent-ink" />
              ) : (
                <ReasonChip code="BELOW-THRESHOLD" />
              )}
            </div>
            <div className="flex items-baseline justify-between py-3.5">
              <div>
                <div className="text-sm text-ink">Volt Accessories · Broad reach</div>
                <div className="font-mono text-xs text-ink-3">$2.50 × (0.5 + 0.5 × P), min 0.40</div>
              </div>
              {p >= volt.threshold - 1e-9 ? (
                <Num value={scaledBid(volt, p)} format={money} className="font-mono text-2xl text-ink" />
              ) : (
                <ReasonChip code="BELOW-THRESHOLD" />
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">Drag it. Illustrative campaigns; the console runs the full engine.</p>
        </motion.div>
      </div>
    </section>
  )
}
