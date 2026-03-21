# Stock Prices – SPY Viewer

A static web app that shows 2 years of SPY (S&P 500 ETF) adjusted close price and volume — hosted free on GitHub Pages.

**Live site:** https://redwoodmountain.github.io/stock-prices

---

## What This Does

Fetches 2 years of daily SPY price data from [Alpha Vantage](https://www.alphavantage.co) (free stock data API) and renders two interactive charts in the browser:

- **Line chart** — Adjusted closing price over time
- **Bar chart** — Daily trading volume

Plus a summary bar showing the ticker, date range, latest close, and 2-year return %.

---

## Setup

No setup needed. Just open the URL — it loads automatically.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| HTML/CSS/JS | Everything — no framework, no backend |
| Yahoo Finance | Free stock market data (via corsproxy.io) |
| [Chart.js](https://www.chartjs.org) | Interactive charts (loaded from CDN) |
| GitHub Pages | Free static site hosting |

---

## File Structure

```
stock-prices/
├── index.html   # App logic and charts
├── style.css    # Styling
└── README.md    # This file
```
