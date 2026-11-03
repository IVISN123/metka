import { ImageEncoder, PageColorType } from '@mmote/niimbluelib'
import type { AlignMode, PrintDirection } from '../types'
import { padAxis } from './units'

export function padCanvas(
  source: HTMLCanvasElement,
  direction: PrintDirection,
  printhead: number | undefined,
  align: AlignMode,
): { canvas: HTMLCanvasElement; overflows: boolean } {
  const horizontal = direction === 'top'
  const content = horizontal ? source.width : source.height
  const pad = padAxis(content, printhead, align)
  if (pad.offset === 0 && pad.size === content) return { canvas: source, overflows: pad.overflows }
  const canvas = document.createElement('canvas')
  canvas.width = horizontal ? pad.size : source.width
  canvas.height = horizontal ? source.height : pad.size
  const ctx = canvas.getContext('2d')
  if (!ctx) return { canvas: source, overflows: pad.overflows }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = false
  if (horizontal) ctx.drawImage(source, pad.offset, 0)
  else ctx.drawImage(source, 0, pad.offset)
  return { canvas, overflows: pad.overflows }
}

export function describeEncoded(canvas: HTMLCanvasElement, direction: PrintDirection) {
  const encoded = ImageEncoder.encodeCanvas(canvas, PageColorType.SingleColor, direction)
  let black = 0
  for (const row of encoded.rowsData) {
    if (row.dataType === 'pixels') black += row.blackPixelsCount * row.repeat
  }
  return { cols: encoded.cols, rows: encoded.rows, black, encoded }
}
