/*
 * AlphaTrader — Rebalance Engine (DEMO PROTOTYPE)
 * ------------------------------------------------
 * Pure functions, no DOM. Loaded by demo/rebalance-demo.html and by node tests.
 * This is the reference design for frontend/src/lib/rebalanceEngine.js (Step 4).
 *
 * Cost basis: Weighted Average Cost (WAC), same as the real app.
 * Supported position sides:
 *   - Long  (normal assets, and inverse ETFs such as BITI — they are just tickers with a price)
 *   - Short 1x synthetic (USD-margined, collateral = notional at entry). Asset name ends with ":S1X"
 *     and price is taken from the underlying ticker (e.g. "BTC-USD:S1X" uses price of "BTC-USD").
 *     Unit value = 2 * entryPrice - currentPrice (floored at 0 = liquidation).
 */
(function (root) {
  'use strict';

  var SHORT_SUFFIX = ':S1X';
  var SHORT_TYPE = 'Crypto Short 1x';
  var EPS = 1e-9;

  function isShort(assetName, assetType) {
    return assetType === SHORT_TYPE || String(assetName || '').toUpperCase().endsWith(SHORT_SUFFIX);
  }

  function underlyingOf(assetName) {
    var s = String(assetName || '');
    return s.toUpperCase().endsWith(SHORT_SUFFIX) ? s.slice(0, -SHORT_SUFFIX.length) : s;
  }

  function fxOf(ccy, rates) {
    if (!ccy || ccy === 'THB') return 1;
    return (rates && rates[ccy]) || 1;
  }

  function priceOf(assetName, prices) {
    var p = prices ? prices[underlyingOf(assetName)] : undefined;
    return typeof p === 'number' && isFinite(p) ? p : null;
  }

  function sortTrades(trades) {
    return trades.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.seq || 0) - (b.seq || 0);
    });
  }

  /**
   * Build holdings with WAC. Returns { [assetName]: holding }.
   * holding = { assetName, assetType, currency, short, qty, costBasis (incl. buy fees),
   *             entryNotional (qty*price, excl. fees), realized (local ccy) }
   */
  function computeHoldings(trades, portfolio) {
    var map = {};
    var list = trades.filter(function (t) { return !portfolio || t.portfolio === portfolio; });
    sortTrades(list).forEach(function (t) {
      var key = t.assetName;
      var h = map[key];
      if (!h) {
        h = map[key] = {
          assetName: key, assetType: t.assetType, currency: t.currency,
          short: isShort(t.assetName, t.assetType),
          qty: 0, costBasis: 0, entryNotional: 0, realized: 0
        };
      }
      var q = Number(t.quantity) || 0;
      var p = Number(t.priceUnit) || 0;
      var f = Number(t.feeAmount) || 0;
      if (String(t.action).toLowerCase() === 'buy') {
        // Long: buy units. Short 1x: open/increase short, collateral = q*p.
        h.qty += q;
        h.costBasis += q * p + f;
        h.entryNotional += q * p;
      } else {
        // Long: sell units. Short 1x: cover (close) part of the short.
        if (h.qty <= EPS) return;
        var sq = Math.min(q, h.qty);
        var ratio = sq / h.qty;
        var costPortion = h.costBasis * ratio;
        var entryPortion = h.entryNotional * ratio;
        var gross = h.short ? Math.max(0, 2 * entryPortion - sq * p) : sq * p;
        h.realized += (gross - f) - costPortion;
        h.qty -= sq;
        h.costBasis -= costPortion;
        h.entryNotional -= entryPortion;
        if (h.qty < EPS) { h.qty = 0; h.costBasis = 0; h.entryNotional = 0; }
      }
    });
    return map;
  }

  /** Average entry price (excl. fees) — used for short valuation. */
  function entryPrice(h) {
    return h && h.qty > EPS ? h.entryNotional / h.qty : 0;
  }

  /** WAC incl. fees — what the real app displays as "Avg cost". */
  function wac(h) {
    return h && h.qty > EPS ? h.costBasis / h.qty : 0;
  }

  /** Value of ONE unit in local currency at current price. */
  function unitValue(h, price) {
    if (price === null || price === undefined) return 0;
    if (!h || !h.short) return price;
    var e = entryPrice(h);
    if (e <= 0) return price; // no open short yet → opening cost per unit = price
    return Math.max(0, 2 * e - price);
  }

  function valueLocal(h, price) {
    return h ? h.qty * unitValue(h, price) : 0;
  }

  function emptyHolding(assetName, assetType, currency) {
    return {
      assetName: assetName, assetType: assetType, currency: currency,
      short: isShort(assetName, assetType), qty: 0, costBasis: 0, entryNotional: 0, realized: 0
    };
  }

  /**
   * Current state of a pair (values in THB).
   */
  function computePairState(pair, trades, prices, rates) {
    var holdings = computeHoldings(trades, pair.portfolio);
    var hA = holdings[pair.assetA] || emptyHolding(pair.assetA, pair.assetAType, pair.assetACurrency);
    var hB = holdings[pair.assetB] || emptyHolding(pair.assetB, pair.assetBType, pair.assetBCurrency);
    var pA = priceOf(pair.assetA, prices);
    var pB = priceOf(pair.assetB, prices);
    var fxA = fxOf(pair.assetACurrency, rates);
    var fxB = fxOf(pair.assetBCurrency, rates);
    var valueA = valueLocal(hA, pA) * fxA;
    var valueB = valueLocal(hB, pB) * fxB;
    var total = valueA + valueB;
    var pctA = total > 0 ? (valueA / total) * 100 : 0;
    return {
      hA: hA, hB: hB, priceA: pA, priceB: pB, fxA: fxA, fxB: fxB,
      valueA: valueA, valueB: valueB, total: total,
      pctA: pctA, pctB: total > 0 ? 100 - pctA : 0,
      drift: total > 0 ? pctA - Number(pair.targetA) : 0,
      missingPrice: pA === null || pB === null
    };
  }

  // ---------------- Quantity rounding ----------------
  function floorTo(q, decimals) {
    var m = Math.pow(10, decimals);
    return Math.floor(q * m + EPS) / m;
  }

  function roundQty(assetType, qty) {
    if (!(qty > 0)) return 0;
    if (assetType === 'Thai Stock') return Math.floor(qty / 100 + EPS) * 100; // board lot
    if (assetType === 'Global Stock') return floorTo(qty, 4);
    return floorTo(qty, 8); // Crypto, Crypto Short 1x
  }

  // ---------------- Fees ----------------
  /** fee = { mode: 'percent' | 'fixed', value: number }. Returns fee in local currency. */
  function feeAmount(fee, qty, price) {
    if (!fee) return 0;
    var v = Number(fee.value) || 0;
    if (fee.mode === 'fixed') return qty > 0 ? v : 0;
    return (qty * price * v) / 100;
  }

  // ---------------- Schedule ----------------
  function parseDate(s) {
    var parts = String(s).split('-').map(Number);
    return { y: parts[0], m: parts[1], d: parts[2] };
  }
  function fmt(y, m, d) {
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  /** anchor + k periods, month-end safe (Jan 31 + 1M = Feb 28/29). */
  function addPeriods(anchor, frequency, k) {
    var a = parseDate(anchor);
    if (frequency === 'Weekly') {
      var t = Date.UTC(a.y, a.m - 1, a.d) + k * 7 * 86400000;
      var dt = new Date(t);
      return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    var months = { Monthly: 1, Quarterly: 3, Semiannual: 6, Yearly: 12 }[frequency] || 1;
    var total = (a.m - 1) + months * k;
    var y = a.y + Math.floor(total / 12);
    var m = (total % 12) + 1;
    return fmt(y, m, Math.min(a.d, daysInMonth(y, m)));
  }

  /** First scheduled date strictly after lastRebalanced (or the anchor itself if never rebalanced). */
  function nextScheduleDate(anchor, lastRebalanced, frequency) {
    if (!anchor) return null;
    if (!lastRebalanced || lastRebalanced < anchor) return anchor;
    for (var k = 1; k < 2000; k++) {
      var d = addPeriods(anchor, frequency, k);
      if (d > lastRebalanced) return d;
    }
    return null;
  }

  function daysBetween(a, b) {
    var A = parseDate(a), B = parseDate(b);
    return Math.round((Date.UTC(B.y, B.m - 1, B.d) - Date.UTC(A.y, A.m - 1, A.d)) / 86400000);
  }

  /** → { due, severity: 'ok'|'warn'|'due', reason, nextDueDate } */
  function evaluateDue(pair, st, today) {
    if (pair.status === 'Paused') return { due: false, severity: 'ok', reason: 'Paused', nextDueDate: null };
    if (pair.mode === 'Drift') {
      var thr = Number(pair.driftThreshold) || 5;
      var ad = Math.abs(st.drift);
      if (st.total <= 0) return { due: false, severity: 'ok', reason: 'No holdings', nextDueDate: null };
      if (ad >= thr) return { due: true, severity: 'due', reason: 'Drift ' + ad.toFixed(2) + '% ≥ ' + thr + '%', nextDueDate: null };
      if (ad >= 0.7 * thr) return { due: false, severity: 'warn', reason: 'Drift ' + ad.toFixed(2) + '% approaching ' + thr + '%', nextDueDate: null };
      return { due: false, severity: 'ok', reason: 'Drift ' + ad.toFixed(2) + '% within ' + thr + '%', nextDueDate: null };
    }
    if (pair.mode === 'Schedule') {
      var next = nextScheduleDate(pair.scheduleAnchor, pair.lastRebalanced, pair.scheduleFrequency);
      if (!next) return { due: false, severity: 'ok', reason: 'No schedule', nextDueDate: null };
      if (today >= next) return { due: true, severity: 'due', reason: 'Scheduled ' + pair.scheduleFrequency + ' rebalance due since ' + next, nextDueDate: next };
      var left = daysBetween(today, next);
      return { due: false, severity: left <= 7 ? 'warn' : 'ok', reason: 'Next in ' + left + ' day(s)', nextDueDate: next };
    }
    return { due: false, severity: 'ok', reason: 'Manual mode', nextDueDate: null };
  }

  // ---------------- Order calculation ----------------
  function legMeta(pair, side) {
    return side === 'A'
      ? { assetName: pair.assetA, assetType: pair.assetAType, currency: pair.assetACurrency }
      : { assetName: pair.assetB, assetType: pair.assetBType, currency: pair.assetBCurrency };
  }

  /**
   * Size the buy leg so that it is funded by the sell proceeds.
   * proceedsTHB → qty of buy asset (opening cost per unit = price for both long and short 1x).
   */
  function sizeBuyQty(proceedsTHB, buyPrice, fxBuy, buyType, fee) {
    if (!(proceedsTHB > 0) || !(buyPrice > 0)) return 0;
    var raw;
    if (fee && fee.mode === 'fixed') {
      raw = (proceedsTHB - (Number(fee.value) || 0) * fxBuy) / (buyPrice * fxBuy);
    } else {
      var pct = fee ? (Number(fee.value) || 0) / 100 : 0;
      raw = proceedsTHB / (buyPrice * fxBuy * (1 + pct));
    }
    return roundQty(buyType, raw);
  }

  /**
   * Compute a suggested rebalance order.
   * opts = { fees: { A: fee, B: fee }, date, minDrift (default 0.5) }
   * Returns { noAction, message, direction, sell: trade, buy: trade, valueMovedTHB, estRealizedTHB, beforePctA, afterPctA, warnings[] }
   */
  function computeOrder(pair, trades, prices, rates, opts) {
    opts = opts || {};
    var st = computePairState(pair, trades, prices, rates);
    var warnings = [];
    var minDrift = opts.minDrift === undefined ? 0.5 : opts.minDrift;
    var base = { noAction: true, beforePctA: st.pctA, afterPctA: st.pctA, warnings: warnings, state: st };

    if (st.missingPrice) { base.message = 'Missing price for one of the assets.'; return base; }
    if (st.total <= 0) { base.message = 'Pair has no holdings yet. Buy at least one asset first.'; return base; }
    if (Math.abs(st.drift) < minDrift) { base.message = 'Drift ' + st.drift.toFixed(2) + '% is below ' + minDrift + '%. No action needed.'; return base; }

    var moveTHB = st.valueA - st.total * Number(pair.targetA) / 100;
    var sellSide = moveTHB > 0 ? 'A' : 'B';
    var buySide = sellSide === 'A' ? 'B' : 'A';
    var sMeta = legMeta(pair, sellSide), bMeta = legMeta(pair, buySide);
    var hS = sellSide === 'A' ? st.hA : st.hB;
    var pS = sellSide === 'A' ? st.priceA : st.priceB;
    var pB = buySide === 'A' ? st.priceA : st.priceB;
    var fxS = sellSide === 'A' ? st.fxA : st.fxB;
    var fxB = buySide === 'A' ? st.fxA : st.fxB;
    var feeS = (opts.fees || {})[sellSide];
    var feeB = (opts.fees || {})[buySide];

    var uv = unitValue(hS, pS);
    if (!(uv > 0)) { base.message = 'Sell leg has zero value (short liquidated?).'; return base; }
    var sellQty = Math.min(hS.qty, roundQty(sMeta.assetType, Math.abs(moveTHB) / (uv * fxS)));
    if (sellQty >= hS.qty - EPS) warnings.push('This sells the entire ' + sMeta.assetName + ' position.');
    if (!(sellQty > 0)) {
      base.message = sMeta.assetType === 'Thai Stock'
        ? 'Required amount is smaller than one board lot (100 shares).'
        : 'Required quantity rounds to 0.';
      return base;
    }
    var sellFee = feeAmount(feeS, sellQty, pS);
    var proceedsLocal = sellQty * uv - sellFee;
    var proceedsTHB = proceedsLocal * fxS;
    var buyQty = sizeBuyQty(proceedsTHB, pB, fxB, bMeta.assetType, feeB);
    if (!(buyQty > 0)) {
      base.message = bMeta.assetType === 'Thai Stock'
        ? 'Proceeds are not enough for one board lot (100 shares) of ' + bMeta.assetName + '.'
        : 'Buy quantity rounds to 0.';
      return base;
    }
    var buyFee = feeAmount(feeB, buyQty, pB);
    var date = opts.date || '';

    var sell = Object.assign({}, sMeta, { portfolio: pair.portfolio, date: date, action: 'Sell', quantity: sellQty, priceUnit: pS, feeAmount: round2(sellFee) });
    var buy = Object.assign({}, bMeta, { portfolio: pair.portfolio, date: date, action: 'Buy', quantity: buyQty, priceUnit: pB, feeAmount: round2(buyFee) });

    var preview = previewAfter(pair, trades, [sell, buy], prices, rates);
    return {
      noAction: false, message: '', direction: sellSide + '_TO_' + buySide,
      sell: sell, buy: buy, valueMovedTHB: proceedsTHB,
      estRealizedTHB: preview.realizedTHB, beforePctA: st.pctA, afterPctA: preview.pctA,
      warnings: warnings, state: st
    };
  }

  /** Apply hypothetical legs and return the resulting pctA and realized P&L (THB) of the sell leg. */
  function previewAfter(pair, trades, legs, prices, rates) {
    var maxSeq = trades.reduce(function (m, t) { return Math.max(m, t.seq || 0); }, 0);
    var lastDate = trades.reduce(function (m, t) { return t.date > m ? t.date : m; }, '');
    var extra = legs.map(function (l, i) {
      return Object.assign({}, l, { date: l.date && l.date >= lastDate ? l.date : lastDate, seq: maxSeq + 1 + i });
    });
    var before = computeHoldings(trades, pair.portfolio);
    var after = computeHoldings(trades.concat(extra), pair.portfolio);
    var sellLeg = legs.filter(function (l) { return l.action === 'Sell'; })[0];
    var realizedTHB = 0;
    if (sellLeg) {
      var b = before[sellLeg.assetName], a = after[sellLeg.assetName];
      realizedTHB = ((a ? a.realized : 0) - (b ? b.realized : 0)) * fxOf(sellLeg.currency, rates);
    }
    var st = computePairState(pair, trades.concat(extra), prices, rates);
    return { pctA: st.pctA, realizedTHB: realizedTHB, state: st };
  }

  function round2(x) { return Math.round(x * 100) / 100; }

  var api = {
    SHORT_SUFFIX: SHORT_SUFFIX, SHORT_TYPE: SHORT_TYPE,
    isShort: isShort, underlyingOf: underlyingOf, fxOf: fxOf, priceOf: priceOf,
    computeHoldings: computeHoldings, entryPrice: entryPrice, wac: wac,
    unitValue: unitValue, valueLocal: valueLocal, computePairState: computePairState,
    roundQty: roundQty, feeAmount: feeAmount, sizeBuyQty: sizeBuyQty,
    addPeriods: addPeriods, nextScheduleDate: nextScheduleDate, evaluateDue: evaluateDue,
    computeOrder: computeOrder, previewAfter: previewAfter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RebalanceEngine = api;
})(typeof window !== 'undefined' ? window : this);
