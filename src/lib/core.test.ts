import { describe, expect, it } from 'vitest'
import { ImageEncoder, PageColorType, PrintError } from '@mmote/niimbluelib'
import { parseImport, serializeTemplates } from './bundle'
import { parseCsv, seriesValues } from './csv'
import { ditherLuma } from './dither'
import { formatPacketLine, rfidFromClient } from './diag'
import { formatPrintError } from './print-errors'
import { metaFor, resolvePrintTask, suggestedTask } from './presets'
import { fillTemplate, formatDate, mmToPx, padAxis, uniqueName, verticalize } from './units'
import type { LabelDocument, TemplateRecord } from '../types'

const doc = (): LabelDocument => ({
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
})

describe('units', () => {
  it('converts millimetres at 203 dpi', () => {
    expect(mmToPx(12, 203)).toBe(96)
    expect(mmToPx(40, 203)).toBe(320)
  })

  it('pads a narrow label onto the printhead', () => {
    expect(padAxis(96, 96, 'center')).toEqual({ offset: 0, size: 96, overflows: false })
    expect(padAxis(240, 384, 'center')).toEqual({ offset: 72, size: 384, overflows: false })
    expect(padAxis(400, 384, 'start').overflows).toBe(true)
  })

  it('fills placeholders and dates', () => {
    expect(fillTemplate('SN-{{ serial }}', { serial: '01' })).toBe('SN-01')
    expect(verticalize('01')).toBe('0\n1')
    expect(formatDate('DD.MM.YYYY', new Date(2026, 0, 5, 9, 7))).toBe('05.01.2026')
    expect(uniqueName('Камера', ['Камера', 'Камера (2)'])).toBe('Камера (3)')
  })
})

describe('series and csv', () => {
  it('builds a zero-padded series', () => {
    expect(seriesValues('', 1, 3, 2)).toEqual(['01', '02', '03'])
  })

  it('reads semicolon csv', () => {
    const parsed = parseCsv('serial;name\n01;Камера\n02;"A;B"')
    expect(parsed.headers).toEqual(['serial', 'name'])
    expect(parsed.rows[1]?.name).toBe('A;B')
  })
})

describe('dither', () => {
  it('thresholds to pure black or white', () => {
    const gray = new Float32Array([0, 40, 200, 255])
    const out = ditherLuma(gray, 2, 2, 'threshold', 128)
    expect([...out]).toEqual([0, 0, 255, 255])
  })

  it('spreads floyd error instead of posting a lone mid gray', () => {
    const gray = new Float32Array(4)
    gray[0] = 128
    const out = ditherLuma(gray, 2, 2, 'floyd', 128)
    expect(out.every((value) => value === 0 || value === 255)).toBe(true)
    expect(out[0]).toBe(255)
  })
})

describe('template files', () => {
  it('round-trips a template bundle and accepts a single design', () => {
    const record: TemplateRecord = {
      id: '1',
      name: 'Камера',
      createdAt: 1,
      updatedAt: 2,
      thumbnail: 'data:image/png,abc',
      doc: doc(),
    }
    const parsed = parseImport(serializeTemplates([record]))
    expect(parsed.type).toBe('templates')
    if (parsed.type !== 'templates') return
    expect(parsed.items[0]?.name).toBe('Камера')
    expect(parsed.items[0]?.doc.model).toBe('D110')
    const design = parseImport(JSON.stringify(doc()))
    expect(design.type).toBe('design')
    expect(() => parseImport('{')).toThrow()
  })
})

describe('D11_H print profile', () => {
  it('uses 300 DPI, a 142-dot head, and the D110M_V4 task', () => {
    const meta = metaFor('D11_H')
    expect(meta?.dpi).toBe(300)
    expect(meta?.printheadPixels).toBe(142)
    expect(meta?.printDirection).toBe('left')
    expect(mmToPx(12, meta?.dpi ?? 0)).toBe(142)
    expect(mmToPx(40, 300)).toBe(472)
    expect(suggestedTask('D11_H')).toEqual({ task: 'D110M_V4', guessed: false })
    expect(resolvePrintTask({ taskAuto: true, manual: 'D110', detected: '', model: 'D11_H' })).toBe('D110M_V4')
    expect(resolvePrintTask({ taskAuto: true, manual: 'B1', detected: 'D110M_V4', model: 'D110' })).toBe('D110M_V4')
    expect(resolvePrintTask({ taskAuto: false, manual: 'D110', detected: 'D110M_V4', model: 'D11_H' })).toBe('D110')
  })

  it('explains RFID write failure in Russian', () => {
    const text = formatPrintError(new PrintError('Print error 20: WriteRfidFail', 20), 'ru')
    expect(text).toContain('прошивка')
    expect(text).toContain('Официальное')
    expect(formatPrintError(new Error('Print error 20: WriteRfidFail'), 'ru')).toContain('RFID')
  })

  it('formats a short packet line and an unread roll', () => {
    const line = formatPacketLine('>>', 1, new Uint8Array([85, 85]))
    expect(line.startsWith('>> ')).toBe(true)
    expect(line).toContain('55 55')
    const unread = rfidFromClient({ paperRfidSuccess: false })
    expect(unread.present).toBeNull()
    expect(unread.readOk).toBe(false)
  })
})

describe('niimbluelib encoder', () => {
  it('packs a top-fed row and rotates a left-fed label', () => {
    const source = {
      width: 8,
      height: 2,
      getPixelColor(x: number, y: number) {
        return x === 0 && y === 0 ? 0x000000 : 0xffffff
      },
    }
    const top = ImageEncoder.encode(source, PageColorType.SingleColor, 'top')
    expect(top.cols).toBe(8)
    expect(top.rows).toBe(2)
    expect(top.rowsData[0]?.blackPixelsCount).toBe(1)
    const left = ImageEncoder.encode(source, PageColorType.SingleColor, 'left')
    expect(left.cols).toBe(8)
    expect(left.rows).toBe(8)
  })
})
