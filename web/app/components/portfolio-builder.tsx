'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage, type Language } from '@/app/components/language-context'

type ReturnPeriod = '1Y' | '3Y' | '5Y' | '10Y'
type ReturnPeriodMode = 'auto' | ReturnPeriod

type EtfOption = {
  symbol: string
  name: string | null
  period_returns_pct?: {
    '1Y': number | null
    '3Y': number | null
    '5Y': number | null
    '10Y': number | null
  }
}

type SelectedEtf = {
  symbol: string
  name: string | null
  weight: string
}

type SimulateData = {
  weighted_baseline_annual_return_pct: number
  projection: {
    base_end_value: number
    bull_end_value: number
    bear_end_value: number
  }
  assumptions: {
    return_coverage_pct: number
    return_period_mode: ReturnPeriodMode
    return_period_used: ReturnPeriod
    return_period_requested: ReturnPeriod | null
  }
}

type LookthroughData = {
  top_stock_exposures: Array<{
    holding_symbol: string | null
    holding_name: string | null
    portfolio_exposure_pct: number
  }>
  risk_summary: {
    top1_pct: number
    top5_pct: number
    hhi: number
  }
  assumptions: {
    holdings_coverage_pct: number
  }
}

type ApiResponse<T> = { data?: T; error?: string }

const LOCALE_MAP: Record<Language, string> = { en: 'en-US', 'zh-TW': 'zh-TW', 'zh-CN': 'zh-CN' }
const PERIODS: ReturnPeriod[] = ['10Y', '5Y', '3Y', '1Y']

const TEXT: Record<Language, Record<string, string>> = {
  en: {
    title: 'Portfolio Builder MVP', subtitle: 'Pick ETFs, set weights, and estimate return/risk with look-through stock exposure.',
    search: 'Search ETF', selected: 'Selected ETFs', pickHint: 'Select at least one ETF', weightHint: 'Weights must sum to 100%',
    rebalance: 'Auto Equal Weight', amount: 'Investment Amount (USD)', horizon: 'Horizon (Years)', run: 'Run Estimate', running: 'Estimating...', total: 'Total Weight',
    validationTotal: 'Total weight must equal 100%.', validationNeedSelection: 'Select at least one ETF first.',
    sectionProjection: 'Return Projection', sectionRisk: 'Risk Snapshot', sectionTopHoldings: 'Top 10 Look-through Holdings', sectionAllocations: 'Your ETF Allocation',
    annualReturn: 'Estimated Annual Return', baseEnd: 'Base Scenario', bullEnd: 'Bull Scenario', bearEnd: 'Bear Scenario', top1: 'Top 1 Stock Concentration', top5: 'Top 5 Concentration',
    hhi: 'Concentration Index (HHI)', coverage: 'Coverage', symbol: 'Symbol', stockName: 'Name', exposure: 'Exposure', noResult: 'No result yet. Configure and run estimate.',
    loadFailed: 'Failed to load ETF list', retry: 'Retry', periodMode: 'Return Period', periodAuto: 'Auto', periodInfo: 'Available periods', commonPeriod: 'Common comparable period',
    usedPeriod: 'Estimated using', downgraded: 'Requested period unavailable for some ETFs. Auto-downgraded.',
  },
  'zh-TW': {
    title: '投資組合建構器 MVP', subtitle: '勾選 ETF、設定權重，立即估算報酬風險與穿透後個股曝險。',
    search: '搜尋 ETF', selected: '已選 ETF', pickHint: '至少選擇一檔 ETF', weightHint: '權重總和必須等於 100%',
    rebalance: '平均分配', amount: '投入金額（USD）', horizon: '投資年期（年）', run: '開始估算', running: '估算中...', total: '權重總和',
    validationTotal: '權重總和必須等於 100%。', validationNeedSelection: '請先選擇至少一檔 ETF。',
    sectionProjection: '報酬情境估算', sectionRisk: '風險快照', sectionTopHoldings: '穿透後前十大持股', sectionAllocations: '你的 ETF 配置',
    annualReturn: '預估年化報酬', baseEnd: '基準情境', bullEnd: '樂觀情境', bearEnd: '保守情境', top1: '單一個股集中度（Top1）', top5: '前五大集中度（Top5）',
    hhi: '集中度指標（HHI）', coverage: '資料覆蓋率', symbol: '代號', stockName: '名稱', exposure: '曝險比例', noResult: '尚未估算，請先設定並執行。',
    loadFailed: 'ETF 清單讀取失敗', retry: '重試', periodMode: '報酬期間', periodAuto: '自動', periodInfo: '可用期間', commonPeriod: '共同可比期間',
    usedPeriod: '本次估算基於', downgraded: '部分 ETF 無此期間，系統已自動降級。',
  },
  'zh-CN': {
    title: '投资组合构建器 MVP', subtitle: '勾选 ETF、设置权重，立即估算收益风险与穿透后个股敞口。',
    search: '搜索 ETF', selected: '已选 ETF', pickHint: '至少选择一只 ETF', weightHint: '权重总和必须等于 100%',
    rebalance: '平均分配', amount: '投入金额（USD）', horizon: '投资年限（年）', run: '开始估算', running: '估算中...', total: '权重总和',
    validationTotal: '权重总和必须等于 100%。', validationNeedSelection: '请先选择至少一只 ETF。',
    sectionProjection: '收益情景估算', sectionRisk: '风险快照', sectionTopHoldings: '穿透后前十大持股', sectionAllocations: '你的 ETF 配置',
    annualReturn: '预估年化收益', baseEnd: '基准情景', bullEnd: '乐观情景', bearEnd: '保守情景', top1: '单一个股集中度（Top1）', top5: '前五大集中度（Top5）',
    hhi: '集中度指标（HHI）', coverage: '数据覆盖率', symbol: '代码', stockName: '名称', exposure: '敞口比例', noResult: '尚未估算，请先设置并执行。',
    loadFailed: 'ETF 列表读取失败', retry: '重试', periodMode: '收益期间', periodAuto: '自动', periodInfo: '可用期间', commonPeriod: '共同可比期间',
    usedPeriod: '本次估算基于', downgraded: '部分 ETF 无此期间，系统已自动降级。',
  },
}

function toNumber(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0 }
function getAvailablePeriods(etf: EtfOption): ReturnPeriod[] {
  const periods: ReturnPeriod[] = []
  for (const p of PERIODS) if (etf.period_returns_pct?.[p] != null) periods.push(p)
  return periods
}

export default function PortfolioBuilder() {
  const { language } = useLanguage()
  const t = TEXT[language]

  const [etfs, setEtfs] = useState<EtfOption[]>([])
  const [selected, setSelected] = useState<SelectedEtf[]>([])
  const [query, setQuery] = useState('')
  const [amount, setAmount] = useState('10000')
  const [horizonYears, setHorizonYears] = useState('10')
  const [periodMode, setPeriodMode] = useState<ReturnPeriodMode>('auto')
  const [loadingEtfs, setLoadingEtfs] = useState(false)
  const [loadingEstimate, setLoadingEstimate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [simulate, setSimulate] = useState<SimulateData | null>(null)
  const [lookthrough, setLookthrough] = useState<LookthroughData | null>(null)

  const etfMap = useMemo(() => new Map(etfs.map((x) => [x.symbol, x])), [etfs])
  const filteredEtfs = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const base = !normalized ? etfs : etfs.filter((row) => row.symbol.toLowerCase().includes(normalized) || (row.name || '').toLowerCase().includes(normalized))
    return base.slice(0, 30)
  }, [etfs, query])
  const totalWeight = useMemo(() => selected.reduce((sum, row) => sum + toNumber(row.weight), 0), [selected])
  const allocations = useMemo(() => selected.map((row) => ({ symbol: row.symbol, weight_pct: Number(toNumber(row.weight).toFixed(4)) })), [selected])
  const canEstimate = selected.length > 0 && Math.abs(totalWeight - 100) < 0.01

  const commonPeriod = useMemo(() => {
    if (selected.length === 0) return null
    for (const period of PERIODS) {
      const ok = selected.every((row) => {
        const etf = etfMap.get(row.symbol)
        return etf && getAvailablePeriods(etf).includes(period)
      })
      if (ok) return period
    }
    return null
  }, [selected, etfMap])

  const pctFmt = useMemo(() => new Intl.NumberFormat(LOCALE_MAP[language], { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [language])
  const moneyFmt = useMemo(() => new Intl.NumberFormat(LOCALE_MAP[language], { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }), [language])

  useEffect(() => {
    const controller = new AbortController()
    async function fetchEtfs() {
      setLoadingEtfs(true); setError(null)
      try {
        const res = await fetch('/api/etfs?limit=120', { signal: controller.signal, cache: 'no-store' })
        const json = (await res.json()) as { data?: EtfOption[]; error?: string }
        if (!res.ok || !json.data) throw new Error(json.error || t.loadFailed)
        setEtfs([...json.data].sort((a, b) => a.symbol.localeCompare(b.symbol)))
      } catch (fetchError) {
        if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : t.loadFailed)
      } finally {
        if (!controller.signal.aborted) setLoadingEtfs(false)
      }
    }
    fetchEtfs()
    return () => controller.abort()
  }, [t.loadFailed])

  function toggleSymbol(etf: EtfOption) {
    setSelected((prev) => prev.some((row) => row.symbol === etf.symbol) ? prev.filter((row) => row.symbol !== etf.symbol) : [...prev, { symbol: etf.symbol, name: etf.name, weight: '0' }])
  }
  function updateWeight(symbol: string, weight: string) {
    const cleaned = weight.replace(/[^0-9.]/g, '')
    setSelected((prev) => prev.map((row) => (row.symbol === symbol ? { ...row, weight: cleaned } : row)))
  }
  function rebalanceEqualWeight() {
    setSelected((prev) => prev.length === 0 ? prev : prev.map((row, i) => ({ ...row, weight: (i === prev.length - 1 ? 100 - (100 / prev.length) * (prev.length - 1) : 100 / prev.length).toFixed(2) })))
  }

  async function runEstimate() {
    if (selected.length === 0) return setError(t.validationNeedSelection)
    if (Math.abs(totalWeight - 100) >= 0.01) return setError(t.validationTotal)
    setError(null); setLoadingEstimate(true)

    const payload = {
      amount: Math.max(1, Number(amount) || 10000),
      horizon_years: Math.min(40, Math.max(1, Math.trunc(Number(horizonYears) || 10))),
      allocations,
      return_period_mode: periodMode,
    }

    try {
      const [simRes, lookRes] = await Promise.all([
        fetch('/api/portfolio/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
        fetch('/api/portfolio/lookthrough', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ allocations: payload.allocations, top_n: 10 }) }),
      ])
      const simJson = (await simRes.json()) as ApiResponse<SimulateData>
      const lookJson = (await lookRes.json()) as ApiResponse<LookthroughData>
      if (!simRes.ok || !simJson.data) throw new Error(simJson.error || 'Simulation failed')
      if (!lookRes.ok || !lookJson.data) throw new Error(lookJson.error || 'Look-through failed')
      setSimulate(simJson.data); setLookthrough(lookJson.data)
    } catch (estimateError) {
      setError(estimateError instanceof Error ? estimateError.message : 'Estimate failed')
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
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#14355c]">{t.selected}</p>
            <button type="button" onClick={rebalanceEqualWeight} className="rounded-full border border-[#c6d3e2] px-3 py-1 text-xs font-semibold text-[#2a4466]">{t.rebalance}</button>
          </div>

          <div className="space-y-2">
            {selected.length === 0 ? <p className="text-sm text-[#7086a1]">{t.pickHint}</p> : null}
            {selected.map((row) => {
              const periods = getAvailablePeriods(etfMap.get(row.symbol) || { symbol: row.symbol, name: row.name })
              return (
                <div key={row.symbol} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#193b65]">{row.symbol}</p>
                    <p className="truncate text-xs text-[#6b8099]">{row.name || '-'}</p>
                    <p className="truncate text-[11px] text-[#7a8fa8]">{t.periodInfo}: {periods.join(', ') || '-'}</p>
                  </div>
                  <input value={row.weight} onChange={(event) => updateWeight(row.symbol, event.target.value)} inputMode="decimal" className="w-24 rounded-lg border border-[#cfdbe8] px-2 py-1 text-right text-sm" />
                  <span className="text-sm text-[#496589]">%</span>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-xs font-medium text-[#4d6787]">{t.total}: <span className={Math.abs(totalWeight - 100) < 0.01 ? 'text-[#0f7a5c]' : 'text-[#b5475a]'}>{pctFmt.format(totalWeight)}%</span></p>
          <p className="mt-1 text-xs text-[#6f849d]">{t.weightHint}</p>
          <p className="mt-1 text-xs text-[#6f849d]">{t.commonPeriod}: {commonPeriod || '-'}</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-[#4e6888]">{t.amount}<input value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]" /></label>
            <label className="text-xs text-[#4e6888]">{t.horizon}<input value={horizonYears} onChange={(event) => setHorizonYears(event.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]" /></label>
            <label className="text-xs text-[#4e6888] sm:col-span-2">{t.periodMode}
              <select value={periodMode} onChange={(event) => setPeriodMode(event.target.value as ReturnPeriodMode)} className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]">
                <option value="auto">{t.periodAuto}</option><option value="1Y">1Y</option><option value="3Y">3Y</option><option value="5Y">5Y</option><option value="10Y">10Y</option>
              </select>
            </label>
          </div>

          <button type="button" onClick={runEstimate} disabled={!canEstimate || loadingEstimate} className="mt-4 w-full rounded-xl bg-[#0d4f9e] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#95acc7]">{loadingEstimate ? t.running : t.run}</button>
          {error ? <p className="mt-3 text-sm font-medium text-[#b5475a]">{error}</p> : null}
        </div>

        <div className="rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
          <label className="mb-3 block text-xs text-[#4e6888]">{t.search}<input value={query} onChange={(event) => setQuery(event.target.value)} className="mt-1 w-full rounded-lg border border-[#cfdbe8] px-3 py-2 text-sm text-[#14355c]" /></label>
          <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
            {filteredEtfs.map((etf) => {
              const checked = selected.some((row) => row.symbol === etf.symbol)
              const periods = getAvailablePeriods(etf)
              return (
                <label key={etf.symbol} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e0e8f1] px-2 py-2">
                  <input checked={checked} onChange={() => toggleSymbol(etf)} type="checkbox" className="mt-1" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#193b65]">{etf.symbol}</p>
                    <p className="truncate text-xs text-[#6b8099]">{etf.name || '-'}</p>
                    <p className="truncate text-[11px] text-[#7a8fa8]">{t.periodInfo}: {periods.join(', ') || '-'}</p>
                  </div>
                </label>
              )
            })}
            {!loadingEtfs && filteredEtfs.length === 0 ? <p className="text-sm text-[#6b8099]">No ETF</p> : null}
            {loadingEtfs ? <p className="text-sm text-[#6b8099]">Loading...</p> : null}
          </div>
          {error && etfs.length === 0 ? <button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-full border border-[#c6d3e2] px-3 py-1 text-xs font-semibold text-[#2a4466]">{t.retry}</button> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
          <p className="text-xs font-semibold text-[#4e6888]">{t.sectionProjection}</p>
          {simulate ? <div className="mt-2 space-y-2 text-sm text-[#163760]">
            <p>{t.annualReturn}: <span className="font-semibold">{pctFmt.format(simulate.weighted_baseline_annual_return_pct)}%</span></p>
            <p className="text-xs text-[#5d7594]">{t.usedPeriod}: {simulate.assumptions.return_period_used}</p>
            {simulate.assumptions.return_period_requested && simulate.assumptions.return_period_requested !== simulate.assumptions.return_period_used ? <p className="text-xs text-[#b5475a]">{t.downgraded}</p> : null}
            <p>{t.baseEnd}: <span className="font-semibold">{moneyFmt.format(simulate.projection.base_end_value)}</span></p>
            <p>{t.bullEnd}: <span className="font-semibold">{moneyFmt.format(simulate.projection.bull_end_value)}</span></p>
            <p>{t.bearEnd}: <span className="font-semibold">{moneyFmt.format(simulate.projection.bear_end_value)}</span></p>
            <p className="text-xs text-[#6d819a]">{t.coverage}: {pctFmt.format(simulate.assumptions.return_coverage_pct)}%</p>
          </div> : <p className="mt-2 text-sm text-[#7086a1]">{t.noResult}</p>}
        </article>

        <article className="rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
          <p className="text-xs font-semibold text-[#4e6888]">{t.sectionRisk}</p>
          {lookthrough ? <div className="mt-2 space-y-2 text-sm text-[#163760]">
            <p>{t.top1}: <span className="font-semibold">{pctFmt.format(lookthrough.risk_summary.top1_pct)}%</span></p>
            <p>{t.top5}: <span className="font-semibold">{pctFmt.format(lookthrough.risk_summary.top5_pct)}%</span></p>
            <p>{t.hhi}: <span className="font-semibold">{pctFmt.format(lookthrough.risk_summary.hhi)}</span></p>
            <p className="text-xs text-[#6d819a]">{t.coverage}: {pctFmt.format(lookthrough.assumptions.holdings_coverage_pct)}%</p>
          </div> : <p className="mt-2 text-sm text-[#7086a1]">{t.noResult}</p>}
        </article>

        <article className="rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
          <p className="text-xs font-semibold text-[#4e6888]">{t.sectionAllocations}</p>
          <div className="mt-2 space-y-2">
            {selected.length === 0 ? <p className="text-sm text-[#7086a1]">{t.noResult}</p> : null}
            {selected.map((row) => <div key={row.symbol} className="flex items-center justify-between text-sm text-[#163760]"><span>{row.symbol}</span><span className="font-semibold">{pctFmt.format(toNumber(row.weight))}%</span></div>)}
          </div>
        </article>
      </div>

      <div className="mt-4 rounded-2xl border border-[#d6e0ea] bg-white/80 p-4">
        <p className="mb-3 text-xs font-semibold text-[#4e6888]">{t.sectionTopHoldings}</p>
        {lookthrough ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-[#dde7f2] text-[#597391]"><th className="px-2 py-2">{t.symbol}</th><th className="px-2 py-2">{t.stockName}</th><th className="px-2 py-2 text-right">{t.exposure}</th></tr></thead><tbody>{lookthrough.top_stock_exposures.map((row) => <tr key={`${row.holding_symbol || ''}-${row.holding_name || ''}`} className="border-b border-[#eef3f8] text-[#163760]"><td className="px-2 py-2 font-semibold">{row.holding_symbol || '-'}</td><td className="px-2 py-2">{row.holding_name || '-'}</td><td className="px-2 py-2 text-right font-semibold">{pctFmt.format(row.portfolio_exposure_pct)}%</td></tr>)}</tbody></table></div> : <p className="text-sm text-[#7086a1]">{t.noResult}</p>}
      </div>
    </section>
  )
}
