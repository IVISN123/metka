import { FONTS } from './presets'
import { deleteStoredFont, listStoredFonts, saveStoredFont, type StoredFont } from './storage'
import { uid } from './units'

export type FontChoice = { id: string; label: string; family: string; uploaded?: boolean }

const faces = new Map<string, FontFace>()
let uploaded: FontChoice[] = []
let choices: FontChoice[] = FONTS.map((font) => ({ ...font }))
const listeners = new Set<() => void>()

function publish() {
  choices = [...FONTS.map((font) => ({ ...font })), ...uploaded]
  for (const listener of listeners) listener()
}

export function subscribeFonts(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function fontChoices(): FontChoice[] {
  return choices
}

export function isUploadedFamily(family: string) {
  return uploaded.some((font) => font.family === family)
}

async function register(font: StoredFont) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return
  const face = new FontFace(font.family, font.data)
  await face.load()
  document.fonts.add(face)
  const previous = faces.get(font.id)
  if (previous) document.fonts.delete(previous)
  faces.set(font.id, face)
}

export async function ensureFontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return
  try {
    await document.fonts.load('16px "IBM Plex Mono"')
    await document.fonts.load('16px "JetBrains Mono"')
  } catch {
    /* the file is still declared in CSS */
  }
  if (uploaded.length > 0) return
  try {
    const stored = await listStoredFonts()
    for (const font of stored) {
      try {
        await register(font)
      } catch {
        /* skip a broken file */
      }
    }
    uploaded = stored.map((font) => ({ id: font.id, label: font.label, family: font.family, uploaded: true }))
    publish()
  } catch {
    /* indexedDB unavailable */
  }
}

export async function addUserFont(file: File): Promise<FontChoice> {
  if (file.size > 4 * 1024 * 1024) throw new Error('tooBig')
  const label = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').trim() || 'Font'
  const id = uid()
  const family = `Metka ${label} ${id.slice(0, 8)}`
  const data = await file.arrayBuffer()
  const record: StoredFont = { id, label, family, data }
  await register(record)
  await saveStoredFont(record)
  const choice = { id, label, family, uploaded: true }
  uploaded = [...uploaded, choice]
  publish()
  return choice
}

export async function removeUserFont(id: string) {
  const face = faces.get(id)
  if (face && typeof document !== 'undefined') document.fonts.delete(face)
  faces.delete(id)
  await deleteStoredFont(id).catch(() => undefined)
  uploaded = uploaded.filter((font) => font.id !== id)
  publish()
}
