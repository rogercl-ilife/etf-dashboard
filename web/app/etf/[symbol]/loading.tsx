export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 h-8 w-36 animate-pulse rounded-full bg-slate-200" />
      <section className="space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-white" />
        <div className="h-72 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </section>
    </main>
  )
}
