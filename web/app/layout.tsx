import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETF Dashboard",
  description: "ETF list and search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/10 bg-white/75 backdrop-blur-sm">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold tracking-[0.12em] text-slate-700">ETF DASHBOARD</p>
            <p className="text-xs text-slate-500">Next.js + Tailwind + Supabase</p>
          </div>
        </header>
        {children}
        <footer className="mt-10 border-t border-black/10 bg-white/50">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 text-xs text-slate-500 sm:px-6 lg:px-8">
            Week 4 milestone: ETF detail page with trend chart and dividend data.
          </div>
        </footer>
      </body>
    </html>
  );
}
