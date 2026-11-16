import { useState, type ReactNode } from 'react'
import { engine } from '../engine/editor'
import type { I18nKey } from '../i18n'
import { LabelCodeError } from '../lib/codes'
import { iconById, symbolSvg } from '../lib/icons'
import { BARCODE_FORMATS } from '../lib/presets'
import {
  assessCode,
  effectiveEcl,
  sceneToSvg,
  specFromMeta,
  vectorShapes,
  type ScanReport,
} from '../lib/vector-code'
import type { CodeMark, QrContentKind, SelectedInfo, WifiAuth } from '../types'
import { toast } from '../toast'
import { FontPicker } from './FontPicker'
import { IconLibrary } from './IconLibrary'
import { useI18n } from './state'
import { CheckRow, Field, SelectInput, Slider, TextInput } from './ui'

const QR_KINDS: QrContentKind[] = ['text', 'wifi', 'vcard', 'phone', 'sms', 'email', 'geo']
const KIND_KEY: Record<QrContentKind, I18nKey> = {
  text: 'qrText',
  wifi: 'qrWifi',
  vcard: 'qrContact',
  phone: 'qrPhone',
  sms: 'qrSms',
  email: 'qrEmail',
  geo: 'qrGeo',
}

export function CodeFields({ selected }: { selected: SelectedInfo }) {
  const { t } = useI18n()
  const [iconsOpen, setIconsOpen] = useState(false)
  const mark = selected.mark ?? {}
  const spec = specFromMeta({
    id: selected.id,
    kind: selected.kind,
    name: selected.name,
    value: selected.value,
    ecl: selected.ecl,
    symbology: selected.symbology,
    showText: selected.showText,
    invert: selected.invert,
    mark,
  })
  const boxW = selected.boxW ?? (selected.kind === 'qr' ? 160 : 220)
  const boxH = selected.boxH ?? (selected.kind === 'qr' ? 160 : 80)
  let preview = ''
  let broken = false
  if (spec) {
    try {
      const scene = vectorShapes(spec, Math.max(32, boxW), Math.max(24, boxH))
      preview = sceneToSvg(scene)
    } catch {
      broken = true
    }
  }
  let report: ScanReport | null = null
  if (spec && !broken) {
    try {
      report = assessCode(spec, boxW, boxH)
    } catch {
      broken = true
    }
  }
  const bumped = spec?.kind === 'qr' ? safeBump(spec) : null
  const save = (patch: Partial<SelectedInfo>) => {
    void engine.updateSelected(patch).catch((error: unknown) => {
      if (error instanceof LabelCodeError) toast(t(error.kind === 'qr' ? 'qrError' : 'barcodeError'))
      else toast(t(selected.kind === 'qr' ? 'qrError' : 'barcodeError'))
    })
  }
  const setMark = (patch: CodeMark) => save({ mark: patch })
  return (
    <>
      {selected.kind === 'qr' && (
        <Field label={t('qrContent')}>
          <SelectInput value={mark.qrKind ?? 'text'} onChange={(event) => setMark({ qrKind: event.target.value as QrContentKind })}>
            {QR_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(KIND_KEY[kind])}
              </option>
            ))}
          </SelectInput>
        </Field>
      )}
      {selected.kind === 'qr' && (mark.qrKind ?? 'text') === 'text' && (
        <Field label={t('value')}>
          <TextInput value={selected.value ?? ''} onChange={(event) => save({ value: event.target.value })} />
        </Field>
      )}
      {selected.kind === 'qr' && mark.qrKind === 'wifi' && (
        <>
          <Field label={t('wifiSsid')}>
            <TextInput value={mark.wifi?.ssid ?? ''} onChange={(event) => setMark({ wifi: { ssid: event.target.value } })} />
          </Field>
          <Field label={t('wifiAuth')}>
            <SelectInput value={mark.wifi?.auth ?? 'WPA'} onChange={(event) => setMark({ wifi: { auth: event.target.value as WifiAuth } })}>
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">{t('wifiNone')}</option>
            </SelectInput>
          </Field>
          {(mark.wifi?.auth ?? 'WPA') !== 'nopass' && (
            <Field label={t('wifiPassword')}>
              <TextInput value={mark.wifi?.password ?? ''} onChange={(event) => setMark({ wifi: { password: event.target.value } })} />
            </Field>
          )}
          <CheckRow checked={!!mark.wifi?.hidden} onChange={(hidden) => setMark({ wifi: { hidden } })}>
            {t('wifiHidden')}
          </CheckRow>
        </>
      )}
      {selected.kind === 'qr' && mark.qrKind === 'vcard' && (
        <>
          <Field label={t('contactName')}>
            <TextInput value={mark.contact?.name ?? ''} onChange={(event) => setMark({ contact: { name: event.target.value } })} />
          </Field>
          <Field label={t('contactPhone')}>
            <TextInput value={mark.contact?.phone ?? ''} onChange={(event) => setMark({ contact: { phone: event.target.value } })} />
          </Field>
          <Field label={t('contactEmail')}>
            <TextInput value={mark.contact?.email ?? ''} onChange={(event) => setMark({ contact: { email: event.target.value } })} />
          </Field>
          <Field label={t('contactOrg')}>
            <TextInput value={mark.contact?.org ?? ''} onChange={(event) => setMark({ contact: { org: event.target.value } })} />
          </Field>
        </>
      )}
      {selected.kind === 'qr' && mark.qrKind === 'phone' && (
        <Field label={t('contactPhone')}>
          <TextInput value={mark.phone ?? ''} onChange={(event) => setMark({ phone: event.target.value })} />
        </Field>
      )}
      {selected.kind === 'qr' && mark.qrKind === 'sms' && (
        <>
          <Field label={t('smsNumber')}>
            <TextInput value={mark.sms?.number ?? ''} onChange={(event) => setMark({ sms: { number: event.target.value } })} />
          </Field>
          <Field label={t('smsBody')}>
            <TextInput value={mark.sms?.body ?? ''} onChange={(event) => setMark({ sms: { body: event.target.value } })} />
          </Field>
        </>
      )}
      {selected.kind === 'qr' && mark.qrKind === 'email' && (
        <>
          <Field label={t('mailTo')}>
            <TextInput value={mark.email?.to ?? ''} onChange={(event) => setMark({ email: { to: event.target.value } })} />
          </Field>
          <Field label={t('mailSubject')}>
            <TextInput value={mark.email?.subject ?? ''} onChange={(event) => setMark({ email: { subject: event.target.value } })} />
          </Field>
          <Field label={t('mailBody')}>
            <TextInput value={mark.email?.body ?? ''} onChange={(event) => setMark({ email: { body: event.target.value } })} />
          </Field>
        </>
      )}
      {selected.kind === 'qr' && mark.qrKind === 'geo' && (
        <>
          <Field label={t('geoLat')}>
            <TextInput value={mark.geo?.lat ?? ''} onChange={(event) => setMark({ geo: { lat: event.target.value } })} />
          </Field>
          <Field label={t('geoLng')}>
            <TextInput value={mark.geo?.lng ?? ''} onChange={(event) => setMark({ geo: { lng: event.target.value } })} />
          </Field>
        </>
      )}
      {selected.kind === 'barcode' && (
        <>
          <Field label={t('value')}>
            <TextInput value={selected.value ?? ''} onChange={(event) => save({ value: event.target.value })} />
          </Field>
          <Field label={t('format')}>
            <SelectInput value={selected.symbology} onChange={(event) => save({ symbology: event.target.value })}>
              {BARCODE_FORMATS.map((format) => (
                <option key={format}>{format}</option>
              ))}
            </SelectInput>
          </Field>
          <CheckRow checked={selected.showText !== false} onChange={(showText) => save({ showText })}>
            {t('showText')}
          </CheckRow>
          {selected.showText !== false && (
            <>
              <Field label={t('font')}>
                <FontPicker value={mark.barFont ?? 'Arial, Helvetica, sans-serif'} onChange={(barFont) => setMark({ barFont })} />
              </Field>
              <Field label={t('barTextSize')}>
                <Slider
                  label={t('barTextSize')}
                  min={8}
                  max={32}
                  value={mark.barFontSize ?? 14}
                  onGestureStart={() => engine.beginGesture()}
                  onGestureEnd={() => engine.endGesture()}
                  onChange={(barFontSize) => setMark({ barFontSize })}
                />
              </Field>
            </>
          )}
          <Field label={t('barHeight')}>
            <Slider
              label={t('barHeight')}
              min={8}
              max={160}
              value={mark.barHeight ?? report?.barDots ?? 56}
              onGestureStart={() => engine.beginGesture()}
              onGestureEnd={() => engine.endGesture()}
              onChange={(barHeight) => setMark({ barHeight })}
            />
          </Field>
          <Field label={t('moduleDots')}>
            <Slider
              label={t('moduleDots')}
              min={1}
              max={8}
              value={report?.moduleDots || mark.moduleDots || 2}
              onGestureStart={() => engine.beginGesture()}
              onGestureEnd={() => engine.endGesture()}
              onChange={(moduleDots) => setMark({ moduleDots })}
            />
          </Field>
        </>
      )}
      {selected.kind === 'qr' && (
        <>
          <Field label={t('ecl')}>
            <SelectInput value={selected.ecl ?? 'M'} onChange={(event) => save({ ecl: event.target.value as 'M' })}>
              {['L', 'M', 'Q', 'H'].map((level) => (
                <option key={level}>{level}</option>
              ))}
            </SelectInput>
          </Field>
          {bumped?.bumped && <p className="text-xs text-[var(--muted)]">{t('eclBump', { level: bumped.ecl })}</p>}
          <Field label={t('quietZone')}>
            <Slider
              label={t('quietZone')}
              min={0}
              max={8}
              value={mark.quiet ?? 4}
              onGestureStart={() => engine.beginGesture()}
              onGestureEnd={() => engine.endGesture()}
              onChange={(quiet) => setMark({ quiet })}
            />
          </Field>
          <ChoiceRow label={t('moduleShape')}>
            <Choice on={(mark.moduleShape ?? 'square') === 'square'} label={t('shapeSquare')} onClick={() => setMark({ moduleShape: 'square' })}>
              {t('shapeSquare')}
            </Choice>
            <Choice on={mark.moduleShape === 'rounded'} label={t('shapeRounded')} onClick={() => setMark({ moduleShape: 'rounded' })}>
              {t('shapeRounded')}
            </Choice>
            <Choice on={mark.moduleShape === 'dots'} label={t('shapeDots')} onClick={() => setMark({ moduleShape: 'dots' })}>
              {t('shapeDots')}
            </Choice>
          </ChoiceRow>
          <ChoiceRow label={t('finderShape')}>
            <Choice on={(mark.finderShape ?? 'square') === 'square'} label={t('shapeSquare')} onClick={() => setMark({ finderShape: 'square' })}>
              {t('shapeSquare')}
            </Choice>
            <Choice on={mark.finderShape === 'rounded'} label={t('shapeRounded')} onClick={() => setMark({ finderShape: 'rounded' })}>
              {t('shapeRounded')}
            </Choice>
            <Choice on={mark.finderShape === 'circle'} label={t('shapeCircle')} onClick={() => setMark({ finderShape: 'circle' })}>
              {t('shapeCircle')}
            </Choice>
          </ChoiceRow>
          <CheckRow checked={!!selected.invert} onChange={(invert) => save({ invert })}>
            {t('invert')}
          </CheckRow>
          <Field label={t('codeLogo')}>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIconsOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-xl border-2 border-[var(--border)] bg-white text-black"
                aria-label={t('codeLogo')}
              >
                {mark.logoId && iconById(mark.logoId) ? <LogoMark id={mark.logoId} /> : <span className="text-lg">+</span>}
              </button>
              {mark.logoId && (
                <button type="button" className="text-sm font-bold text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setMark({ logoId: '' })}>
                  {t('codeLogoClear')}
                </button>
              )}
            </div>
          </Field>
        </>
      )}
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-2">
        <div className="mb-1 text-xs font-bold text-neutral-500">{t('codePreview')}</div>
        {preview ? (
          <div className="mx-auto h-36 w-full" dangerouslySetInnerHTML={{ __html: preview }} />
        ) : (
          <p className="py-6 text-center text-xs text-red-700">{t(selected.kind === 'qr' ? 'qrError' : 'barcodeError')}</p>
        )}
      </div>
      {report && <p className={`text-xs ${report.level === 'ok' ? 'text-[var(--muted)]' : 'text-[var(--danger)]'}`}>{hintText(t, report, mark)}</p>}
      {iconsOpen && (
        <IconLibrary
          onClose={() => setIconsOpen(false)}
          onPick={(logoId) => {
            setMark({ logoId })
            setIconsOpen(false)
          }}
        />
      )}
    </>
  )
}

function safeBump(spec: NonNullable<ReturnType<typeof specFromMeta>>) {
  try {
    return effectiveEcl(spec.ecl, spec.value, !!spec.mark.logoId)
  } catch {
    return null
  }
}

function hintText(t: (key: I18nKey, vars?: Record<string, string | number>) => string, report: ScanReport, mark: CodeMark) {
  const main =
    report.level === 'dense'
      ? t('scanDense')
      : report.level === 'small'
        ? t('scanSmall', { n: report.moduleDots })
        : report.level === 'bars'
          ? t('scanBars', { n: report.barDots })
          : t('scanOk', { n: report.moduleDots })
  const quiet = (mark.quiet ?? 4) < 2 && report.rows > 1 ? ` ${t('scanQuiet')}` : ''
  return `${main}${quiet}`
}

function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-[var(--muted)]">{label}</div>
      <div className="flex gap-1">{children}</div>
    </div>
  )
}

function Choice({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`h-11 flex-1 rounded-full border px-2 text-xs font-bold ${on ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)] hover:bg-[var(--hover)]'}`}
    >
      {children}
    </button>
  )
}

function LogoMark({ id }: { id: string }) {
  const icon = iconById(id)
  if (!icon) return null
  return <span className="h-6 w-6 text-black" dangerouslySetInnerHTML={{ __html: symbolSvg(icon, '#111') }} />
}
