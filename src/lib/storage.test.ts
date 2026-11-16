import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { importErrorKey, storageErrorCode } from './errors'
import { saveTemplate, listTemplates, deleteTemplate, writeAutosave, readAutosave, saveDesign, listDesigns } from './storage'
import type { LabelDocument, TemplateRecord } from '../types'

const doc = (): LabelDocument => ({
  version: 1,
  name: 'Камера',
  widthMm: 40,
  heightMm: 12,
  dpi: 203,
  model: 'D110',
  direction: 'left',
  labelType: 1,
  density: 2,
  quantity: 1,
  align: 'center',
  task: 'D110',
  taskAuto: true,
  preview: { mode: 'floyd', threshold: 168, invert: false },
  canvas: { objects: [] },
})

const record = (id: string, name: string): TemplateRecord => ({
  id,
  name,
  createdAt: 1,
  updatedAt: 2,
  thumbnail: '',
  doc: { ...doc(), name },
})

afterEach(async () => {
  const databases = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : []
  await Promise.all(databases.map((item) => item.name && indexedDB.deleteDatabase(item.name)))
})

describe('indexedDB library', () => {
  it('saves, renames, and deletes a template without losing the other one', async () => {
    await saveTemplate(record('a', 'Камера'))
    await saveTemplate(record('b', 'Кабель'))
    await saveTemplate({ ...record('a', 'Камера 2'), updatedAt: 3, doc: { ...doc(), name: 'Камера 2' } })
    const names = (await listTemplates()).map((item) => item.name)
    expect(names).toContain('Камера 2')
    expect(names).toContain('Кабель')
    await deleteTemplate('b')
    expect((await listTemplates()).map((item) => item.id)).toEqual(['a'])
  })

  it('restores a dirty autosave and drops a corrupt one', async () => {
    await writeAutosave(doc(), 'design-1', true)
    const saved = await readAutosave()
    expect(saved?.designId).toBe('design-1')
    expect(saved?.dirty).toBe(true)
    expect(saved?.doc.name).toBe('Камера')
    await writeAutosave({ ...doc(), preview: { mode: 'threshold', threshold: 10, invert: true } }, null, false)
    expect((await readAutosave())?.doc.preview.mode).toBe('threshold')

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('metka', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite')
      tx.objectStore('kv').put({ key: 'autosave', value: { doc: { name: 5 }, designId: 'x', dirty: true } })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
    expect(await readAutosave()).toBeNull()
  })

  it('keeps a named design separate from templates', async () => {
    await saveDesign({ id: 'd', name: 'Макет', updatedAt: 4, thumbnail: '', doc: doc() })
    expect((await listDesigns())[0]?.name).toBe('Макет')
    expect(await listTemplates()).toEqual([])
  })

  it('turns a quota failure into a message key', () => {
    expect(storageErrorCode({ name: 'QuotaExceededError', message: '' })).toBe('quota')
    expect(importErrorKey({ name: 'QuotaExceededError', message: '' })).toBe('quota')
    expect(importErrorKey(new Error('importPhoto'))).toBe('importPhoto')
    expect(importErrorKey(new Error('nope'))).toBe('importFail')
  })
})
