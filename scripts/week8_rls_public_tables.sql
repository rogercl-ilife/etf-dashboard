-- Week 8: Security Advisor fix for "RLS Disabled in Public"
-- Run in Supabase SQL Editor.
--
-- This script enables RLS on public tables and adds read-only policies for app-facing tables.
-- Data writes remain handled by service_role (server/ETL), which bypasses RLS.

begin;

-- 1) Enable RLS on all reported tables
alter table if exists public.etfs enable row level security;
alter table if exists public.etf_dividends enable row level security;
alter table if exists public.etf_snapshots enable row level security;
alter table if exists public.etf_prices_daily enable row level security;
alter table if exists public.etf_holdings enable row level security;
alter table if exists public.job_logs enable row level security;

-- 2) Public read policies (anon + authenticated) for website/API queries

drop policy if exists "public_read_etfs" on public.etfs;
create policy "public_read_etfs"
  on public.etfs
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public_read_etf_dividends" on public.etf_dividends;
create policy "public_read_etf_dividends"
  on public.etf_dividends
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public_read_etf_snapshots" on public.etf_snapshots;
create policy "public_read_etf_snapshots"
  on public.etf_snapshots
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public_read_etf_prices_daily" on public.etf_prices_daily;
create policy "public_read_etf_prices_daily"
  on public.etf_prices_daily
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public_read_etf_holdings" on public.etf_holdings;
create policy "public_read_etf_holdings"
  on public.etf_holdings
  for select
  to anon, authenticated
  using (true);

-- 3) Keep job_logs private (no anon/authenticated policy)
-- Optional hardening if table-level grants were broad before.
revoke all on table public.job_logs from anon, authenticated;
grant select on table public.etfs, public.etf_dividends, public.etf_snapshots, public.etf_prices_daily, public.etf_holdings to anon, authenticated;

commit;
