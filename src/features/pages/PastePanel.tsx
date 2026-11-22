import { AlertTriangle, ScanText } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../app/state'
import { classify, MIN_WORDS, pageFromText, SAMPLE_ARTICLE, wordCount } from '../../engine/classifier'
import { topicPath } from '../../engine/taxonomy'
import { prob } from '../../lib/format'

export function PastePanel({ onDone }: { onDone: () => void }) {
  const { setCustom, set } = useApp()
  const [text, setText] = useState(SAMPLE_ARTICLE)
  const [shortMsg, setShortMsg] = useState<string | null>(null)
  const words = wordCount(text)

  const analyse = () => {
    const r = classify(text)
    const page = pageFromText(text)
    setCustom(page)
    if (r.status === 'too-short') {
      setShortMsg('Too short to score. Using site-level fallback.')
    } else {
      setShortMsg(null)
    }
    set((s) => ({ pageId: 'custom', run: s.run + 1 }))
    onDone()
  }

  const preview = words >= MIN_WORDS ? classify(text) : null

  return (
    <section aria-label="Paste your own article" className="max-w-3xl">
      <div className="label mb-2">Content analyser</div>
      <h2 className="text-[22px] font-semibold tracking-[-0.015em] sm:text-[28px]">Paste your own article</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
        The page is scored like a curated one, then you can run it through the decision trace.
      </p>
      <div className="mt-4 inline-flex items-center gap-2 rounded-md bg-warn-soft px-2.5 py-1 text-xs text-warn">
        <ScanText size={13} /> Demo classifier: keyword-based stand-in for production ML models.
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        aria-label="Article text"
        className="mt-4 block w-full resize-y rounded-xl border border-line bg-surface p-4 font-serif text-[16px] leading-relaxed text-ink outline-none focus:border-accent"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-3">
          <span className={`font-mono ${words < MIN_WORDS ? 'text-warn' : ''}`}>{words}</span> words
          {words < MIN_WORDS && <> · under {MIN_WORDS}: too short to score, site-level fallback will apply</>}
          {preview?.status === 'scored' && preview.profile.topics[0] && (
            <>
              {' '}· likely <span className="text-ink-2">{topicPath(preview.profile.topics[0].topic)}</span>, confidence{' '}
              <span className="font-mono">{prob(preview.profile.confidence ?? 0)}</span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setText('')} className="rounded-lg px-3 py-2 text-sm text-ink-3 hover:text-ink">
            Clear
          </button>
          <button onClick={analyse} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-ink">
            Analyse
          </button>
        </div>
      </div>
      {shortMsg && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-warn">
          <AlertTriangle size={14} /> {shortMsg}
        </p>
      )}
      <details className="mt-8 border-t border-line pt-4 text-sm text-ink-2">
        <summary className="cursor-pointer text-ink">How the demo classifier works</summary>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed">
          <li>15–20 keywords per topic, matched case-insensitively on word boundaries. Topic share = hits ÷ all hits; the top two topics with share ≥ 0.15 are kept.</li>
          <li>Confidence = clamp(0.5 + 0.5 × (share₁ − share₂) × min(1, words ÷ 300), 0.30, 0.98).</li>
          <li>Any single term above 4% of words halves confidence and adds the low-quality flag (keyword stuffing).</li>
          <li>Devanagari script, or 3+ Hinglish marker words, sets language to hi-en and caps confidence at 0.60.</li>
          <li>Risk words raise fraud, crime or tragedy flags. Under 80 words, nothing is scored.</li>
        </ul>
        <p className="mt-3 text-xs text-ink-3">Production uses ML models in the background pipeline, never in the request path. No text leaves your browser.</p>
      </details>
    </section>
  )
}
