'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/app/components/language-context'

type FeedbackStatus = 'new' | 'in_progress' | 'done'

type FeedbackRow = {
  id: number
  message: string
  email: string | null
  page_path: string | null
  language: string | null
  created_at: string
  status: FeedbackStatus
  handled_at: string | null
  handled_note: string | null
}

const STATUS_ORDER: FeedbackStatus[] = ['new', 'in_progress', 'done']

const TEXT = {
  en: {
    title: 'Feedback Inbox',
    subtitle: 'Search, filter, and mark feedback as processed.',
    back: 'Back',
    search: 'Search message/email/path',
    all: 'All',
    new: 'New',
    inProgress: 'In Progress',
    done: 'Done',
    loading: 'Loading...',
    failed: 'Failed to load feedback.',
    empty: 'No feedback matched.',
    page: 'Page',
    email: 'Email',
    receivedAt: 'Received',
    handledAt: 'Handled',
    markNew: 'Mark New',
    markInProgress: 'Mark In Progress',
    markDone: 'Mark Done',
    saving: 'Saving...',
  },
  'zh-TW': {
    title: '回饋收件匣',
    subtitle: '可搜尋、篩選並標記回饋處理狀態。',
    back: '返回',
    search: '搜尋訊息 / Email / 路徑',
    all: '全部',
    new: '新回饋',
    inProgress: '處理中',
    done: '已完成',
    loading: '載入中...',
    failed: '回饋讀取失敗。',
    empty: '沒有符合條件的回饋。',
    page: '頁面',
    email: 'Email',
    receivedAt: '收到時間',
    handledAt: '處理時間',
    markNew: '標記新回饋',
    markInProgress: '標記處理中',
    markDone: '標記已完成',
    saving: '儲存中...',
  },
  'zh-CN': {
    title: '反馈收件箱',
    subtitle: '可搜索、筛选并标记反馈处理状态。',
    back: '返回',
    search: '搜索消息 / Email / 路径',
    all: '全部',
    new: '新反馈',
    inProgress: '处理中',
    done: '已完成',
    loading: '加载中...',
    failed: '反馈读取失败。',
    empty: '没有符合条件的反馈。',
    page: '页面',
    email: 'Email',
    receivedAt: '收到时间',
    handledAt: '处理时间',
    markNew: '标记新反馈',
    markInProgress: '标记处理中',
    markDone: '标记已完成',
    saving: '保存中...',
  },
}

function statusLabel(status: FeedbackStatus, t: typeof TEXT.en) {
  if (status === 'new') return t.new
  if (status === 'in_progress') return t.inProgress
  return t.done
}

export default function FeedbackPage() {
  const { language } = useLanguage()
  const t = TEXT[language]

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | 'all'>('all')
  const [items, setItems] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [savingId, setSavingId] = useState<number | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'en' ? 'en-US' : language, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [language],
  )

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('limit', '300')
        if (query.trim()) params.set('q', query.trim())
        if (statusFilter !== 'all') params.set('status', statusFilter)

        const res = await fetch(`/api/feedback?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || t.failed)
        }
        setItems(Array.isArray(json?.data) ? json.data : [])
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : t.failed)
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [query, refreshToken, statusFilter, t.failed])

  const updateStatus = async (id: number, status: FeedbackStatus) => {
    setSavingId(id)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : t.failed)
      setRefreshToken((v) => v + 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.failed)
    } finally {
      setSavingId(null)
    }
  }

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

      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-600"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              statusFilter === 'all' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
            }`}
          >
            {t.all}
          </button>
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                statusFilter === status ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {statusLabel(status, t)}
            </button>
          ))}
        </div>
      </section>

      {loading ? <p className="mt-4 text-sm text-slate-600">{t.loading}</p> : null}
      {error ? <p className="mt-4 text-sm text-rose-700">{error}</p> : null}

      <section className="mt-4 space-y-3">
        {!loading && !error && items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">{t.empty}</div>
        ) : null}

        {items.map((row) => (
          <article key={row.id} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">#{row.id}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{row.message}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    {t.email}: {row.email || '-'}
                  </span>
                  <span>
                    {t.page}: {row.page_path || '-'}
                  </span>
                  <span>
                    {t.receivedAt}: {row.created_at ? dateFmt.format(new Date(row.created_at)) : '-'}
                  </span>
                  <span>
                    {t.handledAt}: {row.handled_at ? dateFmt.format(new Date(row.handled_at)) : '-'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {statusLabel(row.status, t)}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateStatus(row.id, 'new')}
                    disabled={savingId === row.id}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                  >
                    {savingId === row.id ? t.saving : t.markNew}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(row.id, 'in_progress')}
                    disabled={savingId === row.id}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                  >
                    {savingId === row.id ? t.saving : t.markInProgress}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateStatus(row.id, 'done')}
                    disabled={savingId === row.id}
                    className="rounded-lg border border-slate-900 bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {savingId === row.id ? t.saving : t.markDone}
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
