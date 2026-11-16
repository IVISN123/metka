import { describe, expect, it } from 'vitest'
import { printBlockReason, connectBlock } from './browser'
import { parseImport } from './bundle'
import { barcodeProblem, qrProblem } from './codes'
import { decodeCsvBytes, parseCsv, seriesValues } from './csv'
import { historyDepth, rasterLimit, targetPhotoSize } from './limits'
import { materialize, applySeriesValue } from './materialize'
import { formatPrintError, linkErrorText } from './print-errors'
import { autosaveSignature } from './storage'
import { clampCopies, clampDpi, fillTemplate, localDateStamp, padAxis, parseMm } from './units'
import type { LabelDocument } from '../types'

const doc = (patch: Partial<LabelDocument> = {}): LabelDocument => ({
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
  ...patch,
})

describe('series and csv edges', () => {
  it('keeps the sign when a series crosses zero', () => {
    expect(seriesValues('SN', -1, 1, 2)).toEqual(['SN-01', 'SN00', 'SN01'])
  })

  it('reads tab-separated sheets and Cyrillic headers', () => {
    const parsed = parseCsv('serial\tимя\n01\tКамера')
    expect(parsed.headers).toEqual(['serial', 'имя'])
    expect(parsed.rows[0]).toEqual({ serial: '01', имя: 'Камера' })
  })

  it('splits classic Mac CR rows', () => {
    expect(parseCsv('a,b\r1,2').rows).toEqual([{ a: '1', b: '2' }])
  })

  it('does not treat a comma inside quotes as the separator', () => {
    const parsed = parseCsv('"a,b";c\n1;2')
    expect(parsed.headers).toEqual(['a,b', 'c'])
    expect(parsed.rows[0]).toEqual({ 'a,b': '1', c: '2' })
  })

  it('keeps a newline inside quotes and a UTF-16 sheet', () => {
    expect(parseCsv('a,b\n"hello\nworld",2').rows[0]).toEqual({ a: 'hello\nworld', b: '2' })
    const utf16 = Uint8Array.from([0xff, 0xfe, 0x41, 0x00, 0x2c, 0x00, 0x42, 0x00])
    expect(decodeCsvBytes(utf16.buffer.slice(utf16.byteOffset, utf16.byteOffset + utf16.byteLength))).toBe('A,B')
  })

  it('keeps empty cells and a blank delimited row', () => {
    const parsed = parseCsv('serial,name,note\n01,,Камера\n,\n02,Только,')
    expect(parsed.rows[0]).toEqual({ serial: '01', name: '', note: 'Камера' })
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.rows[1]).toEqual({ serial: '', name: '', note: '' })
    expect(parsed.rows[2]?.note).toBe('')
  })

  it('keeps both columns when the header is repeated or blank', () => {
    expect(parseCsv('name,name\nА,Б').rows[0]).toEqual({ name: 'А', 'name (2)': 'Б' })
    expect(parseCsv(',name\n01,Камера').rows[0]).toEqual({ column1: '01', name: 'Камера' })
  })

  it('fills Cyrillic placeholders without caring about letter case', () => {
    expect(fillTemplate('{{Имя}} {{серия}}', { имя: 'Камера', серия: '' })).toBe('Камера ')
    expect(fillTemplate('X{{missing}}Y', {})).toBe('XY')
  })
})

describe('import edges', () => {
  it('accepts an older design that has no version or direction', () => {
    const parsed = parseImport(
      JSON.stringify({ name: 'Старая', widthMm: 40, heightMm: 12, dpi: 203, canvas: { objects: [] } }),
    )
    expect(parsed.type).toBe('design')
    if (parsed.type !== 'design') return
    expect(parsed.doc.version).toBe(1)
    expect(parsed.doc.direction).toBe('left')
    expect(parsed.doc.preview.mode).toBe('floyd')
    expect(parsed.doc.model).toBe('D110')
  })

  it('accepts a template list saved before the kind field existed', () => {
    const parsed = parseImport(
      JSON.stringify({
        templates: [{ name: 'Старая', doc: { name: 'Старая', widthMm: 50, heightMm: 30, dpi: 203, canvas: {} } }],
      }),
    )
    expect(parsed.type).toBe('templates')
    if (parsed.type !== 'templates') return
    expect(parsed.items[0]?.name).toBe('Старая')
    expect(parsed.items[0]?.doc.direction).toBe('left')
  })

  it('rejects a future file, a huge label, and nonsense', () => {
    expect(() => parseImport(JSON.stringify({ ...doc(), version: 2 }))).toThrow(/importVersion/)
    expect(() => parseImport(JSON.stringify({ ...doc(), widthMm: 10000 }))).toThrow(/importSize/)
    expect(() => parseImport(JSON.stringify({ ...doc(), dpi: Number.NaN }))).toThrow(/importSize|importFail/)
    expect(() => parseImport('null')).toThrow(/importFail/)
    expect(() => parseImport('[]')).toThrow(/importFail/)
  })
})

describe('barcode and placeholders', () => {
  it('refuses an invalid EAN-13 instead of keeping the previous picture', async () => {
    const label = doc({
      canvas: {
        objects: [
          {
            type: 'image',
            src: 'data:image/png,previous',
            data: { id: 'b', kind: 'barcode', name: 'Штрихкод', value: '4006381333932', symbology: 'EAN13', showText: true },
          },
        ],
      },
    })
    await expect(materialize(label)).rejects.toThrow(/barcodeInvalid/)
  })

  it('fills a placeholder that sits inside a group', async () => {
    const label = doc({
      canvas: {
        objects: [
          {
            type: 'group',
            objects: [
              {
                type: 'textbox',
                text: '{{имя}}',
                data: { id: 't', kind: 'text', name: 'Текст', sourceText: '{{имя}}' },
              },
            ],
          },
        ],
      },
    })
    const filled = await materialize(label, { имя: 'Камера' })
    const group = filled.canvas.objects?.[0] as { objects?: { text?: string }[] }
    expect(group.objects?.[0]?.text).toBe('Камера')
  })

  it('writes a series value into a nested barcode field', () => {
    const label = doc({
      canvas: {
        objects: [
          {
            type: 'group',
            objects: [
              {
                type: 'image',
                data: { id: 'b', kind: 'barcode', name: 'Штрихкод', value: 'SN-{{n}}', symbology: 'CODE128' },
              },
            ],
          },
        ],
      },
    })
    const next = applySeriesValue(label, 'b', 'SN-02')
    const group = next.canvas.objects?.[0] as { objects?: { data?: { value?: string } }[] }
    expect(group.objects?.[0]?.data?.value).toBe('SN-02')
  })
})

describe('sizes and transport messages', () => {
  it('does not turn a bad pad length into NaN', () => {
    expect(Number.isFinite(padAxis(Number.NaN, 384, 'center').size)).toBe(true)
    expect(Number.isFinite(padAxis(Number.POSITIVE_INFINITY, 384, 'start').size)).toBe(true)
  })

  it('explains a dropped connection and a missing bluetooth API in Russian', () => {
    expect(formatPrintError(new DOMException('Failed to execute', 'NetworkError'), 'ru')).toMatch(/отключ/i)
    expect(formatPrintError(new TypeError("Cannot read properties of undefined (reading 'requestDevice')"), 'ru')).toMatch(/Bluetooth|браузер/i)
    expect(formatPrintError(new DOMException('secure origin', 'SecurityError'), 'en')).toMatch(/HTTPS|secure/i)
    expect(linkErrorText('linkLost', 'ru')).toMatch(/отключ/i)
  })

  it('reads a comma decimal and refuses a blank custom size', () => {
    expect(parseMm('12,5')).toBe(12.5)
    expect(parseMm('40')).toBe(40)
    expect(parseMm('')).toBeNull()
    expect(parseMm('8mm')).toBeNull()
    expect(clampCopies(Number.NaN)).toBeNull()
    expect(clampCopies(0)).toBe(1)
    expect(clampCopies(500)).toBe(200)
    expect(clampDpi(Number.NaN)).toBeNull()
    expect(clampDpi(50)).toBe(96)
  })

  it('names the browser that cannot print', () => {
    expect(printBlockReason({ ios: true, secure: false, bluetooth: false, serial: false })).toBe('insecure-ios')
    expect(printBlockReason({ ios: true, secure: true, bluetooth: false, serial: false })).toBe('ios')
    expect(printBlockReason({ ios: false, secure: true, bluetooth: false, serial: true })).toBe('bluetooth')
    expect(printBlockReason({ ios: false, secure: true, bluetooth: true, serial: false })).toBeNull()
    expect(connectBlock('bluetooth', { ios: false, secure: true, bluetooth: false, serial: true })).toBe('bluetoothMissing')
    expect(connectBlock('serial', { ios: false, secure: false, bluetooth: false, serial: false })).toBe('insecure')
  })
})

describe('encodings, barcodes, and heavy files', () => {
  it('decodes a Windows-1251 sheet and leaves UTF-8 Cyrillic alone', () => {
    const bytes = windows1251('имя;значение\nКамера;А-01')
    const text = decodeCsvBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
    expect(parseCsv(text).rows[0]).toEqual({ имя: 'Камера', значение: 'А-01' })
    const utf8 = new TextEncoder().encode('имя,Камера')
    expect(decodeCsvBytes(utf8.buffer.slice(utf8.byteOffset, utf8.byteOffset + utf8.byteLength))).toBe('имя,Камера')
  })

  it('rejects a bad EAN-13 checksum and Cyrillic in Code 128', () => {
    expect(barcodeProblem('4006381333931', 'EAN13')).toBeNull()
    expect(barcodeProblem('400638133393', 'EAN13')).toBeNull()
    expect(barcodeProblem('4006381333932', 'EAN13')).toBe('checksum')
    expect(barcodeProblem('73513537', 'EAN8')).toBeNull()
    expect(barcodeProblem('73513538', 'EAN8')).toBe('checksum')
    expect(barcodeProblem('036000291452', 'UPC')).toBeNull()
    expect(barcodeProblem('123', 'ITF')).toBe('length')
    expect(barcodeProblem('Камера', 'CODE128')).toBe('charset')
    expect(barcodeProblem('SN-0001', 'CODE128')).toBeNull()
    expect(barcodeProblem('', 'EAN13')).toBe('empty')
    expect(qrProblem('x'.repeat(3000), 'M')).toBe('length')
    expect(qrProblem('Камера', 'M')).toBeNull()
  })

  it('stops a huge file and a photo-heavy canvas before they are stored', () => {
    expect(() => parseImport('{"ok":true}', { maxChars: 4 })).toThrow(/importTooLarge/)
    const heavy = doc({ canvas: { objects: [{ type: 'image', src: `data:image/png,${'A'.repeat(80)}` }] } })
    expect(() => parseImport(JSON.stringify(heavy), { maxImageChars: 40 })).toThrow(/importPhoto/)
    const parsed = parseImport(
      JSON.stringify({
        kind: 'metka-templates',
        version: 1,
        templates: [{ name: 'A', thumbnail: 'x'.repeat(50), doc: doc() }],
      }),
      { maxThumbChars: 10 },
    )
    expect(parsed.type).toBe('templates')
    if (parsed.type !== 'templates') return
    expect(parsed.items[0]?.thumbnail).toBe('')
  })

  it('shrinks undo history and dither buffers for a large photo', () => {
    expect(historyDepth(100)).toBe(40)
    expect(historyDepth(2_000_000)).toBe(8)
    expect(rasterLimit(4000, 3000, 200.2, 150.2)).toEqual({ width: 200, height: 150 })
    expect(rasterLimit(80, 40, 200, 150)).toEqual({ width: 80, height: 40 })
    expect(rasterLimit(210, 160, 200, 150)).toEqual({ width: 210, height: 160 })
    expect(targetPhotoSize(4000, 3000, 2048)).toEqual({ width: 2048, height: 1536 })
    expect(targetPhotoSize(800, 600, 2048)).toBeNull()
  })

  it('autosaves print settings that are not part of the canvas revision', () => {
    const base = {
      contentRev: 1,
      name: 'Камера',
      designId: null,
      ready: true,
      dirty: true,
      quantity: 1,
      align: 'center',
      task: 'D110',
      taskAuto: true,
      labelType: 1,
      direction: 'left',
      density: 2,
      pageFrom: 1,
      pageTo: 1,
      widthMm: 40,
      heightMm: 12,
      dpi: 203,
      model: 'D110',
      preview: { mode: 'floyd' as const, threshold: 168, invert: false },
    }
    expect(autosaveSignature({ ...base, quantity: 2 })).not.toBe(autosaveSignature(base))
    expect(autosaveSignature({ ...base, align: 'end' })).not.toBe(autosaveSignature(base))
    expect(autosaveSignature({ ...base, task: 'B1', taskAuto: false })).not.toBe(autosaveSignature(base))
    expect(localDateStamp(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05')
  })
})

function windows1251(text: string): Uint8Array {
  const bytes: number[] = []
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x7f) bytes.push(code)
    else if (code >= 0x410 && code <= 0x44f) bytes.push(code - 0x410 + 0xc0)
    else if (code === 0x401) bytes.push(0xa8)
    else if (code === 0x451) bytes.push(0xb8)
    else throw new Error(`unmapped ${code.toString(16)}`)
  }
  return Uint8Array.from(bytes)
}
