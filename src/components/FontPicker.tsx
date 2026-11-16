import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown } from 'lucide-react'
import { fontChoices, subscribeFonts, type FontChoice } from '../lib/fonts'
import { useI18n } from './state'

function familyKey(family: string) {
  return family.split(',')[0]?.replaceAll('"', '').replaceAll("'", '').trim().toLowerCase() ?? ''
}

export function FontPicker({ value, onChange }: { value: string; onChange: (family: string) => void }) {
  const { t } = useI18n()
  const fonts = useSyncExternalStore(subscribeFonts, fontChoices, fontChoices)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = fonts.find((font) => familyKey(font.family) === familyKey(value))
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])
  const q = query.trim().toLowerCase()
  const shown = fonts.filter((font) => !q || font.label.toLowerCase().includes(q) || font.family.toLowerCase().includes(q))
  const file = shown.filter((font) => !font.system)
  const system = shown.filter((font) => font.system)
  const pick = (family: string) => {
    onChange(family)
    setOpen(false)
  }
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-3 text-left text-base font-bold text-[var(--text)]"
        style={{ fontFamily: value }}
        aria-expanded={open}
        aria-label={t('font')}
        onClick={() => setOpen((next) => !next)}
      >
        <span className="truncate">{current?.label || familyKey(value) || t('font')}</span>
        <ChevronDown size={18} className="shrink-0 text-[var(--icon)]" />
      </button>
      {open && (
        <div className="absolute z-40 mt-1 max-h-80 w-full overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-lg">
          <input
            autoFocus
            aria-label={t('fontSearch')}
            value={query}
            placeholder={t('fontSearch')}
            onChange={(event) => setQuery(event.target.value)}
            className="mb-2 h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--field)] px-3 text-sm font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <FontGroup title={t('bundledFonts')} fonts={file} value={value} onPick={pick} />
          <FontGroup title={t('systemFonts')} fonts={system} value={value} onPick={pick} />
          {shown.length === 0 && <p className="px-2 py-3 text-sm text-[var(--muted)]">{t('noFont')}</p>}
        </div>
      )}
    </div>
  )
}

function FontGroup({
  title,
  fonts,
  value,
  onPick,
}: {
  title: string
  fonts: FontChoice[]
  value: string
  onPick: (family: string) => void
}) {
  if (fonts.length === 0) return null
  return (
    <div className="mb-2">
      <div className="px-2 pb-1 pt-2 text-xs font-bold text-[var(--muted)]">{title}</div>
      {fonts.map((font) => (
        <button
          key={font.id}
          type="button"
          className={`block min-h-11 w-full rounded-xl px-3 py-2 text-left text-lg text-[var(--text)] ${font.family === value ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'}`}
          style={{ fontFamily: font.family }}
          onClick={() => onPick(font.family)}
        >
          <span>{font.label}</span>
          <span className="ml-3 text-[var(--muted)]">Метка</span>
        </button>
      ))}
    </div>
  )
}
