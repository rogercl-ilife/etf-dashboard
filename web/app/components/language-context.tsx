'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type Language = 'en' | 'zh-TW' | 'zh-CN'

const STORAGE_KEY = 'etf-web-language'
const SUPPORTED_LANGUAGES: Language[] = ['en', 'zh-TW', 'zh-CN']

function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) return null
  return SUPPORTED_LANGUAGES.includes(value as Language) ? (value as Language) : null
}

type LanguageContextValue = {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const stored = normalizeLanguage(window.localStorage.getItem(STORAGE_KEY))
    const next = stored || normalizeLanguage(navigator.language) || 'en'
    // SSR and first client render must match to avoid hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLanguage(next)
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (!initialized) return
    window.localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language, initialized])

  const value = useMemo(() => ({ language, setLanguage }), [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return ctx
}
