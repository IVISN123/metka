import { useState } from 'react'
import { useSyncExternalStore } from 'react'
import { engine } from '../engine/editor'
import { applySeriesValue } from '../lib/materialize'
import { collatedPages, documentHasPageNumber, parsePageRange } from '../lib/pages'
import { LabelCodeError } from '../lib/codes'
import { formatPrintError, linkErrorText } from '../lib/print-errors'
import { LABEL_TYPES, metaFor, resolvePrintTask, suggestedTask, taskNames } from '../lib/presets'
import { renderDocumentColor, renderDocumentThermal } from '../lib/render'
import { inkChoices, labelsRemaining, pageColorFor, shownVersion, suggestionFromRfid, type InkMode } from '../lib/printer-profile'
import { PageColorType } from '@mmote/niimbluelib'
import { browserSupport } from '../lib/browser'
import { labelWord } from '../lib/editor-ui'
import { mmToPx, modelLabel } from '../lib/units'
import { runDetectLabelBusy } from '../lib/apply-printer'
import { printer } from '../printer/controller'
import { toast } from '../toast'
import type { I18nKey } from '../i18n'
import type { Sharpness } from '../types'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { FirmwarePanel } from './FirmwarePanel'
import { Button, CheckRow, Field, Modal, SelectInput, Slider, TextInput } from './ui'

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
  const [ink, setInk] = useState<InkMode>('black')
  const [reading, setReading] = useState(false)
  const pageW = mmToPx(state.widthMm, state.dpi)
  const pageH = mmToPx(state.heightMm, state.dpi)
  const hasNumber = state.layers.some((layer) => layer.kind === 'number')
  const range = hasNumber ? parsePageRange(state.pageFrom, state.pageTo) : { from: 1, to: 1 }
  const rangeError = hasNumber && 'error' in range
  const sequence = hasNumber && !('error' in range) ? collatedPages(range.from, range.to, state.quantity) : []
  const batchCount = batch?.rows.length ?? 1
  const labelCount = hasNumber ? sequence.length * batchCount : Math.max(1, state.quantity) * batchCount
  const guessed = suggestedTask(state.model).guessed
  const effectiveTask = resolvePrintTask({
    taskAuto: state.taskAuto,
    manual: state.task,
    detected: link.detectedTask,
    model: link.model || state.model,
    protocolVersion: link.protocol,
  })
  const pageColor = pageColorFor(effectiveTask, ink)
  const colors = inkChoices(effectiveTask)
  const suggestion = link.status === 'connected' ? suggestionFromRfid(link.rfid) : null
  const left = labelsRemaining(link.rfid.total, link.rfid.used)
  const fwHw = shownVersion(link.hardware)
  const fwSw = shownVersion(link.firmware)
  const densityMin = link.status === 'connected' && link.densityMin != null ? Math.min(link.densityMin, link.densityMax ?? link.densityMin) : (meta?.densityMin ?? 1)
  const densityMax = link.status === 'connected' && link.densityMax != null ? Math.max(link.densityMax, link.densityMin ?? link.densityMax) : (meta?.densityMax ?? 5)
  const allowedTypes = link.status === 'connected' && link.labelTypes.length > 0 ? link.labelTypes : (meta?.paperTypes ?? [])
  const labelOptions = allowedTypes.length > 0 ? LABEL_TYPES.filter((item) => allowedTypes.includes(item.id)) : LABEL_TYPES

  const connect = async (transport: 'bluetooth' | 'serial') => {
    try {
      await printer.connect(transport)
    } catch {
      const snap = printer.getSnapshot()
      toast(linkErrorText(snap.error || 'printFail', lang))
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
      const numbered = documentHasPageNumber(doc)
      const mono = pageColor === PageColorType.SingleColor
      const draw = (next: typeof doc, row?: Record<string, string>, number?: number) =>
        mono ? renderDocumentThermal(next, row, now, number) : renderDocumentColor(next, row, now, number)
      const pages = []
      let quantity = doc.quantity
      if (numbered) {
        const parsed = parsePageRange(doc.pageFrom ?? 1, doc.pageTo ?? 1)
        if ('error' in parsed) {
          toast(t('pageRangeBad'))
          return
        }
        const numbers = collatedPages(parsed.from, parsed.to, doc.quantity)
        if (numbers.length * jobs.length > 999) {
          toast(t('pageRangeBad'))
          return
        }
        for (const row of jobs) {
          const base = batch?.targetId && row?.value ? applySeriesValue(doc, batch.targetId, row.value) : doc
          for (const number of numbers) {
            pages.push(await draw(base, row ?? undefined, number))
          }
        }
        quantity = 1
      } else {
        for (const row of jobs) {
          const next = batch?.targetId && row?.value ? applySeriesValue(doc, batch.targetId, row.value) : doc
          pages.push(await draw(next, row ?? undefined))
        }
      }
      const live = printer.getSnapshot()
      const head = live.printhead ?? metaFor(live.model || doc.model)?.printheadPixels
      await printer.print({
        pages,
        direction: doc.direction,
        printhead: head,
        align: doc.align,
        density: doc.density,
        quantity,
        labelType: doc.labelType,
        task: doc.task,
        taskAuto: doc.taskAuto,
        packetInterval: interval.trim() === '' ? null : Number(interval),
        ink: mono ? 'black' : ink,
      })
      toast(t('printDone'))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (error instanceof LabelCodeError) toast(t(error.kind === 'qr' ? 'qrError' : 'barcodeError'))
      else if (message === 'notConnected') toast(t('notConnected'))
      else if (message === 'empty') toast(t('printFail'))
      else toast(formatPrintError(error, lang))
    }
  }

  return (
    <Modal
      title={t('print')}
      closeLabel={t('close')}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2 border-t border-[var(--border)] bg-[var(--card)] px-4 py-3 sm:px-5">
          <p className="text-sm font-bold" data-testid="label-count">
            {t('willPrint', { n: labelCount, word: labelWord(labelCount, lang) })}
          </p>
          {rangeError && <p className="text-xs leading-5 text-[var(--danger)]">{t('pageRangeBad')}</p>}
          <Button variant="primary" className="w-full" disabled={link.printing || link.flashing || !state.ready || rangeError} onClick={() => void send()}>
            {t('sendPrint')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="rounded-2xl border border-[var(--border)] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold">{link.status === 'connected' ? t('connected') : link.status === 'connecting' ? t('connecting') : t('disconnected')}</div>
              <div className="text-xs text-[var(--muted)]">
                {link.deviceName || link.model || (support.bluetooth || support.serial ? t('supportedHere') : t('bluetoothMissing'))}
              </div>
            </div>
            <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${link.status === 'connected' ? 'bg-[#00ba7c]' : link.status === 'connecting' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`} />
          </div>
          {link.status === 'connected' && (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <Info k={t('model')} v={link.model ? modelLabel(link.model) : '—'} />
              <Info k={t('battery')} v={link.battery === null ? t('paperUnknown') : `${link.battery}%`} />
              <Info k={t('paper')} v={link.paper === null ? t('paperUnknown') : link.paper ? t('paperIn') : t('paperOut')} />
              <Info k={t('lid')} v={link.lid === null ? t('paperUnknown') : link.lid ? t('lidClosed') : t('lidOpen')} />
              <Info k={t('rfid')} v={left === null ? t('paperUnknown') : t('labelsLeft', { left, total: link.rfid.total ?? '—' })} />
              <Info k={t('ribbon')} v={ribbonText(link.ribbon, link.ribbonRfid, t)} />
              <Info k={t('printTask')} v={link.detectedTask || '—'} />
              <Info k={t('firmware')} v={fwSw || '—'} />
              <Info k={t('hardware')} v={fwHw || '—'} />
            </dl>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {suggestion && (
              <p className="text-xs leading-5 text-[var(--muted)]">
                {t('labelStock', {
                  w: suggestion.widthMm,
                  h: suggestion.heightMm,
                  gap: suggestion.gapMm ? t('paperGap', { n: suggestion.gapMm }) : '',
                })}
                {left !== null ? ` · ${t('labelsLeft', { left, total: link.rfid.total ?? '—' })}` : ''}
              </p>
            )}
          </div>
          {link.error && link.status !== 'connected' && <p className="mt-2 text-xs leading-5 text-[var(--danger)]">{linkErrorText(link.error, lang)}</p>}
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
          <Button className="mt-3 w-full" disabled={link.printing || reading || link.status !== 'connected'} aria-busy={reading} onClick={() => void runDetectLabelBusy(t, setReading)}>
            {reading ? t('detecting') : t('detectLabel')}
          </Button>
          {link.status !== 'connected' && <p className="text-xs leading-5 text-[var(--muted)]">{t('detectLabelNeed')}</p>}
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
        {colors.length > 1 && (
          <Field label={t('colorMode')}>
            <SelectInput value={pageColor === PageColorType.SingleColor ? 'black' : ink} onChange={(event) => setInk(event.target.value as InkMode)}>
              {colors.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === 'black' ? t('colorBlack') : mode === 'gray' ? t('colorGray') : t('colorRed')}
                </option>
              ))}
            </SelectInput>
            <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{t('colorHint')}</span>
          </Field>
        )}
        <Field label={t('density')}>
          <Slider
            label={t('density')}
            min={densityMin}
            max={densityMax}
            value={state.density}
            onGestureStart={() => engine.beginGesture()}
            onGestureEnd={() => engine.endGesture()}
            onChange={(density) => engine.setDensity(density)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('copies')}>
            <TextInput type="number" min={1} max={200} value={state.quantity} onChange={(event) => engine.setQuantity(Number(event.target.value))} />
          </Field>
          {hasNumber && (
            <>
              <Field label={t('pageFrom')}>
                <TextInput
                  type="number"
                  min={1}
                  max={999}
                  value={state.pageFrom}
                  onChange={(event) => engine.setPageRange(Number(event.target.value), state.pageTo)}
                />
              </Field>
              <Field label={t('pageTo')}>
                <TextInput
                  type="number"
                  min={1}
                  max={999}
                  value={state.pageTo}
                  onChange={(event) => engine.setPageRange(state.pageFrom, Number(event.target.value))}
                />
              </Field>
            </>
          )}
          <Field label={t('labelType')}>
            <SelectInput value={state.labelType} onChange={(event) => engine.setLabelType(Number(event.target.value))}>
              {labelOptions.map((item) => (
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
        <CheckRow checked={state.taskAuto} onChange={(checked) => engine.setTask(state.task, checked)}>
          {t('autoTask')}
        </CheckRow>
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
              {link.progressTotal > 0 ? t('printIndex', { n: link.progressPage, total: link.progressTotal }) : t('printing')}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--hover)]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${Math.max(4, link.progress)}%` }} />
            </div>
          </div>
        )}
        {hasNumber && !rangeError && (
          <p className="text-xs leading-5 text-[var(--muted)]" data-testid="page-order">
            {t('pageOrder', { list: sequence.slice(0, 24).join(', ') + (sequence.length > 24 ? '…' : '') })}
          </p>
        )}
        {rangeError && <p className="text-xs leading-5 text-[var(--danger)]">{t('pageRangeBad')}</p>}
        <p className="text-xs leading-5 text-[var(--muted)]">
          {t('printPlan', {
            task: effectiveTask,
            dpi: state.dpi,
            w: pageW,
            h: pageH,
            head: link.printhead ?? meta?.printheadPixels ?? '—',
          })}
          {link.dpi && link.dpi !== state.dpi ? ` · ${t('dpi')} ${link.dpi}` : ''}
        </p>
        {link.printhead && link.printheadSensor && link.printheadSensor !== link.printhead && (
          <p className="text-xs leading-5 text-[var(--muted)]">{t('headNote', { proto: link.printhead, sensor: link.printheadSensor })}</p>
        )}
        <button type="button" className="min-h-11 text-left text-sm font-bold text-[var(--accent)]" aria-expanded={fwOpen} onClick={() => setFwOpen((open) => !open)}>
          {t('firmwareOpen')}
        </button>
        {!fwOpen && <p className="-mt-2 text-xs leading-5 text-[var(--muted)]">{t('firmwareHint')}</p>}
        {fwOpen && <FirmwarePanel />}
        <button type="button" className="min-h-11 text-left text-sm font-bold text-[var(--accent)]" aria-expanded={diag} onClick={() => setDiag((open) => !open)}>
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
                  `sensor ${link.printheadSensor ?? '-'}`,
                  `lid ${link.lid === null ? '-' : link.lid ? 'closed' : 'open'}`,
                  `ribbon ${link.ribbon === null ? '-' : link.ribbon ? 'in' : 'out'} rfid ${link.ribbonRfid === null ? '-' : link.ribbonRfid}`,
                  `left ${labelsRemaining(link.rfid.total, link.rfid.used) ?? '-'}`,
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
      </div>
    </Modal>
  )
}

function ribbonText(ribbon: boolean | null, rfid: boolean | null, t: (key: I18nKey, vars?: Record<string, string | number>) => string) {
  if (ribbon === null) return t('paperUnknown')
  if (!ribbon) return t('ribbonOut')
  return rfid ? t('ribbonOk') : t('ribbonSeen')
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
