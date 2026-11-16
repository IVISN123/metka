// Salted SHA-256 of a 4-digit PIN. Salt and hash arrive at build time as
// VITE_METKA_PIN_SALT and VITE_METKA_PIN_HASH. If either is empty the gate
// stays off (local dev, tests, a deploy before the secrets exist).
// The bundle is public and there are only 10_000 PINs, so this is a deterrent.

export const PIN_UNLOCK_KEY = 'metka.pin.unlock'

const DELAY_AFTER_ATTEMPTS = 3
const DELAY_STEP_MS = 1500
const DELAY_MAX_MS = 8000

export type PinGateConfig = { hash: string; salt: string }

export type PinStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function toHex(bytes: Uint8Array): string {
  let hex = ''
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0')
  return hex
}

/** Random salt for `npm run pin-hash`. 16 bytes, hex. */
export function randomSalt(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

/** SHA-256 over `salt:pin`, lowercase hex. The colon is part of the format. */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(digest))
}

export function hashesEqual(actual: string, expected: string): boolean {
  const left = actual.trim().toLowerCase()
  const right = expected.trim().toLowerCase()
  if (left.length === 0 || left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i)
  return diff === 0
}

/** True only for a 4-digit PIN whose salted hash matches. */
export async function pinMatches(pin: string, salt: string, expectedHash: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) return false
  const cleanSalt = salt.trim()
  const cleanHash = expectedHash.trim()
  if (!cleanSalt || !cleanHash) return false
  const actual = await hashPin(pin, cleanSalt)
  return hashesEqual(actual, cleanHash)
}

/** Both values must be non-empty. Whitespace-only counts as empty. */
export function pinGateFromEnv(hash: unknown, salt: unknown): PinGateConfig | null {
  const cleanHash = trimmed(hash)
  const cleanSalt = trimmed(salt)
  if (!cleanHash || !cleanSalt) return null
  return { hash: cleanHash, salt: cleanSalt }
}

export function currentPinGate(): PinGateConfig | null {
  return pinGateFromEnv(import.meta.env.VITE_METKA_PIN_HASH, import.meta.env.VITE_METKA_PIN_SALT)
}

/**
 * Pause after several wrong tries. The first two misses are immediate;
 * the third waits 1.5s, then each further miss adds 1.5s, capped at 8s.
 */
export function pinRetryDelayMs(failedAttempts: number): number {
  if (!Number.isFinite(failedAttempts) || failedAttempts < DELAY_AFTER_ATTEMPTS) return 0
  const steps = failedAttempts - DELAY_AFTER_ATTEMPTS + 1
  return Math.min(DELAY_STEP_MS * steps, DELAY_MAX_MS)
}

export function readUnlock(store: PinStore, hash: string): boolean {
  if (!hash) return false
  try {
    return store.getItem(PIN_UNLOCK_KEY) === hash
  } catch {
    return false
  }
}

export function writeUnlock(store: PinStore, hash: string) {
  store.setItem(PIN_UNLOCK_KEY, hash)
}

export function clearUnlock(store: PinStore) {
  store.removeItem(PIN_UNLOCK_KEY)
}
