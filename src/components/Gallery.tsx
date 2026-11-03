import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BUILTINS, buildBuiltin } from '../engine/builtins'
import { engine } from '../engine/editor'
import { parseImport, serializeTemplates } from '../lib/bundle'
import { thumbnailOf } from '../lib/render'
import { deleteDesign, deleteTemplate, listDesigns, listTemplates, saveDesign, saveTemplate } from '../lib/storage'
import type { DesignRecord, TemplateRecord } from '../types'
import { downloadText, slug, uid, uniqueName } from '../lib/units'
import { toast } from '../toast'
import { useI18n } from './state'
import { useEngine } from './Stage'
import { Button, Modal, TextInput } from './ui'

const builtinThumbs = new Map<string, string>()

export function Gallery({
  tab,
  compose,
  onClose,
}: {
  tab: 'templates' | 'designs'
  compose: boolean
  onClose: () => void
}) {
  const { t, lang } = useI18n()
  const { state } = useEngine()
  const [current, setCurrent] = useState(tab)
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [designs, setDesigns] = useState<DesignRecord[]>([])
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [draftName, setDraftName] = useState(state.name)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const refresh = async () => {
    const [nextTemplates, nextDesigns] = await Promise.all([listTemplates(), listDesigns()])
    setTemplates(nextTemplates)
    setDesigns(nextDesigns)
  }

  useEffect(() => {
    void refresh().catch((error: unknown) => toast(error instanceof Error ? error.message : String(error)))
    let cancel = false
    void (async () => {
      const next: Record<string, string> = {}
      for (const spec of BUILTINS) {
        const cached = builtinThumbs.get(spec.id)
        if (cached) {
          next[spec.id] = cached
          continue
        }
        const doc = await buildBuiltin(spec.id)
        const url = await thumbnailOf(doc, 480)
        builtinThumbs.set(spec.id, url)
        next[spec.id] = url
        if (!cancel) setThumbs((prev) => ({ ...prev, [spec.id]: url }))
      }
      if (!cancel) setThumbs((prev) => ({ ...prev, ...next }))
    })()
    return () => {
      cancel = true
    }
  }, [])

  const filteredBuiltins = useMemo(
    () => BUILTINS.filter((spec) => spec.name[lang].toLowerCase().includes(query.trim().toLowerCase())),
    [lang, query],
  )
  const filteredTemplates = templates.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
  const filteredDesigns = designs.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))

  const saveCurrent = async () => {
    const name = draftName.trim() || t('untitled')
    setBusy(true)
    try {
      const doc = { ...engine.toDocument(), name }
      const record: TemplateRecord = {
        id: uid(),
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        thumbnail: await thumbnailOf(doc, 480),
        doc,
      }
      await saveTemplate(record)
      await refresh()
      setCurrent('templates')
      toast(t('savedTemplate', { name }))
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const importFile = async (file: File) => {
    try {
      const payload = parseImport(await file.text())
      if (payload.type === 'design') {
        await engine.loadDocument(payload.doc, null, true)
        toast(t('importedDesign'))
        onClose()
        return
      }
      const names = templates.map((item) => item.name)
      for (const item of payload.items) {
        const name = uniqueName(item.name, names)
        names.push(name)
        const doc = { ...item.doc, name }
        const thumbnail = item.thumbnail || (await thumbnailOf(doc, 480))
        await saveTemplate({ id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), thumbnail, doc })
      }
      await refresh()
      setCurrent('templates')
      toast(t('imported', { n: payload.items.length }))
    } catch {
      toast(t('importFail'))
    }
  }

  const exportAll = () => {
    if (templates.length === 0) {
      toast(t('exportEmpty'))
      return
    }
    downloadText(`metka-templates-${new Date().toISOString().slice(0, 10)}.json`, serializeTemplates(templates))
  }

  return (
    <Modal title={t('templates')} closeLabel={t('close')} wide onClose={onClose}>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <p className="text-sm leading-6 text-[var(--muted)]">{t('galleryLead')}</p>
        <p className="text-sm leading-6">{t('templateHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant={current === 'templates' ? 'accent' : 'ghost'} onClick={() => setCurrent('templates')}>
            {t('templates')}
          </Button>
          <Button variant={current === 'designs' ? 'accent' : 'ghost'} onClick={() => setCurrent('designs')}>
            {t('designs')}
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button onClick={exportAll}>{t('exportAll')}</Button>
            <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-[var(--border)] px-4 text-sm font-bold hover:bg-[var(--hover)]">
              {t('import')}
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void importFile(file)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
        </div>
        {(compose || current === 'templates') && (
          <form
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--elev)] p-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault()
              void saveCurrent()
            }}
          >
            <label className="block flex-1">
              <span className="mb-1 block text-xs text-[var(--muted)]">{t('templateName')}</span>
              <TextInput value={draftName} placeholder={t('templatePh')} onChange={(event) => setDraftName(event.target.value)} autoFocus={compose} />
            </label>
            <Button variant="primary" type="submit" disabled={busy}>
              {t('saveTemplateTitle')}
            </Button>
          </form>
        )}
        <TextInput value={query} placeholder={t('search')} onChange={(event) => setQuery(event.target.value)} />
        {current === 'templates' ? (
          <>
            <Section title={t('myTemplates')}>
              {templates.length === 0 && <Empty>{t('noUserTemplates')}</Empty>}
              {templates.length > 0 && filteredTemplates.length === 0 && <Empty>{t('noMatch')}</Empty>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredTemplates.map((item) => (
                  <Card
                    key={item.id}
                    name={item.name}
                    badge={t('userBadge')}
                    meta={t('presetCanvas', { w: item.doc.widthMm, h: item.doc.heightMm })}
                    thumb={item.thumbnail}
                    onOpen={() => {
                      void engine.loadDocument(structuredClone(item.doc), null, true).then(() => {
                        toast(t('loaded', { name: item.name }))
                        onClose()
                      })
                    }}
                    onRename={(name) => {
                      void saveTemplate({ ...item, name, updatedAt: Date.now(), doc: { ...item.doc, name } }).then(refresh)
                    }}
                    onDuplicate={() => {
                      const name = uniqueName(t('copyName', { name: item.name }), templates.map((row) => row.name))
                      void saveTemplate({
                        ...structuredClone(item),
                        id: uid(),
                        name,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        doc: { ...structuredClone(item.doc), name },
                      }).then(async () => {
                        await refresh()
                        toast(t('savedTemplate', { name }))
                      })
                    }}
                    onExport={() => downloadText(`${slug(item.name)}.json`, serializeTemplates([item]))}
                    onDelete={() => setPendingDelete(item.id)}
                    confirming={pendingDelete === item.id}
                    confirmText={t('confirmDelete', { name: item.name })}
                    confirmLabel={t('confirm')}
                    cancelLabel={t('cancel')}
                    onConfirmDelete={() => {
                      void deleteTemplate(item.id).then(async () => {
                        setPendingDelete(null)
                        await refresh()
                      })
                    }}
                    onCancelDelete={() => setPendingDelete(null)}
                  />
                ))}
              </div>
            </Section>
            <Section title={t('builtin')}>
              {filteredBuiltins.length === 0 && <Empty>{t('noMatch')}</Empty>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredBuiltins.map((spec) => (
                  <Card
                    key={spec.id}
                    name={spec.name[lang]}
                    badge={t('builtinBadge')}
                    meta={t('presetCanvas', { w: spec.widthMm, h: spec.heightMm })}
                    thumb={thumbs[spec.id]}
                    onOpen={() => {
                      void engine.useBuiltin(spec.id).then(() => {
                        toast(t('loaded', { name: spec.name[lang] }))
                        onClose()
                      })
                    }}
                    onDuplicate={() => {
                      void (async () => {
                        const doc = await buildBuiltin(spec.id)
                        const name = uniqueName(spec.name[lang], templates.map((item) => item.name))
                        const named = { ...doc, name }
                        await saveTemplate({
                          id: uid(),
                          name,
                          createdAt: Date.now(),
                          updatedAt: Date.now(),
                          thumbnail: thumbs[spec.id] || (await thumbnailOf(named, 480)),
                          doc: named,
                        })
                        await refresh()
                        toast(t('savedTemplate', { name }))
                      })()
                    }}
                  />
                ))}
              </div>
            </Section>
          </>
        ) : (
          <Section title={t('designs')}>
            {designs.length === 0 && <Empty>{t('emptyDesigns')}</Empty>}
            {designs.length > 0 && filteredDesigns.length === 0 && <Empty>{t('noMatch')}</Empty>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDesigns.map((item) => (
                <Card
                  key={item.id}
                  name={item.name}
                  badge={t('designBadge')}
                  meta={t('presetCanvas', { w: item.doc.widthMm, h: item.doc.heightMm })}
                  thumb={item.thumbnail}
                  onOpen={() => {
                    void engine.loadDocument(structuredClone(item.doc), item.id, false).then(() => {
                      toast(t('loaded', { name: item.name }))
                      onClose()
                    })
                  }}
                  onRename={(name) => {
                    void saveDesign({ ...item, name, updatedAt: Date.now(), doc: { ...item.doc, name } }).then(refresh)
                  }}
                  onDuplicate={() => {
                    const name = uniqueName(t('copyName', { name: item.name }), designs.map((row) => row.name))
                    void saveDesign({
                      ...structuredClone(item),
                      id: uid(),
                      name,
                      updatedAt: Date.now(),
                      doc: { ...structuredClone(item.doc), name },
                    }).then(refresh)
                  }}
                  onDelete={() => setPendingDelete(item.id)}
                  confirming={pendingDelete === item.id}
                  confirmText={t('confirmDelete', { name: item.name })}
                  confirmLabel={t('confirm')}
                  cancelLabel={t('cancel')}
                  onConfirmDelete={() => {
                    void deleteDesign(item.id).then(async () => {
                      if (state.designId === item.id) engine.markClean(null)
                      setPendingDelete(null)
                      await refresh()
                    })
                  }}
                  onCancelDelete={() => setPendingDelete(null)}
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-black">{title}</h3>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-sm text-[var(--muted)]">{children}</p>
}

function Card({
  name,
  badge,
  meta,
  thumb,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
  confirming,
  confirmText,
  confirmLabel,
  cancelLabel,
  onConfirmDelete,
  onCancelDelete,
}: {
  name: string
  badge: string
  meta: string
  thumb?: string
  onOpen: () => void
  onRename?: (name: string) => void
  onDuplicate: () => void
  onExport?: () => void
  onDelete?: () => void
  confirming?: boolean
  confirmText?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirmDelete?: () => void
  onCancelDelete?: () => void
}) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)]">
      <button type="button" onClick={onOpen} className="block w-full bg-[var(--elev)] p-3">
        <span className="grid h-28 place-items-center">
          {thumb ? <img src={thumb} alt="" className="max-h-28 max-w-full bg-white object-contain shadow-sm" /> : <span className="text-xs text-[var(--muted)]">…</span>}
        </span>
      </button>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          {editing && onRename ? (
            <form
              className="min-w-0 flex-1"
              onSubmit={(event) => {
                event.preventDefault()
                onRename(value.trim() || name)
                setEditing(false)
              }}
            >
              <TextInput
                value={value}
                autoFocus
                onChange={(event) => setValue(event.target.value)}
                onBlur={(event) => {
                  onRename(event.currentTarget.value.trim() || name)
                  setEditing(false)
                }}
              />
            </form>
          ) : (
            <button type="button" className="min-w-0 flex-1 truncate text-left font-bold" onClick={() => onRename && setEditing(true)}>
              {name}
            </button>
          )}
          <span className="shrink-0 rounded-full bg-[var(--hover)] px-2 py-0.5 text-[11px] text-[var(--muted)]">{badge}</span>
        </div>
        <p className="text-xs text-[var(--muted)]">{meta}</p>
        {confirming ? (
          <div className="rounded-xl border border-[var(--border)] p-2">
            <p className="mb-2 text-xs">{confirmText}</p>
            <div className="flex gap-2">
              <Button variant="danger" className="h-8 px-3" onClick={onConfirmDelete}>
                {confirmLabel}
              </Button>
              <Button className="h-8 px-3" onClick={onCancelDelete}>
                {cancelLabel}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            <Button className="h-8 px-3" variant="accent" onClick={onOpen}>
              {t('open')}
            </Button>
            {onRename && (
              <Button className="h-8 px-3" onClick={() => setEditing(true)}>
                {t('rename')}
              </Button>
            )}
            <Button className="h-8 px-3" onClick={onDuplicate}>
              {t('duplicate')}
            </Button>
            {onExport && (
              <Button className="h-8 px-3" onClick={onExport}>
                {t('export')}
              </Button>
            )}
            {onDelete && (
              <Button className="h-8 px-3" variant="danger" onClick={onDelete}>
                {t('delete')}
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
