import { useEffect, useRef, useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import { engine } from '../engine/editor'
import { GRID_STEPS } from '../lib/editor-ui'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { IconButton } from './ui'

export function GridMenu() {
  const { t } = useI18n()
  const { state } = useEngine()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  return (
    <div className="relative" ref={rootRef}>
      <IconButton tip="above" label={t('grid')} aria-pressed={state.gridOn} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((value) => !value)}>
        <Grid3x3 size={18} />
      </IconButton>
      {open && (
        <div role="group" aria-label={t('grid')} className="absolute bottom-12 left-0 z-30 w-56 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg">
          <p className="mb-2 text-xs leading-5 text-[var(--muted)]">{t('gridHint')}</p>
          <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
            <input type="checkbox" checked={state.gridOn} onChange={(event) => engine.setGrid({ gridOn: event.target.checked })} />
            {t('grid')}
          </label>
          <label className="mt-2 flex min-h-11 items-center gap-3 text-sm font-bold">
            <input type="checkbox" checked={state.snapGrid} onChange={(event) => engine.setGrid({ snapGrid: event.target.checked })} />
            {t('snapGrid')}
          </label>
          <div className="mt-2 text-xs font-bold text-[var(--muted)]">{t('gridStep')}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {GRID_STEPS.map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => engine.setGrid({ gridStep: step, gridOn: true })}
                className={`h-10 min-w-12 rounded-full px-2 text-sm font-bold ${state.gridStep === step ? 'bg-[var(--pill)] text-[var(--pill-text)]' : 'border border-[var(--border)] hover:bg-[var(--hover)]'}`}
              >
                {step}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
