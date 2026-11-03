import {
  ImageEncoder,
  LabelType,
  PageColorType,
  instantiateClient,
  type NiimbotAbstractClient,
  type PrintTaskName,
} from '@mmote/niimbluelib'
import type { AlignMode, PrintDirection, PrinterSnapshot, RfidView } from '../types'
import { emptyRfid } from '../types'
import { formatPacketLine, rfidFromClient } from '../lib/diag'
import { describeEncoded, padCanvas } from '../lib/encode'
import { resolvePrintTask } from '../lib/presets'

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
}

const initial = (): PrinterSnapshot => ({
  status: 'idle',
  transport: null,
  deviceName: '',
  model: '',
  detectedTask: '',
  dpi: null,
  printhead: null,
  battery: null,
  paper: null,
  firmware: '',
  hardware: '',
  protocol: null,
  serial: '',
  rfid: emptyRfid(),
  packetLog: '',
  lastPrint: '',
  error: '',
  printing: false,
  progress: 0,
  progressLabel: '',
})

export class PrinterController {
  private client: NiimbotAbstractClient | null = null
  private snapshot: PrinterSnapshot = initial()
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
    return {
      model: meta?.model ?? (info.modelId ? `#${info.modelId}` : this.snapshot.model),
      detectedTask: client.getPrintTaskType() ?? this.snapshot.detectedTask,
      dpi: meta?.dpi ?? this.snapshot.dpi,
      printhead: meta?.printheadPixels ?? this.snapshot.printhead,
      battery: info.batteryPercents ?? client.getHeartbeatData().batteryPercents ?? this.snapshot.battery,
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

  async connect(transport: 'bluetooth' | 'serial') {
    await this.disconnect()
    const client = instantiateClient(transport)
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
      if (this.client === client) {
        this.client = null
        this.patch(this.parked(this.snapshot.error))
      }
    })
    client.on('rfidinfofetched', () => {
      this.patch({ rfid: this.readRfid(client) })
    })
    client.on('heartbeat', (event) => {
      this.patch({
        battery: event.data.batteryPercents ?? this.snapshot.battery,
        paper: event.data.paperInserted ?? this.snapshot.paper,
        rfid: { ...this.snapshot.rfid, readOk: event.data.paperRfidSuccess ?? this.snapshot.rfid.readOk },
      })
    })
    client.on('printprogress', (event) => {
      const progress = Math.round((event.pagePrintProgress + event.pageFeedProgress) / 2)
      this.patch({
        progress,
        progressLabel: `${event.page}/${event.pagesTotal}`,
      })
    })
    client.on('printpacketprogress', (event) => {
      this.patch({ progress: event.progress, progressLabel: '…' })
    })
    try {
      await client.connect()
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
      const cancelled =
        error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'AbortError')
      this.patch({
        status: 'error',
        transport: null,
        error: cancelled ? 'cancelled' : error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  private parked(error = ''): PrinterSnapshot {
    return {
      ...initial(),
      error,
      deviceName: this.snapshot.deviceName,
      model: this.snapshot.model,
      detectedTask: this.snapshot.detectedTask,
      dpi: this.snapshot.dpi,
      printhead: this.snapshot.printhead,
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
    if (meta) density = Math.min(meta.densityMax, Math.max(meta.densityMin, density))
    const printhead = meta?.printheadPixels ?? job.printhead
    if (job.packetInterval !== null && Number.isFinite(job.packetInterval)) {
      client.setPacketInterval(Math.max(0, job.packetInterval))
    }
    // NiimBlue always stops the heartbeat before print. niimbluelib 0.49's
    // isHeartbeatStarted() is inverted, so do not trust it.
    client.stopHeartbeat()
    const totalPages = job.pages.length * quantity
    this.printLogAt = this.packetLines.length
    const plan = `# print task=${taskName} density=${density} labelType=${job.labelType} totalPages=${totalPages} printhead=${printhead ?? '-'} firmware=${info.softwareVersion ?? this.snapshot.firmware}`
    this.note(plan)
    const task = client.protocol.newPrintTask(taskName, {
      totalPages,
      density,
      speed: 1,
      labelType: job.labelType as LabelType,
      pageColor: PageColorType.SingleColor,
      statusPollIntervalMs: 100,
      statusTimeoutMs: 8_000,
    })
    this.patch({ printing: true, progress: 0, progressLabel: '', error: '' })
    let failure: unknown
    try {
      await task.printInit()
      for (const page of job.pages) {
        const { canvas } = padCanvas(page, job.direction, printhead, job.align)
        const encoded = ImageEncoder.encodeCanvas(canvas, PageColorType.SingleColor, job.direction)
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
}

export const printer = new PrinterController()

export function countBlack(canvas: HTMLCanvasElement, direction: PrintDirection) {
  return describeEncoded(canvas, direction)
}
