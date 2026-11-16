import { PageColorType, PrintTaskCapability, printTasksCapabilities, type PrintTaskName } from '@mmote/niimbluelib'
import { isPrintTask, metaFor, resolvePrintTask } from './presets'
import type { PrintDirection, RfidView } from '../types'

/** Black, 16-level gray, or red-and-black. Black is the 1-bit path every other model already uses. */
export type InkMode = 'black' | 'gray' | 'red'

export type PaperSuggestion = {
  widthMm: number
  heightMm: number
  gapMm: number | null
  labelType: number | null
}

export type FirmwareVerdict = { ok: true; downgrade?: boolean } | { ok: false; code: 'version' | 'model' | 'major' | 'downgrade' }

/**
 * Dots the bitmap is padded to. On B21 Pro the sensor reports 576, while the
 * protocol window (and a 50 mm label at 300 dpi) is 591. Padding to 576 clips the roll.
 */
export function padWidth(protocolDots: number | null | undefined, sensorDots: number | null | undefined): number | undefined {
  const protocol = positive(protocolDots)
  if (protocol) return protocol
  return positive(sensorDots)
}

export function labelsRemaining(total: number | null, used: number | null): number | null {
  if (total === null || used === null) return null
  if (!Number.isFinite(total) || !Number.isFinite(used) || total < 0 || used < 0) return null
  return Math.max(0, Math.round(total) - Math.round(used))
}

/** Prefer the label face. B21 Pro's totalHeight includes the gap, so 36 mm is not the sticker. */
export function paperSuggestion(input: {
  widthMm: number | null
  heightMm: number | null
  gapMm?: number | null
  totalMm?: number | null
  labelType?: number | null
}): PaperSuggestion | null {
  const width = tidyMm(input.widthMm)
  let height = tidyMm(input.heightMm)
  const gap = tidyMm(input.gapMm)
  if (height === null && input.totalMm != null && gap !== null) height = tidyMm(input.totalMm - gap)
  if (width === null || height === null || width <= 0 || height <= 0) return null
  const labelType = input.labelType != null && input.labelType > 0 ? input.labelType : null
  return { widthMm: width, heightMm: height, gapMm: gap, labelType }
}

export type LabelRead = { ok: true; suggestion: PaperSuggestion } | { ok: false; reason: 'none' | 'nosize' }

/** A roll the printer can describe, a tag with no millimetres, or nothing reported. */
export function interpretLabel(rfid: RfidView): LabelRead {
  const suggestion = suggestionFromRfid(rfid)
  if (suggestion) return { ok: true, suggestion }
  if (rfid.present === true) return { ok: false, reason: 'nosize' }
  return { ok: false, reason: 'none' }
}

export type PrinterSettingsPatch = {
  model: string
  dpi: number
  direction: PrintDirection
  density: number
  labelType: number
  task: string
  taskAuto: true
}

/**
 * Model, dpi, direction, density range, label type, and print task from a live printer.
 * Label millimetres are not included: that is a separate read of the roll.
 */
export function settingsFromPrinter(
  current: { model: string; density: number; labelType: number; task: string },
  detected: {
    model: string
    dpi: number | null
    detectedTask: string
    protocol: number | null
    densityMin: number | null
    densityMax: number | null
    labelTypes: number[]
  },
): PrinterSettingsPatch | null {
  const meta = metaFor(detected.model)
  if (!meta) return null
  const modelChanged = current.model !== detected.model
  const rangeMin = detected.densityMin ?? meta.densityMin
  const rangeMax = detected.densityMax ?? meta.densityMax
  const lo = Math.min(rangeMin, rangeMax)
  const hi = Math.max(rangeMin, rangeMax)
  const density = Math.min(hi, Math.max(lo, modelChanged ? meta.densityDefault : current.density))
  const types = detected.labelTypes.length > 0 ? detected.labelTypes : meta.paperTypes
  const labelType = types.includes(current.labelType) ? current.labelType : (types[0] ?? current.labelType)
  const dpi = detected.dpi === 300 || detected.dpi === 203 ? detected.dpi : meta.dpi
  return {
    model: detected.model,
    dpi,
    direction: meta.printDirection === 'left' ? 'left' : 'top',
    density,
    labelType,
    task: resolvePrintTask({
      taskAuto: true,
      manual: current.task,
      detected: detected.detectedTask,
      model: detected.model,
      protocolVersion: detected.protocol,
    }),
    taskAuto: true,
  }
}

export function suggestionFromRfid(rfid: RfidView): PaperSuggestion | null {
  return paperSuggestion({
    widthMm: rfid.widthMm,
    heightMm: rfid.heightMm,
    gapMm: rfid.gapMm,
    labelType: rfid.kind,
  })
}

/**
 * Heartbeat printer info is already `3.13`. The older version command returns
 * `3.13/7.81`; the first form is the one that matches the hardware major.
 */
export function shownVersion(raw: string): string {
  const parts = raw
    .split('/')
    .map((part) => part.trim())
    .filter((part) => /^\d+\.\d+$/.test(part))
  if (parts.length > 0) return parts[0] ?? raw
  return raw.match(/\d+\.\d+/)?.[0] ?? raw
}

/** `B21_Pro_3.13.bin` → `B21_PRO`. A bare `firmware.bin` does not name a model. */
export function firmwareFileModel(fileName: string): string | null {
  const base = fileName.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') ?? ''
  const match = base.match(/([A-Za-z][A-Za-z0-9]*(?:[\s_-]+[A-Za-z0-9]+)*)[\s_-]+(\d+\.\d+)\s*$/)
  if (!match?.[1]) return null
  return match[1].replace(/[\s-]+/g, '_').replace(/_+/g, '_').toUpperCase()
}

/**
 * Refuse a file whose name is for another model, whose major differs from the
 * hardware or the installed firmware, or that is older than the installed firmware.
 * The printer still does its own check. This runs before any byte is sent.
 */
export function checkFirmware(input: {
  model: string
  hardware: string
  software: string
  fileName: string
  version: string
  /** Skips only the older-than-installed check. Model and major still refuse. */
  allowDowngrade?: boolean
}): FirmwareVerdict {
  if (!/^\d+\.\d+$/.test(input.version.trim())) return { ok: false, code: 'version' }
  const model = input.model.trim().toUpperCase()
  const fileModel = firmwareFileModel(input.fileName)
  if (!model || model.startsWith('#') || !fileModel || fileModel !== model) return { ok: false, code: 'model' }
  const file = versionParts(input.version)
  const hardware = versionParts(input.hardware)
  const software = versionParts(input.software)
  if (!file || !hardware) return { ok: false, code: 'major' }
  if (file.major !== hardware.major) return { ok: false, code: 'major' }
  if (software && file.major !== software.major) return { ok: false, code: 'major' }
  if (software && file.major * 100 + file.minor < software.major * 100 + software.minor) {
    if (!input.allowDowngrade) return { ok: false, code: 'downgrade' }
    return { ok: true, downgrade: true }
  }
  return { ok: true }
}

export function pageColorFor(task: string, mode: InkMode): PageColorType {
  if (mode === 'black' || !isPrintTask(task)) return PageColorType.SingleColor
  const caps = printTasksCapabilities[task as PrintTaskName] ?? []
  if (mode === 'gray' && caps.includes(PrintTaskCapability.SupportGrayscale)) return PageColorType.Grayscale
  if (mode === 'red' && caps.includes(PrintTaskCapability.SupportDoubleColor)) return PageColorType.DoubleColor
  return PageColorType.SingleColor
}

export function inkChoices(task: string): InkMode[] {
  const modes: InkMode[] = ['black']
  if (pageColorFor(task, 'gray') === PageColorType.Grayscale) modes.push('gray')
  if (pageColorFor(task, 'red') === PageColorType.DoubleColor) modes.push('red')
  return modes
}

function positive(value: number | null | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined
  return Math.round(value)
}

function tidyMm(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const tenths = Math.round(value * 10) / 10
  const nearest = Math.round(tenths)
  return Math.abs(tenths - nearest) < 0.15 ? nearest : tenths
}

function versionParts(raw: string): { major: number; minor: number } | null {
  const text = shownVersion(raw)
  const match = text.match(/^(\d+)\.(\d+)$/)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]) }
}
