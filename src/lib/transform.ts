/**
 * Geometry for the label editor. Resize edits width and height.
 * Stroke width and corner radius stay in millimetres (they are not scaled).
 */

export type Box = { x: number; y: number; w: number; h: number }
export type HandleName = 'ml' | 'mr' | 'mt' | 'mb' | 'tl' | 'tr' | 'bl' | 'br'
export type ResizeAxes = 'x' | 'y' | 'both'
export type StrokeAlign = 'center' | 'inside' | 'outside'
export type TextMode = 'auto' | 'auto-height' | 'fixed'
export type DropPlace = 'before' | 'after' | 'into'

export type ShapeScale = {
  type: 'rect' | 'ellipse' | 'triangle' | 'line'
  width: number
  height: number
  scaleX: number
  scaleY: number
  strokeWidth: number
  rx?: number
  ry?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

const MIN_PX = 1

export function originOffset(origin: string | number | undefined): number {
  if (origin === 'left' || origin === 'top') return -0.5
  if (origin === 'center' || origin === 0.5) return 0
  if (origin === 'right' || origin === 'bottom') return 0.5
  if (typeof origin === 'number') return origin - 0.5
  return -0.5
}

/** Fold a scale transform into width/height. Stroke and rect corner radius stay put. */
export function bakeShapeScale(shape: ShapeScale): ShapeScale {
  const sx = Number.isFinite(shape.scaleX) && shape.scaleX !== 0 ? shape.scaleX : 1
  const sy = Number.isFinite(shape.scaleY) && shape.scaleY !== 0 ? shape.scaleY : 1
  const signX = sx < 0 ? -1 : 1
  const signY = sy < 0 ? -1 : 1
  if (shape.type === 'line') {
    return {
      ...shape,
      x1: (shape.x1 ?? 0) * sx,
      x2: (shape.x2 ?? 0) * sx,
      y1: (shape.y1 ?? 0) * sy,
      y2: (shape.y2 ?? 0) * sy,
      width: Math.abs((shape.x2 ?? 0) * sx - (shape.x1 ?? 0) * sx),
      height: Math.abs((shape.y2 ?? 0) * sy - (shape.y1 ?? 0) * sy),
      scaleX: 1,
      scaleY: 1,
      strokeWidth: shape.strokeWidth,
    }
  }
  if (shape.type === 'ellipse') {
    const rx = (shape.rx ?? shape.width / 2) * Math.abs(sx)
    const ry = (shape.ry ?? shape.height / 2) * Math.abs(sy)
    return {
      ...shape,
      rx,
      ry,
      width: rx * 2,
      height: ry * 2,
      scaleX: signX,
      scaleY: signY,
      strokeWidth: shape.strokeWidth,
    }
  }
  return {
    ...shape,
    width: shape.width * Math.abs(sx),
    height: shape.height * Math.abs(sy),
    rx: shape.rx,
    ry: shape.ry ?? shape.rx,
    scaleX: signX,
    scaleY: signY,
    strokeWidth: shape.strokeWidth,
  }
}

function axisSize(local: number, origin: number, scale: number, centered: boolean, min: number): number | null {
  const scaleAbs = Math.abs(scale) > 1e-6 ? Math.abs(scale) : 1
  if (!(origin === 0 || (origin > 0 && local < 0) || (origin < 0 && local > 0))) return null
  const multiplier = centered ? 2 : 1
  return Math.max(min, Math.abs((local * multiplier) / scaleAbs))
}

/**
 * New width/height from a control drag. `localX/Y` are pointer offsets from the
 * anchor (fabric's getLocalPoint). Shift locks the aspect ratio on corners.
 * Alt (centered) grows both sides.
 */
export function resizeDimensions(input: {
  localX: number
  localY: number
  originX: number
  originY: number
  width: number
  height: number
  scaleX: number
  scaleY: number
  proportional: boolean
  centered: boolean
  axes: ResizeAxes
  min?: number
}): { width: number; height: number } | null {
  const min = input.min ?? MIN_PX
  const width0 = Math.max(min, Math.abs(input.width) * (Math.abs(input.scaleX) || 1))
  const height0 = Math.max(min, Math.abs(input.height) * (Math.abs(input.scaleY) || 1))
  let width = input.axes === 'y' ? width0 : axisSize(input.localX, input.originX, input.scaleX, input.centered, min)
  let height = input.axes === 'x' ? height0 : axisSize(input.localY, input.originY, input.scaleY, input.centered, min)
  if (width === null || height === null) return null
  if (input.proportional && input.axes === 'both' && width0 > 0 && height0 > 0) {
    const sx = width / width0
    const sy = height / height0
    const scale = Math.abs(Math.log(sx)) >= Math.abs(Math.log(sy)) ? sx : sy
    width = Math.max(min, width0 * scale)
    height = Math.max(min, height0 * scale)
  } else if (input.proportional && input.axes === 'x' && width0 > 0) {
    height = Math.max(min, height0 * (width / width0))
  } else if (input.proportional && input.axes === 'y' && height0 > 0) {
    width = Math.max(min, width0 * (height / height0))
  }
  return { width, height }
}

export function snapTranslation(input: {
  box: Box
  guidesX: number[]
  guidesY: number[]
  threshold: number
}): { dx: number; dy: number; guideX: number | null; guideY: number | null } {
  const threshold = Math.max(0, input.threshold)
  const edgesX = [input.box.x, input.box.x + input.box.w / 2, input.box.x + input.box.w]
  const edgesY = [input.box.y, input.box.y + input.box.h / 2, input.box.y + input.box.h]
  let bestDx = 0
  let bestDy = 0
  let distX = threshold
  let distY = threshold
  let guideX: number | null = null
  let guideY: number | null = null
  for (const x of input.guidesX) {
    for (const edge of edgesX) {
      const delta = x - edge
      if (Math.abs(delta) < distX) {
        distX = Math.abs(delta)
        bestDx = delta
        guideX = x
      }
    }
  }
  for (const y of input.guidesY) {
    for (const edge of edgesY) {
      const delta = y - edge
      if (Math.abs(delta) < distY) {
        distY = Math.abs(delta)
        bestDy = delta
        guideY = y
      }
    }
  }
  if (distX >= threshold) {
    bestDx = 0
    guideX = null
  }
  if (distY >= threshold) {
    bestDy = 0
    guideY = null
  }
  return { dx: bestDx, dy: bestDy, guideX, guideY }
}

export type GapLabel = {
  x1: number
  y1: number
  x2: number
  y2: number
  labelX: number
  labelY: number
  mm: number
}

function near(a: number, b: number, epsilon: number) {
  return Math.abs(a - b) <= epsilon
}

function overlaps(a0: number, a1: number, b0: number, b1: number) {
  return Math.min(a1, b1) - Math.max(a0, b0) > 0.5
}

/** Gap labels when an edge lines up with another object or the label and a gap remains. */
export function measureGaps(moving: Box, others: Box[], dpi: number, epsilon = 0.75): GapLabel[] {
  const labels: GapLabel[] = []
  const pxPerMm = dpi / 25.4
  const push = (x1: number, y1: number, x2: number, y2: number) => {
    const distance = Math.hypot(x2 - x1, y2 - y1)
    if (distance < 1 || !Number.isFinite(pxPerMm) || pxPerMm <= 0) return
    labels.push({
      x1,
      y1,
      x2,
      y2,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2,
      mm: Math.round((distance / pxPerMm) * 10) / 10,
    })
  }
  const boxes = others.filter((box) => box.w > 0 || box.h > 0)
  for (const other of boxes) {
    const alignedY =
      near(moving.y, other.y, epsilon) ||
      near(moving.y + moving.h, other.y + other.h, epsilon) ||
      near(moving.y + moving.h / 2, other.y + other.h / 2, epsilon)
    if (alignedY && !overlaps(moving.x, moving.x + moving.w, other.x, other.x + other.w)) {
      const y = near(moving.y + moving.h / 2, other.y + other.h / 2, epsilon)
        ? moving.y + moving.h / 2
        : near(moving.y, other.y, epsilon)
          ? moving.y
          : moving.y + moving.h
      if (moving.x + moving.w <= other.x) push(moving.x + moving.w, y, other.x, y)
      else if (other.x + other.w <= moving.x) push(other.x + other.w, y, moving.x, y)
    }
    const alignedX =
      near(moving.x, other.x, epsilon) ||
      near(moving.x + moving.w, other.x + other.w, epsilon) ||
      near(moving.x + moving.w / 2, other.x + other.w / 2, epsilon)
    if (alignedX && !overlaps(moving.y, moving.y + moving.h, other.y, other.y + other.h)) {
      const x = near(moving.x + moving.w / 2, other.x + other.w / 2, epsilon)
        ? moving.x + moving.w / 2
        : near(moving.x, other.x, epsilon)
          ? moving.x
          : moving.x + moving.w
      if (moving.y + moving.h <= other.y) push(x, moving.y + moving.h, x, other.y)
      else if (other.y + other.h <= moving.y) push(x, other.y + other.h, x, moving.y)
    }
  }
  return labels.slice(0, 4)
}

/** Front-to-back id list. `before` means closer to the front (higher in the layers panel). */
export function reorderFrontToBack(ids: string[], movingId: string, overId: string, place: Exclude<DropPlace, 'into'>): string[] {
  if (movingId === overId || !ids.includes(movingId) || !ids.includes(overId)) return ids
  const next = ids.filter((id) => id !== movingId)
  let index = next.indexOf(overId)
  if (index < 0) return ids
  if (place === 'after') index += 1
  next.splice(index, 0, movingId)
  return next
}

export function zOrderPositions<T extends { id: string; x: number; y: number }>(items: T[], order: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  return order.map((id) => byId.get(id)).filter((item): item is T => !!item)
}

/** Arrow nudge. Plain arrows move 1 px. Shift moves 1 mm. */
export function nudgeStepPx(fast: boolean, dpi: number): number {
  if (!fast) return 1
  if (!Number.isFinite(dpi) || dpi <= 0) return 1
  return Math.max(1, Math.round(dpi / 25.4))
}

export function textResize(input: {
  mode: TextMode
  width: number
  height: number
  fontSize: number
  scaleX: number
  scaleY: number
  scaleTool: boolean
}): { mode: TextMode; width: number; height: number; fontSize: number; scaleX: number; scaleY: number } {
  const sx = Number.isFinite(input.scaleX) && input.scaleX !== 0 ? input.scaleX : 1
  const sy = Number.isFinite(input.scaleY) && input.scaleY !== 0 ? input.scaleY : 1
  const width = Math.max(MIN_PX, Math.abs(input.width * sx))
  const height = Math.max(MIN_PX, Math.abs(input.height * sy))
  if (input.scaleTool) {
    const factor = Math.max(Math.abs(sx), Math.abs(sy))
    return {
      mode: input.mode,
      width,
      height,
      fontSize: Math.max(4, input.fontSize * factor),
      scaleX: 1,
      scaleY: 1,
    }
  }
  return {
    mode: input.mode === 'auto' ? 'auto-height' : input.mode,
    width,
    height,
    fontSize: input.fontSize,
    scaleX: 1,
    scaleY: 1,
  }
}

/** Logical stroke width stays what the user typed. Inside/outside paint a doubled stroke and clip it. */
export function strokePaint(logicalPx: number, align: StrokeAlign): { strokeWidth: number; clip: 'none' | 'inside' | 'outside' } {
  const width = Math.max(0, logicalPx)
  if (align === 'inside') return { strokeWidth: width * 2, clip: 'inside' }
  if (align === 'outside') return { strokeWidth: width * 2, clip: 'outside' }
  return { strokeWidth: width, clip: 'none' }
}

export type HistoryState<T> = {
  entries: T[]
  index: number
  gesture: boolean
  wrote: boolean
}

/** One gesture (a drag, a scrub) replaces a single history entry. */
export function commitHistory<T>(
  state: HistoryState<T>,
  entry: T,
  equal: (a: T, b: T) => boolean,
  max: number,
): HistoryState<T> & { changed: boolean } {
  if (state.index >= 0 && state.entries[state.index] !== undefined && equal(state.entries[state.index] as T, entry)) {
    return { ...state, changed: false }
  }
  if (state.gesture && state.wrote && state.index >= 0) {
    const entries = state.entries.slice()
    entries[state.index] = entry
    return { entries, index: state.index, gesture: state.gesture, wrote: true, changed: true }
  }
  const entries = state.entries.slice(0, state.index + 1)
  entries.push(entry)
  const limit = Math.max(1, max)
  while (entries.length > limit) entries.shift()
  return {
    entries,
    index: entries.length - 1,
    gesture: state.gesture,
    wrote: state.gesture,
    changed: true,
  }
}
