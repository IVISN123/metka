import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react'
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
import { DATE_FORMATS, metaFor } from '../lib/presets'
import { worstScan } from '../lib/vector-code'
import { CodeFields } from './CodeProps'
import { LabelCodeError } from '../lib/codes'
import { renderDocumentThermal } from '../lib/render'
import { modelLabel } from '../lib/units'
import type { I18nKey } from '../i18n'
import type { LayerInfo, ObjectKind } from '../types'
import { toast } from '../toast'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { Button, CheckRow, Field, IconButton, NumberField, SelectInput, Slider, TextInput } from './ui'

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
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('layers')}</div>
      {state.layers.length === 0 && <p className="text-sm text-[var(--muted)]">{t('emptyLayers')}</p>}
      <ul className="flex flex-col gap-1">
        {state.layers.map((layer) => (
          <LayerRow key={layer.id} layer={layer} active={layer.id === state.selectedId} />
        ))}
      </ul>
    </div>
  )
}

function LayerRow({ layer, active }: { layer: LayerInfo; active: boolean }) {
  const { t } = useI18n()
  const Icon = KIND_ICON[layer.kind]
  return (
    <li
      className={`flex items-center gap-1 rounded-2xl pr-1 ${active ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const id = event.dataTransfer.getData('text/plain')
        if (id) engine.moveLayer(id, layer.id)
      }}
    >
      <button
        type="button"
        draggable
        aria-label={t('reorder')}
        title={t('reorder')}
        className="grid h-11 w-8 shrink-0 cursor-grab place-items-center text-[var(--icon)]"
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', layer.id)
          event.dataTransfer.effectAllowed = 'move'
        }}
      >
        <GripVertical size={16} />
      </button>
      <button type="button" onClick={() => engine.select(layer.id)} className="flex min-w-0 flex-1 items-center gap-2 px-1 py-2 text-left text-sm text-[var(--text)]">
        <Icon size={16} className="shrink-0 text-[var(--icon)]" />
        <span className="truncate">{layer.name}</span>
      </button>
      <IconButton label={layer.visible ? t('hide') : t('show')} onClick={() => engine.toggleVisible(layer.id)}>
        {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
      </IconButton>
      <IconButton label={layer.locked ? t('unlock') : t('lock')} onClick={() => engine.toggleLock(layer.id)}>
        {layer.locked ? <Lock size={15} /> : <Unlock size={15} />}
      </IconButton>
    </li>
  )
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
              <div className="grid grid-cols-2 gap-2">
                <Field label={t('posX')}>
                  <NumberField label={t('posX')} value={selected.frame.x} min={-20} max={200} onCommit={(xMm) => engine.setFrame({ xMm })} />
                </Field>
                <Field label={t('posY')}>
                  <NumberField label={t('posY')} value={selected.frame.y} min={-20} max={200} onCommit={(yMm) => engine.setFrame({ yMm })} />
                </Field>
                <Field label={t('posW')}>
                  <NumberField label={t('posW')} value={selected.frame.w} min={0.2} max={200} onCommit={(wMm) => engine.setFrame({ wMm })} />
                </Field>
                <Field label={t('posH')}>
                  <NumberField label={t('posH')} value={selected.frame.h} min={0.2} max={200} onCommit={(hMm) => engine.setFrame({ hMm })} />
                </Field>
              </div>
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
                <Field label={t('fontSize')}>
                  <HistorySlider label={t('fontSize')} min={8} max={160} value={selected.fontSize ?? 16} onChange={(value) => void engine.updateSelected({ fontSize: value })} />
                </Field>
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
            {(selected.kind === 'qr' || selected.kind === 'barcode') && <CodeFields selected={selected} />}
            {(selected.kind === 'shape' || selected.kind === 'text' || selected.kind === 'icon') && (
              <>
                <Swatches label={t('fill')} value={selected.fill} onChange={(fill) => void engine.updateSelected({ fill })} />
                <Swatches label={t('stroke')} value={selected.stroke} onChange={(stroke) => void engine.updateSelected({ stroke })} />
                <Field label={t('strokeWidth')}>
                  <HistorySlider label={t('strokeWidth')} min={0} max={12} value={selected.strokeWidth} onChange={(strokeWidth) => void engine.updateSelected({ strokeWidth })} />
                </Field>
              </>
            )}
            {selected.rx !== undefined && (
              <Field label={t('radius')}>
                <HistorySlider label={t('radius')} min={0} max={40} value={selected.rx} onChange={(rx) => void engine.updateSelected({ rx })} />
              </Field>
            )}
            <Field label={t('angle')}>
              <HistorySlider label={t('angle')} min={-180} max={180} value={selected.angle} onChange={(angle) => void engine.updateSelected({ angle })} />
            </Field>
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
          const head = meta && axis > meta.printheadPixels ? t('printheadWarn', { model: modelLabel(doc.model), px: meta.printheadPixels }) : ''
          const scan = worstScan(doc.canvas)
          const code =
            scan?.level === 'dense' ? t('scanDense') : scan?.level === 'small' ? t('scanSmall', { n: scan.moduleDots }) : scan?.level === 'bars' ? t('scanBars', { n: scan.barDots }) : ''
          setWarn([head, code].filter(Boolean).join(' '))
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
