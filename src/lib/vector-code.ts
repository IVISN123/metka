import JsBarcode from 'jsbarcode'
import QRCode from 'qrcode'
import type { CodeMark, FinderShape, Meta, ModuleShape, QrContentKind, WifiAuth } from '../types'
import { LabelCodeError, barcodeProblem, qrProblem } from './codes'
import { iconById, symbolSvg } from './icons'

export const VECTOR_CODE_TYPE = 'VectorCode'

export type CodeKind = 'qr' | 'barcode'
export type ScanLevel = 'ok' | 'small' | 'dense' | 'bars'

export type CodeSpec = {
  kind: CodeKind
  value: string
  ecl: 'L' | 'M' | 'Q' | 'H'
  symbology: string
  showText: boolean
  invert: boolean
  mark: CodeMark
}

export type ScanReport = {
  level: ScanLevel
  moduleDots: number
  cols: number
  rows: number
  quiet: number
  bumped: boolean
  ecl: 'L' | 'M' | 'Q' | 'H'
  barDots: number
}

export type DrawShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number; fill: string }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string }
  | { kind: 'text'; x: number; y: number; text: string; font: string; size: number; fill: string }
  | { kind: 'icon'; id: string; x: number; y: number; size: number; fill: string }

export type CodeScene = {
  width: number
  height: number
  shapes: DrawShape[]
  report: ScanReport
}

export type RasterText = {
  text: string
  font: string
  size: number
  x: number
  y: number
  w: number
  h: number
  ink: number
}

export type CodeRaster = {
  width: number
  height: number
  /** 0 ink, 255 paper. No gray. */
  pixels: Uint8Array
  report: ScanReport
  plate: { x: number; y: number; w: number; h: number; id: string } | null
  text: RasterText | null
}

type BarcodeBits = {
  bits: string
  quietLeft: number
  quietRight: number
  guards: Array<[number, number]>
  text: string
}

const FORMAT_KEY: Record<string, string> = {
  EAN13: 'EAN13',
  EAN8: 'EAN8',
  UPC: 'UPC',
  ITF: 'ITF',
  CODE39: 'CODE39',
  CODE128: 'CODE128',
  codabar: 'codabar',
}

type Encoder = { valid: () => boolean; encode: () => unknown }
type EncoderCtor = new (data: string, options: Record<string, unknown>) => Encoder

export function isVectorCodeJson(obj: { type?: unknown }): boolean {
  return String(obj.type ?? '').toLowerCase() === 'vectorcode'
}

export function specFromMeta(meta: Meta | undefined | null): CodeSpec | null {
  if (!meta || (meta.kind !== 'qr' && meta.kind !== 'barcode')) return null
  return {
    kind: meta.kind,
    value: meta.value ?? '',
    ecl: meta.ecl ?? 'M',
    symbology: meta.symbology || 'CODE128',
    showText: meta.showText !== false,
    invert: !!meta.invert,
    mark: { ...defaultMark(meta.kind), ...meta.mark },
  }
}

export function defaultMark(kind: CodeKind): CodeMark {
  if (kind === 'qr') {
    return { qrKind: 'text', quiet: 4, moduleShape: 'square', finderShape: 'square' }
  }
  return {
    barFont: 'Arial, Helvetica, sans-serif',
    barFontSize: 14,
    barHeight: 56,
    moduleDots: 2,
  }
}

export function mergeMark(base: CodeMark | undefined, patch: CodeMark | undefined): CodeMark {
  if (!patch) return { ...(base ?? {}) }
  return {
    ...base,
    ...patch,
    wifi: patch.wifi ? { ...base?.wifi, ...patch.wifi } : base?.wifi,
    contact: patch.contact ? { ...base?.contact, ...patch.contact } : base?.contact,
    sms: patch.sms ? { ...base?.sms, ...patch.sms } : base?.sms,
    email: patch.email ? { ...base?.email, ...patch.email } : base?.email,
    geo: patch.geo ? { ...base?.geo, ...patch.geo } : base?.geo,
  }
}

export function encodeQrPayload(mark: CodeMark, text: string): string {
  const kind: QrContentKind = mark.qrKind ?? 'text'
  if (kind === 'text') return text
  if (kind === 'wifi') {
    const auth: WifiAuth = mark.wifi?.auth ?? 'WPA'
    const hidden = mark.wifi?.hidden ? 'true' : 'false'
    return `WIFI:T:${auth};S:${escapeWifi(mark.wifi?.ssid ?? '')};P:${escapeWifi(mark.wifi?.password ?? '')};H:${hidden};;`
  }
  if (kind === 'vcard') {
    const contact = mark.contact
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${oneLine(contact?.name ?? '')}`, `N:${oneLine(contact?.name ?? '')}`]
    if (contact?.org) lines.push(`ORG:${oneLine(contact.org)}`)
    if (contact?.phone) lines.push(`TEL:${oneLine(contact.phone)}`)
    if (contact?.email) lines.push(`EMAIL:${oneLine(contact.email)}`)
    lines.push('END:VCARD')
    return lines.join('\n')
  }
  if (kind === 'phone') return `tel:${oneLine(mark.phone ?? '')}`
  if (kind === 'sms') return `SMSTO:${oneLine(mark.sms?.number ?? '')}:${mark.sms?.body ?? ''}`
  if (kind === 'email') {
    const query = new URLSearchParams()
    if (mark.email?.subject) query.set('subject', mark.email.subject)
    if (mark.email?.body) query.set('body', mark.email.body)
    const suffix = query.toString()
    return `mailto:${oneLine(mark.email?.to ?? '')}${suffix ? `?${suffix}` : ''}`
  }
  return `geo:${oneLine(mark.geo?.lat ?? '0')},${oneLine(mark.geo?.lng ?? '0')}`
}

/** Logo covers the center, so correction steps up when the payload still fits. */
export function effectiveEcl(requested: CodeSpec['ecl'], value: string, logo: boolean): { ecl: CodeSpec['ecl']; bumped: boolean } {
  const payload = value || ' '
  if (logo) {
    const bumped: CodeSpec['ecl'] = requested === 'H' ? 'H' : requested === 'Q' ? 'H' : 'Q'
    if (!qrProblem(payload, bumped)) return { ecl: bumped, bumped: bumped !== requested }
  }
  if (qrProblem(payload, requested)) throw new LabelCodeError('qr')
  return { ecl: requested, bumped: false }
}

export function assertCode(spec: CodeSpec) {
  if (spec.kind === 'qr') buildQr(spec)
  else encodeBarcode(spec.value, spec.symbology)
}

export function assessCode(spec: CodeSpec, width: number, height: number): ScanReport {
  const boxW = Math.max(1, Math.round(width))
  const boxH = Math.max(1, Math.round(height))
  if (spec.kind === 'qr') return assessQr(spec, boxW, boxH)
  return assessBarcode(spec, boxW, boxH)
}

export function vectorShapes(spec: CodeSpec, width: number, height: number): CodeScene {
  const boxW = Math.max(1, width)
  const boxH = Math.max(1, height)
  if (spec.kind === 'qr') return qrScene(spec, boxW, boxH, false)
  return barcodeScene(spec, boxW, boxH, false)
}

export function sceneToSvg(scene: CodeScene): string {
  const body = scene.shapes.map(shapeSvg).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${scene.width} ${scene.height}" width="100%" height="100%">${body}</svg>`
}

export function rasterizeCode(spec: CodeSpec, width: number, height: number): CodeRaster {
  const boxW = Math.max(1, Math.round(width))
  const boxH = Math.max(1, Math.round(height))
  const pixels = new Uint8Array(boxW * boxH)
  if (spec.kind === 'qr') return rasterQr(spec, boxW, boxH, pixels)
  return rasterBarcode(spec, boxW, boxH, pixels)
}

/** Draw the human-readable line into a finished raster. Bars stay hard-edged. */
export function paintRasterText(raster: CodeRaster) {
  const band = raster.text
  if (!band || band.w < 2 || band.h < 2) return
  if (typeof document !== 'undefined') {
    const before = inkCount(raster.pixels, raster.width, band)
    paintCanvasText(raster)
    if (inkCount(raster.pixels, raster.width, band) > before) return
  }
  paintBitmapText(raster)
}

export function barcodePixelSize(spec: CodeSpec, moduleDots: number, barHeight: number): { width: number; height: number } {
  const bits = encodeBarcode(spec.value, spec.symbology)
  const cols = bits.quietLeft + bits.bits.length + bits.quietRight
  const module = clampInt(moduleDots, 1, 12)
  const text = spec.showText ? textBand(spec) : 0
  return {
    width: Math.max(1, cols * module),
    height: Math.max(1, clampInt(barHeight, 4, 400) + text),
  }
}

export function migrateCodeCanvas(canvas: Record<string, unknown>): Record<string, unknown> {
  const objects = canvas.objects
  if (!Array.isArray(objects)) return canvas
  return { ...canvas, objects: objects.map((item) => migrateNode(item)) }
}

export function worstScan(canvas: Record<string, unknown>): ScanReport | null {
  let worst: ScanReport | null = null
  visit(canvas.objects, (obj) => {
    const meta = asMeta(obj.data)
    const spec = specFromMeta(meta)
    if (!spec || !spec.value.trim()) return
    const width = Math.abs(num(obj.width, 0) * num(obj.scaleX, 1))
    const height = Math.abs(num(obj.height, 0) * num(obj.scaleY, 1))
    if (width < 2 || height < 2) return
    let report: ScanReport
    try {
      report = assessCode(spec, width, height)
    } catch {
      return
    }
    if (!worst || rank(report.level) > rank(worst.level)) worst = report
  })
  return worst
}

export function paintIcon(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, color: string) {
  const icon = iconById(id)
  if (!icon || size < 2) return
  if (icon.glyphs && icon.glyphs.length > 0 && typeof Path2D !== 'undefined') {
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(size / 24, size / 24)
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    const filled = !!icon.filled
    for (const glyph of icon.glyphs) {
      if (glyph.t === 'path' && glyph.d) {
        const path = new Path2D(glyph.d)
        if (filled) ctx.fill(path)
        else ctx.stroke(path)
        continue
      }
      ctx.beginPath()
      if (glyph.t === 'circle') ctx.arc(num(glyph.cx, 0), num(glyph.cy, 0), num(glyph.r, 0), 0, Math.PI * 2)
      else if (glyph.t === 'line') {
        ctx.moveTo(num(glyph.x1, 0), num(glyph.y1, 0))
        ctx.lineTo(num(glyph.x2, 0), num(glyph.y2, 0))
      } else if (glyph.t === 'rect') ctx.rect(num(glyph.x, 0), num(glyph.y, 0), num(glyph.width, 0), num(glyph.height, 0))
      else if (glyph.t === 'polygon' || glyph.t === 'polyline') tracePoints(ctx, glyph.points ?? '', glyph.t === 'polygon')
      if (filled || glyph.t === 'polygon' || glyph.t === 'rect' || glyph.t === 'circle') {
        if (filled || glyph.t === 'polygon') ctx.fill()
        else ctx.stroke()
      } else ctx.stroke()
    }
    ctx.restore()
  }
}

function assessQr(spec: CodeSpec, width: number, height: number): ScanReport {
  const built = buildQr(spec)
  const quiet = quietModules(spec)
  const grid = built.qr.modules.size + quiet * 2
  const module = Math.floor(Math.min(width / grid, height / grid))
  const level: ScanLevel = module < 1 ? 'dense' : module < 2 ? 'small' : 'ok'
  return { level, moduleDots: Math.max(0, module), cols: grid, rows: grid, quiet, bumped: built.bumped, ecl: built.ecl, barDots: module }
}

function assessBarcode(spec: CodeSpec, width: number, height: number): ScanReport {
  const bits = encodeBarcode(spec.value, spec.symbology)
  const cols = bits.quietLeft + bits.bits.length + bits.quietRight
  const module = Math.floor(width / cols)
  const band = spec.showText ? textBand(spec) : 0
  const barDots = Math.max(0, height - band)
  let level: ScanLevel = 'ok'
  if (module < 1 || barDots < 4) level = 'dense'
  else if (module < 2) level = 'small'
  else if (barDots < 8) level = 'bars'
  return { level, moduleDots: Math.max(0, module), cols, rows: 1, quiet: bits.quietLeft, bumped: false, ecl: spec.ecl, barDots }
}

function qrScene(spec: CodeSpec, width: number, height: number, snapped: boolean): CodeScene {
  const built = buildQr(spec)
  const matrix = built.qr.modules
  const size = matrix.size
  const quiet = quietModules(spec)
  const grid = size + quiet * 2
  const module = snapped ? Math.max(1, Math.floor(Math.min(width / grid, height / grid))) : Math.min(width / grid, height / grid)
  const used = module * grid
  const ox = snapped ? Math.floor((width - used) / 2) : (width - used) / 2
  const oy = snapped ? Math.floor((height - used) / 2) : (height - used) / 2
  const ink = spec.invert ? '#ffffff' : '#000000'
  const paper = spec.invert ? '#000000' : '#ffffff'
  const shapes: DrawShape[] = [{ kind: 'rect', x: 0, y: 0, w: width, h: height, rx: 0, fill: paper }]
  const finder = spec.mark.finderShape ?? 'square'
  const shape = spec.mark.moduleShape ?? 'square'
  const plate = logoPlate(size, spec.mark.logoId)
  const runs = new Map<number, Array<[number, number]>>()
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (inFinder(row, col, size) && finder !== 'square') continue
      if (plate && inPlate(row, col, plate)) continue
      const dark = matrix.get(row, col) === 1
      if (dark === spec.invert) continue
      const functional = matrix.isReserved(row, col) === 1
      const look: ModuleShape = functional ? 'square' : shape
      if (look === 'square') {
        const list = runs.get(row) ?? []
        const last = list[list.length - 1]
        if (last && last[1] === col) last[1] = col + 1
        else list.push([col, col + 1])
        runs.set(row, list)
        continue
      }
      const x = ox + (col + quiet) * module
      const y = oy + (row + quiet) * module
      if (look === 'dots') shapes.push({ kind: 'circle', cx: x + module / 2, cy: y + module / 2, r: module * 0.46, fill: ink })
      else shapes.push({ kind: 'rect', x, y, w: module, h: module, rx: module * 0.32, fill: ink })
    }
  }
  for (const [row, list] of runs) {
    const y = oy + (row + quiet) * module
    for (const [start, end] of list) {
      const x = ox + (start + quiet) * module
      shapes.push({ kind: 'rect', x, y, w: (end - start) * module, h: module, rx: 0, fill: ink })
    }
  }
  if (finder !== 'square') {
    for (const [row, col] of finderOrigins(size)) pushFinder(shapes, ox + (col + quiet) * module, oy + (row + quiet) * module, module, finder, ink, paper)
  }
  if (plate) {
    const x = ox + (plate.col + quiet) * module
    const y = oy + (plate.row + quiet) * module
    const side = plate.span * module
    shapes.push({ kind: 'rect', x, y, w: side, h: side, rx: side * 0.12, fill: paper })
    const pad = side * 0.16
    shapes.push({ kind: 'icon', id: plate.id, x: x + pad, y: y + pad, size: side - pad * 2, fill: ink })
  }
  return {
    width,
    height,
    shapes,
    report: {
      level: module < 1 ? 'dense' : module < 2 ? 'small' : 'ok',
      moduleDots: Math.max(0, Math.floor(module)),
      cols: grid,
      rows: grid,
      quiet,
      bumped: built.bumped,
      ecl: built.ecl,
      barDots: Math.floor(module),
    },
  }
}

function barcodeScene(spec: CodeSpec, width: number, height: number, snapped: boolean): CodeScene {
  const bits = encodeBarcode(spec.value, spec.symbology)
  const cols = bits.quietLeft + bits.bits.length + bits.quietRight
  const band = spec.showText ? Math.min(height * 0.45, textBand(spec)) : 0
  const module = snapped ? Math.max(1, Math.floor(width / cols)) : width / cols
  const used = module * cols
  const ox = snapped ? Math.floor((width - used) / 2) : (width - used) / 2
  const barH = Math.max(1, height - band)
  const ink = spec.invert ? '#ffffff' : '#000000'
  const paper = spec.invert ? '#000000' : '#ffffff'
  const shapes: DrawShape[] = [{ kind: 'rect', x: 0, y: 0, w: width, h: height, rx: 0, fill: paper }]
  let run = -1
  const paintRun = (end: number) => {
    if (run < 0) return
    shapes.push({ kind: 'rect', x: ox + run * module, y: 0, w: (end - run) * module, h: barH, rx: 0, fill: ink })
    run = -1
  }
  for (let index = 0; index < bits.bits.length; index += 1) {
    const guard = bits.guards.some(([from, to]) => index >= from && index < to)
    const x = ox + (index + bits.quietLeft) * module
    if (bits.bits[index] !== '1') {
      paintRun(index + bits.quietLeft)
      continue
    }
    if (guard && spec.showText) {
      paintRun(index + bits.quietLeft)
      const extra = Math.min(band * 0.55, module * 4)
      shapes.push({ kind: 'rect', x, y: 0, w: module, h: barH + extra, rx: 0, fill: ink })
      continue
    }
    if (run < 0) run = index + bits.quietLeft
  }
  paintRun(bits.bits.length + bits.quietLeft)
  if (spec.showText && bits.text) {
    shapes.push({
      kind: 'text',
      x: width / 2,
      y: height - band * 0.22,
      text: bits.text,
      font: spec.mark.barFont || 'Arial, Helvetica, sans-serif',
      size: Math.max(8, band * 0.72),
      fill: ink,
    })
  }
  const moduleDots = Math.floor(module)
  const barDots = Math.floor(barH)
  let level: ScanLevel = 'ok'
  if (moduleDots < 1 || barDots < 4) level = 'dense'
  else if (moduleDots < 2) level = 'small'
  else if (barDots < 8) level = 'bars'
  return {
    width,
    height,
    shapes,
    report: { level, moduleDots: Math.max(0, moduleDots), cols, rows: 1, quiet: bits.quietLeft, bumped: false, ecl: spec.ecl, barDots },
  }
}

function rasterQr(spec: CodeSpec, width: number, height: number, pixels: Uint8Array): CodeRaster {
  const built = buildQr(spec)
  const matrix = built.qr.modules
  const size = matrix.size
  const quiet = quietModules(spec)
  const grid = size + quiet * 2
  const module = Math.max(1, Math.floor(Math.min(width / grid, height / grid)))
  const used = module * grid
  const ox = Math.floor((width - used) / 2)
  const oy = Math.floor((height - used) / 2)
  const ink = spec.invert ? 255 : 0
  const paper = spec.invert ? 0 : 255
  pixels.fill(paper)
  const finder = spec.mark.finderShape ?? 'square'
  const shape = spec.mark.moduleShape ?? 'square'
  const plate = logoPlate(size, spec.mark.logoId)
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (inFinder(row, col, size) && finder !== 'square') continue
      if (plate && inPlate(row, col, plate)) continue
      const dark = matrix.get(row, col) === 1
      if (dark === spec.invert) continue
      const functional = matrix.isReserved(row, col) === 1
      const x = ox + (col + quiet) * module
      const y = oy + (row + quiet) * module
      fillModule(pixels, width, height, x, y, module, functional ? 'square' : shape, ink)
    }
  }
  if (finder !== 'square') {
    for (const [row, col] of finderOrigins(size)) {
      stampFinder(pixels, width, height, ox + (col + quiet) * module, oy + (row + quiet) * module, module, finder, ink, paper)
    }
  }
  let plateBox: CodeRaster['plate'] = null
  if (plate) {
    const x = ox + (plate.col + quiet) * module
    const y = oy + (plate.row + quiet) * module
    const side = plate.span * module
    fillRound(pixels, width, height, x, y, side, side, Math.floor(side * 0.12), paper)
    const pad = Math.floor(side * 0.16)
    plateBox = { x: x + pad, y: y + pad, w: Math.max(1, side - pad * 2), h: Math.max(1, side - pad * 2), id: plate.id }
    imprintIcon(pixels, width, height, plateBox, ink)
  }
  const level: ScanLevel = module < 1 ? 'dense' : used > Math.max(width, height) && module < 2 ? 'dense' : module < 2 ? 'small' : 'ok'
  return {
    width,
    height,
    pixels,
    plate: plateBox,
    text: null,
    report: { level: width < grid || height < grid ? 'dense' : level, moduleDots: module, cols: grid, rows: grid, quiet, bumped: built.bumped, ecl: built.ecl, barDots: module },
  }
}

function rasterBarcode(spec: CodeSpec, width: number, height: number, pixels: Uint8Array): CodeRaster {
  const bits = encodeBarcode(spec.value, spec.symbology)
  const cols = bits.quietLeft + bits.bits.length + bits.quietRight
  const module = Math.max(1, Math.floor(width / Math.max(1, cols)))
  const band = spec.showText ? Math.min(Math.floor(height * 0.45), textBand(spec)) : 0
  const barH = Math.max(1, height - band)
  const used = module * cols
  const ox = Math.floor((width - used) / 2)
  const ink = spec.invert ? 255 : 0
  const paper = spec.invert ? 0 : 255
  pixels.fill(paper)
  for (let index = 0; index < bits.bits.length; index += 1) {
    if (bits.bits[index] !== '1') continue
    const guard = bits.guards.some(([from, to]) => index >= from && index < to)
    const extra = guard && spec.showText ? Math.min(Math.floor(band * 0.55), module * 4) : 0
    fillRect(pixels, width, height, ox + (index + bits.quietLeft) * module, 0, module, Math.min(height, barH + extra), ink)
  }
  const fontSize = Math.max(8, band - 4)
  const text = spec.showText && bits.text
    ? { text: bits.text, font: spec.mark.barFont || 'Arial, Helvetica, sans-serif', size: fontSize, x: 0, y: barH, w: width, h: Math.max(0, height - barH), ink }
    : null
  const raster: CodeRaster = {
    width,
    height,
    pixels,
    plate: null,
    text,
    report: {
      level: width < cols || barH < 4 ? 'dense' : module < 2 ? 'small' : barH < 8 ? 'bars' : 'ok',
      moduleDots: module,
      cols,
      rows: 1,
      quiet: bits.quietLeft,
      bumped: false,
      ecl: spec.ecl,
      barDots: barH,
    },
  }
  paintRasterText(raster)
  return raster
}

function buildQr(spec: CodeSpec) {
  const picked = effectiveEcl(spec.ecl, spec.value, !!spec.mark.logoId)
  try {
    const qr = QRCode.create(spec.value || ' ', { errorCorrectionLevel: picked.ecl })
    return { qr, ecl: picked.ecl, bumped: picked.bumped }
  } catch {
    throw new LabelCodeError('qr')
  }
}

function encodeBarcode(value: string, format: string): BarcodeBits {
  if (barcodeProblem(value, format)) throw new LabelCodeError('barcode')
  const key = FORMAT_KEY[format]
  const ctor = key ? (JsBarcode as unknown as { getModule: (name: string) => EncoderCtor | undefined }).getModule(key) : undefined
  if (!ctor) throw new LabelCodeError('barcode')
  let encoded: unknown
  try {
    const encoder = new ctor(value, { flat: true, displayValue: false, fontSize: 12, textMargin: 2, width: 2, height: 80, margin: 0, text: value })
    if (!encoder.valid()) throw new LabelCodeError('barcode')
    encoded = encoder.encode()
  } catch (error) {
    if (error instanceof LabelCodeError) throw error
    throw new LabelCodeError('barcode')
  }
  const pieces = flattenEncoded(encoded)
  const bits = pieces.map((piece) => piece.data).join('')
  if (!bits || !/^[01]+$/.test(bits)) throw new LabelCodeError('barcode')
  const text = pieces.map((piece) => piece.text ?? '').join('') || value
  const quiet = quietZone(format)
  return { bits, quietLeft: quiet.left, quietRight: quiet.right, guards: guardRanges(format, bits.length), text }
}

function flattenEncoded(value: unknown): Array<{ data: string; text?: string }> {
  if (Array.isArray(value)) return value.flatMap((item) => flattenEncoded(item))
  if (!value || typeof value !== 'object' || !('data' in value)) return []
  const piece = value as { data?: unknown; text?: unknown }
  return [{ data: String(piece.data ?? ''), text: piece.text == null ? undefined : String(piece.text) }]
}

function quietZone(format: string): { left: number; right: number } {
  if (format === 'EAN13') return { left: 11, right: 7 }
  if (format === 'EAN8') return { left: 7, right: 7 }
  if (format === 'UPC') return { left: 9, right: 9 }
  return { left: 10, right: 10 }
}

function guardRanges(format: string, length: number): Array<[number, number]> {
  if (format === 'EAN13' || format === 'UPC') return [[0, 3], [45, 50], [Math.max(0, length - 3), length]]
  if (format === 'EAN8') return [[0, 3], [31, 36], [Math.max(0, length - 3), length]]
  return []
}

function quietModules(spec: CodeSpec): number {
  const quiet = spec.mark.quiet
  if (quiet == null || !Number.isFinite(quiet)) return 4
  return clampInt(quiet, 0, 8)
}

function textBand(spec: CodeSpec): number {
  return clampInt(spec.mark.barFontSize ?? 14, 8, 48) + 4
}

function logoPlate(size: number, id: string | undefined): { row: number; col: number; span: number; id: string } | null {
  if (!id) return null
  const maxSpan = size - 16
  if (maxSpan < 5) return null
  let span = Math.min(maxSpan, Math.max(5, Math.round(size * 0.22)))
  if (span % 2 === 0) span -= 1
  const start = Math.floor((size - span) / 2)
  return { row: start, col: start, span, id }
}

function finderOrigins(size: number): Array<[number, number]> {
  return [[0, 0], [0, size - 7], [size - 7, 0]]
}

function inFinder(row: number, col: number, size: number): boolean {
  return finderOrigins(size).some(([r, c]) => row >= r && row < r + 7 && col >= c && col < c + 7)
}

function inPlate(row: number, col: number, plate: { row: number; col: number; span: number }): boolean {
  return row >= plate.row && row < plate.row + plate.span && col >= plate.col && col < plate.col + plate.span
}

function pushFinder(shapes: DrawShape[], x: number, y: number, module: number, finder: FinderShape, ink: string, paper: string) {
  const outer = module * 7
  if (finder === 'circle') {
    shapes.push({ kind: 'circle', cx: x + outer / 2, cy: y + outer / 2, r: outer / 2, fill: ink })
    shapes.push({ kind: 'circle', cx: x + outer / 2, cy: y + outer / 2, r: (module * 5) / 2, fill: paper })
    shapes.push({ kind: 'circle', cx: x + outer / 2, cy: y + outer / 2, r: (module * 3) / 2, fill: ink })
    return
  }
  const rx = module * 1.4
  shapes.push({ kind: 'rect', x, y, w: outer, h: outer, rx, fill: ink })
  shapes.push({ kind: 'rect', x: x + module, y: y + module, w: module * 5, h: module * 5, rx: rx * 0.7, fill: paper })
  shapes.push({ kind: 'rect', x: x + module * 2, y: y + module * 2, w: module * 3, h: module * 3, rx: rx * 0.45, fill: ink })
}

function stampFinder(pixels: Uint8Array, width: number, height: number, x: number, y: number, module: number, finder: FinderShape, ink: number, paper: number) {
  const outer = module * 7
  if (finder === 'circle') {
    fillCircle(pixels, width, height, x + outer / 2, y + outer / 2, outer / 2, ink)
    fillCircle(pixels, width, height, x + outer / 2, y + outer / 2, (module * 5) / 2, paper)
    fillCircle(pixels, width, height, x + outer / 2, y + outer / 2, (module * 3) / 2, ink)
    return
  }
  const rx = Math.max(1, Math.floor(module * 1.2))
  fillRound(pixels, width, height, x, y, outer, outer, rx, ink)
  fillRound(pixels, width, height, x + module, y + module, module * 5, module * 5, Math.max(1, rx - 1), paper)
  fillRound(pixels, width, height, x + module * 2, y + module * 2, module * 3, module * 3, Math.max(1, Math.floor(module * 0.5)), ink)
}

function fillModule(pixels: Uint8Array, width: number, height: number, x: number, y: number, module: number, shape: ModuleShape, ink: number) {
  if (shape === 'dots') {
    fillCircle(pixels, width, height, x + module / 2, y + module / 2, module * 0.46, ink)
    return
  }
  if (shape === 'rounded') {
    fillRound(pixels, width, height, x, y, module, module, Math.floor(module * 0.32), ink)
    return
  }
  fillRect(pixels, width, height, x, y, module, module, ink)
}

function fillRect(pixels: Uint8Array, width: number, height: number, x: number, y: number, rw: number, rh: number, color: number) {
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(width, Math.ceil(x + rw))
  const y1 = Math.min(height, Math.ceil(y + rh))
  for (let row = y0; row < y1; row += 1) pixels.fill(color, row * width + x0, row * width + x1)
}

function fillCircle(pixels: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number, color: number) {
  if (radius <= 0) return
  const r2 = radius * radius
  const x0 = Math.max(0, Math.floor(cx - radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const x1 = Math.min(width - 1, Math.ceil(cx + radius))
  const y1 = Math.min(height - 1, Math.ceil(cy + radius))
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      if (dx * dx + dy * dy <= r2) pixels[y * width + x] = color
    }
  }
}

function fillRound(pixels: Uint8Array, width: number, height: number, x: number, y: number, rw: number, rh: number, radius: number, color: number) {
  const r = Math.max(0, Math.min(radius, Math.floor(rw / 2), Math.floor(rh / 2)))
  if (r < 1) {
    fillRect(pixels, width, height, x, y, rw, rh, color)
    return
  }
  fillRect(pixels, width, height, x + r, y, rw - r * 2, rh, color)
  fillRect(pixels, width, height, x, y + r, rw, rh - r * 2, color)
  fillCircle(pixels, width, height, x + r, y + r, r, color)
  fillCircle(pixels, width, height, x + rw - r, y + r, r, color)
  fillCircle(pixels, width, height, x + r, y + rh - r, r, color)
  fillCircle(pixels, width, height, x + rw - r, y + rh - r, r, color)
}

function imprintIcon(pixels: Uint8Array, width: number, height: number, plate: { x: number; y: number; w: number; h: number; id: string }, ink: number) {
  if (typeof document === 'undefined' || plate.w < 2 || plate.h < 2) return
  const canvas = document.createElement('canvas')
  canvas.width = plate.w
  canvas.height = plate.h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.clearRect(0, 0, plate.w, plate.h)
  paintIcon(ctx, plate.id, 0, 0, Math.min(plate.w, plate.h), '#000000')
  const image = ctx.getImageData(0, 0, plate.w, plate.h)
  for (let y = 0; y < plate.h; y += 1) {
    for (let x = 0; x < plate.w; x += 1) {
      const pixel = (y * plate.w + x) * 4
      const alpha = image.data[pixel + 3] ?? 0
      const luma = image.data[pixel] ?? 255
      if (alpha > 140 && luma < 180) {
        const dx = plate.x + x
        const dy = plate.y + y
        if (dx >= 0 && dy >= 0 && dx < width && dy < height) pixels[dy * width + dx] = ink
      }
    }
  }
}

function paintCanvasText(raster: CodeRaster) {
  const band = raster.text
  if (!band || typeof document === 'undefined') return
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, band.w)
  canvas.height = Math.max(1, band.h)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  ctx.font = `${band.size}px ${band.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(band.text, canvas.width / 2, canvas.height / 2)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const pixel = (y * canvas.width + x) * 4
      const alpha = image.data[pixel + 3] ?? 0
      const luma = image.data[pixel] ?? 255
      if (alpha > 140 && luma < 170) {
        const dx = band.x + x
        const dy = band.y + y
        if (dx >= 0 && dy >= 0 && dx < raster.width && dy < raster.height) raster.pixels[dy * raster.width + dx] = band.ink
      }
    }
  }
}

function paintBitmapText(raster: CodeRaster) {
  const band = raster.text
  if (!band) return
  const scale = Math.max(1, Math.floor(band.h / 8))
  const glyphW = 6 * scale
  const total = band.text.length * glyphW
  let cursor = band.x + Math.max(0, Math.floor((band.w - total) / 2))
  const top = band.y + Math.max(0, Math.floor((band.h - 7 * scale) / 2))
  for (const char of band.text) {
    const rows = glyphRows(char)
    if (rows) {
      for (let row = 0; row < 7; row += 1) {
        const bits = rows[row] ?? 0
        for (let col = 0; col < 5; col += 1) {
          if ((bits & (1 << (4 - col))) === 0) continue
          fillRect(raster.pixels, raster.width, raster.height, cursor + col * scale, top + row * scale, scale, scale, band.ink)
        }
      }
    }
    cursor += glyphW
  }
}

function inkCount(pixels: Uint8Array, width: number, band: { x: number; y: number; w: number; h: number }): number {
  let count = 0
  const x0 = Math.max(0, band.x)
  const y0 = Math.max(0, band.y)
  const x1 = Math.min(width, band.x + band.w)
  const y1 = Math.min(pixels.length / width, band.y + band.h)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) if (pixels[y * width + x] === 0) count += 1
  }
  return count
}

function shapeSvg(shape: DrawShape): string {
  if (shape.kind === 'rect') {
    return `<rect x="${n(shape.x)}" y="${n(shape.y)}" width="${n(shape.w)}" height="${n(shape.h)}" rx="${n(shape.rx)}" fill="${shape.fill}"/>`
  }
  if (shape.kind === 'circle') return `<circle cx="${n(shape.cx)}" cy="${n(shape.cy)}" r="${n(shape.r)}" fill="${shape.fill}"/>`
  if (shape.kind === 'text') {
    return `<text x="${n(shape.x)}" y="${n(shape.y)}" text-anchor="middle" font-family="${xml(shape.font)}" font-size="${n(shape.size)}" fill="${shape.fill}">${xml(shape.text)}</text>`
  }
  return iconSvgAt(shape.id, shape.x, shape.y, shape.size, shape.fill)
}

function iconSvgAt(id: string, x: number, y: number, size: number, color: string): string {
  const icon = iconById(id)
  if (!icon) return ''
  const raw = symbolSvg(icon, color)
  if (icon.svg) return raw.replace('<svg ', `<svg x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" `)
  const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
  return `<svg x="${n(x)}" y="${n(y)}" width="${n(size)}" height="${n(size)}" viewBox="0 0 24 24">${inner}</svg>`
}

function migrateNode(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const obj = value as Record<string, unknown>
  const nested = Array.isArray(obj.objects) ? { ...obj, objects: obj.objects.map((item) => migrateNode(item)) } : obj
  const meta = asMeta(nested.data)
  if (!meta || (meta.kind !== 'qr' && meta.kind !== 'barcode')) return nested
  if (isVectorCodeJson(nested)) return nested
  if (String(nested.type ?? '').toLowerCase() !== 'image') return nested
  if (typeof meta.value !== 'string' || !meta.value.trim()) return nested
  const scaleX = num(obj.scaleX, 1)
  const scaleY = num(obj.scaleY, 1)
  const width = Math.max(1, Math.round(Math.abs(num(obj.width, 64) * scaleX)))
  const height = Math.max(1, Math.round(Math.abs(num(obj.height, 64) * scaleY)))
  const mark = meta.kind === 'qr'
    ? { qrKind: 'text' as const, quiet: 0, moduleShape: 'square' as const, finderShape: 'square' as const, ...meta.mark }
    : { barFont: 'Arial, Helvetica, sans-serif', barFontSize: 14, ...meta.mark }
  const next: Record<string, unknown> = {}
  for (const key of ['originX', 'originY', 'left', 'top', 'angle', 'opacity', 'skewX', 'skewY', 'visible', 'selectable', 'evented'] as const) {
    if (key in obj) next[key] = obj[key]
  }
  next.type = VECTOR_CODE_TYPE
  next.width = width
  next.height = height
  next.scaleX = 1
  next.scaleY = 1
  next.flipX = obj.flipX === true || scaleX < 0
  next.flipY = obj.flipY === true || scaleY < 0
  next.data = { ...meta, mark }
  return next
}

function visit(objects: unknown, call: (obj: Record<string, unknown>) => void) {
  if (!Array.isArray(objects)) return
  for (const item of objects) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    call(obj)
    if (Array.isArray(obj.objects)) visit(obj.objects, call)
  }
}

function asMeta(value: unknown): Meta | null {
  if (!value || typeof value !== 'object') return null
  const meta = value as Meta
  if (!meta.kind) return null
  return meta
}

function tracePoints(ctx: CanvasRenderingContext2D, points: string, close: boolean) {
  const values = points.trim().split(/[\s,]+/).map(Number)
  for (let index = 0; index + 1 < values.length; index += 2) {
    const x = values[index] ?? 0
    const y = values[index + 1] ?? 0
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  if (close) ctx.closePath()
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1')
}

function oneLine(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim()
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

function num(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function n(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0'
}

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function rank(level: ScanLevel): number {
  if (level === 'dense') return 3
  if (level === 'small') return 2
  if (level === 'bars') return 1
  return 0
}

const FONT5: Record<string, number[]> = {
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b01100, 0b01100],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '*': [0b00100, 0b10101, 0b01110, 0b00100, 0b01110, 0b10101, 0b00100],
  $: [0b00100, 0b01111, 0b10100, 0b01110, 0b00101, 0b11110, 0b00100],
  '/': [0b00001, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b10000],
  '+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  ':': [0b00000, 0b01100, 0b01100, 0b00000, 0b01100, 0b01100, 0b00000],
}

function glyphRows(char: string): number[] | null {
  if (char === ' ') return FONT5[' '] ?? null
  return FONT5[char] ?? FONT5[char.toUpperCase()] ?? [0b11111, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11111]
}
