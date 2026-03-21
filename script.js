// ── Config ────────────────────────────────────────────────
const TICKERS = ['SPY', 'VOO', 'IVV', 'SPLG'];

// Range key → Yahoo Finance API params
const RANGE_MAP = {
  max:   { range: 'max', interval: '1d' },
  '5y':  { range: '5y',  interval: '1d' },
  '3y':  { range: '3y',  interval: '1d' },
  '2y':  { range: '2y',  interval: '1d' },
  '1y':  { range: '1y',  interval: '1d' },
  ytd:   { range: 'ytd', interval: '1d' },
  mtd:   { range: '1mo', interval: '1d' },  // filtered client-side to MTD
  today: { range: '1d',  interval: '5m' },
};

const RANGE_LABELS = {
  max: 'Max', '5y': '5Y', '3y': '3Y', '2y': '2Y',
  '1y': '1Y', ytd: 'YTD', mtd: 'MTD', today: 'Today',
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
let activeTicker  = 'SPY';
let activeRange   = '2y';
let customFrom    = null;  // ISO string "YYYY-MM-DD" when in custom mode
let customTo      = null;
let chart         = null;

// ── Data Fetching ─────────────────────────────────────────
async function fetchPrices(ticker, rangeKey, fromDate, toDate) {
  let yahooUrl;
  if (fromDate && toDate) {
    // Custom date range — use period1/period2 unix timestamps
    const p1 = Math.floor(new Date(fromDate).getTime() / 1000);
    const p2 = Math.floor(new Date(toDate).getTime() / 1000) + 86400; // inclusive
    yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${p1}&period2=${p2}&interval=1d`;
  } else {
    const { range, interval } = RANGE_MAP[rangeKey];
    yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=${interval}`;
  }
  const url = 'https://corsproxy.io/?' + encodeURIComponent(yahooUrl);

  const res  = await fetch(url);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No data returned');

  const timestamps = result.timestamp;
  // Use adjusted close when available, fall back to close
  const rawPrices = result.indicators.adjclose?.[0]?.adjclose
                 ?? result.indicators.quote[0].close;

  let dates = [], prices = [];

  // For intraday (Today), format as HH:MM
  const isIntraday = interval === '5m';

  // MTD: filter to current month
  const now = new Date();
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

  timestamps.forEach((ts, i) => {
    if (rawPrices[i] == null) return;
    const d = new Date(ts * 1000);
    if (rangeKey === 'mtd' && d < mtdStart) return;

    const label = isIntraday
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      : d.toISOString().slice(0, 10);

    dates.push(label);
    prices.push(parseFloat(rawPrices[i].toFixed(2)));
  });

  // Graceful fallback: if Today returned empty intraday, fetch last daily close
  if (rangeKey === 'today' && dates.length === 0) {
    return fetchPrices(ticker, '1y').then(data => ({
      ...data,
      fallback: true,
    }));
  }

  if (dates.length === 0) throw new Error('No data for this range');

  const first = prices[0];
  const last  = prices[prices.length - 1];
  const ret   = ((last - first) / first * 100).toFixed(2);

  return {
    dates, prices,
    summary: {
      ticker,
      range:      fromDate && toDate ? 'Custom' : RANGE_LABELS[rangeKey],
      start:      dates[0],
      end:        dates[dates.length - 1],
      latest:     last,
      returnPct:  parseFloat(ret),
    },
  };
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
  // Deactivate range buttons when in custom mode
  document.querySelectorAll('#range-group .btn').forEach(b => {
    b.classList.toggle('active', !customFrom && b.dataset.range === activeRange);
  });

  try {
    const data = await fetchPrices(activeTicker, activeRange, customFrom, customTo);
    renderSummary(data.summary);
    renderChart(data.dates, data.prices, customFrom ? 'custom' : (data.fallback ? '1y' : activeRange));
  } catch (err) {
    document.getElementById('error').textContent = 'Failed to load data — ' + err.message;
    document.getElementById('error').hidden = false;
    ['s-ticker','s-range','s-start','s-end','s-price','s-return'].forEach(id => {
      document.getElementById(id).textContent = '—';
      document.getElementById(id).className   = 'stat-value';
    });
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
  // Clear custom date mode
  customFrom = null;
  customTo   = null;
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value   = '';
  fetchAndRender();
});

document.getElementById('apply-dates').addEventListener('click', () => {
  const from = document.getElementById('date-from').value;
  const to   = document.getElementById('date-to').value;
  if (!from || !to) return;
  if (from > to) {
    document.getElementById('error').textContent = 'Start date must be before end date.';
    document.getElementById('error').hidden = false;
    return;
  }
  customFrom = from;
  customTo   = to;
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
