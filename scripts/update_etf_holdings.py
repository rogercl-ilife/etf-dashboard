import argparse
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import yfinance as yf
from dotenv import load_dotenv
from supabase import Client, create_client


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

HOLDINGS_TABLE = "etf_holdings"
JOB_LOGS_TABLE = "job_logs"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def chunked(items: List[Dict[str, Any]], size: int = 500) -> Iterable[List[Dict[str, Any]]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f):
        return None
    return f


def normalize_weight_pct(value: Any) -> Optional[float]:
    raw = to_float(value)
    if raw is None:
        return None
    # Some sources use 0.065 for 6.5%, others already use 6.5
    if 0 < raw <= 1:
        raw = raw * 100.0
    return round(raw, 6)


def log_job(client: Client, job_name: str, status: str, message: str) -> None:
    client.table(JOB_LOGS_TABLE).insert(
        {
            "job_name": job_name,
            "status": status,
            "message": message,
        }
    ).execute()


def get_symbols(client: Client, symbols_arg: Optional[str], limit: Optional[int]) -> List[str]:
    if symbols_arg:
        return [s.strip().upper() for s in symbols_arg.split(",") if s.strip()]

    query = client.table("etfs").select("symbol").order("symbol")
    if limit is not None:
        query = query.limit(limit)

    resp = query.execute()
    return [row["symbol"] for row in resp.data]


def ensure_holdings_table_ready(client: Client) -> None:
    try:
        client.table(HOLDINGS_TABLE).select("symbol").limit(1).execute()
    except Exception as exc:
        message = str(exc)
        if "PGRST205" in message or "Could not find the table" in message:
            raise RuntimeError(
                "Table public.etf_holdings does not exist. "
                "Please run scripts/week3_holdings_setup.sql in Supabase SQL Editor first."
            ) from exc
        raise


def _extract_by_keys(row: Dict[str, Any], keys: List[str]) -> Optional[str]:
    key_map = {str(k).strip().lower(): k for k in row.keys()}
    for key in keys:
        real_key = key_map.get(key.lower())
        if real_key is None:
            continue
        value = row.get(real_key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_weight(row: Dict[str, Any]) -> Optional[float]:
    preferred_keys = [
        "weight",
        "weight_pct",
        "holding percent",
        "holding_percent",
        "percent",
        "% assets",
        "%assets",
        "portfolio weight",
    ]
    key_map = {str(k).strip().lower(): k for k in row.keys()}
    for key in preferred_keys:
        real_key = key_map.get(key)
        if real_key is None:
            continue
        weight = normalize_weight_pct(row.get(real_key))
        if weight is not None:
            return weight
    for key in row.keys():
        weight = normalize_weight_pct(row.get(key))
        if weight is not None:
            return weight
    return None


def parse_holdings_frame(frame: Any, max_holdings: int) -> List[Dict[str, Any]]:
    if frame is None:
        return []
    try:
        if frame.empty:
            return []
    except Exception:
        return []

    results: List[Dict[str, Any]] = []
    for idx, row in frame.iterrows():
        as_dict: Dict[str, Any] = {}
        for col in frame.columns:
            as_dict[str(col)] = row.get(col)

        holding_symbol = _extract_by_keys(as_dict, ["symbol", "ticker", "holding_symbol", "stock_symbol"])
        holding_name = _extract_by_keys(as_dict, ["name", "holding", "holding_name", "security"])

        if not holding_name and isinstance(idx, str) and idx.strip():
            holding_name = idx.strip()
        if not holding_symbol and isinstance(idx, str) and idx.strip():
            maybe = idx.strip().upper()
            if " " not in maybe and len(maybe) <= 8 and maybe.replace(".", "").isalnum():
                holding_symbol = maybe

        weight_pct = _extract_weight(as_dict)
        if not holding_symbol and not holding_name:
            continue

        results.append(
            {
                "holding_symbol": holding_symbol,
                "holding_name": holding_name,
                "weight_pct": weight_pct,
            }
        )

    results.sort(
        key=lambda x: (x["weight_pct"] is None, -(x["weight_pct"] or 0.0), x["holding_name"] or "", x["holding_symbol"] or "")
    )
    return results[:max_holdings]


def fetch_holdings(symbol: str, max_holdings: int) -> List[Dict[str, Any]]:
    ticker = yf.Ticker(symbol)
    candidates: List[Any] = []

    funds_data = getattr(ticker, "funds_data", None)
    if funds_data is not None:
        candidates.append(getattr(funds_data, "top_holdings", None))

    candidates.append(getattr(ticker, "top_holdings", None))

    get_funds_data = getattr(ticker, "get_funds_data", None)
    if callable(get_funds_data):
        try:
            data = get_funds_data()
            candidates.append(getattr(data, "top_holdings", None))
        except Exception:
            pass

    for candidate in candidates:
        parsed = parse_holdings_frame(candidate, max_holdings=max_holdings)
        if parsed:
            return parsed

    return []


def build_rows(symbol: str, as_of_date: str, holdings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    now = now_iso()
    for rank, row in enumerate(holdings, start=1):
        rows.append(
            {
                "symbol": symbol,
                "as_of_date": as_of_date,
                "rank": rank,
                "holding_symbol": row.get("holding_symbol"),
                "holding_name": row.get("holding_name"),
                "weight_pct": row.get("weight_pct"),
                "source": "yfinance",
                "updated_at": now,
            }
        )
    return rows


def upsert_rows(client: Client, rows: List[Dict[str, Any]]) -> int:
    if not rows:
        return 0
    for batch in chunked(rows, size=500):
        client.table(HOLDINGS_TABLE).upsert(batch, on_conflict="symbol,as_of_date,rank").execute()
    return len(rows)


def run(symbols: List[str], as_of_date: str, max_holdings: int, dry_run: bool) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env")

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    ensure_holdings_table_ready(client)
    job_name = "manual_etf_holdings_update"
    log_job(
        client,
        job_name,
        "running",
        f"start symbols={len(symbols)} as_of_date={as_of_date} max_holdings={max_holdings} dry_run={dry_run}",
    )

    total_rows = 0
    failed: List[str] = []

    for symbol in symbols:
        try:
            holdings = fetch_holdings(symbol, max_holdings=max_holdings)
            rows = build_rows(symbol, as_of_date, holdings)

            if not dry_run:
                client.table(HOLDINGS_TABLE).delete().eq("symbol", symbol).eq("as_of_date", as_of_date).execute()
                total_rows += upsert_rows(client, rows)

            print(f"[OK] {symbol} holdings={len(rows)}")
        except Exception as exc:
            failed.append(symbol)
            print(f"[ERROR] {symbol} {exc}")

    final_status = "success" if not failed else "partial_failed"
    summary = f"symbols={len(symbols)} holdings_rows={total_rows} failed={len(failed)} as_of_date={as_of_date}"
    if failed:
        summary += f" failed_symbols={','.join(failed)}"

    log_job(client, job_name, final_status, summary)
    print(summary)
    return 0 if not failed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="ETF holdings updater (yfinance -> Supabase etf_holdings)")
    parser.add_argument("--symbols", type=str, default=None, help="CSV symbols. e.g. VOO,SPY,QQQ")
    parser.add_argument("--limit", type=int, default=50, help="Read first N symbols from etfs table")
    parser.add_argument("--all", action="store_true", help="Use all symbols from etfs table")
    parser.add_argument("--as-of-date", type=str, default=datetime.now(timezone.utc).date().isoformat(), help="Snapshot date (YYYY-MM-DD)")
    parser.add_argument("--max-holdings", type=int, default=50, help="Max holdings per ETF")
    parser.add_argument("--dry-run", action="store_true", help="Fetch only, do not write to DB")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env")

    try:
        datetime.fromisoformat(args.as_of_date)
    except ValueError as exc:
        raise RuntimeError("--as-of-date must be YYYY-MM-DD") from exc

    limit: Optional[int] = None if args.all else args.limit
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    symbols = get_symbols(client, args.symbols, limit)
    if not symbols:
        print("No symbols found.")
        return 1

    print(
        f"Running holdings update for {len(symbols)} symbol(s): "
        f"{', '.join(symbols[:5])}{' ...' if len(symbols) > 5 else ''}"
    )
    return run(
        symbols=symbols,
        as_of_date=args.as_of_date,
        max_holdings=max(1, args.max_holdings),
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    raise SystemExit(main())
