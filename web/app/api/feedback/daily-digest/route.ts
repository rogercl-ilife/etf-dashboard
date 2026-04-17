import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type DigestRow = {
  id: number
  page_path: string | null
  language: string | null
  created_at: string
  status: 'new' | 'in_progress' | 'done'
}

function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim())
}

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = request.headers.get('authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''

  if (cronSecret) {
    return bearer === cronSecret
  }

  return request.headers.get('user-agent')?.toLowerCase().includes('vercel-cron') || false
}

function asList(value: string | undefined) {
  if (!value) return []
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

function parseBooleanFlag(value: string | undefined, defaultValue: boolean) {
  if (!value) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false
  return defaultValue
}

function topCounts(values: Array<string | null | undefined>, limit: number) {
  const map = new Map<string, number>()
  for (const raw of values) {
    const key = raw && raw.trim() ? raw.trim() : '(unknown)'
    map.set(key, (map.get(key) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
}

function toHtml({
  total,
  sinceIso,
  topPages,
  topLanguages,
  statusCounts,
}: {
  total: number
  sinceIso: string
  topPages: Array<[string, number]>
  topLanguages: Array<[string, number]>
  statusCounts: Record<'new' | 'in_progress' | 'done', number>
}) {
  const pageItems = topPages.length
    ? topPages.map(([page, count]) => `<li><code>${page}</code>: <strong>${count}</strong></li>`).join('')
    : '<li>No feedback in this window.</li>'

  const languageItems = topLanguages.length
    ? topLanguages.map(([lang, count]) => `<li><code>${lang}</code>: <strong>${count}</strong></li>`).join('')
    : '<li>No language data.</li>'

  return `
    <h2>ETF Feedback Daily Digest</h2>
    <p>Window start (UTC): <code>${sinceIso}</code></p>
    <p>Total new feedback entries in last 24h: <strong>${total}</strong></p>
    <p>Status breakdown (current):</p>
    <ul>
      <li>new: <strong>${statusCounts.new}</strong></li>
      <li>in_progress: <strong>${statusCounts.in_progress}</strong></li>
      <li>done: <strong>${statusCounts.done}</strong></li>
    </ul>
    <p>Top pages:</p>
    <ul>${pageItems}</ul>
    <p>Top languages:</p>
    <ul>${languageItems}</ul>
  `
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!hasServiceRole()) {
    return NextResponse.json(
      {
        code: 'FEEDBACK_DIGEST_NOT_CONFIGURED',
        error: 'SUPABASE_SERVICE_ROLE_KEY is required.',
      },
      { status: 503 },
    )
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.FEEDBACK_DIGEST_FROM?.trim()
  const to = asList(process.env.FEEDBACK_DIGEST_TO)
  const sendWhenZero = parseBooleanFlag(process.env.FEEDBACK_DIGEST_SEND_WHEN_ZERO, true)

  if (!resendApiKey || !from || to.length === 0) {
    return NextResponse.json(
      {
        code: 'FEEDBACK_DIGEST_NOT_CONFIGURED',
        error: 'RESEND_API_KEY, FEEDBACK_DIGEST_FROM, and FEEDBACK_DIGEST_TO are required.',
      },
      { status: 503 },
    )
  }

  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sinceIso = since.toISOString()

  const { data, error } = await supabaseServer
    .from('user_feedback')
    .select('id,page_path,language,created_at,status')
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data || []) as DigestRow[]
  const total = rows.length
  const topPages = topCounts(rows.map((x) => x.page_path), 5)
  const topLanguages = topCounts(rows.map((x) => x.language), 5)
  const statusCounts = rows.reduce(
    (acc, row) => {
      acc[row.status] += 1
      return acc
    },
    { new: 0, in_progress: 0, done: 0 } as Record<'new' | 'in_progress' | 'done', number>,
  )

  const subjectDate = now.toISOString().slice(0, 10)
  const subject = `[ETF] Daily Feedback Digest (${subjectDate}) - ${total} new in 24h`
  const html = toHtml({
    total,
    sinceIso,
    topPages,
    topLanguages,
    statusCounts,
  })

  if (total === 0 && !sendWhenZero) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'No new feedback in last 24 hours',
      total,
      window_start_utc: sinceIso,
      recipients: to,
    })
  }

  const sendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  })

  if (!sendResp.ok) {
    const body = await sendResp.text()
    return NextResponse.json(
      {
        error: 'Failed to send digest email',
        provider_status: sendResp.status,
        provider_body: body.slice(0, 500),
      },
      { status: 502 },
    )
  }

  const sendJson = await sendResp.json().catch(() => ({}))
  return NextResponse.json({
    ok: true,
    total,
    window_start_utc: sinceIso,
    recipients: to,
    provider: sendJson,
  })
}
