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
import { isPrintTask } from '../lib/presets'

export type PrintJob = {
  pages: HTMLCanvasElement[]
  direction: PrintDirection
  printhead?: number
  align: AlignMode
  density: number
  quantity: number
  labelType: number
  task: string
  packetInterval: number | null
}

const initial = (): PrinterSnapshot => ({
  status: 'idle',
  transport: null,
  deviceName: '',
  model: '',
  detectedTask: '',
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
      const info = client.getPrinterInfo()
      this.patch({
        status: 'connected',
        battery: info.batteryPercents ?? client.getHeartbeatData().batteryPercents ?? this.snapshot.battery,
        firmware: info.softwareVersion ?? this.snapshot.firmware,
        serial: info.serial ?? this.snapshot.serial,
        detectedTask: client.getPrintTaskType() ?? this.snapshot.detectedTask,
        model: client.getModelMetadata()?.model ?? this.snapshot.model,
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
    const taskName = (isPrintTask(job.task) ? job.task : 'B1') as PrintTaskName
    if (job.packetInterval !== null && Number.isFinite(job.packetInterval)) {
      client.setPacketInterval(Math.max(0, job.packetInterval))
    }
    try {
      await client.fetchHeartbeatData()
    } catch {
      /* some models ignore heartbeat */
    }
    const resumeHeartbeat = client.isHeartbeatStarted()
    if (resumeHeartbeat) client.stopHeartbeat()
    const totalPages = job.pages.length * quantity
    const task = client.protocol.newPrintTask(taskName, {
      totalPages,
      density: job.density,
      labelType: job.labelType as LabelType,
      pageColor: PageColorType.SingleColor,
      statusPollIntervalMs: 100,
      statusTimeoutMs: 8_000,
      pageTimeoutMs: 15_000,
    })
    this.patch({ printing: true, progress: 0, progressLabel: '', error: '' })
    let failure: unknown
    try {
      await task.printInit()
      for (const page of job.pages) {
        const { canvas } = padCanvas(page, job.direction, job.printhead, job.align)
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
      if (resumeHeartbeat) client.startHeartbeat()
      this.patch({ printing: false, progress: failure ? this.snapshot.progress : 100 })
    }
    if (failure) throw failure
  }
}

export const printer = new PrinterController()

export function countBlack(canvas: HTMLCanvasElement, direction: PrintDirection) {
  return describeEncoded(canvas, direction)
}
