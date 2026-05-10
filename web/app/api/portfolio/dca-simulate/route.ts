import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type DcaAllocationInput = {
  symbol: string
  monthly_shares: number
}

type DcaPeriodPreset = '1Y' | '3Y' | '5Y' | '10Y'
type DcaPeriodMode = DcaPeriodPreset | 'custom'

type DcaRequest = {
  dca_allocations: DcaAllocationInput[]
  period_mode: DcaPeriodMode
  custom_start_date?: string
  custom_end_date?: string
}

type EtfMetaRow = {
  symbol: string
  inception_date: string | null
}

type PriceRow = {
  trade_date: string
  close: number | null
}

const PRESET_ORDER: DcaPeriodPreset[] = ['10Y', '5Y', '3Y', '1Y']
const PRESET_YEARS: Record<DcaPeriodPreset, number> = {
  '1Y': 1,
  '3Y': 3,
  '5Y': 5,
  '10Y': 10,
}
const PAGE_SIZE = 1000
const MAX_PAGES = 16

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toMoneyRound(value: number) {
  return Number(value.toFixed(2))
}

function toSharesRound(value: number) {
  return Number(value.toFixed(6))
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

function isValidDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime())
}

function monthKey(date: string) {
  return date.slice(0, 7)
}

function pickEffectivePreset(requested: DcaPeriodPreset, rows: EtfMetaRow[]) {
  const now = new Date()
  const requestedIndex = PRESET_ORDER.indexOf(requested)

  const satisfies = (preset: DcaPeriodPreset) => {
    const yearsNeed = PRESET_YEARS[preset]
    for (const row of rows) {
      if (!row.inception_date) return false
      const years = fullYearsBetween(row.inception_date, now)
      if (years == null || years < yearsNeed) return false
    }
    return true
  }

  for (let i = requestedIndex; i < PRESET_ORDER.length; i += 1) {
    const candidate = PRESET_ORDER[i]
    if (satisfies(candidate)) {
      return candidate
    }
  }

  return null
}

function pickEffectivePresetForOne(requested: DcaPeriodPreset, inceptionDate: string | null): DcaPeriodPreset | null {
  if (!inceptionDate) return null
  const now = new Date()
  const years = fullYearsBetween(inceptionDate, now)
  if (years == null) return null
  const requestedIndex = PRESET_ORDER.indexOf(requested)
  for (let i = requestedIndex; i < PRESET_ORDER.length; i += 1) {
    const candidate = PRESET_ORDER[i]
    if (years >= PRESET_YEARS[candidate]) return candidate
  }
  return null
}

async function fetchPrices(symbol: string, startDate: string, endDate: string): Promise<PriceRow[]> {
  const rows: PriceRow[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    const resp = await supabase
      .from('etf_prices_daily')
      .select('trade_date,close')
      .eq('symbol', symbol)
      .gte('trade_date', startDate)
      .lte('trade_date', endDate)
      .order('trade_date', { ascending: true })
      .range(from, to)

    if (resp.error) throw new Error(resp.error.message)
    const batch = (resp.data || []) as PriceRow[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) break
  }

  return rows.filter((row) => row.close != null)
}

function validateAndNormalizeInput(payload: unknown): { data: DcaRequest } | { error: string } {
  if (!payload || typeof payload !== 'object') return { error: 'Invalid JSON body' }

  const body = payload as Record<string, unknown>
  const allocationsRaw = body.dca_allocations
  if (!Array.isArray(allocationsRaw) || allocationsRaw.length === 0) {
    return { error: 'dca_allocations is required' }
  }

  const normalized: DcaAllocationInput[] = []
  for (const item of allocationsRaw) {
    if (!item || typeof item !== 'object') return { error: 'dca_allocations contains invalid item' }
    const row = item as Record<string, unknown>
    const symbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : ''
    const monthlyShares = toFiniteNumber(row.monthly_shares)
    if (!symbol) return { error: 'allocation symbol is required' }
    if (monthlyShares == null || monthlyShares <= 0 || monthlyShares > 10000) {
      return { error: `monthly_shares is invalid for ${symbol}` }
    }
    normalized.push({ symbol, monthly_shares: monthlyShares })
  }

  const unique = new Map<string, number>()
  for (const row of normalized) {
    unique.set(row.symbol, (unique.get(row.symbol) || 0) + row.monthly_shares)
  }
  const deduped = Array.from(unique.entries()).map(([symbol, monthly_shares]) => ({ symbol, monthly_shares }))

  const periodModeRaw = typeof body.period_mode === 'string' ? body.period_mode.trim() : '10Y'
  const periodMode: DcaPeriodMode =
    periodModeRaw === '1Y' ||
    periodModeRaw === '3Y' ||
    periodModeRaw === '5Y' ||
    periodModeRaw === '10Y' ||
    periodModeRaw === 'custom'
      ? periodModeRaw
      : '10Y'

  const customStartDate = typeof body.custom_start_date === 'string' ? body.custom_start_date.trim() : undefined
  const customEndDate = typeof body.custom_end_date === 'string' ? body.custom_end_date.trim() : undefined
  if (periodMode === 'custom') {
    if (!customStartDate || !customEndDate) return { error: 'custom_start_date and custom_end_date are required for custom mode' }
    if (!isValidDateString(customStartDate) || !isValidDateString(customEndDate)) return { error: 'custom date must be YYYY-MM-DD' }
    if (customStartDate > customEndDate) return { error: 'custom_start_date must be <= custom_end_date' }
  }

  return {
    data: {
      dca_allocations: deduped,
      period_mode: periodMode,
      custom_start_date: customStartDate,
      custom_end_date: customEndDate,
    },
  }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validated = validateAndNormalizeInput(payload)
  if ('error' in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const input = validated.data
  const symbols = input.dca_allocations.map((row) => row.symbol)

  const etfResp = await supabase.from('etfs').select('symbol,inception_date').in('symbol', symbols)
  if (etfResp.error) return NextResponse.json({ error: etfResp.error.message }, { status: 500 })

  const etfRows = (etfResp.data || []) as EtfMetaRow[]
  const found = new Set(etfRows.map((row) => row.symbol))
  const missingSymbols = symbols.filter((symbol) => !found.has(symbol))
  if (missingSymbols.length > 0) {
    return NextResponse.json({ error: `Unknown ETF symbol(s): ${missingSymbols.join(', ')}` }, { status: 400 })
  }

  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)

  let requestedPreset: DcaPeriodPreset | null = null
  let usedPreset: DcaPeriodPreset | null = null
  let startDate = ''
  let endDate = ''

  if (input.period_mode === 'custom') {
    startDate = input.custom_start_date as string
    endDate = input.custom_end_date as string
  } else {
    requestedPreset = input.period_mode
    const effectivePreset = pickEffectivePreset(input.period_mode, etfRows)
    if (!effectivePreset) {
      usedPreset = null
    } else {
      usedPreset = effectivePreset
    }
    endDate = now.toISOString().slice(0, 10)
    const years = PRESET_YEARS[input.period_mode]
    const start = new Date(now)
    start.setUTCFullYear(start.getUTCFullYear() - years)
    startDate = start.toISOString().slice(0, 10)
  }

  const perSymbol = [] as Array<{
    symbol: string
    invested_amount: number
    settlement_amount: number
    accumulated_shares: number
    monthly_buy_count: number
    first_buy_date: string | null
    last_price_date: string | null
    period_requested: DcaPeriodPreset | null
    period_used: DcaPeriodPreset | null
    used_start_date: string | null
    used_end_date: string | null
    downgraded: boolean
  }>

  let totalInvested = 0
  let totalSettlement = 0
  let totalShares = 0

  for (const symbol of symbols) {
    const meta = etfRows.find((row) => row.symbol === symbol)
    let symbolRequestedPreset: DcaPeriodPreset | null = requestedPreset
    let symbolUsedPreset: DcaPeriodPreset | null = null
    let symbolStartDate = startDate
    let symbolEndDate = endDate

    if (requestedPreset) {
      symbolUsedPreset = pickEffectivePresetForOne(requestedPreset, meta?.inception_date ?? null)
      if (symbolUsedPreset) {
        const years = PRESET_YEARS[symbolUsedPreset]
        const start = new Date(now)
        start.setUTCFullYear(start.getUTCFullYear() - years)
        symbolStartDate = start.toISOString().slice(0, 10)
      }
    }

    const prices = await fetchPrices(symbol, symbolStartDate, symbolEndDate)
    if (prices.length === 0) {
      perSymbol.push({
        symbol,
        invested_amount: 0,
        settlement_amount: 0,
        accumulated_shares: 0,
        monthly_buy_count: 0,
        first_buy_date: null,
        last_price_date: null,
        period_requested: symbolRequestedPreset,
        period_used: symbolUsedPreset,
        used_start_date: symbolStartDate,
        used_end_date: symbolEndDate,
        downgraded: symbolRequestedPreset != null && symbolUsedPreset != null && symbolRequestedPreset !== symbolUsedPreset,
      })
      continue
    }

    const monthFirstPrice = new Map<string, PriceRow>()
    for (const row of prices) {
      const key = monthKey(row.trade_date)
      if (!monthFirstPrice.has(key)) monthFirstPrice.set(key, row)
    }

    let invested = 0
    let shares = 0
    let buyCount = 0
    let firstBuyDate: string | null = null

    const rowConfig = input.dca_allocations.find((row) => row.symbol === symbol)
    const monthlyShares = rowConfig?.monthly_shares ?? 1

    for (const buyRow of monthFirstPrice.values()) {
      const price = buyRow.close as number
      invested += monthlyShares * price
      shares += monthlyShares
      buyCount += 1
      if (!firstBuyDate) firstBuyDate = buyRow.trade_date
    }

    const lastPrice = prices[prices.length - 1]
    const settlement = shares * (lastPrice.close as number)

    totalInvested += invested
    totalSettlement += settlement
    totalShares += shares

    perSymbol.push({
      symbol,
      invested_amount: toMoneyRound(invested),
      settlement_amount: toMoneyRound(settlement),
      accumulated_shares: toSharesRound(shares),
      monthly_buy_count: buyCount,
      first_buy_date: firstBuyDate,
      last_price_date: lastPrice.trade_date,
      period_requested: symbolRequestedPreset,
      period_used: symbolUsedPreset,
      used_start_date: symbolStartDate,
      used_end_date: symbolEndDate,
      downgraded: symbolRequestedPreset != null && symbolUsedPreset != null && symbolRequestedPreset !== symbolUsedPreset,
    })
  }

  return NextResponse.json({
    data: {
      assumptions: {
        period_mode_requested: input.period_mode,
        period_preset_requested: requestedPreset,
        period_preset_used: usedPreset,
        downgraded: requestedPreset != null && perSymbol.some((row) => row.downgraded),
        start_date: startDate,
        end_date: endDate,
        monthly_shares_per_etf: null,
      },
      total_invested_amount: toMoneyRound(totalInvested),
      settlement_amount: toMoneyRound(totalSettlement),
      unrealized_pnl_amount: toMoneyRound(totalSettlement - totalInvested),
      total_accumulated_shares: toSharesRound(totalShares),
      per_symbol: perSymbol,
    },
  })
}
