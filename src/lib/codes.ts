import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'

export async function qrDataUrl(value: string, ecl: 'L' | 'M' | 'Q' | 'H' = 'M'): Promise<string> {
  return QRCode.toDataURL(value || ' ', {
    errorCorrectionLevel: ecl,
    margin: 0,
    width: 280,
    color: { dark: '#000000', light: '#ffffff' },
  })
}

export function barcodeDataUrl(value: string, format: string, showText: boolean): string {
  const canvas = document.createElement('canvas')
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
  return canvas.toDataURL('image/png')
}
