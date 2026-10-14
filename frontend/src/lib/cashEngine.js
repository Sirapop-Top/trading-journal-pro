import dayjs from 'dayjs';

/**
 * Checks whether any opening deposit exists for the selected portfolio.
 */
export const hasDeposit = (portfolio = 'All Portfolios', cashEntries = []) => {
  if (!Array.isArray(cashEntries) || cashEntries.length === 0) return false;
  if (portfolio === 'All Portfolios') {
    return cashEntries.some(e => (e.kind || '').toLowerCase() === 'deposit');
  }
  return cashEntries.some(
    e => (e.portfolio || '').trim() === portfolio.trim() && (e.kind || '').toLowerCase() === 'deposit'
  );
};

/**
 * Calculate net flow for a single cash entry in display currency.
 * Returns signed amount in display currency (e.g. + for Deposit/Dividend/Interest, - for Withdraw/Fee/Tax).
 */
export const getCashFlowForEntry = (entry = {}, liveRates = {}, displayCurrency = 'THB') => {
  const kind = (entry.kind || '').toLowerCase();
  const gross = Number(entry.gross) || 0;
  const wht = Number(entry.withholdingTax) || 0;
  const net = (entry.net !== undefined && entry.net !== null && entry.net !== '') ? Number(entry.net) : (gross - wht);
  
  const fx = (entry.fxToThb !== undefined && entry.fxToThb !== null && !isNaN(Number(entry.fxToThb)) && Number(entry.fxToThb) > 0)
    ? Number(entry.fxToThb)
    : (liveRates[entry.currency] || 1.0);
  const displayRate = liveRates[displayCurrency] || 1.0;
  const netConverted = (net * fx) / displayRate;

  switch (kind) {
    case 'deposit':
    case 'dividend':
    case 'interest':
      return netConverted;
    case 'withdraw':
    case 'fee':
    case 'tax':
      return -netConverted;
    default:
      return 0;
  }
};

/**
 * Calculate cash flow resulting from a trade execution in display currency.
 * Buy: cash spent = (qty * price + fee) -> negative flow.
 * Sell: cash received = (qty * price - fee) -> positive flow.
 */
export const getCashFlowForTrade = (trade = {}, liveRates = {}, displayCurrency = 'THB') => {
  const action = (trade.action || '').toLowerCase();
  const qty = Number(trade.quantity) || 0;
  const price = Number(trade.priceUnit) || 0;
  const fee = Number(trade.feeAmount) || 0;

  const fx = (trade.fxToThb !== undefined && trade.fxToThb !== null && !isNaN(Number(trade.fxToThb)) && Number(trade.fxToThb) > 0)
    ? Number(trade.fxToThb)
    : (liveRates[trade.currency] || 1.0);
  const displayRate = liveRates[displayCurrency] || 1.0;

  if (action === 'buy') {
    const cashSpent = qty * price + fee;
    return -((cashSpent * fx) / displayRate);
  } else if (action === 'sell') {
    const cashReceived = qty * price - fee;
    return +((cashReceived * fx) / displayRate);
  }
  return 0;
};

/**
 * Filter items by portfolio (supporting 'All Portfolios').
 */
export const filterByPortfolio = (items = [], portfolio = 'All Portfolios') => {
  if (!portfolio || portfolio === 'All Portfolios') return items;
  return items.filter(item => (item.portfolio || '').trim() === portfolio.trim());
};

/**
 * Compute portfolio cash balance.
 * If no opening deposit has been logged, falls back to legacy cash formula.
 */
export const computeCashBalance = ({
  portfolio = 'All Portfolios',
  cashEntries = [],
  trades = [],
  liveRates = {},
  displayCurrency = 'THB',
  fallbackCashOnHand = 0
}) => {
  const depositExists = hasDeposit(portfolio, cashEntries);
  if (!depositExists) {
    return {
      cashBalance: fallbackCashOnHand,
      hasDeposit: false,
      isFallback: true
    };
  }

  const pEntries = filterByPortfolio(cashEntries, portfolio);
  const pTrades = filterByPortfolio(trades, portfolio);

  let balance = 0;
  pEntries.forEach(entry => {
    balance += getCashFlowForEntry(entry, liveRates, displayCurrency);
  });
  pTrades.forEach(trade => {
    balance += getCashFlowForTrade(trade, liveRates, displayCurrency);
  });

  return {
    cashBalance: balance,
    hasDeposit: true,
    isFallback: false
  };
};

/**
 * Generate chronological statement with running balance.
 */
export const computeCashLedgerStatement = ({
  portfolio = 'All Portfolios',
  cashEntries = [],
  trades = [],
  liveRates = {},
  displayCurrency = 'THB'
}) => {
  const pEntries = filterByPortfolio(cashEntries, portfolio);
  const pTrades = filterByPortfolio(trades, portfolio);

  // Normalize entries into unified timeline objects
  const timeline = [];

  pEntries.forEach(entry => {
    const flow = getCashFlowForEntry(entry, liveRates, displayCurrency);
    const gross = Number(entry.gross) || 0;
    const wht = Number(entry.withholdingTax) || 0;
    const net = (entry.net !== undefined && entry.net !== null && entry.net !== '') ? Number(entry.net) : (gross - wht);

    let desc = entry.kind || 'Cash Entry';
    if (entry.asset) {
      desc = `${entry.kind}: ${entry.asset}`;
    }
    if (entry.note) {
      desc += ` (${entry.note})`;
    }

    timeline.push({
      id: entry.entryId || `entry-${Math.random()}`,
      date: entry.date || '',
      created: entry.created || entry.date || '',
      portfolio: entry.portfolio,
      kind: entry.kind,
      asset: entry.asset || '',
      currency: entry.currency || 'THB',
      gross,
      withholdingTax: wht,
      net,
      fxToThb: entry.fxToThb || 1.0,
      flowConverted: flow,
      description: desc,
      isTrade: false,
      rawItem: entry
    });
  });

  pTrades.forEach(trade => {
    const flow = getCashFlowForTrade(trade, liveRates, displayCurrency);
    const action = trade.action || 'Trade';
    const desc = `${action} ${trade.assetName} (${trade.quantity} @ ${trade.priceUnit})`;

    timeline.push({
      id: `trade-${trade.id}`,
      date: trade.date || '',
      created: trade.timestamp || trade.date || '',
      portfolio: trade.portfolio,
      kind: `Trade ${action}`,
      asset: trade.assetName || '',
      currency: trade.currency || 'THB',
      gross: (Number(trade.quantity) || 0) * (Number(trade.priceUnit) || 0),
      withholdingTax: 0,
      net: Math.abs(flow),
      fxToThb: trade.fxToThb || (liveRates[trade.currency] || 1.0),
      flowConverted: flow,
      description: desc,
      isTrade: true,
      rawItem: trade
    });
  });

  // Sort timeline chronologically: date ASC, then created ASC
  timeline.sort((a, b) => {
    const dateComp = (a.date || '').localeCompare(b.date || '');
    if (dateComp !== 0) return dateComp;
    return (a.created || '').localeCompare(b.created || '');
  });

  let running = 0;
  return timeline.map(item => {
    running += item.flowConverted;
    return {
      ...item,
      runningBalance: running
    };
  });
};

/**
 * Compute Cash & Income KPIs.
 * Total Return = Realized + Unrealized + Net Dividends + Net Interest - Ledger Fees - Ledger Taxes
 */
export const computeCashKpis = ({
  portfolio = 'All Portfolios',
  cashEntries = [],
  trades = [],
  liveRates = {},
  displayCurrency = 'THB',
  realizedPnLConverted = 0,
  unrealizedPnLConverted = 0,
  fallbackCashOnHand = 0
}) => {
  const pEntries = filterByPortfolio(cashEntries, portfolio);
  const currentYear = dayjs().year();
  const displayRate = liveRates[displayCurrency] || 1.0;

  let totalDeposits = 0;
  let totalWithdraws = 0;
  let dividendsYTD = 0;
  let interestYTD = 0;
  let totalDividendsEver = 0;
  let totalInterestEver = 0;
  let totalLedgerFees = 0;
  let totalLedgerTaxes = 0;

  pEntries.forEach(entry => {
    const kind = (entry.kind || '').toLowerCase();
    const gross = Number(entry.gross) || 0;
    const wht = Number(entry.withholdingTax) || 0;
    const net = (entry.net !== undefined && entry.net !== null && entry.net !== '') ? Number(entry.net) : (gross - wht);
    const fx = (entry.fxToThb !== undefined && entry.fxToThb !== null && !isNaN(Number(entry.fxToThb)) && Number(entry.fxToThb) > 0)
      ? Number(entry.fxToThb)
      : (liveRates[entry.currency] || 1.0);
    const netConverted = (net * fx) / displayRate;

    const entryYear = entry.date ? dayjs(entry.date).year() : currentYear;

    if (kind === 'deposit') {
      totalDeposits += netConverted;
    } else if (kind === 'withdraw') {
      totalWithdraws += netConverted;
    } else if (kind === 'dividend') {
      totalDividendsEver += netConverted;
      if (entryYear === currentYear) {
        dividendsYTD += netConverted;
      }
    } else if (kind === 'interest') {
      totalInterestEver += netConverted;
      if (entryYear === currentYear) {
        interestYTD += netConverted;
      }
    } else if (kind === 'fee') {
      totalLedgerFees += netConverted;
    } else if (kind === 'tax') {
      totalLedgerTaxes += netConverted;
    }
  });

  const netDeposits = totalDeposits - totalWithdraws;
  const depositExists = hasDeposit(portfolio, cashEntries);

  const { cashBalance, isFallback } = computeCashBalance({
    portfolio,
    cashEntries,
    trades,
    liveRates,
    displayCurrency,
    fallbackCashOnHand
  });

  const totalReturn = (realizedPnLConverted || 0)
    + (unrealizedPnLConverted || 0)
    + totalDividendsEver
    + totalInterestEver
    - totalLedgerFees
    - totalLedgerTaxes;

  return {
    hasDeposit: depositExists,
    isFallback,
    cashBalance,
    netDeposits,
    totalDeposits,
    totalWithdraws,
    dividendsYTD,
    interestYTD,
    totalDividendsEver,
    totalInterestEver,
    totalLedgerFees,
    totalLedgerTaxes,
    totalReturn
  };
};

/**
 * Suggest Thai stock dividend withholding tax (default 10%).
 */
export const calculateDefaultWht = (gross = 0, assetType = 'Thai Stock', currency = 'THB') => {
  const g = Number(gross) || 0;
  if (g <= 0) return 0;
  if (currency === 'THB' || assetType === 'Thai Stock') {
    return Number((g * 0.10).toFixed(2));
  }
  return 0;
};
