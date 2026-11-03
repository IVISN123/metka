import { useEffect, useRef } from 'react'
import { useSyncExternalStore } from 'react'
import { engine } from '../engine/editor'
import { useI18n } from './state'

export function useEngine() {
  const state = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot)
  return { engine, state }
}

export function Stage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const guideRef = useRef<HTMLCanvasElement>(null)
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
        <div className="pointer-events-none absolute inset-x-0 top-8 z-20 text-center text-sm text-[var(--muted)]">{t('dropHint')}</div>
      )}
      {!state.ready && (
        <div className="absolute inset-0 z-20 grid place-items-center text-sm text-[var(--muted)]">{t('loading')}</div>
      )}
    </div>
  )
}
