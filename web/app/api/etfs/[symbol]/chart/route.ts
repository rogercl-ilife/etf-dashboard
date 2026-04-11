import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type Params = {
  params: Promise<{ symbol: string }>
}

type RangeKey = '1M' | '3M' | '1Y' | '3Y' | '5Y'

const rangeToMonths: Record<RangeKey, number> = {
  '1M': 1,
  '3M': 3,
  '1Y': 12,
  '3Y': 36,
  '5Y': 60,
}

const PAGE_SIZE = 1000
const MAX_PAGES = 8

function toStartDate(range: RangeKey) {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCMonth(date.getUTCMonth() - rangeToMonths[range])
  return date.toISOString().slice(0, 10)
}

function isRangeKey(value: string): value is RangeKey {
  return value === '1M' || value === '3M' || value === '1Y' || value === '3Y' || value === '5Y'
}

export async function GET(request: Request, { params }: Params) {
  const { symbol: rawSymbol } = await params
  const symbol = rawSymbol.trim().toUpperCase()

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const rangeParam = (searchParams.get('range') || '1Y').toUpperCase()
  const range: RangeKey = isRangeKey(rangeParam) ? rangeParam : '1Y'

  const startDate = toStartDate(range)
  const allRows: Array<{ trade_date: string; close: number | null }> = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error } = await supabase
      .from('etf_prices_daily')
      .select('trade_date,close')
      .eq('symbol', symbol)
      .gte('trade_date', startDate)
      .order('trade_date', { ascending: true })
      .range(from, to)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const batch = data || []
    allRows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  const chart = allRows
    .filter((row) => row.close != null)
    .map((row) => ({
      date: row.trade_date,
      close: Number(row.close),
    }))

  return NextResponse.json({ data: chart, range })
}
