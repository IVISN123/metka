import type { LabelDocument, Meta } from '../types'
import { LabelCodeError, barcodeDataUrl, barcodeProblem, qrDataUrl, qrProblem } from './codes'
import { assertCode, isVectorCodeJson, specFromMeta } from './vector-code'
import { formatPageLabel } from './pages'
import { fillTemplate, formatDate, verticalize } from './units'

type JsonObject = Record<string, unknown>

function asMeta(value: unknown): Meta | undefined {
  if (!value || typeof value !== 'object') return undefined
  const meta = value as Meta
  if (!meta.kind) return undefined
  return meta
}

function visitObjects(objects: unknown, visit: (obj: JsonObject) => void) {
  if (!Array.isArray(objects)) return
  for (const item of objects) {
    if (!item || typeof item !== 'object') continue
    const obj = item as JsonObject
    visit(obj)
    if (Array.isArray(obj.objects)) visitObjects(obj.objects, visit)
  }
}

export function applySeriesValue(doc: LabelDocument, id: string, value: string): LabelDocument {
  const clone = structuredClone(doc)
  visitObjects(clone.canvas.objects, (obj) => {
    const meta = asMeta(obj.data)
    if (!meta || meta.id !== id) return
    if (meta.kind === 'text' || meta.kind === 'datetime') {
      meta.sourceText = value
      obj.text = meta.vertical ? verticalize(value) : value
      obj.data = meta
    } else if (meta.kind === 'qr' || meta.kind === 'barcode') {
      meta.value = value
      obj.data = meta
    }
  })
  return clone
}

export async function materialize(
  doc: LabelDocument,
  row?: Record<string, string>,
  now = new Date(),
  pageNumber?: number,
): Promise<LabelDocument> {
  const clone = structuredClone(doc)
  const jobs: (() => Promise<void> | void)[] = []
  visitObjects(clone.canvas.objects, (obj) => {
    const meta = asMeta(obj.data)
    if (!meta) return
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
    } else if (meta.kind === 'qr' || meta.kind === 'barcode') {
      const value = fillTemplate(meta.value ?? '', row)
      if (isVectorCodeJson(obj)) {
        meta.value = value
        obj.data = meta
        const spec = specFromMeta(meta)
        if (!spec) return
        if (spec.kind === 'qr' && qrProblem(value || ' ', spec.ecl)) throw new LabelCodeError('qr')
        if (spec.kind === 'barcode' && barcodeProblem(value, spec.symbology)) throw new LabelCodeError('barcode')
        assertCode(spec)
      } else if (meta.kind === 'qr') {
        jobs.push(async () => {
          obj.src = await qrDataUrl(value, meta.ecl ?? 'M')
        })
      } else {
        jobs.push(() => {
          obj.src = barcodeDataUrl(value, meta.symbology ?? 'CODE128', meta.showText !== false)
        })
      }
    }
  })
  for (const job of jobs) await job()
  return clone
}
