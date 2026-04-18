# P0 Production Smoke Test Report

Date: 2026-04-18  
Environment: `production` (`https://etfpathfinder.com`)

## 1) Build Verification

Command:
```bash
npm run build
```

Result:
1. Success (Next.js build + TypeScript pass).
2. New routes detected:
   - `/api/portfolio/simulate`
   - `/api/portfolio/lookthrough`
   - `/api/features/access`

## 2) API Smoke Checks

### A. Feature Access API

Request:
```bash
curl -sS -X GET 'https://etfpathfinder.com/api/features/access'
```

Result:
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

Status: Pass

### B. Portfolio Simulate API

Request:
```bash
curl -sS -X POST 'https://etfpathfinder.com/api/portfolio/simulate' \
  -H 'content-type: application/json' \
  --data '{"amount":10000,"horizon_years":5,"persona":"balanced","allocations":[{"symbol":"BND","weight_pct":30},{"symbol":"SCHD","weight_pct":10},{"symbol":"VTI","weight_pct":60}]}'
```

Result highlights:
1. `weighted_baseline_annual_return_pct = 5.7373`
2. `base_end_value = 13217.24`
3. `estimated_annual_dividend_amount = 215.4`
4. `warnings = []`

Status: Pass

### C. Portfolio Look-through API

Request:
```bash
curl -sS -X POST 'https://etfpathfinder.com/api/portfolio/lookthrough' \
  -H 'content-type: application/json' \
  --data '{"allocations":[{"symbol":"VOO","weight_pct":50},{"symbol":"QQQ","weight_pct":30},{"symbol":"VXUS","weight_pct":20}],"top_n":10}'
```

Result highlights:
1. Top exposure: `NVDA 6.2563%`
2. `top5_pct = 21.6958`
3. `hhi = 0.0126`
4. `alerts = ["single_stock_over_5pct"]`

Status: Pass

## 3) UI Smoke Check

Request:
```bash
curl -sS -X GET 'https://etfpathfinder.com/'
```

Validated in returned HTML:
1. `Quick simulation`
2. `Look-through risk snapshot`
3. `Member features`
4. Combined allocation table rows (`Bond ETFs / Dividend ETFs / Equity ETFs` with percentages + symbols)

Status: Pass

## 4) Summary

All P0 implemented endpoints and key UI elements are live and responding in production on 2026-04-18.
