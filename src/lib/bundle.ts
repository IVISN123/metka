import type { LabelDocument, PreviewSettings, TemplateRecord } from '../types'

export type IncomingTemplate = {
  name: string
  thumbnail: string
  doc: LabelDocument
}

export type ImportPayload =
  | { type: 'templates'; items: IncomingTemplate[] }
  | { type: 'design'; doc: LabelDocument }

export type ImportLimits = {
  maxChars?: number
  maxImageChars?: number
  maxThumbChars?: number
}

export const IMPORT_LIMITS = {
  maxChars: 12_000_000,
  maxImageChars: 6_000_000,
  maxThumbChars: 400_000,
}

const SIZE = { minW: 8, maxW: 120, minH: 8, maxH: 200, minDpi: 96, maxDpi: 600 }

type DocError = 'invalid' | 'version' | 'size' | 'photo'

export function isLabelDocument(value: unknown): value is LabelDocument {
  return normalizeDocument(value, { clamp: false, maxImageChars: null }).ok
}

export function normalizeDocument(
  value: unknown,
  opts: { clamp: boolean; maxImageChars: number | null },
): { ok: true; doc: LabelDocument } | { ok: false; error: DocError } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'invalid' }
  const raw = value as Record<string, unknown>
  if (raw.version !== undefined && raw.version !== 1 && raw.version !== 0) return { ok: false, error: 'version' }
  if ('name' in raw && raw.name !== undefined && typeof raw.name !== 'string') return { ok: false, error: 'invalid' }
  if (!raw.canvas || typeof raw.canvas !== 'object' || Array.isArray(raw.canvas)) return { ok: false, error: 'invalid' }
  if (opts.maxImageChars !== null && imageTooBig(raw.canvas, opts.maxImageChars)) return { ok: false, error: 'photo' }
  const width = requiredNumber(raw, 'widthMm')
  const height = requiredNumber(raw, 'heightMm')
  const dpi = optionalNumber(raw, 'dpi', 203)
  if (width === null || height === null || dpi === null) return { ok: false, error: 'size' }
  const outOfRange =
    width < SIZE.minW || width > SIZE.maxW || height < SIZE.minH || height > SIZE.maxH || dpi < SIZE.minDpi || dpi > SIZE.maxDpi
  if (outOfRange && !opts.clamp) return { ok: false, error: 'size' }
  if (raw.direction !== undefined && raw.direction !== 'left' && raw.direction !== 'top') return { ok: false, error: 'invalid' }
  const align = raw.align === 'start' || raw.align === 'end' || raw.align === 'center' ? raw.align : 'center'
  const doc: LabelDocument = {
    version: 1,
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : 'Новая этикетка',
    widthMm: Math.min(SIZE.maxW, Math.max(SIZE.minW, width)),
    heightMm: Math.min(SIZE.maxH, Math.max(SIZE.minH, height)),
    dpi: Math.min(SIZE.maxDpi, Math.max(SIZE.minDpi, Math.round(dpi))),
    model: typeof raw.model === 'string' && raw.model ? raw.model : 'D110',
    direction: raw.direction === 'top' ? 'top' : 'left',
    labelType: finiteInt(raw.labelType, 1, 0, 20),
    density: finiteInt(raw.density, 2, 1, 15),
    quantity: finiteInt(raw.quantity, 1, 1, 200),
    align,
    task: typeof raw.task === 'string' && raw.task ? raw.task : 'D110',
    taskAuto: raw.taskAuto !== false,
    preview: previewOf(raw.preview),
    canvas: raw.canvas as Record<string, unknown>,
  }
  const pageFrom = optionalNumber(raw, 'pageFrom')
  const pageTo = optionalNumber(raw, 'pageTo')
  if (pageFrom !== null && 'pageFrom' in raw) doc.pageFrom = Math.round(pageFrom)
  if (pageTo !== null && 'pageTo' in raw) doc.pageTo = Math.round(pageTo)
  const gap = optionalNumber(raw, 'gapMm')
  if (gap !== null && gap >= 0 && gap <= 50) doc.gapMm = Math.round(gap * 10) / 10
  return { ok: true, doc }
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

export function parseImport(text: string, limits: ImportLimits = {}): ImportPayload {
  const maxChars = limits.maxChars ?? IMPORT_LIMITS.maxChars
  const maxImageChars = limits.maxImageChars ?? IMPORT_LIMITS.maxImageChars
  const maxThumbChars = limits.maxThumbChars ?? IMPORT_LIMITS.maxThumbChars
  if (text.length > maxChars) throw new Error('importTooLarge')
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('importFail')
  }
  if (Array.isArray(data)) return templatesFrom(data, maxImageChars, maxThumbChars)
  if (!data || typeof data !== 'object') throw new Error('importFail')
  const record = data as Record<string, unknown>
  if ((record.kind === 'metka-templates' || record.kind === 'metka-design') && record.version !== undefined && record.version !== 1) {
    throw new Error('importVersion')
  }
  if (record.kind === 'metka-templates' || (record.kind === undefined && Array.isArray(record.templates))) {
    if (!Array.isArray(record.templates)) throw new Error('importFail')
    return templatesFrom(record.templates, maxImageChars, maxThumbChars)
  }
  if (record.kind === 'metka-design') return designFrom(record.doc, maxImageChars)
  if (record.doc && typeof record.doc === 'object') return designFrom(record.doc, maxImageChars)
  return designFrom(record, maxImageChars)
}

function designFrom(value: unknown, maxImageChars: number): ImportPayload {
  const normalized = normalizeDocument(value, { clamp: false, maxImageChars })
  if (!normalized.ok) throw docError(normalized.error)
  return { type: 'design', doc: normalized.doc }
}

function templatesFrom(entries: unknown[], maxImageChars: number, maxThumbChars: number): ImportPayload {
  const items: IncomingTemplate[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const source = item.doc && typeof item.doc === 'object' ? item.doc : item
    const normalized = normalizeDocument(source, { clamp: false, maxImageChars })
    if (!normalized.ok) {
      if (normalized.error === 'invalid') continue
      throw docError(normalized.error)
    }
    const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : normalized.doc.name
    const thumbnail = typeof item.thumbnail === 'string' && item.thumbnail.length <= maxThumbChars ? item.thumbnail : ''
    items.push({ name, thumbnail, doc: { ...normalized.doc, name } })
  }
  if (items.length === 0) throw new Error('importFail')
  return { type: 'templates', items }
}

function docError(error: DocError): Error {
  if (error === 'version') return new Error('importVersion')
  if (error === 'size') return new Error('importSize')
  if (error === 'photo') return new Error('importPhoto')
  return new Error('importFail')
}

function previewOf(value: unknown): PreviewSettings {
  const preview = value && typeof value === 'object' ? (value as Partial<PreviewSettings>) : {}
  const mode = preview.mode === 'threshold' || preview.mode === 'atkinson' || preview.mode === 'floyd' ? preview.mode : 'floyd'
  const threshold =
    typeof preview.threshold === 'number' && Number.isFinite(preview.threshold) ? Math.min(255, Math.max(0, Math.round(preview.threshold))) : 168
  const sharpness = preview.sharpness === 'clear' || preview.sharpness === 'strong' || preview.sharpness === 'off' ? preview.sharpness : 'off'
  return { mode, threshold, invert: preview.invert === true, sharpness }
}

function requiredNumber(raw: Record<string, unknown>, key: string): number | null {
  if (!(key in raw)) return null
  return finite(raw[key])
}

function optionalNumber(raw: Record<string, unknown>, key: string, fallback?: number): number | null {
  if (!(key in raw) || raw[key] === undefined) return fallback ?? null
  return finite(raw[key])
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function finiteInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

function imageTooBig(value: unknown, maxChars: number): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((item) => imageTooBig(item, maxChars))
  const record = value as Record<string, unknown>
  if (typeof record.src === 'string' && record.src.startsWith('data:') && record.src.length > maxChars) return true
  return Object.values(record).some((item) => item && typeof item === 'object' && imageTooBig(item, maxChars))
}
