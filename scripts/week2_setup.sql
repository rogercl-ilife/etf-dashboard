-- Week 2 schema alignment for ETF ingestion
-- Run in Supabase SQL Editor if your schema is not ready yet.

create table if not exists public.etf_prices_daily (
  symbol text not null,
  trade_date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric,
  volume bigint,
  created_at timestamptz not null default now(),
  primary key (symbol, trade_date)
);

create table if not exists public.etf_dividends (
  symbol text not null,
  ex_date date not null,
  pay_date date,
  amount numeric,
  created_at timestamptz not null default now(),
  primary key (symbol, ex_date)
);

create table if not exists public.etf_snapshots (
  symbol text primary key,
  latest_close numeric,
  change numeric,
  change_pct numeric,
  return_1y_pct numeric,
  return_3y_pct numeric,
  return_5y_pct numeric,
  return_10y_pct numeric,
  updated_at timestamptz not null default now()
);

alter table public.etf_snapshots add column if not exists return_1y_pct numeric;
alter table public.etf_snapshots add column if not exists return_3y_pct numeric;
alter table public.etf_snapshots add column if not exists return_5y_pct numeric;
alter table public.etf_snapshots add column if not exists return_10y_pct numeric;

create table if not exists public.job_logs (
  id bigint generated always as identity primary key,
  job_name text not null,
  status text not null,
  message text,
  created_at timestamptz not null default now()
);
