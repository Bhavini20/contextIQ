import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { bandOf } from '../engine/engine'
import { REASON_TEXT, type Band, type ReasonCode } from '../engine/types'
import { FOOTNOTE } from '../lib/format'

/* ---------- Animated number ---------- */
export function Num({ value, format, className = '' }: { value: number; format: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduce) {
      setShown(value)
      from.current = value
      return
    }
    const ctrl = animate(from.current, value, {
      duration: 0.45,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => setShown(v),
    })
    from.current = value
    return () => ctrl.stop()
  }, [value, reduce])
  return <span className={`tnum ${className}`}>{format(shown)}</span>
}

/* ---------- Tooltip: hover or focus anything to explain it ---------- */
export function Tip({ tip, children, className = '', side = 'top' }: { tip: ReactNode; children: ReactNode; className?: string; side?: 'top' | 'bottom' }) {
  const id = useId()
  return (
    <span className={`group/tip relative inline-flex ${className}`} tabIndex={0} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-ink-2 shadow-soft hidden group-hover/tip:block group-focus/tip:block ${
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        }`}
      >
        {tip}
      </span>
    </span>
  )
}

/* ---------- Simulated data pill ---------- */
export function SimPill({ className = '' }: { className?: string }) {
  return (
    <Tip tip="Every number comes from a fixed, seeded simulation of 55 pages and 1,000 ad requests. Fictional brands. Not Media.net data." side="bottom">
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 py-1 text-xs text-ink-3 ${className}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
        Simulated data
      </span>
    </Tip>
  )
}

export function Footnote({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <p className={`text-xs text-ink-3 ${className}`}>{children ?? FOOTNOTE}</p>
}

/* ---------- Band tag ---------- */
export const BAND_LABEL: Record<Band, string> = { specific: 'Specific', broad: 'Broad', fallback: 'Fallback' }
const BAND_RANGE: Record<Band, string> = {
  specific: 'Specific: P(match) 0.80 and above. A label on a continuous score.',
  broad: 'Broad: P(match) 0.50 to 0.80. A label on a continuous score.',
  fallback: 'Fallback: P(match) below 0.50. A label on a continuous score; the advertiser threshold decides eligibility.',
}
export function BandTag({ band, muted = false }: { band: Band; muted?: boolean }) {
  const dot = { specific: 'bg-band-specific', broad: 'bg-band-broad', fallback: 'bg-band-fallback' }[band]
  return (
    <Tip tip={BAND_RANGE[band]}>
      <span className={`inline-flex items-center gap-1.5 text-xs ${muted ? 'text-ink-4' : 'text-ink-2'}`}>
        <span className={`h-2 w-2 rounded-[2px] ${dot}`} aria-hidden />
        {BAND_LABEL[band]}
      </span>
    </Tip>
  )
}

/* ---------- Reason code chip ---------- */
export function ReasonChip({ code, tone }: { code: ReasonCode; tone?: 'neg' | 'muted' }) {
  const t = tone ?? (code.startsWith('SUIT') ? 'neg' : 'muted')
  return (
    <Tip tip={REASON_TEXT[code]}>
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] leading-4 ${
          t === 'neg' ? 'bg-neg-soft text-neg' : 'bg-sunken text-ink-3'
        }`}
      >
        {code}
      </span>
    </Tip>
  )
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-sunken p-0.5">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`relative whitespace-nowrap rounded-md font-medium transition-colors duration-150 ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
            } ${on ? 'bg-surface text-ink shadow-soft' : 'text-ink-3 hover:text-ink'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------- Toggle switch ---------- */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-ink-2 select-none">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-line-2'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : ''}`}
        />
      </button>
      {label}
    </label>
  )
}

/* ---------- Slider ---------- */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  label: string
  format?: (v: number) => string
}) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <input
      type="range"
      className="slider"
      aria-label={label}
      aria-valuetext={format ? format(value) : String(value)}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ['--fill' as string]: `${fill}%` }}
      onChange={(e) => onChange(Math.round(Number(e.target.value) / step) * step)}
    />
  )
}

/* ---------- Match-probability meter ---------- */
export function MatchMeter({
  p,
  threshold,
  confidence,
  fit,
  compact = false,
  muted = false,
}: {
  p: number
  threshold?: number | null
  confidence?: number | null
  fit?: number
  compact?: boolean
  muted?: boolean
}) {
  const band = bandOf(p)
  const fillColor = muted ? 'var(--ink-4)' : `var(--band-${band})`
  return (
    <div className={compact ? 'w-full' : 'w-full'}>
      {!compact && confidence != null && fit != null && (
        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <MiniBar label="Confidence" value={confidence} />
          <span className="pb-0.5 font-mono text-sm text-ink-3">×</span>
          <MiniBar label="Fit" value={fit} />
        </div>
      )}
      <div className={`relative ${compact ? 'h-1.5' : 'h-2.5'} w-full overflow-visible rounded-full bg-sunken`}>
        {/* band zones */}
        {!compact && (
          <>
            <div className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
            <div className="absolute inset-y-0 left-[80%] w-px bg-line-2" />
          </>
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out"
          style={{ width: `${Math.max(0, Math.min(1, p)) * 100}%`, background: fillColor }}
        />
        {threshold != null && (
          <div
            className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink transition-[left] duration-300"
            style={{ left: `calc(${threshold * 100}% - 1px)` }}
            aria-hidden
          />
        )}
      </div>
      {!compact && (
        <div className="relative mt-1.5 h-4 text-[11px] text-ink-3">
          <span className="absolute left-0">Fallback</span>
          <span className="absolute left-1/2 pl-1">Broad</span>
          <span className="absolute left-[80%] pl-1">Specific</span>
        </div>
      )}
    </div>
  )
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink-3">{label}</span>
        <Num value={value} format={(n) => n.toFixed(2)} className="font-mono text-ink" />
      </div>
      <div className="h-1 rounded-full bg-sunken">
        <div className="h-full rounded-full bg-ink-3 transition-[width] duration-500" style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  )
}

/* ---------- Logo mark ---------- */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <path d="M7 21a9 9 0 0 1 18 0" fill="none" stroke="var(--ink-3)" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      <path d="M7 21a9 9 0 0 1 14.4-7.2" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="21" r="2.2" fill="var(--paper)" />
    </svg>
  )
}

/* ---------- Inline "why?" disclosure ---------- */
export function Why({ children, label = 'Why?' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="text-xs font-medium text-accent-ink underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
        {open ? 'Hide' : label}
      </button>
      {open && <span className="mt-1 block text-xs leading-relaxed text-ink-2">{children}</span>}
    </span>
  )
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6">
      {eyebrow && <div className="label mb-2">{eyebrow}</div>}
      <h2 className="text-[22px] font-semibold tracking-[-0.015em] text-ink sm:text-[28px]">{title}</h2>
      {children && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{children}</p>}
    </div>
  )
}
