'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage, type Language } from '@/app/components/language-context'

type EtfOption = { symbol: string; name: string | null }

type DcaData = {
  assumptions: {
    period_mode_requested: '1Y' | '3Y' | '5Y' | '10Y' | 'custom'
    period_preset_requested: '1Y' | '3Y' | '5Y' | '10Y' | null
    period_preset_used: '1Y' | '3Y' | '5Y' | '10Y' | null
    downgraded: boolean
    start_date: string
    end_date: string
  }
  total_invested_amount: number
  settlement_amount: number
  unrealized_pnl_amount: number
  per_symbol: Array<{
    symbol: string
    period_requested: '1Y' | '3Y' | '5Y' | '10Y' | null
    period_used: '1Y' | '3Y' | '5Y' | '10Y' | null
    used_start_date: string | null
    used_end_date: string | null
    downgraded: boolean
  }>
}

type LookthroughData = {
  top_stock_exposures: Array<{
    holding_symbol: string | null
    holding_name: string | null
    portfolio_exposure_pct: number
  }>
  assumptions: {
    holdings_coverage_pct: number
  }
}

type DcaSelection = {
  symbol: string
  name: string | null
  enabled: boolean
  monthlyShares: string
}

type ApiResponse<T> = { data?: T; error?: string }

const LOCALE_MAP: Record<Language, string> = { en: 'en-US', 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN' }

const TEXT: Record<Language, Record<string, string>> = {
  en: {
    title: 'DCA Simulator', subtitle: 'Configure monthly share purchases by ETF and backtest result.',
    search: 'Search ETF', period: 'DCA Period', customStart: 'Custom Start', customEnd: 'Custom End',
    etfList: 'DCA ETF List', monthlyShares: 'Monthly Shares', run: 'Run DCA', running: 'Running...',
    invested: 'Total Invested', settlement: 'Temporary Settlement', pnl: 'Unrealized P/L',
    usedRange: 'Backtest Range', downgraded: 'Some ETFs do not have enough history. Auto-downgraded to a shorter period.',
    noResult: 'No result yet.', needSelection: 'Select at least one ETF for DCA.', loadFailed: 'Failed to load ETF list',
    selectedList: 'Selected DCA ETFs', selectedNone: 'No ETF selected yet.',
    periodUsed: 'Period Used',
    topHoldings: 'Top 10 Look-through Holdings', symbol: 'Symbol', stockName: 'Name', exposure: 'Exposure', coverage: 'Coverage',
  },
  'zh-TW': {
    title: '定投試算區', subtitle: '設定每檔每月買入股數，執行定投回測。',
    search: '搜尋 ETF', period: '定投期間', customStart: '自訂開始日', customEnd: '自訂結束日',
    etfList: '定投 ETF 清單', monthlyShares: '每月買入股數', run: '開始定投試算', running: '試算中...',
    invested: '累積投入金額', settlement: '暫時結算金額', pnl: '未實現損益',
    usedRange: '回測區間', downgraded: '部分 ETF 歷史不足，已自動降檔至較短年限。',
    noResult: '尚未試算。', needSelection: '請至少勾選一檔定投 ETF。', loadFailed: 'ETF 清單讀取失敗',
    selectedList: '已選定投清單', selectedNone: '目前尚未勾選 ETF。',
    periodUsed: '使用期間',
    topHoldings: '穿透後前十大持股', symbol: '代號', stockName: '名稱', exposure: '曝險比例', coverage: '資料覆蓋率',
  },
  'zh-CN': {
    title: '定投试算区', subtitle: '设置每档每月买入股数，执行定投回测。',
    search: '搜索 ETF', period: '定投期间', customStart: '自定义开始日', customEnd: '自定义结束日',
    etfList: '定投 ETF 清单', monthlyShares: '每月买入股数', run: '开始定投试算', running: '试算中...',
    invested: '累计投入金额', settlement: '暂时结算金额', pnl: '未实现损益',
    usedRange: '回测区间', downgraded: '部分 ETF 历史不足，已自动降档至较短年限。',
    noResult: '尚未试算。', needSelection: '请至少勾选一只定投 ETF。', loadFailed: 'ETF 列表读取失败',
    selectedList: '已选定投清单', selectedNone: '目前尚未勾选 ETF。',
    periodUsed: '使用期间',
    topHoldings: '穿透后前十大持股', symbol: '代码', stockName: '名称', exposure: '敞口比例', coverage: '数据覆盖率',
  },
}

export default function DcaSimulator() {
  const { language } = useLanguage()
  const t = TEXT[language]

  const [etfs, setEtfs] = useState<EtfOption[]>([])
  const [dcaSelection, setDcaSelection] = useState<DcaSelection[]>([])
  const [query, setQuery] = useState('')
  const [dcaPeriodMode, setDcaPeriodMode] = useState<'1Y' | '3Y' | '5Y' | '10Y' | 'custom'>('10Y')
  const [dcaCustomStartDate, setDcaCustomStartDate] = useState('')
  const [dcaCustomEndDate, setDcaCustomEndDate] = useState('')
  const [loadingEtfs, setLoadingEtfs] = useState(false)
  const [loadingEstimate, setLoadingEstimate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dca, setDca] = useState<DcaData | null>(null)
  const [lookthrough, setLookthrough] = useState<LookthroughData | null>(null)

  const moneyFmt = useMemo(() => new Intl.NumberFormat(LOCALE_MAP[language], { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), [language])
  const pctFmt = useMemo(() => new Intl.NumberFormat(LOCALE_MAP[language], { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [language])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const base = !normalized ? dcaSelection : dcaSelection.filter((row) => row.symbol.toLowerCase().includes(normalized) || (row.name || '').toLowerCase().includes(normalized))
    return base.slice(0, 80)
  }, [dcaSelection, query])
  const selectedSummary = useMemo(() => {
    const periodBySymbol = new Map((dca?.per_symbol || []).map((row) => [row.symbol, row]))
    return dcaSelection
      .filter((row) => row.enabled)
      .map((row) => ({
        symbol: row.symbol,
        monthlyShares: Math.max(0.0001, Number(row.monthlyShares) || 1),
        period: periodBySymbol.get(row.symbol),
      }))
  }, [dcaSelection, dca])

  useEffect(() => {
    const controller = new AbortController()
    async function fetchEtfs() {
      setLoadingEtfs(true)
      setError(null)
      try {
        const res = await fetch('/api/etfs?limit=120', { signal: controller.signal, cache: 'no-store' })
        const json = (await res.json()) as { data?: EtfOption[]; error?: string }
        if (!res.ok || !json.data) throw new Error(json.error || t.loadFailed)
        const sorted = [...json.data].sort((a, b) => a.symbol.localeCompare(b.symbol))
        setEtfs(sorted)
        setDcaSelection(sorted.map((row) => ({ symbol: row.symbol, name: row.name, enabled: false, monthlyShares: '1' })))
      } catch (fetchError) {
        if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : t.loadFailed)
      } finally {
        if (!controller.signal.aborted) setLoadingEtfs(false)
      }
    }
    fetchEtfs()
    return () => controller.abort()
  }, [t.loadFailed])

  function toggleDcaSymbol(symbol: string) {
    setDcaSelection((prev) => prev.map((row) => (row.symbol === symbol ? { ...row, enabled: !row.enabled } : row)))
  }
  function updateDcaShares(symbol: string, value: string) {
    const cleaned = value.replace(/[^0-9.]/g, '')
    setDcaSelection((prev) => prev.map((row) => (row.symbol === symbol ? { ...row, monthlyShares: cleaned } : row)))
  }

  async function runDca() {
    const dcaAllocations = dcaSelection
      .filter((row) => row.enabled)
      .map((row) => ({ symbol: row.symbol, monthly_shares: Math.max(0.0001, Number(row.monthlyShares) || 1) }))

    if (dcaAllocations.length === 0) return setError(t.needSelection)

    setError(null)
    setLoadingEstimate(true)

    try {
      const totalShares = dcaAllocations.reduce((sum, row) => sum + row.monthly_shares, 0)
      const lookthroughAllocations = dcaAllocations.map((row) => ({
        symbol: row.symbol,
        weight_pct: Number(((row.monthly_shares / totalShares) * 100).toFixed(4)),
      }))

      const [dcaRes, lookRes] = await Promise.all([
        fetch('/api/portfolio/dca-simulate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            dca_allocations: dcaAllocations,
            period_mode: dcaPeriodMode,
            custom_start_date: dcaPeriodMode === 'custom' ? dcaCustomStartDate : undefined,
            custom_end_date: dcaPeriodMode === 'custom' ? dcaCustomEndDate : undefined,
          }),
        }),
        fetch('/api/portfolio/lookthrough', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ allocations: lookthroughAllocations, top_n: 10 }),
        }),
      ])

      const dcaJson = (await dcaRes.json()) as ApiResponse<DcaData>
      const lookJson = (await lookRes.json()) as ApiResponse<LookthroughData>
      if (!dcaRes.ok || !dcaJson.data) throw new Error(dcaJson.error || 'DCA simulation failed')
      if (!lookRes.ok || !lookJson.data) throw new Error(lookJson.error || 'Look-through failed')
      setDca(dcaJson.data)
      setLookthrough(lookJson.data)
    } catch (estimateError) {
      setError(estimateError instanceof Error ? estimateError.message : 'DCA simulation failed')
    } finally {
      setLoadingEstimate(false)
    }
  }

  return (
    <section className="rounded-3xl border border-[#d6e0ea] bg-[#f9fbfe]/75 p-4 shadow-[0_6px_22px_rgba(15,39,71,0.08)] sm:p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[#0B1F3A] sm:text-2xl">{t.title}</h2>
        <p className="mt-1 text-sm text-[#5f7390]">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
          <div className="grid gap-2">
            <label className="text-xs text-[#4e6888]">{t.period}
              <select value={dcaPeriodMode} onChange={(event) => setDcaPeriodMode(event.target.value as '1Y' | '3Y' | '5Y' | '10Y' | 'custom')} className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]">
                <option value="1Y">1Y</option><option value="3Y">3Y</option><option value="5Y">5Y</option><option value="10Y">10Y</option><option value="custom">Custom</option>
              </select>
            </label>
            {dcaPeriodMode === 'custom' ? <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-[#4e6888]">{t.customStart}<input type="date" value={dcaCustomStartDate} onChange={(event) => setDcaCustomStartDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]" /></label>
              <label className="text-xs text-[#4e6888]">{t.customEnd}<input type="date" value={dcaCustomEndDate} onChange={(event) => setDcaCustomEndDate(event.target.value)} className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]" /></label>
            </div> : null}
          </div>
          <button type="button" onClick={runDca} disabled={loadingEstimate} className="mt-4 w-full rounded-xl bg-[#0d4f9e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#95acc7]">{loadingEstimate ? t.running : t.run}</button>
          {error ? <p className="mt-3 text-sm font-medium text-[#b5475a]">{error}</p> : null}

          {dca ? <div className="mt-4 space-y-2 text-sm text-[#163760]">
            <p>{t.invested}: <span className="font-semibold">{moneyFmt.format(dca.total_invested_amount)}</span></p>
            <p>{t.settlement}: <span className="font-semibold">{moneyFmt.format(dca.settlement_amount)}</span></p>
            <p>{t.pnl}: <span className={`font-semibold ${dca.unrealized_pnl_amount >= 0 ? 'text-[#0f7a5c]' : 'text-[#b5475a]'}`}>{moneyFmt.format(dca.unrealized_pnl_amount)}</span></p>
            <p className="text-xs text-[#5d7594]">{t.usedRange}: {dca.assumptions.start_date} ~ {dca.assumptions.end_date}</p>
            {dca.assumptions.downgraded ? <p className="text-xs text-[#b5475a]">{t.downgraded}</p> : null}
          </div> : <p className="mt-4 text-sm text-[#7086a1]">{t.noResult}</p>}

          <div className="mt-4 rounded-lg border border-[#e0e8f1] bg-white px-3 py-3">
            <p className="text-xs font-semibold text-[#4e6888]">{t.selectedList}</p>
            <div className="mt-2 space-y-1">
              {selectedSummary.length === 0 ? <p className="text-xs text-[#7086a1]">{t.selectedNone}</p> : null}
              {selectedSummary.map((row) => (
                <div key={`selected-${row.symbol}`} className="flex items-center justify-between text-sm text-[#163760]">
                  <div>
                    <span className="font-semibold">{row.symbol}</span>
                    {row.period?.period_used ? <p className="text-xs text-[#5d7594]">{t.periodUsed}: {row.period.period_used} ({row.period.used_start_date} ~ {row.period.used_end_date})</p> : null}
                  </div>
                  <span>{row.monthlyShares} {t.monthlyShares}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
          <label className="mb-3 block text-xs text-[#4e6888]">{t.search}<input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]" /></label>
          <p className="mb-2 text-xs text-[#4e6888]">{t.etfList}</p>
          <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
            {filtered.map((row) => (
              <div key={`dca-${row.symbol}`} className="flex items-center gap-2 rounded-lg border border-[#e0e8f1] px-2 py-2">
                <input checked={row.enabled} onChange={() => toggleDcaSymbol(row.symbol)} type="checkbox" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#193b65]">{row.symbol}</p>
                  <p className="truncate text-xs text-[#6b8099]">{row.name || '-'}</p>
                </div>
                <input
                  value={row.monthlyShares}
                  onChange={(event) => updateDcaShares(row.symbol, event.target.value)}
                  inputMode="decimal"
                  disabled={!row.enabled}
                  className="w-20 rounded-lg border border-[#cfdbe8] px-2 py-1 text-right text-sm text-[#14355c] disabled:bg-[#eef3f8]"
                />
                <span className="text-[11px] text-[#5d7594]">{t.monthlyShares}</span>
              </div>
            ))}
            {!loadingEtfs && filtered.length === 0 ? <p className="text-sm text-[#6b8099]">No ETF</p> : null}
            {loadingEtfs ? <p className="text-sm text-[#6b8099]">Loading...</p> : null}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
        <p className="mb-3 text-xs font-semibold text-[#4e6888]">{t.topHoldings}</p>
        {lookthrough ? (
          <div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#dde7f2] text-[#597391]">
                    <th className="px-2 py-2">{t.symbol}</th>
                    <th className="px-2 py-2">{t.stockName}</th>
                    <th className="px-2 py-2 text-right">{t.exposure}</th>
                  </tr>
                </thead>
                <tbody>
                  {lookthrough.top_stock_exposures.map((row) => (
                    <tr key={`${row.holding_symbol || ''}-${row.holding_name || ''}`} className="border-b border-[#eef3f8] text-[#163760]">
                      <td className="px-2 py-2 font-semibold">{row.holding_symbol || '-'}</td>
                      <td className="px-2 py-2">{row.holding_name || '-'}</td>
                      <td className="px-2 py-2 text-right font-semibold">{pctFmt.format(row.portfolio_exposure_pct)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-[#6d819a]">{t.coverage}: {pctFmt.format(lookthrough.assumptions.holdings_coverage_pct)}%</p>
          </div>
        ) : (
          <p className="text-sm text-[#7086a1]">{t.noResult}</p>
        )}
      </div>
    </section>
  )
}
