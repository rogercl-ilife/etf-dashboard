# P0 Executable PRD (ETF Persona -> Allocation -> Risk Transparency)

Last updated: 2026-04-18
Owner: Product + Engineering
Status: Draft for approval

## 1) Scope and Goal

P0 goal: let users go from `persona` to an `actionable allocation` with transparent risk.

P0 includes 4 items:
1. Basic portfolio simulation
2. Look-through stock exposure for selected ETFs
3. Free vs member feature explanation (clear gate)
4. Unified allocation UI (weight + ETF symbols + exposure summary)

Out of scope for P0:
1. Rebalance notification automation (P1)
2. Full historical backtest engine
3. User brokerage sync

## 2) Existing Data Reuse

Use existing tables first:
1. `public.etfs` (ETF metadata)
2. `public.etf_snapshots` (1Y/3Y/5Y return fields)
3. `public.etf_holdings` (ETF holdings + weight_pct)

No hard dependency on new tables for core P0 calculation.

## 3) Item A - Basic Simulation (P0)

### PRD fields
1. Problem
Users see allocation percentages but cannot estimate expected return/risk.
2. User story
As a user, I want to input amount and ETF weights, and see projected outcomes under simple scenarios, including estimated yearly dividend.
3. Inputs
- `amount` (number > 0)
- `allocations[]`:
  - `symbol` (ETF ticker)
  - `weight_pct` (0-100, sum = 100)
- optional: `horizon_years` (default 5)
4. Outputs
- `expected_return_pct` (weighted by snapshot return baseline)
- `scenario_projection`:
  - `base`
  - `bull`
  - `bear`
- `est_drawdown_band` (`-10%`, `-20%`, `-30~-50%`) mapped from persona
- `estimated_dividend`:
  - `portfolio_ttm_dividend_yield_pct`
  - `estimated_annual_dividend_amount`
  - `estimated_monthly_dividend_amount` (annual / 12)
5. Business rules
- Reject if sum(weight_pct) != 100 (tolerance +-0.01)
- Use latest available `return_5y_pct` as baseline, fallback `return_3y_pct`, then `return_1y_pct`
- Annualized baseline simplified from selected period; if no snapshot returns then mark as insufficient
- Portfolio dividend formula:
  - per ETF `ttm_yield_pct = ttm_dividend_amount / latest_close * 100`
  - portfolio `weighted_ttm_yield_pct = sum(etf_weight_pct * etf_ttm_yield_pct / 100)`
  - `estimated_annual_dividend_amount = amount * weighted_ttm_yield_pct / 100`
- For missing dividend data: exclude that ETF from dividend calc and return warnings
- Educational disclaimer always shown

### API contract
Endpoint:
- `POST /api/portfolio/simulate`

Request:
```json
{
  "amount": 100000,
  "horizon_years": 5,
  "persona": "balanced",
  "allocations": [
    { "symbol": "BND", "weight_pct": 30 },
    { "symbol": "SCHD", "weight_pct": 10 },
    { "symbol": "VTI", "weight_pct": 60 }
  ]
}
```

Response:
```json
{
  "data": {
    "input_amount": 100000,
    "weighted_baseline_annual_return_pct": 6.3,
    "projection": {
      "base_end_value": 135747,
      "bull_end_value": 149220,
      "bear_end_value": 112908
    },
    "estimated_dividend": {
      "portfolio_ttm_dividend_yield_pct": 2.84,
      "estimated_annual_dividend_amount": 2840,
      "estimated_monthly_dividend_amount": 236.67
    },
    "assumptions": {
      "bull_alpha_pct": 2.0,
      "bear_alpha_pct": -3.0
    },
    "warnings": []
  }
}
```

Errors:
- `400` invalid weights/amount
- `422` insufficient snapshot coverage
- `500` data access failure

### Data tables
Read:
1. `public.etf_snapshots`
2. `public.etfs`
3. `public.etf_dividends`

Write (optional in P0, can skip first release):
1. `public.portfolio_simulations` (for analytics/cache)

Optional DDL:
```sql
create table if not exists public.portfolio_simulations (
  id bigint generated always as identity primary key,
  session_id text,
  persona text,
  amount numeric not null,
  horizon_years integer not null default 5,
  allocations_json jsonb not null,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_portfolio_simulations_created_at
  on public.portfolio_simulations(created_at desc);
```

### Acceptance criteria
1. Valid request returns projections within 500ms (excluding cold start).
2. Input validation catches bad weights and unknown symbols.
3. If >= 80% weight has return data, API returns result + warning for missing part.
4. If >= 70% weight has dividend data, API returns estimated dividend with warnings for uncovered part.
5. UI clearly shows assumptions and disclaimer.

### Dividend calculation details (P0)
1. Dividend window:
- use last 12 months (`TTM`) from `public.etf_dividends.ex_date`.
2. Per ETF:
- `ttm_dividend_amount = sum(amount where ex_date >= now() - 365 days)`
- `ttm_yield_pct = ttm_dividend_amount / latest_close * 100`
3. Portfolio:
- `portfolio_ttm_dividend_yield_pct = sum(weight_pct * ttm_yield_pct / 100)`
- `estimated_annual_dividend_amount = input_amount * portfolio_ttm_dividend_yield_pct / 100`
- `estimated_monthly_dividend_amount = estimated_annual_dividend_amount / 12`
4. Output wording:
- label as `estimated` and `TTM-based` (not guaranteed future payout)

## 4) Item B - Look-through Stock Exposure (P0)

### PRD fields
1. Problem
Users may unknowingly concentrate in the same mega-cap via multiple ETFs.
2. User story
As a user, I want to see top underlying stock exposures and overlap risk.
3. Inputs
- `allocations[]` (same as simulation)
- optional `top_n` (default 10, max 50)
4. Outputs
- `top_stock_exposures[]`
  - `holding_symbol`
  - `holding_name`
  - `portfolio_exposure_pct`
  - `contributing_etfs[]`
- `risk_summary`
  - `top1_pct`
  - `top5_pct`
  - `hhi`
  - `alerts[]`
5. Business rules
- Portfolio stock exposure formula:
  - `stock_exposure_pct = sum(etf_weight_pct * holding_weight_pct / 100)`
- Use latest `as_of_date` per ETF from `etf_holdings`
- If a selected ETF has no holdings, return warning and exclude from penetration math

### API contract
Endpoint:
- `POST /api/portfolio/lookthrough`

Request:
```json
{
  "allocations": [
    { "symbol": "VOO", "weight_pct": 50 },
    { "symbol": "QQQ", "weight_pct": 30 },
    { "symbol": "VXUS", "weight_pct": 20 }
  ],
  "top_n": 10
}
```

Response:
```json
{
  "data": {
    "top_stock_exposures": [
      {
        "holding_symbol": "AAPL",
        "holding_name": "Apple Inc",
        "portfolio_exposure_pct": 8.12,
        "contributing_etfs": [
          { "symbol": "VOO", "contribution_pct": 3.56 },
          { "symbol": "QQQ", "contribution_pct": 4.56 }
        ]
      }
    ],
    "risk_summary": {
      "top1_pct": 8.12,
      "top5_pct": 27.44,
      "hhi": 0.0421,
      "alerts": ["single_stock_over_8pct", "top5_over_25pct"]
    },
    "warnings": []
  }
}
```

Errors:
- `400` invalid weights
- `422` no holdings coverage
- `500` query failure

### Data tables
Read:
1. `public.etf_holdings`
2. `public.etfs`

Write:
1. none required for P0

### Acceptance criteria
1. Overlap from multiple ETFs merges into one stock line correctly.
2. Returned exposures are sorted desc and sum <= 100%.
3. Alert rules trigger deterministically:
   - `single_stock_over_5pct` warning
   - `single_stock_over_8pct` high risk
   - `top5_over_25pct` concentration warning
4. Handles mixed coverage (some ETF missing holdings) with warning.

## 5) Item C - Free/Member Explanation (P0)

### PRD fields
1. Problem
Users do not know what is free vs paid, causing drop-off.
2. User story
As a user, I want transparent feature access and upgrade reason at the moment of need.
3. Inputs
- `plan` (anon defaults to `free`)
4. Outputs
- `feature_access` map with `free | member`

### API contract
Endpoint:
- `GET /api/features/access`

Response:
```json
{
  "data": {
    "plan": "free",
    "features": {
      "basic_simulation": "free",
      "lookthrough_top10": "free",
      "lookthrough_full": "member",
      "advanced_simulation": "member",
      "export_csv": "member"
    }
  }
}
```

### Data tables
P0 option A (fastest): config in code (no table).

P0 option B (recommended if pricing changes often):
```sql
create table if not exists public.feature_access_rules (
  feature_key text primary key,
  required_plan text not null check (required_plan in ('free', 'member')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
```

### Acceptance criteria
1. UI shows free/member badges consistently across relevant modules.
2. Locked feature has clear CTA and no ambiguous state.
3. API and UI mapping are aligned (no mismatch keys).

## 6) Item D - Unified Allocation UI (P0)

### PRD fields
1. Problem
Allocation percentages and ETF symbol list are separated, increasing cognitive load.
2. User story
As a user, I want one aligned view per asset bucket: `type + weight + symbols + risk hint`.
3. Inputs
- persona result
- recommended ETF buckets
- simulation + look-through API response
4. Outputs
- single card section with aligned rows
- risk strip (top1/top5 exposure + alert chips)

### API dependency
1. `POST /api/portfolio/simulate`
2. `POST /api/portfolio/lookthrough`
3. `GET /api/features/access`

### Data tables
No new mandatory table.

### Acceptance criteria
1. Desktop: row alignment stable in 1280px+.
2. Mobile: readable at 360px without horizontal scroll.
3. User can finish full flow in <= 3 interactions after persona selection.

## 7) Non-Functional Requirements

1. API p95 latency target: < 700ms
2. Input schema validation at boundary (zod or equivalent)
3. All endpoints return deterministic error code + error message
4. No financial advice language; show educational disclaimer

## 8) Event Tracking (P0)

Track these events:
1. `persona_result_viewed`
2. `simulation_requested`
3. `simulation_completed`
4. `lookthrough_requested`
5. `lookthrough_completed`
6. `member_lock_viewed`
7. `upgrade_cta_clicked`

## 9) Delivery Plan (Small Steps)

Step 1 (this deliverable):
1. Finalize this PRD/API/schema/acceptance document.

Step 2:
1. Implement `POST /api/portfolio/simulate`.
2. Unit test for weight validation and missing snapshot fallback.

Step 3:
1. Implement `POST /api/portfolio/lookthrough`.
2. Unit test for overlap merge and alert thresholds.

Step 4:
1. Implement `GET /api/features/access` (code-config mode first).
2. Add free/member badges in UI.

Step 5:
1. Connect UI to new APIs in personality module.
2. Add risk summary strip and warnings.

Step 6:
1. Smoke test + build + docs update.

## 10) Implementation Status (As of 2026-04-18)

Completed:
1. `POST /api/portfolio/simulate` implemented and deployed.
2. `POST /api/portfolio/lookthrough` implemented and deployed.
3. `GET /api/features/access` implemented and deployed (code-config mode).
4. Personality UI integrated with simulation + look-through APIs.
5. Free/member badges and member-locked feature copy added to UI.
6. Production smoke checks completed for all new APIs and homepage rendering.

Implemented files:
1. `web/app/api/portfolio/simulate/route.ts`
2. `web/app/api/portfolio/lookthrough/route.ts`
3. `web/app/api/features/access/route.ts`
4. `web/app/components/investment-personality.tsx`

Known gaps (moved to next iteration):
1. No dedicated automated unit test files yet for new API calculation logic.
2. Member plan is currently static (`plan=free`) and not tied to auth/billing.
3. Event tracking hooks are not wired yet (`simulation_requested`, `lookthrough_requested`, etc.).
