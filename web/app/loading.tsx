export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <section className="animate-pulse space-y-4 rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="h-8 w-48 rounded bg-slate-200" />
        <div className="h-4 w-72 max-w-full rounded bg-slate-200" />
      </section>
    </main>
  )
}
