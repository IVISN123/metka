export function seriesValues(prefix: string, from: number, to: number, pad: number): string[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return []
  const step = from <= to ? 1 : -1
  const width = Math.max(0, Math.min(8, Math.trunc(pad) || 0))
  const out: string[] = []
  for (let value = Math.trunc(from); step > 0 ? value <= to : value >= to; value += step) {
    out.push(prefix + String(Math.abs(value)).padStart(width, '0'))
    if (out.length >= 500) break
  }
  return out
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const source = text.replace(/^\uFEFF/, '').trim()
  if (!source) return { headers: [], rows: [] }
  const table = splitCsv(source)
  if (table.length === 0) return { headers: [], rows: [] }
  const headers = table[0]?.map((cell) => cell.trim()) ?? []
  const rows = table.slice(1).map((cells) => {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      if (header) row[header] = cells[index]?.trim() ?? ''
    })
    return row
  })
  return { headers: headers.filter(Boolean), rows }
}

function splitCsv(source: string): string[][] {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const commas = firstLine.match(/,/g)?.length ?? 0
  const semis = firstLine.match(/;/g)?.length ?? 0
  const delimiter = semis > commas ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          current += '"'
          index += 1
        } else quoted = false
      } else current += char
      continue
    }
    if (char === '"') quoted = true
    else if (char === delimiter) {
      row.push(current)
      current = ''
    } else if (char === '\n') {
      row.push(current)
      rows.push(row)
      row = []
      current = ''
    } else if (char !== '\r') current += char
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}
