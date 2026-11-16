export type Lang = 'ru' | 'en'
export type ThemeName = 'dark' | 'dim' | 'light'
export type PrintDirection = 'left' | 'top'
export type AlignMode = 'start' | 'center' | 'end'
export type DitherMode = 'threshold' | 'floyd' | 'atkinson'
export type DitherChoice = 'inherit' | DitherMode
export type Sharpness = 'off' | 'clear' | 'strong'
export type ObjectKind = 'text' | 'image' | 'icon' | 'shape' | 'barcode' | 'qr' | 'datetime' | 'number' | 'paper' | 'group'
export type TextMode = 'auto' | 'auto-height' | 'fixed'
export type StrokeAlign = 'center' | 'inside' | 'outside'

export type PreviewSettings = {
  mode: DitherMode
  threshold: number
  invert: boolean
  sharpness?: Sharpness
}

export type Meta = {
  id: string
  kind: ObjectKind
  name: string
  sourceText?: string
  vertical?: boolean
  brightness?: number
  contrast?: number
  invert?: boolean
  dither?: DitherChoice
  value?: string
  symbology?: string
  showText?: boolean
  ecl?: 'L' | 'M' | 'Q' | 'H'
  dateFormat?: string
  live?: boolean
  iconId?: string
  prefix?: string
  suffix?: string
  pad?: number
  textMode?: TextMode
  strokeAlign?: StrokeAlign
  /** Stroke width in scene pixels. The canvas stroke may be doubled while clipping inside/outside. */
  strokePx?: number
}

export type LabelDocument = {
  version: 1
  name: string
  widthMm: number
  heightMm: number
  dpi: number
  model: string
  direction: PrintDirection
  labelType: number
  density: number
  quantity: number
  align: AlignMode
  task: string
  taskAuto: boolean
  pageFrom?: number
  pageTo?: number
  preview: PreviewSettings
  cornerMm?: number
  /** Gap reported by the printer roll, in millimetres. The canvas is the sticker face, not the gap. */
  gapMm?: number
  canvas: Record<string, unknown>
}

export type TemplateRecord = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  thumbnail: string
  doc: LabelDocument
}

export type DesignRecord = {
  id: string
  name: string
  updatedAt: number
  thumbnail: string
  doc: LabelDocument
}

export type LayerInfo = {
  id: string
  name: string
  kind: ObjectKind
  visible: boolean
  locked: boolean
  depth: number
  parentId: string | null
}

export type SelectedInfo = {
  id: string
  kind: ObjectKind
  name: string
  fill: string
  stroke: string
  strokeWidth: number
  angle: number
  opacity: number
  text?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  underline?: boolean
  textAlign?: string
  vertical?: boolean
  brightness?: number
  contrast?: number
  invert?: boolean
  dither?: DitherChoice
  value?: string
  symbology?: string
  showText?: boolean
  ecl?: 'L' | 'M' | 'Q' | 'H'
  dateFormat?: string
  live?: boolean
  rx?: number
  prefix?: string
  suffix?: string
  pad?: number
  frame?: { x: number; y: number; w: number; h: number }
  lineHeight?: number
  charSpacing?: number
  textMode?: TextMode
  strokeAlign?: StrokeAlign
}

export type EditorState = {
  ready: boolean
  booting: boolean
  name: string
  designId: string | null
  widthMm: number
  heightMm: number
  dpi: number
  model: string
  direction: PrintDirection
  labelType: number
  density: number
  quantity: number
  align: AlignMode
  task: string
  taskAuto: boolean
  pageFrom: number
  pageTo: number
  preview: PreviewSettings
  gapMm: number | null
  zoom: number
  canUndo: boolean
  canRedo: boolean
  dirty: boolean
  layers: LayerInfo[]
  selectedId: string | null
  selectedIds: string[]
  selected: SelectedInfo | null
  multi: number
  scaleTool: boolean
  contentRev: number
  workspace: string
  cornerMm: number
  gridOn: boolean
  gridStep: number
  snapGrid: boolean
}

export type RfidView = {
  present: boolean | null
  used: number | null
  total: number | null
  kind: number | null
  barcode: string
  readOk: boolean | null
  widthMm: number | null
  heightMm: number | null
  gapMm: number | null
}

export type PrinterSnapshot = {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  transport: 'bluetooth' | 'serial' | null
  deviceName: string
  model: string
  modelId: number | null
  detectedTask: string
  dpi: number | null
  printhead: number | null
  printheadSensor: number | null
  battery: number | null
  paper: boolean | null
  lid: boolean | null
  temp: number | null
  ribbon: boolean | null
  ribbonRfid: boolean | null
  labelTypes: number[]
  densityMin: number | null
  densityMax: number | null
  supportColor: boolean | null
  printColors: number[]
  firmware: string
  hardware: string
  protocol: number | null
  serial: string
  rfid: RfidView
  packetLog: string
  lastPrint: string
  error: string
  printing: boolean
  flashing: boolean
  progress: number
  progressLabel: string
  progressPage: number
  progressTotal: number
}

export const emptyRfid = (): RfidView => ({
  present: null,
  used: null,
  total: null,
  kind: null,
  barcode: '',
  readOk: null,
  widthMm: null,
  heightMm: null,
  gapMm: null,
})

export const initialEditorState = (): EditorState => ({
  ready: false,
  booting: true,
  name: 'Новая этикетка',
  designId: null,
  widthMm: 40,
  heightMm: 12,
  dpi: 203,
  model: 'D110',
  direction: 'left',
  labelType: 1,
  density: 2,
  quantity: 1,
  align: 'center',
  task: 'D110',
  taskAuto: true,
  pageFrom: 1,
  pageTo: 1,
  preview: { mode: 'floyd', threshold: 168, invert: false, sharpness: 'off' },
  gapMm: null,
  zoom: 1,
  canUndo: false,
  canRedo: false,
  dirty: false,
  layers: [],
  selectedId: null,
  selectedIds: [],
  selected: null,
  multi: 0,
  scaleTool: false,
  contentRev: 0,
  workspace: '#000000',
  cornerMm: 1.5,
  gridOn: false,
  gridStep: 1,
  snapGrid: false,
})
