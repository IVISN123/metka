export const MAX_PHOTO_BYTES = 12 * 1024 * 1024
export const MAX_PHOTO_EDGE = 2048

export function historyDepth(jsonChars: number): number {
  if (!Number.isFinite(jsonChars) || jsonChars > 1_500_000) return 8
  return 40
}

export function rasterLimit(
  sourceW: number,
  sourceH: number,
  destW: number,
  destH: number,
): { width: number; height: number } {
  const width = positive(destW)
  const height = positive(destH)
  const sourceWidth = positive(sourceW)
  const sourceHeight = positive(sourceH)
  if (sourceWidth <= width * 1.5 && sourceHeight <= height * 1.5) return { width: sourceWidth, height: sourceHeight }
  return { width, height }
}

export function targetPhotoSize(width: number, height: number, maxEdge: number): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Number.isFinite(maxEdge) || maxEdge <= 0) {
    return null
  }
  if (width <= maxEdge && height <= maxEdge) return null
  const scale = maxEdge / Math.max(width, height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function positive(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  return Math.max(1, Math.round(value))
}
