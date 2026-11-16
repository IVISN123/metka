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

export type AxisBox = { left: number; top: number; width: number; height: number }
export type AlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'

export function unionBox(boxes: AxisBox[]): AxisBox {
  const left = Math.min(...boxes.map((box) => box.left))
  const top = Math.min(...boxes.map((box) => box.top))
  const right = Math.max(...boxes.map((box) => box.left + box.width))
  const bottom = Math.max(...boxes.map((box) => box.top + box.height))
  return { left, top, width: right - left, height: bottom - top }
}

export function alignDelta(box: AxisBox, bounds: AxisBox, mode: AlignEdge): { dx: number; dy: number } {
  let dx = 0
  let dy = 0
  if (mode === 'left') dx = bounds.left - box.left
  if (mode === 'center') dx = bounds.left + bounds.width / 2 - (box.left + box.width / 2)
  if (mode === 'right') dx = bounds.left + bounds.width - (box.left + box.width)
  if (mode === 'top') dy = bounds.top - box.top
  if (mode === 'middle') dy = bounds.top + bounds.height / 2 - (box.top + box.height / 2)
  if (mode === 'bottom') dy = bounds.top + bounds.height - (box.top + box.height)
  return { dx, dy }
}

export function distributeDelta(boxes: AxisBox[], axis: 'x' | 'y'): number[] {
  const deltas = boxes.map(() => 0)
  if (boxes.length < 3) return deltas
  const order = boxes.map((box, index) => ({ box, index }))
  order.sort((a, b) => (axis === 'x' ? a.box.left - b.box.left : a.box.top - b.box.top))
  const first = order[0]
  const last = order[order.length - 1]
  if (!first || !last) return deltas
  const start = axis === 'x' ? first.box.left : first.box.top
  const end = axis === 'x' ? last.box.left + last.box.width : last.box.top + last.box.height
  const sizeSum = order.reduce((sum, item) => sum + (axis === 'x' ? item.box.width : item.box.height), 0)
  const gap = (end - start - sizeSum) / (order.length - 1)
  let cursor = start
  for (const item of order) {
    const pos = axis === 'x' ? item.box.left : item.box.top
    deltas[item.index] = cursor - pos
    cursor += (axis === 'x' ? item.box.width : item.box.height) + gap
  }
  return deltas
}

export function defaultCornerMm(widthMm: number, heightMm: number): number {
  const small = Math.min(widthMm, heightMm)
  if (small <= 15) return 1.5
  if (small <= 30) return 2
  return 3
}

export const GRID_STEPS = [0.5, 1, 2, 5, 10] as const
export type GridStep = (typeof GRID_STEPS)[number]

export function normalizeGridStep(value: number): GridStep {
  return GRID_STEPS.find((step) => step === value) ?? 1
}

export type RulerRank = 'minor' | 'mid' | 'label' | 'edge'

const RANK: Record<RulerRank, number> = { minor: 0, mid: 1, label: 2, edge: 3 }

function positiveMod(value: number, step: number) {
  const mod = value % step
  return mod < 0 ? mod + step : mod
}

/** Label spacing that stays readable: at least ~34px between numbers. */
export function rulerStepMm(pxPerMm: number): number {
  if (!(pxPerMm > 0)) return 10
  for (const step of [1, 2, 5, 10, 20, 50, 100]) {
    if (step * pxPerMm >= 34) return step
  }
  return 100
}

export function mmOnLabel(mm: number, originPx: number, labelPx: number, labelMm: number): number {
  if (!(labelMm > 0)) return originPx
  return originPx + (mm / labelMm) * labelPx
}

export function rulerLayout(input: {
  startMm: number
  endMm: number
  pxPerMm: number
  originPx: number
  labelPx: number
  labelMm: number
}): { mm: number; x: number; rank: RulerRank }[] {
  const { startMm, endMm, pxPerMm, originPx, labelPx, labelMm } = input
  if (!(pxPerMm > 0) || !(labelMm > 0) || !(labelPx > 0)) return []
  const step = rulerStepMm(pxPerMm)
  const mid = step >= 2 && (step / 2) * pxPerMm >= 8 ? step / 2 : 0
  const showMinor = pxPerMm >= 5
  const ranks = new Map<number, RulerRank>()
  const put = (mm: number, rank: RulerRank) => {
    if (!Number.isFinite(mm)) return
    const key = Math.round(mm * 1000) / 1000
    const prev = ranks.get(key)
    if (prev === undefined || RANK[rank] > RANK[prev]) ranks.set(key, rank)
  }
  const first = Math.floor(startMm)
  const last = Math.ceil(endMm)
  for (let mm = first; mm <= last; mm += 1) {
    const clean = mm === 0 ? 0 : mm
    if (positiveMod(clean, step) === 0) put(clean, 'label')
    else if (mid && positiveMod(clean, mid) === 0) put(clean, 'mid')
    else if (showMinor) put(clean, 'minor')
  }
  put(0, 'edge')
  put(labelMm, 'edge')
  return [...ranks.entries()]
    .map(([mm, rank]) => ({ mm, x: mmOnLabel(mm, originPx, labelPx, labelMm), rank }))
    .filter((mark) => mark.mm >= startMm - 0.001 && mark.mm <= endMm + 0.001)
    .sort((a, b) => a.mm - b.mm)
}

export function gridStops(labelPx: number, labelMm: number, stepMm: number): number[] {
  if (!(labelPx > 0) || !(labelMm > 0) || !(stepMm > 0)) return []
  const stops: number[] = []
  const count = Math.ceil(labelMm / stepMm)
  for (let index = 0; index <= count; index += 1) {
    const mm = Math.min(labelMm, Math.round(index * stepMm * 1000) / 1000)
    stops.push(mmOnLabel(mm, 0, labelPx, labelMm))
    if (mm >= labelMm) break
  }
  return stops
}
