import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import { fetchSheetCsv, fetchExchangeRates, fetchLiveData } from '../api/sheetsClient.js';

export const useJournalData = () => {
  const [trades, setTrades] = useState([]);
  const [portfolios, setPortfolios] = useState(['Main Trading', 'BTC Stock', 'Crypto']);
  const [activePortfolio, setActivePortfolio] = useState('All Portfolios');
  const [displayCurrency, setDisplayCurrency] = useState('THB');
  const [livePrices, setLivePrices] = useState({});
  const [liveRates, setLiveRates] = useState({ THB: 1.0, USD: 32.69, EUR: 38.04 });
  const [syncTime, setSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isCensored, setIsCensored] = useState(false);
  const [rebalancePairs, setRebalancePairs] = useState([]);
  const [rebalanceLog, setRebalanceLog] = useState([]);

  const toggleCensored = useCallback(() => {
    setIsCensored(prev => !prev);
  }, []);

  const [googleSheetId, setGoogleSheetId] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('google_sheet_id') || '';
  });
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [googleSheetSyncCount, setGoogleSheetSyncCount] = useState(0);
  const [googleAppsScriptUrl, setGoogleAppsScriptUrl] = useState(() => {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('google_apps_script_url') || '';
  });
  const [cloudConnectionError, setCloudConnectionError] = useState(null);
  const [isConnected, setIsConnected] = useState(() => {
    if (typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem('google_sheet_id');
  });

  // Helper to fetch Google Sheet directly via CSV (CORS-friendly fallback)
  const fetchDirectFromGoogleSheet = useCallback(async (sheetId) => {
    const rows = await fetchSheetCsv(sheetId, 'Journal');

    if (rows.length <= 1) {
      setTrades([]);
      setGoogleSheetSyncCount(0);
      return;
    }

    const headers = rows[0].map(h => h.toString().toLowerCase().trim());

    const findColIdx = (keywords) => {
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i];
        for (const k of keywords) {
          if (h.indexOf(k) !== -1) return i;
        }
      }
      return -1;
    };

    const dateIdx = findColIdx(['date']);
    const assetNameIdx = findColIdx(['asset name', 'asset_name', 'asset']);
    const assetTypeIdx = findColIdx(['asset type', 'asset_type', 'type']);
    const currencyIdx = findColIdx(['currency']);
    const actionIdx = findColIdx(['action']);
    const quantityIdx = findColIdx(['quantity', 'qty']);
    const priceUnitIdx = findColIdx(['price/unit', 'price_unit', 'price unit', 'price']);
    const whyIdx = findColIdx(['why', 'decision', 'reason']);
    const remarkIdx = findColIdx(['remark', 'note']);
    const portfolioIdx = findColIdx(['portfolio', 'port']);
    const feeAmountIdx = findColIdx(['fee amount', 'fee_amount', 'fee']);
    const rebalanceIdIdx = findColIdx(['rebalance id', 'rebalance_id']);

    const loadedTrades = [];
    const loadedPortfolios = new Set();

    // Fetch Portfolios config sheet if it exists
    let customMappings = {};
    let customPortfoliosList = ['Main Trading', 'BTC Stock', 'Crypto'];
    try {
      const portRows = await fetchSheetCsv(sheetId, 'Portfolios');
      if (portRows.length > 1) {
        const pHeaders = portRows[0].map(h => h.toString().toLowerCase().trim());
        const assetCol = pHeaders.indexOf('asset name');
        const portCol = pHeaders.indexOf('portfolio');
        const namesCol = pHeaders.indexOf('portfolio names');
        const initialCapitalCol = pHeaders.indexOf('initial capital');
        const targetStocksCol = pHeaders.indexOf('target stocks');

        const tempPortfolios = new Set();
        const tempConfigs = {};

        for (let k = 1; k < portRows.length; k++) {
          const pRow = portRows[k];
          if (assetCol !== -1 && portCol !== -1 && pRow[assetCol] && pRow[portCol]) {
            const assetName = pRow[assetCol].toString().trim().toUpperCase();
            const portName = pRow[portCol].toString().trim();
            if (assetName && portName) {
              customMappings[assetName] = portName;
            }
          }
          if (namesCol !== -1 && pRow[namesCol]) {
            const pName = pRow[namesCol].toString().trim();
            if (pName) {
              tempPortfolios.add(pName);
              const capital = (initialCapitalCol !== -1 && pRow[initialCapitalCol])
                ? (parseFloat(pRow[initialCapitalCol]) || 2000000)
                : 2000000;
              const stocks = (targetStocksCol !== -1 && pRow[targetStocksCol])
                ? (parseInt(pRow[targetStocksCol], 10) || 50)
                : 50;
              tempConfigs[pName] = { initialCapital: capital, targetStocks: stocks };
            }
          }
        }

        if (tempPortfolios.size > 0) {
          customPortfoliosList = Array.from(tempPortfolios);
        }

        localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));
        localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(customPortfoliosList));
        localStorage.setItem('alphatrader_portfolio_configs', JSON.stringify(tempConfigs));
      }
    } catch {
      try {
        customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
        customPortfoliosList = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '["Main Trading", "BTC Stock", "Crypto"]');
      } catch {}
    }

    customPortfoliosList.forEach(p => loadedPortfolios.add(p));

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const assetName = assetNameIdx !== -1 && row[assetNameIdx] ? row[assetNameIdx].toString().trim() : '';
      if (!assetName) continue;

      let dateVal;
      if (dateIdx !== -1 && row[dateIdx]) {
        const d = row[dateIdx].toString().trim();
        dateVal = dayjs(d).isValid() ? dayjs(d).format('YYYY-MM-DD') : d;
      } else {
        dateVal = dayjs().format('YYYY-MM-DD');
      }

      const assetType = assetTypeIdx !== -1 && row[assetTypeIdx] ? row[assetTypeIdx].toString().trim() : '';

      let portfolio = 'Main Trading';
      if (portfolioIdx !== -1 && row[portfolioIdx]) {
        portfolio = row[portfolioIdx].toString().trim();
      } else if (assetType.toLowerCase() === 'crypto') {
        portfolio = 'Crypto';
      } else if (assetType.toLowerCase() === 'global stock' || assetType.toLowerCase() === 'us stock') {
        portfolio = 'BTC Stock';
      }

      if (portfolioIdx === -1 || !row[portfolioIdx]) {
        if (customMappings[assetName]) {
          portfolio = customMappings[assetName];
        }
      }

      const qty = quantityIdx !== -1 ? parseFloat(row[quantityIdx]) : 0;
      const price = priceUnitIdx !== -1 ? parseFloat(row[priceUnitIdx]) : 0;

      let parsedFee = 0.0;
      if (feeAmountIdx !== -1 && row[feeAmountIdx]) {
        try {
          const rawFee = row[feeAmountIdx].toString().replace('%', '').trim();
          parsedFee = parseFloat(rawFee) || 0.0;
        } catch {}
      }

      const rebalanceId = rebalanceIdIdx !== -1 && row[rebalanceIdIdx] ? row[rebalanceIdIdx].toString().trim() : '';

      loadedTrades.push({
        id: (i + 1).toString(),
        date: dateVal,
        portfolio,
        assetName,
        assetType,
        currency: currencyIdx !== -1 && row[currencyIdx] ? row[currencyIdx].toString().trim() : 'THB',
        action: actionIdx !== -1 && row[actionIdx] ? row[actionIdx].toString().trim() : 'Buy',
        quantity: isNaN(qty) ? 0 : qty,
        priceUnit: isNaN(price) ? 0 : price,
        why: whyIdx !== -1 && row[whyIdx] ? row[whyIdx].toString().trim() : '',
        remark: remarkIdx !== -1 && row[remarkIdx] ? row[remarkIdx].toString().trim() : '',
        feeAmount: parsedFee,
        rebalanceId
      });

      loadedPortfolios.add(portfolio);
    }

    setTrades(loadedTrades);
    setPortfolios(Array.from(loadedPortfolios));
    setGoogleSheetSyncCount(loadedTrades.length);

    // Fetch Rebalance Pairs
    let loadedPairs = [];
    try {
      const pairRows = await fetchSheetCsv(sheetId, 'Rebalance_Pairs');
      if (pairRows.length > 1) {
        const pH = pairRows[0].map(h => h.toString().toLowerCase().trim());
        const getVal = (r, k, def = '') => {
          const idx = pH.indexOf(k.toLowerCase());
          return idx !== -1 && r[idx] !== undefined && r[idx] !== '' ? r[idx] : def;
        };
        for (let r = 1; r < pairRows.length; r++) {
          const row = pairRows[r];
          const pId = getVal(row, 'pair id', '');
          if (!pId) continue;
          loadedPairs.push({
            pairId: String(pId),
            portfolio: String(getVal(row, 'portfolio', '')),
            pairName: String(getVal(row, 'pair name', '')),
            assetA: String(getVal(row, 'asset a', '')).toUpperCase(),
            assetAType: String(getVal(row, 'asset a type', 'Crypto')),
            assetACurrency: String(getVal(row, 'asset a currency', 'USD')),
            targetA: parseFloat(getVal(row, 'target a %', 50)) || 50,
            assetB: String(getVal(row, 'asset b', '')).toUpperCase(),
            assetBType: String(getVal(row, 'asset b type', 'Crypto Short 1x')),
            assetBCurrency: String(getVal(row, 'asset b currency', 'USD')),
            targetB: parseFloat(getVal(row, 'target b %', 50)) || 50,
            mode: String(getVal(row, 'trigger mode', 'Drift')),
            driftThreshold: parseFloat(getVal(row, 'drift threshold %', 5)) || 5,
            scheduleFrequency: String(getVal(row, 'schedule frequency', 'Monthly')),
            scheduleAnchor: String(getVal(row, 'schedule anchor', '')),
            lastRebalanced: String(getVal(row, 'last rebalanced', '')),
            customFee: getVal(row, 'custom fee', false) === true || String(getVal(row, 'custom fee', '')).toUpperCase() === 'TRUE',
            feeAMode: String(getVal(row, 'fee a mode', 'percent')),
            feeAValue: parseFloat(getVal(row, 'fee a value', 0)) || 0,
            feeBMode: String(getVal(row, 'fee b mode', 'percent')),
            feeBValue: parseFloat(getVal(row, 'fee b value', 0)) || 0,
            status: String(getVal(row, 'status', 'Active')),
            created: String(getVal(row, 'created', '')),
            notes: String(getVal(row, 'notes', ''))
          });
        }
      }
    } catch {
      // Non-critical if Rebalance_Pairs tab is not yet created
    }
    setRebalancePairs(loadedPairs);

    // Fetch Rebalance Log
    let loadedLog = [];
    try {
      const logRows = await fetchSheetCsv(sheetId, 'Rebalance_Log');
      if (logRows.length > 1) {
        const lH = logRows[0].map(h => h.toString().toLowerCase().trim());
        const getVal = (r, k, def = '') => {
          const idx = lH.indexOf(k.toLowerCase());
          return idx !== -1 && r[idx] !== undefined && r[idx] !== '' ? r[idx] : def;
        };
        for (let r = 1; r < logRows.length; r++) {
          const row = logRows[r];
          const rbId = getVal(row, 'rebalance id', '');
          if (!rbId) continue;
          loadedLog.push({
            rebalanceId: String(rbId),
            pairId: String(getVal(row, 'pair id', '')),
            portfolio: String(getVal(row, 'portfolio', '')),
            executedOn: String(getVal(row, 'executed on', '')),
            trigger: String(getVal(row, 'trigger', '')),
            sellAsset: String(getVal(row, 'sell asset', '')),
            sellQty: parseFloat(getVal(row, 'sell qty', 0)) || 0,
            sellPrice: parseFloat(getVal(row, 'sell price', 0)) || 0,
            sellFee: parseFloat(getVal(row, 'sell fee', 0)) || 0,
            buyAsset: String(getVal(row, 'buy asset', '')),
            buyQty: parseFloat(getVal(row, 'buy qty', 0)) || 0,
            buyPrice: parseFloat(getVal(row, 'buy price', 0)) || 0,
            buyFee: parseFloat(getVal(row, 'buy fee', 0)) || 0,
            valueMovedTHB: parseFloat(getVal(row, 'value moved thb', 0)) || 0,
            beforePctA: parseFloat(getVal(row, 'before a %', 0)) || 0,
            targetPctA: parseFloat(getVal(row, 'target a %', 0)) || 0,
            afterPctA: parseFloat(getVal(row, 'after a %', 0)) || 0,
            realizedPnLTHB: parseFloat(getVal(row, 'realized pnl thb', 0)) || 0,
            reason: String(getVal(row, 'reason', '')),
            status: String(getVal(row, 'status', 'Done')),
            created: String(getVal(row, 'created', ''))
          });
        }
      }
    } catch {
      // Non-critical if Rebalance_Log tab is not yet created
    }
    setRebalanceLog(loadedLog);

    const rates = await fetchExchangeRates();
    setLiveRates(rates);
    setSyncTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  }, []);

  // Fetch all trades, portfolios, prices, and rates
  const fetchData = useCallback(async () => {
    setIsSyncing(true);
    setCloudConnectionError(null);
    try {
      const sheetId = localStorage.getItem('google_sheet_id') || googleSheetId;
      if (!sheetId) {
        setCloudConnectionError('No Google Sheet ID configured. Please enter your Sheet ID in the setup screen.');
        setIsSyncing(false);
        return;
      }
      await fetchDirectFromGoogleSheet(sheetId);

      try {
        const scriptUrl = localStorage.getItem('google_apps_script_url');
        if (scriptUrl) {
          const data = await fetchLiveData(scriptUrl);
          if (data && data.livePrices) setLivePrices(data.livePrices);
          if (data && data.liveRates) setLiveRates(data.liveRates);
          if (data && Array.isArray(data.rebalancePairs) && data.rebalancePairs.length > 0) {
            setRebalancePairs(data.rebalancePairs);
          }
          if (data && Array.isArray(data.rebalanceLog) && data.rebalanceLog.length > 0) {
            setRebalanceLog(data.rebalanceLog);
          }
        }
      } catch (priceErr) {
        console.warn('Live prices from Apps Script unavailable, using WAC fallback:', priceErr);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to load data. Check your Google Sheet ID is correct and the sheet is shared publicly.');
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDirectFromGoogleSheet, googleSheetId]);

  // Sync Yahoo Finance Tickers
  const syncMarketData = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (!scriptUrl) {
        throw new Error('Google Apps Script URL is not configured in Settings.');
      }
      const data = await fetchLiveData(scriptUrl);
      if (data) {
        setLivePrices(data.livePrices || {});
        setLiveRates(data.liveRates || { THB: 1.0, USD: 32.69, EUR: 38.04 });
        if (Array.isArray(data.rebalancePairs) && data.rebalancePairs.length > 0) {
          setRebalancePairs(data.rebalancePairs);
        }
        if (Array.isArray(data.rebalanceLog) && data.rebalanceLog.length > 0) {
          setRebalanceLog(data.rebalanceLog);
        }
        if (data.syncTime) {
          setSyncTime(dayjs(data.syncTime).format('YYYY-MM-DD HH:mm:ss'));
        }
      }
      if (!silent) {
        message.success('Live market prices synced from Yahoo Finance.');
      }
    } catch (error) {
      console.error('Error syncing market data:', error);
      if (!silent) {
        message.error('Failed to sync live market data. Checking cache.');
      }
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  const handleSaveGoogleSheetSettings = useCallback(async () => {
    setIsSyncingSheet(true);
    try {
      localStorage.setItem('google_apps_script_url', googleAppsScriptUrl.trim());
      localStorage.setItem('google_sheet_id', googleSheetId.trim());
      message.success('Cloud sync settings saved to browser local storage!');
      await fetchData();
    } catch (err) {
      console.error('Error saving local cloud settings:', err);
      message.error('Failed to save cloud settings.');
    } finally {
      setIsSyncingSheet(false);
    }
  }, [fetchData, googleAppsScriptUrl, googleSheetId]);

  const handleSyncGoogleSheet = useCallback(async () => {
    setIsSyncingSheet(true);
    try {
      await fetchData();
      message.success('Refreshed data from cloud Google Sheets!');
    } catch (err) {
      console.error('Error refreshing cloud data:', err);
      message.error('Failed to refresh data.');
    } finally {
      setIsSyncingSheet(false);
    }
  }, [fetchData]);

  // Auto-refresh interval (60s)
  useEffect(() => {
    let interval = null;
    if (autoRefresh && trades.length > 0) {
      interval = setInterval(() => {
        syncMarketData(true);
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, trades.length, syncMarketData]);

  return {
    trades,
    setTrades,
    portfolios,
    setPortfolios,
    activePortfolio,
    setActivePortfolio,
    displayCurrency,
    setDisplayCurrency,
    livePrices,
    setLivePrices,
    liveRates,
    setLiveRates,
    syncTime,
    setSyncTime,
    isSyncing,
    setIsSyncing,
    autoRefresh,
    setAutoRefresh,
    isCensored,
    setIsCensored,
    toggleCensored,
    rebalancePairs,
    setRebalancePairs,
    rebalanceLog,
    setRebalanceLog,
    googleSheetId,
    setGoogleSheetId,
    isSyncingSheet,
    setIsSyncingSheet,
    googleSheetSyncCount,
    setGoogleSheetSyncCount,
    googleAppsScriptUrl,
    setGoogleAppsScriptUrl,
    cloudConnectionError,
    setCloudConnectionError,
    isConnected,
    setIsConnected,
    fetchData,
    syncMarketData,
    handleSaveGoogleSheetSettings,
    handleSyncGoogleSheet
  };
};
