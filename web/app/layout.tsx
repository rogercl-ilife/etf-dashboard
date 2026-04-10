import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/app/components/app-shell'
import { LanguageProvider } from '@/app/components/language-context'
import FeedbackWidget from '@/app/components/feedback-widget'
import ReadTracker from '@/app/components/read-tracker'
import GA4Provider from '@/app/components/ga4-provider'

export const metadata: Metadata = {
  title: 'ETF Dashboard',
  description: 'ETF list and search',
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
          <GA4Provider />
          <ReadTracker />
          <AppShell>{children}</AppShell>
          <FeedbackWidget />
        </LanguageProvider>
      </body>
    </html>
  )
}
