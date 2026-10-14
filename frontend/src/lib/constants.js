/**
 * Global constant definitions and design tokens.
 */
export const ASSET_TYPE_COLORS = {
  'Thai Stock': '#00f2fe',
  'Global Stock': '#3b82f6',
  'Crypto': '#f59e0b',
  'Crypto Short 1x': '#f43f5e'
};

export const CURRENCY_SYMBOLS = {
  'THB': '฿',
  'USD': '$',
  'EUR': '€'
};

export const DEFAULT_PORTFOLIO_CONFIG = {
  initialCapital: 2000000,
  targetStocks: 50
};

export const STANDARD_STRATEGIES = [
  'CDC Action Zone',
  'Breakout',
  'EMA Cross',
  'Support/Resistance Bounce',
  'Rebalance'
];

export const formatCurrency = (val, currencyCode = 'THB', isCensored = false) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '-';
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode || '';
  if (isCensored) return `${symbol} ****`;
  const formattedNum = Number(val).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${symbol} ${formattedNum}`.trim();
};
