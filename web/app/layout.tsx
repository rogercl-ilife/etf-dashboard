import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import AppShell from '@/app/components/app-shell'
import { LanguageProvider } from '@/app/components/language-context'
import FeedbackWidget from '@/app/components/feedback-widget'
import ReadTracker from '@/app/components/read-tracker'
import GA4Provider from '@/app/components/ga4-provider'
import { getSiteUrl } from '@/lib/site'

const siteUrl = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'ETF Dashboard | ETF 資料查詢與分析',
    template: '%s | ETF Dashboard',
  },
  description: 'ETF 即時清單、詳細資料、配息與歷史走勢查詢。',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'ETF Dashboard | ETF 資料查詢與分析',
    description: 'ETF 即時清單、詳細資料、配息與歷史走勢查詢。',
    url: siteUrl,
    siteName: 'ETF Dashboard',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ETF Dashboard | ETF 資料查詢與分析',
    description: 'ETF 即時清單、詳細資料、配息與歷史走勢查詢。',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <Suspense fallback={null}>
            <GA4Provider />
          </Suspense>
          <ReadTracker />
          <AppShell>{children}</AppShell>
          <FeedbackWidget />
        </LanguageProvider>
      </body>
    </html>
  )
}
