import { useState } from 'react'
import { useSyncExternalStore } from 'react'
import { engine } from '../engine/editor'
import { applySeriesValue } from '../lib/materialize'
import { formatPrintError } from '../lib/print-errors'
import { LABEL_TYPES, metaFor, resolvePrintTask, suggestedTask, taskNames } from '../lib/presets'
import { renderDocumentThermal } from '../lib/render'
import { browserSupport } from '../lib/browser'
import { modelLabel } from '../lib/units'
import { printer } from '../printer/controller'
import { toast } from '../toast'
import type { I18nKey } from '../i18n'
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
      if (editor.taskAuto && snap.model && metaFor(snap.model)) {
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
        <p className="text-xs leading-5 text-[var(--muted)]">{t('printUntested')}</p>
        <Button variant="primary" disabled={link.printing || !state.ready} onClick={() => void send()}>
          {t('sendPrint')}
        </Button>
      </div>
    </Modal>
  )
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted)]">{k}</dt>
      <dd className="truncate font-medium">{v}</dd>
    </div>
  )
}
