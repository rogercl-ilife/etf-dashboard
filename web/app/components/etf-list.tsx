'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/app/components/language-context'
import { localizeCategory } from '@/app/lib/category-labels'

type EtfRow = {
  symbol: string
  name: string | null
  issuer: string | null
  category: string | null
  expense_ratio: number | null
  inception_date: string | null
  period_returns_pct?: {
    '1Y': number | null
    '3Y': number | null
    '5Y': number | null
  }
}

type ViewMode = 'cards' | 'table'
type SortDirection = 'asc' | 'desc'
type SortField = 'symbol' | 'name' | 'issuer' | 'category' | 'expense_ratio' | 'return_1y' | 'return_3y' | 'return_5y'
type SortPreset =
  | 'symbol_asc'
  | 'symbol_desc'
  | 'name_asc'
  | 'expense_ratio_asc'
  | 'expense_ratio_desc'
  | 'return_1y_desc'
  | 'return_3y_desc'
  | 'return_5y_desc'
  | 'custom'

const LOCALE_MAP = {
  en: 'en-US',
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
} as const

const TEXT = {
  en: {
    searchEtf: 'Search ETF',
    searchPlaceholder: 'Try VOO, SPY, QQQ...',
    sortBy: 'Sort',
    customSort: 'Custom (table header)',
    direction: 'Direction',
    asc: 'Asc',
    desc: 'Desc',
    issuerAll: 'Issuer: All',
    categoryAll: 'Category: All',
    cards: 'Cards',
    table: 'Table',
    loading: 'Loading...',
    loadFailed: 'Load failed',
    showing: (current: number, total: number) => `Showing ${current} of ${total} ETFs`,
    retry: 'Retry',
    lastUpdated: 'Last updated',
    symbol: 'Symbol',
    name: 'Name',
    issuer: 'Issuer',
    category: 'Category',
    er: 'ER',
    y1: '1Y',
    y3: '3Y',
    y5: '5Y',
    noData: 'N/A',
    noMatch: 'No ETF matched your keyword/filters.',
    failedFetch: 'Failed to fetch ETF list',
    unknownError: 'Unknown error',
  },
  'zh-TW': {
    searchEtf: '搜尋 ETF',
    searchPlaceholder: '例如 VOO、SPY、QQQ...',
    sortBy: '排序',
    customSort: '自訂（表頭排序）',
    direction: '方向',
    asc: '升冪',
    desc: '降冪',
    issuerAll: '發行商：全部',
    categoryAll: '分類：全部',
    cards: '卡片',
    table: '表格',
    loading: '載入中...',
    loadFailed: '載入失敗',
    showing: (current: number, total: number) => `顯示 ${current} / ${total} 檔 ETF`,
    retry: '重試',
    lastUpdated: '最後更新',
    symbol: '代號',
    name: '名稱',
    issuer: '發行商',
    category: '分類',
    er: '費用率',
    y1: '1 年',
    y3: '3 年',
    y5: '5 年',
    noData: '無資料',
    noMatch: '找不到符合關鍵字或篩選條件的 ETF。',
    failedFetch: 'ETF 清單讀取失敗',
    unknownError: '未知錯誤',
  },
  'zh-CN': {
    searchEtf: '搜索 ETF',
    searchPlaceholder: '例如 VOO、SPY、QQQ...',
    sortBy: '排序',
    customSort: '自定义（表头排序）',
    direction: '方向',
    asc: '升序',
    desc: '降序',
    issuerAll: '发行商：全部',
    categoryAll: '分类：全部',
    cards: '卡片',
    table: '表格',
    loading: '加载中...',
    loadFailed: '加载失败',
    showing: (current: number, total: number) => `显示 ${current} / ${total} 只 ETF`,
    retry: '重试',
    lastUpdated: '最后更新',
    symbol: '代码',
    name: '名称',
    issuer: '发行商',
    category: '分类',
    er: '费率',
    y1: '1 年',
    y3: '3 年',
    y5: '5 年',
    noData: '暂无数据',
    noMatch: '没有符合关键字或筛选条件的 ETF。',
    failedFetch: 'ETF 列表读取失败',
    unknownError: '未知错误',
  },
}

function compareNullableText(a: string | null, b: string | null, direction: SortDirection) {
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a)
}

function compareNullableNumber(a: number | null, b: number | null, direction: SortDirection) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return direction === 'asc' ? a - b : b - a
}

function parseSortPreset(preset: SortPreset): { field: SortField; direction: SortDirection } | null {
  if (preset === 'custom') return null
  const splitIndex = preset.lastIndexOf('_')
  const field = preset.slice(0, splitIndex)
  const direction = preset.slice(splitIndex + 1)
  if (
    (direction === 'asc' || direction === 'desc') &&
    (field === 'symbol' ||
      field === 'name' ||
      field === 'issuer' ||
      field === 'category' ||
      field === 'expense_ratio' ||
      field === 'return_1y' ||
      field === 'return_3y' ||
      field === 'return_5y')
  ) {
    return { field, direction }
  }
  return null
}

function toSortPreset(field: SortField, direction: SortDirection): SortPreset {
  const key = `${field}_${direction}` as SortPreset
  const presets: SortPreset[] = [
    'symbol_asc',
    'symbol_desc',
    'name_asc',
    'expense_ratio_asc',
    'expense_ratio_desc',
    'return_1y_desc',
    'return_3y_desc',
    'return_5y_desc',
  ]
  return presets.includes(key) ? key : 'custom'
}

export default function EtfList() {
  const { language } = useLanguage()
  const t = TEXT[language]

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [items, setItems] = useState<EtfRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [sortField, setSortField] = useState<SortField>('symbol')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [sortPreset, setSortPreset] = useState<SortPreset>('symbol_asc')
  const [issuerFilter, setIssuerFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const pctFmt = useMemo(
    () =>
      new Intl.NumberFormat(LOCALE_MAP[language], {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [language],
  )

  const sortPresetOptions: Array<{ value: SortPreset; label: string }> = useMemo(
    () => [
      { value: 'symbol_asc', label: `${t.symbol} (${t.asc})` },
      { value: 'symbol_desc', label: `${t.symbol} (${t.desc})` },
      { value: 'name_asc', label: `${t.name} (${t.asc})` },
      { value: 'expense_ratio_asc', label: `${t.er} (${t.asc})` },
      { value: 'expense_ratio_desc', label: `${t.er} (${t.desc})` },
      { value: 'return_1y_desc', label: `${t.y1} (${t.desc})` },
      { value: 'return_3y_desc', label: `${t.y3} (${t.desc})` },
      { value: 'return_5y_desc', label: `${t.y5} (${t.desc})` },
      { value: 'custom', label: t.customSort },
    ],
    [t],
  )

  const formatPct = (value?: number | null) => {
    if (value == null) return t.noData
    return `${value > 0 ? '+' : ''}${pctFmt.format(value)}%`
  }

  const formatDateTime = (value?: string | null) => {
    if (!value) return t.noData
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return t.noData
    return new Intl.DateTimeFormat(LOCALE_MAP[language], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const pctColor = (value?: number | null) => {
    if (value == null) return 'text-[#6a7f97]'
    if (value > 0) return 'text-[#0f7a5c]'
    if (value < 0) return 'text-[#b5475a]'
    return 'text-[#2f4664]'
  }

  const getNumberByField = (row: EtfRow, field: SortField) => {
    if (field === 'expense_ratio') return row.expense_ratio
    if (field === 'return_1y') return row.period_returns_pct?.['1Y'] ?? null
    if (field === 'return_3y') return row.period_returns_pct?.['3Y'] ?? null
    if (field === 'return_5y') return row.period_returns_pct?.['5Y'] ?? null
    return null
  }

  const isNumberField = (field: SortField) => field === 'expense_ratio' || field === 'return_1y' || field === 'return_3y' || field === 'return_5y'

  const handleColumnSort = (field: SortField) => {
    if (sortField !== field) {
      setSortField(field)
      setSortDirection('asc')
      setSortPreset(toSortPreset(field, 'asc'))
      return
    }
    setSortDirection((prev) => {
      const next = prev === 'asc' ? 'desc' : 'asc'
      setSortPreset(toSortPreset(field, next))
      return next
    })
  }

  const handleSortPresetChange = (preset: SortPreset) => {
    setSortPreset(preset)
    const parsed = parseSortPreset(preset)
    if (!parsed) return
    setSortField(parsed.field)
    setSortDirection(parsed.direction)
  }

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 250)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchEtfs() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('limit', '100')
        if (debouncedQuery) {
          params.set('q', debouncedQuery)
        }

        const res = await fetch(`/api/etfs?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        })

        const json = await res.json()
        if (!res.ok) {
          throw new Error(json.error || t.failedFetch)
        }

        setItems(Array.isArray(json.data) ? json.data : [])
        setLastUpdatedAt(typeof json?.meta?.last_updated_at === 'string' ? json.meta.last_updated_at : null)
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return
        }
        setError(e instanceof Error ? e.message : t.unknownError)
      } finally {
        setLoading(false)
      }
    }

    fetchEtfs()
    return () => controller.abort()
  }, [debouncedQuery, refreshToken, t.failedFetch, t.unknownError])

  const issuerOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((x) => x.issuer).filter(Boolean) as string[]))
    return values.sort((a, b) => a.localeCompare(b))
  }, [items])

  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((x) => x.category).filter(Boolean) as string[]))
    return values.sort((a, b) =>
      (localizeCategory(a, language) || a).localeCompare(localizeCategory(b, language) || b),
    )
  }, [items, language])

  const filteredAndSorted = useMemo(() => {
    const filtered = items.filter((row) => {
      const issuerOk = issuerFilter === 'all' ? true : row.issuer === issuerFilter
      const categoryOk = categoryFilter === 'all' ? true : row.category === categoryFilter
      return issuerOk && categoryOk
    })

    return [...filtered].sort((a, b) => {
      if (isNumberField(sortField)) {
        return compareNullableNumber(getNumberByField(a, sortField), getNumberByField(b, sortField), sortDirection)
      }

      if (sortField === 'symbol') return compareNullableText(a.symbol, b.symbol, sortDirection)
      if (sortField === 'name') return compareNullableText(a.name || a.symbol, b.name || b.symbol, sortDirection)
      if (sortField === 'issuer') return compareNullableText(a.issuer, b.issuer, sortDirection)
      return compareNullableText(
        localizeCategory(a.category, language),
        localizeCategory(b.category, language),
        sortDirection,
      )
    })
  }, [items, issuerFilter, categoryFilter, sortField, sortDirection, language])

  const statsText = useMemo(() => {
    if (loading) return t.loading
    if (error) return t.loadFailed
    return t.showing(filteredAndSorted.length, items.length)
  }, [loading, error, filteredAndSorted.length, items.length, t])

  const columnHeaders: Array<{ key: SortField; label: string }> = [
    { key: 'symbol', label: t.symbol },
    { key: 'name', label: t.name },
    { key: 'issuer', label: t.issuer },
    { key: 'category', label: t.category },
    { key: 'expense_ratio', label: t.er },
    { key: 'return_1y', label: t.y1 },
    { key: 'return_3y', label: t.y3 },
    { key: 'return_5y', label: t.y5 },
  ]

  return (
    <section className="space-y-6">
      <div className="sticky top-2 z-10 rounded-2xl border border-[#d6e0ea] bg-[#f9fbfe]/95 p-4 shadow-[0_6px_18px_rgba(15,39,71,0.08)] backdrop-blur-sm sm:p-5">
        <label htmlFor="search" className="mb-2 block text-sm font-medium text-[#29415f]">
          {t.searchEtf}
        </label>
        <input
          id="search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="h-11 w-full rounded-xl border border-[#c7d4e4] bg-white px-4 text-[#1b304c] outline-none ring-0 transition focus:border-[#5a7598]"
        />

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <select
            value={sortPreset}
            onChange={(e) => handleSortPresetChange(e.target.value as SortPreset)}
            className="h-11 rounded-xl border border-[#c7d4e4] bg-white px-3 text-sm text-[#2a3f5f]"
          >
            {sortPresetOptions.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {t.sortBy}: {preset.label}
              </option>
            ))}
          </select>

          <select
            value={issuerFilter}
            onChange={(e) => setIssuerFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#c7d4e4] bg-white px-3 text-sm text-[#2a3f5f]"
          >
            <option value="all">{t.issuerAll}</option>
            {issuerOptions.map((issuer) => (
              <option key={issuer} value={issuer}>
                {issuer}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-11 rounded-xl border border-[#c7d4e4] bg-white px-3 text-sm text-[#2a3f5f]"
          >
            <option value="all">{t.categoryAll}</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {localizeCategory(category, language)}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`h-11 flex-1 rounded-xl border px-3 text-sm font-semibold transition ${
              viewMode === 'cards' ? 'border-[#0f2747] bg-[#0f2747] text-white' : 'border-[#c7d4e4] bg-white text-[#2a3f5f]'
            }`}
          >
            {t.cards}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`h-11 flex-1 rounded-xl border px-3 text-sm font-semibold transition ${
              viewMode === 'table' ? 'border-[#0f2747] bg-[#0f2747] text-white' : 'border-[#c7d4e4] bg-white text-[#2a3f5f]'
            }`}
          >
            {t.table}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#435a79]">{statsText}</p>
          <p className="text-xs text-[#6a7f97]">
            {t.lastUpdated}: {formatDateTime(lastUpdatedAt)}
          </p>
        </div>
      </div>

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

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading && items.length === 0
            ? Array.from({ length: 6 }).map((_, idx) => (
                <article key={`skeleton-${idx}`} className="animate-pulse rounded-2xl border border-[#d6e0ea] bg-[#fbfdff] p-3 shadow-[0_4px_12px_rgba(15,39,71,0.06)]">
                  <div className="h-3 w-16 rounded bg-[#dde6f0]" />
                  <div className="mt-3 h-4 w-2/3 rounded bg-[#dde6f0]" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-[#dde6f0]" />
                  <div className="mt-4 flex gap-2">
                    <div className="h-6 w-24 rounded-full bg-[#dde6f0]" />
                    <div className="h-6 w-20 rounded-full bg-[#dde6f0]" />
                  </div>
                </article>
              ))
            : null}

          {filteredAndSorted.map((etf) => (
            <Link key={etf.symbol} href={`/etf/${etf.symbol}`} className="group block">
              <article className="rounded-2xl border border-[#d6e0ea] bg-[#fbfdff] p-3 shadow-[0_4px_12px_rgba(15,39,71,0.06)] transition group-hover:-translate-y-0.5 group-hover:shadow-[0_8px_18px_rgba(15,39,71,0.11)]">
                <p className="text-xs font-semibold tracking-wide text-[#5f738d]">{etf.symbol}</p>
                <h2 className="mt-1 text-base font-semibold text-[#132844]">{etf.name || etf.symbol}</h2>
                <p className="mt-1 text-sm text-[#506784]">{etf.issuer || t.noData}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#4f6683]">
                  <span className="rounded-full bg-[#edf3fa] px-2 py-0.5">
                    {localizeCategory(etf.category, language) || t.noData}
                  </span>
                  <span className="rounded-full bg-[#edf3fa] px-2 py-0.5">
                    {t.er}: {etf.expense_ratio != null ? `${etf.expense_ratio}%` : t.noData}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-[#d9e3ee] bg-[#f3f7fc] px-2 py-1">
                    <p className="text-[10px] text-[#66809c]">{t.y1}</p>
                    <p className={`font-semibold ${pctColor(etf.period_returns_pct?.['1Y'])}`}>{formatPct(etf.period_returns_pct?.['1Y'])}</p>
                  </div>
                  <div className="rounded-lg border border-[#d9e3ee] bg-[#f3f7fc] px-2 py-1">
                    <p className="text-[10px] text-[#66809c]">{t.y3}</p>
                    <p className={`font-semibold ${pctColor(etf.period_returns_pct?.['3Y'])}`}>{formatPct(etf.period_returns_pct?.['3Y'])}</p>
                  </div>
                  <div className="rounded-lg border border-[#d9e3ee] bg-[#f3f7fc] px-2 py-1">
                    <p className="text-[10px] text-[#66809c]">{t.y5}</p>
                    <p className={`font-semibold ${pctColor(etf.period_returns_pct?.['5Y'])}`}>{formatPct(etf.period_returns_pct?.['5Y'])}</p>
                  </div>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#d6e0ea] bg-[#fbfdff] shadow-[0_4px_12px_rgba(15,39,71,0.06)]">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#d9e3ee] bg-[#f1f6fc] text-[#506884]">
                {columnHeaders.map((header) => (
                  <th key={header.key} className="px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => handleColumnSort(header.key)}
                      className="inline-flex items-center gap-1 hover:text-[#132844]"
                    >
                      <span>{header.label}</span>
                      <span className="text-xs text-[#8aa0bb]">
                        {sortField === header.key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((etf) => (
                <tr key={etf.symbol} className="border-b border-[#e5edf6]">
                  <td className="px-4 py-3 font-semibold text-[#132844]">
                    <Link href={`/etf/${etf.symbol}`} className="hover:underline">
                      {etf.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[#2f4664]">{etf.name || t.noData}</td>
                  <td className="px-4 py-3 text-[#506784]">{etf.issuer || t.noData}</td>
                  <td className="px-4 py-3 text-[#506784]">{localizeCategory(etf.category, language) || t.noData}</td>
                  <td className="px-4 py-3 text-[#2f4664]">{etf.expense_ratio != null ? `${etf.expense_ratio}%` : t.noData}</td>
                  <td className={`px-4 py-3 font-medium ${pctColor(etf.period_returns_pct?.['1Y'])}`}>{formatPct(etf.period_returns_pct?.['1Y'])}</td>
                  <td className={`px-4 py-3 font-medium ${pctColor(etf.period_returns_pct?.['3Y'])}`}>{formatPct(etf.period_returns_pct?.['3Y'])}</td>
                  <td className={`px-4 py-3 font-medium ${pctColor(etf.period_returns_pct?.['5Y'])}`}>{formatPct(etf.period_returns_pct?.['5Y'])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl border border-[#d9e3ee] bg-[#fbfdff] p-6 text-center text-sm text-[#506784]">{t.noMatch}</div>
      ) : null}
    </section>
  )
}
