import type { LabelDocument, Meta } from '../types'
import { barcodeDataUrl, qrDataUrl } from './codes'
import { formatPageLabel } from './pages'
import { fillTemplate, formatDate, verticalize } from './units'

type JsonObject = Record<string, unknown>

function asMeta(value: unknown): Meta | undefined {
  if (!value || typeof value !== 'object') return undefined
  const meta = value as Meta
  if (!meta.kind) return undefined
  return meta
}

export function applySeriesValue(doc: LabelDocument, id: string, value: string): LabelDocument {
  const clone = structuredClone(doc)
  const objects = Array.isArray(clone.canvas.objects) ? (clone.canvas.objects as JsonObject[]) : []
  for (const obj of objects) {
    const meta = asMeta(obj.data)
    if (!meta || meta.id !== id) continue
    if (meta.kind === 'text' || meta.kind === 'datetime') {
      meta.sourceText = value
      obj.text = meta.vertical ? verticalize(value) : value
      obj.data = meta
    } else if (meta.kind === 'qr' || meta.kind === 'barcode') {
      meta.value = value
      obj.data = meta
    }
  }
  return clone
}

export async function materialize(
  doc: LabelDocument,
  row?: Record<string, string>,
  now = new Date(),
  pageNumber?: number,
): Promise<LabelDocument> {
  const clone = structuredClone(doc)
  const canvas = clone.canvas
  const objects = Array.isArray(canvas.objects) ? (canvas.objects as JsonObject[]) : []
  for (const obj of objects) {
    const meta = asMeta(obj.data)
    if (!meta) continue
    if (meta.kind === 'text') {
      const raw = fillTemplate(meta.sourceText ?? String(obj.text ?? ''), row)
      obj.text = meta.vertical ? verticalize(raw) : raw
    } else if (meta.kind === 'number') {
      const n = pageNumber ?? doc.pageFrom ?? 1
      obj.text = formatPageLabel(n, meta.prefix ?? '', meta.suffix ?? '', meta.pad ?? 0)
    } else if (meta.kind === 'datetime') {
      const formatted = meta.live === false ? (meta.sourceText ?? formatDate(meta.dateFormat ?? 'DD.MM.YYYY', now)) : formatDate(meta.dateFormat ?? 'DD.MM.YYYY', now)
      const raw = fillTemplate(formatted, row)
      obj.text = meta.vertical ? verticalize(raw) : raw
    } else if (meta.kind === 'qr') {
      const value = fillTemplate(meta.value ?? '', row)
      try {
        obj.src = await qrDataUrl(value, meta.ecl ?? 'M')
      } catch {
        /* keep the previous image */
      }
    } else if (meta.kind === 'barcode') {
      const value = fillTemplate(meta.value ?? '', row)
      try {
        obj.src = barcodeDataUrl(value, meta.symbology ?? 'CODE128', meta.showText !== false)
      } catch {
        /* keep the previous image */
      }
    }
  }
  return clone
}
