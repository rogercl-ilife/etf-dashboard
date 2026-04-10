'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import EtfDetailClient from './etf-detail-client'
import { useLanguage } from '@/app/components/language-context'

const TEXT = {
  en: {
    back: 'Back to ETF List',
  },
  'zh-TW': {
    back: '返回 ETF 清單',
  },
  'zh-CN': {
    back: '返回 ETF 列表',
  },
}

export default function EtfDetailPage() {
  const { language } = useLanguage()
  const t = TEXT[language]
  const params = useParams<{ symbol: string }>()
  const normalized = (params?.symbol || '').trim().toUpperCase()

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
        >
          {t.back}
        </Link>
      </div>

      <EtfDetailClient symbol={normalized} />
    </main>
  )
}
