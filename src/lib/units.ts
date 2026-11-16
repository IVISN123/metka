import type { AlignMode } from '../types'

export function mmToPx(mm: number, dpi: number): number {
  if (!Number.isFinite(mm) || !Number.isFinite(dpi) || dpi <= 0) return 1
  return Math.max(1, Math.round((mm * dpi) / 25.4))
}

export function pxToMm(px: number, dpi: number): number {
  if (!Number.isFinite(px) || !Number.isFinite(dpi) || dpi <= 0) return 0
  return (px * 25.4) / dpi
}

export function padAxis(
  content: number,
  printhead: number | undefined,
  align: AlignMode,
): { offset: number; size: number; overflows: boolean } {
  const head = printhead && Number.isFinite(printhead) && printhead > 0 ? Math.round(printhead) : 0
  if (!Number.isFinite(content) || content <= 0) return { offset: 0, size: Math.max(1, head || 1), overflows: false }
  const length = Math.max(1, Math.round(content))
  if (!head || length >= head) return { offset: 0, size: length, overflows: !!head && length > head }
  const extra = head - length
  const offset = align === 'center' ? Math.floor(extra / 2) : align === 'end' ? extra : 0
  return { offset, size: head, overflows: false }
}

export function parseMm(value: string): number | null {
  const text = value.trim().replace(',', '.')
  if (!/^[+-]?(?:\d+|\d+\.\d+|\.\d+)$/.test(text)) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

export function clampSize(widthMm: number, heightMm: number, dpi: number): { widthMm: number; heightMm: number; dpi: number } {
  return {
    widthMm: clamp(Number.isFinite(widthMm) ? widthMm : 40, 8, 120),
    heightMm: clamp(Number.isFinite(heightMm) ? heightMm : 12, 8, 200),
    dpi: clamp(Number.isFinite(dpi) ? Math.round(dpi) : 203, 96, 600),
  }
}

export function sizeClampNote(widthMm: number, heightMm: number): 'small' | 'large' | null {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null
  if (widthMm < 8 || heightMm < 8) return 'small'
  if (widthMm > 120 || heightMm > 200) return 'large'
  return null
}

export function clampCopies(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return clamp(Math.round(value), 1, 200)
}

export function clampDpi(value: number): number | null {
  if (!Number.isFinite(value)) return null
  return clamp(Math.round(value), 96, 600)
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function uniqueName(name: string, taken: string[]): string {
  const base = name.trim() || 'Untitled'
  if (!taken.includes(base)) return base
  let index = 2
  while (taken.includes(`${base} (${index})`)) index += 1
  return `${base} (${index})`
}

export function verticalize(text: string): string {
  return Array.from(text.replaceAll('\n', '')).join('\n')
}

export function formatDate(format: string, date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const hours = date.getHours()
  return format
    .replaceAll('YYYY', String(date.getFullYear()))
    .replaceAll('YY', String(date.getFullYear()).slice(2))
    .replaceAll('MM', pad(date.getMonth() + 1))
    .replaceAll('DD', pad(date.getDate()))
    .replaceAll('HH', pad(hours))
    .replaceAll('mm', pad(date.getMinutes()))
}

export function fillTemplate(text: string, row?: Record<string, string>): string {
  if (!row) return text
  const keys = Object.keys(row)
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, raw: string) => {
    const key = raw.trim().normalize('NFC')
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key] ?? ''
    const folded = key.toLocaleLowerCase('ru')
    const match = keys.filter((item) => item.normalize('NFC').toLocaleLowerCase('ru') === folded)
    return match.length === 1 ? (row[match[0]!] ?? '') : ''
  })
}

export function localDateStamp(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function modelLabel(id: string): string {
  return id
    .replaceAll('_', ' ')
    .replaceAll('PRO', 'Pro')
    .replaceAll('SE', 'SE')
}

export function downloadUrl(filename: string, href: string) {
  const link = document.createElement('a')
  link.href = href
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  downloadUrl(filename, url)
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'label'
  )
}
