import { metaFor } from './presets'
import { MAX_FIRMWARE_BYTES, versionFromFirmwareImage } from './firmware'
import { firmwareFileModel, shownVersion } from './printer-profile'

/**
 * Same-origin manifest of the owner's D11_H images.
 * Vite `base` is `/metka/`, so the resolved URL is `/metka/firmware/d11_h/manifest.json`
 * on GitHub Pages and on the dev server. The bytes live next to it; nothing is fetched
 * from fw.niim.blue.
 */
export const FIRMWARE_MANIFEST_PATH = 'firmware/d11_h/manifest.json'

/** Header model id of every image in this set (Niimbot D11_H). */
export const D11_H_HEADER_MODEL = 528

export type FirmwareKind = 'patched' | 'original' | 'stock'

export type FirmwareOffer = {
  model: string
  version: string
  /** Site path under the Vite base, never an absolute or off-origin URL. */
  url: string
  sha256: string
  size: number
  notes: string
  stable: boolean
  kind: FirmwareKind
  name: string
  /** Set on the patched image the source README calls the one to use. */
  recommend: boolean
}

export type FirmwareRelation = 'current' | 'newer' | 'older' | 'unknown'

export type ListedFirmware = FirmwareOffer & {
  relation: FirmwareRelation
  recommended: boolean
}

export type ManifestResult =
  | { ok: true; firmwares: FirmwareOffer[]; url: string }
  | { ok: false; reason: 'http' | 'cors' | 'parse'; url: string }

export type DownloadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; reason: 'http' | 'size' | 'sha' | 'model' | 'version' }

const KINDS = new Set<FirmwareKind>(['patched', 'original', 'stock'])
const KIND_ORDER: Record<FirmwareKind, number> = { stock: 0, original: 1, patched: 2 }

export function canonicalFirmwareModel(model: string): string | null {
  const name = model.trim()
  if (!name || name.startsWith('#')) return null
  const direct = name.replace(/[\s-]+/g, '_').replace(/_+/g, '_').toUpperCase()
  const meta = metaFor(direct)
  if (!meta || meta.model === 'UNKNOWN') return null
  return direct
}

/** Join a manifest path with the app base (`/metka/` on GitHub Pages). */
export function resolveFirmwareUrl(path: string, base: string): string {
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${path.replace(/^\.\//, '').replace(/^\//, '')}`
}

export function firmwareManifestUrl(base = import.meta.env.BASE_URL || '/'): string {
  return resolveFirmwareUrl(FIRMWARE_MANIFEST_PATH, base)
}

export function compareFirmwareVersions(left: string, right: string): number | null {
  const a = versionParts(left)
  const b = versionParts(right)
  if (!a || !b) return null
  if (a.major !== b.major) return a.major - b.major
  return a.minor - b.minor
}

/**
 * Offers for the connected printer. This manifest is D11_H only, so any other
 * model gets an empty list. Stable rows come first, then newer versions.
 * The README recommendation stays first when it is not a downgrade.
 */
export function listFirmwareOffers(
  offers: FirmwareOffer[],
  input: { model: string; hardware: string; software: string },
): ListedFirmware[] {
  const model = canonicalFirmwareModel(input.model)
  if (model !== 'D11_H') return []
  const hardware = shownVersion(input.hardware)
  const software = shownVersion(input.software)
  const listed = offers
    .filter((offer) => offer.model === 'D11_H')
    .map((offer) => {
      const relation = relationOf(offer.version, software)
      const recommended = offer.recommend && relation !== 'older' && sameMajor(offer.version, hardware, software)
      return { ...offer, relation, recommended }
    })
  listed.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
    if (a.stable !== b.stable) return a.stable ? -1 : 1
    const byVersion = compareFirmwareVersions(b.version, a.version) ?? 0
    if (byVersion !== 0) return byVersion
    const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (byKind !== 0) return byKind
    return a.name.localeCompare(b.name)
  })
  return listed
}

export function parseFirmwareManifest(data: unknown): FirmwareOffer[] {
  if (!data || typeof data !== 'object' || !Array.isArray((data as { firmwares?: unknown }).firmwares)) {
    throw new Error('parse')
  }
  return (data as { firmwares: unknown[] }).firmwares.map(parseOffer)
}

export async function loadFirmwareManifest(options?: {
  fetchImpl?: typeof fetch
  base?: string
  manifestPath?: string
}): Promise<ManifestResult> {
  const base = options?.base ?? (import.meta.env.BASE_URL || '/')
  const path = options?.manifestPath ?? FIRMWARE_MANIFEST_PATH
  const url = resolveFirmwareUrl(path, base)
  const fetchImpl = options?.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(url)
    if (!response.ok) return { ok: false, reason: 'http', url }
    const data: unknown = await response.json()
    return { ok: true, firmwares: parseFirmwareManifest(data), url }
  } catch (error) {
    if (error instanceof TypeError) return { ok: false, reason: 'cors', url }
    return { ok: false, reason: 'parse', url }
  }
}

/**
 * Download one manifest row and refuse it unless the size, SHA-256, name, and
 * D11_H header model all match. The caller still has to pass the existing flash checks.
 */
export async function downloadFirmwareOffer(
  offer: FirmwareOffer,
  options?: { fetchImpl?: typeof fetch; base?: string },
): Promise<DownloadResult> {
  const base = options?.base ?? (import.meta.env.BASE_URL || '/')
  const fetchImpl = options?.fetchImpl ?? fetch
  try {
    const response = await fetchImpl(resolveFirmwareUrl(offer.url, base))
    if (!response.ok) return { ok: false, reason: 'http' }
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength !== offer.size || bytes.byteLength === 0 || bytes.byteLength > MAX_FIRMWARE_BYTES) {
      return { ok: false, reason: 'size' }
    }
    const hash = await sha256Hex(bytes)
    if (hash !== offer.sha256) return { ok: false, reason: 'sha' }
    const agreement = imageAgreesWithOffer(bytes, offer)
    if (agreement !== 'ok') return { ok: false, reason: agreement }
    return { ok: true, bytes }
  } catch (error) {
    if (error instanceof TypeError) return { ok: false, reason: 'http' }
    return { ok: false, reason: 'http' }
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const digest = await crypto.subtle.digest('SHA-256', copy)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function firmwareHeaderModel(bytes: Uint8Array): number | null {
  if (bytes.length < 0x1c || bytes[0] !== 0x18) return null
  return (bytes[0x16] ?? 0) + ((bytes[0x17] ?? 0) << 8)
}

function imageAgreesWithOffer(bytes: Uint8Array, offer: FirmwareOffer): 'ok' | 'model' | 'version' {
  if (firmwareFileModel(offer.name) !== offer.model) return 'model'
  if (offer.model === 'D11_H' && firmwareHeaderModel(bytes) !== D11_H_HEADER_MODEL) return 'model'
  const detected = versionFromFirmwareImage(bytes, offer.name)
  if (detected.conflict || detected.version !== offer.version) return 'version'
  return 'ok'
}

function parseOffer(value: unknown): FirmwareOffer {
  if (!value || typeof value !== 'object') throw new Error('parse')
  const row = value as Record<string, unknown>
  const model = typeof row.model === 'string' ? canonicalFirmwareModel(row.model) : null
  const version = typeof row.version === 'string' ? row.version.trim() : ''
  const url = typeof row.url === 'string' ? row.url : ''
  const name = typeof row.name === 'string' ? row.name : ''
  const sha256 = typeof row.sha256 === 'string' ? row.sha256.trim().toLowerCase() : ''
  const notes = typeof row.notes === 'string' ? row.notes : ''
  const kind = row.kind
  if (!model || !/^\d+\.\d+$/.test(version)) throw new Error('parse')
  if (!KINDS.has(kind as FirmwareKind)) throw new Error('parse')
  if (!isRelativeAsset(url) || !/^[0-9a-f]{64}$/.test(sha256)) throw new Error('parse')
  if (!Number.isInteger(row.size) || (row.size as number) <= 0 || (row.size as number) > MAX_FIRMWARE_BYTES) throw new Error('parse')
  if (typeof row.stable !== 'boolean' || typeof row.recommend !== 'boolean') throw new Error('parse')
  if (!notes.trim() || notes.length > 1000) throw new Error('parse')
  const leaf = url.split('/').pop() ?? ''
  if (leaf !== name || firmwareFileModel(name) !== model) throw new Error('parse')
  const named = name.match(/(\d+\.\d+)/)?.[1]
  if (named !== version) throw new Error('parse')
  return {
    model,
    version,
    url,
    sha256,
    size: row.size as number,
    notes,
    stable: row.stable,
    kind: kind as FirmwareKind,
    name,
    recommend: row.recommend,
  }
}

function isRelativeAsset(url: string): boolean {
  if (!url || url.startsWith('/') || url.startsWith('\\') || url.startsWith('//')) return false
  if (url.includes('..') || url.includes('\\') || /[?#]/.test(url)) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return false
  return /^[\w./~-]+$/.test(url)
}

function relationOf(version: string, software: string): FirmwareRelation {
  const installed = shownVersion(software)
  const order = compareFirmwareVersions(version, installed)
  if (order === null || !/^\d+\.\d+$/.test(installed)) return 'unknown'
  if (order === 0) return 'current'
  return order > 0 ? 'newer' : 'older'
}

function sameMajor(version: string, hardware: string, software: string): boolean {
  const file = versionParts(version)
  const hw = versionParts(hardware)
  const sw = versionParts(software)
  if (!file || !hw || file.major !== hw.major) return false
  if (sw && file.major !== sw.major) return false
  return true
}

function versionParts(version: string): { major: number; minor: number } | null {
  const match = shownVersion(version).match(/^(\d+)\.(\d+)$/)
  if (!match) return null
  return { major: Number(match[1]), minor: Number(match[2]) }
}
