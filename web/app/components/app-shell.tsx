'use client'

import Link from 'next/link'
import { useLanguage, type Language } from './language-context'

const LANGUAGE_OPTIONS: Array<{ value: Language; short: string; label: string }> = [
  { value: 'en', short: 'EN', label: 'English' },
  { value: 'zh-TW', short: '繁', label: '繁體中文' },
  { value: 'zh-CN', short: '简', label: '简体中文' },
]

const TEXT = {
  en: {
    appTitle: 'ETF DASHBOARD',
    techStack: 'Next.js + Tailwind + Supabase',
    language: 'Language',
    stats: 'Read Stats',
    feedback: 'Feedback',
    footer: 'Automated updates + mobile-ready UX.',
  },
  'zh-TW': {
    appTitle: 'ETF 儀表板',
    techStack: 'Next.js + Tailwind + Supabase',
    language: '語言',
    stats: '閱讀統計',
    feedback: '回饋管理',
    footer: '自動化更新與行動裝置優化體驗。',
  },
  'zh-CN': {
    appTitle: 'ETF 仪表盘',
    techStack: 'Next.js + Tailwind + Supabase',
    language: '语言',
    stats: '阅读统计',
    feedback: '反馈管理',
    footer: '自动化更新与移动端优化体验。',
  },
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguage()
  const t = TEXT[language]

  return (
    <>
      <header className="border-b border-black/10 bg-white/75 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-slate-700">{t.appTitle}</p>
            <p className="text-xs text-slate-500">{t.techStack}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/feedback"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
            >
              {t.feedback}
            </Link>
            <Link
              href="/stats"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
            >
              {t.stats}
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">{t.language}</span>
              <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white p-0.5">
                {LANGUAGE_OPTIONS.map((option) => {
                  const active = language === option.value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setLanguage(option.value)}
                      aria-label={option.label}
                      title={option.label}
                      className={`min-w-10 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                        active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {option.short}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-10 border-t border-black/10 bg-white/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">{t.footer}</div>
      </footer>
    </>
  )
}
