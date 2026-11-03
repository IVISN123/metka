export type Lang = 'ru' | 'en'
export type ThemeName = 'dark' | 'dim' | 'light'
export type PrintDirection = 'left' | 'top'
export type AlignMode = 'start' | 'center' | 'end'
export type DitherMode = 'threshold' | 'floyd' | 'atkinson'
export type DitherChoice = 'inherit' | DitherMode
export type ObjectKind = 'text' | 'image' | 'icon' | 'shape' | 'barcode' | 'qr' | 'datetime' | 'paper'

export type PreviewSettings = {
  mode: DitherMode
  threshold: number
  invert: boolean
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
  preview: PreviewSettings
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
  preview: PreviewSettings
  zoom: number
  canUndo: boolean
  canRedo: boolean
  dirty: boolean
  layers: LayerInfo[]
  selectedId: string | null
  selected: SelectedInfo | null
  multi: number
  contentRev: number
  workspace: string
}

export type PrinterSnapshot = {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  transport: 'bluetooth' | 'serial' | null
  deviceName: string
  model: string
  detectedTask: string
  dpi: number | null
  printhead: number | null
  battery: number | null
  paper: boolean | null
  firmware: string
  serial: string
  error: string
  printing: boolean
  progress: number
  progressLabel: string
}

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
  preview: { mode: 'floyd', threshold: 168, invert: false },
  zoom: 1,
  canUndo: false,
  canRedo: false,
  dirty: false,
  layers: [],
  selectedId: null,
  selected: null,
  multi: 0,
  contentRev: 0,
  workspace: '#000000',
})
