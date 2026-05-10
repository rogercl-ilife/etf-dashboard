# etf-dashboard

## Week 5 Automation

Two GitHub Actions workflows are included:

- `.github/workflows/market-data-daily.yml`
- `.github/workflows/market-data-weekly-backfill.yml`

The weekly workflow includes both:
- 10Y market data backfill
- ETF metadata refresh (`update_etf_metadata.py`)
All workflows now run full symbol coverage from `etfs` (no 50-symbol cap).

### GitHub Secrets

Set these repository secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Schedules (UTC)

- Daily update: `01:10 UTC` (`10 1 * * *`)
- Weekly backfill: `02:40 UTC` every Sunday (`40 2 * * 0`)

Both workflows also support manual trigger via `workflow_dispatch`.
