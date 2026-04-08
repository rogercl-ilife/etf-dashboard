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

PRICES_TABLE = "etf_prices_daily"
DIVIDENDS_TABLE = "etf_dividends"
SNAPSHOTS_TABLE = "etf_snapshots"
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


def to_int(value: Any) -> Optional[int]:
    f = to_float(value)
    if f is None:
        return None
    return int(f)


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


def build_prices(symbol: str, history_df: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if history_df is None or history_df.empty:
        return rows

    for idx, row in history_df.iterrows():
        trade_date = idx.date().isoformat()
        rows.append(
            {
                "symbol": symbol,
                "trade_date": trade_date,
                "open": to_float(row.get("Open")),
                "high": to_float(row.get("High")),
                "low": to_float(row.get("Low")),
                "close": to_float(row.get("Close")),
                "volume": to_int(row.get("Volume")),
            }
        )
    return rows


def build_dividends(symbol: str, history_df: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if history_df is None or history_df.empty or "Dividends" not in history_df.columns:
        return rows

    dividends = history_df[history_df["Dividends"] > 0]["Dividends"]
    if dividends is None or len(dividends) == 0:
        return rows

    for idx, amount in dividends.items():
        a = to_float(amount)
        if a is None:
            continue
        rows.append(
            {
                "symbol": symbol,
                "ex_date": idx.date().isoformat(),
                "amount": a,
            }
        )
    return rows


def build_snapshot(symbol: str, history_df: Any) -> Optional[Dict[str, Any]]:
    if history_df is None or history_df.empty:
        return None

    closes = history_df["Close"].dropna()
    if len(closes) == 0:
        return None

    latest_close = to_float(closes.iloc[-1])
    prev_close = to_float(closes.iloc[-2]) if len(closes) > 1 else None
    if latest_close is None:
        return None

    change = latest_close - prev_close if prev_close is not None else 0.0
    change_pct = (change / prev_close * 100.0) if prev_close not in (None, 0.0) else 0.0

    return {
        "symbol": symbol,
        "latest_close": latest_close,
        "change": change,
        "change_pct": change_pct,
        "updated_at": now_iso(),
    }


def upsert_rows(client: Client, table: str, rows: List[Dict[str, Any]], on_conflict: str) -> int:
    if not rows:
        return 0
    for batch in chunked(rows, size=500):
        client.table(table).upsert(batch, on_conflict=on_conflict).execute()
    return len(rows)


def run(symbols: List[str], period: str, dry_run: bool) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env")

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    job_name = "manual_etf_market_data_update"
    log_job(client, job_name, "running", f"start symbols={len(symbols)} period={period} dry_run={dry_run}")

    total_prices = 0
    total_dividends = 0
    total_snapshots = 0
    failed: List[str] = []

    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            history = ticker.history(period=period, auto_adjust=False, actions=True)
            prices = build_prices(symbol, history)
            dividends = build_dividends(symbol, history)
            snapshot = build_snapshot(symbol, history)

            if not dry_run:
                total_prices += upsert_rows(client, PRICES_TABLE, prices, "symbol,trade_date")
                total_dividends += upsert_rows(client, DIVIDENDS_TABLE, dividends, "symbol,ex_date")
                if snapshot:
                    total_snapshots += upsert_rows(client, SNAPSHOTS_TABLE, [snapshot], "symbol")

            print(
                f"[OK] {symbol} prices={len(prices)} dividends={len(dividends)} snapshot={1 if snapshot else 0}"
            )
        except Exception as exc:
            failed.append(symbol)
            print(f"[ERROR] {symbol} {exc}")

    final_status = "success" if not failed else "partial_failed"
    summary = (
        f"symbols={len(symbols)} prices={total_prices} dividends={total_dividends} "
        f"snapshots={total_snapshots} failed={len(failed)}"
    )
    if failed:
        summary += f" failed_symbols={','.join(failed)}"

    log_job(client, job_name, final_status, summary)
    print(summary)
    return 0 if not failed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Manual ETF market data updater (yfinance -> Supabase)")
    parser.add_argument("--symbols", type=str, default=None, help="CSV symbols. e.g. VOO,SPY,QQQ")
    parser.add_argument("--limit", type=int, default=50, help="Read first N symbols from etfs table")
    parser.add_argument("--all", action="store_true", help="Use all symbols from etfs table")
    parser.add_argument("--all-50", action="store_true", help="Shortcut: use first 50 symbols from etfs")
    parser.add_argument("--period", type=str, default="1mo", help="yfinance history period. e.g. 1mo,3mo,1y")
    parser.add_argument("--dry-run", action="store_true", help="Fetch only, do not write to DB")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env")

    limit: Optional[int] = None if args.all else (50 if args.all_50 else args.limit)
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    symbols = get_symbols(client, args.symbols, limit)
    if not symbols:
        print("No symbols found.")
        return 1

    print(f"Running update for {len(symbols)} symbol(s): {', '.join(symbols[:5])}{' ...' if len(symbols) > 5 else ''}")
    return run(symbols=symbols, period=args.period, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
