'use client'

import EtfList from '@/app/components/etf-list'
import { useLanguage } from '@/app/components/language-context'

const TEXT = {
  en: {
    title: 'ETF Quick Overview',
    subtitle: 'Turn complex market data into actionable signals for long-term life investing.',
  },
  'zh-TW': {
    title: 'ETF 快速總覽',
    subtitle: '把複雜資料整理成可行動的重點，支持你的人生長期投資規劃。',
  },
  'zh-CN': {
    title: 'ETF 快速总览',
    subtitle: '把复杂数据整理为可行动的重点，支持你的人生长期投资规划。',
  },
}

export default function Home() {
  const { language } = useLanguage()
  const t = TEXT[language]

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-3xl border border-[#d6e0ea] bg-[#f9fbfe]/85 p-6 shadow-[0_6px_22px_rgba(15,39,71,0.08)] backdrop-blur-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-[#0B1F3A] sm:text-4xl">{t.title}</h1>
        <p className="mt-2 text-sm text-[#627792] sm:text-base">{t.subtitle}</p>
      </section>
      <EtfList />
    </main>
  )
}
