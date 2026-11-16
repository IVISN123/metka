import { describe, expect, it } from 'vitest'
import {
  PIN_UNLOCK_KEY,
  clearUnlock,
  hashPin,
  hashesEqual,
  pinGateFromEnv,
  pinMatches,
  pinRetryDelayMs,
  readUnlock,
  writeUnlock,
  type PinStore,
} from './pin'

const SALT = 'aabbccddeeff0011'
const PIN = '1234'
const HASH = '77bbfe7132f3a04dd590d83d78e63b577d0ecbcba5f3123822a7ff734b507b5a'

function memory(): PinStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

describe('pin hash', () => {
  it('matches a known salted SHA-256 vector', async () => {
    expect(await hashPin(PIN, SALT)).toBe(HASH)
  })

  it('accepts the PIN that was hashed, including a leading zero', async () => {
    expect(await pinMatches(PIN, SALT, HASH)).toBe(true)
    expect(await pinMatches(PIN, `  ${SALT}  `, HASH.toUpperCase())).toBe(true)
    const zero = await hashPin('0123', SALT)
    expect(await pinMatches('0123', SALT, zero)).toBe(true)
  })

  it('rejects a wrong PIN, the wrong length, and a missing salt or hash', async () => {
    expect(await pinMatches('0000', SALT, HASH)).toBe(false)
    expect(await pinMatches('123', SALT, HASH)).toBe(false)
    expect(await pinMatches('12345', SALT, HASH)).toBe(false)
    expect(await pinMatches('12ab', SALT, HASH)).toBe(false)
    expect(await pinMatches(PIN, '', HASH)).toBe(false)
    expect(await pinMatches(PIN, SALT, '')).toBe(false)
    expect(await pinMatches(PIN, SALT, '   ')).toBe(false)
    expect(await pinMatches(PIN, 'other-salt', HASH)).toBe(false)
  })

  it('compares hashes without treating a different length as equal', () => {
    expect(hashesEqual(HASH, HASH)).toBe(true)
    expect(hashesEqual(HASH, `${HASH}a`)).toBe(false)
    expect(hashesEqual('', '')).toBe(false)
    expect(hashesEqual(HASH, HASH.replace('a', 'b'))).toBe(false)
  })
})

describe('pin gate config', () => {
  it('stays off unless both the hash and the salt are set', () => {
    expect(pinGateFromEnv(undefined, undefined)).toBeNull()
    expect(pinGateFromEnv('', SALT)).toBeNull()
    expect(pinGateFromEnv(HASH, '   ')).toBeNull()
    expect(pinGateFromEnv(1, SALT)).toBeNull()
    expect(pinGateFromEnv(`  ${HASH}  `, ` ${SALT} `)).toEqual({ hash: HASH, salt: SALT })
  })

  it('waits only after several wrong tries', () => {
    expect(pinRetryDelayMs(0)).toBe(0)
    expect(pinRetryDelayMs(2)).toBe(0)
    expect(pinRetryDelayMs(3)).toBe(1500)
    expect(pinRetryDelayMs(4)).toBe(3000)
    expect(pinRetryDelayMs(20)).toBe(8000)
    expect(pinRetryDelayMs(Number.NaN)).toBe(0)
  })
})

describe('pin unlock memory', () => {
  it('remembers this device only for the current hash', () => {
    const store = memory()
    expect(readUnlock(store, HASH)).toBe(false)
    writeUnlock(store, HASH)
    expect(store.data.get(PIN_UNLOCK_KEY)).toBe(HASH)
    expect(readUnlock(store, HASH)).toBe(true)
    expect(readUnlock(store, 'other')).toBe(false)
    clearUnlock(store)
    expect(readUnlock(store, HASH)).toBe(false)
  })

  it('does not throw the gate open when storage fails', () => {
    const store: PinStore = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    }
    expect(readUnlock(store, HASH)).toBe(false)
  })
})
