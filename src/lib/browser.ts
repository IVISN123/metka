export type BrowserSupport = {
  ios: boolean
  secure: boolean
  bluetooth: boolean
  serial: boolean
}

export function browserSupport(): BrowserSupport {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  const ua = nav?.userAgent ?? ''
  const platform = nav?.platform ?? ''
  const touch = nav?.maxTouchPoints ?? 0
  const ios = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && touch > 1)
  return {
    ios,
    secure: typeof window !== 'undefined' && window.isSecureContext === true,
    bluetooth: !!nav && 'bluetooth' in nav,
    serial: !!nav && 'serial' in nav,
  }
}

export type PrintBlock = 'insecure' | 'insecure-ios' | 'ios' | 'bluetooth'

export function printBlockReason(support: BrowserSupport): PrintBlock | null {
  if (!support.secure && support.ios) return 'insecure-ios'
  if (!support.secure) return 'insecure'
  if (!support.bluetooth && support.ios) return 'ios'
  if (!support.bluetooth) return 'bluetooth'
  return null
}

export function connectBlock(
  transport: 'bluetooth' | 'serial',
  support: BrowserSupport,
): 'insecure' | 'bluetoothMissing' | 'serialMissing' | null {
  if (!support.secure) return 'insecure'
  if (transport === 'bluetooth' && !support.bluetooth) return 'bluetoothMissing'
  if (transport === 'serial' && !support.serial) return 'serialMissing'
  return null
}

const TRANSPORT_KEY = 'metka.printerTransport'

export function rememberedTransport(): 'bluetooth' | 'serial' | null {
  try {
    const value = localStorage.getItem(TRANSPORT_KEY)
    return value === 'bluetooth' || value === 'serial' ? value : null
  } catch {
    return null
  }
}

export function rememberTransport(transport: 'bluetooth' | 'serial') {
  try {
    localStorage.setItem(TRANSPORT_KEY, transport)
  } catch {
    /* private mode */
  }
}

/** Bluetooth first, unless the last successful link was USB and that port is still granted. */
export function reconnectTransports(input: {
  bluetooth: number
  serial: number
  last: 'bluetooth' | 'serial' | null
}): ('bluetooth' | 'serial')[] {
  const order: ('bluetooth' | 'serial')[] = []
  const has = (transport: 'bluetooth' | 'serial') => (transport === 'bluetooth' ? input.bluetooth > 0 : input.serial > 0)
  if (input.last && has(input.last)) order.push(input.last)
  if (has('bluetooth') && !order.includes('bluetooth')) order.push('bluetooth')
  if (has('serial') && !order.includes('serial')) order.push('serial')
  return order
}

/** One granted radio. Prefer a name that looks like a Niimbot; otherwise the only device, or the first. */
export function pickGrantedBluetooth<T extends { name?: string }>(devices: T[]): T | null {
  if (devices.length === 0) return null
  const ranked = [...devices].sort((a, b) => deviceScore(b.name) - deviceScore(a.name))
  return ranked[0] ?? null
}

function deviceScore(name: string | undefined): number {
  if (!name) return 0
  if (/niim|b21|b1|d11|d110|b18/i.test(name)) return 2
  if (/^[A-Za-z]/.test(name)) return 1
  return 0
}

type GrantedBluetooth = { name?: string }
type GrantedSerial = object

export async function listGrantedBluetooth(): Promise<GrantedBluetooth[]> {
  const bluetooth = (navigator as { bluetooth?: { getDevices?: () => Promise<GrantedBluetooth[]> } }).bluetooth
  if (!bluetooth?.getDevices) return []
  try {
    return await bluetooth.getDevices()
  } catch {
    return []
  }
}

export async function listGrantedSerial(): Promise<GrantedSerial[]> {
  const serial = (navigator as { serial?: { getPorts?: () => Promise<GrantedSerial[]> } }).serial
  if (!serial?.getPorts) return []
  try {
    return await serial.getPorts()
  } catch {
    return []
  }
}

export function connectFailureCode(error: unknown, transport: 'bluetooth' | 'serial'): string {
  const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : ''
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (name === 'NotFoundError' || name === 'AbortError') return 'cancelled'
  if (name === 'SecurityError' || /secure context|secure origin/i.test(message)) return 'insecure'
  if (name === 'NetworkError' || /disconnect|gatt|connection (lost|closed)/i.test(message)) return 'linkLost'
  if (name === 'NotSupportedError' || /requestDevice|bluetooth|serial/i.test(message)) {
    return transport === 'serial' ? 'serialMissing' : 'bluetoothMissing'
  }
  return message || 'printFail'
}
