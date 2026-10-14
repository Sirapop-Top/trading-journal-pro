/**
 * AlphaTrader — Rebalance Engine
 * ------------------------------------------------
 * Pure functions for portfolio rebalancing calculations.
 * Supports:
 *   - Long assets and Inverse ETFs
 *   - Short 1x synthetic (USD-margined, collateral = notional at entry)
 *     Asset name ends with ":S1X" or type is "Crypto Short 1x"
 *     Price is taken from underlying ticker (e.g. BTC-USD:S1X -> BTC-USD)
 *     Unit value = Math.max(0, 2 * entryPrice - currentPrice)
 *   - Flexible 3-tier fee system (Default, Per-Pair, Per-Trade Override)
 *   - Trigger modes: Drift, Schedule (month-end safe), Manual
 */

export const SHORT_SUFFIX = ':S1X';
export const SHORT_TYPE = 'Crypto Short 1x';
export const EPS = 1e-9;

export const DEFAULT_FEES = {
  'Thai Stock': { mode: 'percent', value: 0.157 },
  'Global Stock': { mode: 'fixed', value: 1.0 },
  'Crypto': { mode: 'percent', value: 0.1 },
  'Crypto Short 1x': { mode: 'percent', value: 0.05 },
};

export function isShort(assetName, assetType) {
  return assetType === SHORT_TYPE || String(assetName || '').toUpperCase().endsWith(SHORT_SUFFIX);
}

export function underlyingOf(assetName) {
  const s = String(assetName || '');
  return s.toUpperCase().endsWith(SHORT_SUFFIX) ? s.slice(0, -SHORT_SUFFIX.length) : s;
}

export function fxOf(ccy, rates) {
  if (!ccy || ccy === 'THB') return 1;
  return (rates && rates[ccy]) || 1;
}

export function priceOf(assetName, prices) {
  const p = prices ? prices[underlyingOf(assetName)] : undefined;
  return typeof p === 'number' && isFinite(p) ? p : null;
}

export function sortTrades(trades) {
  return (trades || []).slice().sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.seq || parseInt(a.id, 10) || 0) - (b.seq || parseInt(b.id, 10) || 0);
  });
}

/**
 * Build holdings with WAC. Returns { [assetName]: holding }.
 * holding = { assetName, assetType, currency, short, qty, costBasis (incl. buy fees),
 *             entryNotional (qty*price, excl. fees), realized (local ccy) }
 */
export function computeHoldings(trades, portfolio) {
  const map = {};
  const list = (trades || []).filter(t => !portfolio || t.portfolio === portfolio);
  sortTrades(list).forEach(t => {
    const key = t.assetName;
    let h = map[key];
    if (!h) {
      h = map[key] = {
        assetName: key,
        assetType: t.assetType,
        currency: t.currency,
        short: isShort(t.assetName, t.assetType),
        qty: 0,
        costBasis: 0,
        entryNotional: 0,
        realized: 0
      };
    }
    const q = Number(t.quantity) || 0;
    const p = Number(t.priceUnit) || 0;
    const f = Number(t.feeAmount) || 0;

    if (String(t.action).toLowerCase() === 'buy') {
      // Long: buy units. Short 1x: open/increase short, collateral = q*p.
      h.qty += q;
      h.costBasis += q * p + f;
      h.entryNotional += q * p;
    } else {
      // Long: sell units. Short 1x: cover (close) part of the short.
      if (h.qty <= EPS) return;
      const sq = Math.min(q, h.qty);
      const ratio = sq / h.qty;
      const costPortion = h.costBasis * ratio;
      const entryPortion = h.entryNotional * ratio;
      const gross = h.short ? Math.max(0, 2 * entryPortion - sq * p) : sq * p;
      h.realized += (gross - f) - costPortion;
      h.qty -= sq;
      h.costBasis -= costPortion;
      h.entryNotional -= entryPortion;
      if (h.qty < EPS) {
        h.qty = 0;
        h.costBasis = 0;
        h.entryNotional = 0;
      }
    }
  });
  return map;
}

/** Average entry price (excl. fees) — used for short valuation. */
export function entryPrice(h) {
  return h && h.qty > EPS ? h.entryNotional / h.qty : 0;
}

/** WAC incl. fees — what the real app displays as "Avg cost". */
export function wac(h) {
  return h && h.qty > EPS ? h.costBasis / h.qty : 0;
}

/** Value of ONE unit in local currency at current price. */
export function unitValue(h, price) {
  if (price === null || price === undefined) return 0;
  if (!h || !h.short) return price;
  const e = entryPrice(h);
  if (e <= 0) return price; // no open short yet -> opening cost per unit = price
  return Math.max(0, 2 * e - price);
}

export function valueLocal(h, price) {
  return h ? h.qty * unitValue(h, price) : 0;
}

export function emptyHolding(assetName, assetType, currency) {
  return {
    assetName,
    assetType,
    currency,
    short: isShort(assetName, assetType),
    qty: 0,
    costBasis: 0,
    entryNotional: 0,
    realized: 0
  };
}

/**
 * Current state of a pair (values in THB).
 */
export function computePairState(pair, trades, prices, rates) {
  const holdings = computeHoldings(trades, pair.portfolio);
  const hA = holdings[pair.assetA] || emptyHolding(pair.assetA, pair.assetAType, pair.assetACurrency);
  const hB = holdings[pair.assetB] || emptyHolding(pair.assetB, pair.assetBType, pair.assetBCurrency);
  const pA = priceOf(pair.assetA, prices);
  const pB = priceOf(pair.assetB, prices);
  const fxA = fxOf(pair.assetACurrency, rates);
  const fxB = fxOf(pair.assetBCurrency, rates);
  const valueA = valueLocal(hA, pA) * fxA;
  const valueB = valueLocal(hB, pB) * fxB;
  const total = valueA + valueB;
  const pctA = total > 0 ? (valueA / total) * 100 : 0;
  return {
    hA,
    hB,
    priceA: pA,
    priceB: pB,
    fxA,
    fxB,
    valueA,
    valueB,
    total,
    pctA,
    pctB: total > 0 ? 100 - pctA : 0,
    drift: total > 0 ? pctA - Number(pair.targetA) : 0,
    missingPrice: pA === null || pB === null
  };
}

// ---------------- Quantity rounding ----------------
export function floorTo(q, decimals) {
  const m = Math.pow(10, decimals);
  return Math.floor(q * m + EPS) / m;
}

export function roundQty(assetType, qty) {
  if (!(qty > 0)) return 0;
  if (assetType === 'Thai Stock') return Math.floor(qty / 100 + EPS) * 100; // board lot of 100 shares
  if (assetType === 'Global Stock') return floorTo(qty, 4);
  return floorTo(qty, 8); // Crypto, Crypto Short 1x
}

// ---------------- Fees ----------------
/** fee = { mode: 'percent' | 'fixed', value: number }. Returns fee in local currency. */
export function feeAmount(fee, qty, price) {
  if (!fee) return 0;
  const v = Number(fee.value) || 0;
  if (fee.mode === 'fixed') return qty > 0 ? v : 0;
  return (qty * price * v) / 100;
}

// ---------------- Schedule ----------------
export function parseDate(s) {
  const parts = String(s).split('-').map(Number);
  return { y: parts[0], m: parts[1], d: parts[2] };
}

export function fmt(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** anchor + k periods, month-end safe (Jan 31 + 1M = Feb 28/29). */
export function addPeriods(anchor, frequency, k) {
  const a = parseDate(anchor);
  if (frequency === 'Weekly') {
    const t = Date.UTC(a.y, a.m - 1, a.d) + k * 7 * 86400000;
    const dt = new Date(t);
    return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  const months = { Monthly: 1, Quarterly: 3, Semiannual: 6, Yearly: 12 }[frequency] || 1;
  const total = (a.m - 1) + months * k;
  const y = a.y + Math.floor(total / 12);
  const m = (total % 12) + 1;
  return fmt(y, m, Math.min(a.d, daysInMonth(y, m)));
}

/** First scheduled date strictly after lastRebalanced (or the anchor itself if never rebalanced). */
export function nextScheduleDate(anchor, lastRebalanced, frequency) {
  if (!anchor) return null;
  if (!lastRebalanced || lastRebalanced < anchor) return anchor;
  for (let k = 1; k < 2000; k++) {
    const d = addPeriods(anchor, frequency, k);
    if (d > lastRebalanced) return d;
  }
  return null;
}

export function daysBetween(a, b) {
  const A = parseDate(a);
  const B = parseDate(b);
  return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86400000);
}

/** -> { due, severity: 'ok'|'warn'|'due', reason, nextDueDate } */
export function evaluateDue(pair, st, today) {
  if (pair.status === 'Paused') {
    return { due: false, severity: 'ok', reason: 'Paused', nextDueDate: null };
  }
  if (pair.mode === 'Drift') {
    const thr = Number(pair.driftThreshold) || 5;
    const ad = Math.abs(st.drift);
    if (st.total <= 0) return { due: false, severity: 'ok', reason: 'No holdings', nextDueDate: null };
    if (ad >= thr) return { due: true, severity: 'due', reason: `Drift ${ad.toFixed(2)}% ≥ ${thr}%`, nextDueDate: null };
    if (ad >= 0.7 * thr) return { due: false, severity: 'warn', reason: `Drift ${ad.toFixed(2)}% approaching ${thr}%`, nextDueDate: null };
    return { due: false, severity: 'ok', reason: `Drift ${ad.toFixed(2)}% within ${thr}%`, nextDueDate: null };
  }
  if (pair.mode === 'Schedule') {
    const next = nextScheduleDate(pair.scheduleAnchor, pair.lastRebalanced, pair.scheduleFrequency);
    if (!next) return { due: false, severity: 'ok', reason: 'No schedule', nextDueDate: null };
    if (today >= next) return { due: true, severity: 'due', reason: `Scheduled ${pair.scheduleFrequency} rebalance due since ${next}`, nextDueDate: next };
    const left = daysBetween(today, next);
    return { due: false, severity: left <= 7 ? 'warn' : 'ok', reason: `Next in ${left} day(s)`, nextDueDate: next };
  }
  return { due: false, severity: 'ok', reason: 'Manual mode', nextDueDate: null };
}

// ---------------- Order calculation ----------------
export function legMeta(pair, side) {
  return side === 'A'
    ? { assetName: pair.assetA, assetType: pair.assetAType, currency: pair.assetACurrency }
    : { assetName: pair.assetB, assetType: pair.assetBType, currency: pair.assetBCurrency };
}

/**
 * Size the buy leg so that it is funded by the sell proceeds.
 * proceedsTHB -> qty of buy asset (opening cost per unit = price for both long and short 1x).
 */
export function sizeBuyQty(proceedsTHB, buyPrice, fxBuy, buyType, fee) {
  if (!(proceedsTHB > 0) || !(buyPrice > 0)) return 0;
  let raw;
  if (fee && fee.mode === 'fixed') {
    raw = (proceedsTHB - (Number(fee.value) || 0) * fxBuy) / (buyPrice * fxBuy);
  } else {
    const pct = fee ? (Number(fee.value) || 0) / 100 : 0;
    raw = proceedsTHB / (buyPrice * fxBuy * (1 + pct));
  }
  return roundQty(buyType, raw);
}

/**
 * Compute a suggested rebalance order.
 * opts = { fees: { A: fee, B: fee }, date, minDrift (default 0.5) }
 * Returns { noAction, message, direction, sell: trade, buy: trade, valueMovedTHB, estRealizedTHB, beforePctA, afterPctA, warnings[] }
 */
export function computeOrder(pair, trades, prices, rates, opts = {}) {
  const st = computePairState(pair, trades, prices, rates);
  const warnings = [];
  const minDrift = opts.minDrift === undefined ? 0.5 : opts.minDrift;
  const base = { noAction: true, beforePctA: st.pctA, afterPctA: st.pctA, warnings, state: st };

  if (st.missingPrice) { base.message = 'Missing price for one of the assets.'; return base; }
  if (st.total <= 0) { base.message = 'Pair has no holdings yet. Buy at least one asset first.'; return base; }
  if (Math.abs(st.drift) < minDrift) { base.message = `Drift ${st.drift.toFixed(2)}% is below ${minDrift}%. No action needed.`; return base; }

  const moveTHB = st.valueA - st.total * Number(pair.targetA) / 100;
  const sellSide = moveTHB > 0 ? 'A' : 'B';
  const buySide = sellSide === 'A' ? 'B' : 'A';
  const sMeta = legMeta(pair, sellSide);
  const bMeta = legMeta(pair, buySide);
  const hS = sellSide === 'A' ? st.hA : st.hB;
  const pS = sellSide === 'A' ? st.priceA : st.priceB;
  const pB = buySide === 'A' ? st.priceA : st.priceB;
  const fxS = sellSide === 'A' ? st.fxA : st.fxB;
  const fxB = buySide === 'A' ? st.fxA : st.fxB;
  const feeS = (opts.fees || {})[sellSide];
  const feeB = (opts.fees || {})[buySide];

  const uv = unitValue(hS, pS);
  if (!(uv > 0)) { base.message = 'Sell leg has zero value (short liquidated?).'; return base; }
  const sellQty = Math.min(hS.qty, roundQty(sMeta.assetType, Math.abs(moveTHB) / (uv * fxS)));
  if (sellQty >= hS.qty - EPS) warnings.push(`This sells the entire ${sMeta.assetName} position.`);
  if (!(sellQty > 0)) {
    base.message = sMeta.assetType === 'Thai Stock'
      ? 'Required amount is smaller than one board lot (100 shares).'
      : 'Required quantity rounds to 0.';
    return base;
  }
  const sellFee = feeAmount(feeS, sellQty, pS);
  const proceedsLocal = sellQty * uv - sellFee;
  const proceedsTHB = proceedsLocal * fxS;
  const buyQty = sizeBuyQty(proceedsTHB, pB, fxB, bMeta.assetType, feeB);
  if (!(buyQty > 0)) {
    base.message = bMeta.assetType === 'Thai Stock'
      ? `Proceeds are not enough for one board lot (100 shares) of ${bMeta.assetName}.`
      : 'Buy quantity rounds to 0.';
    return base;
  }
  const buyFee = feeAmount(feeB, buyQty, pB);
  const date = opts.date || '';

  const sell = {
    ...sMeta,
    portfolio: pair.portfolio,
    date,
    action: 'Sell',
    quantity: sellQty,
    priceUnit: pS,
    feeAmount: round2(sellFee)
  };
  const buy = {
    ...bMeta,
    portfolio: pair.portfolio,
    date,
    action: 'Buy',
    quantity: buyQty,
    priceUnit: pB,
    feeAmount: round2(buyFee)
  };

  const preview = previewAfter(pair, trades, [sell, buy], prices, rates);
  return {
    noAction: false,
    message: '',
    direction: `${sellSide}_TO_${buySide}`,
    sell,
    buy,
    valueMovedTHB: proceedsTHB,
    estRealizedTHB: preview.realizedTHB,
    beforePctA: st.pctA,
    afterPctA: preview.pctA,
    warnings,
    state: st
  };
}

/** Apply hypothetical legs and return the resulting pctA and realized P&L (THB) of the sell leg. */
export function previewAfter(pair, trades, legs, prices, rates) {
  const maxSeq = (trades || []).reduce((m, t) => Math.max(m, t.seq || parseInt(t.id, 10) || 0), 0);
  const lastDate = (trades || []).reduce((m, t) => (t.date > m ? t.date : m), '');
  const extra = legs.map((l, i) => ({
    ...l,
    date: l.date && l.date >= lastDate ? l.date : lastDate,
    seq: maxSeq + 1 + i
  }));
  const before = computeHoldings(trades, pair.portfolio);
  const after = computeHoldings((trades || []).concat(extra), pair.portfolio);
  const sellLeg = legs.find(l => l.action === 'Sell');
  let realizedTHB = 0;
  if (sellLeg) {
    const b = before[sellLeg.assetName];
    const a = after[sellLeg.assetName];
    realizedTHB = ((a ? a.realized : 0) - (b ? b.realized : 0)) * fxOf(sellLeg.currency, rates);
  }
  const st = computePairState(pair, (trades || []).concat(extra), prices, rates);
  return { pctA: st.pctA, realizedTHB, state: st };
}

export function round2(x) {
  return Math.round(x * 100) / 100;
}
