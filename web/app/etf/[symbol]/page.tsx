import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import EtfDetailPageClient from './etf-detail-page-client'

type Params = {
  params: Promise<{ symbol: string }>
}

function getSymbol(rawSymbol: string) {
  return rawSymbol.trim().toUpperCase()
}

async function getEtfName(symbol: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.from('etfs').select('name').eq('symbol', symbol).maybeSingle()

  if (error || !data?.name) {
    return null
  }

  return String(data.name)
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { symbol: rawSymbol } = await params
  const symbol = getSymbol(rawSymbol)

  if (!symbol) {
    return {
      title: 'ETF Detail',
      description: 'ETF 詳細資訊頁。',
    }
  }

  const etfName = await getEtfName(symbol)
  const title = etfName ? `${symbol} - ${etfName}` : `${symbol} ETF Detail`
  const description = etfName
    ? `${symbol} (${etfName}) 的最新價格、配息、報酬與持股資訊。`
    : `${symbol} 的最新價格、配息、報酬與持股資訊。`

  return {
    title,
    description,
    alternates: {
      canonical: `/etf/${symbol}`,
    },
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/etf/${symbol}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function EtfDetailPage({ params }: Params) {
  const { symbol: rawSymbol } = await params
  const symbol = getSymbol(rawSymbol)

  return <EtfDetailPageClient symbol={symbol} />
}
