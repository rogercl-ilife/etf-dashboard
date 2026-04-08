import EtfList from '@/app/components/etf-list'

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">WEEK 4</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">ETF List</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Search ETFs and open detail pages for trend charts, dividends, and basic profile data.
        </p>
      </section>
      <EtfList />
    </main>
  )
}
