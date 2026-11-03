import type { LabelDocument, TemplateRecord } from '../types'

export type IncomingTemplate = {
  name: string
  thumbnail: string
  doc: LabelDocument
}

export type ImportPayload =
  | { type: 'templates'; items: IncomingTemplate[] }
  | { type: 'design'; doc: LabelDocument }

export function isLabelDocument(value: unknown): value is LabelDocument {
  if (!value || typeof value !== 'object') return false
  const doc = value as Partial<LabelDocument>
  return (
    doc.version === 1 &&
    typeof doc.name === 'string' &&
    typeof doc.widthMm === 'number' &&
    typeof doc.heightMm === 'number' &&
    typeof doc.dpi === 'number' &&
    !!doc.canvas &&
    typeof doc.canvas === 'object' &&
    (doc.direction === 'left' || doc.direction === 'top')
  )
}

export function serializeTemplates(records: TemplateRecord[]): string {
  return JSON.stringify(
    {
      kind: 'metka-templates',
      version: 1,
      app: 'metka',
      exportedAt: new Date().toISOString(),
      templates: records.map((record) => ({
        name: record.name,
        thumbnail: record.thumbnail,
        doc: record.doc,
      })),
    },
    null,
    2,
  )
}

export function serializeDesign(doc: LabelDocument, thumbnail = ''): string {
  return JSON.stringify(
    {
      kind: 'metka-design',
      version: 1,
      app: 'metka',
      exportedAt: new Date().toISOString(),
      thumbnail,
      doc,
    },
    null,
    2,
  )
}

export function parseImport(text: string): ImportPayload {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('importFail')
  }
  if (!data || typeof data !== 'object') throw new Error('importFail')
  const record = data as {
    kind?: string
    templates?: unknown
    doc?: unknown
    thumbnail?: string
  }
  if (record.kind === 'metka-templates' && Array.isArray(record.templates)) {
    const items: IncomingTemplate[] = []
    for (const entry of record.templates) {
      if (!entry || typeof entry !== 'object') continue
      const item = entry as { name?: unknown; thumbnail?: unknown; doc?: unknown }
      if (!isLabelDocument(item.doc)) continue
      items.push({
        name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.doc.name,
        thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : '',
        doc: item.doc,
      })
    }
    if (items.length === 0) throw new Error('importFail')
    return { type: 'templates', items }
  }
  if (record.kind === 'metka-design' && isLabelDocument(record.doc)) {
    return { type: 'design', doc: record.doc }
  }
  if (isLabelDocument(data)) return { type: 'design', doc: data }
  throw new Error('importFail')
}
