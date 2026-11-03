import {
  ImageEncoder,
  LabelType,
  PageColorType,
  instantiateClient,
  type NiimbotAbstractClient,
  type PrintTaskName,
} from '@mmote/niimbluelib'
import type { AlignMode, PrintDirection, PrinterSnapshot } from '../types'
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
  serial: '',
  error: '',
  printing: false,
  progress: 0,
  progressLabel: '',
})

export class PrinterController {
  private client: NiimbotAbstractClient | null = null
  private snapshot: PrinterSnapshot = initial()
  private listeners = new Set<() => void>()

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
    this.patch({ status: 'connecting', transport, error: '', progress: 0, progressLabel: '' })
    client.on('connect', (event) => {
      const info = client.getPrinterInfo()
      const meta = client.getModelMetadata()
      this.patch({
        status: 'connected',
        deviceName: event.info.deviceName ?? '',
        model: meta?.model ?? (info.modelId ? `#${info.modelId}` : ''),
        detectedTask: client.getPrintTaskType() ?? '',
        dpi: meta?.dpi ?? null,
        printhead: meta?.printheadPixels ?? null,
        battery: info.batteryPercents ?? client.getHeartbeatData().batteryPercents ?? null,
        firmware: info.softwareVersion ?? '',
        serial: info.serial ?? '',
        error: '',
      })
    })
    client.on('disconnect', () => {
      if (this.client === client) {
        this.client = null
        this.patch({ ...initial(), error: this.snapshot.error })
      }
    })
    client.on('heartbeat', (event) => {
      this.patch({
        battery: event.data.batteryPercents ?? this.snapshot.battery,
        paper: event.data.paperInserted ?? this.snapshot.paper,
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
      const info = client.getPrinterInfo()
      const meta = client.getModelMetadata()
      this.patch({
        status: 'connected',
        battery: info.batteryPercents ?? client.getHeartbeatData().batteryPercents ?? this.snapshot.battery,
        firmware: info.softwareVersion ?? this.snapshot.firmware,
        serial: info.serial ?? this.snapshot.serial,
        detectedTask: client.getPrintTaskType() ?? this.snapshot.detectedTask,
        model: meta?.model ?? this.snapshot.model,
        dpi: meta?.dpi ?? this.snapshot.dpi,
        printhead: meta?.printheadPixels ?? this.snapshot.printhead,
      })
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

  async disconnect() {
    const client = this.client
    this.client = null
    if (!client) {
      this.patch(initial())
      return
    }
    client.removeAllListeners()
    try {
      await client.disconnect()
    } catch {
      /* already gone */
    }
    this.patch(initial())
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
      this.patch({ printing: false, progress: failure ? this.snapshot.progress : 100 })
    }
    if (failure) throw failure
  }
}

export const printer = new PrinterController()

export function countBlack(canvas: HTMLCanvasElement, direction: PrintDirection) {
  return describeEncoded(canvas, direction)
}
