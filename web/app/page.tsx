'use client'

import EtfList from '@/app/components/etf-list'
import { useLanguage } from '@/app/components/language-context'

const TEXT = {
  en: {
    title: 'ETF List',
    subtitle: 'ETF list and detail experience with mobile polish, loading/error handling, and automated data refresh.',
  },
  'zh-TW': {
    title: 'ETF 清單',
    subtitle: 'ETF 清單與詳情頁體驗，包含行動端優化、載入/錯誤處理與自動化資料更新。',
  },
  'zh-CN': {
    title: 'ETF 列表',
    subtitle: 'ETF 列表与详情页体验，包含移动端优化、加载/错误处理与自动化数据更新。',
  },
}

export default function Home() {
  const { language } = useLanguage()
  const t = TEXT[language]

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t.title}</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">{t.subtitle}</p>
      </section>
      <EtfList />
    </main>
  )
}
