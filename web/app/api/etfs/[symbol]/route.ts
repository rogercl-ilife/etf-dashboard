import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = {
  params: Promise<{ symbol: string }>
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

  let snapshot: {
    latest_close: number | null
    change: number | null
    change_pct: number | null
    return_1y_pct: number | null
    return_3y_pct: number | null
    return_5y_pct: number | null
    updated_at: string | null
  } | null = null

  const snapshotResp = await supabase
    .from('etf_snapshots')
    .select('latest_close,change,change_pct,return_1y_pct,return_3y_pct,return_5y_pct,updated_at')
    .eq('symbol', symbol)
    .maybeSingle()

  if (snapshotResp.error && snapshotResp.error.message.includes('return_1y_pct')) {
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
        }
      : null
  } else if (snapshotResp.error) {
    return NextResponse.json({ error: snapshotResp.error.message }, { status: 500 })
  } else {
    snapshot = snapshotResp.data
  }

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

  return NextResponse.json({
    data: {
      ...etf,
      snapshot: snapshot || null,
      dividends: dividendsRows,
      kpis: {
        ttm_dividend_amount: ttmDividendAmount > 0 ? Number(ttmDividendAmount.toFixed(4)) : null,
        ttm_dividend_count: ttmRows.length,
        ttm_dividend_yield_pct: ttmYieldPct != null ? Number(ttmYieldPct.toFixed(4)) : null,
        period_returns_pct: {
          '1Y': snapshot?.return_1y_pct != null ? Number(snapshot.return_1y_pct) : null,
          '3Y': snapshot?.return_3y_pct != null ? Number(snapshot.return_3y_pct) : null,
          '5Y': snapshot?.return_5y_pct != null ? Number(snapshot.return_5y_pct) : null,
        },
      },
    },
  })
}
