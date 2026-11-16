import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  Copy,
  GripVertical,
  Group as GroupIcon,
  Ungroup,
  ChevronRight,
  Barcode,
  Bold,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Circle,
  Clock,
  Eye,
  EyeOff,
  Hash,
  Image as ImageIcon,
  Italic,
  Lock,
  Minus,
  QrCode,
  Sparkles,
  Square,
  Trash2,
  Type,
  Underline,
  Unlock,
} from 'lucide-react'
import { engine } from '../engine/editor'
import { describeEncoded } from '../lib/encode'
import { FontPicker } from './FontPicker'
import { IconLibrary } from './IconLibrary'
import { addUserFont, fontChoices, isUploadedFamily, removeUserFont, subscribeFonts } from '../lib/fonts'
import { BARCODE_FORMATS, DATE_FORMATS, metaFor } from '../lib/presets'
import { LabelCodeError } from '../lib/codes'
import { renderDocumentThermal } from '../lib/render'
import { modelLabel } from '../lib/units'
import type { I18nKey } from '../i18n'
import type { LayerInfo, ObjectKind } from '../types'
import { toast } from '../toast'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { Button, CheckRow, Field, IconButton, ScrubField, SelectInput, Slider, TextInput } from './ui'

const KIND_ICON: Record<ObjectKind, typeof Type> = {
  text: Type,
  image: ImageIcon,
  icon: Sparkles,
  shape: Square,
  barcode: Barcode,
  qr: QrCode,
  datetime: Clock,
  number: Hash,
  paper: Square,
  group: GroupIcon,
}

export function ToolPanel({ onPicked }: { onPicked?: () => void }) {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [iconsOpen, setIconsOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const picked = () => onPicked?.()
  const tools: { key: I18nKey; icon: typeof Type; run: () => void }[] = [
    { key: 'text', icon: Type, run: () => { engine.addText(); picked() } },
    { key: 'pageNumber', icon: Hash, run: () => { engine.addNumber(); picked() } },
    { key: 'photo', icon: ImageIcon, run: () => fileRef.current?.click() },
    { key: 'icons', icon: Sparkles, run: () => setIconsOpen(true) },
    { key: 'shapes', icon: Square, run: () => setShapesOpen((open) => !open) },
    { key: 'line', icon: Minus, run: () => { engine.addLine(); picked() } },
    { key: 'barcode', icon: Barcode, run: () => void engine.addBarcode().then(picked).catch((error: unknown) => toast(String(error))) },
    { key: 'qr', icon: QrCode, run: () => void engine.addQr().then(picked) },
    { key: 'datetime', icon: Clock, run: () => { engine.addDatetime(); picked() } },
  ]
  return (
    <div className="border-b border-[var(--border)] p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('add')}</div>
      <div className="grid grid-cols-4 gap-1">
        {tools.map((tool) => (
          <button
            key={tool.key}
            type="button"
            onClick={tool.run}
            className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[var(--text)] hover:bg-[var(--hover)]"
          >
            <tool.icon size={26} strokeWidth={2.4} />
            <span className="text-xs font-bold text-[var(--text)]">{t(tool.key)}</span>
          </button>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void engine.addImageFile(file).then(() => onPicked?.())
          event.target.value = ''
        }}
      />
      {iconsOpen && (
        <IconLibrary
          onClose={() => setIconsOpen(false)}
          onPick={(id) => {
            void engine.addIcon(id).then(() => onPicked?.())
          }}
        />
      )}
      {shapesOpen && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          <ShapeButton label={t('rect')} onClick={() => { engine.addShape('rect'); onPicked?.() }} icon={<Square size={16} />} />
          <ShapeButton label={t('round')} onClick={() => { engine.addShape('round'); onPicked?.() }} icon={<Square size={16} />} />
          <ShapeButton label={t('ellipse')} onClick={() => { engine.addShape('ellipse'); onPicked?.() }} icon={<Circle size={16} />} />
          <ShapeButton label={t('triangle')} onClick={() => { engine.addShape('triangle'); onPicked?.() }} icon={<span className="text-sm">△</span>} />
        </div>
      )}
    </div>
  )
}

function ShapeButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-[var(--hover)]">
      {icon}
      {label}
    </button>
  )
}

export function LayerList() {
  const { state } = useEngine()
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ id: string; place: 'before' | 'after' | 'into' } | null>(null)
  const reduced = useReducedMotion()
  const listRef = useRef<HTMLUListElement>(null)
  const tops = useRef(new Map<string, number>())
  const visible = state.layers.filter((layer) => {
    let parent = layer.parentId
    while (parent) {
      if (collapsed[parent]) return false
      parent = state.layers.find((item) => item.id === parent)?.parentId ?? null
    }
    return true
  })
  const signature = visible.map((layer) => layer.id).join('|')
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    for (const node of list.querySelectorAll<HTMLElement>('[data-layer-id]')) {
      const id = node.dataset.layerId
      if (!id) continue
      const next = node.getBoundingClientRect().top
      const prev = tops.current.get(id)
      if (prev !== undefined && Math.abs(prev - next) > 1 && !reduced) {
        node.animate([{ transform: `translateY(${prev - next}px)` }, { transform: 'translateY(0)' }], {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        })
      }
      tops.current.set(id, next)
    }
  }, [signature, reduced])
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('layers')}</div>
      {visible.length === 0 && <p className="text-sm text-[var(--muted)]">{t('emptyLayers')}</p>}
      <ul ref={listRef} className="flex flex-col">
        {visible.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            active={state.selectedIds.includes(layer.id)}
            nested={state.layers.some((item) => item.parentId === layer.id)}
            collapsed={!!collapsed[layer.id]}
            editing={editing === layer.id}
            drop={drop?.id === layer.id ? drop.place : null}
            onToggle={() => setCollapsed((current) => ({ ...current, [layer.id]: !current[layer.id] }))}
            onEdit={() => setEditing(layer.id)}
            onEditDone={() => setEditing(null)}
            onGripDown={(event) => startLayerDrag(event, layer.id, setDrop)}
          />
        ))}
      </ul>
    </div>
  )
}

function startLayerDrag(
  event: ReactPointerEvent<HTMLButtonElement>,
  id: string,
  setDrop: (drop: { id: string; place: 'before' | 'after' | 'into' } | null) => void,
) {
  event.preventDefault()
  event.stopPropagation()
  const pointer = event.pointerId
  event.currentTarget.setPointerCapture(pointer)
  let moved = false
  const move = (ev: PointerEvent) => {
    if (!moved && Math.abs(ev.clientY - event.clientY) < 4) return
    moved = true
    const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-layer-id]')
    const over = hit?.dataset.layerId
    if (!hit || !over || over === id) {
      setDrop(null)
      return
    }
    const rect = hit.getBoundingClientRect()
    const ratio = rect.height > 0 ? (ev.clientY - rect.top) / rect.height : 0.5
    const into = hit.dataset.kind === 'group' && ratio > 0.28 && ratio < 0.72
    setDrop({ id: over, place: into ? 'into' : ratio < 0.5 ? 'before' : 'after' })
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (event.currentTarget.hasPointerCapture?.(pointer)) event.currentTarget.releasePointerCapture(pointer)
    setDrop(null)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  const commit = (ev: PointerEvent) => {
    window.removeEventListener('pointerup', commit)
    if (!moved) return
    const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-layer-id]')
    const over = hit?.dataset.layerId
    if (!hit || !over || over === id) return
    const rect = hit.getBoundingClientRect()
    const ratio = rect.height > 0 ? (ev.clientY - rect.top) / rect.height : 0.5
    const place = hit.dataset.kind === 'group' && ratio > 0.28 && ratio < 0.72 ? 'into' : ratio < 0.5 ? 'before' : 'after'
    engine.moveLayer(id, over, place)
  }
  window.addEventListener('pointerup', commit)
}

function LayerRow({
  layer,
  active,
  nested,
  collapsed,
  editing,
  drop,
  onToggle,
  onEdit,
  onEditDone,
  onGripDown,
}: {
  layer: LayerInfo
  active: boolean
  nested: boolean
  collapsed: boolean
  editing: boolean
  drop: 'before' | 'after' | 'into' | null
  onToggle: () => void
  onEdit: () => void
  onEditDone: () => void
  onGripDown: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const { t } = useI18n()
  const Icon = KIND_ICON[layer.kind]
  const edge = drop === 'before' ? 'shadow-[inset_0_2px_0_var(--accent)]' : drop === 'after' ? 'shadow-[inset_0_-2px_0_var(--accent)]' : ''
  return (
    <li
      data-layer-id={layer.id}
      data-kind={layer.kind}
      className={`layer-row flex items-center gap-0.5 rounded-xl pr-1 ${edge} ${drop === 'into' ? 'bg-[var(--accent)]/15' : active ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'}`}
      style={{ paddingLeft: 4 + layer.depth * 14 }}
    >
      {nested ? (
        <button type="button" aria-label={collapsed ? t('expandGroup') : t('collapseGroup')} className="grid h-11 w-6 shrink-0 place-items-center text-[var(--muted)]" onClick={onToggle}>
          <ChevronRight size={14} className={`transition-transform ${collapsed ? '' : 'rotate-90'}`} />
        </button>
      ) : (
        <span className="w-6 shrink-0" />
      )}
      <button
        type="button"
        aria-label={t('reorder')}
        title={t('reorder')}
        className="grid h-11 w-7 shrink-0 cursor-grab place-items-center text-[var(--icon)] active:cursor-grabbing"
        onPointerDown={onGripDown}
      >
        <GripVertical size={16} />
      </button>
      {editing ? (
        <input
          autoFocus
          aria-label={t('layerRename')}
          defaultValue={layer.name}
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--accent)] bg-transparent px-2 text-sm outline-none"
          onBlur={(event) => {
            const name = event.target.value.trim()
            if (name && name !== layer.name) engine.renameLayer(layer.id, name)
            onEditDone()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') onEditDone()
          }}
        />
      ) : (
        <button
          type="button"
          onClick={(event) => engine.select(layer.id, event.shiftKey)}
          onDoubleClick={onEdit}
          className={`flex h-11 min-w-0 flex-1 items-center gap-2 text-left text-sm ${layer.visible ? 'text-[var(--text)]' : 'text-[var(--muted)]'}`}
        >
          <Icon size={16} className="shrink-0 text-[var(--icon)]" />
          <span className="truncate">{layer.name}</span>
        </button>
      )}
      <IconButton label={layer.visible ? t('hide') : t('show')} onClick={() => engine.toggleVisible(layer.id)}>
        {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
      </IconButton>
      <IconButton label={layer.locked ? t('unlock') : t('lock')} onClick={() => engine.toggleLock(layer.id)}>
        {layer.locked ? <Lock size={15} /> : <Unlock size={15} />}
      </IconButton>
    </li>
  )
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  return reduced
}

export function Inspector() {
  const { state } = useEngine()
  const { t } = useI18n()
  const fonts = useSyncExternalStore(subscribeFonts, fontChoices, fontChoices)
  const selected = state.selected
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex flex-col gap-3 p-4">
        {!selected && state.multi === 0 && <p className="text-sm text-[var(--muted)]">{t('noSelection')}</p>}
        {state.multi > 1 && <p className="text-sm">{t('multi', { n: state.multi })}</p>}
        {(selected || state.multi > 0) && (
          <div className="flex flex-wrap gap-1">
            <IconButton label={t('alignLeft')} onClick={() => engine.align('left')}><AlignLeft size={18} /></IconButton>
            <IconButton label={t('alignHCenter')} onClick={() => engine.align('center')}><AlignCenter size={18} /></IconButton>
            <IconButton label={t('alignRight')} onClick={() => engine.align('right')}><AlignRight size={18} /></IconButton>
            <IconButton label={t('alignTop')} onClick={() => engine.align('top')}><AlignStartVertical size={18} /></IconButton>
            <IconButton label={t('alignMiddle')} onClick={() => engine.align('middle')}><AlignCenterVertical size={18} /></IconButton>
            <IconButton label={t('alignBottom')} onClick={() => engine.align('bottom')}><AlignEndVertical size={18} /></IconButton>
            <IconButton label={t('duplicate')} onClick={() => void engine.duplicate()}><Copy size={18} /></IconButton>
            <IconButton label={t('group')} disabled={state.multi < 2} onClick={() => engine.groupSelected()}><GroupIcon size={18} /></IconButton>
            <IconButton label={t('ungroup')} disabled={selected?.kind !== 'group'} onClick={() => engine.ungroupSelected()}><Ungroup size={18} /></IconButton>
            <IconButton label={t('distributeH')} disabled={state.multi < 3} onClick={() => engine.distribute('x')}><AlignHorizontalSpaceAround size={18} /></IconButton>
            <IconButton label={t('distributeV')} disabled={state.multi < 3} onClick={() => engine.distribute('y')}><AlignVerticalSpaceAround size={18} /></IconButton>
            <IconButton label={t('deleteObj')} onClick={() => engine.deleteSelected()}><Trash2 size={16} /></IconButton>
          </div>
        )}
        {selected && (
          <>
            <Field label={t('name')}>
              <TextInput value={selected.name} onChange={(event) => void engine.updateSelected({ name: event.target.value })} />
            </Field>
            {selected.frame && (
              <div className="grid grid-cols-2 gap-1.5">
                <ScrubField label="X" value={selected.frame.x} min={-40} max={240} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(xMm) => engine.setFrame({ xMm })} />
                <ScrubField label="Y" value={selected.frame.y} min={-40} max={240} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(yMm) => engine.setFrame({ yMm })} />
                <ScrubField label="W" value={selected.frame.w} min={0.2} max={240} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(wMm) => engine.setFrame({ wMm })} />
                <ScrubField label="H" value={selected.frame.h} min={0.2} max={240} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(hMm) => engine.setFrame({ hMm })} />
                <ScrubField label="°" value={selected.angle} min={-180} max={180} step={1} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(angle) => void engine.updateSelected({ angle })} />
              </div>
            )}
            {selected.frame && <p className="text-[11px] leading-4 text-[var(--muted)]">{t('transformHint')}</p>}
            {state.scaleTool && (selected.kind === 'text' || selected.kind === 'datetime' || selected.kind === 'number') && (
              <p className="rounded-xl bg-[var(--hover)] px-3 py-2 text-xs font-medium">{t('scaleToolOn')}</p>
            )}
            {(selected.kind === 'text' || selected.kind === 'datetime' || selected.kind === 'number') && (
              <>
                <Field label={t('font')}>
                  <FontPicker value={selected.fontFamily ?? ''} onChange={(fontFamily) => void engine.updateSelected({ fontFamily })} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--hover)]">
                      {t('uploadFont')}
                      <input
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0]
                          event.target.value = ''
                          if (!file) return
                          void addUserFont(file)
                            .then((font) => engine.updateSelected({ fontFamily: font.family }))
                            .catch((error: unknown) => toast(error instanceof Error && error.message === 'tooBig' ? t('fontTooBig') : t('fontFail')))
                        }}
                      />
                    </label>
                    {selected.fontFamily && isUploadedFamily(selected.fontFamily) && (
                      <Button
                        onClick={() => {
                          const font = fonts.find((item) => item.family === selected.fontFamily)
                          if (!font) return
                          void removeUserFont(font.id).then(() => engine.updateSelected({ fontFamily: '"IBM Plex Mono", ui-monospace, monospace' }))
                        }}
                      >
                        {t('removeFont')}
                      </Button>
                    )}
                  </div>
                  <span className="mt-1 block text-xs text-[var(--muted)]">{t('fontHint')}</span>
                </Field>
                {selected.kind === 'number' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <Field label={t('prefix')}>
                      <TextInput value={selected.prefix ?? ''} onChange={(event) => void engine.updateSelected({ prefix: event.target.value })} />
                    </Field>
                    <Field label={t('numberSuffix')}>
                      <TextInput value={selected.suffix ?? ''} onChange={(event) => void engine.updateSelected({ suffix: event.target.value })} />
                    </Field>
                    <Field label={t('pad')}>
                      <TextInput type="number" min={0} max={6} value={selected.pad ?? 0} onChange={(event) => void engine.updateSelected({ pad: Number(event.target.value) })} />
                    </Field>
                  </div>
                ) : (
                  <Field label={t('text')}>
                    <textarea
                      value={selected.text ?? ''}
                      onChange={(event) => void engine.updateSelected({ text: event.target.value })}
                      rows={3}
                      className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[15px] outline-none focus:border-[var(--accent)]"
                    />
                  </Field>
                )}
                <div className="grid grid-cols-3 gap-1">
                  {([
                    ['auto', t('textAuto')],
                    ['auto-height', t('textAutoHeight')],
                    ['fixed', t('textFixed')],
                  ] as const).map(([mode, label]) => (
                    <Button key={mode} className="px-2 text-xs" variant={(selected.textMode ?? 'auto-height') === mode ? 'accent' : 'ghost'} onClick={() => void engine.updateSelected({ textMode: mode })}>
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <ScrubField label={t('fontSizeShort')} value={selected.fontSize ?? 16} min={4} max={400} step={1} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(fontSize) => void engine.updateSelected({ fontSize })} />
                  <ScrubField label={t('lineHeightShort')} value={Math.round((selected.lineHeight ?? 1.16) * 100) / 100} min={0.5} max={3} step={0.05} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(lineHeight) => void engine.updateSelected({ lineHeight })} />
                  <ScrubField label={t('letterShort')} value={selected.charSpacing ?? 0} min={-200} max={800} step={10} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} onChange={(charSpacing) => void engine.updateSelected({ charSpacing })} />
                </div>
                <div className="flex gap-1">
                  <Toggle on={String(selected.fontWeight) === '700' || selected.fontWeight === 'bold'} label={t('bold')} onClick={() => void engine.updateSelected({ fontWeight: String(selected.fontWeight) === '700' ? '400' : '700' })}>
                    <Bold size={16} />
                  </Toggle>
                  <Toggle on={selected.fontStyle === 'italic'} label={t('italic')} onClick={() => void engine.updateSelected({ fontStyle: selected.fontStyle === 'italic' ? 'normal' : 'italic' })}>
                    <Italic size={16} />
                  </Toggle>
                  <Toggle on={!!selected.underline} label={t('underline')} onClick={() => void engine.updateSelected({ underline: !selected.underline })}>
                    <Underline size={16} />
                  </Toggle>
                  {selected.kind !== 'number' && (
                    <Toggle on={!!selected.vertical} label={t('vertical')} onClick={() => void engine.updateSelected({ vertical: !selected.vertical })}>
                      <Type size={16} className="rotate-90" />
                    </Toggle>
                  )}
                </div>
                <div className="flex gap-1">
                  {([
                    ['left', t('textAlignLeft'), AlignLeft],
                    ['center', t('textAlignCenter'), AlignCenter],
                    ['right', t('textAlignRight'), AlignRight],
                  ] as const).map(([align, label, Icon]) => (
                    <Button key={align} aria-label={label} title={label} className="flex-1 px-0" variant={selected.textAlign === align ? 'accent' : 'ghost'} onClick={() => void engine.updateSelected({ textAlign: align })}>
                      <Icon size={18} />
                    </Button>
                  ))}
                </div>
              </>
            )}
            {selected.kind === 'datetime' && (
              <>
                <Field label={t('dateFormat')}>
                  <SelectInput value={selected.dateFormat} onChange={(event) => void engine.updateSelected({ dateFormat: event.target.value })}>
                    {DATE_FORMATS.map((format) => (
                      <option key={format}>{format}</option>
                    ))}
                  </SelectInput>
                </Field>
                <CheckRow checked={selected.live !== false} onChange={(live) => void engine.updateSelected({ live })}>
                  {t('liveDate')}
                </CheckRow>
                <Button onClick={() => engine.refreshDates()}>{t('refresh')}</Button>
              </>
            )}
            {selected.kind === 'image' && (
              <>
                <Field label={t('brightness')}>
                  <HistorySlider label={t('brightness')} min={-100} max={100} value={Math.round((selected.brightness ?? 0) * 100)} onChange={(value) => void engine.updateSelected({ brightness: value / 100 })} />
                </Field>
                <Field label={t('contrast')}>
                  <HistorySlider label={t('contrast')} min={-100} max={100} value={Math.round((selected.contrast ?? 0) * 100)} onChange={(value) => void engine.updateSelected({ contrast: value / 100 })} />
                </Field>
                <CheckRow checked={!!selected.invert} onChange={(invert) => void engine.updateSelected({ invert })}>
                  {t('invert')}
                </CheckRow>
                <Field label={t('dither')}>
                  <SelectInput value={selected.dither ?? 'inherit'} onChange={(event) => void engine.updateSelected({ dither: event.target.value as 'inherit' })}>
                    <option value="inherit">{t('ditherInherit')}</option>
                    <option value="threshold">{t('ditherThreshold')}</option>
                    <option value="floyd">{t('ditherFloyd')}</option>
                    <option value="atkinson">{t('ditherAtkinson')}</option>
                  </SelectInput>
                </Field>
              </>
            )}
            {(selected.kind === 'qr' || selected.kind === 'barcode') && (
              <Field label={t('value')}>
                <TextInput
                  value={selected.value ?? ''}
                  onChange={(event) =>
                    void engine.updateSelected({ value: event.target.value }).catch(() => toast(t('barcodeError')))
                  }
                />
              </Field>
            )}
            {selected.kind === 'barcode' && (
              <>
                <Field label={t('format')}>
                  <SelectInput
                    value={selected.symbology}
                    onChange={(event) => void engine.updateSelected({ symbology: event.target.value }).catch(() => toast(t('barcodeError')))}
                  >
                    {BARCODE_FORMATS.map((format) => (
                      <option key={format}>{format}</option>
                    ))}
                  </SelectInput>
                </Field>
                <CheckRow checked={selected.showText !== false} onChange={(showText) => void engine.updateSelected({ showText }).catch(() => toast(t('barcodeError')))}>
                  {t('showText')}
                </CheckRow>
              </>
            )}
            {selected.kind === 'qr' && (
              <Field label={t('ecl')}>
                <SelectInput value={selected.ecl ?? 'M'} onChange={(event) => void engine.updateSelected({ ecl: event.target.value as 'M' })}>
                  {['L', 'M', 'Q', 'H'].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </SelectInput>
              </Field>
            )}
            {(selected.kind === 'shape' || selected.kind === 'text' || selected.kind === 'icon') && (
              <>
                <Swatches label={t('fill')} value={selected.fill} onChange={(fill) => void engine.updateSelected({ fill })} />
                <Swatches label={t('stroke')} value={selected.stroke} onChange={(stroke) => void engine.updateSelected({ stroke })} />
                <ScrubField
                  label={t('strokeShort')}
                  value={pxMm(selected.strokeWidth, state.dpi)}
                  min={0}
                  max={4}
                  step={0.05}
                  onGestureStart={() => engine.beginGesture()}
                  onGestureEnd={() => engine.endGesture()}
                  onChange={(mm) => void engine.updateSelected({ strokeWidth: (mm * state.dpi) / 25.4 })}
                />
                <div className="grid grid-cols-3 gap-1">
                  {([
                    ['center', t('strokeCenter')],
                    ['inside', t('strokeInside')],
                    ['outside', t('strokeOutside')],
                  ] as const).map(([align, label]) => (
                    <Button key={align} className="px-2 text-xs" variant={(selected.strokeAlign ?? 'center') === align ? 'accent' : 'ghost'} onClick={() => void engine.updateSelected({ strokeAlign: align })}>
                      {label}
                    </Button>
                  ))}
                </div>
              </>
            )}
            {selected.rx !== undefined && (
              <ScrubField
                label={t('radiusShort')}
                value={pxMm(selected.rx, state.dpi)}
                min={0}
                max={8}
                step={0.1}
                onGestureStart={() => engine.beginGesture()}
                onGestureEnd={() => engine.endGesture()}
                onChange={(mm) => void engine.updateSelected({ rx: (mm * state.dpi) / 25.4 })}
              />
            )}
            <Field label={t('opacity')}>
              <HistorySlider
                label={t('opacity')}
                min={0}
                max={100}
                value={Math.round((selected.opacity ?? 1) * 100)}
                onChange={(value) => void engine.updateSelected({ opacity: value / 100 })}
              />
              <span className="mt-1 block text-xs text-[var(--muted)]">{t('opacityHint')}</span>
            </Field>
            <div>
              <div className="mb-1 text-xs text-[var(--muted)]">{t('order')}</div>
              <div className="flex gap-1">
                <IconButton label={t('forward')} onClick={() => engine.order('forward')}><ChevronUp size={16} /></IconButton>
                <IconButton label={t('backward')} onClick={() => engine.order('backward')}><ChevronDown size={16} /></IconButton>
                <IconButton label={t('front')} onClick={() => engine.order('front')}><ChevronsUp size={16} /></IconButton>
                <IconButton label={t('back')} onClick={() => engine.order('back')}><ChevronsDown size={16} /></IconButton>
              </div>
            </div>
          </>
        )}
        <PreviewBlock />
      </div>
    </div>
  )
}

function pxMm(px: number, dpi: number) {
  if (!Number.isFinite(px) || !Number.isFinite(dpi) || dpi <= 0) return 0
  return Math.round(((px * 25.4) / dpi) * 100) / 100
}

function HistorySlider(props: ComponentProps<typeof Slider>) {
  return <Slider {...props} onGestureStart={() => engine.beginGesture()} onGestureEnd={() => engine.endGesture()} />
}

function Toggle({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} title={label} onClick={onClick} className={`grid h-11 w-11 place-items-center rounded-full border ${on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] hover:bg-[var(--hover)]'}`}>
      {children}
    </button>
  )
}

function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const { t } = useI18n()
  const items = [
    { id: '#000000', name: t('black'), className: 'bg-black' },
    { id: '#ffffff', name: t('white'), className: 'bg-white' },
    { id: 'transparent', name: t('none'), className: 'bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%)] bg-[length:8px_8px]' },
  ]
  return (
    <div>
      <div className="mb-1 text-xs text-[var(--muted)]">{label}</div>
      <div className="flex gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-label={item.name}
            aria-pressed={value === item.id}
            title={item.name}
            onClick={() => onChange(item.id)}
            className={`h-11 w-11 rounded-full border ${value === item.id ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border)]'} ${item.className}`}
          />
        ))}
      </div>
    </div>
  )
}

function PreviewBlock() {
  const { state } = useEngine()
  const { t } = useI18n()
  return <LivePreview rev={state.contentRev} ready={state.ready} label={t('preview')} hint={t('previewHint')} />
}

function LivePreview({ rev, ready, label, hint }: { rev: number; ready: boolean; label: string; hint: string }) {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [stats, setStats] = useState('')
  const [warn, setWarn] = useState('')
  useEffect(() => {
    if (!ready) return
    let cancel = false
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const doc = engine.toDocument()
          const thermal = await renderDocumentThermal(doc)
          if (cancel) return
          setUrl(thermal.toDataURL('image/png'))
          const info = describeEncoded(thermal, doc.direction)
          setStats(t('encodeStats', { cols: info.cols, rows: info.rows, black: info.black }))
          const meta = metaFor(doc.model)
          const axis = doc.direction === 'top' ? thermal.width : thermal.height
          setWarn(meta && axis > meta.printheadPixels ? t('printheadWarn', { model: modelLabel(doc.model), px: meta.printheadPixels }) : '')
        } catch (error) {
          if (cancel) return
          if (error instanceof LabelCodeError) setStats(t(error.kind === 'qr' ? 'qrError' : 'barcodeError'))
          else setStats(t('encodeFail', { error: error instanceof Error ? error.message : String(error) }))
        }
      })()
    }, 180)
    return () => {
      cancel = true
      window.clearTimeout(timer)
    }
  }, [rev, ready, t])
  return (
    <section className="mt-2 rounded-2xl border border-[var(--border)] p-3">
      <div className="mb-1 text-sm font-bold">{label}</div>
      <p className="mb-3 text-xs leading-5 text-[var(--muted)]">{hint}</p>
      <div className="rounded-xl bg-white p-2">
        {url ? <img src={url} alt="" className="pixelated mx-auto max-h-48 w-full object-contain" /> : <div className="h-16" />}
      </div>
      {stats && <p className="mt-2 text-xs text-[var(--muted)]">{stats}</p>}
      {warn && <p className="mt-1 text-xs text-[var(--danger)]">{warn}</p>}
    </section>
  )
}
