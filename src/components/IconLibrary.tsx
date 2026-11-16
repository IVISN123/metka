import { useState } from 'react'
import { SYMBOL_CATEGORIES, searchSymbols, symbolSvg } from '../lib/icons'
import { useI18n } from './state'
import { Modal } from './ui'

export function IconLibrary({ onClose, onPick }: { onClose: () => void; onPick: (id: string) => void }) {
  const { t, lang } = useI18n()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const icons = searchSymbols(query, category)
  return (
    <Modal title={t('iconLibrary')} closeLabel={t('close')} wide onClose={onClose}>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <input
          autoFocus
          aria-label={t('iconSearch')}
          value={query}
          placeholder={t('iconSearch')}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-xl border-2 border-[var(--border)] bg-[var(--field)] px-3 text-base font-bold text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>
            {t('allSymbols')}
          </CategoryChip>
          {SYMBOL_CATEGORIES.map((item) => (
            <CategoryChip key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>
              {lang === 'en' ? item.en : item.ru}
            </CategoryChip>
          ))}
        </div>
        {icons.length === 0 && <p className="text-sm text-[var(--muted)]">{t('noFont')}</p>}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {icons.map((icon) => {
            const name = lang === 'en' ? icon.en : icon.ru
            return (
              <button
                key={icon.id}
                type="button"
                title={name}
                aria-label={name}
                className="symbol-preview flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[var(--icon)] hover:bg-[var(--hover)]"
                onClick={() => {
                  onPick(icon.id)
                  onClose()
                }}
              >
                <span className="symbol-preview" dangerouslySetInnerHTML={{ __html: symbolSvg(icon, 'currentColor') }} />
                <span className="line-clamp-2 text-center text-[10px] font-bold leading-3 text-[var(--text)]">{name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full px-3 text-sm font-bold ${active ? 'bg-[var(--pill)] text-[var(--pill-text)]' : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--hover)]'}`}
    >
      {children}
    </button>
  )
}
