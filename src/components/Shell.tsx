import { useEffect, useRef, useState } from 'react'
import {
  Bluetooth,
  Languages,
  Moon,
  Printer,
  Redo2,
  Save,
  Sun,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { engine } from '../engine/editor'
import { parseImport, serializeDesign } from '../lib/bundle'
import { browserSupport } from '../lib/browser'
import { renderDocumentColor, renderDocumentThermal, thumbnailOf } from '../lib/render'
import { listTemplates, saveDesign, saveTemplate, writeAutosave } from '../lib/storage'
import { MODEL_IDS, PRESETS, matchingPreset, metaFor } from '../lib/presets'
import { downloadText, downloadUrl, mmToPx, modelLabel, slug, uid, uniqueName } from '../lib/units'
import { toast } from '../toast'
import type { ThemeName } from '../types'
import { BatchDialog } from './BatchDialog'
import { Gallery } from './Gallery'
import { Inspector, LayerList, ToolPanel } from './Panels'
import { PrintDialog, type BatchJob } from './PrintDialog'
import { Stage, useEngine } from './Stage'
import { useI18n, useTheme } from './state'
import { Button, IconButton, TextInput, Toasts } from './ui'

export function Shell() {
  const { t, lang, setLang } = useI18n()
  const { theme, setTheme } = useTheme()
  const { state } = useEngine()
  const [sheet, setSheet] = useState<null | 'tools' | 'layers' | 'props'>(null)
  const [menu, setMenu] = useState<null | 'size' | 'file' | 'theme'>(null)
  const [gallery, setGallery] = useState<null | { tab: 'templates' | 'designs'; compose: boolean }>(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batch, setBatch] = useState<BatchJob>(null)
  const [customW, setCustomW] = useState(String(state.widthMm))
  const [customH, setCustomH] = useState(String(state.heightMm))
  const support = browserSupport()
  const menuRef = useRef<HTMLDivElement>(null)
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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        const target = event.target
        if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
        event.preventDefault()
        void saveCurrent()
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
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
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
      <header ref={menuRef} className="relative z-30 flex h-14 shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border)] px-2 sm:gap-2 sm:px-3">
        <div className="mr-1 flex items-center gap-2 pl-1">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--text)] text-xs font-black text-[var(--bg)]">M</span>
          <span className="hidden text-[17px] font-black tracking-tight sm:inline">{t('appName')}</span>
        </div>
        <input
          aria-label={t('name')}
          value={state.name}
          onChange={(event) => engine.setName(event.target.value)}
          className="hidden h-9 max-w-[10rem] truncate rounded-full bg-transparent px-2 text-sm font-bold outline-none hover:bg-[var(--hover)] md:block"
        />
        <button
          type="button"
          onClick={() => setMenu(menu === 'size' ? null : 'size')}
          className="h-9 max-w-[9rem] truncate rounded-full border border-[var(--border)] px-3 text-sm font-bold hover:bg-[var(--hover)]"
        >
          {preset?.title ?? `${state.widthMm}×${state.heightMm}`}
        </button>
        <IconButton label={t('undo')} disabled={!state.canUndo} onClick={() => engine.undo()}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label={t('redo')} disabled={!state.canRedo} onClick={() => engine.redo()}>
          <Redo2 size={18} />
        </IconButton>
        <IconButton label={t('zoomOut')} onClick={() => engine.zoomBy(1 / 1.15)}>
          <ZoomOut size={18} />
        </IconButton>
        <button type="button" className="hidden h-9 min-w-12 rounded-full px-2 text-sm font-bold tabular-nums hover:bg-[var(--hover)] sm:block" onClick={() => engine.fit()}>
          {Math.round(state.zoom * 100)}%
        </button>
        <IconButton label={t('zoomIn')} onClick={() => engine.zoomBy(1.15)}>
          <ZoomIn size={18} />
        </IconButton>
        <div className="flex-1" />
        <IconButton label={t('language')} onClick={() => setLang(lang === 'ru' ? 'en' : 'ru')}>
          <Languages size={18} />
        </IconButton>
        <IconButton label={t('theme')} onClick={() => setMenu(menu === 'theme' ? null : 'theme')}>
          {theme === 'light' ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>
        <button type="button" className="h-9 shrink-0 rounded-full px-3 text-sm font-bold hover:bg-[var(--hover)]" onClick={() => setMenu(menu === 'file' ? null : 'file')}>
          {t('file')}
        </button>
        <Button className="hidden sm:inline-flex" onClick={() => setGallery({ tab: 'templates', compose: false })}>
          {t('templates')}
        </Button>
        <IconButton label={t('save')} className="sm:hidden" onClick={() => void saveCurrent()}>
          <Save size={18} />
        </IconButton>
        <Button className="hidden md:inline-flex" onClick={() => void saveCurrent()}>
          {t('save')}
        </Button>
        <Button className="hidden xl:inline-flex" onClick={() => setGallery({ tab: 'templates', compose: true })}>
          {t('saveTemplate')}
        </Button>
        <Button variant="primary" onClick={() => setPrintOpen(true)}>
          <Printer size={16} />
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
          <div className="absolute right-24 top-14 z-40 w-56 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-xl">
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
            <MenuItem onClick={() => setBatchOpen(true)}>{t('batch')}</MenuItem>
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
            <p className="mb-2 text-xs leading-5 text-[var(--muted)]">{t('tapeNote')}</p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    engine.setSize(item.widthMm, item.heightMm)
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
                <TextInput className="mt-1" type="number" value={customW} onChange={(event) => setCustomW(event.target.value)} />
              </label>
              <label className="text-xs text-[var(--muted)]">
                {t('height')}
                <TextInput className="mt-1" type="number" value={customH} onChange={(event) => setCustomH(event.target.value)} />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  engine.setSize(Number(customW), Number(customH))
                  setMenu(null)
                }}
              >
                {t('custom')}
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
      {(!support.bluetooth || !support.secure) && (
        <div className="flex items-start gap-2 border-b border-[var(--border)] bg-[var(--elev)] px-3 py-2 text-xs leading-5 text-[var(--muted)]">
          <Bluetooth size={14} className="mt-0.5 shrink-0" />
          <span>{!support.secure ? t('insecure') : support.ios ? t('browserBannerIos') : t('browserBanner')}</span>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[272px] shrink-0 flex-col border-r border-[var(--border)] md:flex">
          <ToolPanel />
          <LayerList />
        </aside>
        <main className="relative min-w-0 flex-1">
          <Stage />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 truncate px-3 py-2 text-center text-[11px] text-[var(--muted)]">
            {t('statusLine', { w: state.widthMm, h: state.heightMm, pw: pxW, ph: pxH, dpi: state.dpi, model: modelLabel(state.model) })}
          </div>
        </main>
        <aside className="hidden w-[320px] shrink-0 border-l border-[var(--border)] lg:flex lg:flex-col">
          <Inspector />
        </aside>
      </div>
      <nav className="flex shrink-0 border-t border-[var(--border)] pb-[env(safe-area-inset-bottom)] md:hidden">
        <NavButton active={sheet === 'tools'} onClick={() => setSheet(sheet === 'tools' ? null : 'tools')}>
          {t('tools')}
        </NavButton>
        <NavButton active={sheet === 'layers'} onClick={() => setSheet(sheet === 'layers' ? null : 'layers')}>
          {t('layers')}
        </NavButton>
        <NavButton active={sheet === 'props'} onClick={() => setSheet(sheet === 'props' ? null : 'props')}>
          {t('props')}
        </NavButton>
        <NavButton
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
        <div className="absolute inset-x-0 bottom-12 z-30 max-h-[55dvh] overflow-auto border-t border-[var(--border)] bg-[var(--card)] md:hidden">
          {sheet === 'tools' && <ToolPanel />}
          {sheet === 'layers' && <LayerList />}
          {sheet === 'props' && <Inspector />}
        </div>
      )}
      {gallery && <Gallery tab={gallery.tab} compose={gallery.compose} onClose={() => setGallery(null)} />}
      {printOpen && <PrintDialog batch={batch} onClose={() => setPrintOpen(false)} onClearBatch={() => setBatch(null)} />}
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

function MenuItem({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-xl px-3 py-2 text-left text-sm font-bold hover:bg-[var(--hover)]">
      {children}
    </button>
  )
}

function NavButton({ children, active, onClick }: { children: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`h-12 flex-1 text-sm font-bold ${active ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}>
      {children}
    </button>
  )
}
