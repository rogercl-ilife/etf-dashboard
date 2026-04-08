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
- If your DB does not have the required tables yet, run `week2_setup.sql` in Supabase SQL Editor.

## Week 5: GitHub Actions

- Daily: `.github/workflows/market-data-daily.yml` runs `--all --period 3mo`
- Weekly backfill: `.github/workflows/market-data-weekly-backfill.yml` runs `--all --period 5y`
- Weekly metadata refresh: same weekly workflow also runs `python update_etf_metadata.py --all`

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
