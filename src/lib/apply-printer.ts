import { engine } from '../engine/editor'
import { LABEL_TYPES } from './presets'
import { interpretLabel } from './printer-profile'
import { settingsFromPrinter } from './printer-profile'
import { printer } from '../printer/controller'
import { toast } from '../toast'
import type { I18nKey } from '../i18n'
import type { PrinterSnapshot } from '../types'

type Translate = (key: I18nKey, vars?: Record<string, string | number>) => string

/** Apply dpi, printhead model, density range, label types, and print task. Does not resize the label. */
export function syncEditorWithPrinter(snap: PrinterSnapshot): boolean {
  const editor = engine.getSnapshot()
  const patch = settingsFromPrinter(editor, snap)
  if (!patch) return false
  engine.applyPrinterSettings(patch)
  return true
}

export async function runDetectLabelBusy(t: Translate, setBusy: (value: boolean) => void) {
  setBusy(true)
  try {
    await runDetectLabel(t)
  } finally {
    setBusy(false)
  }
}

export async function runDetectLabel(t: Translate) {
  if (printer.getSnapshot().status !== 'connected') {
    toast(t('detectLabelNeed'))
    return
  }
  let rfid
  try {
    rfid = await printer.readLabel()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    toast(message === 'notConnected' ? t('detectLabelNeed') : t('detectLabelNone'))
    return
  }
  const read = interpretLabel(rfid)
  if (!read.ok) {
    toast(read.reason === 'nosize' ? t('detectLabelNoSize') : t('detectLabelNone'))
    return
  }
  const { suggestion } = read
  engine.applyDetectedLabel(suggestion.widthMm, suggestion.heightMm, suggestion.labelType, suggestion.gapMm)
  const type = LABEL_TYPES.find((item) => item.id === suggestion.labelType)
  toast(
    t('detectLabelOk', {
      w: suggestion.widthMm,
      h: suggestion.heightMm,
      gap: suggestion.gapMm ? t('paperGap', { n: suggestion.gapMm }) : '',
      type: type ? t(type.key) : '—',
    }),
  )
}
