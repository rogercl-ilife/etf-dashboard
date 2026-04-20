'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLanguage, type Language } from '@/app/components/language-context'

type TimeHorizon = 'short' | 'medium' | 'long'
type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'
type IncomeNeed = 'high' | 'medium' | 'low'
type ExperienceLevel = 'beginner' | 'intermediate' | 'experienced'
type Persona = 'stability' | 'balanced' | 'growth'

type PersonaAllocation = {
  bonds: string
  dividend: string
  equities: string
}

type PersonaEtfBuckets = {
  bonds: string[]
  dividend: string[]
  equities: string[]
}

type PersonaBucketWeights = {
  bonds: number
  dividend: number
  equities: number
}

type AllocationInput = {
  symbol: string
  weight_pct: number
}

type SimulationData = {
  weighted_baseline_annual_return_pct: number
  projection: {
    base_end_value: number
    bull_end_value: number
    bear_end_value: number
  }
  estimated_dividend: {
    portfolio_ttm_dividend_yield_pct: number | null
    estimated_annual_dividend_amount: number | null
    estimated_monthly_dividend_amount: number | null
  }
  warnings: string[]
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
    alerts: string[]
  }
  warnings: string[]
}

type PlanTier = 'free' | 'member'
type FeatureKey = 'basic_simulation' | 'lookthrough_top10' | 'lookthrough_full' | 'advanced_simulation' | 'export_csv'
type FeatureAccessData = {
  plan: PlanTier
  features: Record<FeatureKey, PlanTier>
}

const PERSONA_ALLOCATIONS: Record<Persona, PersonaAllocation> = {
  stability: {
    bonds: '50-70%',
    dividend: '20-40%',
    equities: '0-20%',
  },
  balanced: {
    bonds: '20-40%',
    dividend: '0-10%',
    equities: '50-70%',
  },
  growth: {
    bonds: '0-20%',
    dividend: '0-10%',
    equities: '80-100%',
  },
}

const PERSONA_BUCKET_WEIGHTS: Record<Persona, PersonaBucketWeights> = {
  stability: { bonds: 60, dividend: 25, equities: 15 },
  balanced: { bonds: 30, dividend: 10, equities: 60 },
  growth: { bonds: 10, dividend: 5, equities: 85 },
}

const PERSONA_ETF_RECOMMENDATIONS: Record<Persona, PersonaEtfBuckets> = {
  stability: {
    bonds: ['SGOV', 'SHY', 'IEF', 'BND', 'TIP'],
    dividend: ['SCHD', 'VIG', 'JEPI'],
    equities: ['VOO', 'VTI', 'VXUS'],
  },
  balanced: {
    bonds: ['BND', 'AGG', 'IEF', 'BNDX'],
    dividend: ['SCHD', 'VIG', 'DGRO'],
    equities: ['VTI', 'VOO', 'VXUS', 'QQQM'],
  },
  growth: {
    bonds: ['SGOV', 'SHY', 'IEF'],
    dividend: ['SCHD', 'VIG'],
    equities: ['VTI', 'VOO', 'QQQ', 'IWM', 'VXUS'],
  },
}

const PERSONA_SCORE: Record<Persona, number> = {
  stability: 0,
  balanced: 1,
  growth: 2,
}

const TIME_SCORE: Record<TimeHorizon, number> = {
  short: 0,
  medium: 1,
  long: 2,
}

const RISK_SCORE: Record<RiskTolerance, number> = {
  conservative: 0,
  moderate: 1,
  aggressive: 2,
}

const INCOME_SCORE: Record<IncomeNeed, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const EXPERIENCE_SCORE: Record<ExperienceLevel, number> = {
  beginner: 0,
  intermediate: 1,
  experienced: 2,
}

const SAMPLE_AMOUNT_USD = 10000

const TEXT: Record<
  Language,
  {
    title: string
    dimensionsTitle: string
    recommendationTitle: string
    disclaimer: string
    dimensions: {
      horizon: string
      risk: string
      income: string
      experience: string
    }
    options: {
      horizon: Record<TimeHorizon, string>
      risk: Record<RiskTolerance, string>
      income: Record<IncomeNeed, string>
      experience: Record<ExperienceLevel, string>
    }
    labels: {
      maxDrawdown: string
      bonds: string
      dividend: string
      equities: string
      profileFit: string
      topMatch: string
      recommendedEtfs: string
      basedOnUniverse: string
      analysisTitle: string
      sampleAmount: string
      annualReturn: string
      projectedValueBase: string
      projectedValueBull: string
      projectedValueBear: string
      estimatedYield: string
      estimatedDividendYear: string
      estimatedDividendMonth: string
      lookthroughTitle: string
      top1Exposure: string
      top5Exposure: string
      hhi: string
      topHoldings: string
      analysisLoading: string
      analysisError: string
      warnings: string
      analysisExpand: string
      analysisCollapse: string
      freeBadge: string
      memberBadge: string
      gatedFeaturesTitle: string
      gatedLookthroughFull: string
      gatedAdvancedSimulation: string
      gatedExport: string
      trustTitle: string
      trustHorizon: string
      trustHorizonValue: string
      trustFormula: string
      trustFormulaValue: string
      trustSource: string
      trustSourceValue: string
      trustAllocation: string
      trustCoverage: string
      trustSummaryTitle: string
      trustSummaryFormula: string
      algoTitle: string
      algoHow: string
      algoReturn: string
      algoScenario: string
      algoDividend: string
      algoSeeTrust: string
      allocationTitle: string
      allocationNote: string
      allocationBucketTemplate: string
    }
    alerts: {
      beginnerHighRisk: string
    }
    personas: Record<
      Persona,
      {
        name: string
        summary: string
        fit: string
        drawdown: string
        quote: string
      }
    >
  }
> = {
  en: {
    title: 'ETF Persona Quick Guide',
    dimensionsTitle: 'Step 1: Define Your 4 Dimensions',
    recommendationTitle: 'Recommended Allocation Logic',
    disclaimer: 'For education only, not investment advice.',
    dimensions: {
      horizon: '1. Time Horizon',
      risk: '2. Risk Tolerance',
      income: '3. Income Need',
      experience: '4. Investing Experience',
    },
    options: {
      horizon: {
        short: 'Short term (< 3 years)',
        medium: 'Mid term (3-10 years)',
        long: 'Long term (10+ years)',
      },
      risk: {
        conservative: 'Conservative (max -10%)',
        moderate: 'Moderate (max -20%)',
        aggressive: 'Aggressive (accept -30% to -50%)',
      },
      income: {
        high: 'High (need regular income)',
        medium: 'Medium (optional)',
        low: 'Low (growth-focused)',
      },
      experience: {
        beginner: '0-2 years (still learning basics)',
        intermediate: '3-7 years (experienced cycles)',
        experienced: '8+ years (can execute with discipline)',
      },
    },
    labels: {
      maxDrawdown: 'Accepted drawdown',
      bonds: 'Bond ETFs',
      dividend: 'Dividend ETFs',
      equities: 'Equity ETFs',
      profileFit: 'Why this profile fits',
      topMatch: 'Top Match',
      recommendedEtfs: 'Suggested ETF list',
      basedOnUniverse: 'Based on current 52-ETF universe',
      analysisTitle: 'Quick simulation',
      sampleAmount: 'Sample amount',
      annualReturn: 'Estimated annual return',
      projectedValueBase: 'Base scenario value',
      projectedValueBull: 'Bull scenario value',
      projectedValueBear: 'Bear scenario value',
      estimatedYield: 'Estimated TTM dividend yield',
      estimatedDividendYear: 'Estimated yearly dividend',
      estimatedDividendMonth: 'Estimated monthly dividend',
      lookthroughTitle: 'Look-through risk snapshot',
      top1Exposure: 'Top 1 stock exposure',
      top5Exposure: 'Top 5 stock exposure',
      hhi: 'Concentration (HHI)',
      topHoldings: 'Top underlying holdings',
      analysisLoading: 'Running simulation...',
      analysisError: 'Unable to load analysis right now.',
      warnings: 'Notes',
      analysisExpand: 'Expand',
      analysisCollapse: 'Collapse',
      freeBadge: 'Free',
      memberBadge: 'Member',
      gatedFeaturesTitle: 'Member features',
      gatedLookthroughFull: 'Full look-through list (Top 50 + ETF contribution details)',
      gatedAdvancedSimulation: 'Advanced simulation (custom assumptions and stress tests)',
      gatedExport: 'Export CSV report',
      trustTitle: 'Simulation basis',
      trustHorizon: 'Horizon',
      trustHorizonValue: '5 years',
      trustFormula: 'Formula',
      trustFormulaValue: 'Base = weighted annual return; Bull = Base + 2%; Bear = Base - 3%',
      trustSource: 'Return source',
      trustSourceValue: '`etf_snapshots`: 5Y fallback to 3Y/1Y',
      trustAllocation: 'ETF weights used',
      trustCoverage: 'Data coverage',
      trustSummaryTitle: 'Summary',
      trustSummaryFormula: '5Y horizon / Base, Bull=Base+2%, Bear=Base-3%',
      algoTitle: 'How this is calculated',
      algoHow: 'The current persona uses bucket weights, then splits each bucket equally across listed ETFs.',
      algoReturn:
        'Estimated annual return = weighted annualized return from ETF snapshots (5Y fallback to 3Y/1Y).',
      algoScenario: 'Scenario values use: base rate / bull = base +2% / bear = base -3%.',
      algoDividend:
        'Estimated dividend uses TTM dividends: ETF yield = (last 12m dividends / latest close), then weighted by ETF allocation.',
      algoSeeTrust: 'ETF weights are listed above in "Simulation basis".',
      allocationTitle: 'ETF weights used in this run',
      allocationNote: 'These weights are auto-generated from persona buckets for quick simulation.',
      allocationBucketTemplate: 'Bucket target',
    },
    alerts: {
      beginnerHighRisk:
        'New investor + aggressive risk: consider starting with smaller position sizes and phased entries before going full allocation.',
    },
    personas: {
      stability: {
        name: 'Stability Seeker',
        summary: 'I can earn less, but I cannot afford deep losses.',
        fit: 'Short/mid horizon + low risk tolerance + high income need.',
        drawdown: 'Around -10%',
        quote: 'Protect capital and keep cash flow steady.',
      },
      balanced: {
        name: 'Balanced Builder',
        summary: 'Grow steadily without extreme volatility.',
        fit: 'Mid/long horizon + moderate risk tolerance + medium income need.',
        drawdown: 'Around -20%',
        quote: 'Balanced growth with controlled downside.',
      },
      growth: {
        name: 'Growth Maximizer',
        summary: 'Volatility is acceptable for long-term upside.',
        fit: 'Long horizon + high risk tolerance + low income need.',
        drawdown: 'Around -30% to -50%',
        quote: 'Maximize long-term compounding potential.',
      },
    },
  },
  'zh-TW': {
    title: 'ETF 投資人格快速判斷',
    dimensionsTitle: 'Step 1：先定義四個維度',
    recommendationTitle: '建議的 ETF 配置邏輯',
    disclaimer: '僅供教育用途，不構成投資建議。',
    dimensions: {
      horizon: '1. 投資時間',
      risk: '2. 風險承受',
      income: '3. 現金流需求',
      experience: '4. 投資經驗',
    },
    options: {
      horizon: {
        short: '短期（< 3 年）',
        medium: '中期（3-10 年）',
        long: '長期（10 年以上）',
      },
      risk: {
        conservative: '保守（最多 -10%）',
        moderate: '中等（最多 -20%）',
        aggressive: '積極（可接受 -30% 到 -50%）',
      },
      income: {
        high: '高（需要配息）',
        medium: '中（可有可無）',
        low: '低（不需要，重成長）',
      },
      experience: {
        beginner: '0-2 年（還在建立基本功）',
        intermediate: '3-7 年（經歷過景氣循環）',
        experienced: '8 年以上（可紀律執行）',
      },
    },
    labels: {
      maxDrawdown: '可接受跌幅',
      bonds: '債券 ETF',
      dividend: '高股息 ETF',
      equities: '股票 ETF',
      profileFit: '判斷依據',
      topMatch: '最符合',
      recommendedEtfs: '建議 ETF 清單',
      basedOnUniverse: '以下先以目前 52 檔 ETF 作為候選池',
      analysisTitle: '快速試算',
      sampleAmount: '試算金額',
      annualReturn: '估計年化報酬',
      projectedValueBase: '基準情境期末值',
      projectedValueBull: '樂觀情境期末值',
      projectedValueBear: '保守情境期末值',
      estimatedYield: '估計近12月股息殖利率',
      estimatedDividendYear: '估計年股息',
      estimatedDividendMonth: '估計月股息',
      lookthroughTitle: '穿透後風險摘要',
      top1Exposure: '前1大個股曝險',
      top5Exposure: '前5大個股曝險',
      hhi: '集中度（HHI）',
      topHoldings: '主要穿透持股',
      analysisLoading: '試算中...',
      analysisError: '目前無法載入試算結果。',
      warnings: '提示',
      analysisExpand: '展開',
      analysisCollapse: '收合',
      freeBadge: '免費',
      memberBadge: '會員',
      gatedFeaturesTitle: '會員功能',
      gatedLookthroughFull: '完整穿透清單（Top 50 + ETF 貢獻拆解）',
      gatedAdvancedSimulation: '進階試算（自訂假設與壓力測試）',
      gatedExport: 'CSV 匯出報告',
      trustTitle: '試算依據',
      trustHorizon: '期間',
      trustHorizonValue: '5 年',
      trustFormula: '公式',
      trustFormulaValue: 'Base = 加權年化報酬；Bull = Base + 2%；Bear = Base - 3%',
      trustSource: '報酬來源',
      trustSourceValue: '`etf_snapshots`：5Y 缺值回退至 3Y/1Y',
      trustAllocation: '本次ETF權重',
      trustCoverage: '資料覆蓋率',
      trustSummaryTitle: '摘要',
      trustSummaryFormula: '5年期間 / Base、Bull=Base+2%、Bear=Base-3%',
      algoTitle: '算法說明',
      algoHow: '先套用人格的三類資產權重，再把每類權重平均分配到該類 ETF 清單。',
      algoReturn: '估計年化報酬 = ETF 快照報酬加權年化（優先 5Y，缺值改 3Y/1Y）。',
      algoScenario: '情境期末值使用：基準利率 / 樂觀 = 基準 +2% / 保守 = 基準 -3%。',
      algoDividend: '估計股息使用近 12 個月（TTM）：ETF殖利率 = 過去12月股息 / 最新收盤價，再依ETF權重加權。',
      algoSeeTrust: 'ETF 權重請見上方「試算依據」。',
      allocationTitle: '本次試算使用的 ETF 權重',
      allocationNote: '此權重為人格快速試算的自動分配結果。',
      allocationBucketTemplate: '類別目標',
    },
    alerts: {
      beginnerHighRisk: '新手 + 積極風險：建議先用較小部位與分批進場，避免一次滿倉承擔波動。',
    },
    personas: {
      stability: {
        name: '穩健型（Stability Seeker）',
        summary: '我可以少賺，但不能大跌。',
        fit: '短到中期 + 低風險承受 + 高現金流需求。',
        drawdown: '約 -10%',
        quote: '先保本，再追求穩定現金流。',
      },
      balanced: {
        name: '平衡型（Balanced Builder）',
        summary: '穩穩長大，不要太刺激。',
        fit: '中到長期 + 中等風險承受 + 中等現金流需求。',
        drawdown: '約 -20%',
        quote: '兼顧成長與穩定。',
      },
      growth: {
        name: '成長型（Growth Maximizer）',
        summary: '波動沒關係，我要最大化長期報酬。',
        fit: '長期 + 高風險承受 + 低現金流需求。',
        drawdown: '約 -30% 到 -50%',
        quote: '擁抱波動換取長期放大。',
      },
    },
  },
  'zh-CN': {
    title: 'ETF 投资人格快速判断',
    dimensionsTitle: 'Step 1：先定义四个维度',
    recommendationTitle: '建议的 ETF 配置逻辑',
    disclaimer: '仅供教育用途，不构成投资建议。',
    dimensions: {
      horizon: '1. 投资时间',
      risk: '2. 风险承受',
      income: '3. 现金流需求',
      experience: '4. 投资经验',
    },
    options: {
      horizon: {
        short: '短期（< 3 年）',
        medium: '中期（3-10 年）',
        long: '长期（10 年以上）',
      },
      risk: {
        conservative: '保守（最多 -10%）',
        moderate: '中等（最多 -20%）',
        aggressive: '积极（可接受 -30% 到 -50%）',
      },
      income: {
        high: '高（需要分红）',
        medium: '中（可有可无）',
        low: '低（不需要，重成长）',
      },
      experience: {
        beginner: '0-2 年（还在建立基本功）',
        intermediate: '3-7 年（经历过景气周期）',
        experienced: '8 年以上（可纪律执行）',
      },
    },
    labels: {
      maxDrawdown: '可接受跌幅',
      bonds: '债券 ETF',
      dividend: '高股息 ETF',
      equities: '股票 ETF',
      profileFit: '判断依据',
      topMatch: '最符合',
      recommendedEtfs: '建议 ETF 清单',
      basedOnUniverse: '以下先以目前 52 只 ETF 作为候选池',
      analysisTitle: '快速试算',
      sampleAmount: '试算金额',
      annualReturn: '估计年化回报',
      projectedValueBase: '基准情景期末值',
      projectedValueBull: '乐观情景期末值',
      projectedValueBear: '保守情景期末值',
      estimatedYield: '估计近12月股息收益率',
      estimatedDividendYear: '估计年股息',
      estimatedDividendMonth: '估计月股息',
      lookthroughTitle: '穿透后风险摘要',
      top1Exposure: '前1大个股敞口',
      top5Exposure: '前5大个股敞口',
      hhi: '集中度（HHI）',
      topHoldings: '主要穿透持股',
      analysisLoading: '试算中...',
      analysisError: '当前无法加载试算结果。',
      warnings: '提示',
      analysisExpand: '展开',
      analysisCollapse: '收起',
      freeBadge: '免费',
      memberBadge: '会员',
      gatedFeaturesTitle: '会员功能',
      gatedLookthroughFull: '完整穿透清单（Top 50 + ETF 贡献拆解）',
      gatedAdvancedSimulation: '进阶试算（自定义假设与压力测试）',
      gatedExport: 'CSV 导出报告',
      trustTitle: '试算依据',
      trustHorizon: '期间',
      trustHorizonValue: '5 年',
      trustFormula: '公式',
      trustFormulaValue: 'Base = 加权年化回报；Bull = Base + 2%；Bear = Base - 3%',
      trustSource: '回报来源',
      trustSourceValue: '`etf_snapshots`：5Y 缺值回退至 3Y/1Y',
      trustAllocation: '本次ETF权重',
      trustCoverage: '数据覆盖率',
      trustSummaryTitle: '摘要',
      trustSummaryFormula: '5年期间 / Base、Bull=Base+2%、Bear=Base-3%',
      algoTitle: '算法说明',
      algoHow: '先套用人格的三类资产权重，再把每类权重平均分配到该类 ETF 清单。',
      algoReturn: '估计年化回报 = ETF 快照回报加权年化（优先 5Y，缺值改 3Y/1Y）。',
      algoScenario: '情景期末值使用：基准利率 / 乐观 = 基准 +2% / 保守 = 基准 -3%。',
      algoDividend: '估计股息使用近 12 个月（TTM）：ETF收益率 = 过去12月股息 / 最新收盘价，再按ETF权重加权。',
      algoSeeTrust: 'ETF 权重请见上方“试算依据”。',
      allocationTitle: '本次试算使用的 ETF 权重',
      allocationNote: '此权重为人格快速试算的自动分配结果。',
      allocationBucketTemplate: '类别目标',
    },
    alerts: {
      beginnerHighRisk: '新手 + 积极风险：建议先用较小仓位与分批进场，避免一次满仓承受波动。',
    },
    personas: {
      stability: {
        name: '稳健型（Stability Seeker）',
        summary: '我可以少赚，但不能大跌。',
        fit: '短到中期 + 低风险承受 + 高现金流需求。',
        drawdown: '约 -10%',
        quote: '先保本，再追求稳定现金流。',
      },
      balanced: {
        name: '平衡型（Balanced Builder）',
        summary: '稳稳长大，不要太刺激。',
        fit: '中到长期 + 中等风险承受 + 中等现金流需求。',
        drawdown: '约 -20%',
        quote: '兼顾成长与稳定。',
      },
      growth: {
        name: '成长型（Growth Maximizer）',
        summary: '波动没关系，我要最大化长期回报。',
        fit: '长期 + 高风险承受 + 低现金流需求。',
        drawdown: '约 -30% 到 -50%',
        quote: '拥抱波动换取长期放大。',
      },
    },
  },
}

function inferPersona(
  timeHorizon: TimeHorizon,
  riskTolerance: RiskTolerance,
  incomeNeed: IncomeNeed,
  experienceLevel: ExperienceLevel,
): Persona {
  const weightedScore =
    (TIME_SCORE[timeHorizon] +
      RISK_SCORE[riskTolerance] * 1.5 +
      INCOME_SCORE[incomeNeed] +
      EXPERIENCE_SCORE[experienceLevel] * 0.8) /
    4.3
  if (weightedScore <= 0.7) return 'stability'
  if (weightedScore >= 1.4) return 'growth'
  return 'balanced'
}

function getPersonaOrder(topPersona: Persona): Persona[] {
  const priorities = Object.keys(PERSONA_SCORE) as Persona[]
  return priorities.sort((a, b) => Math.abs(PERSONA_SCORE[a] - PERSONA_SCORE[topPersona]) - Math.abs(PERSONA_SCORE[b] - PERSONA_SCORE[topPersona]))
}

function getDrawdownTone(persona: Persona) {
  if (persona === 'stability') {
    return 'bg-[#e9f8ef] text-[#1f7a3d]'
  }
  if (persona === 'balanced') {
    return 'bg-[#fff7db] text-[#8a6100]'
  }
  return 'bg-[#ffe9e9] text-[#a12828]'
}

function buildApiAllocations(persona: Persona): AllocationInput[] {
  const buckets = PERSONA_ETF_RECOMMENDATIONS[persona]
  const weights = PERSONA_BUCKET_WEIGHTS[persona]
  const out = new Map<string, number>()

  const allocateBucket = (symbols: string[], bucketWeight: number) => {
    if (symbols.length === 0 || bucketWeight <= 0) return
    const base = bucketWeight / symbols.length
    symbols.forEach((symbol) => {
      out.set(symbol, (out.get(symbol) || 0) + base)
    })
  }

  allocateBucket(buckets.bonds, weights.bonds)
  allocateBucket(buckets.dividend, weights.dividend)
  allocateBucket(buckets.equities, weights.equities)

  return Array.from(out.entries()).map(([symbol, weight_pct]) => ({
    symbol,
    weight_pct: Number(weight_pct.toFixed(6)),
  }))
}

function alertText(language: Language, code: string) {
  const map: Record<Language, Record<string, string>> = {
    en: {
      single_stock_over_8pct: 'High single-stock concentration (>8%).',
      single_stock_over_5pct: 'Single-stock concentration warning (>5%).',
      top5_over_25pct: 'Top-5 concentration is high (>25%).',
    },
    'zh-TW': {
      single_stock_over_8pct: '單一個股集中度偏高（>8%）。',
      single_stock_over_5pct: '單一個股集中度偏高（>5%）。',
      top5_over_25pct: '前5大持股集中度偏高（>25%）。',
    },
    'zh-CN': {
      single_stock_over_8pct: '单一个股集中度偏高（>8%）。',
      single_stock_over_5pct: '单一个股集中度偏高（>5%）。',
      top5_over_25pct: '前5大持股集中度偏高（>25%）。',
    },
  }
  return map[language][code] || code
}

function OptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  const compactLabel = label.trim()
  const match = compactLabel.match(/^(.*?)(\s*[（(].*[)）])$/)
  const head = match ? match[1].trim() : compactLabel
  const tail = match ? match[2].trim() : null

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left text-sm font-medium transition sm:text-[0.93rem] ${
        active
          ? 'border-[#0f4a8a] bg-[#e8f2ff] text-[#0b2d55] shadow-[0_4px_14px_rgba(15,74,138,0.15)]'
          : 'border-[#c8d5e5] bg-white text-[#364d6a] hover:border-[#95aac3] hover:bg-[#f7fbff]'
      }`}
    >
      <span className="block">{head}</span>
      {tail ? <span className="mt-0.5 block">{tail}</span> : null}
    </button>
  )
}

export default function InvestmentPersonality() {
  const { language } = useLanguage()
  const t = TEXT[language]
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('medium')
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('moderate')
  const [incomeNeed, setIncomeNeed] = useState<IncomeNeed>('medium')
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('intermediate')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [simulation, setSimulation] = useState<SimulationData | null>(null)
  const [lookthrough, setLookthrough] = useState<LookthroughData | null>(null)
  const [featureAccess, setFeatureAccess] = useState<FeatureAccessData | null>(null)
  const [analysisOpen, setAnalysisOpen] = useState(true)

  const topPersona = useMemo(
    () => inferPersona(timeHorizon, riskTolerance, incomeNeed, experienceLevel),
    [timeHorizon, riskTolerance, incomeNeed, experienceLevel],
  )
  const personaOrder = useMemo(() => getPersonaOrder(topPersona), [topPersona])
  const showBeginnerHighRiskAlert = experienceLevel === 'beginner' && riskTolerance === 'aggressive'
  const analysisAllocations = useMemo(() => buildApiAllocations(topPersona), [topPersona])
  const pctFmt = useMemo(
    () =>
      new Intl.NumberFormat(language === 'en' ? 'en-US' : language, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [language],
  )
  const usdFmt = useMemo(
    () =>
      new Intl.NumberFormat(language === 'en' ? 'en-US' : language, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [language],
  )

  useEffect(() => {
    let cancelled = false
    async function loadFeatureAccess() {
      try {
        const resp = await fetch('/api/features/access')
        const json = await resp.json()
        if (!resp.ok) return
        if (!cancelled) {
          setFeatureAccess(json.data as FeatureAccessData)
        }
      } catch {
        // Keep default null and render conservative badges.
      }
    }
    loadFeatureAccess()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('etf.quick_sim.open')
      if (raw === '0') setAnalysisOpen(false)
      if (raw === '1') setAnalysisOpen(true)
    } catch {
      // Ignore storage read failures.
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('etf.quick_sim.open', analysisOpen ? '1' : '0')
    } catch {
      // Ignore storage write failures.
    }
  }, [analysisOpen])

  useEffect(() => {
    let cancelled = false
    const allocations = analysisAllocations

    async function run() {
      setAnalysisLoading(true)
      setAnalysisError(null)

      try {
        const [simResp, riskResp] = await Promise.all([
          fetch('/api/portfolio/simulate', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              amount: SAMPLE_AMOUNT_USD,
              horizon_years: 5,
              persona: topPersona,
              allocations,
            }),
          }),
          fetch('/api/portfolio/lookthrough', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              allocations,
              top_n: 10,
            }),
          }),
        ])

        const simJson = await simResp.json()
        const riskJson = await riskResp.json()

        if (!simResp.ok) {
          throw new Error(simJson?.error || 'simulation_failed')
        }
        if (!riskResp.ok) {
          throw new Error(riskJson?.error || 'lookthrough_failed')
        }

        if (!cancelled) {
          setSimulation(simJson.data as SimulationData)
          setLookthrough(riskJson.data as LookthroughData)
        }
      } catch {
        if (!cancelled) {
          setSimulation(null)
          setLookthrough(null)
          setAnalysisError(t.labels.analysisError)
        }
      } finally {
        if (!cancelled) {
          setAnalysisLoading(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [analysisAllocations, topPersona, t.labels.analysisError])

  return (
    <section className="mb-8 rounded-3xl border border-[#d6e0ea] bg-white/90 p-6 shadow-[0_8px_28px_rgba(15,39,71,0.10)] sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]">
        <div className="rounded-2xl border border-[#d7e1ec] bg-[#f9fbfe] p-4 sm:p-5">
          <h3 className="text-base font-semibold text-[#132844]">{t.dimensionsTitle}</h3>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-[#284568]">{t.dimensions.horizon}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <OptionButton
                  active={timeHorizon === 'short'}
                  label={t.options.horizon.short}
                  onClick={() => setTimeHorizon('short')}
                />
                <OptionButton
                  active={timeHorizon === 'medium'}
                  label={t.options.horizon.medium}
                  onClick={() => setTimeHorizon('medium')}
                />
                <OptionButton
                  active={timeHorizon === 'long'}
                  label={t.options.horizon.long}
                  onClick={() => setTimeHorizon('long')}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-[#284568]">{t.dimensions.risk}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <OptionButton
                  active={riskTolerance === 'conservative'}
                  label={t.options.risk.conservative}
                  onClick={() => setRiskTolerance('conservative')}
                />
                <OptionButton
                  active={riskTolerance === 'moderate'}
                  label={t.options.risk.moderate}
                  onClick={() => setRiskTolerance('moderate')}
                />
                <OptionButton
                  active={riskTolerance === 'aggressive'}
                  label={t.options.risk.aggressive}
                  onClick={() => setRiskTolerance('aggressive')}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-[#284568]">{t.dimensions.income}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <OptionButton
                  active={incomeNeed === 'high'}
                  label={t.options.income.high}
                  onClick={() => setIncomeNeed('high')}
                />
                <OptionButton
                  active={incomeNeed === 'medium'}
                  label={t.options.income.medium}
                  onClick={() => setIncomeNeed('medium')}
                />
                <OptionButton
                  active={incomeNeed === 'low'}
                  label={t.options.income.low}
                  onClick={() => setIncomeNeed('low')}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-[#284568]">{t.dimensions.experience}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <OptionButton
                  active={experienceLevel === 'beginner'}
                  label={t.options.experience.beginner}
                  onClick={() => setExperienceLevel('beginner')}
                />
                <OptionButton
                  active={experienceLevel === 'intermediate'}
                  label={t.options.experience.intermediate}
                  onClick={() => setExperienceLevel('intermediate')}
                />
                <OptionButton
                  active={experienceLevel === 'experienced'}
                  label={t.options.experience.experienced}
                  onClick={() => setExperienceLevel('experienced')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#d7e1ec] bg-[#f9fbfe] p-4 sm:p-5">
          <h3 className="text-base font-semibold text-[#132844]">{t.recommendationTitle}</h3>
          {showBeginnerHighRiskAlert ? (
            <p className="mt-4 rounded-xl border border-[#f2c14d] bg-[#fff8e3] px-3 py-2 text-xs font-medium text-[#7a5600] sm:text-sm">
              {t.alerts.beginnerHighRisk}
            </p>
          ) : null}
          <div className="mt-4 grid gap-3">
            {personaOrder.map((persona, index) => {
              const details = t.personas[persona]
              const allocation = PERSONA_ALLOCATIONS[persona]
              const recommendation = PERSONA_ETF_RECOMMENDATIONS[persona]
              const drawdownTone = getDrawdownTone(persona)
              const isTop = index === 0
              return (
                <article
                  key={persona}
                  className={`rounded-2xl border p-4 transition ${
                    isTop
                      ? 'border-[#5f8fc8] bg-[#eef5ff] shadow-[0_6px_20px_rgba(42,84,140,0.14)]'
                      : 'border-[#d5e0eb] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-[#14345b] sm:text-base">{details.name}</h4>
                      <p className="mt-1 text-xs text-[#5d7390] sm:text-sm">{details.summary}</p>
                    </div>
                    {isTop ? (
                      <span className="rounded-full bg-[#0f4a8a] px-2 py-1 text-[0.68rem] font-semibold text-white">{t.labels.topMatch}</span>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs font-medium text-[#2f537f]">
                    {t.labels.profileFit}: {details.fit}
                  </p>
                  <div className="mt-3 rounded-xl border border-[#d4e0ee] bg-[#f7fbff] p-3 text-xs text-[#2c4d79]">
                    <p className={`inline-flex rounded-lg px-2 py-1 ${drawdownTone}`}>
                      <span className="font-semibold">{t.labels.maxDrawdown}: </span>
                      <span className="ml-1">{details.drawdown}</span>
                    </p>
                    <p className="font-semibold text-[#183c68]">{t.labels.recommendedEtfs}</p>
                    <p className="mt-1 text-[11px] text-[#5a7392]">{t.labels.basedOnUniverse}</p>
                    <div className="mt-2 rounded-lg border border-[#d7e3f0] bg-white px-3 py-2">
                      {[
                        {
                          label: t.labels.bonds,
                          allocation: allocation.bonds,
                          symbols: recommendation.bonds,
                        },
                        {
                          label: t.labels.dividend,
                          allocation: allocation.dividend,
                          symbols: recommendation.dividend,
                        },
                        {
                          label: t.labels.equities,
                          allocation: allocation.equities,
                          symbols: recommendation.equities,
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          className="grid gap-1 border-b border-[#e2eaf3] py-2 last:border-b-0 last:pb-0 first:pt-0 sm:grid-cols-[140px_92px_1fr] sm:items-center"
                        >
                          <p className="font-semibold text-[#2a4b73]">{row.label}</p>
                          <p className="w-fit rounded-full bg-[#eaf2ff] px-2 py-0.5 font-semibold text-[#264c80]">
                            {row.allocation}
                          </p>
                          <p className="text-[#456488]">{row.symbols.join(', ')}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {isTop ? (
                    <div className="mt-3 rounded-xl border border-[#cfe0f5] bg-white p-3 text-xs text-[#2f4e77]">
                      <button
                        type="button"
                        onClick={() => setAnalysisOpen((prev) => !prev)}
                        aria-expanded={analysisOpen}
                        aria-controls="quick-sim-panel"
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <p className="font-semibold text-[#163a66]">{t.labels.analysisTitle}</p>
                        <span className="rounded-full border border-[#c4d7ee] bg-[#f3f8ff] px-2 py-0.5 text-[11px] font-semibold text-[#355b88]">
                          {analysisOpen ? t.labels.analysisCollapse : t.labels.analysisExpand}
                        </span>
                      </button>

                      {analysisOpen ? (
                        <div id="quick-sim-panel" className="mt-1">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded-full border border-[#b7d2f2] bg-[#edf5ff] px-2 py-0.5 text-[11px] font-semibold text-[#234f84]">
                              {t.labels.analysisTitle} · {t.labels.freeBadge}
                            </span>
                            <span className="rounded-full border border-[#b7d2f2] bg-[#edf5ff] px-2 py-0.5 text-[11px] font-semibold text-[#234f84]">
                              {t.labels.lookthroughTitle} Top 10 · {t.labels.freeBadge}
                            </span>
                            <span className="rounded-full border border-[#e6c9a3] bg-[#fff2e6] px-2 py-0.5 text-[11px] font-semibold text-[#8a4b1f]">
                              {t.labels.gatedFeaturesTitle} ·{' '}
                              {featureAccess?.plan === 'member' ? t.labels.freeBadge : t.labels.memberBadge}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#5a7392]">
                            {t.labels.sampleAmount}: {usdFmt.format(SAMPLE_AMOUNT_USD)}
                          </p>
                          <div className="mt-2 rounded-lg border border-[#d7e3f0] bg-[#f8fbff] px-3 py-2">
                            <p className="font-semibold text-[#1c3e68]">{t.labels.trustSummaryTitle}</p>
                            <p className="mt-1 text-[11px] text-[#4a678c]">
                              {t.labels.trustSummaryFormula} | {t.labels.trustCoverage}: return{' '}
                              {simulation?.warnings.some((x) => x.startsWith('return_coverage_partial')) ? 'partial' : 'ok'} / dividend{' '}
                              {simulation?.warnings.some((x) => x.startsWith('dividend_coverage_')) ? 'partial' : 'ok'} / holdings{' '}
                              {lookthrough?.warnings.some((x) => x.startsWith('holdings_coverage_partial')) ? 'partial' : 'ok'}
                            </p>
                          </div>

                          {analysisLoading ? (
                            <p className="mt-2 text-[#4c678b]">{t.labels.analysisLoading}</p>
                          ) : analysisError ? (
                            <p className="mt-2 rounded-lg border border-[#f2c7c7] bg-[#fff1f1] px-2 py-1 text-[#9d3030]">
                              {analysisError}
                            </p>
                          ) : simulation && lookthrough ? (
                            <>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <p className="rounded-lg bg-[#f3f8ff] px-2 py-1">
                              <span className="block text-[#5a7392]">{t.labels.annualReturn}</span>
                              <span className="font-semibold text-[#163a66]">
                                {pctFmt.format(simulation.weighted_baseline_annual_return_pct)}%
                              </span>
                            </p>
                            <p className="rounded-lg bg-[#f3f8ff] px-2 py-1">
                              <span className="block text-[#5a7392]">{t.labels.estimatedYield}</span>
                              <span className="font-semibold text-[#163a66]">
                                {simulation.estimated_dividend.portfolio_ttm_dividend_yield_pct == null
                                  ? 'N/A'
                                  : `${pctFmt.format(simulation.estimated_dividend.portfolio_ttm_dividend_yield_pct)}%`}
                              </span>
                            </p>
                            <p className="rounded-lg bg-[#f6fbf6] px-2 py-1">
                              <span className="block text-[#5a7392]">{t.labels.estimatedDividendYear}</span>
                              <span className="font-semibold text-[#1f6a3d]">
                                {simulation.estimated_dividend.estimated_annual_dividend_amount == null
                                  ? 'N/A'
                                  : usdFmt.format(simulation.estimated_dividend.estimated_annual_dividend_amount)}
                              </span>
                            </p>
                            <p className="rounded-lg bg-[#f6fbf6] px-2 py-1">
                              <span className="block text-[#5a7392]">{t.labels.estimatedDividendMonth}</span>
                              <span className="font-semibold text-[#1f6a3d]">
                                {simulation.estimated_dividend.estimated_monthly_dividend_amount == null
                                  ? 'N/A'
                                  : usdFmt.format(simulation.estimated_dividend.estimated_monthly_dividend_amount)}
                              </span>
                            </p>
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <p className="rounded-lg bg-[#fff8e7] px-2 py-1">
                              <span className="block text-[#82621c]">{t.labels.projectedValueBase}</span>
                              <span className="font-semibold text-[#6b4f16]">
                                {usdFmt.format(simulation.projection.base_end_value)}
                              </span>
                            </p>
                            <p className="rounded-lg bg-[#ecf8ef] px-2 py-1">
                              <span className="block text-[#23653c]">{t.labels.projectedValueBull}</span>
                              <span className="font-semibold text-[#1d5532]">
                                {usdFmt.format(simulation.projection.bull_end_value)}
                              </span>
                            </p>
                            <p className="rounded-lg bg-[#fff1f1] px-2 py-1">
                              <span className="block text-[#8b3a3a]">{t.labels.projectedValueBear}</span>
                              <span className="font-semibold text-[#7a2e2e]">
                                {usdFmt.format(simulation.projection.bear_end_value)}
                              </span>
                            </p>
                          </div>

                          <div className="mt-3 rounded-lg border border-[#d7e3f0] bg-[#f9fcff] px-3 py-2">
                            <p className="font-semibold text-[#183c68]">{t.labels.lookthroughTitle}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-3">
                              <p>
                                <span className="block text-[#5a7392]">{t.labels.top1Exposure}</span>
                                <span className="font-semibold">{pctFmt.format(lookthrough.risk_summary.top1_pct)}%</span>
                              </p>
                              <p>
                                <span className="block text-[#5a7392]">{t.labels.top5Exposure}</span>
                                <span className="font-semibold">{pctFmt.format(lookthrough.risk_summary.top5_pct)}%</span>
                              </p>
                              <p>
                                <span className="block text-[#5a7392]">{t.labels.hhi}</span>
                                <span className="font-semibold">{pctFmt.format(lookthrough.risk_summary.hhi)}</span>
                              </p>
                            </div>
                            {lookthrough.risk_summary.alerts.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {lookthrough.risk_summary.alerts.map((code) => (
                                  <span
                                    key={code}
                                    className="rounded-full border border-[#f0c2a2] bg-[#fff2e8] px-2 py-0.5 text-[11px] text-[#8a4c22]"
                                  >
                                    {alertText(language, code)}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <p className="mt-2 font-semibold text-[#2a4b73]">{t.labels.topHoldings}</p>
                            <div className="mt-1 space-y-1">
                              {lookthrough.top_stock_exposures.slice(0, 5).map((row) => (
                                <p key={`${row.holding_symbol || 'na'}-${row.holding_name || 'na'}`} className="text-[#456488]">
                                  {(row.holding_symbol || row.holding_name || 'N/A')}: {pctFmt.format(row.portfolio_exposure_pct)}%
                                </p>
                              ))}
                            </div>
                          </div>

                          {[...simulation.warnings, ...lookthrough.warnings].length > 0 ? (
                            <p className="mt-2 text-[11px] text-[#6c7f98]">
                              {t.labels.warnings}:{' '}
                              {[...simulation.warnings, ...lookthrough.warnings].join(' | ')}
                            </p>
                          ) : null}

                          <details className="mt-3 rounded-lg border border-[#d7e3f0] bg-[#f8fbff] px-3 py-2">
                            <summary className="cursor-pointer text-sm font-semibold text-[#1c3e68]">
                              {t.labels.algoTitle}
                            </summary>
                            <div className="mt-2 space-y-1 text-[11px] text-[#4a678c]">
                              <p>{t.labels.algoHow}</p>
                              <p>
                                <span className="font-semibold text-[#244a79]">{t.labels.trustHorizon}: </span>
                                {t.labels.trustHorizonValue}
                              </p>
                              <p>
                                <span className="font-semibold text-[#244a79]">{t.labels.trustFormula}: </span>
                                {t.labels.trustFormulaValue}
                              </p>
                              <p>{t.labels.algoReturn}</p>
                              <p>{t.labels.algoScenario}</p>
                              <p>{t.labels.algoDividend}</p>
                              <p>
                                <span className="font-semibold text-[#244a79]">{t.labels.trustSource}: </span>
                                {t.labels.trustSourceValue}
                              </p>
                              <p>
                                <span className="font-semibold text-[#244a79]">{t.labels.trustAllocation}: </span>
                                {t.labels.bonds} {PERSONA_BUCKET_WEIGHTS[topPersona].bonds}% / {t.labels.dividend}{' '}
                                {PERSONA_BUCKET_WEIGHTS[topPersona].dividend}% / {t.labels.equities}{' '}
                                {PERSONA_BUCKET_WEIGHTS[topPersona].equities}%
                              </p>
                            </div>
                            <div className="mt-2 rounded-lg border border-[#d7e3f0] bg-white px-2 py-2">
                              <p className="text-[11px] font-semibold text-[#244a79]">{t.labels.allocationTitle}</p>
                              <p className="text-[11px] text-[#5c7697]">{t.labels.allocationNote}</p>
                              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                                {analysisAllocations
                                  .slice()
                                  .sort((a, b) => b.weight_pct - a.weight_pct)
                                  .map((row) => (
                                    <p key={row.symbol} className="text-[11px] text-[#4a678c]">
                                      {row.symbol}: {pctFmt.format(row.weight_pct)}%
                                    </p>
                                  ))}
                              </div>
                              <p className="mt-2 text-[11px] text-[#5c7697]">
                                <span className="font-semibold text-[#244a79]">{t.labels.trustCoverage}: </span>
                                return {simulation?.warnings.some((x) => x.startsWith('return_coverage_partial')) ? 'partial' : 'ok'} | dividend{' '}
                                {simulation?.warnings.some((x) => x.startsWith('dividend_coverage_')) ? 'partial' : 'ok'} | holdings{' '}
                                {lookthrough?.warnings.some((x) => x.startsWith('holdings_coverage_partial')) ? 'partial' : 'ok'}
                              </p>
                            </div>
                          </details>

                          <div className="mt-3 rounded-lg border border-[#ecd7bf] bg-[#fff8f1] px-3 py-2">
                            <p className="font-semibold text-[#8a4b1f]">{t.labels.gatedFeaturesTitle}</p>
                            <ul className="mt-1 list-disc pl-4 text-[11px] text-[#8a5a33]">
                              <li>{t.labels.gatedLookthroughFull}</li>
                              <li>{t.labels.gatedAdvancedSimulation}</li>
                              <li>{t.labels.gatedExport}</li>
                            </ul>
                          </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <p className="mt-3 text-xs italic text-[#556d8b]">{details.quote}</p>
                </article>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-[#687e99]">{t.disclaimer}</p>
        </div>
      </div>
    </section>
  )
}
