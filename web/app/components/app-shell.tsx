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
    techStack: 'Version 1.0 · Turn market data into actionable long-term investing decisions.',
    language: 'Language',
    stats: 'Read Stats',
    feedback: 'Feedback',
    footer: 'Automated updates + mobile-ready UX.',
  },
  'zh-TW': {
    appTitle: 'ETF 儀表板',
    techStack: 'Version 1.0 · 把複雜資料整理成可行動的重點，支持你的人生長期投資規劃。',
    language: '語言',
    stats: '閱讀統計',
    feedback: '回饋管理',
    footer: '自動化更新與行動裝置優化體驗。',
  },
  'zh-CN': {
    appTitle: 'ETF 仪表盘',
    techStack: 'Version 1.0 · 把复杂数据整理为可行动的重点，支持你的人生长期投资规划。',
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
      <header className="border-b border-[#d6e0ea] bg-[#f8fbff]/85 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold tracking-[0.12em] text-[#132844]">{t.appTitle}</p>
            <p className="text-xs text-[#5c6f89]">{t.techStack}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/feedback"
              className="rounded-lg border border-[#c7d4e4] bg-white px-2 py-1 text-xs text-[#2a3f5f] transition hover:border-[#8ba2bf] hover:bg-[#f3f7fc] hover:text-[#0f2747]"
            >
              {t.feedback}
            </Link>
            <Link
              href="/stats"
              className="rounded-lg border border-[#c7d4e4] bg-white px-2 py-1 text-xs text-[#2a3f5f] transition hover:border-[#8ba2bf] hover:bg-[#f3f7fc] hover:text-[#0f2747]"
            >
              {t.stats}
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5c6f89]">{t.language}</span>
              <div className="inline-flex items-center rounded-xl border border-[#c7d4e4] bg-white p-0.5">
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
                        active ? 'bg-[#0f2747] text-white' : 'text-[#2a3f5f] hover:bg-[#eef4fb]'
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

      <footer className="mt-10 border-t border-[#d6e0ea] bg-[#f8fbff]/70">
        <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-[#667a94] sm:px-6 lg:px-8">{t.footer}</div>
      </footer>
    </>
  )
}
