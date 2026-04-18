'use client'

import { useMemo, useState } from 'react'
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

  const topPersona = useMemo(
    () => inferPersona(timeHorizon, riskTolerance, incomeNeed, experienceLevel),
    [timeHorizon, riskTolerance, incomeNeed, experienceLevel],
  )
  const personaOrder = useMemo(() => getPersonaOrder(topPersona), [topPersona])
  const showBeginnerHighRiskAlert = experienceLevel === 'beginner' && riskTolerance === 'aggressive'

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
