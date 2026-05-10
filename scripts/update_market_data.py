import argparse
import math
import os
from datetime import date, datetime, timedelta, timezone
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


def parse_iso_date(value: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(f"{value}T00:00:00+00:00")
    except ValueError:
        return None


def to_iso_date(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if hasattr(value, "date"):
        try:
            return value.date().isoformat()
        except Exception:
            pass
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            # Allow YYYY-MM-DD and datetime-like strings.
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            return None
    return None


def extract_pay_date_from_row(row: Any) -> Optional[str]:
    candidates = ["Pay Date", "pay_date", "Payment Date", "payment_date", "Dividend Date", "dividend_date"]
    for key in candidates:
        try:
            value = row.get(key)
        except Exception:
            value = None
        iso = to_iso_date(value)
        if iso:
            return iso
    return None


def calc_period_returns(
    rows: List[Dict[str, Any]],
    latest_price: Optional[float] = None,
    anchor_date: Optional[date] = None,
) -> Dict[str, Optional[float]]:
    clean_rows: List[Dict[str, Any]] = []
    for row in rows:
        close = to_float(row.get("close"))
        trade_date = row.get("trade_date")
        if close is None or not trade_date:
            continue
        date = parse_iso_date(str(trade_date))
        if date is None:
            continue
        clean_rows.append({"date": date, "close": close})

    if len(clean_rows) < 1:
        return {"1Y": None, "3Y": None, "5Y": None, "10Y": None}

    latest = clean_rows[-1]
    latest_close = latest_price if latest_price is not None else latest["close"]
    if latest_close is None or latest_close <= 0:
        return {"1Y": None, "3Y": None, "5Y": None, "10Y": None}

    if anchor_date is None:
        anchor_date = datetime.now(timezone.utc).date()
    result: Dict[str, Optional[float]] = {"1Y": None, "3Y": None, "5Y": None, "10Y": None}

    for period in ("1Y", "3Y", "5Y", "10Y"):
        years = int(period[:-1])
        target = datetime(anchor_date.year, anchor_date.month, anchor_date.day, tzinfo=timezone.utc)
        while True:
            try:
                target = target.replace(year=anchor_date.year - years)
                break
            except ValueError:
                target = target - timedelta(days=1)

        base = next((x for x in clean_rows if x["date"] >= target), None)
        if not base or base["close"] <= 0:
            result[period] = None
            continue

        result[period] = round(((latest_close / base["close"]) - 1.0) * 100.0, 4)

    return result


def build_return_rows(history_df: Any) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    if history_df is None or history_df.empty:
        return rows

    for idx, row in history_df.iterrows():
        trade_date = idx.date().isoformat()
        raw_close = to_float(row.get("Close"))
        if raw_close is None:
            continue
        rows.append({"trade_date": trade_date, "close": raw_close})
    return rows


def get_latest_market_price(ticker: Any, fallback_close: Optional[float]) -> Optional[float]:
    # yfinance fast_info may intermittently emit false "possibly delisted" warnings
    # (e.g. period=5d) for valid ETFs. Use fetched close as the stable source.
    return fallback_close


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

    dividend_rows = history_df[history_df["Dividends"] > 0]
    if dividend_rows is None or len(dividend_rows) == 0:
        return rows

    for idx, row in dividend_rows.iterrows():
        a = to_float(row.get("Dividends"))
        if a is None:
            continue
        rows.append(
            {
                "symbol": symbol,
                "ex_date": idx.date().isoformat(),
                "pay_date": extract_pay_date_from_row(row),
                "amount": a,
            }
        )
    return rows


def build_snapshot(
    symbol: str,
    history_df: Any,
    period_returns: Optional[Dict[str, Optional[float]]] = None,
    include_return_fields: bool = True,
) -> Optional[Dict[str, Any]]:
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

    row = {
        "symbol": symbol,
        "latest_close": latest_close,
        "change": change,
        "change_pct": change_pct,
        "updated_at": now_iso(),
    }
    if include_return_fields:
        row["return_1y_pct"] = (period_returns or {}).get("1Y")
        row["return_3y_pct"] = (period_returns or {}).get("3Y")
        row["return_5y_pct"] = (period_returns or {}).get("5Y")
        row["return_10y_pct"] = (period_returns or {}).get("10Y")
    return row


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
            returns_history = history
            if period != "10y":
                returns_history = ticker.history(period="10y", auto_adjust=False, actions=True)

            prices = build_prices(symbol, history)
            dividends = build_dividends(symbol, history)
            snapshot = build_snapshot(symbol, history)

            if not dry_run:
                total_prices += upsert_rows(client, PRICES_TABLE, prices, "symbol,trade_date")
                total_dividends += upsert_rows(client, DIVIDENDS_TABLE, dividends, "symbol,ex_date")

                return_rows = build_return_rows(returns_history)
                fallback_close = None
                if snapshot and snapshot.get("latest_close") is not None:
                    fallback_close = to_float(snapshot.get("latest_close"))
                latest_market_price = get_latest_market_price(ticker, fallback_close)
                period_returns = calc_period_returns(return_rows, latest_price=latest_market_price)
                snapshot = build_snapshot(symbol, history, period_returns=period_returns)
                if snapshot:
                    try:
                        total_snapshots += upsert_rows(client, SNAPSHOTS_TABLE, [snapshot], "symbol")
                    except Exception as exc:
                        if "return_" not in str(exc):
                            raise
                        fallback_snapshot = build_snapshot(
                            symbol,
                            history,
                            period_returns=None,
                            include_return_fields=False,
                        )
                        if fallback_snapshot:
                            total_snapshots += upsert_rows(client, SNAPSHOTS_TABLE, [fallback_snapshot], "symbol")

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
    parser.add_argument("--period", type=str, default="1mo", help="yfinance history period. e.g. 1mo,3mo,1y,5y,10y")
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
