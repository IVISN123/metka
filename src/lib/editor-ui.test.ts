import { describe, expect, it } from 'vitest'
import {
  boxToMm,
  canBindSeries,
  classSetsDisplay,
  labelWord,
  matchEditorShortcut,
  originPoint,
  pinchZoom,
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
    expect(matchEditorShortcut(key({ key: '0', code: 'Digit0', meta: true }))).toEqual({ type: 'fit' })
    expect(matchEditorShortcut(key({ key: '+', code: 'Equal', meta: true }))).toEqual({ type: 'zoomIn' })
    expect(matchEditorShortcut(key({ key: '-', code: 'Minus', meta: true }))).toEqual({ type: 'zoomOut' })
    expect(matchEditorShortcut(key({ key: 'Delete', code: 'Delete' }))).toEqual({ type: 'delete' })
    expect(matchEditorShortcut(key({ key: 'Escape', code: 'Escape' }))).toEqual({ type: 'deselect' })
    expect(matchEditorShortcut(key({ key: 'ArrowLeft', code: 'ArrowLeft' }))).toEqual({ type: 'nudge', dx: -1, dy: 0 })
    expect(matchEditorShortcut(key({ key: 'ArrowDown', code: 'ArrowDown', shift: true }))).toEqual({ type: 'nudge', dx: 0, dy: 10 })
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

  it('detects a display utility even with a breakpoint prefix', () => {
    expect(classSetsDisplay('hidden sm:inline-flex')).toBe(true)
    expect(classSetsDisplay('w-full')).toBe(false)
    expect(classSetsDisplay('flex-1 items-center')).toBe(false)
  })
})
