import { useEffect, useState, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { classSetsDisplay } from '../lib/editor-ui'
import { getToasts, subscribeToasts } from '../toast'

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function Button({
  variant = 'ghost',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'accent' }) {
  const look =
    variant === 'primary'
      ? 'bg-[var(--pill)] text-[var(--pill-text)] hover:opacity-90'
      : variant === 'accent'
        ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
        : variant === 'danger'
          ? 'text-[var(--danger)] hover:bg-[var(--hover)]'
          : 'border border-[var(--border)] hover:bg-[var(--hover)]'
  return (
    <button
      {...props}
      className={cx(
        !classSetsDisplay(className) && 'inline-flex',
        'h-11 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-40',
        look,
        className,
      )}
    />
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={cx(
        'grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--hover)] disabled:opacity-30',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-[var(--muted)]">{label}</span>
      {children}
    </label>
  )
}

const control =
  'h-11 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-3 text-[15px] font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]'

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(control, className)} />
}

export function SelectInput({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(control, className)}>
      {children}
    </select>
  )
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  label,
  onGestureStart,
  onGestureEnd,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label?: string
  onGestureStart?: () => void
  onGestureEnd?: () => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(String(value))
  }
  const commit = (raw: string) => {
    const next = Number(raw.replace(',', '.'))
    if (!Number.isFinite(next)) {
      setDraft(String(value))
      return
    }
    onChange(Math.min(max, Math.max(min, next)))
  }
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onPointerDown={() => onGestureStart?.()}
        onPointerUp={() => onGestureEnd?.()}
        onPointerCancel={() => onGestureEnd?.()}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 min-w-0 flex-1 accent-[var(--accent)]"
      />
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        step={step ?? 1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="h-11 w-16 shrink-0 rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-1 text-center text-sm font-bold tabular-nums outline-none focus:border-[var(--accent)]"
      />
    </div>
  )
}

export function NumberField({
  value,
  onCommit,
  label,
  min,
  max,
  step = 0.1,
}: {
  value: number
  onCommit: (value: number) => void
  label: string
  min?: number
  max?: number
  step?: number
}) {
  const [draft, setDraft] = useState(String(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(String(value))
  }
  const commit = () => {
    const next = Number(draft.replace(',', '.'))
    if (!Number.isFinite(next)) {
      setDraft(String(value))
      return
    }
    const low = min ?? next
    const high = max ?? next
    onCommit(Math.min(high, Math.max(low, next)))
  }
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      step={step}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
      className={control}
    />
  )
}

export function ScrubField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  onGestureStart,
  onGestureEnd,
}: {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
  onGestureStart?: () => void
  onGestureEnd?: () => void
}) {
  const [draft, setDraft] = useState(formatScrub(value))
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(formatScrub(value))
  }
  const clampValue = (next: number) => {
    const low = min ?? next
    const high = max ?? next
    return Math.min(high, Math.max(low, next))
  }
  const commit = (raw: string) => {
    const next = Number(raw.replace(',', '.'))
    if (!Number.isFinite(next)) {
      setDraft(formatScrub(value))
      return
    }
    onChange(clampValue(next))
  }
  return (
    <div className="flex h-11 items-center rounded-xl border-2 border-[var(--border)] bg-[var(--field)] focus-within:border-[var(--accent)]">
      <button
        type="button"
        aria-label={label}
        title={label}
        className="scrub-label h-full w-8 shrink-0 cursor-ew-resize rounded-l-[10px] text-xs font-bold text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
        onPointerDown={(event) => {
          event.preventDefault()
          const pointer = event.pointerId
          event.currentTarget.setPointerCapture(pointer)
          const startX = event.clientX
          const start = value
          onGestureStart?.()
          const move = (ev: PointerEvent) => {
            const fine = ev.shiftKey ? step / 10 : step
            onChange(clampValue(start + (ev.clientX - startX) * fine))
          }
          const end = () => {
            window.removeEventListener('pointermove', move)
            window.removeEventListener('pointerup', end)
            onGestureEnd?.()
          }
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', end)
        }}
      >
        {label}
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="h-full min-w-0 flex-1 bg-transparent pr-2 text-right text-sm font-bold tabular-nums outline-none"
      />
    </div>
  )
}

function formatScrub(value: number) {
  if (!Number.isFinite(value)) return ''
  return String(Math.round(value * 100) / 100)
}

export function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

export function Modal({
  title,
  closeLabel,
  wide,
  onClose,
  children,
  footer,
}: {
  title: string
  closeLabel: string
  wide?: boolean
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={cx(
          'flex max-h-[100dvh] w-full flex-col overflow-hidden border border-[var(--border)] bg-[var(--card)] shadow-2xl sm:max-h-[90dvh] sm:rounded-3xl',
          wide ? 'sm:max-w-5xl' : 'sm:max-w-xl',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="truncate text-lg font-black tracking-tight">{title}</h2>
          <IconButton label={closeLabel} onClick={onClose}>
            <span aria-hidden className="text-xl leading-none">
              ×
            </span>
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        {footer}
      </div>
    </div>
  )
}

export function Toasts() {
  const items = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto max-w-md rounded-full border border-[var(--border)] bg-[var(--elev)] px-4 py-2 text-sm font-medium shadow-lg">
          {item.text}
        </div>
      ))}
    </div>
  )
}
