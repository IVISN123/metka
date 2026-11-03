import { describe, expect, it } from 'vitest'
import { ImageEncoder, PageColorType } from '@mmote/niimbluelib'
import { parseImport, serializeTemplates } from './bundle'
import { parseCsv, seriesValues } from './csv'
import { ditherLuma } from './dither'
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
