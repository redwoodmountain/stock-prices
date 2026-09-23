#!/usr/bin/env python3
"""Fetch daily and intraday price data from Yahoo Finance and write it to
data/<TICKER>.json for the static site to read directly.

Runs server-side (via GitHub Actions), so it isn't subject to browser CORS
restrictions and doesn't depend on a third-party CORS proxy staying alive.
"""
import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TICKERS = ["SPY", "VOO", "IVV", "SPLG"]
DATA_DIR = Path(__file__).resolve().parent / "data"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; stock-prices-bot/1.0)"}


def fetch_chart(ticker, range_, interval):
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?range={range_}&interval={interval}"
    )
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.load(resp)

    results = payload.get("chart", {}).get("result")
    if not results:
        return {"timestamp": [], "adjclose": []}

    result = results[0]
    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators", {})
    prices = (
        (indicators.get("adjclose") or [{}])[0].get("adjclose")
        or (indicators.get("quote") or [{}])[0].get("close")
        or []
    )
    prices = [round(p, 2) if p is not None else None for p in prices]
    return {"timestamp": timestamps, "adjclose": prices}


def main():
    DATA_DIR.mkdir(exist_ok=True)
    for ticker in TICKERS:
        try:
            # Yahoo silently downgrades range=max&interval=1d to monthly bars,
            # so fetch the two separately: 10y of true daily bars covers every
            # range button except "Max", which uses the monthly series.
            daily = fetch_chart(ticker, "10y", "1d")
            monthly = fetch_chart(ticker, "max", "1mo")
            intraday = fetch_chart(ticker, "1d", "5m")
        except urllib.error.URLError as exc:
            print(f"WARN: failed to fetch {ticker}: {exc}")
            continue

        out = {
            "ticker": ticker,
            "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "daily": daily,
            "monthly": monthly,
            "intraday": intraday,
        }
        out_path = DATA_DIR / f"{ticker}.json"
        out_path.write_text(json.dumps(out))
        print(
            f"Wrote {out_path} "
            f"({len(daily['timestamp'])} daily, {len(monthly['timestamp'])} monthly, "
            f"{len(intraday['timestamp'])} intraday points)"
        )


if __name__ == "__main__":
    main()
