import { ChevronDown, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../../app/state'
import { Footnote, ReasonChip, SectionTitle, Segmented, Slider } from '../../components/ui'
import { PRESETS } from '../../engine/data'
import { curveMultiplier } from '../../engine/engine'
import { campaignWins } from '../../engine/metrics'
import { topicPath } from '../../engine/taxonomy'
import { FLAG_REASON, RISK_FLAGS, type Campaign, type Preset } from '../../engine/types'
import { money, prob } from '../../lib/format'

export function Campaigns() {
  const { state, resetCampaigns, comparison } = useApp()
  const contextual = state.campaigns.filter((c) => c.kind === 'contextual')
  const ron = state.campaigns.find((c) => c.kind === 'ron')!
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle eyebrow="Campaign setup" title="The buyer decides what counts as a good match.">
          Pick an objective and ContextIQ applies a preset: a minimum match probability and a bid curve. Nobody tunes 200 campaigns by hand, but anyone can
          override. Changes apply everywhere immediately and are saved in the URL.
        </SectionTitle>
        <button onClick={resetCampaigns} className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
          <RotateCcw size={14} /> Reset all
        </button>
      </div>

      <div className="mb-2 hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_240px] gap-8 border-b border-line pb-2 text-[11px] text-ink-3 lg:grid">
        <span>Campaign</span>
        <span>Objective and threshold</span>
        <span>Bid curve: share of base bid vs P(match)</span>
      </div>
      <ul>
        {contextual.map((c) => (
          <CampaignRow key={c.id} c={c} impressions={campaignWins(comparison.ciqResults, c.id).impressions} />
        ))}
      </ul>
      <div className="mt-6 grid gap-2 rounded-lg bg-sunken px-4 py-3 text-sm text-ink-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <span className="font-medium text-ink">{ron.name}</span> · non-contextual · bids {money(ron.baseBid)} on about half of requests · excludes{' '}
          {ron.excludes.join(', ')}. Not affected by ContextIQ.
        </div>
        <span className="text-xs text-ink-3">Read-only baseline demand</span>
      </div>
      <Footnote className="mt-6">
        Preset values are starting points, to be tuned on pilot data. Bid × P(match) is the default curve, not a universal rule. Simulated campaigns, fictional
        brands.
      </Footnote>
    </div>
  )
}

function CampaignRow({ c, impressions }: { c: Campaign; impressions: number }) {
  const { updateCampaign } = useApp()
  const [advanced, setAdvanced] = useState(false)
  const preset = c.preset!
  const custom = Math.abs(PRESETS[preset].threshold - c.threshold) > 1e-9

  const setPreset = (p: Preset) => updateCampaign(c.id, { preset: p, threshold: PRESETS[p].threshold })

  return (
    <li className="grid gap-6 border-b border-line py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_240px] lg:gap-8">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{c.name}</h3>
          <span className="font-mono text-xs text-ink-3">{money(c.baseBid)} CPM</span>
        </div>
        <p className="mt-0.5 text-sm text-ink-3">{c.blurb}</p>
        <dl className="mt-3 space-y-1.5 text-[13px]">
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-3">Target</dt>
            <dd className="text-ink-2">{topicPath(c.target!)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-3">Excludes</dt>
            <dd className="flex flex-wrap gap-1">
              {c.excludes.length ? c.excludes.map((f) => <ReasonChip key={f} code={FLAG_REASON[f]} />) : <span className="text-ink-4">nothing</span>}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-3">Wins</dt>
            <dd className="font-mono text-ink-2">{impressions} <span className="font-sans text-ink-3">of 1,000 simulated requests</span></dd>
          </div>
        </dl>
      </div>

      <div className="min-w-0">
        <Segmented<Preset>
          label={`${c.name} objective`}
          value={preset}
          onChange={setPreset}
          size="sm"
          options={(['strict', 'balanced', 'broad'] as Preset[]).map((p) => ({ value: p, label: PRESETS[p].objective.replace(' and discovery', '').replace('Premium brand ', 'Premium ') }))}
        />
        <div className="mt-3 text-[13px] text-ink-2">
          <span className="font-medium text-ink">{PRESETS[preset].label}</span> preset · min P(match){' '}
          <span className="font-mono text-ink">{prob(c.threshold)}</span>
          {custom && <span className="ml-1 text-xs text-warn">(custom)</span>} · bid = <span className="font-mono">{PRESETS[preset].curve}</span>
        </div>
        <button
          onClick={() => setAdvanced(!advanced)}
          aria-expanded={advanced}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink"
        >
          Advanced <ChevronDown size={13} className={`transition-transform ${advanced ? 'rotate-180' : ''}`} />
        </button>
        {advanced && (
          <div className="mt-3 space-y-4 rounded-lg border border-line bg-surface p-4">
            <div>
              <div className="mb-1 flex justify-between text-xs text-ink-3">
                <span>Minimum P(match)</span>
                <span className="font-mono text-ink">{prob(c.threshold)}</span>
              </div>
              <Slider label={`${c.name} threshold`} value={c.threshold} min={0.3} max={0.95} step={0.05} onChange={(v) => updateCampaign(c.id, { threshold: Math.round(v * 100) / 100 })} format={prob} />
            </div>
            <label className="flex items-center justify-between gap-3 text-xs text-ink-3">
              Base bid (CPM)
              <span className="inline-flex items-center rounded-md border border-line bg-paper px-2">
                <span className="text-ink-3">$</span>
                <input
                  type="number"
                  min={0.1}
                  max={20}
                  step={0.1}
                  value={c.baseBid}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    if (Number.isFinite(v) && v > 0) updateCampaign(c.id, { baseBid: Math.min(20, Math.round(v * 100) / 100) })
                  }}
                  className="w-16 bg-transparent py-1 text-right font-mono text-sm text-ink outline-none"
                />
              </span>
            </label>
            <fieldset>
              <legend className="mb-1.5 text-xs text-ink-3">Exclude pages flagged</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {RISK_FLAGS.map((f) => (
                  <label key={f} className="inline-flex items-center gap-1.5 text-sm text-ink-2">
                    <input
                      type="checkbox"
                      className="accent-[var(--accent)]"
                      checked={c.excludes.includes(f)}
                      onChange={(e) => updateCampaign(c.id, { excludes: e.target.checked ? [...c.excludes, f] : c.excludes.filter((x) => x !== f) })}
                    />
                    {f}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </div>

      <BidCurve preset={preset} threshold={c.threshold} />
    </li>
  )
}

export function BidCurve({ preset, threshold, width = 240, height = 132 }: { preset: Preset; threshold: number; width?: number; height?: number }) {
  const pad = { l: 28, r: 8, t: 8, b: 22 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const x = (p: number) => pad.l + p * w
  const y = (m: number) => pad.t + (1 - m) * h
  const path = (pr: Preset, from: number) =>
    Array.from({ length: 41 }, (_, i) => from + ((1 - from) * i) / 40)
      .map((p, i) => `${i ? 'L' : 'M'}${x(p).toFixed(1)},${y(curveMultiplier(pr, p)).toFixed(1)}`)
      .join(' ')
  const other: Preset = preset === 'broad' ? 'balanced' : 'broad'
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="max-w-[320px] overflow-visible" role="img" aria-label={`${preset} bid curve with threshold ${threshold.toFixed(2)}`}>
        {/* ineligible region */}
        <rect x={x(0)} y={pad.t} width={x(threshold) - x(0)} height={h} fill="var(--sunken)" />
        <text x={x(threshold / 2)} y={pad.t + 12} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">
          no bid
        </text>
        {[0, 0.5, 1].map((m) => (
          <g key={m}>
            <line x1={pad.l} x2={pad.l + w} y1={y(m)} y2={y(m)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(m) + 3} fontSize="9.5" textAnchor="end" fill="var(--ink-3)" className="tnum">
              {Math.round(m * 100)}%
            </text>
          </g>
        ))}
        {[0, 0.5, 0.8, 1].map((p) => (
          <text key={p} x={x(p)} y={height - 6} fontSize="9.5" textAnchor="middle" fill="var(--ink-3)" className="tnum">
            {p.toFixed(1)}
          </text>
        ))}
        <path d={path(other, 0)} fill="none" stroke="var(--strict)" strokeWidth={1} strokeDasharray="3 3" />
        <path d={path(preset, 0)} fill="none" stroke="var(--accent)" strokeOpacity={0.25} strokeWidth={1.75} />
        <path d={path(preset, threshold)} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <line x1={x(threshold)} x2={x(threshold)} y1={pad.t - 2} y2={pad.t + h} stroke="var(--ink)" strokeWidth={1.5} />
        <text x={x(threshold) + 4} y={y(curveMultiplier(preset, threshold)) + 14} fontSize="10" fill="var(--ink)" className="tnum">
          {threshold.toFixed(2)}
        </text>
      </svg>
      <figcaption className="mt-1 text-[11px] leading-snug text-ink-3">
        <span className="text-accent-ink">{PRESETS[preset].label}</span> curve, solid from the threshold. Dashed: {PRESETS[other].label} for comparison.
      </figcaption>
    </figure>
  )
}
