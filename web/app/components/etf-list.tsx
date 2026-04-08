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

export default function EtfList() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [items, setItems] = useState<EtfRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

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

  const statsText = useMemo(() => {
    if (loading) return 'Loading...'
    if (error) return 'Load failed'
    return `Found ${items.length} ETF${items.length === 1 ? '' : 's'}`
  }, [loading, error, items.length])

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white/90 p-5 shadow-sm">
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

        {items.map((etf) => (
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

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
          No ETF matched your keyword.
        </div>
      ) : null}
    </section>
  )
}
