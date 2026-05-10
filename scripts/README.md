# ETF Project Scripts

## Week 2: Manual Data Update

1) Activate venv

```bash
source ../venv/bin/activate
```

2) Single ETF test

```bash
python update_market_data.py --symbols VOO --period 1mo
```

3) Update all ETFs in etfs table

```bash
python update_market_data.py --all --period 1mo
```

4) Dry-run (fetch only, no DB writes)

```bash
python update_market_data.py --all --period 1mo --dry-run
```

Notes:
- Script reads Supabase credentials from `scripts/.env`.
- The script writes to: `etf_prices_daily`, `etf_dividends`, `etf_snapshots`, `job_logs`.
- Snapshot also stores `return_1y_pct`, `return_3y_pct`, `return_5y_pct`, `return_10y_pct` (computed from DB price history).
- If your DB does not have the required tables yet, run `week2_setup.sql` in Supabase SQL Editor.
- ETF holdings table setup is in `week3_holdings_setup.sql`.

## Week 5: GitHub Actions

- Daily: `.github/workflows/market-data-daily.yml` runs `--all --period 3mo`
- Weekly backfill: `.github/workflows/market-data-weekly-backfill.yml` runs `--all --period 10y`
- Weekly metadata refresh: same weekly workflow also runs `python update_etf_metadata.py --all`
- Weekly holdings refresh: same weekly workflow also runs `python update_etf_holdings.py --all`

## Metadata Update Script

Manual run:

```bash
python update_etf_metadata.py --all
```

Dry-run:

```bash
python update_etf_metadata.py --all --dry-run
```

Required GitHub repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Holdings Update Script

Manual run:

```bash
python update_etf_holdings.py --all
```

Dry-run:

```bash
python update_etf_holdings.py --all --dry-run
```

Custom symbols:

```bash
python update_etf_holdings.py --symbols VOO,SPY,QQQ
```

Custom snapshot date:

```bash
python update_etf_holdings.py --all --as-of-date 2026-04-10
```

## Week 6: User Feedback + Read Analytics

Before using feedback and read-stat features in `web`, run:

```sql
-- execute in Supabase SQL Editor
-- file: scripts/week6_feedback_analytics_setup.sql
```

This creates:
- `user_feedback`
- `user_read_events`

## Week 7: Feedback Workflow (Inbox)

To enable feedback status management (`new / in_progress / done`) for `/feedback`, run:

```sql
-- execute in Supabase SQL Editor
-- file: scripts/week7_feedback_workflow_setup.sql
```

## Week 9: Security Warning Hardening

If Security Advisor shows `RLS Policy Always True` warnings for feedback/read tables, run:

```sql
-- execute in Supabase SQL Editor
-- file: scripts/week9_security_policy_hardening.sql
```

This script:
- Removes permissive anonymous read/update policies
- Keeps anonymous insert only (for feedback submit and read-event tracking)
- Adds authenticated read/update policies (non-`true` expressions) for admin use

## Week 8: Security Advisor RLS Fix

If Security Advisor shows `RLS Disabled in Public` for ETF tables, run:

```sql
-- execute in Supabase SQL Editor
-- file: scripts/week8_rls_public_tables.sql
```

This script:
- Enables RLS on `etfs`, `etf_dividends`, `etf_snapshots`, `etf_prices_daily`, `etf_holdings`, `job_logs`
- Adds read-only policies for app-facing ETF tables (`anon` + `authenticated`)
- Keeps `job_logs` private (no public read policy)
