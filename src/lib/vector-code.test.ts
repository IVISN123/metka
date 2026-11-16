import { describe, expect, it } from 'vitest'
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'
import { normalizeDocument } from './bundle'
import { mmToPx } from './units'
import {
  assessCode,
  barcodePixelSize,
  effectiveEcl,
  encodeQrPayload,
  migrateCodeCanvas,
  rasterizeCode,
  sceneToSvg,
  vectorShapes,
  type CodeSpec,
} from './vector-code'

const qr = (patch: Partial<CodeSpec> = {}): CodeSpec => ({
  kind: 'qr',
  value: 'https://metka.dev/label',
  ecl: 'M',
  symbology: 'CODE128',
  showText: false,
  invert: false,
  mark: { qrKind: 'text', quiet: 4, moduleShape: 'square', finderShape: 'square' },
  ...patch,
})

const bars = (patch: Partial<CodeSpec> = {}): CodeSpec => ({
  kind: 'barcode',
  value: '4006381333931',
  ecl: 'M',
  symbology: 'EAN13',
  showText: false,
  invert: false,
  mark: { barFont: 'Arial, Helvetica, sans-serif', barFontSize: 14, barHeight: 70, moduleDots: 2 },
  ...patch,
})

function decode(pixels: Uint8Array, width: number, height: number, formats?: BarcodeFormat[]): string {
  const luminances = new Uint8ClampedArray(pixels)
  const source = new RGBLuminanceSource(luminances, width, height)
  const hints = new Map()
  hints.set(DecodeHintType.TRY_HARDER, true)
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    formats ?? [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
    ],
  )
  const reader = new MultiFormatReader()
  reader.setHints(hints)
  const attempts = [new HybridBinarizer(source), new GlobalHistogramBinarizer(source)]
  let last: unknown
  for (const binarizer of attempts) {
    try {
      return reader.decode(new BinaryBitmap(binarizer), hints).getText()
    } catch (error) {
      last = error
      reader.reset()
    }
  }
  throw last
}

function assertCrisp(pixels: Uint8Array) {
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index]
    if (value !== 0 && value !== 255) throw new Error(`gray pixel ${value} at ${index}`)
  }
}

describe('module snapping', () => {
  it('snaps a QR module to a whole number of printer dots and keeps the quiet zone white', () => {
    const width = mmToPx(18, 203)
    const report = assessCode(qr(), width, width)
    expect(report.moduleDots).toBeGreaterThanOrEqual(2)
    expect(Number.isInteger(report.moduleDots)).toBe(true)
    const raster = rasterizeCode(qr(), width, width)
    assertCrisp(raster.pixels)
    expect(raster.pixels[0]).toBe(255)
    expect(raster.report.moduleDots).toBe(report.moduleDots)
    const ink = raster.pixels.some((pixel) => pixel === 0)
    expect(ink).toBe(true)
  })

  it('grows the module when the same label is printed at 300 dpi', () => {
    const at203 = assessCode(qr(), mmToPx(18, 203), mmToPx(18, 203))
    const at300 = assessCode(qr(), mmToPx(18, 300), mmToPx(18, 300))
    expect(at300.moduleDots).toBeGreaterThan(at203.moduleDots)
    expect(at203.level).toBe('ok')
    expect(at300.level).toBe('ok')
  })

  it('warns when a module would be under two dots or the symbol cannot fit', () => {
    const tight = assessCode(qr(), 40, 40)
    expect(tight.moduleDots).toBeLessThan(2)
    expect(tight.level === 'small' || tight.level === 'dense').toBe(true)
    const dense = assessCode(qr({ value: 'https://metka.dev/label' }), 20, 20)
    expect(dense.level).toBe('dense')
  })

  it('keeps rounded modules and dots on a 1-bit grid', () => {
    for (const moduleShape of ['rounded', 'dots'] as const) {
      const raster = rasterizeCode(qr({ mark: { qrKind: 'text', quiet: 4, moduleShape, finderShape: 'rounded' } }), 160, 160)
      assertCrisp(raster.pixels)
    }
  })

  it('sizes a barcode from the module width in printer dots', () => {
    const spec = bars({ value: 'SN-0001', symbology: 'CODE128', showText: true })
    const box = barcodePixelSize(spec, 2, 60)
    const report = assessCode(spec, box.width, box.height)
    expect(report.moduleDots).toBe(2)
    expect(report.level).toBe('ok')
    const raster = rasterizeCode(spec, box.width, box.height)
    assertCrisp(raster.pixels)
    const textRow = raster.pixels.subarray(raster.width * (raster.height - 4))
    expect(textRow.some((pixel) => pixel === 0)).toBe(true)
  })
})

describe('scannability', () => {
  it('decodes a QR at 203 and 300 dpi', () => {
    for (const dpi of [203, 300]) {
      const side = mmToPx(18, dpi)
      const raster = rasterizeCode(qr(), side, side)
      expect(decode(raster.pixels, raster.width, raster.height)).toBe('https://metka.dev/label')
    }
  })

  it('decodes each barcode symbology from a snapped raster', () => {
    const samples: Array<[string, string, BarcodeFormat]> = [
      ['EAN13', '4006381333931', BarcodeFormat.EAN_13],
      ['EAN8', '73513537', BarcodeFormat.EAN_8],
      ['UPC', '036000291452', BarcodeFormat.UPC_A],
      ['ITF', '123456', BarcodeFormat.ITF],
      ['CODE39', 'CODE39', BarcodeFormat.CODE_39],
      ['CODE128', 'SN-0001', BarcodeFormat.CODE_128],
      ['codabar', 'A123456A', BarcodeFormat.CODABAR],
    ]
    for (const [symbology, value, format] of samples) {
      const spec = bars({ symbology, value, showText: false })
      const box = barcodePixelSize(spec, 2, 80)
      const raster = rasterizeCode(spec, box.width, box.height)
      assertCrisp(raster.pixels)
      const text = decode(raster.pixels, raster.width, raster.height, [format])
      expect(text.replace(/\*/g, ''), symbology).toContain(value.replace(/^A|A$/g, '') || value)
    }
  })
})

describe('qr payload and migration', () => {
  it('encodes the structured qr payloads and bumps correction for a logo', () => {
    expect(encodeQrPayload({ qrKind: 'wifi', wifi: { ssid: 'Дом', password: 'a;b', auth: 'WPA', hidden: false } }, '')).toBe(
      'WIFI:T:WPA;S:Дом;P:a\\;b;H:false;;',
    )
    expect(encodeQrPayload({ qrKind: 'phone', phone: '+79990001122' }, '')).toBe('tel:+79990001122')
    expect(encodeQrPayload({ qrKind: 'sms', sms: { number: '+7999', body: 'Привет' } }, '')).toContain('SMSTO:+7999:')
    expect(encodeQrPayload({ qrKind: 'email', email: { to: 'a@b.c', subject: 'Hi', body: 'Yo' } }, '')).toContain('mailto:a@b.c?')
    expect(encodeQrPayload({ qrKind: 'geo', geo: { lat: '55.75', lng: '37.62' } }, '')).toBe('geo:55.75,37.62')
    expect(encodeQrPayload({ qrKind: 'vcard', contact: { name: 'Илья', phone: '+7' } }, '')).toContain('FN:Илья')
    expect(effectiveEcl('L', 'metka', true)).toEqual({ ecl: 'Q', bumped: true })
    expect(effectiveEcl('Q', 'metka', true)).toEqual({ ecl: 'H', bumped: true })
    expect(effectiveEcl('H', 'metka', true).bumped).toBe(false)
    expect(effectiveEcl('M', 'metka', false)).toEqual({ ecl: 'M', bumped: false })
  })

  it('rebuilds an old image code from its stored text and leaves a photo alone', () => {
    const canvas = {
      objects: [
        {
          type: 'image',
          src: 'data:image/png,blurry-qr',
          width: 280,
          height: 280,
          scaleX: 0.5,
          scaleY: 0.5,
          left: 12,
          top: 8,
          data: { id: 'q', kind: 'qr', name: 'QR', value: 'SN-0001', ecl: 'M' },
        },
        {
          type: 'image',
          src: 'data:image/png,keep-me',
          width: 40,
          height: 40,
          data: { id: 'orphan', kind: 'qr', name: 'QR' },
        },
        {
          type: 'image',
          src: 'data:image/png,photo',
          width: 80,
          height: 80,
          data: { id: 'photo', kind: 'image', name: 'Фото' },
        },
        {
          type: 'group',
          objects: [
            {
              type: 'Image',
              src: 'data:image/png,blurry-bar',
              width: 200,
              height: 80,
              scaleX: 1.5,
              scaleY: 1,
              data: { id: 'b', kind: 'barcode', name: 'Штрихкод', value: 'SN-0001', symbology: 'CODE128', showText: true },
            },
          ],
        },
      ],
    }
    const migrated = migrateCodeCanvas(canvas)
    const qrObject = migrated.objects?.[0] as { type?: string; width?: number; src?: string; data?: { value?: string; mark?: { quiet?: number } } }
    expect(qrObject.type).toBe('VectorCode')
    expect(qrObject.width).toBe(140)
    expect(qrObject.src).toBeUndefined()
    expect(qrObject.data?.value).toBe('SN-0001')
    expect(qrObject.data?.mark?.quiet).toBe(0)
    const orphan = migrated.objects?.[1] as { type?: string; src?: string }
    expect(orphan.type).toBe('image')
    expect(orphan.src).toBe('data:image/png,keep-me')
    const photo = migrated.objects?.[2] as { type?: string; src?: string }
    expect(photo.type).toBe('image')
    expect(photo.src).toBe('data:image/png,photo')
    const group = migrated.objects?.[3] as { objects?: Array<{ type?: string; width?: number }> }
    expect(group.objects?.[0]?.type).toBe('VectorCode')
    expect(group.objects?.[0]?.width).toBe(300)
    expect(canvas.objects[0]).toMatchObject({ type: 'image', src: 'data:image/png,blurry-qr' })
  })

  it('migrates codes when a saved document is opened', () => {
    const raw = {
      version: 1,
      name: 'Старая',
      widthMm: 40,
      heightMm: 30,
      dpi: 203,
      canvas: {
        objects: [
          {
            type: 'image',
            src: 'data:image/png,old',
            width: 100,
            height: 100,
            scaleX: 1,
            scaleY: 1,
            data: { id: 'q', kind: 'qr', name: 'QR', value: 'SN-0001', ecl: 'H' },
          },
        ],
      },
    }
    const normalized = normalizeDocument(raw, { clamp: true, maxImageChars: null })
    expect(normalized.ok).toBe(true)
    if (!normalized.ok) return
    const object = (normalized.doc.canvas.objects as Array<{ type?: string }>)[0]
    expect(object?.type).toBe('VectorCode')
  })

  it('keeps the symbol as svg shapes rather than a picture', () => {
    const scene = vectorShapes(qr({ mark: { qrKind: 'text', quiet: 2, moduleShape: 'dots', finderShape: 'circle', logoId: 'barcode' } }), 180, 180)
    const svg = sceneToSvg(scene)
    expect(svg).toContain('<circle')
    expect(svg).toContain('<rect')
    expect(svg).not.toContain('data:image')
    expect(svg).toContain('<svg')
    const code = vectorShapes(bars({ value: 'SN-0001', symbology: 'CODE128', showText: true }), 220, 70)
    expect(sceneToSvg(code)).toContain('<text')
    expect(sceneToSvg(code)).toContain('SN-0001')
  })
})
