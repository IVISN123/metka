import { useMemo, useState } from 'react'
import { engine } from '../engine/editor'
import { PRESETS, presetGroup, presetSearchText } from '../lib/presets'
import { thumbnailOf } from '../lib/render'
import { saveTemplate } from '../lib/storage'
import { storageErrorCode } from '../lib/errors'
import { defaultCornerMm } from '../lib/editor-ui'
import { uid } from '../lib/units'
import { toast } from '../toast'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { Button, Field, Modal, Slider, TextInput } from './ui'

export function NewLabelDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n()
  const { state } = useEngine()
  const [query, setQuery] = useState('')
  const [width, setWidth] = useState(String(state.widthMm))
  const [height, setHeight] = useState(String(state.heightMm))
  const [corner, setCorner] = useState(state.cornerMm)
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const q = query.trim().toLowerCase()
  const presets = useMemo(() => PRESETS.filter((preset) => !q || presetSearchText(preset).includes(q)), [q])
  const groups = [
    { id: 'tape' as const, title: t('groupTape') },
    { id: 'card' as const, title: t('groupCard') },
  ]

  const choose = (id: string) => {
    const preset = PRESETS.find((item) => item.id === id)
    if (!preset) return
    setPicked(id)
    setWidth(String(preset.widthMm))
    setHeight(String(preset.heightMm))
    setCorner(defaultCornerMm(preset.widthMm, preset.heightMm))
    if (!name.trim()) setName(preset.title)
  }

  const readSize = () => {
    const widthMm = Number(width.replace(',', '.'))
    const heightMm = Number(height.replace(',', '.'))
    if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) return null
    return { widthMm, heightMm }
  }

  const create = async (save: boolean) => {
    const size = readSize()
    if (!size) {
      toast(t('badSize'))
      return
    }
    if (state.dirty && !window.confirm(t('confirmNew'))) return
    setBusy(true)
    try {
      const labelName = name.trim() || `${size.widthMm}×${size.heightMm}`
      const ok = await engine.newBlank({ ...size, cornerMm: corner, name: labelName })
      if (!ok) {
        toast(t('badSize'))
        return
      }
      if (save) {
        const doc = engine.toDocument()
        await saveTemplate({
          id: uid(),
          name: doc.name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          thumbnail: await thumbnailOf(doc, 480),
          doc,
        })
        toast(t('savedTemplate', { name: doc.name }))
      }
      onClose()
    } catch (error) {
      toast(t(storageErrorCode(error) === 'quota' ? 'quota' : 'storageFail'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('newLabelTitle')}
      closeLabel={t('close')}
      wide
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:p-5">
          <Button variant="primary" className="w-full" disabled={busy} onClick={() => void create(false)}>
            {t('createLabel')}
          </Button>
          <Button className="w-full" disabled={busy} onClick={() => void create(true)}>
            {t('createAndSave')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">{t('newLabelLead')}</p>
        <input
          aria-label={t('search')}
          value={query}
          placeholder={t('search')}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-3 text-base font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        {groups.map((group) => {
          const items = presets.filter((preset) => presetGroup(preset.id) === group.id)
          if (items.length === 0) return null
          return (
            <section key={group.id}>
              <h3 className="mb-2 text-sm font-black">{group.title}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {items.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => choose(preset.id)}
                    className={`min-h-16 rounded-2xl border px-3 py-2 text-left hover:bg-[var(--hover)] ${picked === preset.id ? 'border-[var(--accent)] bg-[var(--hover)]' : 'border-[var(--border)]'}`}
                  >
                    <div className="text-sm font-black">{preset.title}</div>
                    <div className="text-xs text-[var(--muted)]">{t('canvasSize', { w: preset.widthMm, h: preset.heightMm })}</div>
                    <div className="text-xs text-[var(--muted)]">{preset.note[lang]}</div>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
        {presets.length === 0 && <p className="text-sm text-[var(--muted)]">{t('noFont')}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('width')}>
            <TextInput value={width} inputMode="decimal" onChange={(event) => { setWidth(event.target.value); setPicked(null) }} />
          </Field>
          <Field label={t('height')}>
            <TextInput value={height} inputMode="decimal" onChange={(event) => { setHeight(event.target.value); setPicked(null) }} />
          </Field>
        </div>
        <Field label={t('labelName')}>
          <TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder={t('templatePh')} />
        </Field>
        <Field label={`${t('corner')} · ${corner}`}>
          <Slider label={t('corner')} min={0} max={6} step={0.5} value={corner} onChange={setCorner} />
          <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{t('cornerHint')}</span>
        </Field>
      </div>
    </Modal>
  )
}
