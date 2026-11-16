import { FabricObject, classRegistry } from 'fabric'
import type { Meta } from '../types'
import {
  paintIcon,
  rasterizeCode,
  sceneToSvg,
  specFromMeta,
  vectorShapes,
  type CodeRaster,
  type DrawShape,
} from '../lib/vector-code'

/**
 * A QR or barcode stored as content plus options.
 * Width and height are the layout box in printer pixels. Changing them redraws the modules.
 * Scale stays a plain transform so an editor can also set width and height directly via `setBox`.
 */
export class VectorCode extends FabricObject {
  static type = 'VectorCode'

  constructor(options?: ConstructorParameters<typeof FabricObject>[0]) {
    super(options)
    this.objectCaching = false
  }

  /** Fit the symbol to a new box. Scale is cleared so the box is the size. */
  setBox(width: number, height: number) {
    this.set({
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      scaleX: 1,
      scaleY: 1,
    })
    this.objectCaching = false
    this.dirty = true
    this.setCoords()
  }

  _render(ctx: CanvasRenderingContext2D) {
    const spec = specFromMeta(this.codeMeta())
    if (!spec) return
    const width = this.width || 1
    const height = this.height || 1
    let shapes: DrawShape[]
    try {
      shapes = vectorShapes(spec, width, height).shapes
    } catch {
      return
    }
    ctx.save()
    ctx.translate(-width / 2, -height / 2)
    ctx.imageSmoothingEnabled = false
    for (const shape of shapes) drawShape(ctx, shape)
    ctx.restore()
  }

  _toSVG() {
    const spec = specFromMeta(this.codeMeta())
    const width = this.width || 1
    const height = this.height || 1
    if (!spec) return ['<g ', 'COMMON_PARTS', '></g>\n']
    let body = ''
    try {
      const scene = vectorShapes(spec, width, height)
      body = sceneToSvg({ ...scene, width, height }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    } catch {
      body = ''
    }
    return ['<g ', 'COMMON_PARTS', `transform="translate(${-width / 2} ${-height / 2})">\n`, body, '</g>\n']
  }

  private codeMeta(): Meta | undefined {
    const data = (this as FabricObject & { data?: Meta }).data
    return data
  }
}

classRegistry.setClass(VectorCode)

export function isVectorCode(obj: FabricObject): obj is VectorCode {
  return obj instanceof VectorCode || (obj.type || '').toLowerCase() === 'vectorcode'
}

/** Stamp a code onto a printer-resolution canvas. Modules land on whole pixels. */
export function paintCrispCode(ctx: CanvasRenderingContext2D, obj: FabricObject) {
  const spec = specFromMeta((obj as FabricObject & { data?: Meta }).data)
  if (!spec) return
  const width = Math.max(1, Math.round(obj.getScaledWidth()))
  const height = Math.max(1, Math.round(obj.getScaledHeight()))
  let raster: CodeRaster
  try {
    raster = rasterizeCode(spec, width, height)
  } catch {
    return
  }
  const image = pixelsToCanvas(raster.pixels, raster.width, raster.height)
  const center = obj.getCenterPoint()
  ctx.save()
  ctx.imageSmoothingEnabled = false
  if (!obj.angle && !obj.flipX && !obj.flipY) {
    ctx.drawImage(image, Math.round(center.x - width / 2), Math.round(center.y - height / 2))
  } else {
    ctx.translate(center.x, center.y)
    ctx.rotate(((obj.angle || 0) * Math.PI) / 180)
    ctx.scale(obj.flipX ? -1 : 1, obj.flipY ? -1 : 1)
    ctx.drawImage(image, Math.round(-width / 2), Math.round(-height / 2))
  }
  ctx.restore()
}

function pixelsToCanvas(pixels: Uint8Array, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  const image = ctx.createImageData(width, height)
  for (let index = 0; index < pixels.length; index += 1) {
    const value = pixels[index] ? 255 : 0
    image.data[index * 4] = value
    image.data[index * 4 + 1] = value
    image.data[index * 4 + 2] = value
    image.data[index * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

function drawShape(ctx: CanvasRenderingContext2D, shape: DrawShape) {
  ctx.fillStyle = 'fill' in shape ? shape.fill : '#000000'
  if (shape.kind === 'rect') {
    ctx.beginPath()
    if (shape.rx > 0.5 && typeof ctx.roundRect === 'function') ctx.roundRect(shape.x, shape.y, shape.w, shape.h, shape.rx)
    else ctx.rect(shape.x, shape.y, shape.w, shape.h)
    ctx.fill()
    return
  }
  if (shape.kind === 'circle') {
    ctx.beginPath()
    ctx.arc(shape.cx, shape.cy, Math.max(0, shape.r), 0, Math.PI * 2)
    ctx.fill()
    return
  }
  if (shape.kind === 'text') {
    ctx.font = `${shape.size}px ${shape.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(shape.text, shape.x, shape.y)
    return
  }
  paintIcon(ctx, shape.id, shape.x, shape.y, shape.size, shape.fill)
}
