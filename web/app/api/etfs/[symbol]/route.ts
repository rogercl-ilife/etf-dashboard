import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = {
  params: Promise<{ symbol: string }>
}

type SnapshotRow = {
  latest_close: number | null
  change: number | null
  change_pct: number | null
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

function sanitizeSnapshotByInception(snapshot: SnapshotRow | null, inceptionDate: string | null): SnapshotRow | null {
  if (!snapshot || !inceptionDate) return snapshot
  const years = fullYearsBetween(inceptionDate, new Date())
  if (years == null) return snapshot

  return {
    ...snapshot,
    return_1y_pct: years >= 1 ? snapshot.return_1y_pct : null,
    return_3y_pct: years >= 3 ? snapshot.return_3y_pct : null,
    return_5y_pct: years >= 5 ? snapshot.return_5y_pct : null,
    return_10y_pct: years >= 10 ? snapshot.return_10y_pct : null,
  }
}

function readText(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return null
}

function readNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

export async function GET(_: Request, { params }: Params) {
  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.trim().toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  const { data: etf, error: etfError } = await supabase
    .from('etfs')
    .select('symbol,name,issuer,category,expense_ratio,inception_date')
    .eq('symbol', symbol)
    .maybeSingle()

  if (etfError) {
    return NextResponse.json({ error: etfError.message }, { status: 500 })
  }

  if (!etf) {
    return NextResponse.json({ error: `ETF ${symbol} not found` }, { status: 404 })
  }

  const dividendsResp = await supabase
    .from('etf_dividends')
    .select('ex_date,pay_date,amount')
    .eq('symbol', symbol)
    .order('ex_date', { ascending: false })
    .limit(24)

  if (dividendsResp.error) {
    return NextResponse.json({ error: dividendsResp.error.message }, { status: 500 })
  }

  let snapshot: SnapshotRow | null = null

  const snapshotResp = await supabase
    .from('etf_snapshots')
    .select('latest_close,change,change_pct,return_1y_pct,return_3y_pct,return_5y_pct,return_10y_pct,updated_at')
    .eq('symbol', symbol)
    .maybeSingle()

  if (snapshotResp.error && snapshotResp.error.message.includes('return_')) {
    const fallbackSnapshotResp = await supabase
      .from('etf_snapshots')
      .select('latest_close,change,change_pct,updated_at')
      .eq('symbol', symbol)
      .maybeSingle()

    if (fallbackSnapshotResp.error) {
      return NextResponse.json({ error: fallbackSnapshotResp.error.message }, { status: 500 })
    }

    snapshot = fallbackSnapshotResp.data
      ? {
          ...fallbackSnapshotResp.data,
          return_1y_pct: null,
          return_3y_pct: null,
          return_5y_pct: null,
          return_10y_pct: null,
        }
      : null
  } else if (snapshotResp.error) {
    return NextResponse.json({ error: snapshotResp.error.message }, { status: 500 })
  } else {
    snapshot = snapshotResp.data
  }
  snapshot = sanitizeSnapshotByInception(snapshot, etf.inception_date)

  const dividendsRows = dividendsResp.data || []
  const oneYearAgo = new Date()
  oneYearAgo.setUTCDate(oneYearAgo.getUTCDate() - 365)

  const ttmRows = dividendsRows.filter((row) => {
    const exDate = new Date(row.ex_date)
    return !Number.isNaN(exDate.getTime()) && exDate >= oneYearAgo && row.amount != null
  })

  const ttmDividendAmount = ttmRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const latestClose = snapshot?.latest_close != null ? Number(snapshot.latest_close) : null
  const ttmYieldPct = latestClose && latestClose > 0 ? (ttmDividendAmount / latestClose) * 100 : null

  const holdingsResp = await supabase
    .from('etf_holdings')
    .select('*')
    .eq('symbol', symbol)
    .order('as_of_date', { ascending: false })
    .order('rank', { ascending: true })
    .limit(500)

  let holdings: Array<{
    holding_symbol: string | null
    holding_name: string | null
    weight_pct: number | null
    as_of_date: string | null
  }> = []

  if (!holdingsResp.error) {
    const rows = (holdingsResp.data || []) as Record<string, unknown>[]
    const mapped = rows
      .map((row) => ({
        holding_symbol: readText(row, ['holding_symbol', 'constituent_symbol', 'ticker', 'stock_symbol']),
        holding_name: readText(row, ['holding_name', 'constituent_name', 'name']),
        weight_pct: readNumber(row, ['weight_pct', 'weight', 'holding_weight_pct']),
        as_of_date: readText(row, ['as_of_date', 'report_date', 'updated_at']),
      }))
      .filter((row) => row.holding_symbol || row.holding_name || row.weight_pct != null)

    let latestAsOf: string | null = null
    for (const row of mapped) {
      if (!row.as_of_date) continue
      if (!latestAsOf || row.as_of_date > latestAsOf) {
        latestAsOf = row.as_of_date
      }
    }

    holdings = mapped
      .filter((row) => (latestAsOf ? row.as_of_date === latestAsOf : true))
      .sort((a, b) => {
        if (a.weight_pct == null && b.weight_pct == null) return 0
        if (a.weight_pct == null) return 1
        if (b.weight_pct == null) return -1
        return b.weight_pct - a.weight_pct
      })
      .slice(0, 50)
  }

  return NextResponse.json({
    data: {
      ...etf,
      snapshot: snapshot || null,
      dividends: dividendsRows,
      holdings,
      kpis: {
        ttm_dividend_amount: ttmDividendAmount > 0 ? Number(ttmDividendAmount.toFixed(4)) : null,
        ttm_dividend_count: ttmRows.length,
        ttm_dividend_yield_pct: ttmYieldPct != null ? Number(ttmYieldPct.toFixed(4)) : null,
        period_returns_pct: {
          '1Y': snapshot?.return_1y_pct != null ? Number(snapshot.return_1y_pct) : null,
          '3Y': snapshot?.return_3y_pct != null ? Number(snapshot.return_3y_pct) : null,
          '5Y': snapshot?.return_5y_pct != null ? Number(snapshot.return_5y_pct) : null,
          '10Y': snapshot?.return_10y_pct != null ? Number(snapshot.return_10y_pct) : null,
        },
      },
    },
  })
}
