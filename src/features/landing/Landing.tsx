import { animate, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, Play, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Footer } from '../../app/App'
import { useApp } from '../../app/state'
import { BandTag, Logo, MatchMeter, Num, ReasonChip, SimPill, Slider } from '../../components/ui'
import { CAMPAIGNS, getPage } from '../../engine/data'
import type { Campaign, Page } from '../../engine/types'
import { bandOf, decide, DEFAULT_OPTIONS, scaledBid, type CampaignEval, type Decision } from '../../engine/engine'
import { topicPath } from '../../engine/taxonomy'
import { money, pm, prob, prob3 } from '../../lib/format'

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
    <div className="relative min-h-dvh">
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">ContextIQ</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex">
            <SimPill />
          </span>
          <button onClick={openConsole} className="text-sm text-ink-2 hover:text-ink">
            Skip to demo →
          </button>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <div className="grain relative isolate overflow-hidden">
          <div className="aurora" aria-hidden />
          <div className="grid-field" aria-hidden />
          <section className="relative z-10 mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-5 pt-28 pb-20 sm:px-8 sm:pt-36 sm:pb-28 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-center">
            <motion.div
              className="min-w-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
            >
              <div className="label mb-5">A decision layer for contextual ad servers</div>
              <h1 className="max-w-4xl font-serif text-[48px] leading-[1.02] font-normal tracking-[-0.025em] text-ink sm:text-[72px] xl:text-[80px]">
                Quality Score for contextual.
              </h1>
              <p className="mt-7 max-w-2xl text-[18px] leading-relaxed text-ink-2 sm:text-[20px]">
                Contextual advertising shouldn't just decide whether an ad belongs on a page. It should know how sure it is, and price that uncertainty fairly.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button
                  onClick={startGuided}
                  className="inline-flex items-center gap-2 rounded-lg bg-cta px-5 py-3 text-[15px] font-medium text-white shadow-[0_8px_24px_-6px_rgb(22_125_141/0.55)] transition-transform hover:-translate-y-px hover:bg-cta-hover"
                >
                  <Play size={16} /> Start the demo
                </button>
                <button
                  onClick={openConsole}
                  className="inline-flex items-center gap-2 rounded-lg border border-line-2 bg-surface/70 px-5 py-3 text-[15px] font-medium text-ink backdrop-blur hover:bg-surface"
                >
                  Open the console <ArrowRight size={16} />
                </button>
                <span className="text-sm text-ink-3">90 seconds, guided. Explore freely any time.</span>
              </div>
            </motion.div>
            <motion.div
              className="mx-auto w-full max-w-md min-w-0 lg:max-w-none"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.15,
                ease: [0.2, 0.7, 0.2, 1],
              }}
            >
              <HeroStage examples={examples} />
            </motion.div>
          </section>
        </div>

        {/* Beat 1 */}
        <section className="relative isolate overflow-hidden border-t border-line">
          <div className="aurora -scale-x-100" aria-hidden />
          <div className="grid-field" aria-hidden />
          <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-8 sm:py-24">
            <Eyebrow n="01">The problem</Eyebrow>
            <motion.h2 {...fade} className="max-w-3xl font-serif text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[48px]">
              Three pages. Same keywords. Very different value.
            </motion.h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3">
              {examples.map(({ page, d, e }, i) => (
                <motion.article key={page.id} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }} className="relative flex flex-col bg-surface p-6">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-[3px]"
                    style={{
                      background: !e.suitability.pass ? 'var(--neg)' : d.winner?.band === 'specific' ? 'var(--band-specific)' : 'var(--spectrum)',
                    }}
                  />
                  <div className="text-xs text-ink-3">{page.publication}</div>
                  <h3 className="mt-2 font-serif text-[21px] leading-snug text-ink">{page.title}</h3>
                  <div className="mt-4 text-xs text-ink-3">A classifier sees</div>
                  <div className="mt-1 text-[13px] text-ink-2">
                    {page.profile.topics.map((t) => `${topicPath(t.topic).split(' → ').slice(-1)[0]} ${Math.round(t.share * 100)}%`).join(' · ')}, confidence{' '}
                    {prob(page.profile.confidence!)}
                  </div>
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
                            <span className="font-mono">P(match) {pm(d.winner.pMatch, d.winner.campaign.threshold)}</span>
                          </div>
                          <p className="mt-2 text-[13px] text-ink-2">
                            {d.winner.provenance === 'protected'
                              ? 'Strong, specific match. Strict sells it today, so it keeps its full bid.'
                              : d.winner.band === 'specific'
                                ? 'Strong, specific match. Worth close to full price.'
                                : 'Real but partial match Strict would leave unsold. Worth something, not full price.'}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline justify-between">
                            <span className="text-sm text-ink">{e.campaign.name}</span>
                            <ReasonChip code={e.reason!} />
                          </div>
                          <p className="mt-2 text-[13px] text-ink-2">
                            Confident ({prob(page.profile.confidence!)}), relevant (P {pm(e.pMatch)}), and still unsuitable. Excluded regardless of match.
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
        <section className="relative isolate overflow-hidden border-t border-line">
          <div className="aurora" aria-hidden />
          <div className="grid-field" aria-hidden />
          <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <Eyebrow n="02">The idea</Eyebrow>
              <motion.h2 {...fade} className="font-serif text-[34px] leading-[1.1] tracking-[-0.02em] sm:text-[48px]">
                Today, an ad server says yes or no. ContextIQ asks: <em>how good, and how sure?</em>
              </motion.h2>
            </div>
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
                      <MatchMeter p={nova.pMatch} threshold={nova.campaign.threshold} compact muted={!nova.suitability.pass} />
                      <div className="mt-1.5 flex items-center gap-2 font-mono text-xs text-ink-2">
                        {nova.suitability.pass ? (
                          <>
                            P {pm(nova.pMatch, nova.campaign.threshold)} ·{' '}
                            {bandOf(nova.pMatch) === 'specific' ? 'Specific' : bandOf(nova.pMatch) === 'broad' ? 'Broad' : 'Fallback'}
                          </>
                        ) : (
                          <ReasonChip code={nova.reason!} />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </motion.div>
          </div>
        </section>

        {/* Beat 3 */}
        <PriceBeat onStart={startGuided} onConsole={openConsole} examples={examples} />
      </main>
      <Footer />
    </div>
  )
}

type Example = { page: Page; d: Decision; s: Decision; e: CampaignEval }

/** Nova Phones' match probability on each example page: the same numbers the cards above show. */
function novaOn(page: Page) {
  return decide(page, page.profile, CAMPAIGNS, 'contextiq', DEFAULT_OPTIONS, false).evals.find((x) => x.campaign.id === 'nova')!
}

/**
 * One campaign in the "Price the uncertainty" widget. On an example page it shows the engine's own result for that
 * campaign (its own P(match), protection and reason code); when the slider is dragged free, it prices the dragged P(match).
 */
function PriceRow({ campaign: c, label, p, e, accent = false }: { campaign: Campaign; label: string; p: number; e?: CampaignEval; accent?: boolean }) {
  const curve = (x: number) => (c.preset === 'broad' ? `(0.5 + 0.5 × ${prob3(x)})` : prob3(x))
  let detail: React.ReactNode
  let value: React.ReactNode
  const big = `font-mono text-2xl ${accent ? 'text-accent-ink' : 'text-ink'}`
  if (e) {
    if (e.provenance === 'protected') {
      detail = <>P {pm(e.pMatch, c.threshold)} · Strict eligible · protected at full {money(c.baseBid)}</>
      value = <Num value={e.bid!} format={money} className={big} />
    } else if (e.bid !== null && e.reason !== 'BELOW-FLOOR') {
      detail = (
        <>
          {money(c.baseBid)} × {curve(e.pMatch)} = {money(e.bid)}, min {prob(c.threshold)}
        </>
      )
      value = <Num value={e.bid} format={money} className={big} />
    } else {
      detail = (
        <>
          P {pm(e.pMatch, c.threshold)}, min {prob(c.threshold)}
        </>
      )
      value = <ReasonChip code={e.reason ?? 'BELOW-THRESHOLD'} />
    }
  } else {
    const ok = p >= c.threshold - 1e-9
    detail = (
      <>
        {money(c.baseBid)} × {curve(p)}
        {ok ? ` = ${money(scaledBid(c, p))}` : ''}, min {prob(c.threshold)}
      </>
    )
    value = ok ? <Num value={scaledBid(c, p)} format={money} className={big} /> : <ReasonChip code="BELOW-THRESHOLD" />
  }
  return (
    <div className="flex items-baseline justify-between gap-3 py-3.5">
      <div className="min-w-0">
        <div className="text-sm text-ink">{label}</div>
        <div className="font-mono text-xs text-ink-3">{detail}</div>
      </div>
      <div className="shrink-0">{value}</div>
    </div>
  )
}

function PriceBeat({ onStart, onConsole, examples }: { onStart: () => void; onConsole: () => void; examples: Example[] }) {
  const presets = useMemo(
    () =>
      examples.map(({ page, d }) => ({
        id: page.id,
        title: page.title,
        p: novaOn(page).pMatch,
        /** Each campaign's own engine result on this page: its own P(match), bid, provenance and reason code. */
        nova: d.evals.find((x) => x.campaign.id === 'nova')!,
        volt: d.evals.find((x) => x.campaign.id === 'volt')!,
      })),
    [examples],
  )
  const [p, setP] = useState(() => presets.find((x) => x.id === 'P2')?.p ?? presets[0].p)
  const nova = CAMPAIGNS.find((c) => c.id === 'nova')!
  const volt = CAMPAIGNS.find((c) => c.id === 'volt')!
  const active = presets.find((x) => Math.abs(x.p - p) < 1e-9)
  return (
    <section className="relative isolate overflow-hidden border-t border-line">
      <div className="aurora -scale-x-100" aria-hidden />
      <div className="grid-field" aria-hidden />
      <div className="relative z-10 mx-auto grid max-w-[1200px] gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <Eyebrow n="03">The mechanism</Eyebrow>
          <motion.h2 {...fade} className="font-serif text-[40px] leading-[1.05] tracking-[-0.02em] sm:text-[56px]">
            Price the uncertainty.
          </motion.h2>
          <motion.p {...fade} className="mt-5 max-w-md text-[17px] leading-relaxed text-ink-2">
            Match probability = confidence × fit. Suitability is a hard gate. Pages Strict already sells keep their full bid. On everything else, the advertiser's
            threshold decides eligibility and the bid scales with the match.
          </motion.p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onStart}
              className="inline-flex items-center gap-2 rounded-lg bg-cta px-5 py-3 text-[15px] font-medium text-white hover:bg-cta-hover"
            >
              <Play size={16} /> Start the demo
            </button>
            <button
              onClick={onConsole}
              className="inline-flex items-center gap-2 rounded-lg border border-line-2 px-5 py-3 text-[15px] font-medium text-ink hover:bg-sunken"
            >
              Open the console <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <motion.div {...fade} className="rounded-xl border border-line bg-surface p-6 shadow-soft">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-3">Match probability</span>
            <span className="font-mono text-2xl text-ink">{pm(p, nova.threshold)}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Nova Phones on the example pages">
            {presets.map((x) => (
              <button
                key={x.id}
                onClick={() => setP(x.p)}
                aria-pressed={active?.id === x.id}
                className={`rounded-full border px-2.5 py-1 text-xs ${active?.id === x.id ? 'border-cta bg-cta-soft text-cta-ink' : 'border-line-2 text-ink-2 hover:bg-sunken'}`}
              >
                <span className="font-mono">{x.id}</span> · {pm(x.p, nova.threshold)}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <MatchMeter p={p} threshold={nova.threshold} />
          </div>
          <div className="mt-2">
            <Slider
              label="Match probability"
              value={p}
              min={0}
              max={1}
              step={0.001}
              onChange={(v) => setP(Math.round(v * 1000) / 1000)}
              format={(v) => pm(v, nova.threshold)}
            />
          </div>
          <div className="mt-5 divide-y divide-line border-t border-line">
            <PriceRow campaign={nova} label="Nova Phones · Balanced" p={p} e={active?.nova} accent />
            <PriceRow campaign={volt} label="Volt Accessories · Broad reach" p={p} e={active?.volt} />
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {active
              ? `${active.id}, ${active.title}: each campaign's own match probability and outcome, straight from the engine.`
              : 'Dragging prices one hypothetical match probability for both campaigns.'}{' '}
            The curve prices only the matches Strict would leave unsold; pages Strict already sells, like P1, keep their full bid.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

function Eyebrow({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3 font-mono text-xs text-ink-3">
      <span className="font-medium text-ink">{n}</span>
      <span className="h-px w-8 bg-line-2" />
      <span className="tracking-wide uppercase">{children}</span>
    </div>
  )
}

/* ---------- Hero: the product itself, deciding live on the three example pages ---------- */
function HeroStage({ examples }: { examples: Example[] }) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(() => Math.max(0, examples.findIndex((x) => x.page.id === 'P2')))
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    if (reduce || paused) return
    const t = window.setInterval(() => setI((x) => (x + 1) % examples.length), 3600)
    return () => window.clearInterval(t)
  }, [reduce, paused, examples.length])

  const { page, e: ev, s } = examples[i]
  const c = ev.campaign
  const p = useAnimated(ev.pMatch, !!reduce)
  const excluded = !ev.suitability.pass
  const bid = ev.bid ?? 0
  const priced = !excluded && ev.bid !== null
  const isProtected = ev.provenance === 'protected'
  const strictSide = s.winner ? `${s.winner.campaign.kind === 'ron' ? 'run-of-network' : s.winner.campaign.name} ${money(s.price)}` : 'unsold'
  const d = examples[i].d
  const ciqSide = d.winner
    ? `${d.winner.campaign.name} ${money(d.price)}, ${d.winner.provenance === 'protected' ? 'protected' : d.winner.band === 'specific' ? 'Specific' : d.winner.band === 'broad' ? 'Broad' : 'Fallback'}`
    : excluded
      ? 'unsold, suitability'
      : 'unsold'

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* glow */}
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_40%,var(--aurora-a),transparent_70%)] blur-2xl" />
      {/* stacked card behind */}
      <div
        aria-hidden
        className="absolute inset-x-6 -top-3 bottom-6 -z-10 rotate-[-2.5deg] rounded-2xl border border-line bg-surface/60 shadow-soft backdrop-blur"
      />
      <div className="ring-gradient rounded-2xl bg-surface/95 p-5 backdrop-blur shadow-[0_30px_60px_-20px_rgb(20_30_80/0.25)] sm:p-6 lg:[transform:perspective(1400px)_rotateY(-6deg)_rotateX(2deg)]">
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-2 text-ink-2">
            <span className="pulse-dot h-2 w-2 rounded-full bg-pos" /> Live decision
          </span>
          <span className="rounded-full bg-sunken px-2 py-0.5 text-ink-2">{c.name}</span>
        </div>

        <div className="mt-4 min-h-[64px]">
          <motion.div key={page.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="text-[11px] text-ink-3">
              <span className="font-mono text-ink-4">{page.id}</span> · {page.publication}
            </div>
            <div className="mt-1 font-serif text-[19px] leading-snug text-ink">{page.title}</div>
          </motion.div>
        </div>

        {/* Spectrum: where each page sits */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink-3">P(match)</span>
            <span className="font-mono text-[28px] leading-none text-ink tnum">{pm(p, c.threshold)}</span>
          </div>
          <div className="relative mt-5 mb-7">
            <div className="spectrum h-2.5 rounded-full" />
            {[0.5, 0.8].map((t) => (
              <span key={t} className="absolute top-[-3px] h-4 w-px bg-surface/90" style={{ left: `${t * 100}%` }} aria-hidden />
            ))}
            {/* threshold */}
            <span
              className="absolute -top-2 h-[26px] w-0.5 rounded bg-ink transition-[left] duration-500"
              style={{ left: `calc(${c.threshold * 100}% - 1px)` }}
              aria-hidden
            />
            {examples.map((x, k) => {
              const xp = x.e.pMatch
              const on = k === i
              const out = !x.e.suitability.pass
              return (
                <button
                  key={x.page.id}
                  onClick={() => setI(k)}
                  aria-label={`${x.page.id}: P(match) ${pm(xp)}`}
                  className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${xp * 100}%` }}
                >
                  <span
                    className={`block rounded-full border-2 transition-all duration-300 ${on ? 'h-5 w-5 border-surface shadow-[0_0_0_4px_rgb(47_91_255/0.25)]' : 'h-3 w-3 border-surface opacity-70'} ${out ? 'bg-neg' : 'bg-ink'}`}
                  />
                  <span className={`absolute top-6 left-1/2 -translate-x-1/2 font-mono text-[10px] ${on ? 'text-ink' : 'text-ink-4'}`}>{x.page.id}</span>
                </button>
              )
            })}
          </div>
          <div className="relative h-3 text-[10px] text-ink-4">
            <span className="absolute left-0">Fallback</span>
            <span className="absolute left-1/2 pl-1">Broad</span>
            <span className="absolute left-[80%] pl-1">Specific</span>
          </div>
        </div>

        {/* Full bid vs what this page is worth */}
        <div className="mt-5 border-t border-line pt-4">
          {priced ? (
            <>
              <div className="flex items-baseline justify-between text-xs text-ink-3">
                <span>
                  Pays <span className="font-mono text-[22px] text-ink">{money(bid)}</span> of {money(c.baseBid)} base
                </span>
                <BandTag band={ev.band} />
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,var(--sunken)_0_6px,var(--line)_6px_7px)]">
                <motion.div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--violet))]"
                  initial={false}
                  animate={{ width: `${(bid / c.baseBid) * 100}%` }}
                  transition={{
                    duration: reduce ? 0 : 0.6,
                    ease: [0.2, 0.7, 0.2, 1],
                  }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-pos">
                {isProtected
                  ? 'Protected: Strict sells this page today, so the bid stays full'
                  : `New demand: publisher earns ${money(bid)} that Strict leaves unsold`}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
                <span>Never priced: suitability comes first</span>
                {ev.reason && <ReasonChip code={ev.reason} />}
              </div>
              <div className="mt-2 h-2 rounded-full bg-[repeating-linear-gradient(135deg,var(--neg-soft)_0_6px,transparent_6px_10px)] ring-1 ring-neg/30" />
              <div className="mt-1.5 text-[11px] text-neg">Confident and relevant, still excluded</div>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-sunken px-3 py-2 font-mono text-[11px]">
          <span className="text-ink-3">Strict:</span>
          <span className="text-ink-2">{strictSide}</span>
          <span className="text-ink-4">→</span>
          <span className="text-ink-3">ContextIQ:</span>
          <span className="text-ink">{ciqSide}</span>
        </div>
      </div>
    </div>
  )
}

function useAnimated(target: number, reduce: boolean) {
  const [v, setV] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (reduce) {
      setV(target)
      from.current = target
      return
    }
    const ctrl = animate(from.current, target, {
      duration: 0.7,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (x) => {
        from.current = x
        setV(x)
      },
    })
    return () => ctrl.stop()
  }, [target, reduce])
  return v
}
