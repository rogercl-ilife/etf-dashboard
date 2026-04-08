'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm sm:p-6">
        <p className="text-sm font-semibold">Something went wrong</p>
        <p className="mt-2 text-sm opacity-90">{error.message || 'Unexpected error'}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100"
        >
          Try again
        </button>
      </section>
    </main>
  )
}
