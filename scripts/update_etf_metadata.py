import argparse
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import yfinance as yf
from dotenv import load_dotenv
from supabase import Client, create_client


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
ETFS_TABLE = 'etfs'


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


def normalize_expense_ratio(value: Any) -> Optional[float]:
    raw = to_float(value)
    if raw is None:
        return None
    # yfinance often returns decimals (e.g. 0.0003). Store as percentage.
    return raw * 100 if raw <= 1 else raw


def parse_inception_date(value: Any) -> Optional[str]:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc).date().isoformat()
        except (OverflowError, OSError, ValueError):
            return None

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value).date().isoformat()
        except ValueError:
            return None

    return None


def get_symbols(client: Client, symbols_arg: Optional[str], limit: int) -> List[str]:
    if symbols_arg:
        return [s.strip().upper() for s in symbols_arg.split(',') if s.strip()]

    resp = client.table(ETFS_TABLE).select('symbol').order('symbol').limit(limit).execute()
    return [row['symbol'] for row in resp.data]


def pick_first(info: Dict[str, Any], keys: List[str]) -> Any:
    for key in keys:
        value = info.get(key)
        if value not in (None, ''):
            return value
    return None


def build_metadata(symbol: str, info: Dict[str, Any]) -> Dict[str, Any]:
    name = pick_first(info, ['longName', 'shortName', 'name'])
    issuer = pick_first(info, ['fundFamily', 'issuer', 'companyOfficers'])
    category = pick_first(info, ['category', 'fundCategory', 'quoteType'])
    expense_ratio = normalize_expense_ratio(
        pick_first(info, ['annualReportExpenseRatio', 'netExpenseRatio', 'expenseRatio'])
    )
    inception_date = parse_inception_date(
        pick_first(info, ['fundInceptionDate', 'inceptionDate'])
    )

    row: Dict[str, Any] = {'symbol': symbol}
    if isinstance(name, str):
        row['name'] = name.strip() or symbol
    if isinstance(issuer, str):
        row['issuer'] = issuer.strip() or None
    if isinstance(category, str):
        row['category'] = category.strip() or None
    if expense_ratio is not None:
        row['expense_ratio'] = round(expense_ratio, 4)
    if inception_date:
        row['inception_date'] = inception_date

    return row


def run(symbols: List[str], dry_run: bool, sleep_sec: float) -> int:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env')

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    success = 0
    failed: List[str] = []

    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info or {}
            payload = build_metadata(symbol, info)

            if not dry_run:
                client.table(ETFS_TABLE).upsert(payload, on_conflict='symbol').execute()

            success += 1
            print(
                f"[OK] {symbol} name={payload.get('name','N/A')} issuer={payload.get('issuer','N/A')} "
                f"category={payload.get('category','N/A')} expense_ratio={payload.get('expense_ratio','N/A')}"
            )
        except Exception as exc:
            failed.append(symbol)
            print(f'[ERROR] {symbol} {exc}')

        if sleep_sec > 0:
            time.sleep(sleep_sec)

    print(f'metadata_update success={success} failed={len(failed)}')
    if failed:
        print(f"failed_symbols={','.join(failed)}")

    return 0 if not failed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description='Update ETF metadata from yfinance to Supabase etfs table')
    parser.add_argument('--symbols', type=str, default=None, help='CSV symbols. e.g. VOO,SPY,QQQ')
    parser.add_argument('--limit', type=int, default=50, help='Read first N symbols from etfs table')
    parser.add_argument('--all-50', action='store_true', help='Shortcut: use first 50 symbols from etfs')
    parser.add_argument('--dry-run', action='store_true', help='Fetch only, do not write to DB')
    parser.add_argument('--sleep-sec', type=float, default=0.25, help='Sleep between symbols to reduce API pressure')
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in scripts/.env')

    limit = 50 if args.all_50 else args.limit
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    symbols = get_symbols(client, args.symbols, limit)

    if not symbols:
        print('No symbols found.')
        return 1

    print(f"Running metadata update for {len(symbols)} symbol(s)")
    return run(symbols=symbols, dry_run=args.dry_run, sleep_sec=max(0.0, args.sleep_sec))


if __name__ == '__main__':
    raise SystemExit(main())
