'use client'

import { useEffect, useState } from 'react'
import EtfList from '@/app/components/etf-list'
import InvestmentPersonality from '@/app/components/investment-personality'
import PortfolioBuilder from '@/app/components/portfolio-builder'
import { useLanguage, type Language } from '@/app/components/language-context'

const STORAGE_KEY = 'etf-home-section-state-v1'

function getInitialOpenState(): { portfolioOpen: boolean; personalityOpen: boolean; listOpen: boolean } {
  if (typeof window === 'undefined') {
    return { portfolioOpen: true, personalityOpen: true, listOpen: true }
  }

  const fallbackListOpen = window.innerWidth >= 640
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return { portfolioOpen: true, personalityOpen: true, listOpen: fallbackListOpen }
  }

  try {
    const parsed = JSON.parse(raw) as { portfolioOpen?: boolean; personalityOpen?: boolean; listOpen?: boolean }
    return {
      portfolioOpen: parsed.portfolioOpen ?? true,
      personalityOpen: parsed.personalityOpen ?? true,
      listOpen: parsed.listOpen ?? fallbackListOpen,
    }
  } catch {
    return { portfolioOpen: true, personalityOpen: true, listOpen: fallbackListOpen }
  }
}

const TEXT: Record<
  Language,
  {
    flowHint: string
    personality: {
      title: string
      summary: string
    }
    list: {
      title: string
      summary: string
    }
    portfolio: {
      title: string
      summary: string
    }
    toggle: {
      expand: string
      collapse: string
    }
  }
> = {
  en: {
    flowHint: 'Start with persona fit, then filter and compare ETFs.',
    personality: {
      title: 'ETF Persona Quick Guide',
      summary: 'Use 4 dimensions to find a practical starting allocation.',
    },
    list: {
      title: 'ETF Market Overview',
      summary: 'Filter and compare ETFs after selecting your persona.',
    },
    portfolio: {
      title: 'Portfolio Planner',
      summary: 'Select ETFs, set target weights, and view look-through risk.',
    },
    toggle: {
      expand: 'Expand',
      collapse: 'Collapse',
    },
  },
  'zh-TW': {
    flowHint: '先做人格判斷，再篩選與比較 ETF。',
    personality: {
      title: 'ETF 投資人格快速判斷',
      summary: '用 4 個維度找到可執行的起手配置。',
    },
    list: {
      title: 'ETF 市場總覽',
      summary: '先判斷人格，再篩選與比較 ETF。',
    },
    portfolio: {
      title: '投資組合規劃',
      summary: '勾選 ETF、設定權重，查看報酬與穿透風險。',
    },
    toggle: {
      expand: '展開',
      collapse: '收起',
    },
  },
  'zh-CN': {
    flowHint: '先做人格判断，再筛选与比较 ETF。',
    personality: {
      title: 'ETF 投资人格快速判断',
      summary: '用 4 个维度找到可执行的起手配置。',
    },
    list: {
      title: 'ETF 市场总览',
      summary: '先判断人格，再筛选与比较 ETF。',
    },
    portfolio: {
      title: '投资组合规划',
      summary: '勾选 ETF、设置权重，查看收益与穿透风险。',
    },
    toggle: {
      expand: '展开',
      collapse: '收起',
    },
  },
}

export default function Home() {
  const { language } = useLanguage()
  const t = TEXT[language]
  const [openState, setOpenState] = useState(getInitialOpenState)
  const portfolioOpen = openState.portfolioOpen
  const personalityOpen = openState.personalityOpen
  const listOpen = openState.listOpen

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        portfolioOpen,
        personalityOpen,
        listOpen,
      }),
    )
  }, [portfolioOpen, personalityOpen, listOpen])

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <p className="mb-4 px-1 text-xs font-medium text-[#5f7390] sm:text-sm">{t.flowHint}</p>

      <section className="mb-6 rounded-3xl border border-[#d6e0ea] bg-[#f9fbfe]/75 shadow-[0_6px_22px_rgba(15,39,71,0.08)]">
        <button
          type="button"
          onClick={() =>
            setOpenState((prev) => ({
              ...prev,
              portfolioOpen: !prev.portfolioOpen,
            }))
          }
          aria-expanded={portfolioOpen}
          aria-controls="portfolio-panel"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
        >
          <div>
            <p className="text-lg font-semibold text-[#0B1F3A] sm:text-xl">{t.portfolio.title}</p>
            <p className="text-xs text-[#627792] sm:text-sm">{t.portfolio.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#c6d3e2] bg-white px-3 py-1 text-xs font-semibold text-[#2a4466]">
              {portfolioOpen ? t.toggle.collapse : t.toggle.expand}
            </span>
            <span
              aria-hidden
              className={`text-lg leading-none text-[#38577d] transition-transform duration-200 ${portfolioOpen ? 'rotate-180' : ''}`}
            >
              ⌄
            </span>
          </div>
        </button>
        <div
          id="portfolio-panel"
          className={`grid transition-[grid-template-rows,opacity] duration-200 ${
            portfolioOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden px-2 pb-2 sm:px-3 sm:pb-3">
            <PortfolioBuilder />
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-3xl border border-[#d6e0ea] bg-[#f9fbfe]/75 shadow-[0_6px_22px_rgba(15,39,71,0.08)]">
        <button
          type="button"
          onClick={() =>
            setOpenState((prev) => ({
              ...prev,
              personalityOpen: !prev.personalityOpen,
            }))
          }
          aria-expanded={personalityOpen}
          aria-controls="personality-panel"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
        >
          <div>
            <p className="text-lg font-semibold text-[#0B1F3A] sm:text-xl">{t.personality.title}</p>
            <p className="text-xs text-[#627792] sm:text-sm">{t.personality.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#c6d3e2] bg-white px-3 py-1 text-xs font-semibold text-[#2a4466]">
              {personalityOpen ? t.toggle.collapse : t.toggle.expand}
            </span>
            <span
              aria-hidden
              className={`text-lg leading-none text-[#38577d] transition-transform duration-200 ${personalityOpen ? 'rotate-180' : ''}`}
            >
              ⌄
            </span>
          </div>
        </button>
        <div
          id="personality-panel"
          className={`grid transition-[grid-template-rows,opacity] duration-200 ${
            personalityOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden px-2 pb-2 sm:px-3 sm:pb-3">
            <InvestmentPersonality />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#d6e0ea] bg-[#f9fbfe]/75 shadow-[0_6px_22px_rgba(15,39,71,0.08)]">
        <button
          type="button"
          onClick={() =>
            setOpenState((prev) => ({
              ...prev,
              listOpen: !prev.listOpen,
            }))
          }
          aria-expanded={listOpen}
          aria-controls="etf-list-panel"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
        >
          <div>
            <p className="text-lg font-semibold text-[#0B1F3A] sm:text-xl">{t.list.title}</p>
            <p className="text-xs text-[#627792] sm:text-sm">{t.list.summary}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#c6d3e2] bg-white px-3 py-1 text-xs font-semibold text-[#2a4466]">
              {listOpen ? t.toggle.collapse : t.toggle.expand}
            </span>
            <span
              aria-hidden
              className={`text-lg leading-none text-[#38577d] transition-transform duration-200 ${listOpen ? 'rotate-180' : ''}`}
            >
              ⌄
            </span>
          </div>
        </button>
        <div
          id="etf-list-panel"
          className={`grid transition-[grid-template-rows,opacity] duration-200 ${
            listOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="min-h-0 overflow-hidden px-4 pb-4 sm:px-6 sm:pb-6">
            <EtfList />
          </div>
        </div>
      </section>
    </main>
  )
}
