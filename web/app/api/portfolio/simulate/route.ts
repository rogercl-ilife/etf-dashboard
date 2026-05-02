import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type AllocationInput = {
  symbol: string
  weight_pct: number
}

type SimulateRequest = {
  amount: number
  horizon_years?: number
  persona?: 'stability' | 'balanced' | 'growth'
  return_period_mode?: 'auto' | '1Y' | '3Y' | '5Y' | '10Y'
  allocations: AllocationInput[]
}

type SnapshotRow = {
  symbol: string
  latest_close: number | null
  return_1y_pct: number | null
  return_3y_pct: number | null
  return_5y_pct: number | null
  return_10y_pct: number | null
}

type EtfMetaRow = {
  symbol: string
  inception_date: string | null
}

type DividendRow = {
  symbol: string
  ex_date: string
  amount: number | null
}

const WEIGHT_SUM_TOLERANCE = 0.01
const MIN_RETURN_COVERAGE_PCT = 80
const MIN_DIVIDEND_COVERAGE_PCT = 70
const PERIOD_PRIORITY: Array<'10Y' | '5Y' | '3Y' | '1Y'> = ['10Y', '5Y', '3Y', '1Y']

type ReturnPeriod = '1Y' | '3Y' | '5Y' | '10Y'

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function toPercentRound(value: number) {
  return Number(value.toFixed(4))
}

function toMoneyRound(value: number) {
  return Number(value.toFixed(2))
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

function sanitizeSnapshotByInception(snapshot: SnapshotRow, inceptionDate: string | null): SnapshotRow {
  if (!inceptionDate) return snapshot
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

function getPeriodReturn(row: SnapshotRow, period: ReturnPeriod): number | null {
  if (period === '1Y') return toFiniteNumber(row.return_1y_pct)
  if (period === '3Y') return toFiniteNumber(row.return_3y_pct)
  if (period === '5Y') return toFiniteNumber(row.return_5y_pct)
  return toFiniteNumber(row.return_10y_pct)
}

function annualizeFromPeriodReturn(periodReturnPct: number, period: ReturnPeriod): number | null {
  if (period === '1Y') {
    return periodReturnPct > -100 ? periodReturnPct : null
  }
  const years = period === '3Y' ? 3 : period === '5Y' ? 5 : 10
  const growth = 1 + periodReturnPct / 100
  if (growth <= 0) return null
  return (Math.pow(growth, 1 / years) - 1) * 100
}

function availablePeriods(row: SnapshotRow): ReturnPeriod[] {
  const periods: ReturnPeriod[] = []
  for (const period of PERIOD_PRIORITY) {
    const value = getPeriodReturn(row, period)
    if (value != null) periods.push(period)
  }
  return periods
}

function chooseEffectivePeriod(
  requestedMode: SimulateRequest['return_period_mode'],
  snapshotsBySymbol: Map<string, SnapshotRow>,
  symbols: string[],
): { effectivePeriod: ReturnPeriod | null; requestedPeriod: ReturnPeriod | null } {
  const requestedPeriod: ReturnPeriod | null =
    requestedMode && requestedMode !== 'auto' ? (requestedMode as ReturnPeriod) : null

  const isCommonPeriod = (period: ReturnPeriod) => {
    for (const symbol of symbols) {
      const row = snapshotsBySymbol.get(symbol)
      if (!row) return false
      if (getPeriodReturn(row, period) == null) return false
    }
    return true
  }

  if (requestedPeriod) {
    const requestedIndex = PERIOD_PRIORITY.indexOf(requestedPeriod)
    for (let i = requestedIndex; i < PERIOD_PRIORITY.length; i += 1) {
      const period = PERIOD_PRIORITY[i]
      if (isCommonPeriod(period)) {
        return { effectivePeriod: period, requestedPeriod }
      }
    }
    return { effectivePeriod: null, requestedPeriod }
  }

  for (const period of PERIOD_PRIORITY) {
    if (isCommonPeriod(period)) {
      return { effectivePeriod: period, requestedPeriod: null }
    }
  }

  return { effectivePeriod: null, requestedPeriod: null }
}

function validateAndNormalizeInput(payload: unknown): { data: SimulateRequest } | { error: string } {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Invalid JSON body' }
  }

  const body = payload as Record<string, unknown>
  const amount = toFiniteNumber(body.amount)
  if (amount == null || amount <= 0) {
    return { error: 'amount must be a positive number' }
  }

  const horizonRaw = toFiniteNumber(body.horizon_years)
  const horizonYears = horizonRaw == null ? 10 : Math.trunc(horizonRaw)
  if (horizonYears < 1 || horizonYears > 40) {
    return { error: 'horizon_years must be between 1 and 40' }
  }

  const allocationsRaw = body.allocations
  if (!Array.isArray(allocationsRaw) || allocationsRaw.length === 0) {
    return { error: 'allocations is required' }
  }

  const normalized: AllocationInput[] = []
  for (const item of allocationsRaw) {
    if (!item || typeof item !== 'object') {
      return { error: 'allocations contains invalid item' }
    }
    const row = item as Record<string, unknown>
    const symbol = typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : ''
    const weight = toFiniteNumber(row.weight_pct)

    if (!symbol) return { error: 'allocation symbol is required' }
    if (weight == null || weight < 0) return { error: `allocation weight_pct is invalid for ${symbol}` }

    normalized.push({ symbol, weight_pct: weight })
  }

  const unique = new Map<string, number>()
  for (const row of normalized) {
    unique.set(row.symbol, (unique.get(row.symbol) || 0) + row.weight_pct)
  }
  const deduped = Array.from(unique.entries()).map(([symbol, weight_pct]) => ({ symbol, weight_pct }))
  const sumWeight = deduped.reduce((sum, row) => sum + row.weight_pct, 0)
  if (Math.abs(sumWeight - 100) > WEIGHT_SUM_TOLERANCE) {
    return { error: `allocations weight sum must equal 100 (got ${sumWeight.toFixed(4)})` }
  }

  const personaRaw = typeof body.persona === 'string' ? body.persona.trim() : ''
  const persona =
    personaRaw === 'stability' || personaRaw === 'balanced' || personaRaw === 'growth'
      ? (personaRaw as SimulateRequest['persona'])
      : undefined
  const returnPeriodModeRaw = typeof body.return_period_mode === 'string' ? body.return_period_mode.trim() : 'auto'
  const returnPeriodMode =
    returnPeriodModeRaw === 'auto' ||
    returnPeriodModeRaw === '1Y' ||
    returnPeriodModeRaw === '3Y' ||
    returnPeriodModeRaw === '5Y' ||
    returnPeriodModeRaw === '10Y'
      ? (returnPeriodModeRaw as SimulateRequest['return_period_mode'])
      : 'auto'

  return {
    data: {
      amount,
      horizon_years: horizonYears,
      persona,
      return_period_mode: returnPeriodMode,
      allocations: deduped,
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
  const symbols = input.allocations.map((row) => row.symbol)
  const warnings: string[] = []

  const etfResp = await supabase.from('etfs').select('symbol,inception_date').in('symbol', symbols)
  if (etfResp.error) {
    return NextResponse.json({ error: etfResp.error.message }, { status: 500 })
  }
  const etfRows = (etfResp.data || []) as EtfMetaRow[]
  const found = new Set(etfRows.map((row) => row.symbol))
  const inceptionBySymbol = new Map(etfRows.map((row) => [row.symbol, row.inception_date]))
  const missingSymbols = symbols.filter((symbol) => !found.has(symbol))
  if (missingSymbols.length > 0) {
    return NextResponse.json(
      { error: `Unknown ETF symbol(s): ${missingSymbols.join(', ')}` },
      { status: 400 },
    )
  }

  const snapshotResp = await supabase
    .from('etf_snapshots')
    .select('symbol,latest_close,return_1y_pct,return_3y_pct,return_5y_pct,return_10y_pct')
    .in('symbol', symbols)

  if (snapshotResp.error) {
    return NextResponse.json({ error: snapshotResp.error.message }, { status: 500 })
  }

  const snapshots = (snapshotResp.data || []) as SnapshotRow[]
  const snapshotMap = new Map<string, SnapshotRow>()
  for (const row of snapshots) {
    const inceptionDate = inceptionBySymbol.get(row.symbol) ?? null
    snapshotMap.set(row.symbol, sanitizeSnapshotByInception(row, inceptionDate))
  }

  const periodPick = chooseEffectivePeriod(input.return_period_mode, snapshotMap, symbols)
  if (!periodPick || !periodPick.effectivePeriod) {
    return NextResponse.json({ error: 'No common return period for selected ETFs' }, { status: 422 })
  }
  const effectivePeriod = periodPick.effectivePeriod

  const perSymbolPeriods = input.allocations.map((allocation) => {
    const snapshot = snapshotMap.get(allocation.symbol)
    return {
      symbol: allocation.symbol,
      available_periods: snapshot ? availablePeriods(snapshot) : [],
    }
  })

  const periodAvailabilityCounts = {
    '1Y': 0,
    '3Y': 0,
    '5Y': 0,
    '10Y': 0,
  }
  for (const row of perSymbolPeriods) {
    for (const period of row.available_periods) {
      periodAvailabilityCounts[period] += 1
    }
  }

  let weightedAnnualReturnSum = 0
  let returnCoverageWeight = 0
  for (const allocation of input.allocations) {
    const snapshot = snapshotMap.get(allocation.symbol)
    if (!snapshot) continue
    const periodReturnPct = getPeriodReturn(snapshot, effectivePeriod)
    if (periodReturnPct == null) continue
    const annualReturnPct = annualizeFromPeriodReturn(periodReturnPct, effectivePeriod)
    if (annualReturnPct == null) continue

    weightedAnnualReturnSum += (allocation.weight_pct * annualReturnPct) / 100
    returnCoverageWeight += allocation.weight_pct
  }

  const returnCoveragePct = toPercentRound(returnCoverageWeight)
  if (returnCoveragePct < MIN_RETURN_COVERAGE_PCT) {
    return NextResponse.json(
      {
        error: `Insufficient return coverage (${returnCoveragePct.toFixed(2)}%). Need at least ${MIN_RETURN_COVERAGE_PCT}%.`,
      },
      { status: 422 },
    )
  }
  if (returnCoveragePct < 100) {
    warnings.push(`return_coverage_partial:${returnCoveragePct.toFixed(2)}%`)
  }
  if (periodPick.requestedPeriod && periodPick.requestedPeriod !== effectivePeriod) {
    warnings.push(`return_period_downgraded:${periodPick.requestedPeriod}->${effectivePeriod}`)
  }

  const weightedBaselineAnnualReturnPct =
    returnCoverageWeight > 0 ? weightedAnnualReturnSum / (returnCoverageWeight / 100) : null

  if (weightedBaselineAnnualReturnPct == null) {
    return NextResponse.json({ error: 'Insufficient snapshot return data' }, { status: 422 })
  }

  const horizonYears = input.horizon_years || 10
  const baseRate = weightedBaselineAnnualReturnPct / 100
  const bullRate = (weightedBaselineAnnualReturnPct + 2.0) / 100
  const bearRate = Math.max((weightedBaselineAnnualReturnPct - 3.0) / 100, -0.95)

  const baseEndValue = input.amount * Math.pow(1 + baseRate, horizonYears)
  const bullEndValue = input.amount * Math.pow(1 + bullRate, horizonYears)
  const bearEndValue = input.amount * Math.pow(1 + bearRate, horizonYears)

  const now = new Date()
  const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const dividendResp = await supabase
    .from('etf_dividends')
    .select('symbol,ex_date,amount')
    .in('symbol', symbols)
    .gte('ex_date', from)

  if (dividendResp.error) {
    return NextResponse.json({ error: dividendResp.error.message }, { status: 500 })
  }

  const dividends = (dividendResp.data || []) as DividendRow[]
  const ttmDividendAmountBySymbol = new Map<string, number>()
  for (const row of dividends) {
    const amount = toFiniteNumber(row.amount)
    if (amount == null) continue
    ttmDividendAmountBySymbol.set(row.symbol, (ttmDividendAmountBySymbol.get(row.symbol) || 0) + amount)
  }

  let weightedPortfolioYieldPct = 0
  let dividendCoverageWeight = 0
  for (const allocation of input.allocations) {
    const snapshot = snapshotMap.get(allocation.symbol)
    const latestClose = snapshot ? toFiniteNumber(snapshot.latest_close) : null
    const ttmDividendAmount = ttmDividendAmountBySymbol.get(allocation.symbol)

    if (latestClose == null || latestClose <= 0 || ttmDividendAmount == null) continue

    const ttmYieldPct = (ttmDividendAmount / latestClose) * 100
    weightedPortfolioYieldPct += (allocation.weight_pct * ttmYieldPct) / 100
    dividendCoverageWeight += allocation.weight_pct
  }

  const dividendCoveragePct = toPercentRound(dividendCoverageWeight)
  let estimatedAnnualDividendAmount: number | null = null
  let estimatedMonthlyDividendAmount: number | null = null
  let portfolioTtmDividendYieldPct: number | null = null

  if (dividendCoveragePct >= MIN_DIVIDEND_COVERAGE_PCT) {
    portfolioTtmDividendYieldPct = toPercentRound(weightedPortfolioYieldPct)
    estimatedAnnualDividendAmount = toMoneyRound((input.amount * weightedPortfolioYieldPct) / 100)
    estimatedMonthlyDividendAmount = toMoneyRound(estimatedAnnualDividendAmount / 12)
    if (dividendCoveragePct < 100) {
      warnings.push(`dividend_coverage_partial:${dividendCoveragePct.toFixed(2)}%`)
    }
  } else {
    warnings.push(`dividend_coverage_insufficient:${dividendCoveragePct.toFixed(2)}%`)
  }

  return NextResponse.json({
    data: {
      input_amount: toMoneyRound(input.amount),
      horizon_years: horizonYears,
      weighted_baseline_annual_return_pct: toPercentRound(weightedBaselineAnnualReturnPct),
      projection: {
        base_end_value: toMoneyRound(baseEndValue),
        bull_end_value: toMoneyRound(bullEndValue),
        bear_end_value: toMoneyRound(bearEndValue),
      },
      estimated_dividend: {
        portfolio_ttm_dividend_yield_pct: portfolioTtmDividendYieldPct,
        estimated_annual_dividend_amount: estimatedAnnualDividendAmount,
        estimated_monthly_dividend_amount: estimatedMonthlyDividendAmount,
      },
      assumptions: {
        return_coverage_pct: returnCoveragePct,
        return_period_mode: input.return_period_mode || 'auto',
        return_period_used: effectivePeriod,
        return_period_requested: periodPick.requestedPeriod,
        return_period_availability_counts: periodAvailabilityCounts,
        return_period_symbol_total: input.allocations.length,
        per_symbol_return_periods: perSymbolPeriods,
        dividend_coverage_pct: dividendCoveragePct,
        bull_alpha_pct: 2.0,
        bear_alpha_pct: -3.0,
        ttm_window_days: 365,
      },
      warnings,
    },
  })
}
