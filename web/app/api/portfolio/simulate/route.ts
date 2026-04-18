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
  allocations: AllocationInput[]
}

type SnapshotRow = {
  symbol: string
  latest_close: number | null
  return_1y_pct: number | null
  return_3y_pct: number | null
  return_5y_pct: number | null
}

type DividendRow = {
  symbol: string
  ex_date: string
  amount: number | null
}

const WEIGHT_SUM_TOLERANCE = 0.01
const MIN_RETURN_COVERAGE_PCT = 80
const MIN_DIVIDEND_COVERAGE_PCT = 70

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

function annualizeReturnFromSnapshot(row: SnapshotRow): number | null {
  const r5 = toFiniteNumber(row.return_5y_pct)
  if (r5 != null) {
    const growth = 1 + r5 / 100
    if (growth > 0) return (Math.pow(growth, 1 / 5) - 1) * 100
  }

  const r3 = toFiniteNumber(row.return_3y_pct)
  if (r3 != null) {
    const growth = 1 + r3 / 100
    if (growth > 0) return (Math.pow(growth, 1 / 3) - 1) * 100
  }

  const r1 = toFiniteNumber(row.return_1y_pct)
  if (r1 != null && r1 > -100) return r1

  return null
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
  const horizonYears = horizonRaw == null ? 5 : Math.trunc(horizonRaw)
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

  return {
    data: {
      amount,
      horizon_years: horizonYears,
      persona,
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

  const etfResp = await supabase.from('etfs').select('symbol').in('symbol', symbols)
  if (etfResp.error) {
    return NextResponse.json({ error: etfResp.error.message }, { status: 500 })
  }
  const found = new Set((etfResp.data || []).map((row) => row.symbol))
  const missingSymbols = symbols.filter((symbol) => !found.has(symbol))
  if (missingSymbols.length > 0) {
    return NextResponse.json(
      { error: `Unknown ETF symbol(s): ${missingSymbols.join(', ')}` },
      { status: 400 },
    )
  }

  const snapshotResp = await supabase
    .from('etf_snapshots')
    .select('symbol,latest_close,return_1y_pct,return_3y_pct,return_5y_pct')
    .in('symbol', symbols)

  if (snapshotResp.error) {
    return NextResponse.json({ error: snapshotResp.error.message }, { status: 500 })
  }

  const snapshots = (snapshotResp.data || []) as SnapshotRow[]
  const snapshotMap = new Map<string, SnapshotRow>()
  for (const row of snapshots) snapshotMap.set(row.symbol, row)

  let weightedAnnualReturnSum = 0
  let returnCoverageWeight = 0

  for (const allocation of input.allocations) {
    const snapshot = snapshotMap.get(allocation.symbol)
    if (!snapshot) continue
    const annualReturnPct = annualizeReturnFromSnapshot(snapshot)
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

  const weightedBaselineAnnualReturnPct =
    returnCoverageWeight > 0 ? weightedAnnualReturnSum / (returnCoverageWeight / 100) : null

  if (weightedBaselineAnnualReturnPct == null) {
    return NextResponse.json({ error: 'Insufficient snapshot return data' }, { status: 422 })
  }

  const horizonYears = input.horizon_years || 5
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
        dividend_coverage_pct: dividendCoveragePct,
        bull_alpha_pct: 2.0,
        bear_alpha_pct: -3.0,
        ttm_window_days: 365,
      },
      warnings,
    },
  })
}

