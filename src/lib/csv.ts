const DELIMITERS = [',', ';', '\t'] as const
type Delimiter = (typeof DELIMITERS)[number]

export function seriesValues(prefix: string, from: number, to: number, pad: number): string[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return []
  const start = Math.trunc(from)
  const end = Math.trunc(to)
  const step = start <= end ? 1 : -1
  const width = Math.max(0, Math.min(8, Math.trunc(pad) || 0))
  const out: string[] = []
  for (let value = start; step > 0 ? value <= end : value >= end; value += step) {
    const digits = String(Math.abs(value)).padStart(width, '0')
    out.push(prefix + (value < 0 ? '-' : '') + digits)
    if (out.length >= 500) break
  }
  return out
}

export function decodeCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1251').decode(bytes)
  }
}

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const source = text.replace(/^\uFEFF/, '')
  if (!source.trim()) return { headers: [], rows: [] }
  const table = splitCsv(source)
  if (table.length === 0) return { headers: [], rows: [] }
  const headers = uniqueHeaders(table[0]?.map((cell) => cell.trim()) ?? [])
  const rows = table.slice(1).map((cells) => {
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = cells[index]?.trim() ?? ''
    })
    return row
  })
  return { headers, rows }
}

function uniqueHeaders(cells: string[]): string[] {
  const used = new Set<string>()
  return cells.map((cell, index) => {
    const base = cell.normalize('NFC') || `column${index + 1}`
    if (!used.has(base)) {
      used.add(base)
      return base
    }
    let n = 2
    let name = `${base} (${n})`
    while (used.has(name)) {
      n += 1
      name = `${base} (${n})`
    }
    used.add(name)
    return name
  })
}

function detectDelimiter(source: string): Delimiter {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 }
  let quoted = false
  let lines = 0
  for (let index = 0; index < source.length && lines < 8; index += 1) {
    const char = source[index]
    if (char === '"') {
      if (quoted && source[index + 1] === '"') {
        index += 1
        continue
      }
      quoted = !quoted
      continue
    }
    if (quoted) continue
    if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      lines += 1
      continue
    }
    if (char === ',' || char === ';' || char === '\t') counts[char] += 1
  }
  let winner: Delimiter = ','
  let best = 0
  for (const delimiter of DELIMITERS) {
    const count = counts[delimiter]
    if (count > best) {
      best = count
      winner = delimiter
    }
  }
  return winner
}

function splitCsv(source: string): string[][] {
  const delimiter = detectDelimiter(source)
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let quoted = false
  const pushRow = () => {
    row.push(current)
    const blankLine = row.length === 1 && row[0]?.trim() === ''
    if (!blankLine) rows.push(row)
    row = []
    current = ''
  }
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
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      pushRow()
    } else current += char
  }
  if (current.length > 0 || row.length > 0) pushRow()
  return rows
}
