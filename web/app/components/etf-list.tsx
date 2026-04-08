'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

type EtfRow = {
  symbol: string
  name: string | null
  issuer: string | null
  category: string | null
  expense_ratio: number | null
  inception_date: string | null
}

type ViewMode = 'cards' | 'table'

type SortKey = 'symbol_asc' | 'symbol_desc' | 'name_asc' | 'expense_asc' | 'expense_desc'

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'symbol_asc', label: 'Symbol A-Z' },
  { value: 'symbol_desc', label: 'Symbol Z-A' },
  { value: 'name_asc', label: 'Name A-Z' },
  { value: 'expense_asc', label: 'ER low-high' },
  { value: 'expense_desc', label: 'ER high-low' },
]

function byText(a: string | null, b: string | null) {
  return (a || '').localeCompare(b || '')
}

function byExpense(a: number | null, b: number | null, asc: boolean) {
  const av = a == null ? (asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : a
  const bv = b == null ? (asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : b
  return asc ? av - bv : bv - av
}

export default function EtfList() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [items, setItems] = useState<EtfRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [sortKey, setSortKey] = useState<SortKey>('symbol_asc')
  const [issuerFilter, setIssuerFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

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
          throw new Error(json.error || 'Failed to fetch ETF list')
        }

        setItems(Array.isArray(json.data) ? json.data : [])
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === 'AbortError') {
          return
        }
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchEtfs()
    return () => controller.abort()
  }, [debouncedQuery, refreshToken])

  const issuerOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((x) => x.issuer).filter(Boolean) as string[]))
    return values.sort((a, b) => a.localeCompare(b))
  }, [items])

  const categoryOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((x) => x.category).filter(Boolean) as string[]))
    return values.sort((a, b) => a.localeCompare(b))
  }, [items])

  const filteredAndSorted = useMemo(() => {
    let result = items.filter((row) => {
      const issuerOk = issuerFilter === 'all' ? true : row.issuer === issuerFilter
      const categoryOk = categoryFilter === 'all' ? true : row.category === categoryFilter
      return issuerOk && categoryOk
    })

    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case 'symbol_desc':
          return byText(b.symbol, a.symbol)
        case 'name_asc':
          return byText(a.name || a.symbol, b.name || b.symbol)
        case 'expense_asc':
          return byExpense(a.expense_ratio, b.expense_ratio, true)
        case 'expense_desc':
          return byExpense(a.expense_ratio, b.expense_ratio, false)
        case 'symbol_asc':
        default:
          return byText(a.symbol, b.symbol)
      }
    })

    return result
  }, [items, issuerFilter, categoryFilter, sortKey])

  const statsText = useMemo(() => {
    if (loading) return 'Loading...'
    if (error) return 'Load failed'
    return `Showing ${filteredAndSorted.length} of ${items.length} ETFs`
  }, [loading, error, filteredAndSorted.length, items.length])

  return (
    <section className="space-y-6">
      <div className="sticky top-2 z-10 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-sm backdrop-blur-sm sm:p-5">
        <label htmlFor="search" className="mb-2 block text-sm font-medium text-slate-700">
          Search ETF
        </label>
        <input
          id="search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try VOO, SPY, QQQ..."
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-slate-600"
        />

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>

          <select
            value={issuerFilter}
            onChange={(e) => setIssuerFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">Issuer: All</option>
            {issuerOptions.map((issuer) => (
              <option key={issuer} value={issuer}>
                {issuer}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          >
            <option value="all">Category: All</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'cards' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                viewMode === 'table' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              Table
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-600">{statsText}</p>
      </div>

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

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loading && items.length === 0
            ? Array.from({ length: 6 }).map((_, idx) => (
                <article key={`skeleton-${idx}`} className="animate-pulse rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
                  <div className="h-3 w-16 rounded bg-slate-200" />
                  <div className="mt-3 h-4 w-2/3 rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-slate-200" />
                  <div className="mt-4 flex gap-2">
                    <div className="h-6 w-24 rounded-full bg-slate-200" />
                    <div className="h-6 w-20 rounded-full bg-slate-200" />
                  </div>
                </article>
              ))
            : null}

          {filteredAndSorted.map((etf) => (
            <Link key={etf.symbol} href={`/etf/${etf.symbol}`} className="group block">
              <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md">
                <p className="text-xs font-semibold tracking-wide text-slate-500">{etf.symbol}</p>
                <h2 className="mt-1 text-base font-semibold text-slate-900">{etf.name || etf.symbol}</h2>
                <p className="mt-1 text-sm text-slate-600">{etf.issuer || 'Issuer N/A'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-1">{etf.category || 'Category N/A'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">
                    ER: {etf.expense_ratio != null ? `${etf.expense_ratio}%` : 'N/A'}
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-3 font-medium">Symbol</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Issuer</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">ER</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((etf) => (
                <tr key={etf.symbol} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <Link href={`/etf/${etf.symbol}`} className="hover:underline">
                      {etf.symbol}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-800">{etf.name || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{etf.issuer || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-600">{etf.category || 'N/A'}</td>
                  <td className="px-4 py-3 text-slate-800">{etf.expense_ratio != null ? `${etf.expense_ratio}%` : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && filteredAndSorted.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No ETF matched your keyword/filters.
        </div>
      ) : null}
    </section>
  )
}
