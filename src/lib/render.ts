import { StaticCanvas, type FabricObject } from 'fabric'
import type { DitherMode, LabelDocument, Meta, Sharpness } from '../types'
import { ditherLuma, sharpnessCut, sharpenLuma } from './dither'
import { ensureFontsReady } from './fonts'
import { materialize } from './materialize'
import { mmToPx } from './units'

function readMeta(obj: FabricObject): Meta | undefined {
  const data = (obj as FabricObject & { data?: Meta }).data
  if (!data?.kind) return undefined
  return data
}

async function loadScene(doc: LabelDocument, width: number, height: number, background: string) {
  const element = document.createElement('canvas')
  const canvas = new StaticCanvas(element, {
    width,
    height,
    backgroundColor: background,
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  })
  await canvas.loadFromJSON(doc.canvas)
  canvas.backgroundColor = background
  canvas.renderAll()
  return canvas
}

export async function renderDocumentColor(doc: LabelDocument): Promise<HTMLCanvasElement> {
  const width = mmToPx(doc.widthMm, doc.dpi)
  const height = mmToPx(doc.heightMm, doc.dpi)
  const canvas = await loadScene(doc, width, height, '#ffffff')
  try {
    canvas.renderAll()
    return canvas.toCanvasElement(1, { left: 0, top: 0, width, height })
  } finally {
    canvas.dispose()
  }
}

export async function renderDocumentThermal(doc: LabelDocument, row?: Record<string, string>, now = new Date(), pageNumber?: number) {
  await ensureFontsReady()
  const prepared = await materialize(doc, row, now, pageNumber)
  const width = mmToPx(prepared.widthMm, prepared.dpi)
  const height = mmToPx(prepared.heightMm, prepared.dpi)
  const canvas = await loadScene(prepared, width, height, '#ffffff')
  const sharpness = prepared.preview.sharpness ?? 'off'
  try {
    const out = document.createElement('canvas')
    out.width = width
    out.height = height
    const ctx = out.getContext('2d')
    if (!ctx) return out
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.imageSmoothingEnabled = false
    for (const obj of canvas.getObjects()) {
      const meta = readMeta(obj)
      if (!meta || meta.kind === 'paper' || obj.visible === false) continue
      obj.setCoords()
      if (meta.kind === 'image') {
        const chosen: DitherMode = meta.dither && meta.dither !== 'inherit' ? meta.dither : prepared.preview.mode
        const mode: DitherMode = sharpness === 'strong' ? 'threshold' : chosen
        const threshold = sharpness === 'strong' ? Math.min(prepared.preview.threshold, 150) : prepared.preview.threshold
        stampImage(ctx, obj, mode, threshold, sharpness === 'strong')
      } else {
        stampLine(ctx, obj, prepared.preview.threshold, sharpness)
      }
    }
    if (prepared.preview.invert) invert(ctx, width, height)
    return out
  } finally {
    canvas.dispose()
  }
}

function objectCanvas(obj: FabricObject): { element: HTMLCanvasElement; left: number; top: number; width: number; height: number } {
  const bounds = obj.getBoundingRect()
  const element = obj.toCanvasElement({ enableRetinaScaling: false })
  return { element, left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
}

function stampImage(ctx: CanvasRenderingContext2D, obj: FabricObject, mode: DitherMode, threshold: number, sharpen: boolean) {
  const { element, left, top, width, height } = objectCanvas(obj)
  const binary = binarize(element, mode, threshold, sharpen)
  const masked = document.createElement('canvas')
  masked.width = element.width
  masked.height = element.height
  const mctx = masked.getContext('2d')
  if (!mctx) return
  mctx.drawImage(binary, 0, 0)
  mctx.globalCompositeOperation = 'destination-in'
  mctx.drawImage(element, 0, 0)
  ctx.drawImage(masked, left, top, width, height)
}

function stampLine(ctx: CanvasRenderingContext2D, obj: FabricObject, threshold: number, sharpness: Sharpness) {
  const { element, left, top, width, height } = objectCanvas(obj)
  const source = element.getContext('2d', { willReadFrequently: true })
  if (!source) return
  const pixels = source.getImageData(0, 0, element.width, element.height)
  const cut = sharpnessCut(sharpness)
  const luma = new Float32Array(element.width * element.height)
  for (let pixel = 0, index = 0; pixel < pixels.data.length; pixel += 4, index += 1) {
    luma[index] = coveredLuma(pixels.data, pixel)
  }
  const gray = cut ? sharpenLuma(luma, element.width, element.height, cut.amount) : luma
  const limit = cut?.threshold ?? threshold
  const out = source.createImageData(element.width, element.height)
  for (let index = 0; index < gray.length; index += 1) {
    const value = (gray[index] ?? 255) < limit ? 0 : 255
    out.data[index * 4] = value
    out.data[index * 4 + 1] = value
    out.data[index * 4 + 2] = value
    out.data[index * 4 + 3] = 255
  }
  const tmp = document.createElement('canvas')
  tmp.width = element.width
  tmp.height = element.height
  tmp.getContext('2d')?.putImageData(out, 0, 0)
  ctx.drawImage(tmp, left, top, width, height)
}

function coveredLuma(data: Uint8ClampedArray, pixel: number) {
  const alpha = (data[pixel + 3] ?? 0) / 255
  const red = (data[pixel] ?? 0) * alpha + 255 * (1 - alpha)
  const green = (data[pixel + 1] ?? 0) * alpha + 255 * (1 - alpha)
  const blue = (data[pixel + 2] ?? 0) * alpha + 255 * (1 - alpha)
  return 0.299 * red + 0.587 * green + 0.114 * blue
}

function binarize(source: HTMLCanvasElement, mode: DitherMode, threshold: number, sharpen: boolean): HTMLCanvasElement {
  const ctx = source.getContext('2d', { willReadFrequently: true })
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  if (!ctx) return canvas
  const pixels = ctx.getImageData(0, 0, source.width, source.height)
  const plain = new Float32Array(source.width * source.height)
  for (let pixel = 0, index = 0; pixel < pixels.data.length; pixel += 4, index += 1) {
    plain[index] = coveredLuma(pixels.data, pixel)
  }
  const luma = sharpen ? sharpenLuma(plain, source.width, source.height, 1.2) : plain
  const bits = ditherLuma(luma, source.width, source.height, mode, threshold)
  const out = ctx.createImageData(source.width, source.height)
  for (let index = 0; index < bits.length; index += 1) {
    const value = bits[index] ?? 255
    out.data[index * 4] = value
    out.data[index * 4 + 1] = value
    out.data[index * 4 + 2] = value
    out.data[index * 4 + 3] = 255
  }
  canvas.getContext('2d')?.putImageData(out, 0, 0)
  return canvas
}

function invert(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = ctx.getImageData(0, 0, width, height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = 255 - (pixels.data[i] ?? 0)
    pixels.data[i + 1] = 255 - (pixels.data[i + 1] ?? 0)
    pixels.data[i + 2] = 255 - (pixels.data[i + 2] ?? 0)
  }
  ctx.putImageData(pixels, 0, 0)
}

export async function thumbnailOf(doc: LabelDocument, maxWidth = 420): Promise<string> {
  const source = await renderDocumentColor(doc)
  const scale = Math.min(1, maxWidth / Math.max(1, source.width))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(source.width * scale))
  canvas.height = Math.max(1, Math.round(source.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
