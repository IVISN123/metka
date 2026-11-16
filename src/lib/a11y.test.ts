import { describe, expect, it } from 'vitest'
import { menuMove, nextFocusIndex } from './a11y'
import { translate } from '../i18n'
import { modelForLabel } from './presets'

describe('dialog focus wrap', () => {
  it('wraps forward and backward', () => {
    expect(nextFocusIndex(2, 3, false)).toBe(0)
    expect(nextFocusIndex(0, 3, true)).toBe(2)
    expect(nextFocusIndex(-1, 4, false)).toBe(0)
    expect(nextFocusIndex(-1, 4, true)).toBe(3)
    expect(nextFocusIndex(1, 4, false)).toBe(2)
  })
})

describe('menu keys', () => {
  it('moves and closes', () => {
    expect(menuMove('ArrowDown', -1, 3)).toBe(0)
    expect(menuMove('ArrowDown', 2, 3)).toBe(0)
    expect(menuMove('ArrowUp', 0, 3)).toBe(2)
    expect(menuMove('Home', 2, 5)).toBe(0)
    expect(menuMove('End', 0, 5)).toBe(4)
    expect(menuMove('Escape', 1, 3)).toBe('close')
    expect(menuMove('Enter', 1, 3)).toBeNull()
  })
})

describe('label model suggestion', () => {
  it('keeps D110 for a 12 mm tape and leaves it for a 40×30 card', () => {
    expect(modelForLabel('D110', 40, 12)).toBe('D110')
    expect(modelForLabel('D110', 40, 30)).not.toBe('D110')
    expect(modelForLabel('B21_PRO', 40, 30)).toBe('B21_PRO')
  })
})

describe('russian chrome', () => {
  it('does not leave IndexedDB or “drag” in the strings people see', () => {
    expect(translate('ru', 'templateHint')).not.toMatch(/IndexedDB/i)
    expect(translate('ru', 'keyAltDragHow')).not.toMatch(/drag/i)
    expect(translate('ru', 'textFixed')).not.toMatch(/фикс\./i)
    expect(translate('ru', 'csv')).not.toBe('CSV')
  })
})
