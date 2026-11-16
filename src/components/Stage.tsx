import { useEffect, useRef } from 'react'
import { useSyncExternalStore } from 'react'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'
import { engine } from '../engine/editor'
import { modelLabel } from '../lib/units'
import { toast } from '../toast'
import { useI18n } from './state'
import { Button, IconButton } from './ui'

export function useEngine() {
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  return { engine, state }
}

export function Stage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const guideRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { state } = useEngine()
  const { t } = useI18n()

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    const guide = guideRef.current
    if (!host || !canvas || !guide) return
    engine.attach(canvas, host, guide)
    return () => engine.detach()
  }, [])

  return (
    <div ref={hostRef} className="canvas-host absolute inset-0 touch-none" style={{ background: 'var(--workspace)' }}>
      <canvas ref={canvasRef} />
      <canvas ref={guideRef} className="pointer-events-none absolute inset-0 z-10" />
      {state.ready && state.layers.length === 0 && (
        <div className="pointer-events-none absolute inset-x-3 top-4 z-20 flex justify-center">
          <div className="pointer-events-auto flex max-w-md flex-col items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-center shadow-lg">
            <p className="text-sm font-bold">{t('emptyTitle')}</p>
            <p className="text-xs leading-5 text-[var(--muted)]">{t('emptyLead')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => engine.addText()}>{t('text')}</Button>
              <Button onClick={() => fileRef.current?.click()}>{t('photo')}</Button>
              <Button onClick={() => void engine.addQr()}>{t('qr')}</Button>
              <Button onClick={() => void engine.addBarcode().catch((error: unknown) => toast(String(error)))}>{t('barcode')}</Button>
            </div>
          </div>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void engine.addImageFile(file)
          event.target.value = ''
        }}
      />
      {!state.ready && (
        <div className="absolute inset-0 z-20 grid place-items-center text-sm text-[var(--muted)]">{t('loading')}</div>
      )}
      <div className="absolute inset-x-2 bottom-2 z-20 flex items-end justify-between gap-2">
        <div className="flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--card)] p-1 shadow-lg">
          <IconButton label={t('zoomOut')} onClick={() => engine.zoomBy(1 / 1.15)}>
            <ZoomOut size={18} />
          </IconButton>
          <button
            type="button"
            className="h-11 min-w-16 rounded-full px-2 text-sm font-bold tabular-nums hover:bg-[var(--hover)]"
            onClick={() => engine.fit()}
            aria-label={t('fitZoom')}
            title={t('fitZoom')}
          >
            {Math.round(state.zoom * 100)}%
          </button>
          <IconButton label={t('zoomIn')} onClick={() => engine.zoomBy(1.15)}>
            <ZoomIn size={18} />
          </IconButton>
          <IconButton label={t('fit')} onClick={() => engine.fit()}>
            <Maximize2 size={18} />
          </IconButton>
        </div>
        <p className="mb-2 max-w-[42%] truncate rounded-full bg-[var(--card)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)]">
          {t('statusShort', { w: state.widthMm, h: state.heightMm, model: modelLabel(state.model) })}
        </p>
      </div>
    </div>
  )
}
