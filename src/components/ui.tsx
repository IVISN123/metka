import { useEffect, useSyncExternalStore, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
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
        'inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-40',
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
        'grid h-9 w-9 place-items-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--hover)] disabled:opacity-30',
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
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step ?? 1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="w-full accent-[var(--accent)]"
    />
  )
}

export function Modal({
  title,
  closeLabel,
  wide,
  onClose,
  children,
}: {
  title: string
  closeLabel: string
  wide?: boolean
  onClose: () => void
  children: ReactNode
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
