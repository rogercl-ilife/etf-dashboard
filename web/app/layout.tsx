import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/app/components/app-shell'
import { LanguageProvider } from '@/app/components/language-context'

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
          <AppShell>{children}</AppShell>
        </LanguageProvider>
      </body>
    </html>
  )
}
