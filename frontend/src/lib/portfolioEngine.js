import dayjs from 'dayjs';

/**
 * Sort trades chronologically: date ASC, then parseInt(id) ASC.
 */
export const sortChronologically = (trades = []) => {
  return [...trades].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const idA = parseInt(a.id, 10) || 0;
    const idB = parseInt(b.id, 10) || 0;
    return idA - idB;
  });
};

/**
 * Compute running cost basis and P&L per trade.
 * Keyed by trade.id -> { avgCostBasis, realizedPnL, unrealizedPnL, feeAmount }
 */
export const computeTradeStats = (trades = [], livePrices = {}) => {
  const sorted = sortChronologically(trades);
  const running = {}; // key: assetName -> { qty: 0, totalCost: 0 }
  const statsMap = {}; // key: trade.id -> { avgCostBasis, realizedPnL, unrealizedPnL, feeAmount }

  sorted.forEach(trade => {
    const name = trade.assetName;
    if (!running[name]) {
      running[name] = { qty: 0, totalCost: 0 };
    }
    const holding = running[name];
    const qty = Number(trade.quantity) || 0;
    const price = Number(trade.priceUnit) || 0;
    const isBuy = (trade.action || '').toLowerCase() === 'buy';

    const feeAmount = trade.feeAmount !== undefined ? Number(trade.feeAmount) : 0.0;
    const avgCostBefore = holding.qty > 0 ? (holding.totalCost / holding.qty) : 0;

    if (isBuy) {
      const costBasis = qty * price + feeAmount;
      holding.qty += qty;
      holding.totalCost += costBasis;
      const avgCostAfter = holding.qty > 0 ? (holding.totalCost / holding.qty) : 0;

      const lp = livePrices[name] !== undefined && livePrices[name] !== null ? livePrices[name] : price;
      const unrealizedPnL = qty * lp - costBasis;

      statsMap[trade.id] = {
        avgCostBasis: avgCostAfter,
        realizedPnL: 0,
        unrealizedPnL: unrealizedPnL,
        feeAmount: feeAmount
      };
    } else {
      const revenue = qty * price - feeAmount;
      const costOfSharesSold = qty * avgCostBefore;
      const realizedPnL = revenue - costOfSharesSold;

      holding.qty = Math.max(0, holding.qty - qty);
      holding.totalCost = holding.qty * avgCostBefore;
      if (holding.qty === 0) {
        holding.totalCost = 0;
      }

      statsMap[trade.id] = {
        avgCostBasis: avgCostBefore,
        realizedPnL: realizedPnL,
        unrealizedPnL: 0,
        feeAmount: feeAmount
      };
    }
  });

  return statsMap;
};

/**
 * Compute advanced trading analytics (Win rate, Profit factor, Avg win/loss, R:R).
 */
export const computeTradingAnalytics = (trades = [], statsMap = {}, liveRates = {}, displayCurrency = 'THB') => {
  const totalTrades = trades.length;
  const buysCount = trades.filter(t => (t.action || '').toLowerCase() === 'buy').length;
  const sellsCount = trades.filter(t => (t.action || '').toLowerCase() === 'sell').length;

  let winCount = 0;
  let lossCount = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let maxWinVal = 0;
  let maxLossVal = 0;

  trades.forEach(trade => {
    const stats = statsMap[trade.id];
    if (!stats) return;

    const rateToTHB = liveRates[trade.currency] || 1.0;
    const displayRateToTHB = liveRates[displayCurrency] || 1.0;

    if ((trade.action || '').toLowerCase() === 'sell') {
      const realizedPnLConverted = (stats.realizedPnL * rateToTHB) / displayRateToTHB;

      if (realizedPnLConverted > 0.01) {
        winCount++;
        grossProfit += realizedPnLConverted;
        if (realizedPnLConverted > maxWinVal) {
          maxWinVal = realizedPnLConverted;
        }
      } else if (realizedPnLConverted < -0.01) {
        lossCount++;
        grossLoss += Math.abs(realizedPnLConverted);
        if (Math.abs(realizedPnLConverted) > maxLossVal) {
          maxLossVal = Math.abs(realizedPnLConverted);
        }
      }
    }
  });

  const totalClosedTrades = winCount + lossCount;
  const winRate = totalClosedTrades > 0 ? (winCount / totalClosedTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? Infinity : 1.0);
  const avgWin = winCount > 0 ? (grossProfit / winCount) : 0;
  const avgLoss = lossCount > 0 ? (grossLoss / lossCount) : 0;
  const riskRewardRatio = avgLoss > 0 ? (avgWin / avgLoss) : 0;

  return {
    totalTrades,
    buysCount,
    sellsCount,
    winCount,
    lossCount,
    totalClosedTrades,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    riskRewardRatio,
    maxWinVal,
    maxLossVal
  };
};

/**
 * Holding calculations for all unique assets, converted to the display currency.
 */
export const computePositions = (trades = [], livePrices = {}, liveRates = {}, displayCurrency = 'THB') => {
  const sorted = sortChronologically(trades);
  const runningHoldings = {}; // key: assetName -> running stats

  sorted.forEach(trade => {
    const name = trade.assetName;
    if (!name) return;

    if (!runningHoldings[name]) {
      runningHoldings[name] = {
        assetName: name,
        assetType: trade.assetType || 'Thai Stock',
        currency: trade.currency || 'THB',
        qty: 0,
        totalCost: 0,
        totalRealizedPnL: 0,
        totalBuyQty: 0,
        totalBuyCost: 0,
        totalSellQty: 0,
        totalSellRevenue: 0
      };
    }

    const holding = runningHoldings[name];
    const qty = Number(trade.quantity) || 0;
    const price = Number(trade.priceUnit) || 0;
    const isBuy = (trade.action || '').toLowerCase() === 'buy';

    const feeAmount = trade.feeAmount !== undefined ? Number(trade.feeAmount) : 0.0;

    if (isBuy) {
      const costBasis = qty * price + feeAmount;
      holding.totalBuyQty += qty;
      holding.totalBuyCost += costBasis;
      holding.qty += qty;
      holding.totalCost += costBasis;
    } else {
      const revenue = qty * price - feeAmount;
      holding.totalSellQty += qty;
      holding.totalSellRevenue += revenue;

      const avgCostBefore = holding.qty > 0 ? (holding.totalCost / holding.qty) : 0;
      const costOfSharesSold = qty * avgCostBefore;
      const realizedPnL = revenue - costOfSharesSold;

      holding.totalRealizedPnL += realizedPnL;
      holding.qty = Math.max(0, holding.qty - qty);
      holding.totalCost = holding.qty * avgCostBefore;
      if (holding.qty === 0) {
        holding.totalCost = 0;
      }
    }
  });

  return Object.values(runningHoldings).map(holding => {
    const qtyHeld = holding.qty;
    const wac = qtyHeld > 0 ? (holding.totalCost / qtyHeld) : 0;
    const totalCost = holding.totalCost;

    const livePrice = livePrices[holding.assetName] !== undefined && livePrices[holding.assetName] !== null
      ? livePrices[holding.assetName]
      : wac;

    const liveValue = qtyHeld * livePrice;
    const unrealizedPnL = liveValue - totalCost;
    const realizedPnL = holding.totalRealizedPnL;

    const rateToTHB = liveRates[holding.currency] || 1.0;
    const displayRateToTHB = liveRates[displayCurrency] || 1.0;

    const totalCostConverted = (totalCost * rateToTHB) / displayRateToTHB;
    const liveValueConverted = (liveValue * rateToTHB) / displayRateToTHB;
    const unrealizedPnLConverted = (unrealizedPnL * rateToTHB) / displayRateToTHB;
    const realizedPnLConverted = (realizedPnL * rateToTHB) / displayRateToTHB;
    const totalPnLConverted = unrealizedPnLConverted + realizedPnLConverted;
    const wacConverted = (wac * rateToTHB) / displayRateToTHB;
    const livePriceConverted = (livePrice * rateToTHB) / displayRateToTHB;

    return {
      ...holding,
      qtyHeld,
      wac,
      totalCost,
      livePrice,
      liveValue,
      unrealizedPnL,
      realizedPnL,
      wacConverted,
      livePriceConverted,
      totalCostConverted,
      liveValueConverted,
      unrealizedPnLConverted,
      realizedPnLConverted,
      totalPnLConverted,
      unrealizedPnLPct: totalCost > 0 ? (unrealizedPnL / totalCost) * 100 : 0
    };
  });
};

/**
 * Aggregate portfolio KPIs.
 */
export const computeKpis = (positions = []) => {
  let totalInvestedConverted = 0;
  let currentMarketValueConverted = 0;
  let totalUnrealizedPnLConverted = 0;
  let totalRealizedPnLConverted = 0;

  positions.forEach(pos => {
    if (pos.qtyHeld > 0) {
      totalInvestedConverted += pos.totalCostConverted;
      currentMarketValueConverted += pos.liveValueConverted;
      totalUnrealizedPnLConverted += pos.unrealizedPnLConverted;
    }
    totalRealizedPnLConverted += pos.realizedPnLConverted;
  });

  const totalPnLConverted = totalUnrealizedPnLConverted + totalRealizedPnLConverted;
  const totalPnLPct = totalInvestedConverted > 0 ? (totalPnLConverted / totalInvestedConverted) * 100 : 0;

  return {
    totalInvestedConverted,
    currentMarketValueConverted,
    totalUnrealizedPnLConverted,
    totalRealizedPnLConverted,
    totalPnLConverted,
    totalPnLPct
  };
};

/**
 * Portfolio sizing and cash balance calculations.
 */
export const computePortfolioSizing = ({
  portfolios = [],
  activePortfolio = 'All Portfolios',
  configs = {},
  kpis = {},
  positions = []
}) => {
  let initialCapital = 0;
  let targetStocks = 0;

  if (activePortfolio === 'All Portfolios') {
    portfolios.forEach(p => {
      const c = configs[p] || { initialCapital: 2000000, targetStocks: 50 };
      initialCapital += c.initialCapital;
      targetStocks += c.targetStocks;
    });
    if (portfolios.length === 0) {
      initialCapital = 2000000;
      targetStocks = 50;
    }
  } else {
    const c = configs[activePortfolio] || { initialCapital: 2000000, targetStocks: 50 };
    initialCapital = c.initialCapital;
    targetStocks = c.targetStocks;
  }

  const totalRealizedPnL = kpis.totalRealizedPnLConverted || 0;
  const totalInvested = kpis.totalInvestedConverted || 0;

  const cashOnHand = initialCapital - totalInvested + totalRealizedPnL;
  const positionSizeBalance = targetStocks > 0 ? (initialCapital + totalRealizedPnL) / targetStocks : 0;
  const positionSizeCash = targetStocks > 0 ? (cashOnHand + totalRealizedPnL) / targetStocks : 0;
  const activeHoldingsCount = positions.filter(pos => pos.qtyHeld > 0).length;

  return {
    initialCapital,
    targetStocks,
    cashOnHand,
    positionSizeBalance,
    positionSizeCash,
    activeHoldingsCount
  };
};

/**
 * Cumulative Realized P&L over time.
 */
export const computeCumulativeRealized = (trades = [], liveRates = {}, displayCurrency = 'THB') => {
  const sortedTrades = sortChronologically(trades);
  const assetState = {};
  let runningRealizedPnL = 0;
  const datePnLMap = {};

  sortedTrades.forEach(trade => {
    const name = trade.assetName;
    const qty = Number(trade.quantity) || 0;
    const price = Number(trade.priceUnit) || 0;
    const action = (trade.action || '').toLowerCase();
    const date = trade.date;

    if (!assetState[name]) {
      assetState[name] = { qty: 0, totalCost: 0 };
    }
    const state = assetState[name];

    const rateToTHB = liveRates[trade.currency] || 1.0;
    const displayRateToTHB = liveRates[displayCurrency] || 1.0;

    if (action === 'buy') {
      state.qty += qty;
      state.totalCost += qty * price;
    } else if (action === 'sell') {
      const wac = state.qty > 0 ? (state.totalCost / state.qty) : 0;
      const realized = (price - wac) * qty;
      const realizedConverted = (realized * rateToTHB) / displayRateToTHB;
      runningRealizedPnL += realizedConverted;

      state.qty = Math.max(0, state.qty - qty);
      state.totalCost = Math.max(0, state.totalCost - (qty * wac));
    }

    datePnLMap[date] = Number(runningRealizedPnL.toFixed(2));
  });

  const sortedDates = Object.keys(datePnLMap).sort((a, b) => dayjs(a).unix() - dayjs(b).unix());

  return sortedDates.map(date => ({
    date: dayjs(date).format('MMM DD, YYYY'),
    PnL: datePnLMap[date]
  }));
};

/**
 * P&L by Dimension (Strategy, Category, or Asset Name).
 */
export const computePnlByDimension = (
  trades = [],
  livePrices = {},
  liveRates = {},
  displayCurrency = 'THB',
  pnlDimension = 'strategy'
) => {
  const groupings = {};

  trades.forEach(trade => {
    let key = 'Unspecified';
    if (pnlDimension === 'strategy') {
      key = trade.why || 'Unspecified';
    } else if (pnlDimension === 'type') {
      key = trade.assetType || 'Thai Stock';
    } else if (pnlDimension === 'name') {
      key = trade.assetName;
    }

    const qty = Number(trade.quantity) || 0;
    const buyPrice = Number(trade.priceUnit) || 0;
    const asset = trade.assetName;

    const livePrice = livePrices[asset] !== undefined && livePrices[asset] !== null
      ? livePrices[asset]
      : buyPrice;

    const rateToTHB = liveRates[trade.currency] || 1.0;
    const displayRateToTHB = liveRates[displayCurrency] || 1.0;

    let pnlConverted = 0;
    if ((trade.action || '').toLowerCase() === 'buy') {
      pnlConverted = ((livePrice - buyPrice) * qty * rateToTHB) / displayRateToTHB;
    } else if ((trade.action || '').toLowerCase() === 'sell') {
      pnlConverted = ((buyPrice - livePrice) * qty * rateToTHB) / displayRateToTHB;
    }

    groupings[key] = (groupings[key] || 0) + pnlConverted;
  });

  return Object.keys(groupings).map(key => ({
    name: key,
    PnL: Number(groupings[key].toFixed(2))
  }));
};
