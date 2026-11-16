import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  clearUnlock,
  currentPinGate,
  pinMatches,
  pinRetryDelayMs,
  readUnlock,
  writeUnlock,
  type PinGateConfig,
  type PinStore,
} from '../lib/pin'
import { useI18n } from './state'
import { cx } from './ui'

type PinLockValue = {
  enabled: boolean
  lock: () => void
}

const PinLockContext = createContext<PinLockValue>({ enabled: false, lock: () => undefined })

export function PinLockItem({ label }: { label: string }) {
  const { enabled, lock } = useContext(PinLockContext)
  if (!enabled) return null
  return (
    <button type="button" onClick={lock} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[var(--hover)]">
      {label}
    </button>
  )
}

function browserStore(): PinStore | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function remembered(gate: PinGateConfig): boolean {
  const store = browserStore()
  if (!store) return false
  return readUnlock(store, gate.hash)
}

export function PinGate({ children }: { children: ReactNode }) {
  const [gate] = useState(() => currentPinGate())
  const [locked, setLocked] = useState(() => (gate ? !remembered(gate) : false))
  const lock = useCallback(() => {
    const store = browserStore()
    if (store) {
      try {
        clearUnlock(store)
      } catch {
        /* this session still locks */
      }
    }
    setLocked(true)
  }, [])
  const value = useMemo<PinLockValue>(() => ({ enabled: gate !== null, lock }), [gate, lock])

  if (gate && locked) {
    return (
      <PinScreen
        gate={gate}
        onUnlock={() => {
          const store = browserStore()
          if (store) {
            try {
              writeUnlock(store, gate.hash)
            } catch {
              /* unlocked for this session only */
            }
          }
          setLocked(false)
        }}
      />
    )
  }

  return <PinLockContext.Provider value={value}>{children}</PinLockContext.Provider>
}

function PinScreen({ gate, onUnlock }: { gate: PinGateConfig; onUnlock: () => void }) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const checking = useRef(false)
  const [digits, setDigits] = useState('')
  const [wrong, setWrong] = useState(false)
  const [failed, setFailed] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const waiting = waitUntil !== 0

  useEffect(() => {
    if (waitUntil === 0) return
    const timer = window.setTimeout(() => setWaitUntil(0), Math.max(0, waitUntil - Date.now()))
    return () => window.clearTimeout(timer)
  }, [waitUntil])

  useEffect(() => {
    if (!waiting) inputRef.current?.focus()
  }, [waiting])

  const miss = () => {
    const next = failed + 1
    setFailed(next)
    setDigits('')
    setWrong(true)
    const delay = pinRetryDelayMs(next)
    if (delay > 0) setWaitUntil(Date.now() + delay)
  }

  const submit = async (pin: string) => {
    if (checking.current || waiting) return
    checking.current = true
    try {
      if (await pinMatches(pin, gate.salt, gate.hash)) onUnlock()
      else miss()
    } catch {
      miss()
    } finally {
      checking.current = false
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[var(--text)]">
      <div className="mb-8 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--text)] text-xs font-black text-[var(--bg)]">M</span>
        <span className="text-[17px] font-black tracking-tight">{t('appName')}</span>
      </div>
      <h1 className="mb-6 text-xl font-black tracking-tight">{t('pinTitle')}</h1>
      <label className="relative block">
        <span className="sr-only">{t('pinLabel')}</span>
        <span className="flex justify-center gap-3" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => {
            const filled = digits[index] ?? ''
            const active = !waiting && !wrong && index === digits.length
            return (
              <span
                key={index}
                className={cx(
                  'grid h-14 w-12 place-items-center rounded-2xl border-2 bg-[var(--field)] text-2xl font-black tabular-nums',
                  waiting && 'opacity-40',
                  wrong ? 'border-[var(--danger)]' : active ? 'border-[var(--accent)]' : 'border-[var(--border)]',
                )}
              >
                {filled}
              </span>
            )
          })}
        </span>
        <input
          ref={inputRef}
          className="absolute inset-0 cursor-text text-base opacity-0 disabled:cursor-default"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          autoFocus
          aria-invalid={wrong}
          aria-describedby={wrong || waiting ? 'pin-status' : undefined}
          disabled={waiting}
          value={digits}
          onChange={(event) => {
            if (checking.current || waitUntil !== 0) return
            const next = event.target.value.replace(/\D/g, '').slice(0, 4)
            setDigits(next)
            if (wrong) setWrong(false)
            if (next.length === 4) void submit(next)
          }}
        />
      </label>
      <div id="pin-status" className="mt-4 min-h-10 text-center" role="status" aria-live="polite">
        {wrong && <p className="text-sm font-bold text-[var(--danger)]">{t('pinWrong')}</p>}
        {waiting && <p className="mt-1 text-sm text-[var(--muted)]">{t('pinWait')}</p>}
      </div>
      <p className="mt-2 max-w-xs text-center text-xs leading-5 text-[var(--muted)]">{t('pinHint')}</p>
    </main>
  )
}
