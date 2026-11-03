import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { translate, type I18nKey } from '../i18n'
import type { Lang, ThemeName } from '../types'
import { engine } from '../engine/editor'

const LANG_KEY = 'metka.lang'
const THEME_KEY = 'metka.theme'

type I18nValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: I18nKey, vars?: Record<string, string | number>) => string
}

type ThemeValue = {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

const I18nContext = createContext<I18nValue | null>(null)
const ThemeContext = createContext<ThemeValue | null>(null)

function storedLang(): Lang {
  return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ru'
}

function storedTheme(): ThemeName {
  const value = localStorage.getItem(THEME_KEY)
  return value === 'light' || value === 'dim' ? value : 'dark'
}

export function AppState({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(storedLang)
  const [theme, setThemeState] = useState<ThemeName>(storedTheme)
  const i18n = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: (next) => {
        localStorage.setItem(LANG_KEY, next)
        setLangState(next)
      },
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang],
  )
  const themeValue = useMemo<ThemeValue>(
    () => ({
      theme,
      setTheme: (next) => {
        localStorage.setItem(THEME_KEY, next)
        setThemeState(next)
      },
    }),
    [theme],
  )
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.lang = lang
    engine.setLang(lang)
    const workspace = theme === 'light' ? '#d7dee4' : theme === 'dim' ? '#0e1720' : '#000000'
    engine.setWorkspace(workspace)
  }, [theme, lang])
  return (
    <I18nContext.Provider value={i18n}>
      <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('i18n')
  return value
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('theme')
  return value
}
