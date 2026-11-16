import { Ellipse, Line, Rect, Triangle, type FabricObject } from 'fabric'
import { readMeta } from '../engine/meta'
import type { StrokeAlign } from './transform'

const ALIGNED = Symbol('metkaAlignedRender')

type Paintable = FabricObject & { [ALIGNED]?: boolean }

function kindOf(obj: FabricObject) {
  return (obj.type || '').toLowerCase()
}

export function isVectorShape(obj: FabricObject): boolean {
  const type = kindOf(obj)
  return type === 'rect' || type === 'ellipse' || type === 'triangle' || type === 'line'
}

function traceVector(obj: FabricObject, ctx: CanvasRenderingContext2D, fresh = true) {
  const type = kindOf(obj)
  if (fresh) ctx.beginPath()
  if (type === 'ellipse') {
    const ellipse = obj as Ellipse
    const rx = ellipse.rx || (ellipse.width ?? 0) / 2
    const ry = ellipse.ry || (ellipse.height ?? 0) / 2
    ctx.ellipse(0, 0, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2)
    return
  }
  if (type === 'triangle') {
    const w = (obj.width ?? 0) / 2
    const h = (obj.height ?? 0) / 2
    ctx.moveTo(-w, h)
    ctx.lineTo(0, -h)
    ctx.lineTo(w, h)
    ctx.closePath()
    return
  }
  if (type === 'line') {
    const line = obj as Line
    const points = line.calcLinePoints()
    ctx.moveTo(points.x1, points.y1)
    ctx.lineTo(points.x2, points.y2)
    return
  }
  const rect = obj as Rect
  const w = rect.width ?? 0
  const h = rect.height ?? 0
  const rx = Math.max(0, rect.rx ?? 0)
  const ry = Math.max(0, rect.ry ?? 0)
  ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(rx, ry, w / 2, h / 2))
}

function paintAligned(obj: FabricObject, ctx: CanvasRenderingContext2D, original: (ctx: CanvasRenderingContext2D) => void) {
  const align = (readMeta(obj)?.strokeAlign ?? 'center') as StrokeAlign
  if (align === 'center' || kindOf(obj) === 'line' || !(obj.strokeWidth > 0) || !obj.stroke) {
    original.call(obj, ctx)
    return
  }
  const stroke = obj.stroke
  const fill = obj.fill
  const width = obj.strokeWidth
  obj.set('stroke', '')
  original.call(obj, ctx)
  obj.set('stroke', stroke)
  ctx.save()
  traceVector(obj, ctx)
  if (align === 'inside') {
    ctx.clip()
  } else {
    ctx.beginPath()
    ctx.rect(-20000, -20000, 40000, 40000)
    traceVector(obj, ctx, false)
    ctx.clip('evenodd')
  }
  ctx.lineWidth = width * 2
  ctx.strokeStyle = typeof stroke === 'string' ? stroke : '#000000'
  ctx.lineJoin = obj.strokeLineJoin || 'miter'
  ctx.miterLimit = obj.strokeMiterLimit || 4
  traceVector(obj, ctx)
  ctx.stroke()
  ctx.restore()
  obj.set({ fill, stroke, strokeWidth: width })
}

export function prepareObject(obj: FabricObject) {
  if (!isVectorShape(obj)) return
  obj.set('strokeUniform', true)
  const host = obj as Paintable
  if (host[ALIGNED]) return
  const original = Object.getPrototypeOf(obj)._render as (ctx: CanvasRenderingContext2D) => void
  host._render = function renderAligned(this: FabricObject, ctx: CanvasRenderingContext2D) {
    paintAligned(this, ctx, original)
  }
  host[ALIGNED] = true
}

export function prepareScene(objects: FabricObject[]) {
  const visit = (obj: FabricObject) => {
    if (readMeta(obj)?.kind === 'paper') return
    prepareObject(obj)
    const nested = obj as FabricObject & { getObjects?: () => FabricObject[] }
    if (typeof nested.getObjects === 'function') {
      for (const child of nested.getObjects()) visit(child)
    }
  }
  for (const obj of objects) visit(obj)
}

export function vectorOf(obj: FabricObject): 'rect' | 'ellipse' | 'triangle' | 'line' | null {
  if (obj instanceof Line || kindOf(obj) === 'line') return 'line'
  if (obj instanceof Ellipse || kindOf(obj) === 'ellipse') return 'ellipse'
  if (obj instanceof Triangle || kindOf(obj) === 'triangle') return 'triangle'
  if (obj instanceof Rect || kindOf(obj) === 'rect') return 'rect'
  return null
}
