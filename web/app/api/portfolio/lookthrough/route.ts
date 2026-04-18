import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

type AllocationInput = {
  symbol: string
  weight_pct: number
}

type LookthroughRequest = {
  allocations: AllocationInput[]
  top_n?: number
}

type HoldingRow = {
  symbol: string
  as_of_date: string | null
  holding_symbol: string | null
  holding_name: string | null
  weight_pct: number | null
}

type ExposureBucket = {
  holding_symbol: string | null
  holding_name: string | null
  portfolio_exposure_pct: number
  contributing_etfs: Array<{
    symbol: string
    contribution_pct: number
  }>
}

const WEIGHT_SUM_TOLERANCE = 0.01
const DEFAULT_TOP_N = 10
const MAX_TOP_N = 50

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function roundPct(value: number) {
  return Number(value.toFixed(4))
}

function normalizeHoldingKey(holdingSymbol: string | null, holdingName: string | null) {
  if (holdingSymbol && holdingSymbol.trim()) return `symbol:${holdingSymbol.trim().toUpperCase()}`
  if (holdingName && holdingName.trim()) return `name:${holdingName.trim().toUpperCase()}`
  return null
}

function validateAndNormalizeInput(payload: unknown): { data: LookthroughRequest } | { error: string } {
  if (!payload || typeof payload !== 'object') {
    return { error: 'Invalid JSON body' }
  }

  const body = payload as Record<string, unknown>
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

  const topNRaw = toFiniteNumber(body.top_n)
  const topN = topNRaw == null ? DEFAULT_TOP_N : Math.trunc(topNRaw)
  if (topN < 1 || topN > MAX_TOP_N) {
    return { error: `top_n must be between 1 and ${MAX_TOP_N}` }
  }

  return {
    data: {
      allocations: deduped,
      top_n: topN,
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

  const holdingsResp = await supabase
    .from('etf_holdings')
    .select('symbol,as_of_date,holding_symbol,holding_name,weight_pct')
    .in('symbol', symbols)
    .order('as_of_date', { ascending: false })
    .order('rank', { ascending: true })
    .limit(5000)

  if (holdingsResp.error) {
    return NextResponse.json({ error: holdingsResp.error.message }, { status: 500 })
  }

  const holdings = (holdingsResp.data || []) as HoldingRow[]
  if (holdings.length === 0) {
    return NextResponse.json({ error: 'No holdings data for selected ETFs' }, { status: 422 })
  }

  const latestAsOfBySymbol = new Map<string, string>()
  for (const row of holdings) {
    if (!row.as_of_date) continue
    const existing = latestAsOfBySymbol.get(row.symbol)
    if (!existing || row.as_of_date > existing) {
      latestAsOfBySymbol.set(row.symbol, row.as_of_date)
    }
  }

  const rowsBySymbol = new Map<string, HoldingRow[]>()
  for (const row of holdings) {
    const latestAsOf = latestAsOfBySymbol.get(row.symbol)
    if (!latestAsOf || row.as_of_date !== latestAsOf) continue
    if (!rowsBySymbol.has(row.symbol)) rowsBySymbol.set(row.symbol, [])
    rowsBySymbol.get(row.symbol)!.push(row)
  }

  const missingHoldingsSymbols: string[] = []
  const exposureMap = new Map<string, ExposureBucket>()
  let coverageWeight = 0

  for (const allocation of input.allocations) {
    const rows = rowsBySymbol.get(allocation.symbol) || []
    const validRows = rows.filter((row) => {
      const weight = toFiniteNumber(row.weight_pct)
      return weight != null && weight > 0 && (row.holding_symbol || row.holding_name)
    })

    if (validRows.length === 0) {
      missingHoldingsSymbols.push(allocation.symbol)
      continue
    }

    coverageWeight += allocation.weight_pct

    for (const row of validRows) {
      const holdingWeightPct = toFiniteNumber(row.weight_pct)
      if (holdingWeightPct == null || holdingWeightPct <= 0) continue

      const portfolioContributionPct = (allocation.weight_pct * holdingWeightPct) / 100
      const key = normalizeHoldingKey(row.holding_symbol, row.holding_name)
      if (!key) continue

      const existing = exposureMap.get(key)
      if (!existing) {
        exposureMap.set(key, {
          holding_symbol: row.holding_symbol,
          holding_name: row.holding_name,
          portfolio_exposure_pct: portfolioContributionPct,
          contributing_etfs: [
            {
              symbol: allocation.symbol,
              contribution_pct: portfolioContributionPct,
            },
          ],
        })
      } else {
        existing.portfolio_exposure_pct += portfolioContributionPct
        existing.contributing_etfs.push({
          symbol: allocation.symbol,
          contribution_pct: portfolioContributionPct,
        })
      }
    }
  }

  const coveragePct = roundPct(coverageWeight)
  if (coverageWeight === 0 || exposureMap.size === 0) {
    return NextResponse.json({ error: 'No holdings coverage for selected ETFs' }, { status: 422 })
  }
  if (coveragePct < 100) {
    warnings.push(`holdings_coverage_partial:${coveragePct.toFixed(2)}%`)
  }
  if (missingHoldingsSymbols.length > 0) {
    warnings.push(`missing_holdings_symbols:${missingHoldingsSymbols.join(',')}`)
  }

  const exposures = Array.from(exposureMap.values())
    .map((bucket) => ({
      ...bucket,
      portfolio_exposure_pct: roundPct(bucket.portfolio_exposure_pct),
      contributing_etfs: bucket.contributing_etfs
        .sort((a, b) => b.contribution_pct - a.contribution_pct)
        .map((x) => ({
          symbol: x.symbol,
          contribution_pct: roundPct(x.contribution_pct),
        })),
    }))
    .sort((a, b) => b.portfolio_exposure_pct - a.portfolio_exposure_pct)

  const topN = input.top_n || DEFAULT_TOP_N
  const topStockExposures = exposures.slice(0, topN)
  const top1Pct = topStockExposures.length > 0 ? topStockExposures[0].portfolio_exposure_pct : 0
  const top5Pct = roundPct(topStockExposures.slice(0, 5).reduce((sum, row) => sum + row.portfolio_exposure_pct, 0))
  const hhi = roundPct(
    exposures.reduce((sum, row) => {
      const fraction = row.portfolio_exposure_pct / 100
      return sum + fraction * fraction
    }, 0),
  )

  const alerts: string[] = []
  if (top1Pct > 8) alerts.push('single_stock_over_8pct')
  else if (top1Pct > 5) alerts.push('single_stock_over_5pct')
  if (top5Pct > 25) alerts.push('top5_over_25pct')

  return NextResponse.json({
    data: {
      top_stock_exposures: topStockExposures,
      risk_summary: {
        top1_pct: top1Pct,
        top5_pct: top5Pct,
        hhi,
        alerts,
      },
      assumptions: {
        holdings_coverage_pct: coveragePct,
        top_n: topN,
      },
      warnings,
    },
  })
}

