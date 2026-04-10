-- Week 3 schema for ETF holdings ingestion
-- Run in Supabase SQL Editor.

create table if not exists public.etf_holdings (
  symbol text not null,
  as_of_date date not null,
  rank integer not null,
  holding_symbol text,
  holding_name text,
  weight_pct numeric,
  source text not null default 'yfinance',
  updated_at timestamptz not null default now(),
  primary key (symbol, as_of_date, rank)
);

create index if not exists etf_holdings_symbol_asof_idx
  on public.etf_holdings(symbol, as_of_date desc);

create index if not exists etf_holdings_symbol_weight_idx
  on public.etf_holdings(symbol, weight_pct desc);
