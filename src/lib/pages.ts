import type { LabelDocument, Meta } from '../types'

export function formatPageLabel(n: number, prefix = '', suffix = '', pad = 0): string {
  const width = Math.max(0, Math.min(6, Math.round(pad) || 0))
  const body = width > 0 ? String(Math.trunc(n)).padStart(width, '0') : String(Math.trunc(n))
  return `${prefix}${body}${suffix}`
}

export function parsePageRange(from: number, to: number): { from: number; to: number } | { error: 'range' } {
  if (!Number.isInteger(from) || !Number.isInteger(to)) return { error: 'range' }
  if (from < 1 || to < 1 || from > 999 || to > 999 || from > to) return { error: 'range' }
  if (to - from + 1 > 999) return { error: 'range' }
  return { from, to }
}

/** Copies stay with their page: 2–5 × 2 → 2,2,3,3,4,4,5,5. */
export function collatedPages(from: number, to: number, copies: number): number[] {
  const repeat = Math.max(1, Math.min(200, Math.round(copies) || 1))
  const pages: number[] = []
  for (let page = from; page <= to; page += 1) {
    for (let copy = 0; copy < repeat; copy += 1) pages.push(page)
  }
  return pages
}

export function documentHasPageNumber(doc: LabelDocument): boolean {
  const objects = Array.isArray(doc.canvas.objects) ? doc.canvas.objects : []
  return objects.some((item) => {
    if (!item || typeof item !== 'object') return false
    const data = (item as { data?: Meta }).data
    return data?.kind === 'number'
  })
}
