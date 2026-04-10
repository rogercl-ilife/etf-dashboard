import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

const MAX_MESSAGE_LEN = 2000
const MAX_EMAIL_LEN = 320
const MAX_NOTE_LEN = 2000

type FeedbackStatus = 'new' | 'in_progress' | 'done'

function normalizeStatus(value: unknown): FeedbackStatus | null {
  if (value === 'new' || value === 'in_progress' || value === 'done') return value
  return null
}

function isMissingWorkflowColumnError(error: { code?: string; message?: string }) {
  return error.code === '42703' || error.message?.includes('column') || false
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = (payload || {}) as Record<string, unknown>
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const emailRaw = typeof body.email === 'string' ? body.email.trim() : ''
  const pagePath = typeof body.page_path === 'string' ? body.page_path.trim() : ''
  const language = typeof body.language === 'string' ? body.language.trim() : null

  if (!message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 })
  }

  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json({ error: `message is too long (max ${MAX_MESSAGE_LEN})` }, { status: 400 })
  }

  if (emailRaw.length > MAX_EMAIL_LEN) {
    return NextResponse.json({ error: `email is too long (max ${MAX_EMAIL_LEN})` }, { status: 400 })
  }

  const { error } = await supabaseServer.from('user_feedback').insert({
    message,
    email: emailRaw || null,
    page_path: pagePath || null,
    language,
    user_agent: request.headers.get('user-agent'),
    created_at: new Date().toISOString(),
  })

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'Feedback table is missing. Run scripts/week6_feedback_analytics_setup.sql in Supabase SQL Editor.' },
        { status: 500 },
      )
    }
    if (error.code === '42501') {
      return NextResponse.json(
        { error: 'Feedback insert is blocked by RLS policy. Run scripts/week6_feedback_analytics_setup.sql.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim()
  const statusFilter = normalizeStatus(searchParams.get('status'))
  const limitParam = Number(searchParams.get('limit') || 200)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 200

  let query = supabaseServer
    .from('user_feedback')
    .select('id,message,email,page_path,language,created_at,status,handled_at,handled_note')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    query = query.or(`message.ilike.%${q}%,email.ilike.%${q}%,page_path.ilike.%${q}%`)
  }
  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const primaryResp = await query
  if (!primaryResp.error) {
    return NextResponse.json({ data: primaryResp.data || [] })
  }

  if (!isMissingWorkflowColumnError(primaryResp.error)) {
    return NextResponse.json({ error: primaryResp.error.message }, { status: 500 })
  }

  let fallbackQuery = supabaseServer
    .from('user_feedback')
    .select('id,message,email,page_path,language,created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (q) {
    fallbackQuery = fallbackQuery.or(`message.ilike.%${q}%,email.ilike.%${q}%,page_path.ilike.%${q}%`)
  }

  const fallbackResp = await fallbackQuery
  if (fallbackResp.error) {
    return NextResponse.json({ error: fallbackResp.error.message }, { status: 500 })
  }

  const mapped = (fallbackResp.data || []).map((row) => ({
    ...row,
    status: 'new',
    handled_at: null,
    handled_note: null,
  }))

  if (statusFilter && statusFilter !== 'new') {
    return NextResponse.json({ data: [] })
  }

  return NextResponse.json({
    data: mapped,
    meta: {
      note: 'Workflow fields missing. Run scripts/week7_feedback_workflow_setup.sql for status management.',
    },
  })
}

export async function PATCH(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = (payload || {}) as Record<string, unknown>
  const id = typeof body.id === 'number' ? body.id : Number(body.id)
  const status = normalizeStatus(body.status)
  const handledNoteRaw = typeof body.handled_note === 'string' ? body.handled_note.trim() : ''

  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }
  if (!status) {
    return NextResponse.json({ error: 'status is invalid' }, { status: 400 })
  }
  if (handledNoteRaw.length > MAX_NOTE_LEN) {
    return NextResponse.json({ error: `handled_note is too long (max ${MAX_NOTE_LEN})` }, { status: 400 })
  }

  const { error } = await supabaseServer
    .from('user_feedback')
    .update({
      status,
      handled_at: status === 'done' ? new Date().toISOString() : null,
      handled_note: handledNoteRaw || null,
    })
    .eq('id', id)

  if (error) {
    if (isMissingWorkflowColumnError(error)) {
      return NextResponse.json(
        { error: 'Workflow columns are missing. Run scripts/week7_feedback_workflow_setup.sql.' },
        { status: 500 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
