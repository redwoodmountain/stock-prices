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

## Setup (First Visit)

1. Get a free API key at **alphavantage.co/support/#api-key** (just name + email, no credit card)
2. Open the site and paste your key when prompted
3. The key is saved in your browser — you'll only need to enter it once

**Free tier limit:** 25 API calls/day — more than enough for personal use.

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| HTML/CSS/JS | Everything — no framework, no backend |
| [Alpha Vantage](https://www.alphavantage.co) | Free stock market data API |
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
