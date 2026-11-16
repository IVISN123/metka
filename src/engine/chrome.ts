import { Control, controlsUtils, Rect, type FabricObject, type TPointerEvent, type Transform } from 'fabric'
import { readMeta, writeMeta } from './meta'
import { isVectorCode } from './vector-object'
import { isVectorShape, vectorOf } from '../lib/scene-paint'
import {
  bakeShapeScale,
  originOffset,
  resizeDimensions,
  type ResizeAxes,
  type TextMode,
} from '../lib/transform'
import type { Meta } from '../types'

let scaleTool = false

export function setScaleTool(on: boolean) {
  scaleTool = on
}

export function scaleToolOn() {
  return scaleTool
}

const HANDLE_COLOR = '#ffffff'
const HANDLE_STROKE = '#0d99ff'

function axesOf(corner: string | undefined): ResizeAxes {
  if (corner === 'ml' || corner === 'mr') return 'x'
  if (corner === 'mt' || corner === 'mb') return 'y'
  return 'both'
}

function resizeVector(event: TPointerEvent, transform: Transform, x: number, y: number) {
  const target = transform.target
  const kind = vectorOf(target)
  if (!kind || kind === 'line') return false
  const local = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y)
  const next = resizeDimensions({
    localX: local.x,
    localY: local.y,
    originX: originOffset(transform.originX),
    originY: originOffset(transform.originY),
    width: target.width || 1,
    height: target.height || 1,
    scaleX: target.scaleX || 1,
    scaleY: target.scaleY || 1,
    proportional: 'shiftKey' in event && event.shiftKey,
    centered: originOffset(transform.originX) === 0 && originOffset(transform.originY) === 0,
    axes: axesOf(transform.corner),
  })
  if (!next) return false
  const strokeWidth = target.strokeWidth
  if (kind === 'ellipse') {
    target.set({ rx: next.width / 2, ry: next.height / 2, scaleX: 1, scaleY: 1, strokeWidth })
  } else {
    const rx = kind === 'rect' ? (target as Rect).rx : undefined
    const ry = kind === 'rect' ? (target as Rect).ry : undefined
    target.set({ width: next.width, height: next.height, scaleX: 1, scaleY: 1, strokeWidth })
    if (kind === 'rect') target.set({ rx, ry })
  }
  return true
}

const vectorResize = controlsUtils.wrapWithFireEvent('resizing', controlsUtils.wrapWithFixedAnchor(resizeVector))

function resizeCode(event: TPointerEvent, transform: Transform, x: number, y: number) {
  const target = transform.target
  if (!isVectorCode(target)) return false
  const local = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y)
  const next = resizeDimensions({
    localX: local.x,
    localY: local.y,
    originX: originOffset(transform.originX),
    originY: originOffset(transform.originY),
    width: target.width || 1,
    height: target.height || 1,
    scaleX: target.scaleX || 1,
    scaleY: target.scaleY || 1,
    proportional: 'shiftKey' in event && event.shiftKey,
    centered: originOffset(transform.originX) === 0 && originOffset(transform.originY) === 0,
    axes: axesOf(transform.corner),
  })
  if (!next) return false
  target.setBox(next.width, next.height)
  return true
}

const codeResize = controlsUtils.wrapWithFireEvent('resizing', controlsUtils.wrapWithFixedAnchor(resizeCode))

type TextSnap = { width: number; height: number; fontSize: number }

function textSnap(target: FabricObject): TextSnap {
  const stored = (target as FabricObject & { __text0?: TextSnap }).__text0
  if (stored) return stored
  return { width: target.width || 1, height: target.height || 1, fontSize: (target as FabricObject & { fontSize?: number }).fontSize || 16 }
}

function rememberText(target: FabricObject) {
  const text = target as FabricObject & { fontSize?: number; __text0?: TextSnap }
  text.__text0 = { width: target.width || 1, height: target.height || 1, fontSize: text.fontSize || 16 }
}

function applyTextSize(target: FabricObject, width: number, height: number, fontSize: number, mode: TextMode) {
  const text = target as FabricObject & { fontSize?: number; initDimensions?: () => void }
  text.set({ width: Math.max(1, width), scaleX: 1, scaleY: 1, fontSize })
  if (mode === 'fixed') text.set({ height: Math.max(1, height) })
  text.initDimensions?.()
  if (mode === 'fixed') text.set({ height: Math.max(1, height) })
  const meta = readMeta(target)
  if (meta && meta.textMode !== mode) writeMeta(target, { ...meta, textMode: mode })
}

function resizeText(event: TPointerEvent, transform: Transform, x: number, y: number) {
  const target = transform.target
  const meta = readMeta(target)
  const mode: TextMode = meta?.textMode ?? 'auto-height'
  const local = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y)
  const start = textSnap(target)
  const next = resizeDimensions({
    localX: local.x,
    localY: local.y,
    originX: originOffset(transform.originX),
    originY: originOffset(transform.originY),
    width: start.width,
    height: start.height,
    scaleX: 1,
    scaleY: 1,
    proportional: 'shiftKey' in event && event.shiftKey,
    centered: originOffset(transform.originX) === 0 && originOffset(transform.originY) === 0,
    axes: axesOf(transform.corner),
  })
  if (!next) return false
  const axes = axesOf(transform.corner)
  if (scaleTool && axes === 'both') {
    const factor = next.width / Math.max(1, start.width)
    applyTextSize(target, next.width, next.height, Math.max(4, start.fontSize * factor), mode === 'auto' ? 'auto-height' : mode)
    return true
  }
  const nextMode: TextMode = mode === 'auto' ? 'auto-height' : axes === 'y' || (axes === 'both' && mode === 'fixed') ? 'fixed' : mode
  applyTextSize(target, next.width, next.height, start.fontSize, nextMode)
  return true
}

const textResizeControl = controlsUtils.wrapWithFireEvent('resizing', controlsUtils.wrapWithFixedAnchor(resizeText))

function emptyRender() {
  /* Rotation lives in the cursor, just outside the corner. */
}

function rotationZone(x: number, y: number, offsetX: number, offsetY: number) {
  return new Control({
    x,
    y,
    offsetX,
    offsetY,
    actionHandler: controlsUtils.rotationWithSnapping,
    cursorStyleHandler: controlsUtils.rotationStyleHandler,
    actionName: 'rotate',
    render: emptyRender,
    sizeX: 16,
    sizeY: 16,
  })
}

function withRotation(controls: Record<string, Control>) {
  return {
    ...controls,
    rotl: rotationZone(-0.5, -0.5, -14, -14),
    rotr: rotationZone(0.5, -0.5, 14, -14),
    rotbl: rotationZone(-0.5, 0.5, -14, 14),
    rotbr: rotationZone(0.5, 0.5, 14, 14),
  }
}

export function bakeVectorInPlace(target: FabricObject) {
  const kind = vectorOf(target)
  if (!kind) return
  const baked = bakeShapeScale({
    type: kind,
    width: target.width || 0,
    height: target.height || 0,
    scaleX: target.scaleX || 1,
    scaleY: target.scaleY || 1,
    strokeWidth: target.strokeWidth || 0,
    rx: (target as Rect).rx,
    ry: (target as Rect).ry,
    x1: (target as FabricObject & { x1?: number }).x1,
    y1: (target as FabricObject & { y1?: number }).y1,
    x2: (target as FabricObject & { x2?: number }).x2,
    y2: (target as FabricObject & { y2?: number }).y2,
  })
  if (kind === 'line') {
    target.set({ x1: baked.x1, y1: baked.y1, x2: baked.x2, y2: baked.y2, scaleX: 1, scaleY: 1, strokeWidth: baked.strokeWidth })
    return
  }
  if (kind === 'ellipse') {
    target.set({ rx: baked.rx, ry: baked.ry, scaleX: baked.scaleX, scaleY: baked.scaleY, strokeWidth: baked.strokeWidth })
    return
  }
  target.set({
    width: baked.width,
    height: baked.height,
    scaleX: baked.scaleX,
    scaleY: baked.scaleY,
    strokeWidth: baked.strokeWidth,
    ...(kind === 'rect' ? { rx: baked.rx, ry: baked.ry } : {}),
  })
}

export function styleObject(target: FabricObject) {
  target.set({
    borderColor: HANDLE_STROKE,
    cornerColor: HANDLE_COLOR,
    cornerStrokeColor: HANDLE_STROKE,
    transparentCorners: false,
    cornerStyle: 'rect',
    cornerSize: 8,
    touchCornerSize: 36,
    borderScaleFactor: 1,
    padding: 0,
    lockScalingFlip: true,
  })
  if (isVectorCode(target)) {
    const controls = controlsUtils.createObjectDefaultControls()
    for (const key of ['ml', 'mr', 'mt', 'mb', 'tl', 'tr', 'bl', 'br'] as const) {
      const control = controls[key]
      control.actionHandler = codeResize
      control.actionName = 'resizing'
    }
    target.controls = withRotation(controls)
    return
  }
  if (isVectorShape(target) && vectorOf(target) !== 'line') {
    const controls = controlsUtils.createObjectDefaultControls()
    for (const key of ['ml', 'mr', 'mt', 'mb', 'tl', 'tr', 'bl', 'br'] as const) {
      const control = controls[key]
      control.actionHandler = vectorResize
      control.actionName = 'resizing'
      if (key === 'ml' || key === 'mr' || key === 'mt' || key === 'mb') control.cursorStyleHandler = controlsUtils.scaleSkewCursorStyleHandler
    }
    target.controls = withRotation(controls)
    target.set('strokeUniform', true)
    return
  }
  if (target.type === 'textbox' || target.type === 'i-text' || target.type === 'text') {
    const controls = controlsUtils.createTextboxDefaultControls()
    for (const key of ['ml', 'mr', 'mt', 'mb', 'tl', 'tr', 'bl', 'br'] as const) {
      const control = controls[key]
      if (!control) continue
      control.actionHandler = textResizeControl
      control.actionName = 'resizing'
    }
    target.controls = withRotation(controls)
    const meta = readMeta(target)
    if (meta && !meta.textMode) writeMeta(target, { ...meta, textMode: 'auto-height' })
    return
  }
  const controls = controlsUtils.createObjectDefaultControls()
  target.controls = withRotation(controls)
}

export function noteTextGesture(target: FabricObject | undefined) {
  if (!target) return
  if (target.type === 'textbox' || target.type === 'i-text' || target.type === 'text') rememberText(target)
}

export function textModeOf(meta: Meta | undefined): TextMode {
  return meta?.textMode ?? 'auto-height'
}
