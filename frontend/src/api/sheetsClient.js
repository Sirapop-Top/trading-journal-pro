/**
 * Google Sheets and Apps Script API Client
 */
import { parseCSV } from '../lib/csv.js';

/**
 * Low-level HTTP helper to communicate with Google Apps Script Web App
 * Uses text/plain to prevent CORS preflight OPTIONS requests.
 */
export const callGoogleAppsScript = async (url, payload = null) => {
  if (payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } else {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  }
};

/**
 * Fetch a Google Sheet tab directly as CSV using the Google Visualization API.
 * If the tab does not exist yet (e.g. newly introduced Rebalance tabs), returns empty array.
 */
export const fetchSheetCsv = async (sheetId, tabName = 'Journal') => {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
  try {
    const response = await fetch(csvUrl);
    if (!response.ok) {
      if (tabName !== 'Journal') {
        return [];
      }
      throw new Error(`Google Sheets responded with HTTP status ${response.status}`);
    }
    const csvText = await response.text();
    // gviz returns HTML error response if sheet tab not found
    if (csvText.includes('<!DOCTYPE html>') || csvText.includes('google.visualization.Query.setResponse')) {
      if (tabName !== 'Journal') return [];
    }
    return parseCSV(csvText);
  } catch (err) {
    if (tabName !== 'Journal') return [];
    throw err;
  }
};

/**
 * Fetch live fiat currency exchange rates from open.er-api.com
 */
export const fetchExchangeRates = async () => {
  try {
    const rateRes = await fetch('https://open.er-api.com/v6/latest/USD');
    if (rateRes.ok) {
      const rateData = await rateRes.json();
      const usdToThb = rateData.rates.THB || 32.69;
      const eurToThb = (rateData.rates.THB / (rateData.rates.EUR || 1.0)) || 38.04;
      return { THB: 1.0, USD: usdToThb, EUR: eurToThb };
    }
  } catch (err) {
    console.error('Live rates API error:', err);
  }
  return { THB: 1.0, USD: 32.69, EUR: 38.04 };
};

/**
 * Fetch live crypto prices directly from Binance public API (CORS enabled worldwide).
 * Supports symbols like BTC, ETH, SOL, BNB, XRP, DOGE, etc.
 */
export const fetchBinanceCryptoPrices = async (symbols = []) => {
  const prices = {};
  if (!symbols || symbols.length === 0) return prices;

  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/price');
    if (res.ok) {
      const data = await res.json();
      const tickerMap = {};
      data.forEach(item => {
        tickerMap[item.symbol] = parseFloat(item.price);
      });

      symbols.forEach(sym => {
        if (!sym) return;
        const cleanSym = String(sym).replace(/:S1X|:SHORT/gi, '').trim().toUpperCase();
        const usdtPair = cleanSym + 'USDT';
        const usdPair = cleanSym + 'USD';
        const price = tickerMap[usdtPair] || tickerMap[usdPair];
        if (price !== undefined && !isNaN(price)) {
          prices[sym] = price;
          prices[cleanSym] = price;
          prices[cleanSym + ':S1X'] = price;
        }
      });
    }
  } catch (err) {
    console.warn('Binance crypto price fetch note:', err);
  }
  return prices;
};

/**
 * Fetch live market prices and rates from Apps Script
 * Tries POST action getData first (bypasses browser CORS & redirect issues),
 * falling back gracefully to GET if necessary.
 */
export const fetchLiveData = async (scriptUrl) => {
  if (!scriptUrl) return null;
  const cleanUrl = scriptUrl.trim();
  
  // Attempt POST first: Content-Type: text/plain prevents CORS preflight and follows Apps Script redirects seamlessly
  try {
    const postRes = await postAction(cleanUrl, 'getData');
    if (postRes && (postRes.livePrices || postRes.liveRates || postRes.trades || postRes.syncTime)) {
      return postRes;
    }
  } catch (postErr) {
    console.warn('fetchLiveData POST attempt failed, trying GET fallback:', postErr);
  }

  // Fallback to GET
  const separator = cleanUrl.includes('?') ? '&' : '?';
  return await callGoogleAppsScript(`${cleanUrl}${separator}action=getData`);
};

/**
 * Post an action to Google Apps Script Web App
 */
export const postAction = async (scriptUrl, action, data = {}) => {
  if (!scriptUrl) {
    throw new Error('Google Apps Script URL is missing.');
  }
  return await callGoogleAppsScript(scriptUrl, { action, ...data });
};

/**
 * Validate a ticker symbol on Yahoo Finance through Apps Script
 */
export const validateTickerApi = async (scriptUrl, symbol, assetType) => {
  return await postAction(scriptUrl, 'validateTicker', { symbol, assetType });
};

/**
 * Add a new trade row to Google Sheet
 */
export const addTradeApi = async (scriptUrl, trade) => {
  return await postAction(scriptUrl, 'addTrade', { trade });
};

/**
 * Delete a trade row from Google Sheet
 */
export const deleteTradeApi = async (scriptUrl, id) => {
  return await postAction(scriptUrl, 'deleteTrade', { id });
};

/**
 * Edit a trade row in Google Sheet (why, remark)
 */
export const editTradeApi = async (scriptUrl, id, updates) => {
  return await postAction(scriptUrl, 'editTrade', { id, ...updates });
};

/**
 * Add a custom portfolio
 */
export const addPortfolioApi = async (scriptUrl, portfolioName, initialCapital, targetStocks) => {
  return await postAction(scriptUrl, 'addPortfolio', { portfolioName, initialCapital, targetStocks });
};

/**
 * Update portfolio configuration (capital, target stocks)
 */
export const updatePortfolioConfigApi = async (scriptUrl, portfolioName, initialCapital, targetStocks) => {
  return await postAction(scriptUrl, 'updatePortfolioConfig', { portfolioName, initialCapital, targetStocks });
};

/**
 * Delete a custom portfolio
 */
export const deletePortfolioApi = async (scriptUrl, portfolioName) => {
  return await postAction(scriptUrl, 'deletePortfolio', { portfolioName });
};

/**
 * Rename a portfolio
 */
export const renamePortfolioApi = async (scriptUrl, oldName, newName) => {
  return await postAction(scriptUrl, 'renamePortfolio', { oldName, newName });
};

/**
 * Update portfolio assignment for a specific trade
 */
export const updateTradePortfolioApi = async (scriptUrl, tradeId, portfolio) => {
  return await postAction(scriptUrl, 'updateTradePortfolio', { tradeId, portfolio });
};

/**
 * Rebalance endpoints
 */
export const savePairApi = async (scriptUrl, pair) => {
  return await postAction(scriptUrl, 'savePair', { pair });
};

export const setPairStatusApi = async (scriptUrl, pairId, status) => {
  return await postAction(scriptUrl, 'setPairStatus', { pairId, status });
};

export const deletePairApi = async (scriptUrl, pairId) => {
  return await postAction(scriptUrl, 'deletePair', { pairId });
};

export const executeRebalanceApi = async (scriptUrl, rebalance) => {
  return await postAction(scriptUrl, 'executeRebalance', { rebalance });
};

export const revertRebalanceApi = async (scriptUrl, rebalanceId) => {
  return await postAction(scriptUrl, 'revertRebalance', { rebalanceId });
};

/**
 * Cash Ledger endpoints (Step 5 Accounting)
 */
export const addCashEntryApi = async (scriptUrl, entry) => {
  return await postAction(scriptUrl, 'addCashEntry', { entry });
};

export const editCashEntryApi = async (scriptUrl, entry) => {
  return await postAction(scriptUrl, 'editCashEntry', { entry });
};

export const deleteCashEntryApi = async (scriptUrl, entryId) => {
  return await postAction(scriptUrl, 'deleteCashEntry', { entryId });
};

export const addTradesBatchApi = async (scriptUrl, trades) => {
  return await postAction(scriptUrl, 'addTradesBatch', { trades });
};

export const fetchHistoryApi = async (scriptUrl, symbols, range = '1y') => {
  try {
    return await postAction(scriptUrl, 'getHistory', { symbols, range });
  } catch (err) {
    console.error('fetchHistoryApi error:', err);
    return { success: false, history: {} };
  }
};


