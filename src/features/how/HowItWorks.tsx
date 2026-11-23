import { useReducedMotion } from 'framer-motion'
import { useApp } from '../../app/state'
import { SectionTitle } from '../../components/ui'
import { topicName } from '../../engine/taxonomy'

const BG = ['Page discovered', 'Kafka queue', 'Extract', 'Score', 'Cache']
const BG_SUB = ['first request or push', 'retries, dead-letter', 'title, body, metadata', 'labels + three signals', 'low-latency key-value']
const RT = ['Ad request', 'Cache lookup', 'Gate', 'Threshold + price', 'Auction', 'Log']
const RT_SUB = ['publisher + page IDs', '≈3 ms', 'suitability first', 'per campaign', 'floors, deals, timeouts', 'signal version, outcome']

export function HowItWorks() {
  const { page, profile, set } = useApp()
  const reduce = useReducedMotion()

  return (
    <div>
      <SectionTitle eyebrow="How it works" title="Expensive thinking in the background. A fast lookup in the request.">
        An ad decision has a budget of milliseconds, so no model ever runs inside the request path. Pages are scored once in the background and looked up
        when an ad request arrives.
      </SectionTitle>
      <span className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-ink-3">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-4" /> Production design, not running in this demo
      </span>

      {/* Desktop diagram */}
      <div className="mt-8 hidden rounded-xl border border-line bg-surface p-6 md:block">
        <svg viewBox="0 0 1000 350" width="100%" role="img" aria-label="Two-path architecture diagram">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-4)" />
            </marker>
          </defs>
          <text x="0" y="18" fontSize="12" fill="var(--ink-3)" letterSpacing="0.06em">PATH A · BACKGROUND PAGE INTELLIGENCE · seconds to minutes</text>
          <text x="0" y="342" fontSize="12" fill="var(--accent-ink)" letterSpacing="0.06em">PATH B · REAL-TIME DECISION · a few ms, no model</text>

          {/* Path A */}
          <path id="pathA" d="M 90 80 L 880 80" stroke="var(--line-2)" strokeWidth="2" fill="none" />
          {BG.map((s, i) => {
            const x = 90 + i * (790 / 4)
            return (
              <g key={s}>
                <rect x={x - 78} y={52} width={156} height={56} rx={10} fill="var(--paper)" stroke={i === 3 ? 'var(--ink-3)' : 'var(--line-2)'} />
                <text x={x} y={77} fontSize="14" textAnchor="middle" fill="var(--ink)" fontWeight="500">{s}</text>
                <text x={x} y={95} fontSize="10.5" textAnchor="middle" fill="var(--ink-3)">{BG_SUB[i]}</text>
              </g>
            )
          })}
          <text x={90 + 3 * (790 / 4)} y={128} fontSize="10.5" textAnchor="middle" fill="var(--ink-3)">models run here only</text>

          {/* Cache link */}
          <path d="M 880 108 L 880 150 L 302 150 L 302 252" stroke="var(--line-2)" strokeWidth="2" strokeDasharray="4 4" fill="none" markerEnd="url(#arrow)" />
          <text x="590" y="168" fontSize="10.5" textAnchor="middle" fill="var(--ink-3)">page profile: model version, timestamp, content hash, expiry</text>
          <text x="590" y="186" fontSize="10.5" textAnchor="middle" fill="var(--ink-2)" fontStyle="italic">written once, read on every request</text>

          {/* Path B */}
          <path id="pathB" d="M 90 280 L 910 280" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="2" fill="none" />
          {RT.map((s, i) => {
            const x = 90 + i * (820 / 5)
            return (
              <g key={s}>
                <rect x={x - 72} y={252} width={144} height={56} rx={10} fill="var(--accent-soft)" stroke="var(--accent)" strokeOpacity={0.4} />
                <text x={x} y={277} fontSize="14" textAnchor="middle" fill="var(--ink)" fontWeight="500">{s}</text>
                <text x={x} y={295} fontSize="10.5" textAnchor="middle" fill="var(--ink-3)">{RT_SUB[i]}</text>
              </g>
            )
          })}

          {!reduce && (
            <>
              {[0, 1.5, 3].map((b) => (
                <circle key={`a${b}`} r="4" fill="var(--ink-3)">
                  <animateMotion dur="4.5s" begin={`${b}s`} repeatCount="indefinite" path="M 90 80 L 880 80" />
                </circle>
              ))}
              {/* Hand-off: every 4.5 s, when a scored page lands in the cache, one profile travels to the lookup, which lights up. */}
              <circle r="4" fill="var(--ink-3)" opacity="0">
                <animateMotion dur="4.5s" begin="4.5s" repeatCount="indefinite" path="M 880 108 L 880 150 L 302 150 L 302 252" keyPoints="0;1;1" keyTimes="0;0.4;1" calcMode="linear" />
                <animate attributeName="opacity" dur="4.5s" begin="4.5s" repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.4;0.42;1" />
              </circle>
              <rect x={90 + 164 - 72} y={252} width={144} height={56} rx={10} fill="none" stroke="var(--accent)" strokeWidth={2} opacity="0">
                <animate attributeName="opacity" dur="4.5s" begin="4.5s" repeatCount="indefinite" values="0;0;1;0;0" keyTimes="0;0.38;0.44;0.75;1" />
              </rect>
              {[0, 0.3, 0.6, 0.9].map((b) => (
                <circle key={`b${b}`} r="4" fill="var(--accent)">
                  <animateMotion dur="1.2s" begin={`${b}s`} repeatCount="indefinite" path="M 90 280 L 910 280" />
                </circle>
              ))}
            </>
          )}
        </svg>
      </div>

      {/* Mobile: stacked lists */}
      <div className="mt-8 grid gap-6 md:hidden">
        {[
          { title: 'Path A · Background', steps: BG, subs: BG_SUB, accent: false },
          { title: 'Path B · Real-time, no model', steps: RT, subs: RT_SUB, accent: true },
        ].map((p) => (
          <div key={p.title}>
            <div className={`label mb-2 ${p.accent ? 'text-accent-ink' : ''}`}>{p.title}</div>
            <ol className="space-y-0 border-l border-line-2 pl-4">
              {p.steps.map((s, i) => (
                <li key={s} className="relative py-2">
                  <span className={`absolute top-3.5 -left-[21px] h-2 w-2 rounded-full ${p.accent ? 'bg-accent' : 'bg-ink-4'}`} />
                  <div className="text-sm font-medium text-ink">{s}</div>
                  <div className="text-xs text-ink-3">{p.subs[i]}</div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.01em]">When a page hasn't been scored yet</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            The request never waits. ContextIQ uses the freshest section- or site-level profile, marks it as a fallback and lowers confidence. If nothing
            reliable exists, it makes no confidence claim and existing rules apply. The page is queued and scored for the next request.
          </p>
          <button onClick={() => set({ view: 'pages', pageId: 'P4' })} className="mt-2 text-sm font-medium text-cta-ink hover:underline">
            See it on P4, then press Rescore now →
          </button>

          <h3 className="mt-8 text-lg font-semibold tracking-[-0.01em]">Who applies the pricing</h3>
          <dl className="mt-3 divide-y divide-line border-y border-line text-sm">
            <div className="grid grid-cols-[150px_1fr] gap-4 py-3">
              <dt className="text-ink">Media.net-controlled demand</dt>
              <dd className="text-ink-2">Gate, threshold and bid scaling applied directly. The pilot. No partner integration needed.</dd>
            </div>
            <div className="grid grid-cols-[150px_1fr] gap-4 py-3">
              <dt className="text-ink">Outside buyers (DSPs)</dt>
              <dd className="text-ink-2">Standard content categories plus an opt-in extension. The buyer decides how to bid. Their bids are never rewritten.</dd>
            </div>
          </dl>

          <h3 className="mt-8 text-lg font-semibold tracking-[-0.01em]">Handled in the pipeline, not simulated here</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li><span className="text-ink">Paywalls and late-loading pages:</span> use permitted metadata or publisher-supplied content; mark lower confidence.</li>
            <li><span className="text-ink">Comment sections:</span> score the editorial body separately; apply suitability to comments where they change the page's tone.</li>
            <li><span className="text-ink">Duplicate URLs and tracking parameters:</span> canonicalise and dedupe by content hash, without merging genuinely different pages.</li>
            <li><span className="text-ink">Breaking news:</span> content hash and short expiry; priority rescans; labels invalidated on material change.</li>
          </ul>
        </div>

        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-[-0.01em]">What outside buyers receive</h3>
          <p className="mt-2 text-sm text-ink-2">
            Categories travel in the standard OpenRTB 2.6 fields buyers already read. Match quality has no standard field, so it rides in a versioned,
            opt-in <code className="font-mono text-[13px]">ext</code> object. Buyers who ignore it see a normal request. Live for the selected page:{' '}
            <span className="text-ink">{page.id === 'custom' ? 'your article' : page.id}</span>.
          </p>
          <OpenRtb page={page} profile={profile} />
          <p className="mt-2 text-xs text-ink-3">
            Category IDs are illustrative. Source: IAB Tech Lab OpenRTB 2.6 (<code className="font-mono">site.cat</code>, <code className="font-mono">site.pagecat</code>,{' '}
            <code className="font-mono">site.content.cat</code>, <code className="font-mono">cattax</code>).
          </p>
        </div>
      </div>
    </div>
  )
}

const CAT_ID: Record<string, string> = {
  technology: '596', mobile: '632', smartphones: '640', tablets: '641', computing: '599', laptops: '628',
  finance: '391', payments: '403', 'digital-wallets': '404', 'personal-finance': '397',
  travel: '653', flights: '661', hotels: '664', health: '223', running: '237', lifestyle: '210', 'urban-living': '216',
}

function OpenRtb({ page, profile }: { page: ReturnType<typeof useApp>['page']; profile: ReturnType<typeof useApp>['profile'] }) {
  const cats = profile.topics.map((t) => `"${CAT_ID[t.topic]}"`).join(', ')
  const K = (s: string) => <span className="text-accent-ink">"{s}"</span>
  const S = (s: string) => <span className="text-pos">"{s}"</span>
  const N = (n: number | string) => <span className="text-warn">{n}</span>
  const C = (s: string) => <span className="text-ink-4">{s}</span>
  const slug = page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
  return (
    <pre className="mt-4 overflow-x-auto rounded-xl border border-line bg-sunken p-4 font-mono text-[12.5px] leading-[1.7] text-ink-2">
      <code>
        {'{\n  '}{K('site')}{': {\n    '}
        {K('page')}{': '}{S(`https://${page.publication.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example/${slug}`)}{',\n    '}
        {K('cattax')}{': '}{N(2)}{',  '}{C('// AdCOM list: IAB Tech Lab Content Taxonomy 2.0')}{'\n    '}
        {K('cat')}{': ['}{cats}{'],\n    '}
        {K('pagecat')}{': ['}{cats}{'],\n    '}
        {K('content')}{': { '}{K('cat')}{': ['}{cats}{'], '}{K('language')}{': '}{S(page.language === 'hi-en' ? 'hi' : 'en')}{' },\n    '}
        {K('ext')}{': {\n      '}{K('contextiq')}{': {\n        '}
        {K('ver')}{': '}{S('1.0')}{',\n        '}
        {K('topics')}{': ['}
        {profile.topics.map((t, i) => (
          <span key={t.topic}>
            {i ? ', ' : ''}
            {'{ '}{K('id')}{': '}{S(topicName(t.topic))}{', '}{K('share')}{': '}{N(t.share.toFixed(2))}{' }'}
          </span>
        ))}
        {'],\n        '}
        {K('specificity')}{': '}{N((profile.topics[0]?.share ?? 0).toFixed(2))}{',\n        '}
        {K('confidence')}{': '}{profile.confidence === null ? N('null') : N(profile.confidence.toFixed(2))}{',\n        '}
        {K('suitability')}{': { '}{K('flags')}{': ['}{page.flags.map((f) => `"${f}"`).join(', ')}{'] },\n        '}
        {K('source')}{': '}{S(profile.source)}{', '}{K('model')}{': '}{S(profile.modelVersion)}{'\n      }\n    }\n  }\n}'}
      </code>
    </pre>
  )
}
