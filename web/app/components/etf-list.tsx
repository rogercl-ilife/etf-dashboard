'use client'

import { useEffect, useMemo, useState } from 'react'

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
  }, [debouncedQuery])

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
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((etf) => (
          <article key={etf.symbol} className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
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
        ))}
      </div>
    </section>
  )
}
