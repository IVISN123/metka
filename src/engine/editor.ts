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
import type { AlignMode, DitherChoice, EditorState, LabelDocument, Lang, Meta, PreviewSettings, PrintDirection, SelectedInfo } from '../types'
import { initialEditorState } from '../types'
import { buildBuiltin } from './builtins'
import { readMeta, writeMeta } from './meta'
import { translate } from '../i18n'
import { normalizeDocument } from '../lib/bundle'
import { barcodeDataUrl, qrDataUrl } from '../lib/codes'
import { assertCode, barcodePixelSize, defaultMark, encodeQrPayload, mergeMark, specFromMeta } from '../lib/vector-code'
import { VectorCode, isVectorCode } from './vector-object'
import { iconById, symbolSvg } from '../lib/icons'
import { MAX_PHOTO_BYTES, MAX_PHOTO_EDGE, historyDepth, targetPhotoSize } from '../lib/limits'
import { formatPageLabel, parsePageRange } from '../lib/pages'
import { metaFor, suggestedTask } from '../lib/presets'
import { ensureFontsReady } from '../lib/fonts'
import { readAutosave } from '../lib/storage'
import {
  alignDelta,
  boxToMm,
  defaultCornerMm,
  distributeDelta,
  matchEditorShortcut,
  originPoint,
  pinchZoom,
  topLeftBox,
  touchDistance,
  unionBox,
  gridStops,
  normalizeGridStep,
  rulerLayout,
  type AlignEdge,
  type AxisBox,
} from '../lib/editor-ui'
import { toast } from '../toast'
import { clamp, clampCopies, clampDpi, clampSize, formatDate, mmToPx, uid, verticalize } from '../lib/units'
import { bakeVectorInPlace, noteTextGesture, scaleToolOn, setScaleTool, styleObject } from './chrome'
import { prepareObject, prepareScene, vectorOf } from '../lib/scene-paint'
import {
  commitHistory,
  measureGaps,
  nudgeStepPx,
  reorderFrontToBack,
  snapTranslation,
  textResize,
  toggleSelection,
  type DropPlace,
  type GapLabel,
  type TextMode,
} from '../lib/transform'

type GuideSet = { vertical: number[]; horizontal: number[] }
type Geom = { left?: number; top?: number; scaleX?: number; scaleY?: number; angle?: number; width?: number; height?: number; skewX?: number; skewY?: number }

const NAMES: Record<Lang, Record<string, string>> = {
  ru: { text: 'Текст', image: 'Фото', icon: 'Иконка', shape: 'Фигура', barcode: 'Штрихкод', qr: 'QR', datetime: 'Дата', line: 'Линия', number: 'Номер', group: 'Группа' },
  en: { text: 'Text', image: 'Photo', icon: 'Icon', shape: 'Shape', barcode: 'Barcode', qr: 'QR', datetime: 'Date', line: 'Line', number: 'Number', group: 'Group' },
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
  private snapshot: EditorState = { ...initialEditorState(), ...readGridPrefs() }
  private listeners = new Set<() => void>()
  private history: string[] = []
  private histIndex = -1
  private suspend = 0
  private loadToken = 0
  private didInitial = false
  private memory: { doc: LabelDocument; designId: string | null; dirty: boolean } | null = null
  private userPanned = false
  private guides: GuideSet = { vertical: [], horizontal: [] }
  private measures: GapLabel[] = []
  private altClone: Promise<void> | null = null
  private clip: Record<string, unknown>[] | null = null
  private space = false
  private panning = false
  private lastPan = { x: 0, y: 0 }
  private pinch: { dist: number; zoom: number } | null = null
  private gesture = false
  private gestureWrote = false
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
  private onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2 || !this.canvas) return
    const a = event.touches[0]
    const b = event.touches[1]
    if (!a || !b) return
    this.pinch = { dist: touchDistance(a, b), zoom: this.canvas.getZoom() }
    this.panning = false
  }
  private onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 2 || !this.pinch || !this.canvas || !this.host) return
    const a = event.touches[0]
    const b = event.touches[1]
    if (!a || !b) return
    event.preventDefault()
    const zoom = pinchZoom(this.pinch.dist, touchDistance(a, b), this.pinch.zoom)
    const rect = this.host.getBoundingClientRect()
    const x = (a.clientX + b.clientX) / 2 - rect.left
    const y = (a.clientY + b.clientY) / 2 - rect.top
    this.canvas.zoomToPoint(new Point(x, y), zoom)
    this.userPanned = true
    this.commit({ zoom })
  }
  private onTouchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) this.pinch = null
  }

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
      selectionColor: 'rgba(13,153,255,0.14)',
      selectionBorderColor: '#0d99ff',
      selectionLineWidth: 1,
      uniformScaling: false,
      centeredScaling: false,
      uniScaleKey: 'shiftKey',
      centeredKey: 'altKey',
      selectionKey: 'shiftKey',
      targetFindTolerance: 8,
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
      let saved: Awaited<ReturnType<typeof readAutosave>> = null
      try {
        saved = await readAutosave()
      } catch {
        saved = null
      }
      if (token !== this.loadToken || !this.canvas) return
      await ensureFontsReady()
      if (token !== this.loadToken || !this.canvas) return
      try {
        if (saved?.doc) await this.loadDocument(saved.doc, saved.designId, saved.dirty)
        else await this.loadDocument(await buildBuiltin('drone-strip'), null, false)
      } catch {
        if (token !== this.loadToken || !this.canvas) return
        await this.loadDocument(await buildBuiltin('drone-strip'), null, false)
      }
      if (token !== this.loadToken) return
      this.didInitial = true
      return
    }
    if (this.memory && this.canvas) {
      await this.loadDocument(this.memory.doc, this.memory.designId, this.memory.dirty)
    }
  }

  private bind(canvas: Canvas, host: HTMLElement) {
    canvas.on('before:transform', (opt) => {
      const target = opt.transform?.target
      if (!target) return
      noteTextGesture(target)
      const corner = opt.transform?.corner
      if (!corner || corner === 'mtr' || corner.startsWith('rot')) return
      if (isVectorCode(target) && ((target.scaleX ?? 1) !== 1 || (target.scaleY ?? 1) !== 1)) {
        target.setBox(Math.abs((target.width || 1) * (target.scaleX || 1)), Math.abs((target.height || 1) * (target.scaleY || 1)))
        return
      }
      if (vectorOf(target) && vectorOf(target) !== 'line') bakeVectorInPlace(target)
    })
    canvas.on('object:modified', () => this.finishTransform())
    canvas.on('text:changed', (opt) => {
      const target = opt.target
      if (target && isText(target) && readMeta(target)?.textMode === 'auto') this.fitAutoWidth(target)
    })
    canvas.on('text:editing:exited', () => {
      this.syncTextMeta()
      const active = this.single()
      if (active && isText(active) && readMeta(active)?.textMode === 'auto') this.fitAutoWidth(active)
      this.pushHistory()
    })
    canvas.on('selection:created', () => this.syncSelection())
    canvas.on('selection:updated', () => this.syncSelection())
    canvas.on('selection:cleared', () => this.syncSelection())
    canvas.on('object:moving', (opt) => {
      this.maybeAltDuplicate(opt.transform?.target, opt.transform?.original, opt.transform?.action, opt.e)
      if (opt.transform?.target) this.snap(opt.e, opt.transform.target)
    })
    canvas.on('mouse:up', () => {
      this.panning = false
      this.guides = { vertical: [], horizontal: [] }
      this.measures = []
      this.drawGuides()
      if (this.canvas) this.canvas.selection = true
    })
    canvas.on('mouse:down', (opt) => {
      const event = opt.e
      const touch = 'pointerType' in event && event.pointerType === 'touch'
      if (this.space || ('button' in event && event.button === 1) || ('altKey' in event && event.altKey && !opt.target) || (touch && !opt.target)) {
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
    host.addEventListener('touchstart', this.onTouchStart, { passive: true })
    host.addEventListener('touchmove', this.onTouchMove, { passive: false })
    host.addEventListener('touchend', this.onTouchEnd)
    host.addEventListener('touchcancel', this.onTouchEnd)
  }

  private unbind() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('paste', this.onPaste)
    this.host?.removeEventListener('dragover', this.onDragOver)
    this.host?.removeEventListener('drop', this.onDrop)
    this.host?.removeEventListener('touchstart', this.onTouchStart)
    this.host?.removeEventListener('touchmove', this.onTouchMove)
    this.host?.removeEventListener('touchend', this.onTouchEnd)
    this.host?.removeEventListener('touchcancel', this.onTouchEnd)
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
      cornerMm: state.cornerMm,
      ...(state.gapMm != null ? { gapMm: state.gapMm } : {}),
      canvas: this.canvas.toObject(['data']) as Record<string, unknown>,
    }
  }

  async loadDocument(doc: LabelDocument, designId: string | null, dirty: boolean) {
    const normalized = normalizeDocument(doc, { clamp: true, maxImageChars: null })
    if (!normalized.ok) throw new Error('importFail')
    doc = normalized.doc
    if (!this.canvas) return
    this.suspend += 1
    this.pxW = mmToPx(doc.widthMm, doc.dpi)
    this.pxH = mmToPx(doc.heightMm, doc.dpi)
    this.commit({
      dpi: doc.dpi,
      widthMm: doc.widthMm,
      heightMm: doc.heightMm,
      cornerMm: doc.cornerMm ?? defaultCornerMm(doc.widthMm, doc.heightMm),
    })
    await this.canvas.loadFromJSON(doc.canvas)
    this.decorateAll()
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
      cornerMm: doc.cornerMm ?? defaultCornerMm(doc.widthMm, doc.heightMm),
      gapMm: doc.gapMm ?? null,
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
        rx: this.cornerPx(),
        ry: this.cornerPx(),
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
      this.paper.set({ left: width / 2, top: height / 2, width, height, scaleX: 1, scaleY: 1, rx: this.cornerPx(), ry: this.cornerPx() })
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
    this.decorate(obj)
    this.canvas.add(obj)
    this.canvas.setActiveObject(obj)
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  private decorate(obj: FabricObject) {
    if (readMeta(obj)?.kind === 'paper') return
    prepareObject(obj)
    styleObject(obj)
    const nested = obj as FabricObject & { getObjects?: () => FabricObject[] }
    if (typeof nested.getObjects === 'function') {
      for (const child of nested.getObjects()) this.decorate(child)
    }
  }

  private decorateAll() {
    if (!this.canvas) return
    prepareScene(this.canvas.getObjects())
    for (const obj of this.canvas.getObjects()) this.decorate(obj)
  }

  private fitAutoWidth(obj: FabricObject) {
    if (!isText(obj)) return
    const measured = obj.calcTextWidth()
    obj.set({ width: Math.max(8, Math.ceil(measured) + 2), scaleX: 1, scaleY: 1 })
    obj.initDimensions()
    obj.setCoords()
  }

  private finishTransform() {
    const pending = this.altClone
    const run = () => {
      this.normalizeModified()
      this.syncTextMeta()
      this.pushHistory()
    }
    if (pending) void pending.then(run, run)
    else run()
  }

  private normalizeModified() {
    const objects = this.canvas?.getActiveObjects() ?? []
    for (const obj of objects) {
      if (isText(obj)) {
        this.normalizeText(obj)
        continue
      }
      if (isVectorCode(obj)) {
        if ((obj.scaleX ?? 1) !== 1 || (obj.scaleY ?? 1) !== 1) {
          obj.setBox(Math.abs((obj.width || 1) * (obj.scaleX || 1)), Math.abs((obj.height || 1) * (obj.scaleY || 1)))
        }
        continue
      }
      if (vectorOf(obj) && ((obj.scaleX ?? 1) !== 1 || (obj.scaleY ?? 1) !== 1)) bakeVectorInPlace(obj)
    }
  }

  private normalizeText(obj: Textbox) {
    const meta = readMeta(obj)
    const mode: TextMode = meta?.textMode ?? 'auto-height'
    if (mode === 'auto') {
      this.fitAutoWidth(obj)
      return
    }
    if ((obj.scaleX ?? 1) === 1 && (obj.scaleY ?? 1) === 1) return
    const next = textResize({
      mode,
      width: obj.width || 1,
      height: obj.height || 1,
      fontSize: obj.fontSize || 16,
      scaleX: obj.scaleX || 1,
      scaleY: obj.scaleY || 1,
      scaleTool: scaleToolOn(),
    })
    obj.set({ width: next.width, scaleX: 1, scaleY: 1, fontSize: next.fontSize })
    if (next.mode === 'fixed') obj.set({ height: next.height })
    obj.initDimensions()
    if (next.mode === 'fixed') obj.set({ height: next.height })
    if (meta && next.mode !== mode) writeMeta(obj, { ...meta, textMode: next.mode })
    obj.setCoords()
  }

  private maybeAltDuplicate(target: FabricObject | undefined, original: { left: number; top: number } | undefined, action: string | undefined, event: Event) {
    if (!this.canvas || !target || this.altClone) return
    if (!('altKey' in event) || !event.altKey) return
    if (action && action !== 'drag') return
    if (target instanceof ActiveSelection || readMeta(target)?.kind === 'paper' || target.lockMovementX) return
    const left = original?.left ?? target.left ?? 0
    const top = original?.top ?? target.top ?? 0
    const json = target.toObject(['data']) as Record<string, unknown>
    this.altClone = this.cloneQuiet(json, left, top).finally(() => {
      this.altClone = null
    })
  }

  private async cloneQuiet(json: Record<string, unknown>, left: number, top: number) {
    if (!this.canvas) return
    const created = (await util.enlivenObjects([json])) as FabricObject[]
    const obj = created[0]
    if (!obj || !this.canvas) return
    const meta = readMeta(obj)
    obj.set({ left, top })
    if (meta) writeMeta(obj, { ...meta, id: uid(), name: meta.name })
    this.decorate(obj)
    this.canvas.add(obj)
    this.canvas.requestRenderAll()
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
    if (file.size > MAX_PHOTO_BYTES) {
      toast(translate(this.lang, 'photoTooBig'))
      return
    }
    let image: FabricImage
    try {
      const url = await shrinkDataUrl(await readDataUrl(file), MAX_PHOTO_EDGE)
      image = await FabricImage.fromURL(url)
    } catch {
      toast(translate(this.lang, 'photoFail'))
      return
    }
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
    const icon = iconById(id)
    if (!icon || !this.canvas) return
    const svg = symbolSvg(icon, '#000000')
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
      data: { id: uid(), kind: 'icon', name: this.lang === 'en' ? icon.en : icon.ru, iconId: id },
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
    const mark = defaultMark('barcode')
    const meta = { id: uid(), kind: 'barcode' as const, name: this.named('barcode'), value, symbology: 'CODE128', showText: true, mark }
    const spec = specFromMeta(meta)
    const natural = spec ? barcodePixelSize(spec, mark.moduleDots ?? 2, mark.barHeight ?? 56) : { width: 160, height: 70 }
    const center = this.viewCenter()
    const code = new VectorCode({
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      width: Math.max(24, Math.min(natural.width, Math.round(this.pxW * 0.86))),
      height: Math.max(16, Math.min(natural.height, Math.round(this.pxH * 0.72))),
      data: meta,
    })
    this.place(code)
  }

  async addQr() {
    const value = 'SN-0001'
    const side = Math.max(48, Math.round(Math.min(this.pxW, this.pxH) * 0.72))
    const center = this.viewCenter()
    const code = new VectorCode({
      originX: 'center',
      originY: 'center',
      left: center.x,
      top: center.y,
      width: side,
      height: side,
      data: { id: uid(), kind: 'qr', name: this.named('qr'), value, ecl: 'M', mark: defaultMark('qr') },
    })
    this.place(code)
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
    if (isVectorCode(obj) && (meta.kind === 'qr' || meta.kind === 'barcode')) {
      this.updateVector(obj, meta, patch)
      return
    }
    const nextValue = patch.value !== undefined ? patch.value : meta.value
    const nextSym = patch.symbology !== undefined ? patch.symbology : meta.symbology
    const nextShow = patch.showText !== undefined ? patch.showText : meta.showText
    const nextEcl = patch.ecl !== undefined ? patch.ecl : meta.ecl
    let raster: string | null = null
    if (meta.kind === 'barcode' && (patch.value !== undefined || patch.symbology !== undefined || patch.showText !== undefined)) {
      raster = barcodeDataUrl(nextValue || '0', nextSym || 'CODE128', nextShow !== false)
    }
    if (meta.kind === 'qr' && (patch.value !== undefined || patch.ecl !== undefined)) {
      raster = await qrDataUrl(nextValue || ' ', nextEcl ?? 'M')
    }
    if (patch.name !== undefined) meta.name = patch.name
    if (patch.fill !== undefined) obj.set('fill', patch.fill)
    if (patch.stroke !== undefined) obj.set('stroke', patch.stroke)
    if (patch.strokeWidth !== undefined) {
      meta.strokePx = patch.strokeWidth
      obj.set('strokeWidth', patch.strokeWidth)
    }
    if (patch.strokeAlign !== undefined) meta.strokeAlign = patch.strokeAlign
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
      if (patch.lineHeight !== undefined) obj.set('lineHeight', Math.max(0.5, Math.min(4, patch.lineHeight)))
      if (patch.charSpacing !== undefined) obj.set('charSpacing', Math.max(-200, Math.min(800, patch.charSpacing)))
      if (patch.textMode !== undefined) {
        meta.textMode = patch.textMode
        if (patch.textMode === 'auto') this.fitAutoWidth(obj)
        if (patch.textMode === 'fixed') {
          obj.initDimensions()
          obj.set({ height: Math.max(1, obj.height || 1) })
        }
      }
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
    if (raster) await this.replaceRaster(obj, raster)
    obj.setCoords()
    this.canvas?.requestRenderAll()
    this.syncSelection()
    this.pushHistory()
  }

  private updateVector(obj: VectorCode, meta: Meta, patch: Partial<SelectedInfo>) {
    if (patch.name !== undefined) meta.name = patch.name
    if (patch.angle !== undefined) obj.set('angle', patch.angle)
    if (patch.opacity !== undefined) obj.set('opacity', patch.opacity)
    if (patch.mark) meta.mark = mergeMark(meta.mark, patch.mark)
    if (patch.value !== undefined) meta.value = patch.value
    if (patch.symbology !== undefined) meta.symbology = patch.symbology
    if (patch.showText !== undefined) meta.showText = patch.showText
    if (patch.ecl !== undefined) meta.ecl = patch.ecl
    if (patch.invert !== undefined) meta.invert = patch.invert
    if (!meta.mark) meta.mark = defaultMark(meta.kind === 'barcode' ? 'barcode' : 'qr')
    if (meta.kind === 'qr' && (meta.mark.qrKind ?? 'text') !== 'text') meta.value = encodeQrPayload(meta.mark, meta.value ?? '')
    const spec = specFromMeta(meta)
    if (!spec) return
    assertCode(spec)
    if (meta.kind === 'barcode') {
      const relayout =
        patch.mark?.moduleDots !== undefined ||
        patch.mark?.barHeight !== undefined ||
        patch.mark?.barFontSize !== undefined ||
        patch.showText !== undefined ||
        patch.symbology !== undefined ||
        patch.value !== undefined
      if (relayout) {
        const probe = barcodePixelSize(spec, 1, meta.mark.barHeight ?? 56)
        const moduleDots = patch.mark?.moduleDots ?? Math.max(1, Math.floor(obj.getScaledWidth() / probe.width))
        const barHeight = patch.mark?.barHeight ?? meta.mark.barHeight ?? 56
        meta.mark = { ...meta.mark, moduleDots, barHeight }
        const box = barcodePixelSize(spec, moduleDots, barHeight)
        obj.setBox(box.width, box.height)
      }
    }
    writeMeta(obj, meta)
    obj.objectCaching = false
    obj.dirty = true
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
      this.decorate(obj)
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

  align(mode: AlignEdge) {
    if (!this.canvas) return
    const objects = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper')
    if (objects.length === 0) return
    const boxes = objects.map((obj) => ({ obj, box: obj.getBoundingRect() }))
    const bounds: AxisBox =
      boxes.length === 1
        ? { left: 0, top: 0, width: this.pxW, height: this.pxH }
        : unionBox(boxes.map((item) => item.box))
    for (const item of boxes) {
      const { dx, dy } = alignDelta(item.box, bounds, mode)
      item.obj.set({ left: (item.obj.left ?? 0) + dx, top: (item.obj.top ?? 0) + dy })
      item.obj.setCoords()
    }
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  distribute(axis: 'x' | 'y') {
    if (!this.canvas) return
    const objects = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper')
    if (objects.length < 3) return
    const boxes = objects.map((obj) => obj.getBoundingRect())
    const deltas = distributeDelta(boxes, axis)
    objects.forEach((obj, index) => {
      const delta = deltas[index] ?? 0
      obj.set({
        left: (obj.left ?? 0) + (axis === 'x' ? delta : 0),
        top: (obj.top ?? 0) + (axis === 'y' ? delta : 0),
      })
      obj.setCoords()
    })
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  moveLayer(id: string, targetId: string, place: DropPlace = 'before') {
    if (!this.canvas || !this.paper || id === targetId) return
    const moving = this.findObject(id)
    const target = this.findObject(targetId)
    if (!moving || !target) return
    const selected = this.canvas.getActiveObjects().map((obj) => readMeta(obj)?.id).filter((item): item is string => !!item)
    const saved = this.snapshotGeometry()
    this.canvas.discardActiveObject()
    const nesting = place === 'into' && readMeta(target)?.kind === 'group' && target instanceof Group
    if (nesting) this.nestInto(moving, target)
    else {
      const parent = this.realParent(moving)
      const targetParent = this.realParent(target)
      const slot = place === 'after' ? 'after' : 'before'
      if (parent && parent === targetParent) this.reorderWithin(parent, id, targetId, slot)
      else this.reorderRoot(id, readMeta(this.rootOf(target))?.id ?? targetId, slot)
    }
    if (!nesting) this.restoreGeometry(saved)
    if (this.canvas.getObjects().indexOf(this.paper) !== 0) this.canvas.sendObjectToBack(this.paper)
    this.reselect(selected)
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  groupSelected() {
    if (!this.canvas) return
    const active = this.canvas.getActiveObject()
    if (!(active instanceof ActiveSelection)) return
    const objects = active.getObjects().filter((obj) => readMeta(obj)?.kind !== 'paper' && !obj.lockMovementX)
    if (objects.length < 2) return
    active.removeAll()
    this.canvas.discardActiveObject()
    this.canvas.remove(...objects)
    const group = new Group(objects, { subTargetCheck: true, interactive: true })
    writeMeta(group, { id: uid(), kind: 'group', name: this.named('group') })
    this.decorate(group)
    this.canvas.add(group)
    this.canvas.setActiveObject(group)
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  ungroupSelected() {
    const obj = this.single()
    if (!this.canvas || !(obj instanceof Group) || readMeta(obj)?.kind !== 'group') return
    const children = obj.removeAll()
    this.canvas.remove(obj)
    for (const child of children) {
      this.decorate(child)
      this.canvas.add(child)
    }
    if (children.length === 1 && children[0]) this.canvas.setActiveObject(children[0])
    else if (children.length > 1) this.canvas.setActiveObject(new ActiveSelection(children, { canvas: this.canvas }))
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  renameLayer(id: string, name: string) {
    const obj = this.findObject(id)
    const meta = obj ? readMeta(obj) : undefined
    if (!obj || !meta) return
    writeMeta(obj, { ...meta, name })
    this.canvas?.requestRenderAll()
    this.pushHistory()
  }

  beginGesture() {
    this.gesture = true
    this.gestureWrote = false
  }

  endGesture() {
    this.gesture = false
    this.gestureWrote = false
  }

  setCorner(cornerMm: number) {
    const next = clamp(cornerMm, 0, 8)
    this.commit({ cornerMm: Math.round(next * 10) / 10 })
    this.ensurePaper()
    this.canvas?.requestRenderAll()
    this.pushHistory()
  }

  setGrid(patch: { gridOn?: boolean; gridStep?: number; snapGrid?: boolean }) {
    const next = {
      gridOn: patch.gridOn ?? this.snapshot.gridOn,
      gridStep: patch.gridStep === undefined ? this.snapshot.gridStep : normalizeGridStep(patch.gridStep),
      snapGrid: patch.snapGrid ?? this.snapshot.snapGrid,
    }
    this.commit(next)
    try {
      localStorage.setItem('metka.grid', JSON.stringify(next))
    } catch {
      /* private mode */
    }
    this.drawGuides()
  }

  async newBlank(input: { name: string; widthMm: number; heightMm: number; cornerMm: number }) {
    if (!Number.isFinite(input.widthMm) || !Number.isFinite(input.heightMm)) return false
    const blank = await buildBuiltin('blank')
    const bounded = clampSize(input.widthMm, input.heightMm, this.snapshot.dpi)
    const corner = Math.round(clamp(input.cornerMm, 0, 8) * 10) / 10
    const state = this.snapshot
    await this.loadDocument(
      {
        ...blank,
        name: input.name.trim() || blank.name,
        widthMm: bounded.widthMm,
        heightMm: bounded.heightMm,
        dpi: state.dpi,
        model: state.model,
        direction: state.direction,
        labelType: state.labelType,
        density: state.density,
        quantity: 1,
        align: state.align,
        task: state.task,
        taskAuto: state.taskAuto,
        preview: state.preview,
        cornerMm: corner,
        canvas: { objects: [] },
      },
      null,
      true,
    )
    return true
  }

  private cornerPx() {
    return mmToPx(this.snapshot.cornerMm || 0, this.snapshot.dpi || 203)
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

  select(id: string, toggle = false) {
    if (!this.canvas) return
    const current = this.canvas
      .getActiveObjects()
      .map((obj) => readMeta(obj)?.id)
      .filter((item): item is string => !!item)
    const ids = toggleSelection(current, id, toggle)
    this.canvas.discardActiveObject()
    const objects = ids
      .map((item) => this.findObject(item))
      .filter((obj): obj is FabricObject => !!obj && readMeta(obj)?.kind !== 'paper' && !obj.lockMovementX)
    if (objects.length === 1 && objects[0]) this.canvas.setActiveObject(objects[0])
    else if (objects.length > 1) this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
    this.canvas.requestRenderAll()
    this.syncSelection()
  }

  toggleLock(id: string) {
    const obj = this.findObject(id)
    if (!obj) return
    const locked = !obj.lockMovementX
    obj.set({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: !locked,
      selectable: !locked,
      evented: obj.visible !== false && !locked,
    })
    this.canvas?.requestRenderAll()
    this.syncSelection()
    this.pushHistory()
  }

  toggleVisible(id: string) {
    const obj = this.findObject(id)
    if (!obj) return
    const visible = obj.visible === false
    obj.set({ visible, evented: visible && !obj.lockMovementX })
    this.canvas?.requestRenderAll()
    this.syncSelection()
    this.pushHistory()
  }

  nudge(dx: number, dy: number, fast = false) {
    if (!this.canvas) return
    const step = nudgeStepPx(fast, this.snapshot.dpi)
    const objects = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper' && !obj.lockMovementX)
    if (objects.length === 0) return
    for (const obj of objects) {
      obj.set({ left: (obj.left ?? 0) + dx * step, top: (obj.top ?? 0) + dy * step })
      obj.setCoords()
    }
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  setFrame(patch: { xMm?: number; yMm?: number; wMm?: number; hMm?: number }) {
    const obj = this.single()
    if (!obj || !this.canvas) return
    const dpi = this.snapshot.dpi
    const current = topLeftBox(
      obj.left ?? 0,
      obj.top ?? 0,
      obj.width ?? 0,
      obj.height ?? 0,
      obj.scaleX ?? 1,
      obj.scaleY ?? 1,
      obj.originX,
      obj.originY,
    )
    const next = {
      x: patch.xMm !== undefined && Number.isFinite(patch.xMm) ? mmToPx(patch.xMm, dpi) : current.x,
      y: patch.yMm !== undefined && Number.isFinite(patch.yMm) ? mmToPx(patch.yMm, dpi) : current.y,
      w: patch.wMm !== undefined && Number.isFinite(patch.wMm) ? Math.max(1, mmToPx(Math.max(0.2, patch.wMm), dpi)) : Math.max(1, current.w),
      h: patch.hMm !== undefined && Number.isFinite(patch.hMm) ? Math.max(1, mmToPx(Math.max(0.2, patch.hMm), dpi)) : Math.max(1, current.h),
    }
    const position = originPoint(next.x, next.y, next.w, next.h, obj.originX, obj.originY)
    if (isVectorCode(obj)) {
      obj.setBox(next.w, next.h)
      obj.set(position)
    } else {
    const kind = vectorOf(obj)
    if (kind && kind !== 'line') {
      bakeVectorInPlace(obj)
      if (kind === 'ellipse') obj.set({ rx: next.w / 2, ry: next.h / 2, scaleX: 1, scaleY: 1, ...position })
      else {
        const rx = kind === 'rect' ? (obj as Rect).rx : undefined
        const ry = kind === 'rect' ? (obj as Rect).ry : undefined
        obj.set({ width: next.w, height: next.h, scaleX: 1, scaleY: 1, ...position })
        if (kind === 'rect') obj.set({ rx, ry })
      }
    } else if (isText(obj)) {
      const meta = readMeta(obj)
      const mode: TextMode = patch.hMm !== undefined ? 'fixed' : (meta?.textMode ?? 'auto-height')
      obj.set({ width: next.w, scaleX: 1, scaleY: 1, fontSize: obj.fontSize, ...position })
      if (mode === 'fixed') obj.set({ height: next.h })
      obj.initDimensions()
      if (mode === 'fixed') obj.set({ height: next.h })
      if (meta && meta.textMode !== mode) writeMeta(obj, { ...meta, textMode: mode })
    } else {
      const baseW = Math.abs(obj.width || 0) > 0.01 ? Math.abs(obj.width || 1) : 1
      const baseH = Math.abs(obj.height || 0) > 0.01 ? Math.abs(obj.height || 1) : 1
      obj.set({
        scaleX: ((obj.scaleX ?? 1) < 0 ? -1 : 1) * (next.w / baseW),
        scaleY: ((obj.scaleY ?? 1) < 0 ? -1 : 1) * (next.h / baseH),
        ...position,
      })
    }
    }
    obj.setCoords()
    this.canvas.requestRenderAll()
    this.pushHistory()
  }

  setSize(widthMm: number, heightMm: number, dpi?: number) {
    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return
    const bounded = clampSize(widthMm, heightMm, dpi !== undefined && Number.isFinite(dpi) ? dpi : this.snapshot.dpi)
    if (bounded.dpi !== this.snapshot.dpi) this.applyDpi(bounded.dpi)
    this.pxW = mmToPx(bounded.widthMm, bounded.dpi)
    this.pxH = mmToPx(bounded.heightMm, bounded.dpi)
    this.commit({
      widthMm: bounded.widthMm,
      heightMm: bounded.heightMm,
      dpi: bounded.dpi,
      cornerMm: defaultCornerMm(bounded.widthMm, bounded.heightMm),
      gapMm: null,
    })
    this.ensurePaper()
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
    const labelType = meta.paperTypes.includes(this.snapshot.labelType) ? this.snapshot.labelType : (meta.paperTypes[0] ?? this.snapshot.labelType)
    this.commit({
      model,
      dpi: meta.dpi,
      direction: meta.printDirection === 'left' ? 'left' : 'top',
      density: meta.densityDefault,
      labelType,
      task: suggestion.task,
    })
    this.pushHistory()
    this.fit()
  }

  applyPrinterSettings(next: { model: string; dpi: number; direction: PrintDirection; density: number; labelType: number; task: string; taskAuto: true }) {
    const current = this.snapshot
    const same =
      next.model === current.model &&
      next.dpi === current.dpi &&
      next.direction === current.direction &&
      next.density === current.density &&
      next.labelType === current.labelType &&
      next.task === current.task &&
      current.taskAuto
    if (same) return
    if (next.dpi !== current.dpi) this.applyDpi(next.dpi)
    this.commit(next)
    this.pushHistory()
    if (next.dpi !== current.dpi) this.fit()
  }

  applyDetectedLabel(widthMm: number, heightMm: number, labelType: number | null, gapMm: number | null) {
    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return
    const bounded = clampSize(widthMm, heightMm, this.snapshot.dpi)
    if (bounded.dpi !== this.snapshot.dpi) this.applyDpi(bounded.dpi)
    this.pxW = mmToPx(bounded.widthMm, bounded.dpi)
    this.pxH = mmToPx(bounded.heightMm, bounded.dpi)
    this.commit({
      widthMm: bounded.widthMm,
      heightMm: bounded.heightMm,
      dpi: bounded.dpi,
      cornerMm: defaultCornerMm(bounded.widthMm, bounded.heightMm),
      labelType: labelType && labelType > 0 ? labelType : this.snapshot.labelType,
      gapMm,
    })
    this.ensurePaper()
    this.pushHistory()
    this.fit()
  }

  /** Keep dpi, direction, and label type on the connected model without resetting a density the user already chose. */
  clampToModel(model: string) {
    const meta = metaFor(model)
    if (!meta) return
    const direction = meta.printDirection === 'left' ? 'left' : 'top'
    const density = clamp(Math.round(this.snapshot.density), meta.densityMin, meta.densityMax)
    const labelType = meta.paperTypes.includes(this.snapshot.labelType) ? this.snapshot.labelType : (meta.paperTypes[0] ?? this.snapshot.labelType)
    const dpiChanged = this.snapshot.dpi !== meta.dpi
    if (dpiChanged) this.applyDpi(meta.dpi)
    if (
      model === this.snapshot.model &&
      !dpiChanged &&
      direction === this.snapshot.direction &&
      density === this.snapshot.density &&
      labelType === this.snapshot.labelType
    ) {
      return
    }
    this.commit({ model, dpi: meta.dpi, direction, density, labelType })
    this.pushHistory()
    if (dpiChanged) this.fit()
  }

  setDpi(dpi: number) {
    const next = clampDpi(dpi)
    if (next === null) return
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
        if (isVectorCode(obj)) {
          const width = Math.abs((obj.width || 1) * (obj.scaleX || 1) * scale)
          const height = Math.abs((obj.height || 1) * (obj.scaleY || 1) * scale)
          obj.set({ left: (obj.left ?? 0) * scale, top: (obj.top ?? 0) * scale })
          obj.setBox(width, height)
          continue
        }
        obj.set({
          left: (obj.left ?? 0) * scale,
          top: (obj.top ?? 0) * scale,
          scaleX: (obj.scaleX ?? 1) * scale,
          scaleY: (obj.scaleY ?? 1) * scale,
        })
        if (vectorOf(obj)) {
          const strokeWidth = (obj.strokeWidth ?? 0) * scale
          obj.set('strokeWidth', strokeWidth)
          const meta = readMeta(obj)
          if (meta?.strokePx !== undefined) writeMeta(obj, { ...meta, strokePx: meta.strokePx * scale })
        }
        obj.setCoords()
      }
    }
    this.pxW = mmToPx(this.snapshot.widthMm, dpi)
    this.pxH = mmToPx(this.snapshot.heightMm, dpi)
    this.commit({ dpi })
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
    const next = clampCopies(quantity)
    if (next === null) return
    this.commit({ quantity: next })
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
    const margin = 88
    const zoom = clamp(Math.min((cw - margin) / this.pxW, (ch - margin) / this.pxH), 0.2, 10)
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
    const next = commitHistory(
      { entries: this.history, index: this.histIndex, gesture: this.gesture, wrote: this.gestureWrote },
      json,
      (a, b) => a === b,
      historyDepth(json.length),
    )
    this.history = next.entries
    this.histIndex = next.index
    this.gestureWrote = next.wrote
    if (!next.changed) {
      this.syncSelection()
      return
    }
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
    this.commit({
      dpi: doc.dpi,
      widthMm: doc.widthMm,
      heightMm: doc.heightMm,
      cornerMm: doc.cornerMm ?? defaultCornerMm(doc.widthMm, doc.heightMm),
    })
    await this.canvas.loadFromJSON(doc.canvas)
    this.decorateAll()
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
      cornerMm: doc.cornerMm ?? defaultCornerMm(doc.widthMm, doc.heightMm),
      gapMm: doc.gapMm ?? null,
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

  private layerTree() {
    const layers: EditorState['layers'] = []
    const visit = (obj: FabricObject, depth: number, parentId: string | null) => {
      const meta = readMeta(obj)
      if (!meta || meta.kind === 'paper') return
      layers.push({
        id: meta.id,
        name: meta.name ?? obj.type,
        kind: meta.kind,
        visible: obj.visible !== false,
        locked: !!obj.lockMovementX,
        depth,
        parentId,
      })
      if (meta.kind === 'group' && obj instanceof Group) {
        const children = obj.getObjects()
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child = children[index]
          if (child) visit(child, depth + 1, meta.id)
        }
      }
    }
    const top = this.userObjects()
    for (let index = top.length - 1; index >= 0; index -= 1) {
      const obj = top[index]
      if (obj) visit(obj, 0, null)
    }
    return layers
  }

  private findObject(id: string): FabricObject | undefined {
    const walk = (objects: FabricObject[]): FabricObject | undefined => {
      for (const obj of objects) {
        if (readMeta(obj)?.id === id) return obj
        if (obj instanceof Group && !(obj instanceof ActiveSelection)) {
          const found = walk(obj.getObjects())
          if (found) return found
        }
      }
      return undefined
    }
    return walk(this.canvas?.getObjects() ?? [])
  }

  private realParent(obj: FabricObject): Group | null {
    const parent = obj.parent
    if (parent instanceof Group && !(parent instanceof ActiveSelection) && readMeta(parent)?.kind === 'group') return parent
    return null
  }

  private rootOf(obj: FabricObject): FabricObject {
    let current = obj
    let parent = this.realParent(current)
    while (parent) {
      current = parent
      parent = this.realParent(current)
    }
    return current
  }

  private reorderRoot(movingId: string, overId: string, place: 'before' | 'after') {
    const objects = this.userObjects()
    const frontToBack = [...objects].reverse().map((obj) => readMeta(obj)?.id ?? '').filter(Boolean)
    const next = reorderFrontToBack(frontToBack, movingId, overId, place)
    ;[...next].reverse().forEach((id, index) => {
      const obj = objects.find((item) => readMeta(item)?.id === id)
      if (obj) this.canvas?.moveObjectTo(obj, index + 1)
    })
  }

  private reorderWithin(group: Group, movingId: string, overId: string, place: 'before' | 'after') {
    const objects = group.getObjects()
    const frontToBack = [...objects].reverse().map((obj) => readMeta(obj)?.id ?? '').filter(Boolean)
    const next = reorderFrontToBack(frontToBack, movingId, overId, place)
    ;[...next].reverse().forEach((id, index) => {
      const obj = objects.find((item) => readMeta(item)?.id === id)
      if (obj) group.moveObjectTo(obj, index)
    })
  }

  private nestInto(obj: FabricObject, group: Group) {
    if (obj === group || readMeta(obj)?.kind === 'group') return
    const parent = this.realParent(obj)
    if (parent) parent.remove(obj)
    else this.canvas?.remove(obj)
    group.add(obj)
    this.decorate(obj)
  }

  private snapshotGeometry() {
    const saved = new Map<string, Geom>()
    const visit = (obj: FabricObject) => {
      const id = readMeta(obj)?.id
      if (id) {
        saved.set(id, {
          left: obj.left,
          top: obj.top,
          scaleX: obj.scaleX,
          scaleY: obj.scaleY,
          angle: obj.angle,
          width: obj.width,
          height: obj.height,
          skewX: obj.skewX,
          skewY: obj.skewY,
        })
      }
      if (obj instanceof Group && !(obj instanceof ActiveSelection)) obj.getObjects().forEach(visit)
    }
    this.canvas?.getObjects().forEach(visit)
    return saved
  }

  private restoreGeometry(saved: Map<string, Geom>) {
    const visit = (obj: FabricObject) => {
      const id = readMeta(obj)?.id
      const geom = id ? saved.get(id) : undefined
      if (geom) {
        obj.set(geom)
        obj.setCoords()
      }
      if (obj instanceof Group && !(obj instanceof ActiveSelection)) obj.getObjects().forEach(visit)
    }
    this.canvas?.getObjects().forEach(visit)
  }

  private reselect(ids: string[]) {
    if (!this.canvas) return
    const objects = ids.map((id) => this.findObject(id)).filter((obj): obj is FabricObject => !!obj)
    if (objects.length === 0) return
    if (objects.length === 1 && objects[0]) this.canvas.setActiveObject(objects[0])
    else this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
  }

  private syncSelection() {
    if (!this.canvas) return
    const active = this.canvas.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper')
    const layers = this.layerTree()
    const only = active.length === 1 ? active[0] : undefined
    const frame = only
      ? boxToMm(
          topLeftBox(
            only.left ?? 0,
            only.top ?? 0,
            only.width ?? 0,
            only.height ?? 0,
            only.scaleX ?? 1,
            only.scaleY ?? 1,
            only.originX,
            only.originY,
          ),
          this.snapshot.dpi,
        )
      : undefined
    this.commit({
      layers,
      selected: only ? { ...describe(only), frame } : null,
      selectedId: only ? (readMeta(only)?.id ?? null) : null,
      selectedIds: active.map((obj) => readMeta(obj)?.id ?? '').filter(Boolean),
      multi: active.length > 1 ? active.length : 0,
    })
  }

  private single() {
    const active = this.canvas?.getActiveObjects().filter((obj) => readMeta(obj)?.kind !== 'paper') ?? []
    return active.length === 1 ? active[0] ?? null : null
  }

  private snap(event: Event, target: FabricObject) {
    if (!this.canvas || readMeta(target)?.kind === 'paper') return
    if ('ctrlKey' in event && event.ctrlKey) {
      this.guides = { vertical: [], horizontal: [] }
      this.measures = []
      this.drawGuides()
      return
    }
    const zoom = this.canvas.getZoom() || 1
    const bounds = target.getBoundingRect()
    const box = { x: bounds.left, y: bounds.top, w: bounds.width, h: bounds.height }
    const guidesX = [0, this.pxW / 2, this.pxW]
    const guidesY = [0, this.pxH / 2, this.pxH]
    if (this.snapshot.snapGrid) {
      guidesX.push(...gridStops(this.pxW, this.snapshot.widthMm, this.snapshot.gridStep))
      guidesY.push(...gridStops(this.pxH, this.snapshot.heightMm, this.snapshot.gridStep))
    }
    const others = [{ x: 0, y: 0, w: this.pxW, h: this.pxH }]
    for (const obj of this.canvas.getObjects()) {
      if (obj === target || obj === this.paper || obj.group === target || obj.visible === false) continue
      const rect = obj.getBoundingRect()
      guidesX.push(rect.left, rect.left + rect.width / 2, rect.left + rect.width)
      guidesY.push(rect.top, rect.top + rect.height / 2, rect.top + rect.height)
      others.push({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })
    }
    const snapped = snapTranslation({ box, guidesX, guidesY, threshold: 6 / zoom })
    if (snapped.dx || snapped.dy) {
      target.set({ left: (target.left ?? 0) + snapped.dx, top: (target.top ?? 0) + snapped.dy })
      target.setCoords()
    }
    this.guides = {
      vertical: snapped.guideX === null ? [] : [snapped.guideX],
      horizontal: snapped.guideY === null ? [] : [snapped.guideY],
    }
    this.measures = measureGaps(
      { x: box.x + snapped.dx, y: box.y + snapped.dy, w: box.w, h: box.h },
      others,
      this.snapshot.dpi,
    )
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
    ctx.strokeStyle = '#e85d4c'
    ctx.lineWidth = 1
    ctx.font = '11px ui-sans-serif, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const mark of this.measures) {
      const x1 = mark.x1 * vpt[0] + vpt[4]
      const y1 = mark.y1 * vpt[3] + vpt[5]
      const x2 = mark.x2 * vpt[0] + vpt[4]
      const y2 = mark.y2 * vpt[3] + vpt[5]
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
      const lx = (x1 + x2) / 2
      const ly = (y1 + y2) / 2
      const text = String(mark.mm)
      const pad = ctx.measureText(text).width + 8
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(lx - pad / 2, ly - 8, pad, 16)
      ctx.fillStyle = '#e85d4c'
      ctx.fillText(text, lx, ly)
    }
    this.drawLabelChrome(ctx, vpt, width, height)
    ctx.restore()
  }

  private drawLabelChrome(ctx: CanvasRenderingContext2D, vpt: number[], width: number, height: number) {
    const zoom = vpt[0] || 1
    const originX = vpt[4] ?? 0
    const originY = vpt[5] ?? 0
    const labelW = this.pxW * zoom
    const labelH = this.pxH * zoom
    const radius = this.cornerPx() * zoom
    if (radius > 0.5 && labelW > 2 && labelH > 2) {
      const corner = Math.min(radius, labelW / 2, labelH / 2)
      ctx.save()
      ctx.beginPath()
      ctx.rect(originX, originY, labelW, labelH)
      ctx.roundRect(originX, originY, labelW, labelH, corner)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
      ctx.fill('evenodd')
      ctx.restore()
    }
    if (this.snapshot.gridOn && labelW > 2 && labelH > 2) {
      const stopsX = gridStops(labelW, this.snapshot.widthMm, this.snapshot.gridStep)
      const stopsY = gridStops(labelH, this.snapshot.heightMm, this.snapshot.gridStep)
      ctx.save()
      ctx.beginPath()
      ctx.rect(originX, originY, labelW, labelH)
      ctx.clip()
      ctx.strokeStyle = 'rgba(29, 155, 240, 0.45)'
      ctx.lineWidth = 1
      for (const stop of stopsX) {
        const sx = originX + stop
        ctx.beginPath()
        ctx.moveTo(sx + 0.5, originY)
        ctx.lineTo(sx + 0.5, originY + labelH)
        ctx.stroke()
      }
      for (const stop of stopsY) {
        const sy = originY + stop
        ctx.beginPath()
        ctx.moveTo(originX, sy + 0.5)
        ctx.lineTo(originX + labelW, sy + 0.5)
        ctx.stroke()
      }
      ctx.restore()
    }
    const styles = getComputedStyle(document.documentElement)
    const bar = styles.getPropertyValue('--card').trim() || '#000000'
    const ink = styles.getPropertyValue('--text').trim() || '#f7f9f9'
    const muted = styles.getPropertyValue('--muted').trim() || '#b8c1c8'
    const accent = styles.getPropertyValue('--accent').trim() || '#1d9bf0'
    const ruler = 34
    const pxPerMmX = this.snapshot.widthMm > 0 ? labelW / this.snapshot.widthMm : zoom
    const pxPerMmY = this.snapshot.heightMm > 0 ? labelH / this.snapshot.heightMm : zoom
    ctx.fillStyle = bar
    ctx.fillRect(0, 0, width, ruler)
    ctx.fillRect(0, 0, ruler, height)
    ctx.strokeStyle = muted
    ctx.lineWidth = 1
    ctx.font = '11px ui-sans-serif, sans-serif'
    ctx.beginPath()
    ctx.moveTo(0, ruler + 0.5)
    ctx.lineTo(width, ruler + 0.5)
    ctx.moveTo(ruler + 0.5, 0)
    ctx.lineTo(ruler + 0.5, height)
    ctx.stroke()
    this.paintRuler(ctx, {
      horizontal: true,
      origin: originX,
      spanPx: labelW,
      spanMm: this.snapshot.widthMm,
      pxPerMm: pxPerMmX,
      viewStart: ruler,
      viewEnd: width,
      ruler,
      ink,
      muted,
      accent,
    })
    this.paintRuler(ctx, {
      horizontal: false,
      origin: originY,
      spanPx: labelH,
      spanMm: this.snapshot.heightMm,
      pxPerMm: pxPerMmY,
      viewStart: ruler,
      viewEnd: height,
      ruler,
      ink,
      muted,
      accent,
    })
    ctx.fillStyle = bar
    ctx.fillRect(0, 0, ruler, ruler)
    ctx.strokeStyle = muted
    ctx.strokeRect(0.5, 0.5, ruler - 1, ruler - 1)
    ctx.fillStyle = muted
    ctx.font = '10px ui-sans-serif, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('мм', ruler / 2, ruler / 2)
  }

  private paintRuler(
    ctx: CanvasRenderingContext2D,
    input: {
      horizontal: boolean
      origin: number
      spanPx: number
      spanMm: number
      pxPerMm: number
      viewStart: number
      viewEnd: number
      ruler: number
      ink: string
      muted: string
      accent: string
    },
  ) {
    const marks = rulerLayout({
      startMm: (input.viewStart - input.origin) / input.pxPerMm,
      endMm: (input.viewEnd - input.origin) / input.pxPerMm,
      pxPerMm: input.pxPerMm,
      originPx: input.origin,
      labelPx: input.spanPx,
      labelMm: input.spanMm,
    })
    let lastLabelEnd = input.ruler + 4
    for (const mark of marks) {
      if (mark.x < input.viewStart - 0.5 || mark.x > input.viewEnd + 0.5) continue
      const tick = mark.rank === 'edge' || mark.rank === 'label' ? 12 : mark.rank === 'mid' ? 8 : 4
      ctx.strokeStyle = mark.rank === 'edge' ? input.accent : input.muted
      ctx.beginPath()
      if (input.horizontal) {
        ctx.moveTo(mark.x + 0.5, input.ruler)
        ctx.lineTo(mark.x + 0.5, input.ruler - tick)
      } else {
        ctx.moveTo(input.ruler, mark.x + 0.5)
        ctx.lineTo(input.ruler - tick, mark.x + 0.5)
      }
      ctx.stroke()
      if (mark.rank !== 'label' && mark.rank !== 'edge') continue
      const text = Number.isInteger(mark.mm) ? String(mark.mm) : mark.mm.toFixed(1)
      const width = ctx.measureText(text).width
      ctx.fillStyle = mark.rank === 'edge' ? input.accent : input.ink
      ctx.font = '11px ui-sans-serif, sans-serif'
      if (input.horizontal) {
        const left = mark.x - width / 2
        if (left < lastLabelEnd) continue
        if (left < input.ruler + 2 || mark.x + width / 2 > input.viewEnd - 2) continue
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(text, mark.x, 3)
        lastLabelEnd = mark.x + width / 2 + 6
      } else {
        if (mark.x - 8 < lastLabelEnd) continue
        if (mark.x < input.ruler + 10 || mark.x > input.viewEnd - 8) continue
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, input.ruler - 14, mark.x)
        lastLabelEnd = mark.x + 10
      }
    }
  }

  private keyDown(event: KeyboardEvent) {
    if (typingTarget(event.target) || !this.canvas) return
    if (typeof document !== 'undefined' && document.querySelector('[role="dialog"]')) return
    const action = matchEditorShortcut({
      key: event.key,
      code: event.code,
      meta: event.metaKey || event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
    })
    if (!action) return
    if (action.type === 'pan') {
      this.space = true
      event.preventDefault()
      return
    }
    if (action.type !== 'copy') event.preventDefault()
    if (action.type === 'undo') this.undo()
    else if (action.type === 'redo') this.redo()
    else if (action.type === 'duplicate') void this.duplicate()
    else if (action.type === 'group') this.groupSelected()
    else if (action.type === 'ungroup') this.ungroupSelected()
    else if (action.type === 'scale') {
      setScaleTool(!scaleToolOn())
      this.commit({ scaleTool: scaleToolOn() })
    }
    else if (action.type === 'copy') this.copy()
    else if (action.type === 'selectAll') {
      const objects = this.userObjects().filter((obj) => obj.visible !== false)
      if (objects.length === 1 && objects[0]) this.canvas.setActiveObject(objects[0])
      else if (objects.length > 1) this.canvas.setActiveObject(new ActiveSelection(objects, { canvas: this.canvas }))
      this.canvas.requestRenderAll()
      this.syncSelection()
    } else if (action.type === 'delete') this.deleteSelected()
    else if (action.type === 'fit') this.fit()
    else if (action.type === 'zoomIn') this.zoomBy(1.15)
    else if (action.type === 'zoomOut') this.zoomBy(1 / 1.15)
    else if (action.type === 'deselect') {
      this.canvas.discardActiveObject()
      this.canvas.requestRenderAll()
      this.syncSelection()
    } else if (action.type === 'nudge') this.nudge(action.dx, action.dy, action.fast)
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
    strokeWidth: meta?.strokePx ?? obj.strokeWidth ?? 0,
    strokeAlign: meta?.strokeAlign ?? 'center',
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
    mark: meta?.mark,
    boxW: meta?.kind === 'qr' || meta?.kind === 'barcode' ? Math.max(1, Math.round(obj.getScaledWidth())) : undefined,
    boxH: meta?.kind === 'qr' || meta?.kind === 'barcode' ? Math.max(1, Math.round(obj.getScaledHeight())) : undefined,
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
    info.lineHeight = obj.lineHeight
    info.charSpacing = obj.charSpacing
    info.textMode = meta?.textMode ?? 'auto-height'
  }
  return info
}

function colorOf(value: unknown): string {
  if (typeof value === 'string') return value
  return 'transparent'
}

async function shrinkDataUrl(url: string, maxEdge: number): Promise<string> {
  const image = await FabricImage.fromURL(url)
  const target = targetPhotoSize(image.width || 1, image.height || 1, maxEdge)
  if (!target) return url
  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return url
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(image.getElement(), 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read'))
    reader.readAsDataURL(file)
  })
}

function readGridPrefs(): Pick<EditorState, 'gridOn' | 'gridStep' | 'snapGrid'> {
  const fallback = { gridOn: false, gridStep: 1, snapGrid: false }
  try {
    if (typeof localStorage === 'undefined') return fallback
    const raw = localStorage.getItem('metka.grid')
    if (!raw) return fallback
    const data = JSON.parse(raw) as { gridOn?: boolean; gridStep?: number; snapGrid?: boolean }
    return {
      gridOn: !!data.gridOn,
      gridStep: normalizeGridStep(Number(data.gridStep)),
      snapGrid: !!data.snapGrid,
    }
  } catch {
    return fallback
  }
}

export const engine = new EditorEngine()
