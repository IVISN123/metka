import { useState } from 'react'
import { engine } from '../engine/editor'
import { decodeCsvBytes, parseCsv, seriesValues } from '../lib/csv'
import { canBindSeries } from '../lib/editor-ui'
import { toast } from '../toast'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { Button, Field, Modal, TextInput } from './ui'
import type { BatchJob } from './PrintDialog'

export function BatchDialog({
  onClose,
  onPrint,
}: {
  onClose: () => void
  onPrint: (job: BatchJob) => void
}) {
  const { t } = useI18n()
  const { state } = useEngine()
  const [mode, setMode] = useState<'series' | 'csv'>('series')
  const [from, setFrom] = useState(1)
  const [to, setTo] = useState(20)
  const [pad, setPad] = useState(2)
  const [prefix, setPrefix] = useState('')
  const [csvText, setCsvText] = useState('serial,name\n01,Камера\n02,Камера')
  const parsed = parseCsv(csvText)
  const values = seriesValues(prefix, from, to, pad)
  const seriesOk = canBindSeries(state.selected?.kind)

  const armSeries = () => {
    if (!seriesOk || !state.selectedId) {
      toast(t('batchNeed'))
      return
    }
    if (values.length >= 500) toast(t('limit500'))
    onPrint({ rows: values.map((value) => ({ value })), targetId: state.selectedId })
  }

  return (
    <Modal title={t('batch')} closeLabel={t('close')} onClose={onClose}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">{t('placeholders')}</p>
        <div className="flex gap-2">
          <Button variant={mode === 'series' ? 'accent' : 'ghost'} className="flex-1" onClick={() => setMode('series')}>
            {t('series')}
          </Button>
          <Button variant={mode === 'csv' ? 'accent' : 'ghost'} className="flex-1" onClick={() => setMode('csv')}>
            {t('csv')}
          </Button>
        </div>
        {mode === 'series' ? (
          <>
            <p className={`text-sm leading-6 ${seriesOk ? '' : 'text-[var(--danger)]'}`}>
              {seriesOk && state.selected ? t('batchTarget', { name: state.selected.name }) : t('batchNeed')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('prefix')}>
                <TextInput value={prefix} onChange={(event) => setPrefix(event.target.value)} />
              </Field>
              <Field label={t('pad')}>
                <TextInput type="number" min={0} max={8} value={pad} onChange={(event) => setPad(Number(event.target.value))} />
              </Field>
              <Field label={t('from')}>
                <TextInput type="number" value={from} onChange={(event) => setFrom(Number(event.target.value))} />
              </Field>
              <Field label={t('to')}>
                <TextInput type="number" value={to} onChange={(event) => setTo(Number(event.target.value))} />
              </Field>
            </div>
            <p className="text-sm text-[var(--muted)]">
              {values.slice(0, 8).join(', ')}
              {values.length > 8 ? '…' : ''} · {t('rowCount', { n: values.length })}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const first = values[0]
                  if (!first) return
                  void engine.applyValue(first).then((ok) => {
                    if (!ok) toast(t('noSelection'))
                  })
                }}
              >
                {t('applyRow')}
              </Button>
              <Button variant="primary" disabled={!seriesOk} onClick={armSeries}>
                {t('printSeries')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)]">{t('csvHelp')}</p>
            <textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              rows={8}
              className="w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
            />
            <label className="inline-flex h-11 cursor-pointer items-center rounded-full border border-[var(--border)] px-4 text-sm font-bold hover:bg-[var(--hover)]">
              {t('import')}
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  void file.arrayBuffer().then((buffer) => setCsvText(decodeCsvBytes(buffer)))
                  event.target.value = ''
                }}
              />
            </label>
            <p className="text-sm text-[var(--muted)]">{t('rowCount', { n: parsed.rows.length })}</p>
            {parsed.headers.length > 0 && (
              <div className="overflow-auto rounded-xl border border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead className="text-[var(--muted)]">
                    <tr>
                      {parsed.headers.map((header) => (
                        <th key={header} className="px-2 py-1 font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-t border-[var(--border)]">
                        {parsed.headers.map((header) => (
                          <td key={header} className="px-2 py-1">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button
              variant="primary"
              disabled={parsed.rows.length === 0}
              onClick={() => onPrint({ rows: parsed.rows, targetId: null })}
            >
              {t('printSeries')}
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
