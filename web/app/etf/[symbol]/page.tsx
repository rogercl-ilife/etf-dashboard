import Link from 'next/link'
import EtfDetailClient from './etf-detail-client'

type PageProps = {
  params: Promise<{ symbol: string }>
}

export default async function EtfDetailPage({ params }: PageProps) {
  const { symbol } = await params
  const normalized = symbol.trim().toUpperCase()

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
        >
          Back to ETF List
        </Link>
      </div>

      <EtfDetailClient symbol={normalized} />
    </main>
  )
}
