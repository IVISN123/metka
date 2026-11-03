import { LabelType, PrinterModel, findPrintTask, getPrinterMetaByModel, printTaskNames } from '@mmote/niimbluelib'
import type { Lang, PrintDirection } from '../types'

export const MODEL_IDS = [
  'D110',
  'D11',
  'D110_M',
  'D11_H',
  'D11_PRO',
  'B18',
  'B18S',
  'H1S',
  'D101',
  'B1',
  'B1_PRO',
  'B1_SE',
  'B21',
  'B21_PRO',
  'B21S',
  'B21_C2B',
  'B21_L2B',
  'B3S',
  'B4',
  'N1',
] as const

export type Preset = {
  id: string
  title: string
  widthMm: number
  heightMm: number
  note: Record<Lang, string>
}

export const PRESETS: Preset[] = [
  { id: '12x40', title: '12×40', widthMm: 40, heightMm: 12, note: { ru: 'лента 12 мм', en: '12 mm tape' } },
  { id: '12x22', title: '12×22', widthMm: 22, heightMm: 12, note: { ru: 'лента 12 мм', en: '12 mm tape' } },
  { id: '14x30', title: '14×30', widthMm: 30, heightMm: 14, note: { ru: 'лента 14 мм', en: '14 mm tape' } },
  { id: '14x50', title: '14×50', widthMm: 50, heightMm: 14, note: { ru: 'лента 14 мм', en: '14 mm tape' } },
  { id: '15x30', title: '15×30', widthMm: 30, heightMm: 15, note: { ru: 'лента 15 мм', en: '15 mm tape' } },
  { id: '15x50', title: '15×50', widthMm: 50, heightMm: 15, note: { ru: 'лента 15 мм', en: '15 mm tape' } },
  { id: '25x15', title: '25×15', widthMm: 25, heightMm: 15, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '30x15', title: '30×15', widthMm: 30, heightMm: 15, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '30x20', title: '30×20', widthMm: 30, heightMm: 20, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '40x30', title: '40×30', widthMm: 40, heightMm: 30, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '40x60', title: '40×60', widthMm: 40, heightMm: 60, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '50x20', title: '50×20', widthMm: 50, heightMm: 20, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '50x30', title: '50×30', widthMm: 50, heightMm: 30, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '50x70', title: '50×70', widthMm: 50, heightMm: 70, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '50x80', title: '50×80', widthMm: 50, heightMm: 80, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '60x40', title: '60×40', widthMm: 60, heightMm: 40, note: { ru: 'прямоугольная', en: 'rectangle' } },
  { id: '75x50', title: '75×50', widthMm: 75, heightMm: 50, note: { ru: 'прямоугольная', en: 'rectangle' } },
]

export function metaFor(modelId: string) {
  const values = Object.values(PrinterModel) as string[]
  if (!values.includes(modelId)) return undefined
  return getPrinterMetaByModel(modelId as PrinterModel)
}

export function suggestedTask(modelId: string): { task: string; guessed: boolean } {
  const meta = metaFor(modelId)
  if (!meta) return { task: 'B1', guessed: true }
  const found = findPrintTask(meta.model)
  if (found) return { task: found, guessed: false }
  if (meta.printDirection === 'left' && meta.printheadPixels <= 220) return { task: 'D110', guessed: true }
  return { task: 'B1', guessed: true }
}

/** Prefer the connected printer's task. A manual choice is used only when auto-detect is off. */
export function resolvePrintTask(input: {
  taskAuto: boolean
  manual: string
  detected?: string | null
  model?: string | null
  protocolVersion?: number | null
}): string {
  if (!input.taskAuto && isPrintTask(input.manual)) return input.manual
  if (input.detected && isPrintTask(input.detected)) return input.detected
  const meta = input.model ? metaFor(input.model) : undefined
  const version = input.protocolVersion && input.protocolVersion > 0 ? input.protocolVersion : undefined
  if (meta) {
    const found = findPrintTask(meta.model, version)
    if (found && isPrintTask(found)) return found
  }
  if (isPrintTask(input.manual)) return input.manual
  return suggestedTask(input.model ?? '').task
}

export function taskNames(): string[] {
  return [...printTaskNames]
}

export function isPrintTask(value: string): boolean {
  return (printTaskNames as readonly string[]).includes(value)
}

export const LABEL_TYPES: { id: number; key: 'labelWithGaps' | 'labelBlack' | 'labelContinuous' | 'labelPerforated' | 'labelTransparent' | 'labelPvc' | 'labelBlackGap' | 'labelTube' }[] = [
  { id: LabelType.WithGaps, key: 'labelWithGaps' },
  { id: LabelType.Black, key: 'labelBlack' },
  { id: LabelType.Continuous, key: 'labelContinuous' },
  { id: LabelType.Perforated, key: 'labelPerforated' },
  { id: LabelType.Transparent, key: 'labelTransparent' },
  { id: LabelType.PvcTag, key: 'labelPvc' },
  { id: LabelType.BlackMarkGap, key: 'labelBlackGap' },
  { id: LabelType.HeatShrinkTube, key: 'labelTube' },
]

export function directionOf(modelId: string): PrintDirection {
  return metaFor(modelId)?.printDirection === 'left' ? 'left' : 'top'
}

export function matchingPreset(widthMm: number, heightMm: number): Preset | undefined {
  return PRESETS.find((preset) => preset.widthMm === widthMm && preset.heightMm === heightMm)
}

export const FONTS = [
  { id: 'plex-mono', label: 'IBM Plex Mono', family: '"IBM Plex Mono", ui-monospace, monospace' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', family: '"JetBrains Mono", ui-monospace, monospace' },
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif' },
  { id: 'system', label: 'System', family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  { id: 'impact', label: 'Impact', family: 'Impact, Haettenschweiler, sans-serif' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', family: 'Tahoma, Geneva, sans-serif' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', family: '"Courier New", Courier, monospace' },
]

export const DATE_FORMATS = ['DD.MM.YYYY', 'DD.MM.YYYY HH:mm', 'YYYY-MM-DD', 'HH:mm', 'DD.MM.YY']

export const BARCODE_FORMATS = ['CODE128', 'EAN13', 'EAN8', 'CODE39', 'UPC', 'ITF', 'codabar']
