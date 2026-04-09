'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type RangeKey = '1M' | '3M' | '1Y' | '5Y'

type EtfDetail = {
  symbol: string
  name: string | null
  issuer: string | null
  category: string | null
  expense_ratio: number | null
  inception_date: string | null
  snapshot: {
    latest_close: number | null
    change: number | null
    change_pct: number | null
    updated_at: string | null
  } | null
  dividends: Array<{
    ex_date: string
    pay_date: string | null
    amount: number | null
  }>
  kpis: {
    ttm_dividend_amount: number | null
    ttm_dividend_count: number
    ttm_dividend_yield_pct: number | null
    period_returns_pct: {
      '1Y': number | null
      '3Y': number | null
      '5Y': number | null
    }
  }
}

type ChartPoint = {
  date: string
  close: number
}

const RANGE_OPTIONS: RangeKey[] = ['1M', '3M', '1Y', '5Y']

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const pctFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(isoDate?: string | null) {
  if (!isoDate) return 'N/A'
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return 'N/A'
  return dateFmt.format(date)
}

function formatCurrency(value?: number | null) {
  if (value == null) return 'N/A'
  return currencyFmt.format(value)
}

function formatPct(value?: number | null) {
  if (value == null) return 'N/A'
  return `${value > 0 ? '+' : ''}${pctFmt.format(value)}%`
}

export default function EtfDetailClient({ symbol }: { symbol: string }) {
  const [range, setRange] = useState<RangeKey>('1Y')
  const [detail, setDetail] = useState<EtfDetail | null>(null)
  const [chart, setChart] = useState<ChartPoint[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchDetail() {
      setLoadingDetail(true)
      setError(null)

      try {
        const res = await fetch(`/api/etfs/${symbol}`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'Failed to fetch ETF detail')
        }

        setDetail(json.data ?? null)
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoadingDetail(false)
      }
    }

    fetchDetail()
    return () => controller.abort()
  }, [symbol, refreshToken])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchChart() {
      setLoadingChart(true)

      try {
        const res = await fetch(`/api/etfs/${symbol}/chart?range=${range}`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || 'Failed to fetch chart data')
        }

        setChart(Array.isArray(json.data) ? json.data : [])
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoadingChart(false)
      }
    }

    fetchChart()
    return () => controller.abort()
  }, [range, symbol, refreshToken])

  const chartTitle = useMemo(() => `${symbol} Price Trend`, [symbol])
  const snapshot = detail?.snapshot
  const kpis = detail?.kpis

  return (
    <section className="space-y-6">
      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setRefreshToken((v) => v + 1)}
            className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-slate-500">ETF DETAIL</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">{loadingDetail ? 'Loading...' : detail?.symbol || symbol}</h1>
            <p className="mt-1 text-sm text-slate-600">{detail?.name || 'Name N/A'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
            <p className="text-xs text-slate-500">Latest Close</p>
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(snapshot?.latest_close)}</p>
            <p className={`text-sm ${snapshot?.change_pct != null && snapshot.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(snapshot?.change)} ({formatPct(snapshot?.change_pct)})
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Day Change</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(snapshot?.change_pct)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Expense Ratio</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {detail?.expense_ratio != null ? `${detail.expense_ratio}%` : 'N/A'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">TTM Dividend</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(kpis?.ttm_dividend_amount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">TTM Yield</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.ttm_dividend_yield_pct)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">1Y Return</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.period_returns_pct?.['1Y'])}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">3Y Return</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.period_returns_pct?.['3Y'])}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">5Y Return</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.period_returns_pct?.['5Y'])}</p>
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{chartTitle}</h2>
          <div className="-mx-1 flex w-full gap-2 overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  range === option
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-500 hover:text-slate-900'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="h-60 w-full sm:h-72">
          {loadingChart ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading chart...</div>
          ) : chart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">No chart data in this range.</div>
          ) : (
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.slice(5)}
                  minTickGap={28}
                />
                <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']} tickFormatter={(value) => `${value}`} />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Close']}
                  labelFormatter={(value) => formatDate(String(value))}
                />
                <Line type="monotone" dataKey="close" stroke="#0f172a" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </article>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Dividends</h2>
          <p className="mt-1 text-sm text-slate-500">Recent distribution records.</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">TTM Total Dividend</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(kpis?.ttm_dividend_amount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">TTM Payout Count</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{kpis?.ttm_dividend_count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">TTM Yield (vs latest close)</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.ttm_dividend_yield_pct)}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-medium">Ex Date</th>
                  <th className="px-2 py-2 font-medium">Pay Date</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(detail?.dividends || []).map((row) => (
                  <tr key={`${row.ex_date}-${row.pay_date || 'na'}`} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-800">{formatDate(row.ex_date)}</td>
                    <td className="px-2 py-2 text-slate-600">{formatDate(row.pay_date)}</td>
                    <td className="px-2 py-2 font-medium text-slate-900">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loadingDetail && (detail?.dividends || []).length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No dividend data available.</p>
          ) : null}
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Basic Info</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Issuer</dt>
              <dd className="font-medium text-slate-900">{detail?.issuer || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Category</dt>
              <dd className="font-medium text-slate-900">{detail?.category || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Expense Ratio</dt>
              <dd className="font-medium text-slate-900">
                {detail?.expense_ratio != null ? `${detail.expense_ratio}%` : 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Inception Date</dt>
              <dd className="font-medium text-slate-900">{formatDate(detail?.inception_date)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Snapshot Updated</dt>
              <dd className="font-medium text-slate-900">{formatDate(snapshot?.updated_at)}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  )
}
