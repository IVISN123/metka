import { describe, expect, it } from 'vitest'
import {
  bakeShapeScale,
  commitHistory,
  measureGaps,
  nudgeStepPx,
  reorderFrontToBack,
  resizeDimensions,
  snapTranslation,
  strokePaint,
  textResize,
  toggleSelection,
  zOrderPositions,
} from './transform'

describe('non-scaling stroke', () => {
  it('bakes a stretched rectangle into width and height and leaves stroke and radius alone', () => {
    const baked = bakeShapeScale({
      type: 'rect',
      width: 40,
      height: 20,
      scaleX: 3,
      scaleY: 0.5,
      strokeWidth: 2,
      rx: 8,
      ry: 8,
    })
    expect(baked.width).toBe(120)
    expect(baked.height).toBe(10)
    expect(baked.scaleX).toBe(1)
    expect(baked.scaleY).toBe(1)
    expect(baked.strokeWidth).toBe(2)
    expect(baked.rx).toBe(8)
    expect(baked.ry).toBe(8)
  })

  it('bakes an ellipse into its radii without touching the stroke', () => {
    const baked = bakeShapeScale({
      type: 'ellipse',
      width: 40,
      height: 20,
      scaleX: 2,
      scaleY: 4,
      strokeWidth: 3,
      rx: 20,
      ry: 10,
    })
    expect(baked.rx).toBe(40)
    expect(baked.ry).toBe(40)
    expect(baked.strokeWidth).toBe(3)
    expect(baked.scaleX).toBe(1)
    expect(baked.scaleY).toBe(1)
  })

  it('bakes a line into its endpoints', () => {
    const baked = bakeShapeScale({
      type: 'line',
      width: 60,
      height: 0,
      scaleX: 2,
      scaleY: 3,
      strokeWidth: 2,
      x1: -30,
      y1: 0,
      x2: 30,
      y2: 0,
    })
    expect(baked.x1).toBe(-60)
    expect(baked.x2).toBe(60)
    expect(baked.y1).toBe(0)
    expect(baked.y2).toBe(0)
    expect(baked.scaleX).toBe(1)
    expect(baked.strokeWidth).toBe(2)
  })
})

describe('resize modifiers', () => {
  it('stretches a side freely and locks corners when shift is held', () => {
    const side = resizeDimensions({
      localX: 80,
      localY: 0,
      originX: -0.5,
      originY: 0,
      width: 40,
      height: 20,
      scaleX: 1,
      scaleY: 1,
      proportional: false,
      centered: false,
      axes: 'x',
    })
    expect(side).toEqual({ width: 80, height: 20 })
    const corner = resizeDimensions({
      localX: 80,
      localY: 30,
      originX: -0.5,
      originY: -0.5,
      width: 40,
      height: 20,
      scaleX: 1,
      scaleY: 1,
      proportional: true,
      centered: false,
      axes: 'both',
    })
    expect(corner?.width).toBe(80)
    expect(corner?.height).toBe(40)
  })

  it('grows from the center when alt is held', () => {
    const next = resizeDimensions({
      localX: 40,
      localY: 20,
      originX: 0,
      originY: 0,
      width: 40,
      height: 20,
      scaleX: 1,
      scaleY: 1,
      proportional: false,
      centered: true,
      axes: 'both',
    })
    expect(next).toEqual({ width: 80, height: 40 })
  })

  it('ignores a pointer that has not crossed the anchored edge', () => {
    const next = resizeDimensions({
      localX: -5,
      localY: 0,
      originX: -0.5,
      originY: 0,
      width: 40,
      height: 20,
      scaleX: 1,
      scaleY: 1,
      proportional: false,
      centered: false,
      axes: 'x',
    })
    expect(next).toBeNull()
  })
})

describe('snapping', () => {
  it('snaps the left edge to the label and the center to another object', () => {
    const snap = snapTranslation({
      box: { x: 3, y: 40, w: 20, h: 10 },
      guidesX: [0, 50, 100],
      guidesY: [0, 45, 80],
      threshold: 6,
    })
    expect(snap.dx).toBe(-3)
    expect(snap.guideX).toBe(0)
    expect(snap.dy).toBe(0)
    expect(snap.guideY).toBe(45)
  })

  it('measures the gap when two boxes share an edge', () => {
    const labels = measureGaps(
      { x: 0, y: 0, w: 10, h: 10 },
      [{ x: 30, y: 0, w: 10, h: 10 }],
      254,
    )
    expect(labels).toHaveLength(1)
    expect(labels[0]?.mm).toBe(2)
    expect(labels[0]?.x1).toBe(10)
    expect(labels[0]?.x2).toBe(30)
  })
})

describe('layers and history', () => {
  it('shift-click adds to the selection and a plain click replaces it', () => {
    expect(toggleSelection(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleSelection(['a', 'b'], 'a', true)).toEqual(['b'])
    expect(toggleSelection(['a', 'b'], 'c', false)).toEqual(['c'])
  })

  it('reorders z-order without moving geometry', () => {
    const items = [
      { id: 'a', x: 1, y: 4 },
      { id: 'b', x: 8, y: 2 },
      { id: 'c', x: 3, y: 9 },
    ]
    const order = reorderFrontToBack(['c', 'b', 'a'], 'a', 'c', 'before')
    expect(order).toEqual(['a', 'c', 'b'])
    const placed = zOrderPositions(items, order)
    expect(placed.map((item) => item.id)).toEqual(['a', 'c', 'b'])
    expect(placed.find((item) => item.id === 'a')).toMatchObject({ x: 1, y: 4 })
    expect(placed.find((item) => item.id === 'c')).toMatchObject({ x: 3, y: 9 })
  })

  it('keeps a whole drag as one undo step', () => {
    let state = { entries: ['base'], index: 0, gesture: true, wrote: false }
    state = commitHistory(state, 'drag-a', (a, b) => a === b, 40)
    expect(state.entries).toEqual(['base', 'drag-a'])
    expect(state.index).toBe(1)
    state = commitHistory(state, 'drag-b', (a, b) => a === b, 40)
    expect(state.entries).toEqual(['base', 'drag-b'])
    expect(state.index).toBe(1)
    const released = { ...state, gesture: false, wrote: false }
    const second = commitHistory(released, 'next', (a, b) => a === b, 40)
    expect(second.entries).toEqual(['base', 'drag-b', 'next'])
    expect(second.index).toBe(2)
  })
})

describe('text and nudge', () => {
  it('resizes a text box without scaling glyphs unless the scale tool is on', () => {
    expect(
      textResize({ mode: 'auto-height', width: 100, height: 40, fontSize: 16, scaleX: 1.5, scaleY: 2, scaleTool: false }),
    ).toMatchObject({ width: 150, height: 80, fontSize: 16, scaleX: 1, scaleY: 1 })
    expect(
      textResize({ mode: 'auto', width: 80, height: 20, fontSize: 12, scaleX: 2, scaleY: 2, scaleTool: true }),
    ).toMatchObject({ fontSize: 24, width: 160, scaleX: 1 })
  })

  it('nudges by one pixel or one millimetre', () => {
    expect(nudgeStepPx(false, 203)).toBe(1)
    expect(nudgeStepPx(true, 203)).toBe(8)
    expect(nudgeStepPx(true, 300)).toBe(12)
  })

  it('doubles the painted stroke for inside and outside alignment', () => {
    expect(strokePaint(2, 'center')).toEqual({ strokeWidth: 2, clip: 'none' })
    expect(strokePaint(2, 'inside')).toEqual({ strokeWidth: 4, clip: 'inside' })
    expect(strokePaint(2, 'outside')).toEqual({ strokeWidth: 4, clip: 'outside' })
    expect(strokePaint(0, 'inside').strokeWidth).toBe(0)
  })
})
