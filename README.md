# SP500 Tracker

A static web app comparing three S&P 500 ETFs (SPY, VOO, IVV) across several timeframes — hosted free on GitHub Pages.

**Live site:** https://redwoodmountain.github.io/stock-prices

---

## What This Does

Renders an interactive price chart with a summary bar (date range, latest price, return %) for whichever ticker/timeframe button is selected.

Price data is fetched **server-side** by `fetch_data.py`, run on a schedule by a GitHub Actions workflow, and committed to `data/<TICKER>.json`. The page just reads those static JSON files — no live third-party API calls or CORS proxy in the browser, so it isn't dependent on some proxy service staying up.

Each ticker's JSON has three buckets:
- `daily` — 10 years of daily bars (Yahoo caps true daily granularity at ~20y; 10y comfortably covers every range button up to 5Y)
- `monthly` — full history at monthly granularity (Yahoo silently downgrades `range=max&interval=1d` to monthly anyway, so this is fetched explicitly for the "Max" button)
- `intraday` — 5-minute bars for the current trading day, for "Today"

`script.js` filters the `daily` bucket client-side by date cutoff for 5Y/3Y/2Y/1Y/YTD/MTD.

---

## Setup

No setup needed to view the site — just open the URL.

To run the data fetch locally: `python3 fetch_data.py` (stdlib only, no dependencies).

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| HTML/CSS/JS | Frontend — no framework |
| Python 3 (stdlib) | `fetch_data.py` — server-side data fetch |
| GitHub Actions | Runs `fetch_data.py` on a schedule, commits updated data |
| Yahoo Finance | Stock market data source (`query1.finance.yahoo.com`, called server-side) |
| [Chart.js](https://www.chartjs.org) | Interactive charts (loaded from CDN) |
| GitHub Pages | Free static site hosting |

---

## File Structure

```
stock-prices/
├── .github/workflows/update-data.yml  # Scheduled job: runs fetch_data.py, commits data/
├── fetch_data.py                      # Fetches Yahoo Finance data server-side
├── data/<TICKER>.json                 # Generated price data (committed by the workflow)
├── index.html                         # Markup
├── script.js                          # App logic and charts
├── style.css                          # Styling
└── README.md                          # This file
```
