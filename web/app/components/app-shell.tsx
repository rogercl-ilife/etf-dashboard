'use client'

import { useLanguage, type Language } from './language-context'

const LANG_LABELS: Record<Language, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
}

const TEXT = {
  en: {
    appTitle: 'ETF DASHBOARD',
    techStack: 'Next.js + Tailwind + Supabase',
    language: 'Language',
    footer: 'Week 5 milestone: automated updates + mobile-ready UX.',
  },
  'zh-TW': {
    appTitle: 'ETF 儀表板',
    techStack: 'Next.js + Tailwind + Supabase',
    language: '語言',
    footer: '第 5 週里程碑：自動化更新與行動裝置優化體驗。',
  },
  'zh-CN': {
    appTitle: 'ETF 仪表盘',
    techStack: 'Next.js + Tailwind + Supabase',
    language: '语言',
    footer: '第 5 周里程碑：自动化更新与移动端优化体验。',
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
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span>{t.language}</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800"
            >
              {Object.entries(LANG_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      {children}

      <footer className="mt-10 border-t border-black/10 bg-white/50">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">{t.footer}</div>
      </footer>
    </>
  )
}
