import './setup'
import { FabricImage, Group, StaticCanvas, Textbox, loadSVGFromString, type FabricObject } from 'fabric'
import type { LabelDocument } from '../types'
import { barcodeDataUrl, qrDataUrl } from '../lib/codes'
import { gimbalDataUrl } from '../lib/gimbal'
import { iconById } from '../lib/icons'
import { directionOf, suggestedTask } from '../lib/presets'
import { mmToPx, uid } from '../lib/units'

export type BuiltinSpec = {
  id: string
  name: { ru: string; en: string }
  widthMm: number
  heightMm: number
  model: string
}

export const BUILTINS: BuiltinSpec[] = [
  { id: 'drone-strip', name: { ru: 'Камера 12×40', en: 'Camera 12×40' }, widthMm: 40, heightMm: 12, model: 'D110' },
  { id: 'product-card', name: { ru: 'Карточка 50×30', en: 'Card 50×30' }, widthMm: 50, heightMm: 30, model: 'B21' },
  { id: 'cable-name', name: { ru: 'Кабель', en: 'Cable' }, widthMm: 40, heightMm: 12, model: 'D110' },
  { id: 'stock-qr', name: { ru: 'Склад 40×30', en: 'Stock 40×30' }, widthMm: 40, heightMm: 30, model: 'B1' },
  { id: 'blank', name: { ru: 'Пустая 40×30', en: 'Blank 40×30' }, widthMm: 40, heightMm: 30, model: 'B21' },
]

async function svgGroup(svg: string): Promise<Group | null> {
  const parsed = await loadSVGFromString(svg)
  const objects = parsed.objects.filter((object): object is FabricObject => object !== null)
  if (objects.length === 0) return null
  return new Group(objects, { subTargetCheck: false })
}

function baseDoc(spec: BuiltinSpec, canvas: Record<string, unknown>): LabelDocument {
  const suggestion = suggestedTask(spec.model)
  const meta = {
    version: 1 as const,
    name: spec.name.ru,
    widthMm: spec.widthMm,
    heightMm: spec.heightMm,
    dpi: spec.model === 'D11_H' || spec.model === 'B1_PRO' ? 300 : 203,
    model: spec.model,
    direction: directionOf(spec.model),
    labelType: 1,
    density: spec.model.startsWith('D11') || spec.model === 'D110' || spec.model.startsWith('B18') ? 2 : 3,
    quantity: 1,
    align: 'center' as const,
    task: suggestion.task,
    taskAuto: true,
    preview: { mode: 'floyd' as const, threshold: 168, invert: false },
    canvas,
  }
  return meta
}

async function draw(width: number, height: number, paint: (canvas: StaticCanvas) => Promise<void>) {
  const element = document.createElement('canvas')
  const canvas = new StaticCanvas(element, {
    width,
    height,
    backgroundColor: '#ffffff',
    enableRetinaScaling: false,
    renderOnAddRemove: false,
  })
  await paint(canvas)
  const json = canvas.toObject(['data']) as Record<string, unknown>
  canvas.dispose()
  return json
}

export async function buildBuiltin(id: string): Promise<LabelDocument> {
  const spec = BUILTINS.find((item) => item.id === id) ?? BUILTINS[0]
  if (!spec) throw new Error('builtin')
  const width = mmToPx(spec.widthMm, spec.model === 'D11_H' ? 300 : 203)
  const height = mmToPx(spec.heightMm, spec.model === 'D11_H' ? 300 : 203)
  const canvas = await draw(width, height, async (scene) => {
    if (spec.id === 'drone-strip') await paintStrip(scene, width, height)
    else if (spec.id === 'product-card') await paintCard(scene, width, height)
    else if (spec.id === 'cable-name') paintCable(scene, width, height)
    else if (spec.id === 'stock-qr') await paintStock(scene, width, height)
  })
  return baseDoc(spec, canvas)
}

async function paintStrip(scene: StaticCanvas, width: number, height: number) {
  const photo = await FabricImage.fromURL(gimbalDataUrl())
  const photoScale = Math.min((height * 0.86) / (photo.height || 1), (width * 0.22) / (photo.width || 1))
  photo.set({
    originX: 'center',
    originY: 'center',
    left: width * 0.14,
    top: height / 2,
    scaleX: photoScale,
    scaleY: photoScale,
    data: { id: uid(), kind: 'image', name: 'Фото', dither: 'floyd', brightness: 0, contrast: 0.05 },
  })
  scene.add(photo)
  await addLaurel(scene, width * 0.33, height / 2, height * 0.82, false)
  scene.add(
    new Textbox('01', {
      originX: 'center',
      originY: 'center',
      left: width * 0.52,
      top: height / 2,
      width: width * 0.22,
      fontSize: Math.round(height * 0.52),
      fontWeight: 700,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      textAlign: 'center',
      data: { id: uid(), kind: 'text', name: 'Номер', sourceText: '01', vertical: false },
    }),
  )
  await addLaurel(scene, width * 0.7, height / 2, height * 0.82, true)
  const qr = await FabricImage.fromURL(await qrDataUrl('SN-0001', 'M'))
  const qrScale = (height * 0.78) / (qr.height || 1)
  qr.set({
    originX: 'center',
    originY: 'center',
    left: width * 0.88,
    top: height / 2,
    scaleX: qrScale,
    scaleY: qrScale,
    data: { id: uid(), kind: 'qr', name: 'QR', value: 'SN-0001', ecl: 'M' },
  })
  scene.add(qr)
}

async function paintCard(scene: StaticCanvas, width: number, height: number) {
  const photo = await FabricImage.fromURL(gimbalDataUrl())
  const photoScale = Math.min((height * 0.86) / (photo.height || 1), (width * 0.42) / (photo.width || 1))
  photo.set({
    originX: 'center',
    originY: 'center',
    left: width * 0.22,
    top: height / 2,
    scaleX: photoScale,
    scaleY: photoScale,
    data: { id: uid(), kind: 'image', name: 'Фото', dither: 'atkinson', brightness: 0, contrast: 0.1 },
  })
  scene.add(photo)
  scene.add(
    new Textbox('01', {
      originX: 'left',
      originY: 'center',
      left: width * 0.46,
      top: height * 0.36,
      width: width * 0.28,
      fontSize: Math.round(height * 0.34),
      fontWeight: 700,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      data: { id: uid(), kind: 'text', name: 'Номер', sourceText: '01', vertical: false },
    }),
  )
  scene.add(
    new Textbox('GIMBAL', {
      originX: 'left',
      originY: 'center',
      left: width * 0.46,
      top: height * 0.62,
      width: width * 0.28,
      fontSize: Math.round(height * 0.12),
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      data: { id: uid(), kind: 'text', name: 'Название', sourceText: 'GIMBAL', vertical: false },
    }),
  )
  const qr = await FabricImage.fromURL(await qrDataUrl('SN-0001', 'M'))
  const qrScale = (height * 0.42) / (qr.height || 1)
  qr.set({
    originX: 'center',
    originY: 'center',
    left: width * 0.86,
    top: height / 2,
    scaleX: qrScale,
    scaleY: qrScale,
    data: { id: uid(), kind: 'qr', name: 'QR', value: 'SN-0001', ecl: 'M' },
  })
  scene.add(qr)
}

function paintCable(scene: StaticCanvas, width: number, height: number) {
  scene.add(
    new Textbox('CAM-A01', {
      originX: 'center',
      originY: 'center',
      left: width / 2,
      top: height / 2,
      width: width * 0.9,
      fontSize: Math.round(height * 0.42),
      fontWeight: 700,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      textAlign: 'center',
      data: { id: uid(), kind: 'text', name: 'Маркировка', sourceText: 'CAM-A01', vertical: false },
    }),
  )
}

async function paintStock(scene: StaticCanvas, width: number, height: number) {
  scene.add(
    new Textbox('Камера', {
      originX: 'left',
      originY: 'center',
      left: width * 0.06,
      top: height * 0.22,
      width: width * 0.55,
      fontSize: Math.round(height * 0.16),
      fontWeight: 700,
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      data: { id: uid(), kind: 'text', name: 'Название', sourceText: 'Камера', vertical: false },
    }),
  )
  const today = new Date()
  const stamp = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`
  scene.add(
    new Textbox(stamp, {
      originX: 'left',
      originY: 'center',
      left: width * 0.06,
      top: height * 0.42,
      width: width * 0.5,
      fontSize: Math.round(height * 0.1),
      fontFamily: 'Arial, Helvetica, sans-serif',
      fill: '#000000',
      data: { id: uid(), kind: 'datetime', name: 'Дата', sourceText: stamp, dateFormat: 'DD.MM.YYYY', live: true, vertical: false },
    }),
  )
  const code = barcodeDataUrl('SN-0001', 'CODE128', true)
  const barcode = await FabricImage.fromURL(code)
  const scale = Math.min((width * 0.55) / (barcode.width || 1), (height * 0.28) / (barcode.height || 1))
  barcode.set({
    originX: 'left',
    originY: 'center',
    left: width * 0.06,
    top: height * 0.72,
    scaleX: scale,
    scaleY: scale,
    data: { id: uid(), kind: 'barcode', name: 'Штрихкод', value: 'SN-0001', symbology: 'CODE128', showText: true },
  })
  scene.add(barcode)
  const qr = await FabricImage.fromURL(await qrDataUrl('SN-0001', 'M'))
  const qrScale = (height * 0.46) / (qr.height || 1)
  qr.set({
    originX: 'center',
    originY: 'center',
    left: width * 0.82,
    top: height * 0.55,
    scaleX: qrScale,
    scaleY: qrScale,
    data: { id: uid(), kind: 'qr', name: 'QR', value: 'SN-0001', ecl: 'M' },
  })
  scene.add(qr)
}

async function addLaurel(scene: StaticCanvas, left: number, top: number, target: number, flip: boolean) {
  const svg = iconById('laurel')?.svg
  if (!svg) return
  const group = await svgGroup(svg)
  if (!group) return
  const scale = target / Math.max(group.height || 1, 1)
  group.set({
    originX: 'center',
    originY: 'center',
    left,
    top,
    scaleX: scale,
    scaleY: scale,
    flipX: flip,
    data: { id: uid(), kind: 'icon', name: flip ? 'Ветка 2' : 'Ветка 1', iconId: 'laurel' },
  })
  scene.add(group)
}
