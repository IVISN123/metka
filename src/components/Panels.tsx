import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignEndVertical,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
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
import { ICONS } from '../lib/icons'
import { addUserFont, fontChoices, isUploadedFamily, removeUserFont, subscribeFonts } from '../lib/fonts'
import { BARCODE_FORMATS, DATE_FORMATS, metaFor } from '../lib/presets'
import { renderDocumentThermal } from '../lib/render'
import { modelLabel } from '../lib/units'
import type { I18nKey } from '../i18n'
import type { LayerInfo, ObjectKind } from '../types'
import { toast } from '../toast'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { Button, Field, IconButton, SelectInput, Slider, TextInput } from './ui'

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

export function ToolPanel() {
  const { t } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [iconsOpen, setIconsOpen] = useState(false)
  const [shapesOpen, setShapesOpen] = useState(false)
  const tools: { key: I18nKey; icon: typeof Type; run: () => void }[] = [
    { key: 'text', icon: Type, run: () => engine.addText() },
    { key: 'pageNumber', icon: Hash, run: () => engine.addNumber() },
    { key: 'photo', icon: ImageIcon, run: () => fileRef.current?.click() },
    { key: 'icons', icon: Sparkles, run: () => setIconsOpen((open) => !open) },
    { key: 'shapes', icon: Square, run: () => setShapesOpen((open) => !open) },
    { key: 'line', icon: Minus, run: () => engine.addLine() },
    { key: 'barcode', icon: Barcode, run: () => void engine.addBarcode().catch((error: unknown) => toast(String(error))) },
    { key: 'qr', icon: QrCode, run: () => void engine.addQr() },
    { key: 'datetime', icon: Clock, run: () => engine.addDatetime() },
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
            className="flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[var(--text)] hover:bg-[var(--hover)]"
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
          if (file) void engine.addImageFile(file)
          event.target.value = ''
        }}
      />
      {iconsOpen && (
        <div className="mt-2 grid grid-cols-6 gap-1 rounded-2xl border border-[var(--border)] p-2">
          {ICONS.map((icon) => (
            <button
              key={icon.id}
              type="button"
              title={icon.id}
              className="grid h-10 place-items-center rounded-xl hover:bg-[var(--hover)]"
              onClick={() => void engine.addIcon(icon.id)}
              dangerouslySetInnerHTML={{ __html: icon.svg.replace('viewBox', 'width="22" height="22" viewBox') }}
            />
          ))}
        </div>
      )}
      {shapesOpen && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          <ShapeButton label={t('rect')} onClick={() => engine.addShape('rect')} icon={<Square size={16} />} />
          <ShapeButton label={t('round')} onClick={() => engine.addShape('round')} icon={<Square size={16} />} />
          <ShapeButton label={t('ellipse')} onClick={() => engine.addShape('ellipse')} icon={<Circle size={16} />} />
          <ShapeButton label={t('triangle')} onClick={() => engine.addShape('triangle')} icon={<span className="text-sm">△</span>} />
        </div>
      )}
    </div>
  )
}

function ShapeButton({ label, onClick, icon }: { label: string; onClick: () => void; icon: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm hover:bg-[var(--hover)]">
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
    <li className={`flex items-center gap-1 rounded-2xl pr-1 ${active ? 'bg-[var(--hover)]' : 'hover:bg-[var(--hover)]'}`}>
      <button type="button" onClick={() => engine.select(layer.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left text-sm">
        <Icon size={15} className="shrink-0 text-[var(--muted)]" />
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
            <IconButton label={t('alignCanvas')} onClick={() => engine.align('left')}><AlignLeft size={16} /></IconButton>
            <IconButton label={t('alignCanvas')} onClick={() => engine.align('center')}><AlignCenter size={16} /></IconButton>
            <IconButton label={t('alignCanvas')} onClick={() => engine.align('right')}><AlignRight size={16} /></IconButton>
            <IconButton label={t('alignCanvas')} onClick={() => engine.align('top')}><AlignStartVertical size={16} /></IconButton>
            <IconButton label={t('alignCanvas')} onClick={() => engine.align('middle')}><AlignCenter size={16} className="rotate-90" /></IconButton>
            <IconButton label={t('alignCanvas')} onClick={() => engine.align('bottom')}><AlignEndVertical size={16} /></IconButton>
            <IconButton label={t('duplicate')} onClick={() => void engine.duplicate()}><span className="text-xs font-bold">2×</span></IconButton>
            <IconButton label={t('deleteObj')} onClick={() => engine.deleteSelected()}><Trash2 size={16} /></IconButton>
          </div>
        )}
        {selected && (
          <>
            <Field label={t('name')}>
              <TextInput value={selected.name} onChange={(event) => void engine.updateSelected({ name: event.target.value })} />
            </Field>
            {(selected.kind === 'text' || selected.kind === 'datetime' || selected.kind === 'number') && (
              <>
                <Field label={t('font')}>
                  <SelectInput value={selected.fontFamily ?? ''} onChange={(event) => void engine.updateSelected({ fontFamily: event.target.value })}>
                    {fonts.map((font) => (
                      <option key={font.id} value={font.family} style={{ fontFamily: font.family }}>
                        {font.label}
                      </option>
                    ))}
                    {selected.fontFamily && !fonts.some((font) => font.family === selected.fontFamily) && (
                      <option value={selected.fontFamily}>{selected.fontFamily}</option>
                    )}
                  </SelectInput>
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
                  <Slider min={8} max={160} value={selected.fontSize ?? 16} onChange={(value) => void engine.updateSelected({ fontSize: value })} />
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
                      <span className="text-xs font-bold">Ab</span>
                    </Toggle>
                  )}
                </div>
                <div className="flex gap-1">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <Button key={align} className="flex-1 px-0" variant={selected.textAlign === align ? 'accent' : 'ghost'} onClick={() => void engine.updateSelected({ textAlign: align })}>
                      {align === 'left' ? 'L' : align === 'center' ? 'C' : 'R'}
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
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.live !== false} onChange={(event) => void engine.updateSelected({ live: event.target.checked })} />
                  {t('liveDate')}
                </label>
                <Button onClick={() => engine.refreshDates()}>{t('refresh')}</Button>
              </>
            )}
            {selected.kind === 'image' && (
              <>
                <Field label={`${t('brightness')} ${Math.round((selected.brightness ?? 0) * 100)}`}>
                  <Slider min={-100} max={100} value={Math.round((selected.brightness ?? 0) * 100)} onChange={(value) => void engine.updateSelected({ brightness: value / 100 })} />
                </Field>
                <Field label={`${t('contrast')} ${Math.round((selected.contrast ?? 0) * 100)}`}>
                  <Slider min={-100} max={100} value={Math.round((selected.contrast ?? 0) * 100)} onChange={(value) => void engine.updateSelected({ contrast: value / 100 })} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!selected.invert} onChange={(event) => void engine.updateSelected({ invert: event.target.checked })} />
                  {t('invert')}
                </label>
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
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selected.showText !== false} onChange={(event) => void engine.updateSelected({ showText: event.target.checked }).catch(() => toast(t('barcodeError')))} />
                  {t('showText')}
                </label>
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
                <Field label={t('strokeWidth')}>
                  <Slider min={0} max={12} value={selected.strokeWidth} onChange={(strokeWidth) => void engine.updateSelected({ strokeWidth })} />
                </Field>
              </>
            )}
            {selected.rx !== undefined && (
              <Field label={t('radius')}>
                <Slider min={0} max={40} value={selected.rx} onChange={(rx) => void engine.updateSelected({ rx })} />
              </Field>
            )}
            <Field label={t('angle')}>
              <Slider min={-180} max={180} value={selected.angle} onChange={(angle) => void engine.updateSelected({ angle })} />
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

function Toggle({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} title={label} onClick={onClick} className={`grid h-9 w-9 place-items-center rounded-full border ${on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] hover:bg-[var(--hover)]'}`}>
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
            title={item.name}
            onClick={() => onChange(item.id)}
            className={`h-8 w-8 rounded-full border ${value === item.id ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]' : 'border-[var(--border)]'} ${item.className}`}
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
          if (!cancel) setStats(t('encodeFail', { error: error instanceof Error ? error.message : String(error) }))
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
