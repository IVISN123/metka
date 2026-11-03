import './setup'
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricImage,
  Group,
  Line,
  Point,
  Rect,
  Textbox,
  Triangle,
  filters,
  loadSVGFromString,
  util,
  type FabricObject,
} from 'fabric'
import type { AlignMode, DitherChoice, EditorState, LabelDocument, Lang, PreviewSettings, PrintDirection, SelectedInfo } from '../types'
import { initialEditorState } from '../types'
import { buildBuiltin } from './builtins'
import { readMeta, writeMeta } from './meta'
import { barcodeDataUrl, qrDataUrl } from '../lib/codes'
import { iconById } from '../lib/icons'
import { formatPageLabel, parsePageRange } from '../lib/pages'
import { metaFor, suggestedTask } from '../lib/presets'
import { ensureFontsReady } from '../lib/fonts'
import { readAutosave } from '../lib/storage'
import { clamp, formatDate, mmToPx, uid, verticalize } from '../lib/units'

type GuideSet = { vertical: number[]; horizontal: number[] }

const NAMES: Record<Lang, Record<string, string>> = {
  ru: { text: 'Текст', image: 'Фото', icon: 'Иконка', shape: 'Фигура', barcode: 'Штрихкод', qr: 'QR', datetime: 'Дата', line: 'Линия', number: 'Номер' },
  en: { text: 'Text', image: 'Photo', icon: 'Icon', shape: 'Shape', barcode: 'Barcode', qr: 'QR', datetime: 'Date', line: 'Line', number: 'Number' },
}

function fabricType(obj: FabricObject) {
  return (obj.type || '').toLowerCase()
}

function isText(obj: FabricObject): obj is Textbox {
  const type = fabricType(obj)
  return type === 'textbox' || type === 'itext' || type === 'text'
}

function typingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export class EditorEngine {
  lang: Lang = 'ru'
  private canvas: Canvas | null = null
  private host: HTMLElement | null = null
  private guide: HTMLCanvasElement | null = null
  private paper: Rect | null = null
  private pxW = 320
  private pxH = 96
  private snapshot: EditorState = initialEditorState()
  private listeners = new Set<() => void>()
  private history: string[] = []
  private histIndex = -1
  private suspend = 0
  private loadToken = 0
  private didInitial = false
  private memory: { doc: LabelDocument; designId: string | null; dirty: boolean } | null = null
  private userPanned = false
  private guides: GuideSet = { vertical: [], horizontal: [] }
  private clip: Record<string, unknown>[] | null = null
  private space = false
  private panning = false
  private lastPan = { x: 0, y: 0 }
  private observer: ResizeObserver | null = null
  private onKeyDown = (event: KeyboardEvent) => this.keyDown(event)
  private onKeyUp = (event: KeyboardEvent) => {
    if (event.code === 'Space') this.space = false
  }
  private onPaste = (event: ClipboardEvent) => this.pasteEvent(event)
  private onDrop = (event: DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    if (file?.type.startsWith('image/')) void this.addImageFile(file)
  }
  private onDragOver = (event: DragEvent) => event.preventDefault()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.snapshot

  private commit(partial: Partial<EditorState>) {
    this.snapshot = { ...this.snapshot, ...partial }
    for (const listener of this.listeners) listener()
  }

  setLang(lang: Lang) {
    this.lang = lang
  }

  setWorkspace(color: string) {
    this.commit({ workspace: color })
    if (!this.canvas) return
    this.canvas.backgroundColor = color
    this.canvas.requestRenderAll()
  }

  attach(element: HTMLCanvasElement, host: HTMLElement, guide: HTMLCanvasElement) {
    this.detach(false)
    this.host = host
    this.guide = guide
    const canvas = new Canvas(element, {
      backgroundColor: this.snapshot.workspace,
      enableRetinaScaling: true,
      preserveObjectStacking: true,
      selection: true,
      stopContextMenu: true,
      fireRightClick: false,
      selectionColor: 'rgba(29,155,240,0.18)',
      selectionBorderColor: '#1d9bf0',
      selectionLineWidth: 1,
    })
    this.canvas = canvas
    this.bind(canvas, host)
    this.resize()
    this.observer = new ResizeObserver(() => this.resize())
    this.observer.observe(host)
    const token = ++this.loadToken
    void this.restore(token)
  }

  detach(keepMemory = true) {
    this.loadToken += 1
    if (keepMemory && this.canvas) {
      try {
        this.memory = { doc: this.toDocument(), designId: this.snapshot.designId, dirty: this.snapshot.dirty }
      } catch {
        /* canvas not ready */
      }
    }
    this.observer?.disconnect()
    this.observer = null
    this.unbind()
    this.canvas?.dispose()
    this.canvas = null
    this.paper = null
    this.host = null
  }

  private async restore(token: number) {
    if (!this.didInitial) {
      let saved: { doc: LabelDocument; designId: string | null } | null = null
      try {
        saved = await readAutosave()
      } catch {
        saved = null
      }
      if (token !== this.loadToken || !this.canvas) return
      await ensureFontsReady()
      if (token !== this.loadToken || !this.canvas) return
      if (saved?.doc) await this.loadDocument(saved.doc, saved.designId, false)
      else await this.loadDocument(await buildBuiltin('drone-strip'), null, false)
      if (token !== this.loadToken) return
      this.didInitial = true
      return
    }
    if (this.memory && this.canvas) {
      await this.loadDocument(this.memory.doc, this.memory.designId, this.memory.dirty)
    }
  }

  private bind(canvas: Canvas, host: HTMLElement) {
    canvas.on('object:modified', () => {
      this.syncTextMeta()
      this.pushHistory()
    })
    canvas.on('text:editing:exited', () => {
      this.syncTextMeta()
      this.pushHistory()
    })
    canvas.on('selection:created', () => this.syncSelection())
    canvas.on('selection:updated', () => this.syncSelection())
    canvas.on('selection:cleared', () => this.syncSelection())
    canvas.on('object:moving', (opt) => this.snap(opt.e, opt.transform.target))
    canvas.on('mouse:up', () => {
      this.panning = false
      this.guides = { vertical: [], horizontal: [] }
      this.drawGuides()
      if (this.canvas) this.canvas.selection = true
    })
    canvas.on('mouse:down', (opt) => {
      const event = opt.e
      if (this.space || ('button' in event && event.button === 1) || ('altKey' in event && event.altKey && !opt.target)) {
        this.panning = true
        canvas.selection = false
        this.lastPan = { x: 'clientX' in event ? event.clientX : 0, y: 'clientY' in event ? event.clientY : 0 }
      }
    })
    canvas.on('mouse:move', (opt) => {
      if (!this.panning) return
      const event = opt.e
      if (!('clientX' in event)) return
      const vpt = canvas.viewportTransform
      vpt[4] += event.clientX - this.lastPan.x
      vpt[5] += event.clientY - this.lastPan.y
      this.lastPan = { x: event.clientX, y: event.clientY }
      this.userPanned = true
      canvas.requestRenderAll()
    })
    canvas.on('mouse:wheel', (opt) => {
      const event = opt.e
      event.preventDefault()
      event.stopPropagation()
      let zoom = canvas.getZoom() * 0.999 ** event.deltaY
      zoom = clamp(zoom, 0.15, 12)
      canvas.zoomToPoint(new Point(event.offsetX, event.offsetY), zoom)
      this.userPanned = true
      this.commit({ zoom })
    })
    canvas.on('after:render', () => this.drawGuides())
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('paste', this.onPaste)
    host.addEventListener('dragover', this.onDragOver)
    host.addEventListener('drop', this.onDrop)
  }

  private unbind() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('paste', this.onPaste)
    this.host?.removeEventListener('dragover', this.onDragOver)
    this.host?.removeEventListener('drop', this.onDrop)
  }

  private resize() {
    if (!this.canvas || !this.host) return
    const width = Math.max(1, this.host.clientWidth)
    const height = Math.max(1, this.host.clientHeight)
    this.canvas.setDimensions({ width, height })
    if (this.guide) {
      const dpr = window.devicePixelRatio || 1
      this.guide.width = Math.floor(width * dpr)
      this.guide.height = Math.floor(height * dpr)
      this.guide.style.width = `${width}px`
      this.guide.style.height = `${height}px`
    }
    if (!this.userPanned && this.snapshot.ready) this.fit()
    else this.canvas.requestRenderAll()
  }

  toDocument(): LabelDocument {
    if (!this.canvas) throw new Error('canvas')
    const state = this.snapshot
    return {
      version: 1,
      name: state.name,
      widthMm: state.widthMm,
      heightMm: state.heightMm,
      dpi: state.dpi,
      model: state.model,
      direction: state.direction,
      labelType: state.labelType,
      density: state.density,
      quantity: state.quantity,
      align: state.align,
      task: state.task,
      taskAuto: state.taskAuto,
      pageFrom: state.pageFrom,
      pageTo: state.pageTo,
      preview: state.preview,
      canvas: this.canvas.toObject(['data']) as Record<string, unknown>,
    }
  }

  async loadDocument(doc: LabelDocument, designId: string | null, dirty: boolean) {
    if (!this.canvas) return
    this.suspend += 1
    this.pxW = mmToPx(doc.widthMm, doc.dpi)
    this.pxH = mmToPx(doc.heightMm, doc.dpi)
    await this.canvas.loadFromJSON(doc.canvas)
    this.ensurePaper()
    this.canvas.backgroundColor = this.snapshot.workspace
    this.suspend -= 1
    this.history = []
    this.histIndex = -1
    this.commit({
      ready: true,
      booting: false,
      name: doc.name,
      designId,
      widthMm: doc.widthMm,
      heightMm: doc.heightMm,
      dpi: doc.dpi,
      model: doc.model,
      direction: doc.direction,
      labelType: doc.labelType,
      density: doc.density,
      quantity: doc.quantity,
      align: doc.align,
      task: doc.task,
      taskAuto: doc.taskAuto,
      pageFrom: doc.pageFrom ?? 1,
      pageTo: doc.pageTo ?? 1,
      preview: doc.preview,
      dirty,
    })
    this.pushHistory(false)
    this.commit({ dirty })
    this.fit()
    this.syncSelection()
  }

  async useBuiltin(id: string) {
    await this.loadDocument(await buildBuiltin(id), null, true)
  }

  setName(name: string) {
    this.commit({ name, dirty: true })
  }

  markClean(designId: string | null = this.snapshot.designId) {
    this.commit({ dirty: false, designId })
  }

  private userObjects() {
    return (this.canvas?.getObjects() ?? []).filter((obj) => readMeta(obj)?.kind !== 'paper')
  }

  private ensurePaper() {
    if (!this.canvas) return
    const width = this.pxW
    const height = this.pxH
    if (!this.paper) {
      this.paper = new Rect({
        left: width / 2,
        top: height / 2,
        width,
        height,
        originX: 'center',
        originY: 'center',
        fill: '#ffffff',
        selectable: false,
        evented: false,
        excludeFromExport: true,
        hoverCursor: 'default',
        objectCaching: false,
        data: { id: 'paper', kind: 'paper', name: 'paper' },
      })
      this.canvas.add(this.paper)
    } else {
      this.paper.set({ left: width / 2, top: height / 2, width, height, scaleX: 1, scaleY: 1 })
      this.paper.setCoords()
    }
    this.canvas.sendObjectToBack(this.paper)
  }

  private named(kind: string) {
    const count = this.userObjects().filter((obj) => readMeta(obj)?.kind === kind).length + 1
    return `${NAMES[this.lang][kind] ?? kind} ${count}`
  }

  private viewCenter() {
    if (!this.canvas) return { x: this.pxW / 2, y: this.pxH / 2 }
    const vpt = this.canvas.viewportTransform
    const zoom = vpt[0] || 1
    const x = (this.canvas.getWidth() / 2 - vpt[4]) / zoom
    const y = (this.canvas.getHeight() / 2 - vpt[5]) / zoom
    return { x: clamp(x, 8, Math.max(8, this.pxW - 8)), y: clamp(y, 8, Math.max(8, this.pxH - 8)) }
  }

  private place(obj: FabricObject) {
    if (!this.canvas) return
    this.canvas.add(obj)
    this.canvas.setActiveObject(obj)
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  addText() {
    const center = this.viewCenter()
    const text = this.lang === 'ru' ? 'Текст' : 'Text'
    const box = new Textbox(text, {
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      width: Math.min(this.pxW * 0.7, 220),
      fontSize: Math.max(14, Math.round(this.pxH * 0.28)),
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      textAlign: 'center',
      data: { id: uid(), kind: 'text', name: this.named('text'), sourceText: text, vertical: false },
    })
    this.place(box)
  }

  addNumber() {
    const center = this.viewCenter()
    const text = formatPageLabel(this.snapshot.pageFrom)
    const box = new Textbox(text, {
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      width: Math.min(this.pxW * 0.45, 140),
      fontSize: Math.max(16, Math.round(this.pxH * 0.45)),
      fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
      fill: '#000000',
      textAlign: 'center',
      data: { id: uid(), kind: 'number', name: this.named('number'), prefix: '', suffix: '', pad: 0 },
    })
    this.place(box)
  }

  setPageRange(from: number, to: number) {
    if (!Number.isFinite(from) || !Number.isFinite(to)) return
    const nextFrom = Math.round(from)
    const nextTo = Math.round(to)
    this.commit({ pageFrom: nextFrom, pageTo: nextTo })
    const parsed = parsePageRange(nextFrom, nextTo)
    if ('error' in parsed) return
    for (const obj of this.userObjects()) {
      const meta = readMeta(obj)
      if (!meta || meta.kind !== 'number' || !isText(obj)) continue
      obj.set('text', formatPageLabel(parsed.from, meta.prefix ?? '', meta.suffix ?? '', meta.pad ?? 0))
    }
    this.canvas?.requestRenderAll()
    this.pushHistory()
  }

  async addImageFile(file: File) {
    const url = await readDataUrl(file)
    const image = await FabricImage.fromURL(url)
    const scale = Math.min(this.pxW * 0.7 / (image.width || 1), this.pxH * 0.9 / (image.height || 1), 4)
    const center = this.viewCenter()
    image.set({
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      scaleX: scale,
      scaleY: scale,
      data: { id: uid(), kind: 'image', name: this.named('image'), dither: 'inherit', brightness: 0, contrast: 0, invert: false },
    })
    this.place(image)
  }

  async addIcon(id: string) {
    const svg = iconById(id)?.svg
    if (!svg || !this.canvas) return
    const parsed = await loadSVGFromString(svg)
    const objects = parsed.objects.filter((object): object is FabricObject => object !== null)
    if (objects.length === 0) return
    const group = new Group(objects, { subTargetCheck: false })
    const target = Math.min(this.pxH * 0.8, 72)
    const scale = target / Math.max(group.width || 1, group.height || 1)
    const center = this.viewCenter()
    group.set({
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      scaleX: scale,
      scaleY: scale,
      data: { id: uid(), kind: 'icon', name: this.named('icon'), iconId: id },
    })
    this.place(group)
  }

  addShape(kind: 'rect' | 'round' | 'ellipse' | 'triangle') {
    const center = this.viewCenter()
    const width = Math.max(16, Math.min(this.pxW * 0.35, 90))
    const height = Math.max(12, Math.min(this.pxH * 0.55, 56))
    const common = { originX: 'center' as const, originY: 'center' as const, left: center.x, top: center.y }
    let obj: FabricObject
    if (kind === 'ellipse') {
      obj = new Ellipse({ ...common, rx: width / 2, ry: height / 2, fill: 'transparent', stroke: '#000000', strokeWidth: 2 })
    } else if (kind === 'triangle') {
      obj = new Triangle({ ...common, width, height, fill: '#000000', stroke: '' })
    } else {
      obj = new Rect({
        ...common,
        width,
        height,
        rx: kind === 'round' ? 8 : 0,
        ry: kind === 'round' ? 8 : 0,
        fill: kind === 'round' ? '#000000' : 'transparent',
        stroke: kind === 'round' ? '' : '#000000',
        strokeWidth: kind === 'round' ? 0 : 2,
      })
    }
    obj.set('data', { id: uid(), kind: 'shape', name: this.named('shape') })
    this.place(obj)
  }

  addLine() {
    const center = this.viewCenter()
    const line = new Line([-30, 0, 30, 0], {
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      stroke: '#000000',
      strokeWidth: 2,
      data: { id: uid(), kind: 'shape', name: this.named('line') },
    })
    this.place(line)
  }

  async addBarcode() {
    const value = 'SN-0001'
    const image = await FabricImage.fromURL(barcodeDataUrl(value, 'CODE128', true))
    const scale = Math.min(this.pxW * 0.7 / (image.width || 1), this.pxH * 0.7 / (image.height || 1), 2)
    const center = this.viewCenter()
    image.set({
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      scaleX: scale,
      scaleY: scale,
      data: { id: uid(), kind: 'barcode', name: this.named('barcode'), value, symbology: 'CODE128', showText: true },
    })
    this.place(image)
  }

  async addQr() {
    const value = 'SN-0001'
    const image = await FabricImage.fromURL(await qrDataUrl(value, 'M'))
    const scale = Math.min(this.pxW, this.pxH) * 0.7 / (image.width || 1)
    const center = this.viewCenter()
    image.set({
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      scaleX: scale,
      scaleY: scale,
      data: { id: uid(), kind: 'qr', name: this.named('qr'), value, ecl: 'M' },
    })
    this.place(image)
  }

  addDatetime() {
    const format = 'DD.MM.YYYY HH:mm'
    const text = formatDate(format)
    const center = this.viewCenter()
    const box = new Textbox(text, {
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      width: Math.min(this.pxW * 0.8, 240),
      fontSize: Math.max(12, Math.round(this.pxH * 0.22)),
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      textAlign: 'center',
      data: { id: uid(), kind: 'datetime', name: this.named('datetime'), sourceText: text, dateFormat: format, live: true, vertical: false },
    })
    this.place(box)
  }

  async updateSelected(patch: Partial<SelectedInfo>) {
    const obj = this.single()
    if (!obj) return
    const meta = { ...(readMeta(obj) ?? { id: uid(), kind: 'shape' as const, name: '' }) }
    if (patch.name !== undefined) meta.name = patch.name
    if (patch.fill !== undefined) obj.set('fill', patch.fill)
    if (patch.stroke !== undefined) obj.set('stroke', patch.stroke)
    if (patch.strokeWidth !== undefined) obj.set('strokeWidth', patch.strokeWidth)
    if (patch.angle !== undefined) obj.set('angle', patch.angle)
    if (patch.opacity !== undefined) obj.set('opacity', patch.opacity)
    if (patch.rx !== undefined && fabricType(obj) === 'rect') obj.set({ rx: patch.rx, ry: patch.rx })
    if (isText(obj)) {
      if (patch.fontFamily !== undefined) obj.set('fontFamily', patch.fontFamily)
      if (patch.fontSize !== undefined) obj.set('fontSize', patch.fontSize)
      if (patch.fontWeight !== undefined) obj.set('fontWeight', patch.fontWeight)
      if (patch.fontStyle !== undefined) obj.set('fontStyle', patch.fontStyle)
      if (patch.underline !== undefined) obj.set('underline', patch.underline)
      if (patch.textAlign !== undefined) obj.set('textAlign', patch.textAlign)
      if (patch.text !== undefined && meta.kind !== 'number') {
        meta.sourceText = patch.text
        obj.set('text', meta.vertical ? verticalize(patch.text) : patch.text)
      }
      if (meta.kind === 'number') {
        if (patch.prefix !== undefined) meta.prefix = patch.prefix
        if (patch.suffix !== undefined) meta.suffix = patch.suffix
        if (patch.pad !== undefined) meta.pad = Math.max(0, Math.min(6, Math.round(patch.pad) || 0))
        if (patch.prefix !== undefined || patch.suffix !== undefined || patch.pad !== undefined) {
          obj.set('text', formatPageLabel(this.snapshot.pageFrom, meta.prefix ?? '', meta.suffix ?? '', meta.pad ?? 0))
        }
      }
      if (patch.vertical !== undefined) {
        meta.vertical = patch.vertical
        const raw = (meta.sourceText ?? obj.text ?? '').replaceAll('\n', '')
        meta.sourceText = raw
        obj.set('text', meta.vertical ? verticalize(raw) : raw)
      }
      if (patch.dateFormat !== undefined) meta.dateFormat = patch.dateFormat
      if (patch.live !== undefined) meta.live = patch.live
      if ((patch.dateFormat !== undefined || patch.live !== undefined) && meta.kind === 'datetime' && meta.live !== false) {
        const text = formatDate(meta.dateFormat ?? 'DD.MM.YYYY')
        meta.sourceText = text
        obj.set('text', meta.vertical ? verticalize(text) : text)
      }
    }
    if (patch.brightness !== undefined) meta.brightness = patch.brightness
    if (patch.contrast !== undefined) meta.contrast = patch.contrast
    if (patch.invert !== undefined) meta.invert = patch.invert
    if (patch.dither !== undefined) meta.dither = patch.dither as DitherChoice
    if (patch.value !== undefined) meta.value = patch.value
    if (patch.symbology !== undefined) meta.symbology = patch.symbology
    if (patch.showText !== undefined) meta.showText = patch.showText
    if (patch.ecl !== undefined) meta.ecl = patch.ecl
    writeMeta(obj, meta)
    if (meta.kind === 'image' && fabricType(obj) === 'image') this.applyFilters(obj as FabricImage, meta)
    if (meta.kind === 'barcode' && (patch.value !== undefined || patch.symbology !== undefined || patch.showText !== undefined)) {
      await this.replaceRaster(obj, barcodeDataUrl(meta.value || '0', meta.symbology || 'CODE128', meta.showText !== false))
    }
    if (meta.kind === 'qr' && (patch.value !== undefined || patch.ecl !== undefined)) {
      await this.replaceRaster(obj, await qrDataUrl(meta.value || ' ', meta.ecl ?? 'M'))
    }
    obj.setCoords()
    this.canvas?.requestRenderAll()
    this.syncSelection()
    this.pushHistory()
  }

  private applyFilters(image: FabricImage, meta: { brightness?: number; contrast?: number; invert?: boolean }) {
    const list = []
    if (meta.brightness) list.push(new filters.Brightness({ brightness: meta.brightness }))
    if (meta.contrast) list.push(new filters.Contrast({ contrast: meta.contrast }))
    if (meta.invert) list.push(new filters.Invert())
    image.filters = list
    image.applyFilters()
  }

  private async replaceRaster(obj: FabricObject, src: string) {
    if (fabricType(obj) !== 'image') return
    const image = obj as FabricImage
    const next = await FabricImage.fromURL(src)
    const scaleX = image.scaleX ?? 1
    const scaleY = image.scaleY ?? 1
    image.setElement(next.getElement())
    image.set({ scaleX, scaleY })
  }

  deleteSelected() {
    if (!this.canvas) return
    const objects = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper')
    if (objects.length === 0) return
    this.canvas.discardActiveObject()
    this.canvas.remove(...objects)
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  async duplicate() {
    if (!this.canvas) return
    const objects = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper')
    if (objects.length === 0) return
    await this.spawn(objects.map((obj) => obj.toObject(['data']) as Record<string, unknown>), 10)
  }

  private async spawn(jsons: Record<string, unknown>[], offset: number) {
    if (!this.canvas) return
    const created = (await util.enlivenObjects(jsons)) as FabricObject[]
    for (const obj of created) {
      const meta = readMeta(obj)
      obj.set({ left: (obj.left ?? 0) + offset, top: (obj.top ?? 0) + offset })
      if (meta) writeMeta(obj, { ...meta, id: uid(), name: `${meta.name}` })
      this.canvas.add(obj)
    }
    if (created.length === 1 && created[0]) this.canvas.setActiveObject(created[0])
    else if (created.length > 1) this.canvas.setActiveObject(new ActiveSelection(created, { canvas: this.canvas }))
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  copy() {
    if (!this.canvas) return
    const objects = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper')
    if (objects.length === 0) return
    this.clip = objects.map((obj) => obj.toObject(['data']) as Record<string, unknown>)
  }

  async paste() {
    if (!this.clip) return
    await this.spawn(this.clip.map((item) => structuredClone(item)), 12)
  }

  align(mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') {
    if (!this.canvas) return
    for (const obj of this.canvas.getActiveObjects()) {
      if (readMeta(obj)?.kind === 'paper') continue
      const bounds = obj.getBoundingRect()
      let dx = 0
      let dy = 0
      if (mode === 'left') dx = -bounds.left
      if (mode === 'center') dx = this.pxW / 2 - (bounds.left + bounds.width / 2)
      if (mode === 'right') dx = this.pxW - (bounds.left + bounds.width)
      if (mode === 'top') dy = -bounds.top
      if (mode === 'middle') dy = this.pxH / 2 - (bounds.top + bounds.height / 2)
      if (mode === 'bottom') dy = this.pxH - (bounds.top + bounds.height)
      obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
      obj.setCoords()
    }
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  order(action: 'forward' | 'backward' | 'front' | 'back') {
    const obj = this.single()
    if (!obj || !this.canvas || !this.paper) return
    if (action === 'forward') this.canvas.bringObjectForward(obj)
    if (action === 'backward') this.canvas.sendObjectBackwards(obj)
    if (action === 'front') this.canvas.bringObjectToFront(obj)
    if (action === 'back') {
      const index = this.canvas.getObjects().indexOf(this.paper)
      this.canvas.moveObjectTo(obj, index + 1)
    }
    if (this.canvas.getObjects().indexOf(this.paper) !== 0) this.canvas.sendObjectToBack(this.paper)
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  select(id: string) {
    const obj = this.userObjects().find((item) => readMeta(item)?.id === id)
    if (!this.canvas) return
    if (obj) this.canvas.setActiveObject(obj)
    else this.canvas.discardActiveObject()
    this.canvas.requestRenderAll()
    this.syncSelection()
  }

  toggleLock(id: string) {
    const obj = this.userObjects().find((item) => readMeta(item)?.id === id)
    if (!obj) return
    const locked = !obj.lockMovementX
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: !locked,
    })
    this.canvas?.requestRenderAll()
    this.syncSelection()
    this.pushHistory()
  }

  toggleVisible(id: string) {
    const obj = this.userObjects().find((item) => readMeta(item)?.id === id)
    if (!obj) return
    obj.set('visible', obj.visible === false)
    this.canvas?.requestRenderAll()
    this.syncSelection()
    this.pushHistory()
  }

  nudge(dx: number, dy: number) {
    if (!this.canvas) return
    const objects = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper' && !obj.lockMovementX)
    if (objects.length === 0) return
    for (const obj of objects) {
      obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy })
      obj.setCoords()
    }
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  setSize(widthMm: number, heightMm: number, dpi?: number) {
    const width = clamp(widthMm, 8, 120)
    const height = clamp(heightMm, 8, 200)
    const nextDpi = dpi && Number.isFinite(dpi) ? clamp(Math.round(dpi), 96, 600) : this.snapshot.dpi
    if (nextDpi !== this.snapshot.dpi) this.applyDpi(nextDpi)
    this.pxW = mmToPx(width, nextDpi)
    this.pxH = mmToPx(height, nextDpi)
    this.ensurePaper()
    this.commit({ widthMm: width, heightMm: height, dpi: nextDpi })
    this.pushHistory()
    this.fit()
  }

  rotateLabel() {
    const oldW = this.pxW
    const oldH = this.pxH
    const cx = oldW / 2
    const cy = oldH / 2
    for (const obj of this.userObjects()) {
      const dx = (obj.left ?? 0) - cx
      const dy = (obj.top ?? 0) - cy
      obj.set({ left: cy + dy, top: cx - dx, angle: ((obj.angle ?? 0) + 90) % 360 })
      obj.setCoords()
    }
    this.pxW = oldH
    this.pxH = oldW
    this.ensurePaper()
    this.commit({ widthMm: this.snapshot.heightMm, heightMm: this.snapshot.widthMm })
    this.pushHistory()
    this.fit()
  }

  setModel(model: string) {
    const meta = metaFor(model)
    if (!meta) return
    this.applyDpi(meta.dpi)
    const suggestion = suggestedTask(model)
    this.commit({
      model,
      dpi: meta.dpi,
      direction: meta.printDirection === 'left' ? 'left' : 'top',
      density: meta.densityDefault,
      task: suggestion.task,
    })
    this.pushHistory()
    this.fit()
  }

  setDpi(dpi: number) {
    const next = clamp(Math.round(dpi), 96, 600)
    this.applyDpi(next)
    this.commit({ dpi: next })
    this.pushHistory()
    this.fit()
  }

  private applyDpi(dpi: number) {
    const previous = this.snapshot.dpi || dpi
    const scale = dpi / previous
    if (scale !== 1) {
      for (const obj of this.userObjects()) {
        obj.set({
          left: (obj.left ?? 0) * scale,
          top: (obj.top ?? 0) * scale,
          scaleX: (obj.scaleX ?? 1) * scale,
          scaleY: (obj.scaleY ?? 1) * scale,
        })
        obj.setCoords()
      }
    }
    this.pxW = mmToPx(this.snapshot.widthMm, dpi)
    this.pxH = mmToPx(this.snapshot.heightMm, dpi)
    this.ensurePaper()
  }

  setDirection(direction: PrintDirection) {
    this.commit({ direction })
    this.pushHistory()
  }

  setLabelType(labelType: number) {
    this.commit({ labelType })
    this.pushHistory()
  }

  setDensity(density: number) {
    this.commit({ density })
    this.pushHistory()
  }

  setQuantity(quantity: number) {
    this.commit({ quantity: clamp(Math.round(quantity), 1, 200) })
  }

  setAlign(align: AlignMode) {
    this.commit({ align })
  }

  setTask(task: string, taskAuto: boolean) {
    this.commit({ task, taskAuto })
  }

  setPreview(partial: Partial<PreviewSettings>) {
    this.commit({ preview: { ...this.snapshot.preview, ...partial } })
    this.pushHistory()
  }

  refreshDates() {
    for (const obj of this.userObjects()) {
      const meta = readMeta(obj)
      if (!meta || meta.kind !== 'datetime' || meta.live === false || !isText(obj)) continue
      const text = formatDate(meta.dateFormat ?? 'DD.MM.YYYY')
      writeMeta(obj, { ...meta, sourceText: text })
      obj.set('text', meta.vertical ? verticalize(text) : text)
    }
    this.canvas?.requestRenderAll()
    this.pushHistory()
  }

  async applyValue(value: string) {
    const obj = this.single()
    const meta = readMeta(obj)
    if (!obj || !meta) return false
    if (meta.kind === 'text' || meta.kind === 'datetime') {
      await this.updateSelected({ text: value })
      return true
    }
    if (meta.kind === 'qr' || meta.kind === 'barcode') {
      await this.updateSelected({ value })
      return true
    }
    return false
  }

  undo() {
    if (this.histIndex <= 0) return
    this.histIndex -= 1
    void this.applyHist(this.history[this.histIndex] ?? '')
  }

  redo() {
    if (this.histIndex >= this.history.length - 1) return
    this.histIndex += 1
    void this.applyHist(this.history[this.histIndex] ?? '')
  }

  zoomBy(factor: number) {
    if (!this.canvas) return
    const zoom = clamp(this.canvas.getZoom() * factor, 0.15, 12)
    this.canvas.zoomToPoint(new Point(this.canvas.getWidth() / 2, this.canvas.getHeight() / 2), zoom)
    this.userPanned = true
    this.commit({ zoom })
  }

  fit() {
    if (!this.canvas) return
    const cw = this.canvas.getWidth()
    const ch = this.canvas.getHeight()
    const zoom = clamp(Math.min((cw - 48) / this.pxW, (ch - 48) / this.pxH), 0.2, 10)
    const tx = (cw - this.pxW * zoom) / 2
    const ty = (ch - this.pxH * zoom) / 2
    this.canvas.setViewportTransform([zoom, 0, 0, zoom, tx, ty])
    this.userPanned = false
    this.canvas.requestRenderAll()
    this.commit({ zoom })
  }

  private pushHistory(markDirty = true) {
    if (this.suspend || !this.canvas) return
    let json = ''
    try {
      json = JSON.stringify(this.toDocument())
    } catch {
      return
    }
    if (this.history[this.histIndex] === json) {
      this.syncSelection()
      return
    }
    this.history = this.history.slice(0, this.histIndex + 1)
    this.history.push(json)
    if (this.history.length > 40) this.history.shift()
    this.histIndex = this.history.length - 1
    this.commit({
      canUndo: this.histIndex > 0,
      canRedo: false,
      dirty: markDirty ? true : this.snapshot.dirty,
      contentRev: this.snapshot.contentRev + 1,
    })
    this.syncSelection()
  }

  private async applyHist(json: string) {
    if (!this.canvas || !json) return
    const doc = JSON.parse(json) as LabelDocument
    this.suspend += 1
    this.pxW = mmToPx(doc.widthMm, doc.dpi)
    this.pxH = mmToPx(doc.heightMm, doc.dpi)
    await this.canvas.loadFromJSON(doc.canvas)
    this.ensurePaper()
    this.suspend -= 1
    this.commit({
      name: doc.name,
      widthMm: doc.widthMm,
      heightMm: doc.heightMm,
      dpi: doc.dpi,
      model: doc.model,
      direction: doc.direction,
      labelType: doc.labelType,
      density: doc.density,
      quantity: doc.quantity,
      align: doc.align,
      task: doc.task,
      taskAuto: doc.taskAuto,
      pageFrom: doc.pageFrom ?? 1,
      pageTo: doc.pageTo ?? 1,
      preview: doc.preview,
      canUndo: this.histIndex > 0,
      canRedo: this.histIndex < this.history.length - 1,
      dirty: true,
      contentRev: this.snapshot.contentRev + 1,
    })
    this.canvas.requestRenderAll()
    this.syncSelection()
  }

  private syncTextMeta() {
    for (const obj of this.userObjects()) {
      const meta = readMeta(obj)
      if (!meta || !isText(obj) || (meta.kind !== 'text' && meta.kind !== 'datetime')) continue
      if (meta.vertical) {
        const raw = (obj.text ?? '').replaceAll('\n', '')
        if (raw !== meta.sourceText) writeMeta(obj, { ...meta, sourceText: raw })
      } else if ((obj.text ?? '') !== meta.sourceText) {
        writeMeta(obj, { ...meta, sourceText: obj.text ?? '' })
      }
    }
  }

  private syncSelection() {
    if (!this.canvas) return
    const active = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper')
    const layers = [...this.userObjects()].reverse().map((obj) => {
      const meta = readMeta(obj)
      return {
        id: meta?.id ?? '',
        name: meta?.name ?? obj.type,
        kind: meta?.kind ?? 'shape',
        visible: obj.visible !== false,
        locked: !!obj.lockMovementX,
      }
    })
    const only = active.length === 1 ? active[0] : undefined
    this.commit({
      layers,
      selected: only ? describe(only) : null,
      selectedId: only ? (readMeta(only)?.id ?? null) : null,
      multi: active.length > 1 ? active.length : 0,
    })
  }

  private single() {
    const active = this.canvas?.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper') ?? []
    return active.length === 1 ? active[0] ?? null : null
  }

  private snap(event: Event, target: FabricObject) {
    if (!this.canvas || readMeta(target)?.kind === 'paper') return
    if ('altKey' in event && event.altKey) {
      this.guides = { vertical: [], horizontal: [] }
      this.drawGuides()
      return
    }
    const zoom = this.canvas.getZoom() || 1
    const thresh = 6 / zoom
    const bounds = target.getBoundingRect()
    const xs = [0, this.pxW / 2, this.pxW]
    const ys = [0, this.pxH / 2, this.pxH]
    for (const obj of this.canvas.getObjects()) {
      if (obj === target || obj === this.paper || obj.group === target) continue
      const box = obj.getBoundingRect()
      xs.push(box.left, box.left + box.width / 2, box.left + box.width)
      ys.push(box.top, box.top + box.height / 2, box.top + box.height)
    }
    const edgesX = [bounds.left, bounds.left + bounds.width / 2, bounds.left + bounds.width]
    const edgesY = [bounds.top, bounds.top + bounds.height / 2, bounds.top + bounds.height]
    let bestDx = 0
    let bestDy = 0
    let distX = thresh
    let distY = thresh
    let guideX: number | null = null
    let guideY: number | null = null
    for (const x of xs) {
      for (const edge of edgesX) {
        const delta = x - edge
        if (Math.abs(delta) < distX) {
          distX = Math.abs(delta)
          bestDx = delta
          guideX = x
        }
      }
    }
    for (const y of ys) {
      for (const edge of edgesY) {
        const delta = y - edge
        if (Math.abs(delta) < distY) {
          distY = Math.abs(delta)
          bestDy = delta
          guideY = y
        }
      }
    }
    if (distX >= thresh) {
      bestDx = 0
      guideX = null
    }
    if (distY >= thresh) {
      bestDy = 0
      guideY = null
    }
    if (bestDx || bestDy) {
      target.set({ left: (target.left ?? 0) + bestDx, top: (target.top ?? 0) + bestDy })
      target.setCoords()
    }
    this.guides = { vertical: guideX === null ? [] : [guideX], horizontal: guideY === null ? [] : [guideY] }
    this.drawGuides()
  }

  private drawGuides() {
    const guide = this.guide
    const canvas = this.canvas
    if (!guide || !canvas) return
    const ctx = guide.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    ctx.clearRect(0, 0, guide.width, guide.height)
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#1d9bf0'
    ctx.lineWidth = 1
    const vpt = canvas.viewportTransform
    const height = guide.height / dpr
    const width = guide.width / dpr
    for (const x of this.guides.vertical) {
      const sx = x * vpt[0] + vpt[4]
      ctx.beginPath()
      ctx.moveTo(sx + 0.5, 0)
      ctx.lineTo(sx + 0.5, height)
      ctx.stroke()
    }
    for (const y of this.guides.horizontal) {
      const sy = y * vpt[3] + vpt[5]
      ctx.beginPath()
      ctx.moveTo(0, sy + 0.5)
      ctx.lineTo(width, sy + 0.5)
      ctx.stroke()
    }
    ctx.restore()
  }

  private keyDown(event: KeyboardEvent) {
    if (typingTarget(event.target) || !this.canvas) return
    const meta = event.metaKey || event.ctrlKey
    if (event.code === 'Space') {
      this.space = true
      event.preventDefault()
      return
    }
    if (meta && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      this.undo()
      return
    }
    if (meta && (event.key.toLowerCase() === 'y' || (event.key.toLowerCase() === 'z' && event.shiftKey))) {
      event.preventDefault()
      this.redo()
      return
    }
    if (meta && event.key.toLowerCase() === 'd') {
      event.preventDefault()
      void this.duplicate()
      return
    }
    if (meta && event.key.toLowerCase() === 'c') {
      this.copy()
      return
    }
    if (meta && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      const objects = this.userObjects().filter((obj) => obj.visible !== false)
      if (objects.length === 1 && objects[0]) this.canvas.setActiveObject(objects[0])
      else if (objects.length > 1) this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
      this.canvas.requestRenderAll()
      this.syncSelection()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      this.deleteSelected()
      return
    }
    const step = event.shiftKey ? 10 : 1
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      this.nudge(-step, 0)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      this.nudge(step, 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      this.nudge(0, -step)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      this.nudge(0, step)
    }
  }

  private pasteEvent(event: ClipboardEvent) {
    if (typingTarget(event.target)) return
    const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'))
    if (file) {
      event.preventDefault()
      void this.addImageFile(file)
      return
    }
    if (this.clip) {
      event.preventDefault()
      void this.paste()
    }
  }
}

function describe(obj: FabricObject): SelectedInfo {
  const meta = readMeta(obj)
  const info: SelectedInfo = {
    id: meta?.id ?? '',
    kind: meta?.kind ?? 'shape',
    name: meta?.name ?? obj.type,
    fill: colorOf(obj.fill),
    stroke: colorOf(obj.stroke),
    strokeWidth: obj.strokeWidth ?? 0,
    angle: Math.round(obj.angle ?? 0),
    opacity: obj.opacity ?? 1,
    brightness: meta?.brightness ?? 0,
    contrast: meta?.contrast ?? 0,
    invert: !!meta?.invert,
    dither: meta?.dither ?? 'inherit',
    value: meta?.value,
    symbology: meta?.symbology,
    showText: meta?.showText,
    ecl: meta?.ecl,
    dateFormat: meta?.dateFormat,
    live: meta?.live,
    vertical: meta?.vertical,
    prefix: meta?.prefix,
    suffix: meta?.suffix,
    pad: meta?.pad,
    rx: fabricType(obj) === 'rect' ? ((obj as Rect).rx ?? 0) : undefined,
  }
  if (isText(obj)) {
    info.text = meta?.vertical ? (meta.sourceText ?? '') : (obj.text ?? '')
    info.fontFamily = obj.fontFamily
    info.fontSize = obj.fontSize
    info.fontWeight = obj.fontWeight
    info.fontStyle = obj.fontStyle
    info.underline = !!obj.underline
    info.textAlign = obj.textAlign
  }
  return info
}

function colorOf(value: unknown): string {
  if (typeof value === 'string') return value
  return 'transparent'
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read'))
    reader.readAsDataURL(file)
  })
}

export const engine = new EditorEngine()
