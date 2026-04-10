import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type EtfRow = {
  symbol: string
  name: string | null
  issuer: string | null
  category: string | null
  expense_ratio: number | null
  inception_date: string | null
}

type SnapshotRow = {
  symbol: string
  return_1y_pct: number | null
  return_3y_pct: number | null
  return_5y_pct: number | null
  updated_at: string | null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') || '').trim().toUpperCase()
  const limitParam = Number(searchParams.get('limit') || 100)
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 200) : 100

  let query = supabase
    .from('etfs')
    .select('symbol,name,issuer,category,expense_ratio,inception_date')
    .order('symbol', { ascending: true })
    .limit(limit)

  if (q) {
    query = query.or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const etfs = (data || []) as EtfRow[]
  if (etfs.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const symbols = etfs.map((row) => row.symbol)
  const snapshotsResp = await supabase
    .from('etf_snapshots')
    .select('symbol,return_1y_pct,return_3y_pct,return_5y_pct,updated_at')
    .in('symbol', symbols)

  let snapshots: SnapshotRow[] = []
  if (snapshotsResp.error) {
    if (!snapshotsResp.error.message.includes('return_1y_pct')) {
      return NextResponse.json({ error: snapshotsResp.error.message }, { status: 500 })
    }
  } else {
    snapshots = (snapshotsResp.data || []) as SnapshotRow[]
  }

  const snapshotMap = new Map<string, SnapshotRow>()
  for (const row of snapshots) {
    snapshotMap.set(row.symbol, row)
  }

  const enriched = etfs.map((etf) => {
    const snap = snapshotMap.get(etf.symbol)
    return {
      ...etf,
      snapshot_updated_at: snap?.updated_at ?? null,
      period_returns_pct: {
        '1Y': snap?.return_1y_pct ?? null,
        '3Y': snap?.return_3y_pct ?? null,
        '5Y': snap?.return_5y_pct ?? null,
      },
    }
  })

  const lastUpdatedAt = snapshots
    .map((row) => row.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0] || null

  return NextResponse.json({ data: enriched, meta: { last_updated_at: lastUpdatedAt } })
}
