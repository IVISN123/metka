import { describe, expect, it } from 'vitest'
import { iconById, searchSymbols, symbolSvg } from './icons'
import {
  alignDelta,
  boxToMm,
  canBindSeries,
  classSetsDisplay,
  defaultCornerMm,
  distributeDelta,
  gridStops,
  labelWord,
  matchEditorShortcut,
  mmOnLabel,
  originPoint,
  pinchZoom,
  rulerLayout,
  rulerStepMm,
  topLeftBox,
  type ShortcutInput,
} from './editor-ui'

const key = (partial: Partial<ShortcutInput>): ShortcutInput => ({
  key: '',
  code: '',
  meta: false,
  shift: false,
  alt: false,
  ...partial,
})

describe('editor shortcuts', () => {
  it('maps the editing keys', () => {
    expect(matchEditorShortcut(key({ key: 'z', code: 'KeyZ', meta: true }))).toEqual({ type: 'undo' })
    expect(matchEditorShortcut(key({ key: 'Z', code: 'KeyZ', meta: true, shift: true }))).toEqual({ type: 'redo' })
    expect(matchEditorShortcut(key({ key: 'y', code: 'KeyY', meta: true }))).toEqual({ type: 'redo' })
    expect(matchEditorShortcut(key({ key: 'd', code: 'KeyD', meta: true }))).toEqual({ type: 'duplicate' })
    expect(matchEditorShortcut(key({ key: 'g', code: 'KeyG', meta: true }))).toEqual({ type: 'group' })
    expect(matchEditorShortcut(key({ key: 'G', code: 'KeyG', meta: true, shift: true }))).toEqual({ type: 'ungroup' })
    expect(matchEditorShortcut(key({ key: 'k', code: 'KeyK' }))).toEqual({ type: 'scale' })
    expect(matchEditorShortcut(key({ key: '0', code: 'Digit0', meta: true }))).toEqual({ type: 'fit' })
    expect(matchEditorShortcut(key({ key: '+', code: 'Equal', meta: true }))).toEqual({ type: 'zoomIn' })
    expect(matchEditorShortcut(key({ key: '-', code: 'Minus', meta: true }))).toEqual({ type: 'zoomOut' })
    expect(matchEditorShortcut(key({ key: 'Delete', code: 'Delete' }))).toEqual({ type: 'delete' })
    expect(matchEditorShortcut(key({ key: 'Escape', code: 'Escape' }))).toEqual({ type: 'deselect' })
    expect(matchEditorShortcut(key({ key: 'ArrowLeft', code: 'ArrowLeft' }))).toEqual({ type: 'nudge', dx: -1, dy: 0, fast: false })
    expect(matchEditorShortcut(key({ key: 'ArrowDown', code: 'ArrowDown', shift: true }))).toEqual({ type: 'nudge', dx: 0, dy: 1, fast: true })
    expect(matchEditorShortcut(key({ key: ' ', code: 'Space' }))).toEqual({ type: 'pan' })
    expect(matchEditorShortcut(key({ key: 's', code: 'KeyS', meta: true }))).toBeNull()
  })
})

describe('pinch and geometry', () => {
  it('scales zoom from the finger distance and clamps it', () => {
    expect(pinchZoom(100, 200, 1)).toBe(2)
    expect(pinchZoom(80, 40, 2)).toBe(1)
    expect(pinchZoom(10, 10000, 1)).toBe(12)
    expect(pinchZoom(0, 40, 1.5)).toBe(1.5)
  })

  it('converts a center-origin box to a top-left millimetre frame', () => {
    expect(topLeftBox(50, 20, 100, 40, 1, 1, 'center', 'center')).toEqual({ x: 0, y: 0, w: 100, h: 40 })
    expect(originPoint(0, 0, 100, 40, 'center', 'center')).toEqual({ left: 50, top: 20 })
    expect(boxToMm({ x: 0, y: 0, w: 96, h: 96 }, 203)).toEqual({ x: 0, y: 0, w: 12, h: 12 })
  })

  it('picks a Russian label plural', () => {
    expect(labelWord(1, 'ru')).toBe('этикетка')
    expect(labelWord(2, 'ru')).toBe('этикетки')
    expect(labelWord(5, 'ru')).toBe('этикеток')
    expect(labelWord(11, 'ru')).toBe('этикеток')
    expect(labelWord(21, 'ru')).toBe('этикетка')
    expect(labelWord(1, 'en')).toBe('label')
    expect(labelWord(3, 'en')).toBe('labels')
  })

  it('knows which objects can take a series', () => {
    expect(canBindSeries('text')).toBe(true)
    expect(canBindSeries('qr')).toBe(true)
    expect(canBindSeries('image')).toBe(false)
    expect(canBindSeries(undefined)).toBe(false)
  })

  it('aligns and distributes boxes without touching the print path', () => {
    expect(alignDelta({ left: 10, top: 4, width: 20, height: 8 }, { left: 0, top: 0, width: 100, height: 40 }, 'left')).toEqual({ dx: -10, dy: 0 })
    expect(alignDelta({ left: 10, top: 4, width: 20, height: 10 }, { left: 0, top: 0, width: 80, height: 30 }, 'center')).toEqual({ dx: 20, dy: 0 })
    const deltas = distributeDelta(
      [
        { left: 0, top: 0, width: 10, height: 10 },
        { left: 40, top: 0, width: 10, height: 10 },
        { left: 100, top: 0, width: 10, height: 10 },
      ],
      'x',
    )
    expect(deltas[0]).toBe(0)
    expect(deltas[2]).toBe(0)
    expect(deltas[1]).toBeCloseTo(10)
  })

  it('picks a corner radius from the label size and ruler ticks from zoom', () => {
    expect(defaultCornerMm(40, 12)).toBe(1.5)
    expect(defaultCornerMm(50, 30)).toBe(2)
    expect(defaultCornerMm(80, 50)).toBe(3)
    expect(rulerStepMm(8)).toBe(5)
    expect(rulerStepMm(2)).toBeGreaterThanOrEqual(20)
    const laid = rulerLayout({ startMm: -2, endMm: 42, pxPerMm: 8, originPx: 80, labelPx: 320, labelMm: 40 })
    const zero = laid.find((mark) => mark.mm === 0)
    const end = laid.find((mark) => mark.mm === 40)
    expect(zero?.x).toBe(80)
    expect(end?.x).toBe(400)
    expect(end?.rank).toBe('edge')
    expect(mmOnLabel(40, 80, 320, 40)).toBe(400)
    const labels = laid.filter((mark) => mark.rank === 'label' || mark.rank === 'edge')
    for (let index = 1; index < labels.length; index += 1) {
      const gap = (labels[index]?.x ?? 0) - (labels[index - 1]?.x ?? 0)
      expect(gap).toBeGreaterThanOrEqual(34)
    }
    expect(gridStops(100, 10, 2)).toEqual([0, 20, 40, 60, 80, 100])
  })

  it('paints label symbols black for thermal output and finds them in Russian', () => {
    const fragile = iconById('fragile')
    expect(fragile).toBeTruthy()
    expect(symbolSvg(fragile!, '#000000')).toContain('stroke="#000000"')
    expect(symbolSvg(iconById('laurel')!, 'currentColor')).toContain('currentColor')
    expect(symbolSvg(iconById('laurel')!, 'currentColor')).not.toContain('#111')
    expect(searchSymbols('хруп', 'pack').some((icon) => icon.id === 'fragile')).toBe(true)
    expect(searchSymbols('wifi', 'all').some((icon) => icon.id === 'wifi')).toBe(true)
  })

  it('detects a display utility even with a breakpoint prefix', () => {
    expect(classSetsDisplay('hidden sm:inline-flex')).toBe(true)
    expect(classSetsDisplay('w-full')).toBe(false)
    expect(classSetsDisplay('flex-1 items-center')).toBe(false)
  })
})
