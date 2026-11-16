import { describe, expect, it } from 'vitest'
import { getPrinterMetaById } from '@mmote/niimbluelib'
import { checkFirmware } from './printer-profile'
import {
  BATTERY_MIN,
  assessFirmware,
  firmwareArchive,
  firmwareSupport,
  firmwareVersionsMatch,
  loadFirmwareCatalog,
  mapUpgradeError,
  parseFirmwareIndex,
  powerForFlash,
  versionFromFirmwareImage,
  type FirmwareAssessment,
} from './firmware'
import { initialFlash, reduceFlash, runFirmwareUpgrade, type FirmwareJob, type FirmwarePort, type FlashView } from './firmware-machine'

const owner = {
  connected: true,
  model: 'B21_PRO',
  protocol: 5,
  hardware: '3.01',
  software: '3.13',
  battery: 80,
  lid: true,
  transport: 'bluetooth' as const,
  printing: false,
  charging: null,
}

const image = (name: string, version = '3.14') => {
  const bytes = new Uint8Array(64)
  bytes[0] = 0x18
  const [major = 0, minor = 0] = version.split('.').map((part) => Number(part))
  const packed = major * 100 + minor
  bytes[0x14] = packed & 0xff
  bytes[0x15] = packed >> 8
  return { bytes, name, version }
}

describe('firmware support', () => {
  it('offers the one library flasher to every identified model on protocol 1, 3, 4, or 5', () => {
    expect(getPrinterMetaById(785)?.model).toBe('B21_PRO')
    expect(firmwareSupport('B21_PRO', 5)).toEqual({ supported: true })
    expect(firmwareSupport('D11_H', 4)).toEqual({ supported: true })
    expect(firmwareSupport('D110', 1)).toEqual({ supported: true })
    expect(firmwareSupport('B1', 3)).toEqual({ supported: true })
    expect(firmwareSupport('B21_PRO', 0)).toEqual({ supported: false, reason: 'protocol' })
    expect(firmwareSupport('B21_PRO', 2)).toEqual({ supported: false, reason: 'protocol' })
    expect(firmwareSupport('B21_PRO', null)).toEqual({ supported: false, reason: 'protocol' })
    expect(firmwareSupport('#785', 5)).toEqual({ supported: false, reason: 'model' })
    expect(firmwareSupport('UNKNOWN', 5)).toEqual({ supported: false, reason: 'model' })
    expect(firmwareSupport('', 5)).toEqual({ supported: false, reason: 'model' })
  })

  it('points every archived model at its fw.niim.blue folder and nowhere else', () => {
    expect(firmwareArchive('B21_PRO')).toEqual({
      stable: 'https://fw.niim.blue/stable/B21_Pro/',
      testing: 'https://fw.niim.blue/testing/B21_Pro/',
      hasStableFolder: true,
    })
    expect(firmwareArchive('D11_H').stable).toBe('https://fw.niim.blue/stable/D11_H/')
    expect(firmwareArchive('B1_PRO').stable).toBe('https://fw.niim.blue/stable/B1%20Pro/')
    expect(firmwareArchive('B21_C2B').stable).toBe('https://fw.niim.blue/stable/B21-C2B/')
    expect(firmwareArchive('D11_PRO')).toEqual({
      stable: 'https://fw.niim.blue/stable/',
      testing: null,
      hasStableFolder: false,
    })
    expect(firmwareArchive('B18S').testing).toBe('https://fw.niim.blue/testing/B18S/')
    expect(firmwareArchive('B18S').hasStableFolder).toBe(false)
  })
})

describe('firmware file checks', () => {
  it('reads the modern header and refuses a name that disagrees', () => {
    const bin = image('B21_Pro_3.13.bin', '3.13')
    expect(versionFromFirmwareImage(bin.bytes, bin.name)).toEqual({ version: '3.13', conflict: false })
    expect(versionFromFirmwareImage(bin.bytes, 'B21_Pro_3.14.bin').conflict).toBe(true)
    const bare = new Uint8Array([1, 2, 3, 4])
    expect(versionFromFirmwareImage(bare, 'D11_H_4.28.bin')).toEqual({ version: '4.28', conflict: false })
  })

  it('still blocks the wrong model, major, and downgrade, and allows an explicit downgrade', () => {
    expect(checkFirmware({ model: 'B21_PRO', hardware: '3.01', software: '3.13', fileName: 'B21_Pro_3.12.bin', version: '3.12' })).toEqual({
      ok: false,
      code: 'downgrade',
    })
    expect(
      checkFirmware({
        model: 'B21_PRO',
        hardware: '3.01',
        software: '3.13',
        fileName: 'B21_Pro_3.12.bin',
        version: '3.12',
        allowDowngrade: true,
      }),
    ).toEqual({ ok: true, downgrade: true })
    expect(
      checkFirmware({
        model: 'B21_PRO',
        hardware: '3.01',
        software: '3.13',
        fileName: 'B21_Pro_2.26.bin',
        version: '2.26',
        allowDowngrade: true,
      }).ok,
    ).toBe(false)
    expect(
      checkFirmware({
        model: 'B1_PRO',
        hardware: '2.18',
        software: '2.09',
        fileName: 'B1 Pro_2.12.bin',
        version: '2.12',
      }).ok,
    ).toBe(true)
  })

  it('refuses a low Bluetooth battery, an open lid, and a print in progress', () => {
    expect(BATTERY_MIN).toBe(50)
    expect(powerForFlash({ battery: 49, transport: 'bluetooth', charging: null })).toBe('low')
    expect(powerForFlash({ battery: 49, transport: 'serial', charging: null })).toBe('usb')
    expect(powerForFlash({ battery: 10, transport: 'bluetooth', charging: true })).toBe('charging')
    expect(powerForFlash({ battery: null, transport: 'bluetooth', charging: null })).toBe('unknown')
    expect(powerForFlash({ battery: 50, transport: 'bluetooth', charging: false })).toBe('level')

    const file = image('B21_Pro_3.14.bin')
    expect(code(assess({ ...owner, battery: 49, data: file.bytes, fileName: file.name, version: file.version }))).toBe('battery')
    expect(assess({ ...owner, battery: 49, transport: 'serial', data: file.bytes, fileName: file.name, version: file.version }).ok).toBe(true)
    expect(assess({ ...owner, battery: 10, charging: true, data: file.bytes, fileName: file.name, version: file.version }).ok).toBe(true)
    expect(code(assess({ ...owner, lid: false, data: file.bytes, fileName: file.name, version: file.version }))).toBe('lid')
    expect(assess({ ...owner, lid: null, data: file.bytes, fileName: file.name, version: file.version }).ok).toBe(true)
    expect(code(assess({ ...owner, printing: true, data: file.bytes, fileName: file.name, version: file.version }))).toBe('busy')
    expect(code(assess({ ...owner, connected: false, data: file.bytes, fileName: file.name, version: file.version }))).toBe('offline')
    expect(code(assess({ ...owner, protocol: 0, data: file.bytes, fileName: file.name, version: file.version }))).toBe('unsupported')
    expect(code(assess({ ...owner, data: new Uint8Array(), fileName: file.name, version: file.version }))).toBe('empty')
    expect(code(assess({ ...owner, data: file.bytes, fileName: 'D11_H_4.28.bin', version: '4.28' }))).toBe('conflict')
    expect(code(assess({ ...owner, data: file.bytes, fileName: 'D11_H_3.14.bin', version: '3.14' }))).toBe('model')
    const older = image('B21_Pro_3.12.bin', '3.12')
    expect(code(assess({ ...owner, data: older.bytes, fileName: older.name, version: older.version }))).toBe('downgrade')
    expect(assess({ ...owner, data: older.bytes, fileName: older.name, version: older.version, allowDowngrade: true })).toMatchObject({
      ok: true,
      downgrade: true,
    })
  })
})

describe('firmware catalog', () => {
  it('parses a directory listing and sorts newest first', () => {
    const html = `
      <a href="B21_Pro_3.12.bin">B21_Pro_3.12.bin</a>
      <a href="B21_Pro_3.13.bin">B21_Pro_3.13.bin</a>
      <a href="../">Parent</a>
      <a href="B1%20Pro_2.09.bin">B1 Pro_2.09.bin</a>
    `
    expect(parseFirmwareIndex(html, 'https://fw.niim.blue/stable/B21_Pro/')).toEqual([
      { name: 'B21_Pro_3.13.bin', version: '3.13', href: 'https://fw.niim.blue/stable/B21_Pro/B21_Pro_3.13.bin' },
      { name: 'B21_Pro_3.12.bin', version: '3.12', href: 'https://fw.niim.blue/stable/B21_Pro/B21_Pro_3.12.bin' },
      { name: 'B1 Pro_2.09.bin', version: '2.09', href: 'https://fw.niim.blue/stable/B21_Pro/B1%20Pro_2.09.bin' },
    ])
  })

  it('reports CORS instead of pretending the archive can be listed', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    expect(await loadFirmwareCatalog('B21_PRO', fetchImpl)).toEqual({
      ok: false,
      reason: 'cors',
      pageUrl: 'https://fw.niim.blue/stable/B21_Pro/',
    })
    expect(await loadFirmwareCatalog('D11_PRO', fetchImpl)).toMatchObject({ ok: false, reason: 'missing' })
    const ok: typeof fetch = async () =>
      new Response('<a href="B21_Pro_3.13.bin">B21_Pro_3.13.bin</a>', { status: 200 })
    const listed = await loadFirmwareCatalog('B21_PRO', ok)
    expect(listed.ok && listed.images.map((item) => item.version)).toEqual(['3.13'])
  })
})

describe('firmware upgrade state machine', () => {
  it('moves through upload, commit, reboot, reconnect, and verify', () => {
    let state = initialFlash()
    state = reduceFlash(state, { type: 'upload', awake: true })
    state = reduceFlash(state, { type: 'progress', current: 1, total: 4 })
    expect(state).toMatchObject({ phase: 'uploading', percent: 25, chunk: 1, chunks: 4, sent: false })
    state = reduceFlash(state, { type: 'progress', current: 4, total: 4 })
    expect(state.phase).toBe('finishing')
    expect(state.percent).toBe(100)
    state = reduceFlash(state, { type: 'sent' })
    expect(state).toMatchObject({ phase: 'rebooting', sent: true })
    state = reduceFlash(state, { type: 'reconnect' })
    state = reduceFlash(state, { type: 'verify', reported: '3.14' })
    state = reduceFlash(state, { type: 'done', reported: '3.14/7.81' })
    expect(state).toMatchObject({ phase: 'done', reported: '3.14/7.81', code: '' })
    expect(firmwareVersionsMatch('3.14', '3.14/7.81')).toBe(true)
    expect(reduceFlash(initialFlash(), { type: 'sent' }).phase).toBe('idle')
    expect(reduceFlash(initialFlash(), { type: 'done', reported: '3.14' }).phase).toBe('idle')
  })

  it('flashes a B21 Pro image and checks the version that comes back', async () => {
    const file = image('B21_Pro_3.14.bin', '3.14')
    const { port, calls } = mockPort({ software: '3.14' })
    const seen: FlashView[] = []
    const wake = wakeLock()
    const result = await runFirmwareUpgrade(port, job(file), {
      rebootMs: 0,
      reconnectTries: 2,
      reconnectGapMs: 0,
      sleep: async () => undefined,
      holdAwake: wake.hold,
      onUpdate: (view) => seen.push(view),
    })
    expect(result).toMatchObject({ phase: 'done', reported: '3.14', sent: true, awake: true })
    expect(calls.upgrade).toBe(1)
    expect(calls.disconnect).toBe(1)
    expect(calls.heartbeatStop).toBe(1)
    expect(calls.heartbeatStart).toBe(0)
    expect(wake.released).toBe(1)
    expect(seen.map((view) => view.phase)).toEqual(['uploading', 'uploading', 'finishing', 'rebooting', 'reconnecting', 'verifying', 'done'])
  })

  it('does not call the printer when the file, battery, lid, or protocol is refused', async () => {
    const file = image('D11_H_4.28.bin', '4.28')
    const { port, calls } = mockPort({ software: '4.28' })
    const blocked = await runFirmwareUpgrade(port, job(file), { sleep: async () => undefined, holdAwake: wakeLock().hold })
    expect(blocked).toMatchObject({ phase: 'blocked', code: 'model', sent: false })
    expect(calls.upgrade).toBe(0)

    const low = image('B21_Pro_3.14.bin')
    const battery = await runFirmwareUpgrade(port, job(low, { battery: 40 }), { sleep: async () => undefined })
    expect(battery.code).toBe('battery')
    const legacy = await runFirmwareUpgrade(port, job(low, { protocol: 0 }), { sleep: async () => undefined })
    expect(legacy.code).toBe('unsupported')
    const open = await runFirmwareUpgrade(port, job(low, { lid: false }), { sleep: async () => undefined })
    expect(open.code).toBe('lid')
    expect(calls.upgrade).toBe(0)
  })

  it('sends an explicit downgrade once and still refuses a major jump', async () => {
    const older = image('B21_Pro_3.12.bin', '3.12')
    const refused = mockPort({ software: '3.12' })
    const blocked = await runFirmwareUpgrade(refused.port, job(older), { sleep: async () => undefined })
    expect(blocked.code).toBe('downgrade')
    expect(refused.calls.upgrade).toBe(0)

    const allowed = mockPort({ software: '3.12' })
    const sent = await runFirmwareUpgrade(allowed.port, job(older, {}, true), { rebootMs: 0, reconnectGapMs: 0, sleep: async () => undefined })
    expect(sent.phase).toBe('done')
    expect(allowed.calls.upgrade).toBe(1)

    const major = image('B21_Pro_2.26.bin', '2.26')
    const jump = mockPort({ software: '2.26' })
    const refusedMajor = await runFirmwareUpgrade(jump.port, job(major, {}, true), { sleep: async () => undefined })
    expect(refusedMajor.code).toBe('major')
    expect(jump.calls.upgrade).toBe(0)
  })

  it('restarts the heartbeat when the printer rejects the file', async () => {
    const file = image('B21_Pro_3.14.bin')
    const { port, calls } = mockPort({ failUpgrade: 'Firmware rejected: invalid file or downgrade protection.' })
    const wake = wakeLock()
    const result = await runFirmwareUpgrade(port, job(file), { holdAwake: wake.hold, sleep: async () => undefined })
    expect(result).toMatchObject({ phase: 'failed', code: 'rejected', sent: false })
    expect(calls.heartbeatStart).toBe(1)
    expect(calls.disconnect).toBe(0)
    expect(wake.released).toBe(1)
    expect(mapUpgradeError(new Error('Firmware check error (maybe CRC does not match)'))).toBe('crc')
    expect(mapUpgradeError(new Error('Timed out'))).toBe('timeout')
  })

  it('does not flash again when reconnect or the reported version fails', async () => {
    const file = image('B21_Pro_3.14.bin')
    const missing = mockPort({ software: null })
    const dropped = await runFirmwareUpgrade(missing.port, job(file), {
      rebootMs: 0,
      reconnectTries: 2,
      reconnectGapMs: 0,
      sleep: async () => undefined,
    })
    expect(dropped).toMatchObject({ phase: 'failed', code: 'reconnect', sent: true })
    expect(missing.calls.upgrade).toBe(1)
    expect(missing.calls.reconnect).toBe(2)

    const wrong = mockPort({ software: '3.13' })
    const mismatch = await runFirmwareUpgrade(wrong.port, job(file), { rebootMs: 0, reconnectGapMs: 0, sleep: async () => undefined })
    expect(mismatch).toMatchObject({ phase: 'failed', code: 'verify', reported: '3.13', sent: true })
    expect(wrong.calls.upgrade).toBe(1)
  })

  it('retries a reconnect that throws and then accepts the new version', async () => {
    const file = image('B21_Pro_3.13.bin', '3.13')
    let tries = 0
    const { port, calls } = mockPort({
      software: '3.13',
      reconnect: async () => {
        tries += 1
        if (tries === 1) throw new Error('GATT disconnected')
        return { software: '3.13' }
      },
    })
    const result = await runFirmwareUpgrade(port, job(file), {
      rebootMs: 0,
      reconnectTries: 3,
      reconnectGapMs: 0,
      sleep: async () => undefined,
    })
    expect(result.phase).toBe('done')
    expect(calls.upgrade).toBe(1)
    expect(tries).toBe(2)
  })
})

function assess(input: Parameters<typeof assessFirmware>[0]): FirmwareAssessment {
  return assessFirmware(input)
}

function code(result: FirmwareAssessment): string {
  return result.ok ? 'ok' : result.code
}

function job(
  file: { bytes: Uint8Array; name: string; version: string },
  printer: Partial<FirmwareJob['printer']> = {},
  allowDowngrade = false,
): FirmwareJob {
  return {
    data: file.bytes,
    fileName: file.name,
    version: file.version,
    allowDowngrade,
    printer: { ...owner, ...printer },
  }
}

function mockPort(options: {
  software?: string | null
  failUpgrade?: string
  connected?: boolean
  reconnect?: () => Promise<{ software: string } | null>
}) {
  const calls = { upgrade: 0, disconnect: 0, reconnect: 0, heartbeatStop: 0, heartbeatStart: 0 }
  const port: FirmwarePort = {
    connected: () => options.connected !== false,
    stopHeartbeat: () => {
      calls.heartbeatStop += 1
    },
    startHeartbeat: () => {
      calls.heartbeatStart += 1
    },
    upgrade: async (_data, _version, onProgress) => {
      calls.upgrade += 1
      if (options.failUpgrade) throw new Error(options.failUpgrade)
      onProgress(1, 4)
      onProgress(4, 4)
    },
    disconnect: async () => {
      calls.disconnect += 1
    },
    reconnect: async () => {
      calls.reconnect += 1
      if (options.reconnect) return options.reconnect()
      if (options.software == null) return null
      return { software: options.software }
    },
  }
  return { port, calls }
}

function wakeLock() {
  const state = { released: 0, hold: async () => ({ held: true, release: () => { state.released += 1 } }) }
  return state
}
