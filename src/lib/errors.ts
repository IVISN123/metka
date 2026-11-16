const IMPORT_KEYS = ['importFail', 'importTooLarge', 'importVersion', 'importSize', 'importPhoto', 'quota'] as const
export type ImportErrorKey = (typeof IMPORT_KEYS)[number]

export function storageErrorCode(error: unknown): 'quota' | 'storage' {
  const name = errorName(error)
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (name === 'QuotaExceededError' || /quota/i.test(message) || /quota/i.test(name)) return 'quota'
  return 'storage'
}

export function importErrorKey(error: unknown): ImportErrorKey {
  if (storageErrorCode(error) === 'quota') return 'quota'
  const message = error instanceof Error ? error.message : ''
  if (message === 'importTooLarge' || message === 'importVersion' || message === 'importSize' || message === 'importPhoto') return message
  return 'importFail'
}

let storageNoted = false

export function noteStorageError(error: unknown, notify: (code: 'quota' | 'storage') => void) {
  if (storageNoted) return
  storageNoted = true
  notify(storageErrorCode(error))
}

export function resetStorageNote() {
  storageNoted = false
}

function errorName(error: unknown): string {
  if (!error || typeof error !== 'object' || !('name' in error)) return ''
  return String((error as { name: unknown }).name)
}
