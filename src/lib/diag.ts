import { RequestCommandId, ResponseCommandId, Utils } from '@mmote/niimbluelib'
import type { RfidView } from '../types'

const empty = (): RfidView => ({
  present: null,
  used: null,
  total: null,
  kind: null,
  barcode: '',
  readOk: null,
  widthMm: null,
  heightMm: null,
})

export function blankRfid(): RfidView {
  return empty()
}

export function formatPacketLine(direction: '>>' | '<<', command: number, bytes: Uint8Array): string {
  const name = RequestCommandId[command] || ResponseCommandId[command] || String(command)
  const hex = Utils.bufToHex(bytes)
  const body = hex.length > 160 ? `${hex.slice(0, 160)}… (${bytes.length} B)` : hex
  return `${direction} ${name} ${body}`
}

export function rfidFromClient(input: {
  label?: {
    tagPresent: boolean
    usedPaper: number
    allPaper: number
    consumablesType: number
    barCode: string
  }
  paper?: { paperWidth?: number; totalHeight?: number; paperType?: number }
  paperRfidSuccess?: boolean
}): RfidView {
  const label = input.label
  const paper = input.paper
  return {
    present: label ? label.tagPresent : null,
    used: label ? label.usedPaper : null,
    total: label ? label.allPaper : null,
    kind: label?.consumablesType ?? paper?.paperType ?? null,
    barcode: label?.barCode ?? '',
    readOk: input.paperRfidSuccess ?? null,
    widthMm: paper?.paperWidth ?? null,
    heightMm: paper?.totalHeight ?? null,
  }
}
