function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function gimbalDataUrl(): string {
  const canvas = document.createElement('canvas')
  canvas.width = 280
  canvas.height = 340
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 280, 340)

  ctx.fillStyle = '#cfcfcf'
  roundRect(ctx, 78, 16, 124, 26, 8)
  ctx.fill()
  ctx.fillStyle = '#9a9a9a'
  ctx.fillRect(132, 38, 16, 36)

  ctx.strokeStyle = '#1c1c1c'
  ctx.lineWidth = 12
  ctx.lineJoin = 'round'
  ctx.strokeRect(74, 78, 132, 86)

  ctx.fillStyle = '#2a2a2a'
  roundRect(ctx, 98, 118, 84, 58, 8)
  ctx.fill()

  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.arc(140, 214, 52, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#3a3a3a'
  ctx.beginPath()
  ctx.arc(140, 214, 34, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#0e0e0e'
  ctx.beginPath()
  ctx.arc(140, 214, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#bdbdbd'
  ctx.beginPath()
  ctx.arc(128, 202, 6, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#4d4d4d'
  roundRect(ctx, 118, 268, 44, 18, 4)
  ctx.fill()
  ctx.fillStyle = '#d0d0d0'
  ctx.fillRect(126, 286, 8, 28)
  ctx.fillRect(146, 286, 8, 28)
  return canvas.toDataURL('image/png')
}
