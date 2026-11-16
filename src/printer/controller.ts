import {
  ImageEncoder,
  LabelType,
  NiimbotBluetoothClient,
  NiimbotSerialClient,
  type NiimbotAbstractClient,
  type PrintTaskName,
} from '@mmote/niimbluelib'
import type { AlignMode, PrintDirection, PrinterSnapshot, RfidView } from '../types'
import { emptyRfid } from '../types'
import {
  browserSupport,
  connectBlock,
  connectFailureCode,
  listGrantedBluetooth,
  listGrantedSerial,
  pickGrantedBluetooth,
  rememberTransport,
  rememberedTransport,
  reconnectTransports,
} from '../lib/browser'
import { formatPacketLine, rfidFromClient } from '../lib/diag'
import { describeEncoded, padCanvas } from '../lib/encode'
import { resolvePrintTask } from '../lib/presets'
import { runFirmwareUpgrade, type FirmwareJob, type FirmwarePort, type FlashView } from '../lib/firmware-machine'
import { padWidth, pageColorFor, type InkMode } from '../lib/printer-profile'

export type PrintJob = {
  pages: HTMLCanvasElement[]
  direction: PrintDirection
  printhead?: number
  align: AlignMode
  density: number
  quantity: number
  labelType: number
  task: string
  taskAuto: boolean
  packetInterval: number | null
  /** Omitted or `black` stays on the 1-bit encoder. Gray and red are opt-in. */
  ink?: InkMode
}

const initial = (): PrinterSnapshot => ({
  status: 'idle',
  transport: null,
  deviceName: '',
  model: '',
  modelId: null,
  detectedTask: '',
  dpi: null,
  printhead: null,
  printheadSensor: null,
  battery: null,
  paper: null,
  lid: null,
  temp: null,
  ribbon: null,
  ribbonRfid: null,
  labelTypes: [],
  densityMin: null,
  densityMax: null,
  supportColor: null,
  printColors: [],
  firmware: '',
  hardware: '',
  protocol: null,
  serial: '',
  rfid: emptyRfid(),
  packetLog: '',
  lastPrint: '',
  error: '',
  printing: false,
  flashing: false,
  progress: 0,
  progressLabel: '',
  progressPage: 0,
  progressTotal: 0,
})

export class PrinterController {
  private client: NiimbotAbstractClient | null = null
  private snapshot: PrinterSnapshot = initial()
  /** Stays true across the disconnect that a successful flash causes, until the run finishes. */
  private flashLock = false
  private listeners = new Set<() => void>()
  private packetLines: string[] = []
  private printLogAt = 0

  private note(line: string) {
    this.packetLines.push(line)
    if (this.packetLines.length > 500) this.packetLines.splice(0, this.packetLines.length - 500)
  }

  private readRfid(client: NiimbotAbstractClient): RfidView {
    const info = client.getRfidInfo()
    const beat = client.getHeartbeatData()
    return rfidFromClient({
      label: info.labelRfidInfo,
      paper: info.paperInfo,
      paperRfidSuccess: beat.paperRfidSuccess,
    })
  }

  private identity(client: NiimbotAbstractClient) {
    const info = client.getPrinterInfo()
    const meta = client.getModelMetadata()
    const beat = client.getHeartbeatData()
    const reportedDpi = info.capabilities?.printheadDpi
    const dpi = reportedDpi === 300 || reportedDpi === 203 ? reportedDpi : (meta?.dpi ?? this.snapshot.dpi)
    const density = info.capabilities?.densityRange
    return {
      model: meta?.model ?? (info.modelId ? `#${info.modelId}` : this.snapshot.model),
      modelId: info.modelId ?? this.snapshot.modelId,
      detectedTask: client.getPrintTaskType() ?? this.snapshot.detectedTask,
      dpi,
      // Protocol dots (591 on B21 Pro), not the narrower sensor reading (576).
      printhead: meta?.printheadPixels ?? this.snapshot.printhead,
      printheadSensor: info.printheadWidth ?? info.capabilities?.printheadWidth ?? this.snapshot.printheadSensor,
      battery: info.batteryPercents ?? beat.batteryPercents ?? this.snapshot.battery,
      paper: beat.paperInserted ?? this.snapshot.paper,
      lid: beat.lidClosed ?? this.snapshot.lid,
      temp: beat.temp ?? this.snapshot.temp,
      ribbon: beat.ribbonInserted ?? this.snapshot.ribbon,
      ribbonRfid: beat.ribbonRfidSuccess ?? this.snapshot.ribbonRfid,
      labelTypes: info.capabilities?.supportedLabelTypes ?? meta?.paperTypes ?? this.snapshot.labelTypes,
      densityMin: density?.min ?? meta?.densityMin ?? this.snapshot.densityMin,
      densityMax: density?.max ?? meta?.densityMax ?? this.snapshot.densityMax,
      supportColor: info.supportColor ?? this.snapshot.supportColor,
      printColors: info.capabilities?.printColor ?? this.snapshot.printColors,
      firmware: info.softwareVersion ?? this.snapshot.firmware,
      hardware: info.hardwareVersion ?? this.snapshot.hardware,
      protocol: info.protocolVersion ?? this.snapshot.protocol,
      serial: info.serial ?? this.snapshot.serial,
      rfid: this.readRfid(client),
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private patch(partial: Partial<PrinterSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial }
    for (const listener of this.listeners) listener()
  }

  async connect(
    transport: 'bluetooth' | 'serial',
    options?: { quiet?: boolean; bluetoothDevice?: { name?: string }; serialPort?: object },
  ) {
    await this.disconnect()
    const blocked = connectBlock(transport, browserSupport())
    if (blocked) {
      if (!options?.quiet) this.patch({ status: 'error', transport: null, error: blocked })
      throw new Error(blocked)
    }
    let client: NiimbotAbstractClient
    const open = () => {
      if (transport === 'bluetooth') {
        const ble = new NiimbotBluetoothClient()
        return {
          client: ble,
          start: () => ble.connect(options?.bluetoothDevice ? { authorizedDevice: options.bluetoothDevice as never } : undefined),
        }
      }
      const serial = new NiimbotSerialClient()
        return {
          client: serial,
          start: () => serial.connect(options?.serialPort ? { authorizedPort: options.serialPort as never } : undefined),
        }
    }
    let start: () => Promise<unknown>
    try {
      const opened = open()
      client = opened.client
      start = opened.start
    } catch (error) {
      if (!options?.quiet) this.patch({ status: 'error', transport: null, error: connectFailureCode(error, transport) })
      throw error
    }
    this.client = client
    this.packetLines = []
    this.patch({ status: 'connecting', transport, error: '', progress: 0, progressLabel: '' })
    client.on('packetsent', (event) => {
      this.note(formatPacketLine('>>', event.packet.command, event.packet.toBytes()))
    })
    client.on('packetreceived', (event) => {
      this.note(formatPacketLine('<<', event.packet.command, event.packet.toBytes()))
    })
    client.on('connect', (event) => {
      this.patch({
        status: 'connected',
        deviceName: event.info.deviceName ?? '',
        ...this.identity(client),
        error: '',
      })
    })
    client.on('disconnect', () => {
      if (this.client !== client) return
      const dropped = this.snapshot.status === 'connected' || this.snapshot.status === 'connecting' || this.snapshot.printing
      this.client = null
      this.patch(this.parked(dropped ? 'linkLost' : this.snapshot.error, dropped ? 'error' : 'idle'))
    })
    client.on('rfidinfofetched', () => {
      this.patch({ rfid: this.readRfid(client) })
    })
    client.on('heartbeat', (event) => {
      this.patch({
        battery: event.data.batteryPercents ?? this.snapshot.battery,
        paper: event.data.paperInserted ?? this.snapshot.paper,
        lid: event.data.lidClosed ?? this.snapshot.lid,
        temp: event.data.temp ?? this.snapshot.temp,
        ribbon: event.data.ribbonInserted ?? this.snapshot.ribbon,
        ribbonRfid: event.data.ribbonRfidSuccess ?? this.snapshot.ribbonRfid,
        rfid: { ...this.snapshot.rfid, readOk: event.data.paperRfidSuccess ?? this.snapshot.rfid.readOk },
      })
    })
    client.on('printprogress', (event) => {
      const progress = Math.round((event.pagePrintProgress + event.pageFeedProgress) / 2)
      this.patch({
        progress,
        progressPage: event.page,
        progressTotal: event.pagesTotal,
        progressLabel: `${event.page} из ${event.pagesTotal}`,
      })
    })
    client.on('printpacketprogress', (event) => {
      this.patch({ progress: event.progress, progressLabel: '…' })
    })
    try {
      await start()
      rememberTransport(transport)
      if (!client.getModelMetadata()) {
        try {
          await client.fetchPrinterInfo()
        } catch {
          /* connect() already fetched what this model answers */
        }
      }
      client.startHeartbeat()
      this.patch({ status: 'connected', ...this.identity(client) })
    } catch (error) {
      this.client = null
      client.removeAllListeners()
      void client.disconnect().catch(() => undefined)
      if (options?.quiet) this.patch(this.parked())
      else {
        this.patch({
          status: 'error',
          transport: null,
          error: connectFailureCode(error, transport),
        })
      }
      throw error
    }
  }

  /**
   * Reconnect a printer this origin was already allowed to use.
   * `getDevices` / `getPorts` are missing in some browsers; that is a no-op, not an error.
   */
  async reconnectGranted(): Promise<boolean> {
    if (this.snapshot.status === 'connected' || this.snapshot.status === 'connecting' || this.snapshot.printing) return false
    const support = browserSupport()
    if (!support.secure) return false
    const bluetooth = support.bluetooth ? await listGrantedBluetooth() : []
    const serial = support.serial ? await listGrantedSerial() : []
    const order = reconnectTransports({
      bluetooth: bluetooth.length,
      serial: serial.length,
      last: rememberedTransport(),
    })
    for (const transport of order) {
      try {
        if (transport === 'bluetooth') {
          const device = pickGrantedBluetooth(bluetooth)
          if (!device) continue
          await this.connect('bluetooth', { quiet: true, bluetoothDevice: device })
        } else {
          const port = serial[0]
          if (!port) continue
          await this.connect('serial', { quiet: true, serialPort: port })
        }
        return true
      } catch {
        /* the radio is granted but the printer is off, or it is not a Niimbot */
      }
    }
    return false
  }

  async readLabel(): Promise<RfidView> {
    const client = this.client
    if (!client?.isConnected()) throw new Error('notConnected')
    try {
      await client.fetchRfidInfo()
    } catch {
      /* connect() may already have stored a roll that this command refused */
    }
    const rfid = this.readRfid(client)
    this.patch({ rfid })
    return rfid
  }

  private parked(error = '', status: PrinterSnapshot['status'] = 'idle'): PrinterSnapshot {
    return {
      ...initial(),
      flashing: this.flashLock,
      status,
      error,
      deviceName: this.snapshot.deviceName,
      model: this.snapshot.model,
      modelId: this.snapshot.modelId,
      detectedTask: this.snapshot.detectedTask,
      dpi: this.snapshot.dpi,
      printhead: this.snapshot.printhead,
      printheadSensor: this.snapshot.printheadSensor,
      lid: this.snapshot.lid,
      temp: this.snapshot.temp,
      ribbon: this.snapshot.ribbon,
      ribbonRfid: this.snapshot.ribbonRfid,
      labelTypes: this.snapshot.labelTypes,
      densityMin: this.snapshot.densityMin,
      densityMax: this.snapshot.densityMax,
      supportColor: this.snapshot.supportColor,
      printColors: this.snapshot.printColors,
      firmware: this.snapshot.firmware,
      hardware: this.snapshot.hardware,
      protocol: this.snapshot.protocol,
      serial: this.snapshot.serial,
      rfid: this.snapshot.rfid,
      packetLog: this.snapshot.packetLog,
      lastPrint: this.snapshot.lastPrint,
    }
  }

  async disconnect() {
    const client = this.client
    this.client = null
    if (!client) {
      this.patch(this.parked())
      return
    }
    client.removeAllListeners()
    try {
      await client.disconnect()
    } catch {
      /* already gone */
    }
    this.patch(this.parked())
  }

  async print(job: PrintJob) {
    const client = this.client
    if (!client?.isConnected()) throw new Error('notConnected')
    if (job.pages.length === 0) throw new Error('empty')
    const quantity = Math.max(1, Math.round(job.quantity))
    const meta = client.getModelMetadata()
    const info = client.getPrinterInfo()
    const taskName = resolvePrintTask({
      taskAuto: job.taskAuto,
      manual: job.task,
      detected: client.getPrintTaskType() ?? this.snapshot.detectedTask,
      model: meta?.model ?? this.snapshot.model,
      protocolVersion: info.protocolVersion,
    }) as PrintTaskName
    let density = Math.round(job.density)
    const densityMin = info.capabilities?.densityRange?.min ?? meta?.densityMin
    const densityMax = info.capabilities?.densityRange?.max ?? meta?.densityMax
    if (densityMin != null && densityMax != null) {
      const lo = Math.min(densityMin, densityMax)
      const hi = Math.max(densityMin, densityMax)
      density = Math.min(hi, Math.max(lo, density))
    }
    const printhead = padWidth(meta?.printheadPixels ?? job.printhead, info.printheadWidth)
    if (job.packetInterval !== null && Number.isFinite(job.packetInterval)) {
      client.setPacketInterval(Math.max(0, job.packetInterval))
    }
    // NiimBlue always stops the heartbeat before print. niimbluelib 0.49's
    // isHeartbeatStarted() is inverted, so do not trust it.
    client.stopHeartbeat()
    const totalPages = job.pages.length * quantity
    this.printLogAt = this.packetLines.length
    const pageColor = pageColorFor(taskName, job.ink ?? 'black')
    const plan = `# print task=${taskName} density=${density} labelType=${job.labelType} pageColor=${pageColor} totalPages=${totalPages} printhead=${printhead ?? '-'} sensor=${info.printheadWidth ?? '-'} firmware=${info.softwareVersion ?? this.snapshot.firmware}`
    this.note(plan)
    const task = client.protocol.newPrintTask(taskName, {
      totalPages,
      density,
      // D110M_V4 speed is 0 or 1 (clarity / speed). 1 is the library default for every model on this task.
      speed: 1,
      labelType: job.labelType as LabelType,
      pageColor,
      statusPollIntervalMs: 100,
      statusTimeoutMs: 8_000,
    })
    this.patch({ printing: true, progress: 0, progressLabel: '', error: '' })
    let failure: unknown
    try {
      await task.printInit()
      for (let index = 0; index < job.pages.length; index += 1) {
        const page = job.pages[index]
        if (!page) continue
        const shown = index * quantity + 1
        const total = job.pages.length * quantity
        this.patch({
          progressPage: shown,
          progressTotal: total,
          progressLabel: `${shown} из ${total}`,
          progress: Math.round((index / job.pages.length) * 100),
        })
        const { canvas } = padCanvas(page, job.direction, printhead, job.align)
        const encoded = ImageEncoder.encodeCanvas(canvas, pageColor, job.direction)
        await task.printPage(encoded, quantity)
        await task.waitForPageFinished()
      }
      await task.waitForFinished()
    } catch (error) {
      failure = error
    } finally {
      try {
        await task.printEnd()
      } catch (error) {
        failure ??= error
      }
      if (client.isConnected()) client.startHeartbeat()
      this.patch({
        printing: false,
        progress: failure ? this.snapshot.progress : 100,
        lastPrint: plan,
        packetLog: this.packetLines.slice(this.printLogAt).join('\n'),
        rfid: client.isConnected() ? this.readRfid(client) : this.snapshot.rfid,
        firmware: info.softwareVersion ?? this.snapshot.firmware,
        hardware: info.hardwareVersion ?? this.snapshot.hardware,
      })
    }
    if (failure) throw failure
  }

  /**
   * Flash only after `runFirmwareUpgrade` accepts the file. The library call is
   * `protocol.firmwareUpgrade`. This method does not retry a failed transfer.
   */
  async flashFirmware(
    input: { data: Uint8Array; fileName: string; version: string; allowDowngrade: boolean },
    onUpdate?: (view: FlashView) => void,
  ): Promise<FlashView> {
    if (this.flashLock) {
      const busy: FlashView = { phase: 'blocked', percent: 0, chunk: 0, chunks: 0, code: 'busy', reported: '', sent: false, awake: false }
      onUpdate?.(busy)
      return busy
    }
    const client = this.client
    const job: FirmwareJob = {
      data: input.data,
      fileName: input.fileName,
      version: input.version,
      allowDowngrade: input.allowDowngrade,
      printer: {
        connected: this.snapshot.status === 'connected' && client?.isConnected() === true,
        model: client?.getModelMetadata()?.model ?? this.snapshot.model,
        protocol: client?.getPrinterInfo().protocolVersion ?? this.snapshot.protocol,
        hardware: client?.getPrinterInfo().hardwareVersion ?? this.snapshot.hardware,
        software: client?.getPrinterInfo().softwareVersion ?? this.snapshot.firmware,
        battery: this.snapshot.battery,
        lid: this.snapshot.lid,
        transport: this.snapshot.transport,
        printing: this.snapshot.printing,
        // voltageState is stored by niimbluelib and not decoded. USB is the serial transport.
        charging: null,
      },
    }
    this.flashLock = true
    this.patch({ flashing: true })
    const releaseLeave = holdTab()
    try {
      return await runFirmwareUpgrade(this.flashPort(client), job, { onUpdate })
    } finally {
      releaseLeave()
      this.flashLock = false
      this.patch({ flashing: false })
    }
  }

  private flashPort(client: NiimbotAbstractClient | null): FirmwarePort {
    return {
      connected: () => this.client === client && client?.isConnected() === true,
      stopHeartbeat: () => client?.stopHeartbeat(),
      startHeartbeat: () => {
        if (this.client === client && client?.isConnected()) client.startHeartbeat()
      },
      upgrade: async (data, version, onProgress) => {
        if (!client?.isConnected()) throw new Error('notConnected')
        const listener = (event: { currentChunk: number; totalChunks: number }) => {
          onProgress(event.currentChunk, event.totalChunks)
        }
        client.on('firmwareprogress', listener)
        try {
          await client.protocol.firmwareUpgrade(data, version)
        } finally {
          client.off('firmwareprogress', listener)
        }
      },
      disconnect: () => this.disconnect(),
      reconnect: async () => {
        if (this.snapshot.status !== 'connected' || !this.client?.isConnected()) {
          const ok = await this.reconnectGranted()
          if (!ok || this.snapshot.status !== 'connected') return null
          return { software: this.snapshot.firmware }
        }
        try {
          await this.client.fetchPrinterInfo()
        } catch {
          /* the link is up, but this model refused a refresh */
        }
        const software = this.client.getPrinterInfo().softwareVersion ?? this.snapshot.firmware
        this.patch({
          firmware: software,
          hardware: this.client.getPrinterInfo().hardwareVersion ?? this.snapshot.hardware,
        })
        return { software }
      },
    }
  }
}

export const printer = new PrinterController()

/** The tab must stay open for the whole transfer, including the reboot wait. */
function holdTab(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onLeave = (event: BeforeUnloadEvent) => {
    event.preventDefault()
    event.returnValue = ''
  }
  window.addEventListener('beforeunload', onLeave)
  return () => window.removeEventListener('beforeunload', onLeave)
}

export function countBlack(canvas: HTMLCanvasElement, direction: PrintDirection) {
  return describeEncoded(canvas, direction)
}
