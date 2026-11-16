import { assessFirmware, firmwareVersionsMatch, holdScreenAwake, mapUpgradeError, type FirmwareBlock } from './firmware'

export type FlashPhase =
  | 'idle'
  | 'blocked'
  | 'uploading'
  | 'finishing'
  | 'rebooting'
  | 'reconnecting'
  | 'verifying'
  | 'done'
  | 'failed'

export type FlashCode = FirmwareBlock | 'rejected' | 'crc' | 'timeout' | 'link' | 'notConnected' | 'reconnect' | 'verify' | 'unknown' | ''

export type FlashView = {
  phase: FlashPhase
  percent: number
  chunk: number
  chunks: number
  code: FlashCode
  reported: string
  /** True only after `firmwareUpgrade` resolved, which includes the printer's commit. */
  sent: boolean
  awake: boolean
}

export type FlashEvent =
  | { type: 'block'; code: FlashCode }
  | { type: 'upload'; awake: boolean }
  | { type: 'progress'; current: number; total: number }
  | { type: 'sent' }
  | { type: 'reconnect' }
  | { type: 'verify'; reported: string }
  | { type: 'done'; reported: string }
  | { type: 'fail'; code: FlashCode; reported?: string }

export type FirmwarePort = {
  connected: () => boolean
  stopHeartbeat: () => void
  startHeartbeat: () => void
  upgrade: (data: Uint8Array, version: string, onProgress: (current: number, total: number) => void) => Promise<void>
  disconnect: () => Promise<void>
  /** Null when the printer did not come back. */
  reconnect: () => Promise<{ software: string } | null>
}

export type FirmwareJob = {
  data: Uint8Array
  fileName: string
  version: string
  allowDowngrade: boolean
  printer: {
    connected: boolean
    model: string
    protocol: number | null
    hardware: string
    software: string
    battery: number | null
    lid: boolean | null
    transport: 'bluetooth' | 'serial' | null
    printing: boolean
    /** Null unless a caller has an independent charging signal. The library does not decode one. */
    charging: boolean | null
  }
}

export type FlashRunOptions = {
  rebootMs?: number
  reconnectTries?: number
  reconnectGapMs?: number
  onUpdate?: (view: FlashView) => void
  holdAwake?: () => Promise<{ release: () => void; held: boolean }>
  sleep?: (ms: number) => Promise<void>
}

export function initialFlash(): FlashView {
  return { phase: 'idle', percent: 0, chunk: 0, chunks: 0, code: '', reported: '', sent: false, awake: false }
}

export function reduceFlash(state: FlashView, event: FlashEvent): FlashView {
  switch (event.type) {
    case 'block':
      return { ...initialFlash(), phase: 'blocked', code: event.code }
    case 'upload':
      return { ...initialFlash(), phase: 'uploading', awake: event.awake }
    case 'progress': {
      if (state.phase !== 'uploading' && state.phase !== 'finishing') return state
      const total = event.total > 0 ? event.total : 1
      const current = Math.max(0, event.current)
      const percent = Math.min(100, Math.round((current / total) * 100))
      return {
        ...state,
        phase: current >= total ? 'finishing' : 'uploading',
        percent,
        chunk: current,
        chunks: event.total,
      }
    }
    case 'sent':
      if (state.phase !== 'uploading' && state.phase !== 'finishing') return state
      return { ...state, phase: 'rebooting', percent: 100, sent: true }
    case 'reconnect':
      if (!state.sent) return state
      return { ...state, phase: 'reconnecting' }
    case 'verify':
      if (!state.sent) return state
      return { ...state, phase: 'verifying', reported: event.reported }
    case 'done':
      if (!state.sent) return state
      return { ...state, phase: 'done', percent: 100, reported: event.reported, code: '' }
    case 'fail':
      return { ...state, phase: 'failed', code: event.code, reported: event.reported ?? state.reported }
    default:
      return state
  }
}

/**
 * Preflight, then one `firmwareUpgrade`, then reconnect and compare versions.
 * A failed preflight never calls the port's upgrade. A failed transfer is not retried.
 */
export async function runFirmwareUpgrade(port: FirmwarePort, job: FirmwareJob, options: FlashRunOptions = {}): Promise<FlashView> {
  const rebootMs = options.rebootMs ?? 8_000
  const reconnectTries = options.reconnectTries ?? 4
  const reconnectGapMs = options.reconnectGapMs ?? 3_000
  const sleep = options.sleep ?? delay
  let view = initialFlash()
  const update = (event: FlashEvent) => {
    view = reduceFlash(view, event)
    options.onUpdate?.(view)
    return view
  }

  const assessment = assessFirmware({
    ...job.printer,
    fileName: job.fileName,
    version: job.version,
    data: job.data,
    allowDowngrade: job.allowDowngrade,
  })
  if (!assessment.ok) return update({ type: 'block', code: assessment.code })

  const hold = options.holdAwake ?? holdScreenAwake
  const awake = await hold()
  try {
    port.stopHeartbeat()
    update({ type: 'upload', awake: awake.held })
    await port.upgrade(job.data, assessment.version, (current, total) => {
      update({ type: 'progress', current, total })
    })
    update({ type: 'sent' })
    await port.disconnect()
    await sleep(rebootMs)
    update({ type: 'reconnect' })
    let reported = ''
    for (let attempt = 0; attempt < reconnectTries; attempt += 1) {
      try {
        const info = await port.reconnect()
        if (info?.software) {
          reported = info.software
          if (firmwareVersionsMatch(assessment.version, reported)) break
        }
      } catch {
        /* the radio is not back yet; another try is not another flash */
      }
      if (attempt + 1 < reconnectTries) await sleep(reconnectGapMs)
    }
    if (!reported) return update({ type: 'fail', code: 'reconnect' })
    update({ type: 'verify', reported })
    if (!firmwareVersionsMatch(assessment.version, reported)) return update({ type: 'fail', code: 'verify', reported })
    return update({ type: 'done', reported })
  } catch (error) {
    if (port.connected()) port.startHeartbeat()
    return update({ type: 'fail', code: mapUpgradeError(error) })
  } finally {
    awake.release()
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
