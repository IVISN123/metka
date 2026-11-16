import { metaFor } from './presets'
import { checkFirmware, shownVersion } from './printer-profile'

/**
 * niimbluelib 0.49.0 exposes one upgrade path: `NiimbotProtocol.firmwareUpgrade`.
 * It is not a per-model plugin. The call speaks the CRC32 firmware commands
 * (`StartFirmwareUpgrade` 245, `FirmwareCrc` 145, `FirmwareChunk` 155,
 * `FirmwareNoMoreChunks` 156, `FirmwareCommit` 146) and reports
 * `firmwareprogress` as chunks go out.
 *
 * `connectNegotiate` only assigns protocol 1 (`ConnectedNew`) or 3, 4, 5
 * (`ConnectedV3` plus the status bytes). Protocol 0 means the handshake did
 * not identify a version. There is no second, older flasher in this library,
 * so those sessions are refused before any byte is sent. Every other model
 * in the library's model list uses the same call.
 */
export const FLASH_PROTOCOLS = [1, 3, 4, 5] as const

/** Refuse a Bluetooth flash below this charge. USB serial power is the exception. */
export const BATTERY_MIN = 50

/** Larger than any image on fw.niim.blue; small enough to reject a random file. */
export const MAX_FIRMWARE_BYTES = 8 * 1024 * 1024

export const FIRMWARE_ORIGIN = 'https://fw.niim.blue'

export type PowerPath = 'level' | 'usb' | 'charging' | 'unknown' | 'low'

export type FirmwareBlock =
  | 'offline'
  | 'unsupported'
  | 'busy'
  | 'lid'
  | 'battery'
  | 'empty'
  | 'size'
  | 'conflict'
  | 'version'
  | 'model'
  | 'major'
  | 'downgrade'

export type FirmwareSupport =
  | { supported: true }
  | { supported: false; reason: 'model' | 'protocol' }

export type FirmwareAssessment =
  | { ok: true; downgrade: boolean; power: PowerPath; version: string }
  | { ok: false; code: FirmwareBlock; power: PowerPath }

export type ArchiveLinks = {
  /** Stable folder when the archive has one, otherwise the stable index. */
  stable: string
  /** Set when fw.niim.blue has a testing folder for this model. */
  testing: string | null
  /** False when the stable index has no directory for this model. */
  hasStableFolder: boolean
}

export type FirmwareImage = {
  name: string
  version: string
  href: string
}

export type CatalogResult =
  | { ok: true; images: FirmwareImage[]; pageUrl: string }
  | { ok: false; reason: 'missing' | 'cors' | 'http' | 'parse'; pageUrl: string }

type ArchiveFolder = { stable?: string; testing?: string }

/**
 * Directory names on fw.niim.blue (listing checked 2026-11-16).
 * These are paths only. No firmware bytes are stored in this repo.
 */
const ARCHIVE_FOLDERS: Record<string, ArchiveFolder> = {
  A20: { stable: 'A20', testing: 'A20' },
  A203: { testing: 'A203' },
  A63: { stable: 'A63', testing: 'A63' },
  A8: { testing: 'A8' },
  A8_P: { testing: 'A8_P' },
  B1: { stable: 'B1', testing: 'B1' },
  B1_PRO: { stable: 'B1 Pro', testing: 'B1 Pro' },
  B11: { testing: 'B11' },
  B16: { stable: 'B16', testing: 'B16' },
  B18: { stable: 'B18', testing: 'B18' },
  B18S: { testing: 'B18S' },
  B2: { testing: 'B2' },
  B2_PRO: { stable: 'B2 Pro', testing: 'B2 Pro' },
  B203: { stable: 'B203', testing: 'B203' },
  B21: { stable: 'B21', testing: 'B21' },
  B21_C2B: { stable: 'B21-C2B', testing: 'B21-C2B' },
  B21_L2B: { stable: 'B21-L2B', testing: 'B21-L2B' },
  B21_PRO: { stable: 'B21_Pro', testing: 'B21_Pro' },
  B21S: { stable: 'B21S', testing: 'B21S' },
  B21S_C2B: { stable: 'B21S-C2B', testing: 'B21S-C2B' },
  B31: { stable: 'B31', testing: 'B31' },
  B32: { stable: 'B32', testing: 'B32' },
  B32R: { testing: 'B32R' },
  B3S: { stable: 'B3S', testing: 'B3S' },
  B3S_P: { stable: 'B3S_P', testing: 'B3S_P' },
  B4: { stable: 'B4', testing: 'B4' },
  BETTY: { testing: 'Betty' },
  C1: { stable: 'C1', testing: 'C1' },
  D101: { stable: 'D101', testing: 'D101' },
  D11: { stable: 'D11', testing: 'D11' },
  D11_H: { stable: 'D11_H', testing: 'D11_H' },
  D110: { stable: 'D110', testing: 'D110' },
  D110_M: { stable: 'D110_M', testing: 'D110_M' },
  D11S: { testing: 'D11S' },
  D41: { testing: 'D41' },
  EP3M: { testing: 'EP3M' },
  ET10: { testing: 'ET10' },
  FUST: { stable: 'Fust', testing: 'Fust' },
  H1: { stable: 'H1', testing: 'H1' },
  H1S: { stable: 'H1S', testing: 'H1S' },
  HI_D110: { testing: 'Hi-D110' },
  HI_NB_D11: { stable: 'Hi-NB-D11', testing: 'Hi-NB-D11' },
  K2: { stable: 'K2', testing: 'K2' },
  K3: { stable: 'K3', testing: 'K3' },
  K3_W: { stable: 'K3_W', testing: 'K3_W' },
  M2_H: { stable: 'M2_H', testing: 'M2_H' },
  M3: { stable: 'M3', testing: 'M3' },
  MP3K: { stable: 'MP3K', testing: 'MP3K' },
  MP3K_W: { stable: 'MP3K_W', testing: 'MP3K_W' },
  N1: { stable: 'N1', testing: 'N1' },
  P1: { testing: 'P1' },
  P18: { stable: 'P18', testing: 'P18' },
  P1S: { stable: 'P1S', testing: 'P1S' },
  S6: { stable: 'S6', testing: 'S6' },
  S6_P: { testing: 'S6_P' },
  T8S: { testing: 'T8S' },
  Z401: { stable: 'Z401', testing: 'Z401' },
}

export function firmwareSupport(model: string, protocol: number | null): FirmwareSupport {
  const name = model.trim()
  const meta = metaFor(name)
  if (!meta || meta.model === 'UNKNOWN' || name.startsWith('#')) return { supported: false, reason: 'model' }
  if (protocol == null || !(FLASH_PROTOCOLS as readonly number[]).includes(protocol)) {
    return { supported: false, reason: 'protocol' }
  }
  return { supported: true }
}

export function firmwareArchive(model: string): ArchiveLinks {
  const folder = ARCHIVE_FOLDERS[model.trim()]
  const stableFolder = folder?.stable
  const testingFolder = folder?.testing
  return {
    stable: stableFolder ? folderUrl('stable', stableFolder) : `${FIRMWARE_ORIGIN}/stable/`,
    testing: testingFolder ? folderUrl('testing', testingFolder) : null,
    hasStableFolder: Boolean(stableFolder),
  }
}

/**
 * Web Serial is the USB path, so the printer is on external power.
 * `HeartbeatData.voltageState` has no published meaning in niimbluelib 0.49,
 * so a Bluetooth session is treated as charging only when the caller already
 * knows (`charging === true`). An unreported battery is not treated as low.
 */
export function powerForFlash(input: {
  battery: number | null
  transport: 'bluetooth' | 'serial' | null
  charging: boolean | null
}): PowerPath {
  if (input.transport === 'serial') return 'usb'
  if (input.charging === true) return 'charging'
  if (input.battery == null || !Number.isFinite(input.battery)) return 'unknown'
  if (input.battery < BATTERY_MIN) return 'low'
  return 'level'
}

export function versionFromFirmwareImage(bytes: Uint8Array, fileName: string): { version: string; conflict: boolean } {
  const header = headerVersion(bytes)
  const named = fileName.match(/(\d+\.\d+)/)?.[1] ?? ''
  if (header && named && header !== named) return { version: header, conflict: true }
  return { version: header || named, conflict: false }
}

export function assessFirmware(input: {
  connected: boolean
  model: string
  protocol: number | null
  hardware: string
  software: string
  battery: number | null
  lid: boolean | null
  transport: 'bluetooth' | 'serial' | null
  printing: boolean
  charging: boolean | null
  fileName: string
  version: string
  data: Uint8Array | null
  allowDowngrade: boolean
}): FirmwareAssessment {
  const power = powerForFlash(input)
  if (!input.connected) return { ok: false, code: 'offline', power }
  if (!firmwareSupport(input.model, input.protocol).supported) return { ok: false, code: 'unsupported', power }
  if (input.printing) return { ok: false, code: 'busy', power }
  if (input.lid === false) return { ok: false, code: 'lid', power }
  if (power === 'low') return { ok: false, code: 'battery', power }
  if (!input.data || input.data.byteLength === 0) return { ok: false, code: 'empty', power }
  if (input.data.byteLength > MAX_FIRMWARE_BYTES) return { ok: false, code: 'size', power }
  const detected = versionFromFirmwareImage(input.data, input.fileName)
  if (detected.conflict) return { ok: false, code: 'conflict', power }
  if (detected.version && input.version.trim() !== detected.version) return { ok: false, code: 'version', power }
  const verdict = checkFirmware({
    model: input.model,
    hardware: input.hardware,
    software: input.software,
    fileName: input.fileName,
    version: input.version,
    allowDowngrade: input.allowDowngrade,
  })
  if (!verdict.ok) return { ok: false, code: verdict.code, power }
  return { ok: true, downgrade: verdict.downgrade === true, power, version: input.version.trim() }
}

export function firmwareVersionsMatch(expected: string, reported: string): boolean {
  const want = shownVersion(expected)
  const got = shownVersion(reported)
  return /^\d+\.\d+$/.test(want) && want === got
}

export function parseFirmwareIndex(html: string, pageUrl: string): FirmwareImage[] {
  const images: FirmwareImage[] = []
  const seen = new Set<string>()
  for (const match of html.matchAll(/href="([^"]+\.bin)"/gi)) {
    const raw = match[1]
    if (!raw || raw.includes('..')) continue
    let name = raw.split('/').pop() ?? raw
    try {
      name = decodeURIComponent(name)
    } catch {
      /* keep the raw href leaf */
    }
    const version = name.match(/(\d+\.\d+)\.bin$/i)?.[1]
    if (!version || seen.has(name)) continue
    seen.add(name)
    images.push({ name, version, href: new URL(raw, pageUrl).href })
  }
  images.sort((a, b) => versionRank(b.version) - versionRank(a.version))
  return images
}

export async function loadFirmwareCatalog(model: string, fetchImpl: typeof fetch = fetch): Promise<CatalogResult> {
  const links = firmwareArchive(model)
  if (!links.hasStableFolder) return { ok: false, reason: 'missing', pageUrl: links.stable }
  try {
    const response = await fetchImpl(links.stable)
    if (!response.ok) return { ok: false, reason: 'http', pageUrl: links.stable }
    const html = await response.text()
    const images = parseFirmwareIndex(html, links.stable)
    if (images.length === 0) return { ok: false, reason: 'parse', pageUrl: links.stable }
    return { ok: true, images, pageUrl: links.stable }
  } catch (error) {
    if (error instanceof TypeError) return { ok: false, reason: 'cors', pageUrl: links.stable }
    return { ok: false, reason: 'http', pageUrl: links.stable }
  }
}

export async function downloadFirmwareImage(href: string, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  const response = await fetchImpl(href)
  if (!response.ok) throw new Error(`http ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

/** Library errors thrown by `firmwareUpgrade`, mapped to a stable code for the UI. */
export function mapUpgradeError(error: unknown): 'rejected' | 'crc' | 'timeout' | 'link' | 'notConnected' | 'unknown' {
  const message = error instanceof Error ? error.message : String(error)
  if (message === 'notConnected') return 'notConnected'
  if (/CRC/i.test(message)) return 'crc'
  if (/rejected|invalid file|downgrade protection|Firmware error|Not a firmware packet/i.test(message)) return 'rejected'
  if (/timeout|timed out/i.test(message)) return 'timeout'
  if (/disconnect|network|GATT|link lost|NotFoundError/i.test(message)) return 'link'
  return 'unknown'
}

type WakeLockSentinel = { release(): Promise<void> }

/**
 * Holds a screen wake lock and asks again if the browser drops it when the
 * tab is hidden. Returns `held: false` when the API is missing or refuses.
 */
export async function holdScreenAwake(): Promise<{ release: () => void; held: boolean }> {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & {
    wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> }
  })
  const doc = typeof document === 'undefined' ? undefined : document
  if (!nav?.wakeLock || !doc) return { release: () => undefined, held: false }
  const locks: WakeLockSentinel[] = []
  let closed = false
  let held = false
  const request = async () => {
    if (closed || doc.visibilityState === 'hidden') return
    try {
      locks.push(await nav.wakeLock!.request('screen'))
      held = true
    } catch {
      /* the browser refused, or the tab is not visible */
    }
  }
  const onVisible = () => {
    if (doc.visibilityState === 'visible') void request()
  }
  await request()
  doc.addEventListener('visibilitychange', onVisible)
  return {
    held,
    release: () => {
      closed = true
      doc.removeEventListener('visibilitychange', onVisible)
      for (const lock of locks) void lock.release().catch(() => undefined)
    },
  }
}

function folderUrl(channel: 'stable' | 'testing', folder: string): string {
  return `${FIRMWARE_ORIGIN}/${channel}/${encodeURIComponent(folder)}/`
}

function headerVersion(bytes: Uint8Array): string {
  if (bytes.length < 0x1c || bytes[0] !== 0x18) return ''
  const ver = ((bytes[0x15] ?? 0) << 8) + (bytes[0x14] ?? 0)
  if (ver <= 0 || ver >= 10000) return ''
  return (ver / 100).toFixed(2)
}

function versionRank(version: string): number {
  const [major, minor] = version.split('.').map((part) => Number(part))
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return -1
  return major * 1000 + minor
}
