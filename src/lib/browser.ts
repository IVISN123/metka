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
