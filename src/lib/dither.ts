import type { DitherMode } from '../types'

export function ditherLuma(
  source: Float32Array,
  width: number,
  height: number,
  mode: DitherMode,
  threshold: number,
): Uint8Array {
  const gray = new Float32Array(source)
  const out = new Uint8Array(width * height)
  const add = (x: number, y: number, error: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    gray[y * width + x] += error
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      const old = gray[index] ?? 255
      const bw = old < threshold ? 0 : 255
      const error = old - bw
      gray[index] = bw
      out[index] = bw
      if (mode === 'floyd') {
        add(x + 1, y, (error * 7) / 16)
        add(x - 1, y + 1, (error * 3) / 16)
        add(x, y + 1, (error * 5) / 16)
        add(x + 1, y + 1, error / 16)
      } else if (mode === 'atkinson') {
        add(x + 1, y, error / 8)
        add(x + 2, y, error / 8)
        add(x - 1, y + 1, error / 8)
        add(x, y + 1, error / 8)
        add(x + 1, y + 1, error / 8)
        add(x, y + 2, error / 8)
      }
    }
  }
  return out
}
