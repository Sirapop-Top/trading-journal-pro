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

  const validSymbols = symbols.map(s => String(s || '').replace(/:S1X|:SHORT/gi, '').trim().toUpperCase()).filter(Boolean);
  if (validSymbols.length === 0) return prices;

  const fetchWithTimeout = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  };

  try {
    let res;
    try {
      res = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/price');
    } catch {
      res = await fetchWithTimeout('https://data-api.binance.vision/api/v3/ticker/price');
    }

    if (res && res.ok) {
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
 * Fetch live Yahoo Finance prices & FX rates directly from Vite local endpoint (/api/yahoo-live)
 * or public CORS proxy fallback when Google Apps Script is not yet configured.
 */
export const fetchYahooLiveBrowser = async (trades = []) => {
  const symbols = new Set(['USDTHB=X', 'EURTHB=X']);
  (trades || []).forEach(t => {
    const clean = String(t.assetName || '').replace(/:S1X|:SHORT/gi, '').trim().toUpperCase();
    if (!clean) return;
    const typeLower = String(t.assetType || '').toLowerCase();
    if (typeLower.includes('crypto')) {
      symbols.add(clean.endsWith('-USD') ? clean : `${clean}-USD`);
    } else if (typeLower.includes('thai') || (t.currency === 'THB' && !typeLower.includes('global') && !typeLower.includes('us'))) {
      symbols.add(clean.endsWith('.BK') ? clean : `${clean}.BK`);
    } else {
      symbols.add(clean);
    }
  });

  const symList = Array.from(symbols);

  // 1. Try local Vite server / preview server live Yahoo endpoint first
  try {
    const res = await fetch(`/api/yahoo-live?symbols=${encodeURIComponent(symList.join(','))}`);
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.ok && data.livePrices) {
          return { livePrices: data.livePrices, liveRates: data.liveRates };
        }
      }
    }
  } catch {
    // Ignore when running on static hosting without /api/yahoo-live
  }

  return null;
};

/**
 * Fetch live market prices and rates from Apps Script.
 * Uses GET ?action=getData first (compatible with both V.เก่า and V.2.6 Apps Script),
 * falling back to POST if needed.
 */
export const fetchLiveData = async (scriptUrl) => {
  if (!scriptUrl) return null;
  const cleanUrl = scriptUrl.trim();
  const separator = cleanUrl.includes('?') ? '&' : '?';

  try {
    const getRes = await callGoogleAppsScript(`${cleanUrl}${separator}action=getData`);
    if (getRes && (getRes.livePrices || getRes.liveRates || getRes.trades || getRes.syncTime)) {
      return getRes;
    }
  } catch (getErr) {
    console.warn('fetchLiveData GET attempt failed, trying POST fallback:', getErr);
  }

  const postRes = await postAction(cleanUrl, 'getData');
  return postRes;
};

/**
 * Diagnostic helper to test Google Apps Script Web App connection and live price delivery.
 */
export const testGoogleAppsScript = async (scriptUrl) => {
  if (!scriptUrl || !scriptUrl.trim()) {
    return { ok: false, error: 'Apps Script URL is empty. Please enter your Web App URL.' };
  }
  const cleanUrl = scriptUrl.trim();
  if (!cleanUrl.startsWith('https://script.google.com')) {
    return { ok: false, error: 'Invalid URL format. The Web App URL must start with https://script.google.com' };
  }

  try {
    const data = await fetchLiveData(cleanUrl);
    if (!data) {
      return { ok: false, error: 'Web App returned empty response.' };
    }
    if (data.error) {
      return { ok: false, error: data.error };
    }
    return {
      ok: true,
      schemaVersion: data.schemaVersion || '1.0',
      livePrices: data.livePrices || {},
      liveRates: data.liveRates || {},
      tradesCount: Array.isArray(data.trades) ? data.trades.length : 0,
      priceDiagnostics: data.priceDiagnostics || {}
    };
  } catch (err) {
    let errorHelp = err.message || String(err);
    if (errorHelp.includes('Failed to fetch') || errorHelp.includes('NetworkError') || errorHelp.includes('CORS')) {
      errorHelp = 'Connection blocked by Google authentication (CORS). Please verify that in Google Apps Script > Deploy > Manage deployments, "Who has access" is set to "Anyone" (not "Only myself").';
    }
    return { ok: false, error: errorHelp };
  }
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
  if (!scriptUrl) return { success: false, history: {} };
  const cleanUrl = scriptUrl.trim();
  const separator = cleanUrl.includes('?') ? '&' : '?';
  const symParam = Array.isArray(symbols) ? symbols.join(',') : String(symbols || '');

  try {
    const getRes = await callGoogleAppsScript(
      `${cleanUrl}${separator}action=getHistory&symbols=${encodeURIComponent(symParam)}&range=${encodeURIComponent(range)}`
    );
    if (getRes && getRes.history) {
      return getRes;
    }
  } catch (getErr) {
    console.warn('fetchHistoryApi GET attempt failed, trying POST fallback:', getErr);
  }

  try {
    return await postAction(cleanUrl, 'getHistory', { symbols, range });
  } catch (err) {
    console.error('fetchHistoryApi error:', err);
    return { success: false, history: {} };
  }
};


