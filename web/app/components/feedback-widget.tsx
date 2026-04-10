'use client'

import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/app/components/language-context'
import { trackEvent } from '@/lib/ga'

const TEXT = {
  en: {
    button: 'Feedback',
    title: 'Send Feedback',
    placeholder: 'Tell us what should be improved...',
    email: 'Email (optional)',
    cancel: 'Cancel',
    send: 'Send',
    sending: 'Sending...',
    ok: 'Thanks, feedback received.',
    empty: 'Please enter feedback before sending.',
    failed: 'Failed to send feedback.',
    missingTable: 'Feedback DB table is missing. Please run week6 SQL setup.',
    blockedPolicy: 'Feedback is blocked by DB policy. Please run week6 SQL setup.',
  },
  'zh-TW': {
    button: '意見回饋',
    title: '送出回饋',
    placeholder: '告訴我們你希望優化的地方...',
    email: 'Email（選填）',
    cancel: '取消',
    send: '送出',
    sending: '送出中...',
    ok: '感謝回饋，已成功送出。',
    empty: '請先輸入回饋內容。',
    failed: '回饋送出失敗。',
    missingTable: '回饋資料表不存在，請先執行 week6 SQL 初始化。',
    blockedPolicy: '資料庫權限設定阻擋回饋寫入，請先執行 week6 SQL 初始化。',
  },
  'zh-CN': {
    button: '意见反馈',
    title: '提交反馈',
    placeholder: '告诉我们你希望优化的内容...',
    email: 'Email（选填）',
    cancel: '取消',
    send: '提交',
    sending: '提交中...',
    ok: '感谢反馈，已成功提交。',
    empty: '请先输入反馈内容。',
    failed: '反馈提交失败。',
    missingTable: '反馈数据表不存在，请先执行 week6 SQL 初始化。',
    blockedPolicy: '数据库权限策略阻挡了反馈写入，请先执行 week6 SQL 初始化。',
  },
}

export default function FeedbackWidget() {
  const pathname = usePathname()
  const { language } = useLanguage()
  const t = TEXT[language]
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const statusText = useMemo(() => {
    if (status === 'ok') return t.ok
    if (status === 'error') return errorMessage || t.failed
    return ''
  }, [errorMessage, status, t])

  const onSubmit = async () => {
    const trimmed = message.trim()
    if (!trimmed) {
      setStatus('error')
      setErrorMessage(t.empty)
      return
    }

    setSubmitting(true)
    setStatus('idle')
    setErrorMessage('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          email: email.trim() || null,
          page_path: pathname,
          language,
        }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const backendError = typeof json?.error === 'string' ? json.error : ''
        if (backendError.includes('table is missing')) throw new Error(t.missingTable)
        if (backendError.includes('blocked by RLS')) throw new Error(t.blockedPolicy)
        throw new Error(backendError || t.failed)
      }

      setStatus('ok')
      setMessage('')
      setEmail('')
      trackEvent('feedback_submit', {
        page_path: pathname || null,
        language,
      })
    } catch (e: unknown) {
      setStatus('error')
      setErrorMessage(e instanceof Error && e.message ? e.message : t.failed)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setStatus('idle')
          setErrorMessage('')
        }}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-md transition hover:border-slate-500"
      >
        {t.button}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">{t.title}</h2>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                if (status !== 'idle') setStatus('idle')
              }}
              rows={5}
              placeholder={t.placeholder}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-600"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.email}
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-600"
            />
            {status === 'error' && message.trim().length === 0 ? (
              <p className="mt-2 text-xs text-rose-600">{t.empty}</p>
            ) : statusText ? (
              <p className={`mt-2 text-xs ${status === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}>{statusText}</p>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {submitting ? t.sending : t.send}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
