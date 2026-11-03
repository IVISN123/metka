import type { FabricObject } from 'fabric'
import type { Meta } from '../types'

export function readMeta(obj: FabricObject | null | undefined): Meta | undefined {
  if (!obj) return undefined
  const data = (obj as FabricObject & { data?: Meta }).data
  if (!data || typeof data !== 'object' || !data.kind) return undefined
  return data
}

export function writeMeta(obj: FabricObject, meta: Meta) {
  obj.set('data', meta)
}
