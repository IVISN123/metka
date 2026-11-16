import { useSyncExternalStore } from 'react'
import { Bold, Italic } from 'lucide-react'
import { engine } from '../engine/editor'
import { fontChoices, subscribeFonts } from '../lib/fonts'
import { useI18n } from './state'

export function FontBar() {
  const { t } = useI18n()
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  const fonts = useSyncExternalStore(subscribeFonts, fontChoices, fontChoices)
  const selected = state.selected
  if (!selected || (selected.kind !== 'text' && selected.kind !== 'datetime' && selected.kind !== 'number')) return null
  const known = fonts.some((font) => font.family === selected.fontFamily)
  const bold = String(selected.fontWeight) === '700' || selected.fontWeight === 'bold'
  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-2 py-2 md:hidden">
      <select
        aria-label={t('font')}
        className="h-11 min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-2 text-base font-bold text-[var(--text)]"
        style={{ fontFamily: selected.fontFamily }}
        value={known ? selected.fontFamily : ''}
        onChange={(event) => void engine.updateSelected({ fontFamily: event.target.value })}
      >
        {!known && <option value="">{selected.fontFamily || t('font')}</option>}
        {fonts.map((font) => (
          <option key={font.id} value={font.family} style={{ fontFamily: font.family }}>
            {font.label}
          </option>
        ))}
      </select>
      <input
        aria-label={t('fontSize')}
        type="number"
        min={8}
        max={160}
        value={selected.fontSize ?? 16}
        onChange={(event) => void engine.updateSelected({ fontSize: Number(event.target.value) })}
        className="h-11 w-16 rounded-xl border-2 border-[var(--border)] bg-[var(--field)] text-center text-sm font-bold tabular-nums"
      />
      <button
        type="button"
        aria-pressed={bold}
        aria-label={t('bold')}
        onClick={() => void engine.updateSelected({ fontWeight: bold ? '400' : '700' })}
        className={`grid h-11 w-11 place-items-center rounded-full border ${bold ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'}`}
      >
        <Bold size={18} />
      </button>
      <button
        type="button"
        aria-pressed={selected.fontStyle === 'italic'}
        aria-label={t('italic')}
        onClick={() => void engine.updateSelected({ fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })}
        className={`grid h-11 w-11 place-items-center rounded-full border ${selected.fontStyle === 'italic' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'}`}
      >
        <Italic size={18} />
      </button>
    </div>
  )
}
