import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkFirmware, firmwareFileModel } from './printer-profile'
import {
  D11_H_HEADER_MODEL,
  compareFirmwareVersions,
  downloadFirmwareOffer,
  firmwareHeaderModel,
  firmwareManifestUrl,
  listFirmwareOffers,
  loadFirmwareManifest,
  parseFirmwareManifest,
  resolveFirmwareUrl,
  sha256Hex,
} from './firmware-catalog'

const manifest = JSON.parse(readFileSync('public/firmware/d11_h/manifest.json', 'utf8')) as unknown
const offers = () => parseFirmwareManifest(manifest)

describe('firmware manifest', () => {
  it('resolves under the GitHub Pages base and stays on this origin', () => {
    expect(firmwareManifestUrl('/metka/')).toBe('/metka/firmware/d11_h/manifest.json')
    expect(resolveFirmwareUrl('firmware/d11_h/stock/t_D11_H_4.28.bin', '/metka')).toBe(
      '/metka/firmware/d11_h/stock/t_D11_H_4.28.bin',
    )
    expect(firmwareManifestUrl('/')).toBe('/firmware/d11_h/manifest.json')
  })

  it('parses the published D11_H set and matches the bytes on disk', () => {
    const rows = offers()
    expect(rows).toHaveLength(7)
    expect(new Set(rows.map((row) => row.model))).toEqual(new Set(['D11_H']))
    expect(rows.filter((row) => row.kind === 'patched')).toHaveLength(4)
    expect(rows.filter((row) => row.kind === 'original')).toHaveLength(1)
    expect(rows.filter((row) => row.kind === 'stock')).toHaveLength(2)
    expect(rows.filter((row) => row.stable).map((row) => row.name)).toEqual(['D11_H_4.27_stable.bin'])
    expect(rows.filter((row) => row.recommend).map((row) => row.name)).toEqual([
      'D11_H_4.28_rfid-bypass-density-history-reset-used-ignore.bin',
    ])
    for (const row of rows) {
      const bytes = readFileSync(`public/${row.url}`)
      expect(bytes.byteLength).toBe(row.size)
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(row.sha256)
      expect(firmwareHeaderModel(bytes)).toBe(D11_H_HEADER_MODEL)
      expect(firmwareFileModel(row.name)).toBe('D11_H')
      if (row.kind === 'patched') {
        expect(row.notes).toMatch(/своего принтера/i)
        expect(row.notes).toMatch(/не принимает понижение/)
      }
    }
  })

  it('rejects a row whose name, hash, or url does not belong to that model', () => {
    const [first] = offers()
    expect(first).toBeTruthy()
    expect(() => parseFirmwareManifest({ firmwares: [{ ...first, model: 'B21_PRO' }] })).toThrow(/parse/)
    expect(() => parseFirmwareManifest({ firmwares: [{ ...first, sha256: 'ab' }] })).toThrow(/parse/)
    expect(() => parseFirmwareManifest({ firmwares: [{ ...first, url: 'https://example.com/a.bin' }] })).toThrow(/parse/)
    expect(() => parseFirmwareManifest({ firmwares: [{ ...first, url: '../secret.bin', name: '../secret.bin' }] })).toThrow(/parse/)
    expect(() => parseFirmwareManifest({ firmwares: [{ ...first, version: '9.99' }] })).toThrow(/parse/)
    expect(() => parseFirmwareManifest({})).toThrow(/parse/)
  })

  it('loads JSON from the same-origin url and reports a failed fetch', async () => {
    const ok: typeof fetch = async () => new Response(JSON.stringify(manifest), { status: 200 })
    const loaded = await loadFirmwareManifest({ fetchImpl: ok, base: '/metka/' })
    expect(loaded.ok && loaded.firmwares).toHaveLength(7)
    expect(loaded.ok && loaded.url).toBe('/metka/firmware/d11_h/manifest.json')
    const failed: typeof fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    expect(await loadFirmwareManifest({ fetchImpl: failed, base: '/metka/' })).toMatchObject({ ok: false, reason: 'cors' })
    const broken: typeof fetch = async () => new Response('not-json', { status: 200 })
    expect(await loadFirmwareManifest({ fetchImpl: broken, base: '/' })).toMatchObject({ ok: false, reason: 'parse' })
  })
})

describe('firmware catalog ordering', () => {
  it('compares versions numerically and maps testing and patched names to D11_H', () => {
    expect(compareFirmwareVersions('4.9', '4.28')).toBeLessThan(0)
    expect(compareFirmwareVersions('4.28', '4.27')).toBeGreaterThan(0)
    expect(compareFirmwareVersions('4.28', '4.28')).toBe(0)
    expect(compareFirmwareVersions('4.28/1.0', '4.28')).toBe(0)
    expect(compareFirmwareVersions('nope', '4.28')).toBeNull()
    expect(firmwareFileModel('D11_H_4.28_rfid-bypass-density-history-reset-used-ignore.bin')).toBe('D11_H')
    expect(firmwareFileModel('t_D11_H_4.28.bin')).toBe('D11_H')
    expect(firmwareFileModel('D11_H_4.27_stable.bin')).toBe('D11_H')
    expect(firmwareFileModel('B21_Pro_3.13.bin')).toBe('B21_PRO')
    expect(firmwareFileModel('B1 Pro_2.12.bin')).toBe('B1_PRO')
    expect(firmwareFileModel('firmware.bin')).toBeNull()
  })

  it('offers the D11_H list only for a connected D11_H and puts the safe recommendation first', () => {
    const rows = offers()
    expect(listFirmwareOffers(rows, { model: 'B21_PRO', hardware: '3.01', software: '3.13' })).toEqual([])
    expect(listFirmwareOffers(rows, { model: 'D110', hardware: '4.01', software: '4.28' })).toEqual([])
    expect(listFirmwareOffers(rows, { model: '', hardware: '4.01', software: '4.28' })).toEqual([])

    const on428 = listFirmwareOffers(rows, { model: 'D11_H', hardware: '4.01', software: '4.28' })
    expect(on428.map((row) => row.name)).toEqual([
      'D11_H_4.28_rfid-bypass-density-history-reset-used-ignore.bin',
      'D11_H_4.27_stable.bin',
      't_D11_H_4.28.bin',
      'D11_H_4.28_original.bin',
      'D11_H_4.28_rfid-bypass-density-history-reset.bin',
      'D11_H_4.28_rfid-bypass-density.bin',
      'D11_H_4.28_rfid-bypass.bin',
    ])
    expect(on428[0]).toMatchObject({ recommended: true, relation: 'current', kind: 'patched', stable: false })
    expect(on428.find((row) => row.name === 'D11_H_4.27_stable.bin')).toMatchObject({
      relation: 'older',
      stable: true,
      recommended: false,
      kind: 'stock',
    })
    expect(on428.filter((row) => row.recommended)).toHaveLength(1)

    const on427 = listFirmwareOffers(rows, { model: 'd11-h', hardware: '4.01', software: '4.27/1.00' })
    expect(on427[0]).toMatchObject({ name: 'D11_H_4.28_rfid-bypass-density-history-reset-used-ignore.bin', relation: 'newer', recommended: true })
    expect(on427.find((row) => row.stable)).toMatchObject({ relation: 'current', recommended: false })

    const ahead = listFirmwareOffers(rows, { model: 'D11_H', hardware: '4.01', software: '4.29' })
    expect(ahead.every((row) => row.recommended === false)).toBe(true)
    expect(ahead.find((row) => row.recommend)).toMatchObject({ relation: 'older' })

    const otherMajor = listFirmwareOffers(rows, { model: 'D11_H', hardware: '5.01', software: '5.14' })
    expect(otherMajor.every((row) => row.recommended === false)).toBe(true)
  })

  it('keeps the model, major, and downgrade gates for these file names', () => {
    expect(
      checkFirmware({
        model: 'D11_H',
        hardware: '4.01',
        software: '4.28',
        fileName: 'D11_H_4.28_rfid-bypass-density-history-reset-used-ignore.bin',
        version: '4.28',
      }),
    ).toEqual({ ok: true })
    expect(
      checkFirmware({
        model: 'D11_H',
        hardware: '4.01',
        software: '4.28',
        fileName: 't_D11_H_4.28.bin',
        version: '4.28',
      }),
    ).toEqual({ ok: true })
    expect(
      checkFirmware({
        model: 'D11_H',
        hardware: '4.01',
        software: '4.28',
        fileName: 'D11_H_4.27_stable.bin',
        version: '4.27',
      }),
    ).toEqual({ ok: false, code: 'downgrade' })
    expect(
      checkFirmware({
        model: 'D11_H',
        hardware: '4.01',
        software: '4.28',
        fileName: 'B21_Pro_3.13.bin',
        version: '3.13',
      }),
    ).toEqual({ ok: false, code: 'model' })
    expect(
      checkFirmware({
        model: 'D11_H',
        hardware: '5.01',
        software: '5.14',
        fileName: 'D11_H_4.28_original.bin',
        version: '4.28',
        allowDowngrade: true,
      }).ok,
    ).toBe(false)
  })
})

describe('firmware download check', () => {
  it('hashes with sha256 and refuses a file that does not match the row', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    const offer = offers().find((row) => row.recommend)
    if (!offer) throw new Error('missing recommendation')
    const bytes = readFileSync(`public/${offer.url}`)
    const good: typeof fetch = async (input) => {
      expect(String(input)).toBe(`/metka/${offer.url}`)
      return new Response(bytes, { status: 200 })
    }
    const downloaded = await downloadFirmwareOffer(offer, { fetchImpl: good, base: '/metka/' })
    expect(downloaded.ok && downloaded.bytes.byteLength).toBe(offer.size)

    const wrong: typeof fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    expect(await downloadFirmwareOffer(offer, { fetchImpl: wrong, base: '/metka/' })).toEqual({ ok: false, reason: 'size' })

    const sameSize = offers().find((row) => row.name === 'D11_H_4.28_rfid-bypass.bin')
    const original = offers().find((row) => row.kind === 'original')
    if (!sameSize || !original) throw new Error('missing pair')
    const otherBytes = new Uint8Array(readFileSync(`public/${original.url}`))
    const mismatch: typeof fetch = async () => new Response(otherBytes, { status: 200 })
    expect(await downloadFirmwareOffer(sameSize, { fetchImpl: mismatch, base: '/' })).toEqual({ ok: false, reason: 'sha' })

    const offline: typeof fetch = async () => new Response('', { status: 404 })
    expect(await downloadFirmwareOffer(offer, { fetchImpl: offline, base: '/' })).toEqual({ ok: false, reason: 'http' })
  })
})
