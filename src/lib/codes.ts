import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

const QR_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 } as const

export class LabelCodeError extends Error {
  readonly kind: 'barcode' | 'qr'
  constructor(kind: 'barcode' | 'qr') {
    super(kind === 'barcode' ? 'barcodeInvalid' : 'qrInvalid')
    this.name = 'LabelCodeError'
    this.kind = kind
  }
}

export type BarcodeProblem = 'empty' | 'charset' | 'length' | 'checksum' | 'format'

export function barcodeProblem(value: string, format: string): BarcodeProblem | null {
  const text = value.trim()
  if (!text) return 'empty'
  switch (format) {
    case 'EAN13':
      return eanProblem(text, 13, 12)
    case 'EAN8':
      return eanProblem(text, 8, 7)
    case 'UPC':
      return upcProblem(text)
    case 'ITF':
      if (!/^\d+$/.test(text)) return 'charset'
      return text.length >= 2 && text.length % 2 === 0 ? null : 'length'
    case 'CODE39':
      return /^[0-9A-Z\-. $/+%]+$/i.test(text) ? null : 'charset'
    case 'CODE128':
      return [...text].every((char) => {
        const code = char.charCodeAt(0)
        return code <= 127 || (code >= 0xc8 && code <= 0xd3)
      })
        ? null
        : 'charset'
    case 'codabar':
      if (/^[0-9\-$:/.+]+$/.test(text)) return null
      return /^[A-D][0-9\-$:/.+]+[A-D]$/i.test(text) ? null : 'charset'
    default:
      return 'format'
  }
}

export function qrProblem(value: string, ecl: string): 'level' | 'length' | null {
  if (ecl !== 'L' && ecl !== 'M' && ecl !== 'Q' && ecl !== 'H') return 'level'
  const bytes = new TextEncoder().encode(value || ' ').length
  if (bytes > QR_BYTES[ecl]) return 'length'
  return null
}

export async function qrDataUrl(value: string, ecl: 'L' | 'M' | 'Q' | 'H' = 'M'): Promise<string> {
  if (qrProblem(value, ecl)) throw new LabelCodeError('qr')
  try {
    return await QRCode.toDataURL(value || ' ', {
      errorCorrectionLevel: ecl,
      margin: 0,
      width: 280,
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch {
    throw new LabelCodeError('qr')
  }
}

export function barcodeDataUrl(value: string, format: string, showText: boolean): string {
  if (barcodeProblem(value, format)) throw new LabelCodeError('barcode')
  const canvas = document.createElement('canvas')
  try {
    JsBarcode(canvas, value, {
      format,
      displayValue: showText,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
      height: 80,
      width: 2,
      fontSize: 16,
      font: 'Arial',
      textMargin: 4,
    })
  } catch {
    throw new LabelCodeError('barcode')
  }
  return canvas.toDataURL('image/png')
}

function eanProblem(text: string, full: number, short: number): BarcodeProblem | null {
  if (!/^\d+$/.test(text)) return 'charset'
  if (text.length === short) return null
  if (text.length !== full) return 'length'
  const expected = full === 13 ? checksumEan13(text) : checksumEan8(text)
  return Number(text[full - 1]) === expected ? null : 'checksum'
}

function upcProblem(text: string): BarcodeProblem | null {
  if (!/^\d+$/.test(text)) return 'charset'
  if (text.length === 11) return null
  if (text.length !== 12) return 'length'
  return Number(text[11]) === checksumUpc(text) ? null : 'checksum'
}

function checksumEan13(number: string): number {
  const sum = number
    .slice(0, 12)
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10
}

function checksumEan8(number: string): number {
  const sum = number
    .slice(0, 7)
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

function checksumUpc(number: string): number {
  let sum = 0
  for (let index = 1; index < 11; index += 2) sum += Number(number[index])
  for (let index = 0; index < 11; index += 2) sum += Number(number[index]) * 3
  return (10 - (sum % 10)) % 10
}
