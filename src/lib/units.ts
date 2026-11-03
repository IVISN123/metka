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
  if (!printhead || printhead <= 0 || content >= printhead) {
    return { offset: 0, size: content, overflows: !!printhead && content > printhead }
  }
  const extra = printhead - content
  const offset = align === 'center' ? Math.floor(extra / 2) : align === 'end' ? extra : 0
  return { offset, size: printhead, overflows: false }
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
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => row[key.trim()] ?? '')
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
  link.click()
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
