import { useEffect, useState } from 'react'
import { useSyncExternalStore } from 'react'
import {
  assessFirmware,
  downloadFirmwareImage,
  firmwareArchive,
  firmwareSupport,
  loadFirmwareCatalog,
  versionFromFirmwareImage,
  type FirmwareBlock,
  type FirmwareImage,
} from '../lib/firmware'
import { initialFlash, type FlashCode, type FlashView } from '../lib/firmware-machine'
import { shownVersion } from '../lib/printer-profile'
import { modelLabel } from '../lib/units'
import { printer } from '../printer/controller'
import type { I18nKey } from '../i18n'
import { useI18n } from './state'
import { Button, CheckRow } from './ui'

type CatalogState = {
  status: 'idle' | 'loading' | 'ready' | 'cors' | 'missing' | 'http' | 'parse'
  images: FirmwareImage[]
  pageUrl: string
}

const LIVE = new Set<FlashView['phase']>(['uploading', 'finishing', 'rebooting', 'reconnecting', 'verifying'])

export function FirmwarePanel() {
  const { t } = useI18n()
  const link = useSyncExternalStore(printer.subscribe, printer.getSnapshot, printer.getSnapshot)
  const [data, setData] = useState<Uint8Array | null>(null)
  const [fileName, setFileName] = useState('')
  const [version, setVersion] = useState('')
  const [allowDowngrade, setAllowDowngrade] = useState(false)
  const [confirm, setConfirm] = useState<null | 'downgrade' | 'flash'>(null)
  const [flash, setFlash] = useState<FlashView>(initialFlash)
  const [busy, setBusy] = useState(false)
  const [downloadFailed, setDownloadFailed] = useState(false)
  const [fetched, setFetched] = useState<{ model: string; state: CatalogState } | null>(null)

  const connected = link.status === 'connected'
  const model = link.model
  const support = firmwareSupport(model, link.protocol)
  const archive = firmwareArchive(model)
  const label = model ? modelLabel(model) : '—'
  const hardware = shownVersion(link.hardware)
  const software = shownVersion(link.firmware)
  const base = {
    connected,
    model,
    protocol: link.protocol,
    hardware: link.hardware,
    software: link.firmware,
    battery: link.battery,
    lid: link.lid,
    transport: link.transport,
    printing: link.printing,
    charging: null,
    fileName,
    version,
    data,
  }
  const assessment = assessFirmware({ ...base, allowDowngrade })
  const downgradeFile = assessFirmware({ ...base, allowDowngrade: true })
  const canForce = !assessment.ok && assessment.code === 'downgrade' && downgradeFile.ok && downgradeFile.downgrade
  const live = busy || link.flashing || LIVE.has(flash.phase)
  const power = assessment.power

  useEffect(() => {
    if (!connected || !support.supported || !archive.hasStableFolder) return
    let cancel = false
    void loadFirmwareCatalog(model).then((result) => {
      if (cancel) return
      const state: CatalogState = result.ok
        ? { status: 'ready', images: result.images, pageUrl: result.pageUrl }
        : { status: result.reason, images: [], pageUrl: result.pageUrl }
      setFetched({ model, state })
    })
    return () => {
      cancel = true
    }
  }, [archive.hasStableFolder, connected, model, support.supported])

  const catalog: CatalogState = !connected || !support.supported
      ? { status: 'idle', images: [], pageUrl: archive.stable }
      : !archive.hasStableFolder
        ? { status: 'missing', images: [], pageUrl: archive.stable }
        : fetched?.model === model
          ? fetched.state
          : { status: 'loading', images: [], pageUrl: archive.stable }

  const applyFile = (bytes: Uint8Array, name: string) => {
    const detected = versionFromFirmwareImage(bytes, name)
    setData(bytes)
    setFileName(name)
    setVersion(detected.version)
    setAllowDowngrade(false)
    setConfirm(null)
    setFlash(initialFlash())
    setDownloadFailed(false)
  }

  const start = () => {
    if (!data) return
    setConfirm(null)
    setBusy(true)
    setFlash(initialFlash())
    void printer
      .flashFirmware({ data, fileName, version, allowDowngrade }, setFlash)
      .then(setFlash)
      .finally(() => setBusy(false))
  }

  const ask = () => {
    if (!assessment.ok) return
    setConfirm(assessment.downgrade ? 'downgrade' : 'flash')
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-[var(--danger)] p-3" data-testid="firmware-panel">
      <p className="text-sm font-bold leading-5 text-[var(--danger)]">{t('flashLead', { model: label })}</p>
      <p className="text-xs leading-5 text-[var(--text)]">{t('flashWarn', { hw: hardware || '—', sw: software || '—' })}</p>
      <p className="text-xs leading-5" data-testid="firmware-support">
        {t('firmware')}: {software || '—'} · {t('hardware')}: {hardware || '—'} · {t('protocol')}: {link.protocol ?? '—'}
      </p>
      {!connected && <p className="text-xs leading-5 text-[var(--danger)]">{t('flashOffline')}</p>}
      {connected && !support.supported && (
        <p className="text-xs font-bold leading-5 text-[var(--danger)]" data-testid="firmware-unsupported">
          {t('flashUnsupported', { model: label, protocol: link.protocol ?? '—' })}
        </p>
      )}
      {connected && support.supported && <p className="text-xs leading-5 text-[var(--muted)]">{t('flashSupportedNote')}</p>}
      {connected && support.supported && (
        <p className="text-xs leading-5" data-testid="firmware-power">
          {power === 'low' && t('flashBattery', { n: link.battery ?? 0 })}
          {power === 'usb' && t('flashBatteryUsb')}
          {power === 'unknown' && t('flashBatteryUnknown')}
          {power === 'level' && link.battery !== null && `${t('battery')} ${link.battery}%`}
        </p>
      )}
      {connected && link.lid === false && <p className="text-xs font-bold leading-5 text-[var(--danger)]">{t('flashLidBlock')}</p>}
      {connected && link.printing && <p className="text-xs font-bold leading-5 text-[var(--danger)]">{t('flashBusyBlock')}</p>}
      <p className="text-xs leading-5 text-[var(--danger)]">{t('flashStay')}</p>
      {live && !flash.awake && flash.phase !== 'idle' && <p className="text-xs leading-5">{t('flashNoWake')}</p>}

      <div className="flex flex-col gap-1 text-xs leading-5" data-testid="firmware-catalog">
        <p className="font-bold">{t('flashCatalogTitle')}</p>
        <p>
          <a className="font-bold text-[var(--accent)] underline" href={connected && model ? archive.stable : 'https://fw.niim.blue/stable/'} target="_blank" rel="noreferrer">
            {connected && model
              ? archive.hasStableFolder
                ? t('flashLink', { model: label })
                : t('flashNoFolder', { model: label })
              : t('flashLink', { model: 'Niimbot' })}
          </a>
          {connected && archive.testing && (
            <>
              {' · '}
              <a className="font-bold text-[var(--accent)] underline" href={archive.testing} target="_blank" rel="noreferrer">
                {t('flashTesting', { model: label })}
              </a>
            </>
          )}
        </p>
        {connected && catalog.status === 'loading' && <p>{t('flashCatalogLoading')}</p>}
        {connected && catalog.status === 'cors' && <p>{t('flashCatalogCors')}</p>}
        {connected && catalog.status === 'missing' && <p>{t('flashCatalogMissing')}</p>}
        {catalog.status === 'http' && <p>{t('flashCatalogHttp')}</p>}
        {catalog.status === 'parse' && <p>{t('flashCatalogParse')}</p>}
        {catalog.status === 'ready' && (
          <>
            <p>{t('flashCatalogReady')}</p>
            <ul className="flex flex-col gap-1">
              {catalog.images.map((image) => (
                <li key={image.href} className="flex items-center justify-between gap-2">
                  <span className="truncate font-bold">{image.name}</span>
                  <button
                    type="button"
                    className="shrink-0 font-bold text-[var(--accent)] underline disabled:opacity-40"
                    disabled={live}
                    onClick={() => {
                      void downloadFirmwareImage(image.href)
                        .then((bytes) => applyFile(bytes, image.name))
                        .catch(() => setDownloadFailed(true))
                    }}
                  >
                    {t('flashCatalogPick')}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {downloadFailed && <p className="text-[var(--danger)]">{t('flashCatalogHttp')}</p>}
      </div>

      <label className="text-xs font-bold text-[var(--muted)]">
        {t('flashFile')}
        <input
          type="file"
          accept=".bin,application/octet-stream"
          data-testid="firmware-file"
          disabled={live}
          className="mt-1 block w-full text-sm font-bold text-[var(--text)]"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            void file.arrayBuffer().then((buffer) => applyFile(new Uint8Array(buffer), file.name))
          }}
        />
      </label>
      {fileName && <p className="truncate text-xs font-bold">{fileName}</p>}
      <label className="text-xs font-bold text-[var(--muted)]">
        {t('flashVersion')}
        <input
          data-testid="firmware-version"
          className="mt-1 h-11 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-3 text-base font-bold text-[var(--text)]"
          value={version}
          disabled={live}
          onChange={(event) => {
            setVersion(event.target.value)
            setConfirm(null)
            setFlash(initialFlash())
          }}
        />
      </label>
      {assessment.ok && !assessment.downgrade && software && version === software && (
        <p className="text-xs leading-5">{t('flashSame', { ver: version })}</p>
      )}
      {(canForce || allowDowngrade) && (
        <CheckRow
          checked={allowDowngrade}
          onChange={(checked) => {
            setAllowDowngrade(checked)
            setConfirm(null)
          }}
        >
          {t('flashForce')}
        </CheckRow>
      )}
      {(canForce || allowDowngrade) && <p className="text-xs leading-5 text-[var(--muted)]">{t('flashForceHint')}</p>}
      {!assessment.ok && assessment.code !== 'offline' && assessment.code !== 'unsupported' && data && (
        <p className="text-xs font-bold leading-5 text-[var(--danger)]" data-testid="firmware-error">
          {blockText(assessment.code, t, { model: label, hw: hardware || '—', sw: software || '—', ver: version, n: link.battery ?? 0 })}
        </p>
      )}

      <Button
        className="!bg-[var(--danger)] !text-white"
        data-testid="firmware-burn"
        disabled={!assessment.ok || live || confirm !== null}
        onClick={ask}
      >
        {t('flashBurn')}
      </Button>

      {confirm === 'downgrade' && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--danger)] p-3" data-testid="firmware-downgrade">
          <p className="text-sm font-bold leading-5">{t('flashDowngradeAsk', { model: label, sw: software || '—', ver: version })}</p>
          <div className="flex gap-2">
            <Button className="!bg-[var(--danger)] !text-white" onClick={() => setConfirm('flash')}>
              {t('flashYes')}
            </Button>
            <Button onClick={() => setConfirm(null)}>{t('flashNo')}</Button>
          </div>
        </div>
      )}
      {confirm === 'flash' && (
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--danger)] p-3" data-testid="firmware-confirm">
          <p className="text-sm font-bold leading-5">{t('flashAsk', { file: fileName, ver: version, model: label, sw: software || '—' })}</p>
          <div className="flex gap-2">
            <Button className="!bg-[var(--danger)] !text-white" onClick={start}>
              {t('flashYes')}
            </Button>
            <Button onClick={() => setConfirm(null)}>{t('flashNo')}</Button>
          </div>
        </div>
      )}

      {LIVE.has(flash.phase) && (
        <div data-testid="firmware-progress">
          <p className="mb-1 text-xs font-bold" aria-live="polite">
            {stageText(flash, t)}
          </p>
          <div
            className="h-2 overflow-hidden rounded-full bg-[var(--hover)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={flash.percent}
          >
            <div className="h-full bg-[var(--danger)]" style={{ width: `${Math.max(flash.percent, 4)}%` }} />
          </div>
        </div>
      )}
      {flash.phase === 'done' && (
        <p className="text-xs font-bold leading-5 text-[var(--text)]" data-testid="firmware-done">
          {t('flashVerified', { ver: shownVersion(flash.reported) || version })}
        </p>
      )}
      {flash.phase === 'failed' && (
        <p className="text-xs font-bold leading-5 text-[var(--danger)]" data-testid="firmware-failed">
          {failText(flash, t, { got: shownVersion(flash.reported) || '—', ver: version })}
        </p>
      )}
      {flash.phase === 'blocked' && (
        <p className="text-xs font-bold leading-5 text-[var(--danger)]">
          {blockText(flash.code as FirmwareBlock, t, { model: label, hw: hardware || '—', sw: software || '—', ver: version, n: link.battery ?? 0 })}
        </p>
      )}

      <div>
        <p className="text-xs font-bold">{t('flashRecoveryTitle')}</p>
        <p className="whitespace-pre-line text-xs leading-5 text-[var(--muted)]">{t('flashRecovery')}</p>
      </div>
    </div>
  )
}

function stageText(flash: FlashView, t: (key: I18nKey, vars?: Record<string, string | number>) => string) {
  if (flash.phase === 'uploading') return t('flashStageUpload', { percent: flash.percent, chunk: flash.chunk, chunks: flash.chunks })
  if (flash.phase === 'finishing') return t('flashStageFinish')
  if (flash.phase === 'rebooting') return t('flashStageReboot')
  if (flash.phase === 'reconnecting') return t('flashStageReconnect')
  return t('flashStageVerify')
}

function blockText(
  code: FirmwareBlock | FlashCode,
  t: (key: I18nKey, vars?: Record<string, string | number>) => string,
  vars: { model: string; hw: string; sw: string; ver: string; n: number },
) {
  if (code === 'battery') return t('flashBattery', { n: vars.n })
  if (code === 'lid') return t('flashLidBlock')
  if (code === 'busy') return t('flashBusyBlock')
  if (code === 'empty') return t('flashNeedFile')
  if (code === 'size') return t('flashSize')
  if (code === 'conflict') return t('flashConflict')
  if (code === 'version') return t('flashBadVersion')
  if (code === 'model') return t('flashModel', { model: vars.model })
  if (code === 'major') return t('flashMajor', { hw: vars.hw, sw: vars.sw })
  if (code === 'downgrade') return t('flashOlder', { ver: vars.ver, sw: vars.sw })
  if (code === 'unsupported') return t('flashUnsupported', { model: vars.model, protocol: '—' })
  if (code === 'offline') return t('flashOffline')
  return t('flashUnknown')
}

function failText(
  flash: FlashView,
  t: (key: I18nKey, vars?: Record<string, string | number>) => string,
  vars: { got: string; ver: string },
) {
  if (flash.code === 'rejected') return t('flashRejected')
  if (flash.code === 'crc') return t('flashCrc')
  if (flash.code === 'timeout') return t('flashTimeout')
  if (flash.code === 'link' || flash.code === 'notConnected') return t('flashDropped')
  if (flash.code === 'reconnect') return t('flashReconnectFail')
  if (flash.code === 'verify') return t('flashVerifyMismatch', vars)
  return t('flashUnknown')
}
