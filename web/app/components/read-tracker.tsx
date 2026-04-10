'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/app/components/language-context'

const SESSION_STORAGE_KEY = 'etf-web-session-id'
const EVENT_PREFIX = 'etf-web-read-sent:'
const EVENT_DEDUP_MS = 10 * 60 * 1000

function getSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY)
  if (existing) return existing
  const id = `s_${crypto.randomUUID()}`
  window.localStorage.setItem(SESSION_STORAGE_KEY, id)
  return id
}

function shouldSend(path: string, symbol: string | null) {
  const key = `${EVENT_PREFIX}${path}:${symbol || ''}`
  const lastSent = window.sessionStorage.getItem(key)
  const now = Date.now()
  if (lastSent) {
    const ts = Number(lastSent)
    if (Number.isFinite(ts) && now - ts < EVENT_DEDUP_MS) {
      return false
    }
  }
  window.sessionStorage.setItem(key, String(now))
  return true
}

function deriveSymbol(pathname: string) {
  const m = pathname.match(/^\/etf\/([^/?#]+)/i)
  if (!m?.[1]) return null
  return decodeURIComponent(m[1]).trim().toUpperCase() || null
}

export default function ReadTracker() {
  const pathname = usePathname()
  const { language } = useLanguage()

  useEffect(() => {
    if (!pathname) return
    const symbol = deriveSymbol(pathname)
    if (!shouldSend(pathname, symbol)) return

    const sessionId = getSessionId()
    fetch('/api/analytics/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_path: pathname,
        symbol,
        language,
        session_id: sessionId,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }, [pathname, language])

  return null
}
