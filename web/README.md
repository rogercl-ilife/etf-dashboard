# ETF Dashboard (Web)

MVP for ETF list/detail experience with Next.js + Supabase, including analytics and feedback APIs.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # optional but recommended for server APIs
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX # optional
```

Notes:
- `NEXT_PUBLIC_SITE_URL` is used by SEO metadata, sitemap, and robots.
- If `SUPABASE_SERVICE_ROLE_KEY` is missing, server API falls back to anon key.

## Week 6 Deployment Checklist (Vercel + Production Supabase)

1. Push latest code to your git remote.
2. Import `web/` into Vercel as a Next.js project.
3. Set Vercel environment variables (Production/Preview):
   - `NEXT_PUBLIC_SITE_URL=https://<your-domain>`
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `NEXT_PUBLIC_GA_MEASUREMENT_ID=...` (optional)
4. In Supabase SQL Editor, run:
   - `scripts/week6_feedback_analytics_setup.sql`
   - `scripts/week7_feedback_workflow_setup.sql`
5. Deploy to Production from Vercel.
6. Verify:
   - `/sitemap.xml`
   - `/robots.txt`
   - Home page `/`
   - Detail page `/etf/VOO`
   - APIs `/api/etfs`, `/api/etfs/VOO`, `/api/etfs/VOO/chart?range=1Y`

## SEO Coverage

- Global metadata in `app/layout.tsx` (title template, description, Open Graph, Twitter, canonical).
- Dynamic detail-page metadata in `app/etf/[symbol]/page.tsx`.
- Sitemap in `app/sitemap.ts`.
- Robots in `app/robots.ts`.

## Build & Lint

```bash
npm run lint
npm run build
```
