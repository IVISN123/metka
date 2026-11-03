import type { DitherMode, Sharpness } from '../types'

export function sharpenLuma(source: Float32Array, width: number, height: number, amount: number): Float32Array {
  const out = new Float32Array(source.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
          sum += source[yy * width + xx] ?? 0
          count += 1
        }
      }
      const center = source[y * width + x] ?? 0
      const blur = count ? sum / count : center
      out[y * width + x] = Math.min(255, Math.max(0, center + amount * (center - blur)))
    }
  }
  return out
}

export function sharpnessCut(sharpness: Sharpness): { amount: number; threshold: number } | null {
  if (sharpness === 'clear') return { amount: 0.9, threshold: 200 }
  if (sharpness === 'strong') return { amount: 1.5, threshold: 224 }
  return null
}

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
