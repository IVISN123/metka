import { describe, expect, it } from 'vitest'
import { ImageEncoder, PageColorType, findPrintTask, getPrinterMetaById } from '@mmote/niimbluelib'
import { rfidFromClient } from './diag'
import { PRESETS, metaFor, presetGroup, presetSections, resolvePrintTask, suggestedTask } from './presets'
import {
  checkFirmware,
  firmwareFileModel,
  inkChoices,
  interpretLabel,
  labelsRemaining,
  padWidth,
  pageColorFor,
  paperSuggestion,
  settingsFromPrinter,
  shownVersion,
} from './printer-profile'
import { pickGrantedBluetooth, reconnectTransports } from './browser'
import { normalizeDocument } from './bundle'
import { mmToPx, padAxis } from './units'
import { emptyRfid } from '../types'

const ownerRoll = () =>
  rfidFromClient({
    label: { tagPresent: true, usedPaper: 77, allPaper: 276, consumablesType: 1, barCode: '' },
    paper: { paperWidth: 50, paperHeight: 30, totalHeight: 36, gapHeight: 6, paperType: 1 },
    paperRfidSuccess: true,
  })

describe('B21 Pro profile', () => {
  it('detects model 785 as B21 Pro at 300 dpi with the D110M_V4 task', () => {
    const byId = getPrinterMetaById(785)
    const meta = metaFor('B21_PRO')
    expect(byId?.model).toBe('B21_PRO')
    expect(meta).toMatchObject({
      dpi: 300,
      printDirection: 'top',
      printheadPixels: 591,
      densityMin: 1,
      densityMax: 5,
      densityDefault: 3,
      paperTypes: [1, 2, 3, 5],
    })
    expect(findPrintTask(meta!.model, 5)).toBe('D110M_V4')
    expect(suggestedTask('B21_PRO')).toEqual({ task: 'D110M_V4', guessed: false })
    expect(resolvePrintTask({ taskAuto: true, manual: 'B21_V1', detected: '', model: 'B21_PRO', protocolVersion: 5 })).toBe('D110M_V4')
    expect(resolvePrintTask({ taskAuto: true, manual: 'B1', detected: '', model: '#785', protocolVersion: 5 })).toBe('D110M_V4')
    expect(resolvePrintTask({ taskAuto: false, manual: 'B1', detected: 'D110M_V4', model: 'B21_PRO', protocolVersion: 5 })).toBe('B1')
  })

  it('does not change the task for D110, B1, or D11_H', () => {
    expect(resolvePrintTask({ taskAuto: true, manual: 'B1', detected: '', model: 'D110', protocolVersion: 2 })).toBe('D110')
    expect(resolvePrintTask({ taskAuto: true, manual: 'D110', detected: '', model: 'B1' })).toBe('B1')
    expect(resolvePrintTask({ taskAuto: true, manual: 'D110', detected: '', model: 'D11_H', protocolVersion: 4 })).toBe('D110M_V4')
    expect(metaFor('D110')).toMatchObject({ dpi: 203, printheadPixels: 96, printDirection: 'left' })
    expect(metaFor('B21')).toMatchObject({ dpi: 203, printheadPixels: 384 })
  })

  it('sizes a 50×30 mm label at 300 dpi and centers it on the 591-dot window', () => {
    expect(mmToPx(50, 300)).toBe(591)
    expect(mmToPx(30, 300)).toBe(354)
    expect(mmToPx(6, 300)).toBe(71)
    expect(mmToPx(36, 300)).toBe(425)
    expect(mmToPx(40, 300)).toBe(472)
    expect(padWidth(591, 576)).toBe(591)
    expect(padAxis(591, padWidth(591, 576), 'center')).toEqual({ offset: 0, size: 591, overflows: false })
    expect(padAxis(472, 591, 'center')).toEqual({ offset: 59, size: 591, overflows: false })
    expect(padAxis(591, 576, 'center').overflows).toBe(true)
    expect(mmToPx(12, 203)).toBe(96)
    expect(padAxis(240, 384, 'center')).toEqual({ offset: 72, size: 384, overflows: false })
  })

  it('suggests the loaded 50×30 gap label and the labels still on the roll', () => {
    const rfid = ownerRoll()
    expect(rfid).toMatchObject({ widthMm: 50, heightMm: 30, gapMm: 6, kind: 1, used: 77, total: 276, present: true, readOk: true })
    expect(labelsRemaining(rfid.total, rfid.used)).toBe(199)
    expect(paperSuggestion({ widthMm: 50, heightMm: null, totalMm: 36, gapMm: 6, labelType: 1 })).toEqual({
      widthMm: 50,
      heightMm: 30,
      gapMm: 6,
      labelType: 1,
    })
    expect(labelsRemaining(null, 1)).toBeNull()
    expect(labelsRemaining(-1, 0)).toBeNull()
  })

  it('lists common B21 Pro rolls ahead of tape sizes', () => {
    const sections = presetSections('B21_PRO')
    expect(sections[0]?.id).toBe('b21')
    expect(sections[0]?.items.map((item) => item.id)).toContain('50x30')
    expect(sections[0]?.items.map((item) => item.id)).toContain('20x10')
    expect(sections[1]?.items.map((item) => item.id)).toContain('12x40')
    expect(presetSections('D110').map((section) => section.id)).toEqual(['rest'])
    expect(presetSections('D110')[0]?.items.some((item) => item.id === '12x40')).toBe(true)
    expect(new Set(PRESETS.map((preset) => preset.id)).size).toBe(PRESETS.length)
    expect(presetGroup('50x30')).toBe('card')
    expect(presetGroup('20x10')).toBe('card')
    expect(presetGroup('12x40')).toBe('tape')
  })

  it('keeps 1-bit printing unless this task can do gray or red', () => {
    expect(pageColorFor('D110M_V4', 'black')).toBe(PageColorType.SingleColor)
    expect(pageColorFor('D110M_V4', 'gray')).toBe(PageColorType.Grayscale)
    expect(pageColorFor('D110M_V4', 'red')).toBe(PageColorType.DoubleColor)
    expect(pageColorFor('D110', 'gray')).toBe(PageColorType.SingleColor)
    expect(pageColorFor('D110', 'red')).toBe(PageColorType.SingleColor)
    expect(pageColorFor('B1', 'gray')).toBe(PageColorType.SingleColor)
    expect(pageColorFor('B1', 'red')).toBe(PageColorType.DoubleColor)
    expect(inkChoices('D110')).toEqual(['black'])
    expect(inkChoices('D110M_V4')).toEqual(['black', 'gray', 'red'])
    const source = {
      width: 8,
      height: 1,
      getPixelColor(x: number) {
        return x === 0 ? 0x000000 : 0xffffff
      },
    }
    const mono = ImageEncoder.encode(source, PageColorType.SingleColor, 'top')
    const gray = ImageEncoder.encode(source, PageColorType.Grayscale, 'top')
    expect(mono.pageColor).toBe(PageColorType.SingleColor)
    expect(gray.pageColor).toBe(PageColorType.Grayscale)
    expect(mono.cols).toBe(8)
    expect(gray.cols).toBe(8)
  })

  it('accepts a B21 Pro 3.13 image and refuses the wrong model, major, or downgrade', () => {
    expect(firmwareFileModel('B21_Pro_3.13.bin')).toBe('B21_PRO')
    expect(firmwareFileModel('D11_H_4.28.bin')).toBe('D11_H')
    expect(shownVersion('3.13/7.81')).toBe('3.13')
    expect(
      checkFirmware({ model: 'B21_PRO', hardware: '3.01', software: '3.13', fileName: 'B21_Pro_3.13.bin', version: '3.13' }).ok,
    ).toBe(true)
    expect(
      checkFirmware({ model: 'B21_PRO', hardware: '3.01', software: '3.13/7.81', fileName: 'B21_Pro_3.14.bin', version: '3.14' }).ok,
    ).toBe(true)
    expect(checkFirmware({ model: 'B21_PRO', hardware: '3.01', software: '3.13', fileName: 'D11_H_4.28.bin', version: '4.28' })).toEqual({
      ok: false,
      code: 'model',
    })
    expect(checkFirmware({ model: 'B21_PRO', hardware: '3.01', software: '3.13', fileName: 'B21_Pro_2.26.bin', version: '2.26' })).toEqual({
      ok: false,
      code: 'major',
    })
    expect(checkFirmware({ model: 'B21_PRO', hardware: '3.01', software: '3.13', fileName: 'B21_Pro_3.12.bin', version: '3.12' })).toEqual({
      ok: false,
      code: 'downgrade',
    })
    expect(checkFirmware({ model: 'B21_PRO', hardware: '3.01', software: '3.13', fileName: 'firmware.bin', version: '3.13' })).toEqual({
      ok: false,
      code: 'model',
    })
    expect(
      checkFirmware({ model: 'D11_H', hardware: '4.01', software: '4.22', fileName: 'D11_H_4.28.bin', version: '4.28' }).ok,
    ).toBe(true)
    expect(checkFirmware({ model: 'D11_H', hardware: '4.01', software: '4.22', fileName: 'B21_Pro_3.13.bin', version: '3.13' }).ok).toBe(false)
  })

  it('applies model settings for any supported printer and leaves the label size alone', () => {
    const b21 = settingsFromPrinter(
      { model: 'D110', density: 2, labelType: 4, task: 'D110' },
      { model: 'B21_PRO', dpi: 300, detectedTask: 'D110M_V4', protocol: 5, densityMin: 1, densityMax: 5, labelTypes: [1, 2, 3, 5] },
    )
    expect(b21).toMatchObject({ model: 'B21_PRO', dpi: 300, direction: 'top', density: 3, labelType: 1, task: 'D110M_V4', taskAuto: true })
    const again = settingsFromPrinter(
      { model: 'B21_PRO', density: 4, labelType: 1, task: 'D110M_V4' },
      { model: 'B21_PRO', dpi: 300, detectedTask: 'D110M_V4', protocol: 5, densityMin: 1, densityMax: 5, labelTypes: [1, 2, 3, 5] },
    )
    expect(again?.density).toBe(4)
    const d110 = settingsFromPrinter(
      { model: 'B21_PRO', density: 3, labelType: 1, task: 'D110M_V4' },
      { model: 'D110', dpi: 203, detectedTask: 'D110', protocol: 5, densityMin: 1, densityMax: 3, labelTypes: [1, 5] },
    )
    expect(d110).toMatchObject({ model: 'D110', dpi: 203, direction: 'left', density: 2, task: 'D110' })
    expect(settingsFromPrinter({ model: 'D110', density: 2, labelType: 1, task: 'D110' }, { model: '#999', dpi: null, detectedTask: '', protocol: 5, densityMin: null, densityMax: null, labelTypes: [] })).toBeNull()
    const roll = ownerRoll()
    expect(interpretLabel(roll).ok).toBe(true)
    expect(interpretLabel({ ...emptyRfid(), present: true })).toEqual({ ok: false, reason: 'nosize' })
    expect(interpretLabel(emptyRfid())).toEqual({ ok: false, reason: 'none' })
    const doc = normalizeDocument({ ...ownerDoc(), gapMm: 6 }, { clamp: true, maxImageChars: null })
    expect(doc.ok && doc.doc.gapMm).toBe(6)
  })

  it('reconnects a granted radio without a picker, and does nothing when none is granted', () => {
    expect(reconnectTransports({ bluetooth: 0, serial: 0, last: 'bluetooth' })).toEqual([])
    expect(reconnectTransports({ bluetooth: 1, serial: 1, last: null })).toEqual(['bluetooth', 'serial'])
    expect(reconnectTransports({ bluetooth: 1, serial: 2, last: 'serial' })).toEqual(['serial', 'bluetooth'])
    expect(pickGrantedBluetooth([])).toBeNull()
    expect(pickGrantedBluetooth([{ name: 'Headphones' }, { name: 'B21 Pro' }])?.name).toBe('B21 Pro')
    expect(pickGrantedBluetooth([{ name: '' }])?.name).toBe('')
  })
})

function ownerDoc() {
  return {
    version: 1,
    name: 'Камера',
    widthMm: 40,
    heightMm: 12,
    dpi: 203,
    model: 'D110',
    direction: 'left',
    labelType: 1,
    density: 2,
    quantity: 1,
    align: 'center',
    task: 'D110',
    taskAuto: true,
    preview: { mode: 'floyd', threshold: 168, invert: false },
    canvas: { objects: [] },
  }
}
