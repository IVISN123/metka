import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  Bluetooth,
  Languages,
  Layers,
  LayoutTemplate,
  Moon,
  Plus,
  Printer,
  Redo2,
  SlidersHorizontal,
  Sun,
  Undo2,
} from 'lucide-react'
import { engine } from '../engine/editor'
import { parseImport, serializeDesign } from '../lib/bundle'
import { browserSupport } from '../lib/browser'
import { renderDocumentColor, renderDocumentThermal, thumbnailOf } from '../lib/render'
import { listTemplates, saveDesign, saveTemplate, writeAutosave } from '../lib/storage'
import { MODEL_IDS, PRESETS, matchingPreset, metaFor } from '../lib/presets'
import { printer } from '../printer/controller'
import { downloadText, downloadUrl, mmToPx, modelLabel, slug, uid, uniqueName } from '../lib/units'
import { toast } from '../toast'
import type { ThemeName } from '../types'
import { BatchDialog } from './BatchDialog'
import { FontBar } from './FontBar'
import { Gallery } from './Gallery'
import { Inspector, LayerList, ToolPanel } from './Panels'
import { PrintDialog, type BatchJob } from './PrintDialog'
import { Stage, useEngine } from './Stage'
import { useI18n, useTheme } from './state'
import { Button, IconButton, Modal, TextInput, Toasts } from './ui'

export function Shell() {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const { state } = useEngine()
  const link = useSyncExternalStore(printer.subscribe, printer.getSnapshot, printer.getSnapshot)
  const sizeDpi = link.status === 'connected' && link.dpi ? link.dpi : state.dpi
  const [sheet, setSheet] = useState<null | 'tools' | 'layers' | 'props'>(null)
  const [menu, setMenu] = useState<null | 'size' | 'file' | 'theme'>(null)
  const [gallery, setGallery] = useState<null | { tab: 'templates' | 'designs'; compose: boolean }>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batch, setBatch] = useState<BatchJob>(null)
  const [help, setHelp] = useState(false)
  const [bannerOff, setBannerOff] = useState(() => {
    try {
      return sessionStorage.getItem('metka.banner') === '1'
    } catch {
      return false
    }
  })
  const [customW, setCustomW] = useState(String(state.widthMm))
  const [customH, setCustomH] = useState(String(state.heightMm))
  const support = browserSupport()
  const menuRef = useRef<HTMLDivElement>(null)
  const mod = modKey()
  const preset = matchingPreset(state.widthMm, state.heightMm)
  const pxW = mmToPx(state.widthMm, state.dpi)
  const pxH = mmToPx(state.heightMm, state.dpi)

  useEffect(() => {
    setCustomW(String(state.widthMm))
    setCustomH(String(state.heightMm))
  }, [state.widthMm, state.heightMm])

  useEffect(() => {
    if (!state.ready) return
    const timer = window.setTimeout(() => {
      void writeAutosave(engine.toDocument(), state.designId).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [state.contentRev, state.name, state.designId, state.ready, state.dirty])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      const typing = target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        if (typing) return
        event.preventDefault()
        void saveCurrent()
      }
      if (!typing && !event.metaKey && !event.ctrlKey && event.key === '?' && !document.querySelector('[role="dialog"]')) {
        event.preventDefault()
        setHelp(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!menu) return
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const saveCurrent = async () => {
    try {
      const doc = engine.toDocument()
      const id = state.designId ?? uid()
      await saveDesign({
        id,
        name: doc.name,
        updatedAt: Date.now(),
        thumbnail: await thumbnailOf(doc),
        doc,
      })
      engine.markClean(id)
      toast(t('saved', { name: doc.name }))
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error))
    }
  }

  const exportJson = () => {
    const doc = engine.toDocument()
    downloadText(`${slug(doc.name)}.json`, serializeDesign(doc))
  }

  const exportPng = async (thermal: boolean) => {
    const doc = engine.toDocument()
    const canvas = thermal ? await renderDocumentThermal(doc) : await renderDocumentColor(doc)
    downloadUrl(`${slug(doc.name)}${thermal ? '-1bit' : ''}.png`, canvas.toDataURL('image/png'))
  }

  const importJson = async (file: File) => {
    try {
      const payload = parseImport(await file.text())
      if (payload.type === 'design') {
        await engine.loadDocument(payload.doc, null, true)
        toast(t('importedDesign'))
        return
      }
      const existing = await listTemplates()
      const names = existing.map((item) => item.name)
      for (const item of payload.items) {
        const name = uniqueName(item.name, names)
        names.push(name)
        const doc = { ...item.doc, name }
        await saveTemplate({
          id: uid(),
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          thumbnail: item.thumbnail || (await thumbnailOf(doc)),
          doc,
        })
      }
      toast(t('imported', { n: payload.items.length }))
      setGallery({ tab: 'templates', compose: false })
    } catch {
      toast(t('importFail'))
    }
  }

  return (
    <div className="relative flex h-dvh flex-col bg-[var(--bg)] text-[var(--text)]">
      <header ref={menuRef} className="relative z-30 flex h-14 shrink-0 items-center gap-1 overflow-hidden border-b border-[var(--border)] px-2 sm:gap-2 sm:px-3">
        <div className="mr-0.5 flex shrink-0 items-center gap-2 pl-1">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--text)] text-xs font-black text-[var(--bg)]">M</span>
          <span className="hidden text-[17px] font-black tracking-tight md:inline">{t('appName')}</span>
        </div>
        <input
          aria-label={t('name')}
          value={state.name}
          onChange={(event) => engine.setName(event.target.value)}
          className="hidden h-11 max-w-[10rem] truncate rounded-full bg-transparent px-2 text-sm font-bold outline-none hover:bg-[var(--hover)] md:block"
        />
        <button
          type="button"
          aria-expanded={menu === 'size'}
          onClick={() => setMenu(menu === 'size' ? null : 'size')}
          className="h-11 max-w-[7.5rem] shrink-0 truncate rounded-full border border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--hover)]"
        >
          {preset?.title ?? `${state.widthMm}×${state.heightMm}`}
        </button>
        <IconButton label={`${t('undo')} (${mod}+Z)`} aria-keyshortcuts="Control+Z" disabled={!state.canUndo} onClick={() => engine.undo()}>
          <Undo2 size={20} />
        </IconButton>
        <IconButton label={`${t('redo')} (${mod}+Shift+Z)`} aria-keyshortcuts="Control+Shift+Z" disabled={!state.canRedo} onClick={() => engine.redo()}>
          <Redo2 size={20} />
        </IconButton>
        <div className="min-w-2 flex-1" />
        <div className="hidden shrink-0 md:flex">
          <IconButton label={t('language')} onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
            <Languages size={20} />
          </IconButton>
          <IconButton label={t('theme')} aria-expanded={menu === 'theme'} onClick={() => setMenu(menu === 'theme' ? null : 'theme')}>
            {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
          </IconButton>
        </div>
        <button
          type="button"
          aria-expanded={menu === 'file'}
          className="h-11 shrink-0 rounded-full border border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--hover)]"
          onClick={() => setMenu(menu === 'file' ? null : 'file')}
        >
          {t('file')}
        </button>
        <Button className="hidden sm:inline-flex" onClick={() => setGallery({ tab: 'templates', compose: false })}>
          {t('templates')}
        </Button>
        <Button className="hidden md:inline-flex" onClick={() => void saveCurrent()}>
          {t('save')}
        </Button>
        <Button className="hidden xl:inline-flex" onClick={() => setGallery({ tab: 'templates', compose: true })}>
          {t('saveTemplate')}
        </Button>
        <Button variant="primary" onClick={() => setPrintOpen(true)}>
          <Printer size={18} />
          <span className="hidden sm:inline">{t('print')}</span>
        </Button>
        {menu === 'theme' && (
          <div className="absolute right-3 top-14 z-40 w-44 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
            {(['dark', 'dim', 'light'] as ThemeName[]).map((item) => (
              <button
                key={item}
                type="button"
                className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[var(--hover)]"
                onClick={() => {
                  setTheme(item)
                  setMenu(null)
                }}
              >
                {item === 'dark' ? t('themeDark') : item === 'dim' ? t('themeDim') : t('themeLight')}
              </button>
            ))}
          </div>
        )}
        {menu === 'file' && (
          <div className="absolute right-2 top-14 z-40 max-h-[70dvh] w-56 overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
            <MenuItem
              onClick={() => {
                void saveCurrent()
                setMenu(null)
              }}
            >
              {t('save')}
            </MenuItem>
            <MenuItem onClick={() => void exportPng(false)}>{t('exportPng')}</MenuItem>
            <MenuItem onClick={() => void exportPng(true)}>{t('exportBit')}</MenuItem>
            <MenuItem onClick={exportJson}>{t('exportJson')}</MenuItem>
            <label className="block cursor-pointer rounded-xl px-3 py-2 text-sm font-bold hover:bg-[var(--hover)]">
              {t('importJson')}
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importJson(file)
                  event.target.value = ''
                  setMenu(null)
                }}
              />
            </label>
            <MenuItem
              onClick={() => {
                setBatchOpen(true)
                setMenu(null)
              }}
            >
              {t('batch')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setHelp(true)
                setMenu(null)
              }}
            >
              {t('shortcuts')}
            </MenuItem>
            <MenuItem
              onClick={() => {
                setLang(lang === 'ru' ? 'en' : 'ru')
                setMenu(null)
              }}
            >
              {t('language')}
            </MenuItem>
            {(['dark', 'dim', 'light'] as ThemeName[]).map((item) => (
              <MenuItem
                key={item}
                onClick={() => {
                  setTheme(item)
                  setMenu(null)
                }}
              >
                {item === 'dark' ? t('themeDark') : item === 'dim' ? t('themeDim') : t('themeLight')}
              </MenuItem>
            ))}
            <MenuItem
              onClick={() => {
                if (state.dirty && !window.confirm(t('confirmNew'))) return
                void engine.useBuiltin('blank')
                setMenu(null)
              }}
            >
              {t('newLabel')}
            </MenuItem>
          </div>
        )}
        {menu === 'size' && (
          <div className="absolute left-2 top-14 z-40 max-h-[70dvh] w-[min(100vw-1rem,28rem)] overflow-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-3 shadow-2xl sm:left-16">
            <label className="mb-3 block text-xs text-[var(--muted)]">
              {t('designName')}
              <TextInput className="mt-1" value={state.name} onChange={(event) => engine.setName(event.target.value)} />
            </label>
            <p className="mb-2 text-xs leading-5 text-[var(--muted)]">{t('tapeNote')}</p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    engine.setSize(item.widthMm, item.heightMm, sizeDpi)
                    setMenu(null)
                  }}
                  className={`rounded-2xl px-2 py-2 text-left hover:bg-[var(--hover)] ${preset?.id === item.id ? 'bg-[var(--hover)]' : ''}`}
                >
                  <div className="text-sm font-bold">{item.title}</div>
                  <div className="text-[11px] text-[var(--muted)]">{item.note[lang]}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-[var(--muted)]">
                {t('width')}
                <TextInput
                  className="mt-1"
                  type="number"
                  value={customW}
                  onChange={(event) => setCustomW(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      engine.setSize(Number(customW), Number(customH), sizeDpi)
                      setMenu(null)
                    }
                  }}
                />
              </label>
              <label className="text-xs text-[var(--muted)]">
                {t('height')}
                <TextInput
                  className="mt-1"
                  type="number"
                  value={customH}
                  onChange={(event) => setCustomH(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      engine.setSize(Number(customW), Number(customH), sizeDpi)
                      setMenu(null)
                    }
                  }}
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  engine.setSize(Number(customW), Number(customH), sizeDpi)
                  setMenu(null)
                }}
              >
                {t('applySize')}
              </Button>
              <Button onClick={() => engine.rotateLabel()}>{t('swap')}</Button>
            </div>
            <label className="mt-3 block text-xs text-[var(--muted)]">
              {t('model')}
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--text)]"
                value={state.model}
                onChange={(event) => engine.setModel(event.target.value)}
              >
                {MODEL_IDS.map((id) => (
                  <option key={id} value={id}>
                    {modelLabel(id)} · {metaFor(id)?.dpi ?? ''} DPI
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-2 block text-xs text-[var(--muted)]">
              {t('dpi')}
              <TextInput className="mt-1" type="number" value={state.dpi} onChange={(event) => engine.setDpi(Number(event.target.value))} />
            </label>
            <p className="mt-2 text-xs text-[var(--muted)]">{t('resetModel')}</p>
            <p className="text-xs text-[var(--muted)]">{t('pixels', { w: pxW, h: pxH })}</p>
          </div>
        )}
      </header>
      {(!support.bluetooth || !support.secure) && !bannerOff && (
        <div className="flex items-start gap-2 border-b border-[var(--border)] bg-[var(--elev)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          <Bluetooth size={14} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{!support.secure ? t('insecure') : support.ios ? t('browserBannerIos') : t('browserBanner')}</span>
          <button
            type="button"
            className="h-11 shrink-0 rounded-full px-3 text-sm font-bold hover:bg-[var(--hover)]"
            onClick={() => {
              try {
                sessionStorage.setItem('metka.banner', '1')
              } catch {
                /* private mode */
              }
              setBannerOff(true)
            }}
          >
            {t('dismiss')}
          </button>
        </div>
      )}
      <FontBar />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[272px] shrink-0 flex-col border-r border-[var(--border)] md:flex">
          <ToolPanel />
          <LayerList />
        </aside>
        <main className="relative min-w-0 flex-1">
          <Stage />
        </main>
        <aside className="hidden w-[320px] shrink-0 border-l border-[var(--border)] md:flex md:flex-col">
          <Inspector />
        </aside>
      </div>
      <nav className="flex shrink-0 border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)] md:hidden">
        <NavButton icon={<Plus size={18} />} active={sheet === 'tools'} onClick={() => setSheet(sheet === 'tools' ? null : 'tools')}>
          {t('tools')}
        </NavButton>
        <NavButton icon={<Layers size={18} />} active={sheet === 'layers'} onClick={() => setSheet(sheet === 'layers' ? null : 'layers')}>
          {t('layers')}
        </NavButton>
        <NavButton icon={<SlidersHorizontal size={18} />} active={sheet === 'props'} onClick={() => setSheet(sheet === 'props' ? null : 'props')}>
          {t('props')}
        </NavButton>
        <NavButton
          icon={<LayoutTemplate size={18} />}
          active={false}
          onClick={() => {
            setSheet(null)
            setGallery({ tab: 'templates', compose: false })
          }}
        >
          {t('templates')}
        </NavButton>
      </nav>
      {sheet && (
        <div
          className="absolute inset-x-0 z-30 flex max-h-[62dvh] flex-col overflow-hidden border-t border-[var(--border)] bg-[var(--card)] md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-end px-2 pt-1">
            <Button onClick={() => setSheet(null)}>{t('sheetDone')}</Button>
          </div>
          <div className="min-h-0 overflow-auto">
            {sheet === 'tools' && <ToolPanel onPicked={() => setSheet(null)} />}
            {sheet === 'layers' && <LayerList />}
            {sheet === 'props' && <Inspector />}
          </div>
        </div>
      )}
      {gallery && <Gallery tab={gallery.tab} compose={gallery.compose} onClose={() => setGallery(null)} />}
      {printOpen && <PrintDialog batch={batch} onClose={() => setPrintOpen(false)} onClearBatch={() => setBatch(null)} />}
      {help && <ShortcutDialog mod={mod} onClose={() => setHelp(false)} />}
      {batchOpen && (
        <BatchDialog
          onClose={() => setBatchOpen(false)}
          onPrint={(job) => {
            setBatch(job)
            setBatchOpen(false)
            setPrintOpen(true)
          }}
        />
      )}
      <Toasts />
    </div>
  )
}

function modKey() {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) return '⌘'
  return 'Ctrl'
}

function ShortcutDialog({ mod, onClose }: { mod: string; onClose: () => void }) {
  const { t } = useI18n()
  const rows = [
    [t('undo'), `${mod}+Z`],
    [t('redo'), `${mod}+Shift+Z`],
    [t('duplicate'), `${mod}+D`],
    [t('keyPaste'), `${mod}+V`],
    [t('deleteObj'), 'Delete'],
    [t('keySelectAll'), `${mod}+A`],
    [t('keyNudge'), t('keyArrows')],
    [t('keyNudgeFast'), t('keyShiftArrows')],
    [t('fit'), `${mod}+0`],
    [t('zoomIn'), `${mod}++`],
    [t('zoomOut'), `${mod}+−`],
    [t('keyDeselect'), 'Esc'],
    [t('keyPan'), t('keyPanHow')],
    [t('keyPinch'), t('keyPinchHow')],
    [t('save'), `${mod}+S`],
    [t('keyHelp'), '?'],
  ]
  return (
    <Modal title={t('shortcuts')} closeLabel={t('close')} onClose={onClose}>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">{t('keysLead')}</p>
        <dl className="flex flex-col">
          {rows.map(([action, keys]) => (
            <div key={action} className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-0">
              <dt className="text-sm font-medium">{action}</dt>
              <dd className="shrink-0 text-right text-sm font-bold text-[var(--muted)]">{keys}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Modal>
  )
}

function MenuItem({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[var(--hover)]">
      {children}
    </button>
  )
}

function NavButton({ children, icon, active, onClick }: { children: string; icon: ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-bold ${active ? 'bg-[var(--hover)] text-[var(--text)]' : 'text-[var(--muted)]'}`}
    >
      {icon}
      <span className="max-w-full truncate">{children}</span>
    </button>
  )
}
