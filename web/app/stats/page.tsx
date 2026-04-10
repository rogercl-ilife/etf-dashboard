'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/app/components/language-context'

type ReadStats = {
  total_reads: number
  unique_sessions: number
  reads_24h: number
  top_symbols: Array<{ symbol: string; reads: number }>
}

const TEXT = {
  en: {
    title: 'Read Analytics',
    subtitle: 'Track total reads and recent activity.',
    back: 'Back',
    totalReads: 'Total Reads',
    uniqueUsers: 'Unique Sessions',
    reads24h: 'Reads (24h)',
    topSymbols: 'Top Symbols',
    loading: 'Loading...',
    failed: 'Failed to load stats.',
    empty: 'No read data yet.',
  },
  'zh-TW': {
    title: '閱讀統計',
    subtitle: '追蹤總讀取次數與近期活躍度。',
    back: '返回',
    totalReads: '總讀取次數',
    uniqueUsers: '不重複 Session',
    reads24h: '近 24 小時讀取',
    topSymbols: '熱門 ETF',
    loading: '載入中...',
    failed: '統計讀取失敗。',
    empty: '目前還沒有讀取資料。',
  },
  'zh-CN': {
    title: '阅读统计',
    subtitle: '追踪总读取次数与近期活跃度。',
    back: '返回',
    totalReads: '总读取次数',
    uniqueUsers: '去重 Session',
    reads24h: '近 24 小时读取',
    topSymbols: '热门 ETF',
    loading: '加载中...',
    failed: '统计读取失败。',
    empty: '目前还没有读取数据。',
  },
}

export default function StatsPage() {
  const { language } = useLanguage()
  const t = TEXT[language]
  const [stats, setStats] = useState<ReadStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/analytics/read?scope=global', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || t.failed)
        }
        setStats(json?.data || null)
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : t.failed)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [t.failed])

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
        </div>
        <Link href="/" className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
          {t.back}
        </Link>
      </div>

      {loading ? <p className="text-sm text-slate-600">{t.loading}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {stats ? (
        <section className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{t.totalReads}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total_reads}</p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{t.uniqueUsers}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.unique_sessions}</p>
            </article>
            <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{t.reads24h}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{stats.reads_24h}</p>
            </article>
          </div>

          <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">{t.topSymbols}</h2>
            {stats.top_symbols.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{t.empty}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-2 py-2 font-medium">Symbol</th>
                      <th className="px-2 py-2 font-medium">{t.totalReads}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.top_symbols.map((row) => (
                      <tr key={row.symbol} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-semibold text-slate-900">{row.symbol}</td>
                        <td className="px-2 py-2 text-slate-700">{row.reads}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      ) : null}
    </main>
  )
}
