import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

type Scope = 'global' | 'symbol'

function normalizeScope(raw: string | null): Scope {
  return raw === 'symbol' ? 'symbol' : 'global'
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = (payload || {}) as Record<string, unknown>
  const pagePath = typeof body.page_path === 'string' ? body.page_path.trim() : ''
  const symbolRaw = typeof body.symbol === 'string' ? body.symbol.trim() : ''
  const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : ''
  const language = typeof body.language === 'string' ? body.language.trim() : null

  if (!pagePath) {
    return NextResponse.json({ error: 'page_path is required' }, { status: 400 })
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
  }

  const symbol = symbolRaw ? symbolRaw.toUpperCase() : null

  const { error } = await supabaseServer.from('user_read_events').insert({
    page_path: pagePath,
    symbol,
    session_id: sessionId,
    language,
    user_agent: request.headers.get('user-agent'),
    created_at: new Date().toISOString(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scope = normalizeScope(searchParams.get('scope'))
  const symbol = (searchParams.get('symbol') || '').trim().toUpperCase()

  const baseQuery = supabaseServer.from('user_read_events').select('session_id,symbol,created_at')
  const query = scope === 'symbol' && symbol ? baseQuery.eq('symbol', symbol) : baseQuery

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (data || []) as Array<{
    session_id: string
    symbol: string | null
    created_at: string | null
  }>

  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const uniqueSessions = new Set<string>()
  let reads24h = 0

  for (const row of rows) {
    if (row.session_id) {
      uniqueSessions.add(row.session_id)
    }

    if (!row.created_at) continue
    const ts = new Date(row.created_at).getTime()
    if (!Number.isNaN(ts) && now - ts <= dayMs) {
      reads24h += 1
    }
  }

  const topSymbolsMap = new Map<string, number>()
  if (scope === 'global') {
    for (const row of rows) {
      if (!row.symbol) continue
      topSymbolsMap.set(row.symbol, (topSymbolsMap.get(row.symbol) || 0) + 1)
    }
  }

  const topSymbols = Array.from(topSymbolsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([s, count]) => ({ symbol: s, reads: count }))

  return NextResponse.json({
    data: {
      scope,
      symbol: scope === 'symbol' ? symbol : null,
      total_reads: rows.length,
      unique_sessions: uniqueSessions.size,
      reads_24h: reads24h,
      top_symbols: topSymbols,
    },
  })
}
