'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  DEFAULT_LANG,
  LANG_QUERY_KEY,
  LANG_STORAGE_KEY,
  getDateLocale,
  getDictionary,
  normalizeLang,
  t,
  tList,
  type Lang,
} from '@/lib/i18n'

type I18nContextValue = {
  lang: Lang
  setLang: (next: Lang) => void
  tr: (key: string, vars?: Record<string, string | number | boolean | null | undefined>) => string
  trList: (key: string) => string[]
  locale: ReturnType<typeof getDateLocale>
  dictionary: ReturnType<typeof getDictionary>
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [langState, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return DEFAULT_LANG
    const query = normalizeLang(new URLSearchParams(window.location.search).get(LANG_QUERY_KEY))
    if (query) return query
    try {
      const fromStorage = normalizeLang(window.localStorage.getItem(LANG_STORAGE_KEY))
      return fromStorage || DEFAULT_LANG
    } catch {
      return DEFAULT_LANG
    }
  })
  const lang = langState

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang)
    } catch {
    }
  }, [lang])

  const setLang = useCallback(
    (next: Lang) => {
      const normalized = normalizeLang(next) || DEFAULT_LANG
      setLangState(normalized)

      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, normalized)
      } catch {
      }

      const params = new URLSearchParams(window.location.search)
      params.set(LANG_QUERY_KEY, normalized)
      const query = params.toString()
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      router.replace(`${pathname}${query ? `?${query}` : ''}${hash}`, { scroll: false })
    },
    [pathname, router]
  )

  const value = useMemo<I18nContextValue>(() => {
    const dictionary = getDictionary(lang)
    return {
      lang,
      setLang,
      tr: (key, vars) => t(lang, key, vars),
      trList: (key) => tList(lang, key),
      locale: getDateLocale(lang),
      dictionary,
    }
  }, [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used inside LanguageProvider')
  }
  return context
}
