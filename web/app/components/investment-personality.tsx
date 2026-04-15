'use client'

import { useMemo, useState } from 'react'
import { useLanguage, type Language } from '@/app/components/language-context'

type TimeHorizon = 'short' | 'medium' | 'long'
type RiskTolerance = 'conservative' | 'moderate' | 'aggressive'
type IncomeNeed = 'high' | 'medium' | 'low'
type Persona = 'stability' | 'balanced' | 'growth'

type PersonaAllocation = {
  bonds: string
  dividend: string
  equities: string
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

const TEXT: Record<
  Language,
  {
    badge: string
    title: string
    subtitle: string
    dimensionsTitle: string
    recommendationTitle: string
    disclaimer: string
    dimensions: {
      horizon: string
      risk: string
      income: string
    }
    options: {
      horizon: Record<TimeHorizon, string>
      risk: Record<RiskTolerance, string>
      income: Record<IncomeNeed, string>
    }
    labels: {
      maxDrawdown: string
      bonds: string
      dividend: string
      equities: string
      profileFit: string
      topMatch: string
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
    badge: 'Day 1-2: Decision Compression',
    title: 'ETF Persona Quick Guide',
    subtitle: 'Use 3 dimensions to compress complex choices into one practical starting allocation.',
    dimensionsTitle: 'Step 1: Define Your 3 Dimensions',
    recommendationTitle: 'Recommended Allocation Logic',
    disclaimer: 'For education only, not investment advice.',
    dimensions: {
      horizon: '1. Time Horizon',
      risk: '2. Risk Tolerance',
      income: '3. Income Need',
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
    },
    labels: {
      maxDrawdown: 'Accepted drawdown',
      bonds: 'Bond ETFs',
      dividend: 'Dividend ETFs',
      equities: 'Equity ETFs',
      profileFit: 'Why this profile fits',
      topMatch: 'Top Match',
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
    badge: 'Day 1-2：決策壓縮',
    title: 'ETF 投資人格快速判斷',
    subtitle: '用 3 個維度把複雜決策壓縮成可執行的起手配置。',
    dimensionsTitle: 'Step 1：先定義三個維度',
    recommendationTitle: '建議的 ETF 配置邏輯',
    disclaimer: '僅供教育用途，不構成投資建議。',
    dimensions: {
      horizon: '1. 投資時間',
      risk: '2. 風險承受',
      income: '3. 現金流需求',
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
    },
    labels: {
      maxDrawdown: '可接受跌幅',
      bonds: '債券 ETF',
      dividend: '高股息 ETF',
      equities: '股票 ETF',
      profileFit: '判斷依據',
      topMatch: '最符合',
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
    badge: 'Day 1-2：决策压缩',
    title: 'ETF 投资人格快速判断',
    subtitle: '用 3 个维度把复杂决策压缩成可执行的起手配置。',
    dimensionsTitle: 'Step 1：先定义三个维度',
    recommendationTitle: '建议的 ETF 配置逻辑',
    disclaimer: '仅供教育用途，不构成投资建议。',
    dimensions: {
      horizon: '1. 投资时间',
      risk: '2. 风险承受',
      income: '3. 现金流需求',
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
    },
    labels: {
      maxDrawdown: '可接受跌幅',
      bonds: '债券 ETF',
      dividend: '高股息 ETF',
      equities: '股票 ETF',
      profileFit: '判断依据',
      topMatch: '最符合',
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

function inferPersona(timeHorizon: TimeHorizon, riskTolerance: RiskTolerance, incomeNeed: IncomeNeed): Persona {
  const weightedScore = (TIME_SCORE[timeHorizon] + RISK_SCORE[riskTolerance] * 1.5 + INCOME_SCORE[incomeNeed]) / 3.5
  if (weightedScore <= 0.7) return 'stability'
  if (weightedScore >= 1.4) return 'growth'
  return 'balanced'
}

function getPersonaOrder(topPersona: Persona): Persona[] {
  const priorities = Object.keys(PERSONA_SCORE) as Persona[]
  return priorities.sort((a, b) => Math.abs(PERSONA_SCORE[a] - PERSONA_SCORE[topPersona]) - Math.abs(PERSONA_SCORE[b] - PERSONA_SCORE[topPersona]))
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
      {label}
    </button>
  )
}

export default function InvestmentPersonality() {
  const { language } = useLanguage()
  const t = TEXT[language]
  const [timeHorizon, setTimeHorizon] = useState<TimeHorizon>('medium')
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>('moderate')
  const [incomeNeed, setIncomeNeed] = useState<IncomeNeed>('medium')

  const topPersona = useMemo(
    () => inferPersona(timeHorizon, riskTolerance, incomeNeed),
    [timeHorizon, riskTolerance, incomeNeed],
  )
  const personaOrder = useMemo(() => getPersonaOrder(topPersona), [topPersona])

  return (
    <section className="mb-8 rounded-3xl border border-[#d6e0ea] bg-white/90 p-6 shadow-[0_8px_28px_rgba(15,39,71,0.10)] sm:p-8">
      <p className="inline-flex rounded-full border border-[#bfd0e6] bg-[#edf5ff] px-3 py-1 text-xs font-semibold text-[#2f4f76]">{t.badge}</p>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#0B1F3A] sm:text-3xl">{t.title}</h2>
      <p className="mt-2 text-sm text-[#5f7390] sm:text-base">{t.subtitle}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
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
          </div>
        </div>

        <div className="rounded-2xl border border-[#d7e1ec] bg-[#f9fbfe] p-4 sm:p-5">
          <h3 className="text-base font-semibold text-[#132844]">{t.recommendationTitle}</h3>
          <div className="mt-4 grid gap-3">
            {personaOrder.map((persona, index) => {
              const details = t.personas[persona]
              const allocation = PERSONA_ALLOCATIONS[persona]
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
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <p className="rounded-lg bg-[#f3f8ff] px-2 py-1 text-[#2c4d79]">
                      {t.labels.maxDrawdown}: {details.drawdown}
                    </p>
                    <p className="rounded-lg bg-[#f3f8ff] px-2 py-1 text-[#2c4d79]">
                      {t.labels.bonds}: {allocation.bonds}
                    </p>
                    <p className="rounded-lg bg-[#f3f8ff] px-2 py-1 text-[#2c4d79]">
                      {t.labels.dividend}: {allocation.dividend}
                    </p>
                    <p className="rounded-lg bg-[#f3f8ff] px-2 py-1 text-[#2c4d79]">
                      {t.labels.equities}: {allocation.equities}
                    </p>
                  </div>
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
