# MVP Smoke Test Checklist

## Scope
- Home page: `/`
- ETF detail page: `/etf/VOO` (or any symbol that has data)

## Preconditions
- `npm run dev` is running in `web/`
- API can read Supabase data
- Browser cache hard-refresh once before test

## Home Page (`/`)
- [ ] ETF list loads without runtime error
- [ ] "Last updated" is visible and has a timestamp (not empty)
- [ ] Search works: input `VOO` narrows result list
- [ ] Sorting works in table mode:
  - [ ] Click `Symbol` toggles asc/desc
  - [ ] Click `ER` toggles asc/desc
  - [ ] Click `3Y` toggles asc/desc
- [ ] Language switch works:
  - [ ] English copy updates
  - [ ] 繁體中文 copy updates
  - [ ] 简体中文 copy updates
- [ ] Empty-state wording is consistent for missing values (same "no data" term per language)

## Detail Page (`/etf/{symbol}`)
- [ ] Page loads without runtime error
- [ ] Latest price card shows "Last updated" timestamp
- [ ] Chart range buttons include `1M / 3M / 1Y / 3Y / 5Y`
- [ ] Switching range changes chart data (not static image)
- [ ] Dividends table renders `Ex Date` and `Amount` columns
- [ ] Holdings section:
  - [ ] Shows rows when holdings exist
  - [ ] Shows "no holdings data" message when empty
- [ ] Basic Info shows fallback text for missing fields using same per-language no-data wording

## Pass Criteria
- [ ] All checks pass in at least one desktop browser
- [ ] No console errors during the test flow
