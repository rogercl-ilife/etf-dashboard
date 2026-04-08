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

  const [{ data: snapshot, error: snapshotError }, { data: dividends, error: dividendsError }] = await Promise.all([
    supabase
      .from('etf_snapshots')
      .select('latest_close,change,change_pct,updated_at')
      .eq('symbol', symbol)
      .maybeSingle(),
    supabase
      .from('etf_dividends')
      .select('ex_date,pay_date,amount')
      .eq('symbol', symbol)
      .order('ex_date', { ascending: false })
      .limit(24),
  ])

  if (snapshotError) {
    return NextResponse.json({ error: snapshotError.message }, { status: 500 })
  }

  if (dividendsError) {
    return NextResponse.json({ error: dividendsError.message }, { status: 500 })
  }

  return NextResponse.json({
    data: {
      ...etf,
      snapshot: snapshot || null,
      dividends: dividends || [],
    },
  })
}
