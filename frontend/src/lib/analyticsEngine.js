import dayjs from 'dayjs';

/**
 * Helper to round to 2 decimals
 */
export const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;

/**
 * 6.2 Monthly P&L Heatmap
 * Aggregates Realized P&L from trades and Net Dividends from Cash Ledger by Year and Month.
 */
export const computeMonthlyHeatmap = (
  trades = [],
  cashEntries = [],
  liveRates = {},
  displayCurrency = 'THB'
) => {
  const grid = {}; // { [year]: { [month]: { realized: 0, dividends: 0, total: 0, tradeCount: 0, divCount: 0 } } }
  const yearsSet = new Set();
  const displayFx = displayCurrency === 'THB' ? 1.0 : (liveRates[displayCurrency] || 1.0);

  // 1. Process Trades (Sell actions generate realized PnL)
  trades.forEach(t => {
    if (!t.date) return;
    const action = String(t.action || '').trim().toLowerCase();
    if (action !== 'sell') return;

    const d = dayjs(t.date);
    if (!d.isValid()) return;

    const y = d.format('YYYY');
    const m = d.format('MM');
    yearsSet.add(y);

    if (!grid[y]) grid[y] = {};
    if (!grid[y][m]) {
      grid[y][m] = { realized: 0, dividends: 0, total: 0, tradeCount: 0, divCount: 0 };
    }

    // Trade-date FX or fallback
    const tradeFx = (t.fxToThb !== undefined && t.fxToThb !== null && !isNaN(Number(t.fxToThb)))
      ? Number(t.fxToThb)
      : (t.currency === 'THB' ? 1.0 : (liveRates[t.currency] || 1.0));

    const pnlInThb = (Number(t.realizedPnL) || 0) * tradeFx;
    const pnlConverted = pnlInThb / displayFx;

    grid[y][m].realized += pnlConverted;
    grid[y][m].total += pnlConverted;
    grid[y][m].tradeCount += 1;
  });

  // 2. Process Cash Ledger Dividends
  cashEntries.forEach(entry => {
    if (!entry.date) return;
    const kind = String(entry.kind || '').trim().toLowerCase();
    if (kind !== 'dividend') return;

    const d = dayjs(entry.date);
    if (!d.isValid()) return;

    const y = d.format('YYYY');
    const m = d.format('MM');
    yearsSet.add(y);

    if (!grid[y]) grid[y] = {};
    if (!grid[y][m]) {
      grid[y][m] = { realized: 0, dividends: 0, total: 0, tradeCount: 0, divCount: 0 };
    }

    const entryFx = (entry.fxToThb !== undefined && entry.fxToThb !== null && !isNaN(Number(entry.fxToThb)))
      ? Number(entry.fxToThb)
      : (entry.currency === 'THB' ? 1.0 : (liveRates[entry.currency] || 1.0));

    const netVal = entry.net !== undefined ? Number(entry.net) : (Number(entry.gross) - Number(entry.withholdingTax || 0));
    const divInThb = (netVal || 0) * entryFx;
    const divConverted = divInThb / displayFx;

    grid[y][m].dividends += divConverted;
    grid[y][m].total += divConverted;
    grid[y][m].divCount += 1;
  });

  // 3. Compute Yearly Totals & Grand Total
  const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a)); // Descending years
  const yearTotals = {};
  const grandTotal = { realized: 0, dividends: 0, total: 0, tradeCount: 0, divCount: 0 };

  sortedYears.forEach(y => {
    yearTotals[y] = { realized: 0, dividends: 0, total: 0, tradeCount: 0, divCount: 0 };
    for (let mNum = 1; mNum <= 12; mNum++) {
      const mStr = String(mNum).padStart(2, '0');
      const cell = grid[y]?.[mStr] || { realized: 0, dividends: 0, total: 0, tradeCount: 0, divCount: 0 };
      cell.realized = round2(cell.realized);
      cell.dividends = round2(cell.dividends);
      cell.total = round2(cell.total);

      yearTotals[y].realized += cell.realized;
      yearTotals[y].dividends += cell.dividends;
      yearTotals[y].total += cell.total;
      yearTotals[y].tradeCount += cell.tradeCount;
      yearTotals[y].divCount += cell.divCount;
    }

    yearTotals[y].realized = round2(yearTotals[y].realized);
    yearTotals[y].dividends = round2(yearTotals[y].dividends);
    yearTotals[y].total = round2(yearTotals[y].total);

    grandTotal.realized += yearTotals[y].realized;
    grandTotal.dividends += yearTotals[y].dividends;
    grandTotal.total += yearTotals[y].total;
    grandTotal.tradeCount += yearTotals[y].tradeCount;
    grandTotal.divCount += yearTotals[y].divCount;
  });

  grandTotal.realized = round2(grandTotal.realized);
  grandTotal.dividends = round2(grandTotal.dividends);
  grandTotal.total = round2(grandTotal.total);

  return {
    years: sortedYears,
    grid,
    yearTotals,
    grandTotal
  };
};

/**
 * 6.4 Daily Equity Curve and Maximum Drawdown
 * Builds daily portfolio valuation timeline from earliest transaction to latest,
 * calculating peak equity, daily drawdowns, and maximum drawdown metrics.
 */
export const computeEquityCurveAndDrawdown = (
  trades = [],
  historicalPrices = {},
  cashEntries = [],
  liveRates = {},
  displayCurrency = 'THB',
  options = {}
) => {
  if (!trades.length && !cashEntries.length) {
    return {
      series: [],
      kpis: {
        currentEquity: 0,
        peakEquity: 0,
        maxDrawdownPct: 0,
        maxDrawdownDate: null,
        peakDate: null,
        maxDrawdownDurationDays: 0
      }
    };
  }

  const displayFx = displayCurrency === 'THB' ? 1.0 : (liveRates[displayCurrency] || 1.0);

  // 1. Gather all unique event dates and establish chronological range
  const allDates = [];
  trades.forEach(t => t.date && allDates.push(t.date));
  cashEntries.forEach(c => c.date && allDates.push(c.date));

  allDates.sort();
  const startDate = dayjs(allDates[0]);
  const endDate = options.endDate ? dayjs(options.endDate) : (dayjs().isAfter(dayjs(allDates[allDates.length - 1])) ? dayjs() : dayjs(allDates[allDates.length - 1]));

  // Build price lookup map: { [symbol]: { [YYYY-MM-DD]: closePrice } }
  const priceMap = {};
  Object.keys(historicalPrices).forEach(sym => {
    priceMap[sym] = {};
    const series = historicalPrices[sym] || [];
    series.forEach(pt => {
      if (pt.date && pt.close !== undefined) {
        priceMap[sym][pt.date] = Number(pt.close);
      }
    });
  });

  // Track running trade quantities and cash flows
  // Sort trades and cash entries chronologically
  const sortedTrades = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const sortedCash = [...cashEntries].sort((a, b) => a.date.localeCompare(b.date));

  let tradeIdx = 0;
  let cashIdx = 0;

  // Running state
  const holdings = {}; // { [symbol]: { qty, avgPrice, assetType, currency } }
  let runningCashBalance = 0;
  const hasDepositsEver = cashEntries.some(e => String(e.kind || '').toLowerCase() === 'deposit');
  const lastKnownPrice = {};

  const series = [];
  let runningPeak = 0;
  let peakDate = null;
  let maxDrawdownPct = 0;
  let maxDrawdownDate = null;
  let maxDrawdownPeakDate = null;

  let currentDrawdownDays = 0;
  let maxDrawdownDurationDays = 0;

  let curr = startDate;
  const daysLimit = 1500; // Safeguard against overly long loops
  let iteration = 0;

  while ((curr.isBefore(endDate) || curr.isSame(endDate, 'day')) && iteration < daysLimit) {
    const curDateStr = curr.format('YYYY-MM-DD');

    // Apply any cash entries on this day
    while (cashIdx < sortedCash.length && sortedCash[cashIdx].date <= curDateStr) {
      const entry = sortedCash[cashIdx];
      const kind = String(entry.kind || '').trim().toLowerCase();
      const entryFx = (entry.fxToThb !== undefined && entry.fxToThb !== null && !isNaN(Number(entry.fxToThb)))
        ? Number(entry.fxToThb)
        : (entry.currency === 'THB' ? 1.0 : (liveRates[entry.currency] || 1.0));

      const net = entry.net !== undefined ? Number(entry.net) : (Number(entry.gross) - Number(entry.withholdingTax || 0));
      const valThb = (net || 0) * entryFx;
      const converted = valThb / displayFx;

      if (kind === 'deposit') {
        runningCashBalance += converted;
      } else if (kind === 'withdraw') {
        runningCashBalance -= converted;
      } else if (kind === 'dividend' || kind === 'interest') {
        runningCashBalance += converted;
      } else if (kind === 'fee' || kind === 'tax') {
        runningCashBalance -= converted;
      }
      cashIdx++;
    }

    // Apply any trades on this day
    while (tradeIdx < sortedTrades.length && sortedTrades[tradeIdx].date <= curDateStr) {
      const trade = sortedTrades[tradeIdx];
      const sym = trade.assetName;
      const action = String(trade.action || '').trim().toLowerCase();
      const qty = Number(trade.quantity) || 0;
      const price = Number(trade.priceUnit) || 0;
      const fee = Number(trade.feeAmount) || 0;

      const tradeFx = (trade.fxToThb !== undefined && trade.fxToThb !== null && !isNaN(Number(trade.fxToThb)))
        ? Number(trade.fxToThb)
        : (trade.currency === 'THB' ? 1.0 : (liveRates[trade.currency] || 1.0));

      if (!holdings[sym]) {
        holdings[sym] = {
          qty: 0,
          avgPrice: price,
          assetType: trade.assetType || 'Thai Stock',
          currency: trade.currency || 'THB'
        };
      }

      if (action === 'buy') {
        holdings[sym].qty += qty;
        holdings[sym].avgPrice = price; // Latest entry price for short 1x tracking
        const outflowThb = (qty * price + fee) * tradeFx;
        runningCashBalance -= (outflowThb / displayFx);
      } else if (action === 'sell') {
        holdings[sym].qty = Math.max(0, holdings[sym].qty - qty);
        const inflowThb = (qty * price - fee) * tradeFx;
        runningCashBalance += (inflowThb / displayFx);
      }

      lastKnownPrice[sym] = price;
      tradeIdx++;
    }

    // Value active holdings on date curDateStr
    let dailyInvestedValue = 0;
    Object.keys(holdings).forEach(sym => {
      const h = holdings[sym];
      if (h.qty <= 0) return;

      // Determine price for sym on curDateStr
      let price = priceMap[sym]?.[curDateStr];
      if (price === undefined) {
        price = lastKnownPrice[sym] || h.avgPrice || 0;
      } else {
        lastKnownPrice[sym] = price;
      }

      // Check Short 1x Synthetic
      let unitValue = price;
      if (h.assetType === 'Crypto Short 1x' || sym.endsWith(':S1X')) {
        unitValue = Math.max(0, 2 * (h.avgPrice || price) - price);
      }

      const curFx = h.currency === 'THB' ? 1.0 : (liveRates[h.currency] || 1.0);
      const valThb = h.qty * unitValue * curFx;
      dailyInvestedValue += (valThb / displayFx);
    });

    const dailyCash = hasDepositsEver ? runningCashBalance : Math.max(0, runningCashBalance);
    const dailyEquity = dailyInvestedValue + dailyCash;

    // Track peak and drawdown
    if (dailyEquity > runningPeak) {
      runningPeak = dailyEquity;
      peakDate = curDateStr;
      currentDrawdownDays = 0;
    } else {
      currentDrawdownDays++;
    }

    const ddPct = runningPeak > 0 ? ((dailyEquity - runningPeak) / runningPeak) * 100 : 0;
    if (ddPct < maxDrawdownPct) {
      maxDrawdownPct = ddPct;
      maxDrawdownDate = curDateStr;
      maxDrawdownPeakDate = peakDate;
    }

    if (currentDrawdownDays > maxDrawdownDurationDays) {
      maxDrawdownDurationDays = currentDrawdownDays;
    }

    series.push({
      date: curDateStr,
      equity: round2(dailyEquity),
      cash: round2(dailyCash),
      invested: round2(dailyInvestedValue),
      peak: round2(runningPeak),
      drawdownPct: round2(ddPct)
    });

    curr = curr.add(1, 'day');
    iteration++;
  }

  const latestPt = series[series.length - 1] || { equity: 0 };

  return {
    series,
    kpis: {
      currentEquity: round2(latestPt.equity),
      peakEquity: round2(runningPeak),
      maxDrawdownPct: round2(maxDrawdownPct),
      maxDrawdownDate,
      peakDate: maxDrawdownPeakDate,
      maxDrawdownDurationDays
    }
  };
};

/**
 * 6.5 Benchmark Normalization
 * Normalizes an index series (e.g. ^SET.BK, ^GSPC, BTC-USD) so that its initial value matches 100
 * on the target portfolio's starting date, forward-filling weekend and holiday gaps.
 */
export const normalizeBenchmark = (
  benchmarkSeries = [],
  targetDates = [],
  initialValue = 100
) => {
  if (!benchmarkSeries.length || !targetDates.length) return {};

  const bMap = {};
  benchmarkSeries.forEach(pt => {
    if (pt.date && pt.close !== undefined) {
      bMap[pt.date] = Number(pt.close);
    }
  });

  // Find base price on or closest after targetDates[0]
  let basePrice = null;
  for (let i = 0; i < targetDates.length; i++) {
    if (bMap[targetDates[i]] !== undefined && bMap[targetDates[i]] > 0) {
      basePrice = bMap[targetDates[i]];
      break;
    }
  }

  if (!basePrice) {
    // Fallback to first available price in benchmark series
    basePrice = benchmarkSeries[0]?.close || 1;
  }

  const result = {};
  let lastPrice = basePrice;

  targetDates.forEach(d => {
    if (bMap[d] !== undefined) {
      lastPrice = bMap[d];
    }
    result[d] = round2((lastPrice / basePrice) * initialValue);
  });

  return result;
};

/**
 * 6.6 Strategy Detailed Statistics
 * Calculates performance metrics grouped by strategy with buy-trade fallback attribution.
 */
export const computeStrategyDetailedStats = (
  trades = [],
  tradesWithRunningStats = {},
  liveRates = {},
  displayCurrency = 'THB'
) => {
  const displayFx = displayCurrency === 'THB' ? 1.0 : (liveRates[displayCurrency] || 1.0);
  const strategyMap = {}; // { [strategy]: { sellCount, wins, losses, totalPnL, grossProfit, grossLoss } }

  // Sort trades chronologically to enable attribution fallback
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));

  // Build map of latest buy why for each asset
  const latestBuyWhy = {};

  sorted.forEach(t => {
    const action = String(t.action || '').trim().toLowerCase();
    const sym = t.assetName;

    if (action === 'buy') {
      if (t.why && t.why.trim()) {
        latestBuyWhy[sym] = t.why.trim();
      }
      return;
    }

    if (action === 'sell') {
      // Attribute strategy: t.why -> latestBuyWhy[sym] -> 'Unspecified'
      let strategy = (t.why && t.why.trim()) ? t.why.trim() : (latestBuyWhy[sym] || 'Unspecified');

      if (!strategyMap[strategy]) {
        strategyMap[strategy] = {
          name: strategy,
          trades: 0,
          wins: 0,
          losses: 0,
          totalPnL: 0,
          grossProfit: 0,
          grossLoss: 0
        };
      }

      // Determine realized PnL
      const stat = tradesWithRunningStats[t.id] || {};
      const rawRealized = stat.realizedPnL !== undefined ? stat.realizedPnL : (t.realizedPnL || 0);

      const tradeFx = (t.fxToThb !== undefined && t.fxToThb !== null && !isNaN(Number(t.fxToThb)))
        ? Number(t.fxToThb)
        : (t.currency === 'THB' ? 1.0 : (liveRates[t.currency] || 1.0));

      const pnlConverted = (rawRealized * tradeFx) / displayFx;

      strategyMap[strategy].trades += 1;
      strategyMap[strategy].totalPnL += pnlConverted;

      if (pnlConverted > 0) {
        strategyMap[strategy].wins += 1;
        strategyMap[strategy].grossProfit += pnlConverted;
      } else if (pnlConverted < 0) {
        strategyMap[strategy].losses += 1;
        strategyMap[strategy].grossLoss += Math.abs(pnlConverted);
      }
    }
  });

  return Object.values(strategyMap).map(s => {
    const winRate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
    const profitFactor = s.grossLoss > 0
      ? s.grossProfit / s.grossLoss
      : (s.grossProfit > 0 ? 999.99 : 0);
    const avgWin = s.wins > 0 ? s.grossProfit / s.wins : 0;
    const avgLoss = s.losses > 0 ? s.grossLoss / s.losses : 0;
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    return {
      strategy: s.name,
      trades: s.trades,
      wins: s.wins,
      losses: s.losses,
      winRate: round2(winRate),
      totalPnL: round2(s.totalPnL),
      grossProfit: round2(s.grossProfit),
      grossLoss: round2(s.grossLoss),
      profitFactor: round2(profitFactor),
      avgWin: round2(avgWin),
      avgLoss: round2(avgLoss),
      payoffRatio: round2(payoffRatio)
    };
  }).sort((a, b) => b.totalPnL - a.totalPnL);
};
