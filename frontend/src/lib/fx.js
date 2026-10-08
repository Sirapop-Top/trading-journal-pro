/**
 * Multi-currency conversion helpers.
 * Rates are relative to THB (i.e. THB = 1.0, USD = 35.0, EUR = 38.0).
 */
export const convertCurrency = (amount, fromCurrency = 'THB', toCurrency = 'THB', rates = {}) => {
  const num = Number(amount) || 0;
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) return num;
  const fromRate = rates[fromCurrency] !== undefined ? Number(rates[fromCurrency]) : 1.0;
  const toRate = rates[toCurrency] !== undefined ? Number(rates[toCurrency]) : 1.0;
  if (toRate <= 0) return num;
  return (num * fromRate) / toRate;
};
