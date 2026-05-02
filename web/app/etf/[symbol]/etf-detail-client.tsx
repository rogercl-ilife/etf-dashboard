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
import { useLanguage } from '@/app/components/language-context'
import { localizeCategory } from '@/app/lib/category-labels'

type RangeKey = '1M' | '3M' | '1Y' | '3Y' | '5Y' | '10Y'

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
  holdings: Array<{
    holding_symbol: string | null
    holding_name: string | null
    weight_pct: number | null
    as_of_date: string | null
  }>
  kpis: {
    ttm_dividend_amount: number | null
    ttm_dividend_count: number
    ttm_dividend_yield_pct: number | null
    period_returns_pct: {
      '1Y': number | null
      '3Y': number | null
      '5Y': number | null
      '10Y': number | null
    }
  }
}

type ChartPoint = {
  date: string
  close: number
}

const RANGE_OPTIONS: RangeKey[] = ['1M', '3M', '1Y', '3Y', '5Y', '10Y']

const LOCALE_MAP = {
  en: 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
} as const

const TEXT = {
  en: {
    failedDetail: 'Failed to fetch ETF detail',
    failedChart: 'Failed to fetch chart data',
    unknownError: 'Unknown error',
    retry: 'Retry',
    lastUpdated: 'Last updated',
    detail: 'ETF DETAIL',
    loading: 'Loading...',
    latestClose: 'Latest Close',
    dayChange: 'Day Change',
    expenseRatio: 'Expense Ratio',
    ttmDividend: 'TTM Dividend',
    ttmYield: 'TTM Yield',
    return1y: '1Y Return',
    return3y: '3Y Return',
    return5y: '5Y Return',
    return10y: '10Y Return',
    chartTitle: (symbol: string) => `${symbol} Price Trend`,
    loadingChart: 'Loading chart...',
    noChartData: 'No chart data in this range.',
    close: 'Close',
    dividends: 'Dividends',
    recentRecords: 'Recent distribution records.',
    ttmTotalDividend: 'TTM Total Dividend',
    ttmPayoutCount: 'TTM Payout Count',
    ttmYieldVsClose: 'TTM Yield (vs latest close)',
    exDate: 'Ex Date',
    amount: 'Amount',
    symbol: 'Symbol',
    name: 'Name',
    noDividendData: 'No dividend data available.',
    holdings: 'Holdings',
    weight: 'Weight',
    asOfDate: 'As Of Date',
    noHoldingsData: 'No holdings data available.',
    basicInfo: 'Basic Info',
    issuer: 'Issuer',
    category: 'Category',
    inceptionDate: 'Inception Date',
    snapshotUpdated: 'Snapshot Updated',
    noData: 'N/A',
  },
  'zh-TW': {
    failedDetail: 'ETF 詳情讀取失敗',
    failedChart: '走勢圖資料讀取失敗',
    unknownError: '未知錯誤',
    retry: '重試',
    lastUpdated: '最後更新',
    detail: 'ETF 詳情',
    loading: '載入中...',
    latestClose: '最新收盤價',
    dayChange: '單日漲跌',
    expenseRatio: '費用率',
    ttmDividend: '近 12 個月股息',
    ttmYield: '近 12 個月殖利率',
    return1y: '1 年報酬',
    return3y: '3 年報酬',
    return5y: '5 年報酬',
    return10y: '10 年報酬',
    chartTitle: (symbol: string) => `${symbol} 價格走勢`,
    loadingChart: '載入圖表中...',
    noChartData: '此區間沒有圖表資料。',
    close: '收盤價',
    dividends: '股息',
    recentRecords: '近期配息紀錄。',
    ttmTotalDividend: '近 12 個月總股息',
    ttmPayoutCount: '近 12 個月配息次數',
    ttmYieldVsClose: '近 12 個月殖利率（相對最新收盤）',
    exDate: '除息日',
    amount: '金額',
    symbol: '代號',
    name: '名稱',
    noDividendData: '目前沒有股息資料。',
    holdings: '成份股',
    weight: '比例',
    asOfDate: '資料日期',
    noHoldingsData: '目前沒有成份股資料。',
    basicInfo: '基本資訊',
    issuer: '發行商',
    category: '分類',
    inceptionDate: '成立日期',
    snapshotUpdated: '快照更新時間',
    noData: '無資料',
  },
  'zh-CN': {
    failedDetail: 'ETF 详情读取失败',
    failedChart: '走势图数据读取失败',
    unknownError: '未知错误',
    retry: '重试',
    lastUpdated: '最后更新',
    detail: 'ETF 详情',
    loading: '加载中...',
    latestClose: '最新收盘价',
    dayChange: '单日涨跌',
    expenseRatio: '费率',
    ttmDividend: '近 12 个月分红',
    ttmYield: '近 12 个月收益率',
    return1y: '1 年回报',
    return3y: '3 年回报',
    return5y: '5 年回报',
    return10y: '10 年回报',
    chartTitle: (symbol: string) => `${symbol} 价格走势`,
    loadingChart: '图表加载中...',
    noChartData: '该区间没有图表数据。',
    close: '收盘价',
    dividends: '分红',
    recentRecords: '近期分配记录。',
    ttmTotalDividend: '近 12 个月分红总额',
    ttmPayoutCount: '近 12 个月分配次数',
    ttmYieldVsClose: '近 12 个月收益率（相对最新收盘）',
    exDate: '除息日',
    amount: '金额',
    symbol: '代码',
    name: '名称',
    noDividendData: '暂无分红数据。',
    holdings: '成份股',
    weight: '比例',
    asOfDate: '数据日期',
    noHoldingsData: '暂无成份股数据。',
    basicInfo: '基础信息',
    issuer: '发行商',
    category: '分类',
    inceptionDate: '成立日期',
    snapshotUpdated: '快照更新时间',
    noData: '暂无数据',
  },
}

export default function EtfDetailClient({ symbol }: { symbol: string }) {
  const { language } = useLanguage()
  const t = TEXT[language]

  const currencyFmt = useMemo(
    () =>
      new Intl.NumberFormat(LOCALE_MAP[language], {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
      }),
    [language],
  )

  const pctFmt = useMemo(
    () =>
      new Intl.NumberFormat(LOCALE_MAP[language], {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [language],
  )

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(LOCALE_MAP[language], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    [language],
  )

  const formatDate = (isoDate?: string | null) => {
    if (!isoDate) return t.noData
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return t.noData
    return dateFmt.format(date)
  }

  const formatDateTime = (isoDate?: string | null) => {
    if (!isoDate) return t.noData
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return t.noData
    return new Intl.DateTimeFormat(LOCALE_MAP[language], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const formatCurrency = (value?: number | null) => {
    if (value == null) return t.noData
    return currencyFmt.format(value)
  }

  const formatPct = (value?: number | null) => {
    if (value == null) return t.noData
    return `${value > 0 ? '+' : ''}${pctFmt.format(value)}%`
  }

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
          throw new Error(json.error || t.failedDetail)
        }

        setDetail(json.data ?? null)
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : t.unknownError)
      } finally {
        setLoadingDetail(false)
      }
    }

    fetchDetail()
    return () => controller.abort()
  }, [symbol, refreshToken, t.failedDetail, t.unknownError])

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
          throw new Error(json.error || t.failedChart)
        }

        setChart(Array.isArray(json.data) ? json.data : [])
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : t.unknownError)
      } finally {
        setLoadingChart(false)
      }
    }

    fetchChart()
    return () => controller.abort()
  }, [range, symbol, refreshToken, t.failedChart, t.unknownError])

  const chartTitle = useMemo(() => t.chartTitle(symbol), [symbol, t])
  const snapshot = detail?.snapshot
  const kpis = detail?.kpis
  const holdings = detail?.holdings || []

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
            {t.retry}
          </button>
        </div>
      ) : null}

      <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.15em] text-slate-500">{t.detail}</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">{loadingDetail ? t.loading : detail?.symbol || symbol}</h1>
            <p className="mt-1 text-sm text-slate-600">{detail?.name || t.noData}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
            <p className="text-xs text-slate-500">{t.latestClose}</p>
            <p className="text-2xl font-semibold text-slate-900">{formatCurrency(snapshot?.latest_close)}</p>
            <p className={`text-sm ${snapshot?.change_pct != null && snapshot.change_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(snapshot?.change)} ({formatPct(snapshot?.change_pct)})
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {t.lastUpdated}: {formatDateTime(snapshot?.updated_at)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.dayChange}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(snapshot?.change_pct)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.expenseRatio}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {detail?.expense_ratio != null ? `${detail.expense_ratio}%` : t.noData}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.ttmDividend}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(kpis?.ttm_dividend_amount)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.ttmYield}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.ttm_dividend_yield_pct)}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.return1y}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.period_returns_pct?.['1Y'])}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.return3y}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.period_returns_pct?.['3Y'])}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.return5y}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.period_returns_pct?.['5Y'])}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{t.return10y}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.period_returns_pct?.['10Y'])}</p>
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
            <div className="flex h-full items-center justify-center text-sm text-slate-500">{t.loadingChart}</div>
          ) : chart.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">{t.noChartData}</div>
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
                  formatter={(value) => [formatCurrency(Number(value)), t.close]}
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
          <h2 className="text-lg font-semibold text-slate-900">{t.dividends}</h2>
          <p className="mt-1 text-sm text-slate-500">{t.recentRecords}</p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t.ttmTotalDividend}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(kpis?.ttm_dividend_amount)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t.ttmPayoutCount}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{kpis?.ttm_dividend_count ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{t.ttmYieldVsClose}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatPct(kpis?.ttm_dividend_yield_pct)}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-medium">{t.exDate}</th>
                  <th className="px-2 py-2 font-medium">{t.amount}</th>
                </tr>
              </thead>
              <tbody>
                {(detail?.dividends || []).map((row) => (
                  <tr key={`${row.ex_date}-${row.amount || 'na'}`} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-800">{formatDate(row.ex_date)}</td>
                    <td className="px-2 py-2 font-medium text-slate-900">{formatCurrency(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loadingDetail && (detail?.dividends || []).length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">{t.noDividendData}</p>
          ) : null}

          <div className="mt-8">
            <h3 className="text-base font-semibold text-slate-900">{t.holdings}</h3>
            {holdings.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{t.noHoldingsData}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-2 py-2 font-medium">{t.symbol}</th>
                      <th className="px-2 py-2 font-medium">{t.name}</th>
                      <th className="px-2 py-2 font-medium">{t.weight}</th>
                      <th className="px-2 py-2 font-medium">{t.asOfDate}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holdings.map((row, idx) => (
                      <tr key={`${row.holding_symbol || row.holding_name || 'holding'}-${idx}`} className="border-b border-slate-100">
                        <td className="px-2 py-2 font-medium text-slate-900">{row.holding_symbol || t.noData}</td>
                        <td className="px-2 py-2 text-slate-700">{row.holding_name || t.noData}</td>
                        <td className="px-2 py-2 text-slate-700">
                          {row.weight_pct != null ? `${pctFmt.format(row.weight_pct)}%` : t.noData}
                        </td>
                        <td className="px-2 py-2 text-slate-700">{formatDate(row.as_of_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t.basicInfo}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">{t.issuer}</dt>
              <dd className="font-medium text-slate-900">{detail?.issuer || t.noData}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.category}</dt>
              <dd className="font-medium text-slate-900">
                {localizeCategory(detail?.category, language) || t.noData}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.expenseRatio}</dt>
              <dd className="font-medium text-slate-900">
                {detail?.expense_ratio != null ? `${detail.expense_ratio}%` : t.noData}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.inceptionDate}</dt>
              <dd className="font-medium text-slate-900">{formatDate(detail?.inception_date)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t.snapshotUpdated}</dt>
              <dd className="font-medium text-slate-900">{formatDateTime(snapshot?.updated_at)}</dd>
            </div>
          </dl>
        </article>
      </div>
    </section>
  )
}
