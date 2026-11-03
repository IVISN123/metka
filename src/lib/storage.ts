import type { DesignRecord, LabelDocument, TemplateRecord } from '../types'

const DB_NAME = 'metka'
const DB_VERSION = 2

type KvRow = { key: string; value: unknown }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('templates')) db.createObjectStore('templates', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('designs')) db.createObjectStore('designs', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexedDB'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexedDB'))
  })
}

async function withStore<T>(
  name: 'templates' | 'designs' | 'kv' | 'fonts',
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    const tx = db.transaction(name, mode)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('indexedDB'))
      tx.onabort = () => reject(tx.error ?? new Error('indexedDB'))
    })
    const value = await requestToPromise(run(tx.objectStore(name)))
    await done
    return value
  } finally {
    db.close()
  }
}

export async function listTemplates(): Promise<TemplateRecord[]> {
  const rows = await withStore('templates', 'readonly', (store) => store.getAll())
  return (rows as TemplateRecord[]).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveTemplate(record: TemplateRecord): Promise<void> {
  await withStore('templates', 'readwrite', (store) => store.put(record))
}

export async function deleteTemplate(id: string): Promise<void> {
  await withStore('templates', 'readwrite', (store) => store.delete(id))
}

export async function listDesigns(): Promise<DesignRecord[]> {
  const rows = await withStore('designs', 'readonly', (store) => store.getAll())
  return (rows as DesignRecord[]).sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function saveDesign(record: DesignRecord): Promise<void> {
  await withStore('designs', 'readwrite', (store) => store.put(record))
}

export async function deleteDesign(id: string): Promise<void> {
  await withStore('designs', 'readwrite', (store) => store.delete(id))
}

export async function writeAutosave(doc: LabelDocument, designId: string | null): Promise<void> {
  const row: KvRow = { key: 'autosave', value: { doc, designId, savedAt: Date.now() } }
  await withStore('kv', 'readwrite', (store) => store.put(row))
}

export async function readAutosave(): Promise<{ doc: LabelDocument; designId: string | null } | null> {
  const row = (await withStore('kv', 'readonly', (store) => store.get('autosave'))) as KvRow | undefined
  const value = row?.value as { doc?: LabelDocument; designId?: string | null } | undefined
  if (!value?.doc) return null
  return { doc: value.doc, designId: value.designId ?? null }
}

export type StoredFont = {
  id: string
  label: string
  family: string
  data: ArrayBuffer
}

export async function listStoredFonts(): Promise<StoredFont[]> {
  const rows = await withStore('fonts', 'readonly', (store) => store.getAll())
  return rows as StoredFont[]
}

export async function saveStoredFont(font: StoredFont): Promise<void> {
  await withStore('fonts', 'readwrite', (store) => store.put(font))
}

export async function deleteStoredFont(id: string): Promise<void> {
  await withStore('fonts', 'readwrite', (store) => store.delete(id))
}
