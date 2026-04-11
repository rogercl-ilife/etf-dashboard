import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { getSiteUrl } from '@/lib/site'

async function getEtfSymbols() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return [] as string[]
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey)
  const { data, error } = await supabase.from('etfs').select('symbol').order('symbol', { ascending: true }).limit(1000)

  if (error || !data) {
    return [] as string[]
  }

  return data
    .map((row) => (typeof row.symbol === 'string' ? row.symbol.trim().toUpperCase() : ''))
    .filter((symbol) => symbol.length > 0)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const symbols = await getEtfSymbols()
  const now = new Date()

  const baseRoutes: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'hourly',
      priority: 1,
    },
  ]

  const etfRoutes: MetadataRoute.Sitemap = symbols.map((symbol) => ({
    url: `${siteUrl}/etf/${symbol}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [...baseRoutes, ...etfRoutes]
}
