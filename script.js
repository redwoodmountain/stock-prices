// ── Config ────────────────────────────────────────────────
const TICKERS = ['SPY', 'VOO', 'IVV', 'SPLG'];

const RANGE_LABELS = {
  max: 'Max', '5y': '5Y', '3y': '3Y', '2y': '2Y',
  '1y': '1Y', ytd: 'YTD', mtd: 'MTD', today: 'Today',
};

// Range key → cutoff date relative to now (null = no cutoff, use all data)
const RANGE_CUTOFF = {
  max:   null,
  '5y':  now => new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()),
  '3y':  now => new Date(now.getFullYear() - 3, now.getMonth(), now.getDate()),
  '2y':  now => new Date(now.getFullYear() - 2, now.getMonth(), now.getDate()),
  '1y':  now => new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()),
  ytd:   now => new Date(now.getFullYear(), 0, 1),
  mtd:   now => new Date(now.getFullYear(), now.getMonth(), 1),
};

// ── Helpers ───────────────────────────────────────────────
function formatDate(isoStr) {
  // "2025-03-21" → "March 21st, 2025"
  if (!isoStr || isoStr.includes(':')) return isoStr; // skip intraday times
  const [year, month, day] = isoStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const suffix = (n => {
    if (n >= 11 && n <= 13) return 'th';
    return ['th','st','nd','rd'][n % 10] ?? 'th';
  })(day);
  const mon = d.toLocaleString('en-US', { month: 'long' });
  return `${mon} ${day}${suffix}, ${year}`;
}

// ── State ─────────────────────────────────────────────────
let activeTicker = 'SPY';
let activeRange  = '2y';
let chart        = null;

// ── Data Fetching ─────────────────────────────────────────
// Price data is fetched server-side (see fetch_data.py + the GitHub Actions
// workflow) and committed to data/<TICKER>.json, so the page just reads the
// static file — no third-party CORS proxy, no browser CORS restrictions.
const dataCache = {};

async function loadTickerData(ticker) {
  if (dataCache[ticker]) return dataCache[ticker];
  const res = await fetch(`data/${ticker}.json`);
  if (!res.ok) throw new Error(`Failed to load data for ${ticker}`);
  const json = await res.json();
  dataCache[ticker] = json;
  return json;
}

async function fetchPrices(ticker, rangeKey) {
  const data = await loadTickerData(ticker);
  const isIntraday = rangeKey === 'today';
  const source = isIntraday ? data.intraday
    : rangeKey === 'max'   ? data.monthly
    : data.daily;

  const timestamps = source?.timestamp;
  const rawPrices  = source?.adjclose;

  // Guard: if timestamps or prices are missing/empty, treat as no data
  if (!timestamps?.length || !rawPrices?.length) {
    return { empty: true };
  }

  let dates = [], prices = [];

  const now = new Date();
  const cutoffFn = RANGE_CUTOFF[rangeKey];
  const cutoff = cutoffFn ? cutoffFn(now) : null;

  timestamps.forEach((ts, i) => {
    if (rawPrices[i] == null) return;
    const d = new Date(ts * 1000);
    if (cutoff && d < cutoff) return;

    const label = isIntraday
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : d.toISOString().slice(0, 10);

    dates.push(label);
    prices.push(parseFloat(rawPrices[i].toFixed(2)));
  });

  if (dates.length === 0) return { empty: true };

  const first = prices[0];
  const last  = prices[prices.length - 1];
  const ret   = ((last - first) / first * 100).toFixed(2);

  return {
    dates, prices,
    summary: {
      ticker,
      range:      RANGE_LABELS[rangeKey],
      start:      dates[0],
      end:        dates[dates.length - 1],
      latest:     last,
      returnPct:  parseFloat(ret),
    },
  };
}

// ── Empty / Error State ────────────────────────────────────
function showEmpty() {
  if (chart) { chart.destroy(); chart = null; }
  document.getElementById('error').textContent = 'Data not yet available';
  document.getElementById('error').hidden = false;
  ['s-ticker','s-range','s-start','s-end','s-price','s-return'].forEach(id => {
    document.getElementById(id).textContent = '—';
    document.getElementById(id).className   = 'stat-value';
  });
}

// ── Summary Card ──────────────────────────────────────────
function setLoading() {
  ['s-ticker','s-range','s-start','s-end','s-price','s-return'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '···';
    el.className = 'stat-value loading';
  });
  document.getElementById('error').hidden = true;
}

function renderSummary({ ticker, range, start, end, latest, returnPct }) {
  const set = (id, text, cls = '') => {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className   = 'stat-value' + (cls ? ' ' + cls : '');
  };
  set('s-ticker', ticker);
  set('s-range',  range);
  set('s-start',  formatDate(start));
  set('s-end',    formatDate(end));
  set('s-price',  '$' + latest.toFixed(2));
  set('s-return',
    (returnPct >= 0 ? '+' : '') + returnPct + '%',
    returnPct >= 0 ? 'positive' : 'negative'
  );
}

// ── X-Axis Formatting ─────────────────────────────────────
function xAxisOptions(rangeKey) {
  if (rangeKey === 'custom') {
    return {
      ticks: {
        maxTicksLimit: 10,
        callback(val) {
          const lbl = this.getLabelForValue(val);
          if (!lbl || lbl.length < 7) return lbl;
          const [year, month] = lbl.split('-');
          const mon = new Date(+year, +month - 1).toLocaleString('en-US', { month: 'short' });
          return `${mon} '${year.slice(2)}`;
        },
      },
    };
  }
  if (rangeKey === 'today') {
    return { ticks: { maxTicksLimit: 8 } };
  }
  if (['mtd', '1y', '2y', '3y'].includes(rangeKey)) {
    return {
      ticks: {
        maxTicksLimit: 10,
        callback(val, i, ticks) {
          // labels are ISO dates YYYY-MM-DD
          const lbl = this.getLabelForValue(val);
          if (!lbl || lbl.length < 7) return lbl;
          const [year, month] = lbl.split('-');
          const mon = new Date(+year, +month - 1).toLocaleString('en-US', { month: 'short' });
          return `${mon} '${year.slice(2)}`;
        },
      },
    };
  }
  // 5y / max → year markers only
  return {
    ticks: {
      maxTicksLimit: 8,
      callback(val) {
        const lbl = this.getLabelForValue(val);
        return lbl ? lbl.slice(0, 4) : '';
      },
    },
  };
}

// ── Chart Rendering ───────────────────────────────────────
function renderChart(dates, prices, rangeKey) {
  if (chart) chart.destroy();

  const canvas = document.getElementById('chart');
  const ctx    = canvas.getContext('2d');

  // Subtle gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 350);
  grad.addColorStop(0,   'rgba(37,99,235,0.12)');
  grad.addColorStop(1,   'rgba(37,99,235,0)');

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        data:            prices,
        borderColor:     '#2563eb',
        backgroundColor: grad,
        borderWidth:     2,
        pointRadius:     0,
        fill:            true,
        tension:         0.3,
      }],
    },
    options: {
      responsive: true,
      animation:  { duration: 400 },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#111827',
          titleColor:      '#9ca3af',
          bodyColor:       '#f9fafb',
          padding:         10,
          callbacks: {
            label: ctx => ' $' + ctx.parsed.y.toFixed(2),
          },
        },
      },
      scales: {
        x: {
          grid:   { display: false },
          border: { display: false },
          ticks:  {
            color: '#9ca3af',
            font:  { size: 11 },
            maxRotation: 0,
            ...xAxisOptions(rangeKey).ticks,
          },
        },
        y: {
          position: 'right',
          grid:     { color: '#f3f4f6' },
          border:   { display: false },
          ticks: {
            color: '#9ca3af',
            font:  { size: 11 },
            callback: v => '$' + v,
          },
        },
      },
    },
  });
}

// ── Main Render Loop ──────────────────────────────────────
async function fetchAndRender() {
  setLoading();

  // Sync active button states
  document.querySelectorAll('#ticker-group .btn').forEach(b => {
    b.classList.toggle('active', b.dataset.ticker === activeTicker);
  });
  document.querySelectorAll('#range-group .btn').forEach(b => {
    b.classList.toggle('active', b.dataset.range === activeRange);
  });

  try {
    const data = await fetchPrices(activeTicker, activeRange);
    if (data.empty) {
      showEmpty();
      return;
    }
    renderSummary(data.summary);
    renderChart(data.dates, data.prices, activeRange);
  } catch (err) {
    console.error(err);
    showEmpty();
  }
}

// ── Event Listeners ───────────────────────────────────────
document.getElementById('ticker-group').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn || !btn.dataset.ticker) return;
  activeTicker = btn.dataset.ticker;
  fetchAndRender();
});

document.getElementById('range-group').addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn || !btn.dataset.range) return;
  activeRange = btn.dataset.range;
  fetchAndRender();
});

// ── Info Drawer ───────────────────────────────────────────
const drawer  = document.getElementById('drawer');
const overlay = document.getElementById('drawer-overlay');

function openDrawer() {
  drawer.classList.add('open');
  overlay.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  drawer.classList.remove('open');
  overlay.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
}

document.getElementById('info-btn').addEventListener('click', openDrawer);
document.getElementById('drawer-close').addEventListener('click', closeDrawer);
overlay.addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

// ── Init ──────────────────────────────────────────────────
fetchAndRender();
