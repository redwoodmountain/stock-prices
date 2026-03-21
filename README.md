# Stock Prices – SPY Viewer

A simple web app that runs on your own computer and shows you a visual history of the S&P 500 over the last two years.

---

## What This Does

**SPY** is an ETF (Exchange-Traded Fund) that tracks the S&P 500 — essentially a single stock you can buy that mirrors the performance of America's 500 largest companies. It's one of the most widely watched financial instruments in the world.

This app:
1. **Fetches** the last 2 years of SPY daily price data from Yahoo Finance (free, no account needed)
2. **Displays** that data in your browser as two interactive charts:
   - A **line chart** of the adjusted closing price over time — this is the price SPY ended each trading day at, adjusted for any stock splits or dividends
   - A **bar chart** of daily trading volume — how many shares were bought and sold each day
3. **Shows a summary** at the top with:
   - The ticker symbol (`SPY`)
   - The date range of the data
   - The most recent closing price
   - How much SPY has gained or lost over the 2-year period (as a percentage)

Everything runs locally on your machine — no data is sent anywhere, no account is required, and no paid APIs are used.

---

## How It Works (Under the Hood)

The app has two main parts:

### Backend (Python)
- **Flask** is a lightweight Python web framework — think of it as a tiny web server that runs on your computer
- When you open the app in your browser, Flask serves the webpage
- It also has an endpoint (`/api/spy`) that fetches the stock data using **yfinance** (a free Python library that pulls data from Yahoo Finance), packages it as JSON, and sends it to the browser

### Frontend (Browser)
- A single HTML page fetches the data from the backend and renders it using **Chart.js**, a free JavaScript charting library
- The charts are interactive — you can hover over them to see exact values

### File Structure
```
stock-prices/
├── app.py               # The Python backend (Flask server + data fetching)
├── templates/
│   └── index.html       # The webpage your browser loads
├── static/
│   └── style.css        # Visual styling (colors, layout, fonts)
├── requirements.txt     # List of Python libraries this app needs
└── README.md            # This file
```

---

## Setup & Running

### Prerequisites
- Python 3 installed on your computer
- pip (Python's package installer — usually comes with Python)

### Steps

**1. Install the required libraries** (one-time setup):
```bash
pip install -r requirements.txt
```
This installs Flask (the web server), yfinance (stock data), and pandas (data processing).

**2. Start the app:**
```bash
python app.py
```

**3. Open your browser and go to:**
```
http://127.0.0.1:5000
```

The page will load, fetch the latest SPY data from Yahoo Finance, and display the charts. It takes a few seconds on first load while the data is being downloaded.

---

## Troubleshooting

- **"No data returned"** — check your internet connection; the app needs to reach Yahoo Finance
- **Port already in use** — another program is using port 5000; you can change the port in `app.py` by editing `app.run(port=5001)`
- **Charts not loading** — make sure you're connected to the internet so Chart.js can load from its CDN

---

## Technologies Used

| Tool | What It Does | Cost |
|------|-------------|------|
| [Python](https://python.org) | Programming language for the backend | Free |
| [Flask](https://flask.palletsprojects.com) | Lightweight web server | Free |
| [yfinance](https://github.com/ranaroussi/yfinance) | Pulls stock data from Yahoo Finance | Free |
| [pandas](https://pandas.pydata.org) | Cleans and processes the data | Free |
| [Chart.js](https://www.chartjs.org) | Renders the interactive charts in the browser | Free |
| Yahoo Finance | Source of the historical stock data | Free |
