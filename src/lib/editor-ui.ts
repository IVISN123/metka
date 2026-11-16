import { clamp, pxToMm } from './units'

export type ShortcutInput = {
  key: string
  code: string
  meta: boolean
  shift: boolean
  alt: boolean
}

export type Shortcut =
  | { type: 'undo' | 'redo' | 'duplicate' | 'copy' | 'selectAll' | 'delete' | 'fit' | 'zoomIn' | 'zoomOut' | 'deselect' | 'pan' }
  | { type: 'nudge'; dx: number; dy: number }

export function matchEditorShortcut(input: ShortcutInput): Shortcut | null {
  const key = input.key.toLowerCase()
  if (input.code === 'Space') return { type: 'pan' }
  if (input.meta && key === 'z' && !input.shift) return { type: 'undo' }
  if (input.meta && (key === 'y' || (key === 'z' && input.shift))) return { type: 'redo' }
  if (input.meta && key === 'd' && !input.shift) return { type: 'duplicate' }
  if (input.meta && key === 'c' && !input.shift) return { type: 'copy' }
  if (input.meta && key === 'a' && !input.shift) return { type: 'selectAll' }
  if (input.meta && !input.shift && (input.code === 'Digit0' || input.code === 'Numpad0')) return { type: 'fit' }
  if (input.meta && !input.shift && (input.code === 'Equal' || input.code === 'NumpadAdd')) return { type: 'zoomIn' }
  if (input.meta && !input.shift && (input.code === 'Minus' || input.code === 'NumpadSubtract')) return { type: 'zoomOut' }
  if (!input.meta && !input.alt && (input.key === 'Delete' || input.key === 'Backspace')) return { type: 'delete' }
  if (!input.meta && !input.alt && input.key === 'Escape') return { type: 'deselect' }
  if (!input.meta && !input.alt) {
    const step = input.shift ? 10 : 1
    if (input.key === 'ArrowLeft') return { type: 'nudge', dx: -step, dy: 0 }
    if (input.key === 'ArrowRight') return { type: 'nudge', dx: step, dy: 0 }
    if (input.key === 'ArrowUp') return { type: 'nudge', dx: 0, dy: -step }
    if (input.key === 'ArrowDown') return { type: 'nudge', dx: 0, dy: step }
  }
  return null
}

export function pinchZoom(startDistance: number, distance: number, startZoom: number, min = 0.15, max = 12): number {
  if (!(startDistance > 0) || !(distance > 0) || !Number.isFinite(startZoom)) return startZoom
  return clamp(startZoom * (distance / startDistance), min, max)
}

export function touchDistance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function originName(origin: string | number | undefined, axis: 'x' | 'y'): 'left' | 'center' | 'right' | 'top' | 'bottom' {
  if (origin === 'center' || origin === 0.5) return 'center'
  if (origin === 'right' || origin === 'bottom' || origin === 1) return axis === 'x' ? 'right' : 'bottom'
  if (origin === 'left' || origin === 'top' || origin === 0) return axis === 'x' ? 'left' : 'top'
  return axis === 'x' ? 'left' : 'top'
}

export function topLeftBox(
  left: number,
  top: number,
  width: number,
  height: number,
  scaleX: number,
  scaleY: number,
  originX: string | number | undefined,
  originY: string | number | undefined,
): { x: number; y: number; w: number; h: number } {
  const w = Math.abs((width || 0) * (Number.isFinite(scaleX) ? scaleX : 1))
  const h = Math.abs((height || 0) * (Number.isFinite(scaleY) ? scaleY : 1))
  const ox = originName(originX, 'x')
  const oy = originName(originY, 'y')
  let x = left
  let y = top
  if (ox === 'center') x -= w / 2
  else if (ox === 'right') x -= w
  if (oy === 'center') y -= h / 2
  else if (oy === 'bottom') y -= h
  return { x, y, w, h }
}

export function originPoint(
  x: number,
  y: number,
  w: number,
  h: number,
  originX: string | number | undefined,
  originY: string | number | undefined,
): { left: number; top: number } {
  const ox = originName(originX, 'x')
  const oy = originName(originY, 'y')
  let left = x
  let top = y
  if (ox === 'center') left += w / 2
  else if (ox === 'right') left += w
  if (oy === 'center') top += h / 2
  else if (oy === 'bottom') top += h
  return { left, top }
}

export function roundMm(px: number, dpi: number): number {
  return Math.round(pxToMm(px, dpi) * 10) / 10
}

export function boxToMm(box: { x: number; y: number; w: number; h: number }, dpi: number) {
  return { x: roundMm(box.x, dpi), y: roundMm(box.y, dpi), w: roundMm(box.w, dpi), h: roundMm(box.h, dpi) }
}

export function labelWord(count: number, lang: 'ru' | 'en'): string {
  if (lang === 'en') return Math.abs(count) === 1 ? 'label' : 'labels'
  const n = Math.abs(Math.trunc(count))
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return 'этикетка'
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'этикетки'
  return 'этикеток'
}

export function canBindSeries(kind: string | undefined): boolean {
  return kind === 'text' || kind === 'qr' || kind === 'barcode' || kind === 'datetime'
}

export function classSetsDisplay(className: string | undefined): boolean {
  return /(?:^|\s)(?:[A-Za-z-]+:)*?(?:hidden|inline-flex|inline-grid|inline-block|flex|grid|block)(?:\s|$)/.test(className ?? '')
}
