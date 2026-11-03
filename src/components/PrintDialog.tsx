import { useState } from 'react'
import { useSyncExternalStore } from 'react'
import { engine } from '../engine/editor'
import { applySeriesValue } from '../lib/materialize'
import { formatPrintError } from '../lib/print-errors'
import { LABEL_TYPES, metaFor, resolvePrintTask, suggestedTask, taskNames } from '../lib/presets'
import { renderDocumentThermal } from '../lib/render'
import { browserSupport } from '../lib/browser'
import { mmToPx, modelLabel } from '../lib/units'
import { printer } from '../printer/controller'
import { toast } from '../toast'
import type { I18nKey } from '../i18n'
import type { Sharpness } from '../types'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { Button, Field, Modal, SelectInput, Slider, TextInput } from './ui'

export type BatchJob = { rows: Record<string, string>[]; targetId: string | null } | null

export function PrintDialog({ batch, onClose, onClearBatch }: { batch: BatchJob; onClose: () => void; onClearBatch: () => void }) {
  const { t, lang } = useI18n()
  const { state } = useEngine()
  const link = useSyncExternalStore(printer.subscribe, printer.getSnapshot, printer.getSnapshot)
  const support = browserSupport()
  const meta = metaFor(state.model)
  const [interval, setInterval] = useState('')
  const [advanced, setAdvanced] = useState(false)
  const [diag, setDiag] = useState(false)
  const [fwOpen, setFwOpen] = useState(false)
  const [fwVersion, setFwVersion] = useState('4.28')
  const [fwName, setFwName] = useState('')
  const [fwData, setFwData] = useState<Uint8Array | null>(null)
  const [fwProgress, setFwProgress] = useState('')
  const pageW = mmToPx(state.widthMm, state.dpi)
  const pageH = mmToPx(state.heightMm, state.dpi)
  const guessed = suggestedTask(state.model).guessed
  const effectiveTask = resolvePrintTask({
    taskAuto: state.taskAuto,
    manual: state.task,
    detected: link.detectedTask,
    model: link.model || state.model,
  })

  const connect = async (transport: 'bluetooth' | 'serial') => {
    try {
      await printer.connect(transport)
      const snap = printer.getSnapshot()
      const editor = engine.getSnapshot()
      if (snap.model && metaFor(snap.model)) {
        if (snap.model !== editor.model) engine.setModel(snap.model)
        else if (snap.dpi && snap.dpi !== editor.dpi) engine.setDpi(snap.dpi)
        if (snap.detectedTask) engine.setTask(snap.detectedTask, true)
      }
    } catch {
      const snap = printer.getSnapshot()
      toast(snap.error === 'cancelled' ? t('userCancelled') : snap.error || t('printFail'))
    }
  }

  const send = async () => {
    if (printer.getSnapshot().status !== 'connected') {
      toast(t('notConnected'))
      return
    }
    try {
      const doc = engine.toDocument()
      const now = new Date()
      const jobs = batch?.rows.length ? batch.rows : [null]
      const pages = []
      for (const row of jobs) {
        const next = batch?.targetId && row?.value ? applySeriesValue(doc, batch.targetId, row.value) : doc
        pages.push(await renderDocumentThermal(next, row ?? undefined, now))
      }
      const live = printer.getSnapshot()
      const head = live.printhead ?? metaFor(live.model || doc.model)?.printheadPixels
      await printer.print({
        pages,
        direction: doc.direction,
        printhead: head,
        align: doc.align,
        density: doc.density,
        quantity: doc.quantity,
        labelType: doc.labelType,
        task: doc.task,
        taskAuto: doc.taskAuto,
        packetInterval: interval.trim() === '' ? null : Number(interval),
      })
      toast(t('printDone'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message === 'notConnected') toast(t('notConnected'))
      else if (message === 'empty') toast(t('printFail'))
      else toast(formatPrintError(error, lang))
    }
  }

  return (
    <Modal title={t('print')} closeLabel={t('close')} onClose={onClose}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="rounded-2xl border border-[var(--border)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">{link.status === 'connected' ? t('connected') : link.status === 'connecting' ? t('connecting') : t('disconnected')}</div>
              <div className="text-xs text-[var(--muted)]">
                {link.deviceName || link.model || (support.bluetooth || support.serial ? t('supportedHere') : t('bluetoothMissing'))}
              </div>
            </div>
            <span className={`h-2.5 w-2.5 rounded-full ${link.status === 'connected' ? 'bg-[#00ba7c]' : link.status === 'connecting' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`} />
          </div>
          {link.status === 'connected' && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Info k={t('model')} v={link.model ? modelLabel(link.model) : '—'} />
              <Info k={t('battery')} v={link.battery === null ? t('paperUnknown') : `${link.battery}%`} />
              <Info k={t('paper')} v={link.paper === null ? t('paperUnknown') : link.paper ? t('paperIn') : t('paperOut')} />
              <Info k={t('printTask')} v={link.detectedTask || '—'} />
              <Info k={t('firmware')} v={link.firmware || '—'} />
              <Info k={t('serial')} v={link.serial || '—'} />
            </dl>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="accent" disabled={!support.bluetooth || link.printing} onClick={() => void connect('bluetooth')}>
              {t('connectBle')}
            </Button>
            <Button disabled={!support.serial || link.printing} onClick={() => void connect('serial')}>
              {t('connectUsb')}
            </Button>
            {link.status === 'connected' && (
              <Button disabled={link.printing} onClick={() => void printer.disconnect()}>
                {t('disconnect')}
              </Button>
            )}
          </div>
          <button type="button" className="mt-3 text-left text-sm font-black text-[var(--danger)]" onClick={() => setFwOpen((open) => !open)}>
            {t('firmwareFlash')}
          </button>
          {fwOpen && (
            <div className="mt-2 flex flex-col gap-2 rounded-2xl border-2 border-[var(--danger)] p-3">
              <p className="text-sm font-bold leading-5 text-[var(--danger)]">{t('flashLead')}</p>
              <p className="text-xs leading-5 text-[var(--text)]">{t('flashWarn')}</p>
              <p className="text-xs leading-5">
                {t('firmware')}: {link.firmware || '—'} · {t('hardware')}: {link.hardware || '—'}
              </p>
              <p className="text-xs leading-5">
                <a className="font-bold text-[var(--accent)] underline" href="https://fw.niim.blue/stable/D11_H/" target="_blank" rel="noreferrer">
                  {t('flashLink')}
                </a>
                {' · '}
                <a className="font-bold text-[var(--accent)] underline" href="https://fw.niim.blue/testing/D11_H/D11_H_4.28.bin" target="_blank" rel="noreferrer">
                  {t('flashLinkTest')}
                </a>
              </p>
              <label className="text-xs font-bold text-[var(--muted)]">
                {t('flashFile')}
                <input
                  type="file"
                  accept=".bin,application/octet-stream"
                  className="mt-1 block w-full text-sm font-bold text-[var(--text)]"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    void file.arrayBuffer().then((buffer) => {
                      const bytes = new Uint8Array(buffer)
                      setFwData(bytes)
                      setFwName(file.name)
                      const named = file.name.match(/(\d+\.\d+)/)
                      if (bytes.length >= 0x1c && bytes[0] === 0x18) {
                        const ver = ((bytes[0x15] ?? 0) << 8) + (bytes[0x14] ?? 0)
                        setFwVersion((ver / 100).toFixed(2))
                      } else if (named?.[1]) setFwVersion(named[1])
                    })
                  }}
                />
              </label>
              {fwName && <p className="truncate text-xs font-bold">{fwName}</p>}
              <label className="text-xs font-bold text-[var(--muted)]">
                {t('flashVersion')}
                <input
                  className="mt-1 h-11 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-3 text-base font-bold text-[var(--text)]"
                  value={fwVersion}
                  onChange={(event) => setFwVersion(event.target.value)}
                />
              </label>
              <Button
                className="!bg-[var(--danger)] !text-white"
                disabled={link.status !== 'connected' || link.printing || fwProgress !== ''}
                onClick={() => {
                  if (!fwData) {
                    toast(t('flashNeedFile'))
                    return
                  }
                  if (!/^\d+\.\d+$/.test(fwVersion.trim())) {
                    toast(t('flashBadVersion'))
                    return
                  }
                  if (!window.confirm(t('flashConfirm'))) return
                  setFwProgress('…')
                  void printer
                    .flashFirmware(fwData, fwVersion.trim(), (current, total) => setFwProgress(`${current}/${total}`))
                    .then(() => {
                      setFwProgress('')
                      setFwData(null)
                      setFwName('')
                      toast(t('flashDone'))
                    })
                    .catch((error: unknown) => {
                      setFwProgress('')
                      const message = error instanceof Error ? error.message : String(error)
                      toast(message === 'notConnected' ? t('notConnected') : message === 'badVersion' ? t('flashBadVersion') : message)
                    })
                }}
              >
                {fwProgress ? fwProgress : t('flashBurn')}
              </Button>
            </div>
          )}
          {!support.bluetooth && <p className="mt-2 text-xs text-[var(--muted)]">{t('bluetoothMissing')}</p>}
          {!support.serial && <p className="mt-1 text-xs text-[var(--muted)]">{t('serialMissing')}</p>}
        </div>

        {batch && (
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--elev)] px-3 py-2 text-sm">
            <span>{t('batchNote', { n: batch.rows.length, copies: state.quantity })}</span>
            <Button className="h-8" onClick={onClearBatch}>
              {t('clearBatch')}
            </Button>
          </div>
        )}

        <Field label={t('sharpness')}>
          <SelectInput
            value={state.preview.sharpness ?? 'off'}
            onChange={(event) => engine.setPreview({ sharpness: event.target.value as Sharpness })}
          >
            <option value="off">{t('sharpOff')}</option>
            <option value="clear">{t('sharpClear')}</option>
            <option value="strong">{t('sharpStrong')}</option>
          </SelectInput>
          <span className="mt-1 block text-xs text-[var(--muted)]">{t('sharpHint')}</span>
        </Field>
        <Field label={`${t('density')} ${state.density}`}>
          <Slider
            min={meta?.densityMin ?? 1}
            max={meta?.densityMax ?? 5}
            value={state.density}
            onChange={(density) => engine.setDensity(density)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('copies')}>
            <TextInput type="number" min={1} max={200} value={state.quantity} onChange={(event) => engine.setQuantity(Number(event.target.value))} />
          </Field>
          <Field label={t('labelType')}>
            <SelectInput value={state.labelType} onChange={(event) => engine.setLabelType(Number(event.target.value))}>
              {LABEL_TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {t(item.key as I18nKey)}
                </option>
              ))}
            </SelectInput>
          </Field>
        </div>
        <Field label={t('direction')}>
          <SelectInput value={state.direction} onChange={(event) => engine.setDirection(event.target.value === 'left' ? 'left' : 'top')}>
            <option value="top">{t('dirTop')}</option>
            <option value="left">{t('dirLeft')}</option>
          </SelectInput>
        </Field>
        <Field label={t('alignHead')}>
          <SelectInput value={state.align} onChange={(event) => engine.setAlign(event.target.value as 'center')}>
            <option value="start">{t('alignStart')}</option>
            <option value="center">{t('alignCenterHead')}</option>
            <option value="end">{t('alignEnd')}</option>
          </SelectInput>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={state.taskAuto} onChange={(event) => engine.setTask(state.task, event.target.checked)} />
          {t('autoTask')}
        </label>
        <Field label={t('printTask')}>
          <SelectInput value={effectiveTask} onChange={(event) => engine.setTask(event.target.value, false)}>
            {taskNames().map((name) => (
              <option key={name}>{name}</option>
            ))}
          </SelectInput>
        </Field>
        {guessed && !link.detectedTask && <p className="text-xs text-[var(--muted)]">{t('taskGuess')}</p>}
        <button type="button" className="text-left text-sm font-bold text-[var(--accent)]" onClick={() => setAdvanced((open) => !open)}>
          {t('advanced')}
        </button>
        {advanced && (
          <Field label={t('packetInterval')}>
            <TextInput value={interval} inputMode="numeric" placeholder="5" onChange={(event) => setInterval(event.target.value)} />
            <span className="mt-1 block text-xs text-[var(--muted)]">{t('packetHint')}</span>
          </Field>
        )}
        {link.printing && (
          <div>
            <div className="mb-1 text-xs text-[var(--muted)]">
              {t('printing')} {link.progressLabel}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hover)]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.max(4, link.progress)}%` }} />
            </div>
          </div>
        )}
        <p className="text-xs leading-5 text-[var(--muted)]">
          {t('printPlan', {
            task: effectiveTask,
            dpi: state.dpi,
            w: pageW,
            h: pageH,
            head: link.printhead ?? '—',
          })}
          {link.dpi && link.dpi !== state.dpi ? ` · ${t('dpi')} ${link.dpi}` : ''}
        </p>
        <button type="button" className="text-left text-sm font-bold text-[var(--accent)]" onClick={() => setDiag((open) => !open)}>
          {t('diagnostics')}
        </button>
        {diag && (
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] p-3 text-sm">
            <dl className="grid grid-cols-2 gap-2">
              <Info k={t('model')} v={link.model ? modelLabel(link.model) : '—'} />
              <Info k={t('firmware')} v={link.firmware || '—'} />
              <Info k={t('hardware')} v={link.hardware || '—'} />
              <Info k={t('protocol')} v={link.protocol === null ? '—' : String(link.protocol)} />
              <Info k={t('printTask')} v={link.detectedTask || '—'} />
              <Info k={t('serial')} v={link.serial || '—'} />
              <Info k={t('rfid')} v={rfidLabel(link.rfid, t)} />
            </dl>
            <p className="text-xs leading-5 text-[var(--muted)]">{t('diagNote')}</p>
            {link.lastPrint && <p className="break-all font-mono text-[11px] leading-4">{link.lastPrint}</p>}
            <textarea
              readOnly
              className="h-40 w-full resize-y rounded-xl border border-[var(--border)] bg-transparent p-2 font-mono text-[11px] leading-4"
              value={link.packetLog || t('noPacketLog')}
            />
            <Button
              onClick={() => {
                const text = [
                  `model ${link.model || '-'}`,
                  `firmware ${link.firmware || '-'}`,
                  `hardware ${link.hardware || '-'}`,
                  `protocol ${link.protocol ?? '-'}`,
                  `detected ${link.detectedTask || '-'}`,
                  `task ${effectiveTask}`,
                  `dpi ${state.dpi}`,
                  `page ${pageW}x${pageH}`,
                  `head ${link.printhead ?? '-'}`,
                  `rfid ${rfidLabel(link.rfid, t)}`,
                  link.lastPrint,
                  link.packetLog,
                ]
                  .filter(Boolean)
                  .join('\n')
                void navigator.clipboard.writeText(text).then(
                  () => toast(t('copied')),
                  () => toast(t('copyFail')),
                )
              }}
            >
              {t('copyLog')}
            </Button>
          </div>
        )}
        <Button variant="primary" disabled={link.printing || !state.ready} onClick={() => void send()}>
          {t('sendPrint')}
        </Button>
      </div>
    </Modal>
  )
}

function rfidLabel(rfid: { present: boolean | null; used: number | null; total: number | null; kind: number | null; barcode: string; readOk: boolean | null; widthMm: number | null; heightMm: number | null }, t: (key: I18nKey, vars?: Record<string, string | number>) => string) {
  if (rfid.present === false || (rfid.present === null && rfid.readOk === false)) return t('rfidNone')
  if (rfid.used === null && rfid.present !== true) return rfid.readOk === false ? t('rfidUnread') : t('paperUnknown')
  const barcode = rfid.barcode ? `, ${rfid.barcode}` : ''
  const size = rfid.widthMm && rfid.heightMm ? ` · ${rfid.widthMm}×${rfid.heightMm}` : ''
  return `${t('rfidLine', { used: rfid.used ?? '—', total: rfid.total ?? '—', kind: rfid.kind ?? '—', barcode })}${size}`
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  )
}
