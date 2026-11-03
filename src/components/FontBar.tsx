import { useSyncExternalStore } from 'react'
import { engine } from '../engine/editor'
import { addUserFont, fontChoices, subscribeFonts } from '../lib/fonts'
import { toast } from '../toast'
import { useI18n } from './state'

export function FontBar() {
  const { t } = useI18n()
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  const fonts = useSyncExternalStore(subscribeFonts, fontChoices, fontChoices)
  const selected = state.selected
  if (!selected || (selected.kind !== 'text' && selected.kind !== 'datetime' && selected.kind !== 'number')) return null
  const known = fonts.some((font) => font.family === selected.fontFamily)
  return (
    <div className="pointer-events-auto absolute inset-x-3 top-3 z-30 mx-auto flex max-w-xl flex-col gap-2 rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] p-3 shadow-xl">
      <label className="text-sm font-black text-[var(--text)]">
        {t('font')}
        <select
          className="mt-1 h-12 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-3 text-base font-bold text-[var(--text)]"
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
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center rounded-full border-2 border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--hover)]">
          {t('uploadFont')}
          <input
            type="file"
            accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              void addUserFont(file)
                .then((font) => engine.updateSelected({ fontFamily: font.family }))
                .catch((error: unknown) => toast(error instanceof Error && error.message === 'tooBig' ? t('fontTooBig') : t('fontFail')))
            }}
          />
        </label>
        <span className="text-xs leading-5 text-[var(--muted)]">{t('fontEach')}</span>
      </div>
    </div>
  )
}
