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
  return_10y_pct: number | null
  updated_at: string | null
}

function fullYearsBetween(startDate: string, endDate: Date) {
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return null
  let years = endDate.getUTCFullYear() - start.getUTCFullYear()
  const monthDiff = endDate.getUTCMonth() - start.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && endDate.getUTCDate() < start.getUTCDate())) {
    years -= 1
  }
  return years
}

function sanitizePeriodReturnsByInception(etf: EtfRow, snap?: SnapshotRow) {
  const now = new Date()
  const years = etf.inception_date ? fullYearsBetween(etf.inception_date, now) : null
  const hasAtLeast = (n: number) => (years == null ? true : years >= n)

  return {
    '1Y': hasAtLeast(1) ? (snap?.return_1y_pct ?? null) : null,
    '3Y': hasAtLeast(3) ? (snap?.return_3y_pct ?? null) : null,
    '5Y': hasAtLeast(5) ? (snap?.return_5y_pct ?? null) : null,
    '10Y': hasAtLeast(10) ? (snap?.return_10y_pct ?? null) : null,
  }
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
    .select('symbol,return_1y_pct,return_3y_pct,return_5y_pct,return_10y_pct,updated_at')
    .in('symbol', symbols)

  let snapshots: SnapshotRow[] = []
  if (snapshotsResp.error) {
    if (!snapshotsResp.error.message.includes('return_')) {
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
      period_returns_pct: sanitizePeriodReturnsByInception(etf, snap),
    }
  })

  const lastUpdatedAt = snapshots
    .map((row) => row.updated_at)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))[0] || null

  return NextResponse.json({ data: enriched, meta: { last_updated_at: lastUpdatedAt } })
}
