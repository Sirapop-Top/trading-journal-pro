import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import { fetchSheetCsv, fetchExchangeRates, fetchLiveData, fetchBinanceCryptoPrices, fetchYahooLiveBrowser } from '../api/sheetsClient.js';
import yahooSnapshot from '../data/yahooPricesSnapshot.json';

const isTestEnv = Boolean(import.meta.env && import.meta.env.VITEST);
const defaultYahooPrices = (!isTestEnv && yahooSnapshot && yahooSnapshot.livePrices) ? yahooSnapshot.livePrices : {};
const defaultYahooRates = (!isTestEnv && yahooSnapshot && yahooSnapshot.liveRates)
  ? yahooSnapshot.liveRates
  : { THB: 1.0, USD: 32.69, EUR: 38.04 };

export const useJournalData = () => {
  const [trades, setTrades] = useState([]);
  const [portfolios, setPortfolios] = useState(['Main Trading', 'BTC Stock', 'Crypto']);
  const [activePortfolio, setActivePortfolio] = useState('All Portfolios');
  const [displayCurrency, setDisplayCurrency] = useState('THB');
  const [manualPrices, setManualPrices] = useState(() => {
    if (typeof localStorage === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('alphatrader_manual_prices') || '{}');
    } catch {
      return {};
    }
  });
  const [priceSources, setPriceSources] = useState(() => {
    if (isTestEnv) return {};
    const initialSources = {};
    Object.keys(defaultYahooPrices).forEach(k => {
      initialSources[k.toUpperCase()] = 'yahoo';
    });
    if (typeof localStorage !== 'undefined') {
      try {
        const manual = JSON.parse(localStorage.getItem('alphatrader_manual_prices') || '{}');
        Object.keys(manual).forEach(k => {
          initialSources[k.toUpperCase()] = 'manual';
        });
      } catch {}
    }
    return initialSources;
  });
  const [isMarketModalOpen, setIsMarketModalOpen] = useState(false);

  const [livePrices, setLivePrices] = useState(() => {
    if (typeof localStorage === 'undefined') return { ...defaultYahooPrices };
    try {
      // Purge old stale caches (v1-v3 had sheet entry prices mixed in)
      localStorage.removeItem('alphatrader_live_prices');
      localStorage.removeItem('alphatrader_live_prices_v2');
      localStorage.removeItem('alphatrader_live_prices_v3');
      const cached = JSON.parse(localStorage.getItem('alphatrader_live_prices_v4') || '{}');
      const manual = JSON.parse(localStorage.getItem('alphatrader_manual_prices') || '{}');
      return { ...defaultYahooPrices, ...cached, ...manual };
    } catch {
      return { ...defaultYahooPrices };
    }
  });
  const [liveRates, setLiveRates] = useState(defaultYahooRates);
  const [syncTime, setSyncTime] = useState(() => (!isTestEnv && yahooSnapshot?.updatedAt ? dayjs(yahooSnapshot.updatedAt).format('YYYY-MM-DD HH:mm:ss') : null));
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isCensored, setIsCensored] = useState(false);
  const [rebalancePairs, setRebalancePairs] = useState([]);
  const [rebalanceLog, setRebalanceLog] = useState([]);
  const [cashLedger, setCashLedger] = useState([]);

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
    const fxToThbIdx = findColIdx(['fx to thb', 'fx_to_thb', 'fxtothb']);

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
        rebalanceId,
        fxToThb: fxToThbIdx !== -1 && row[fxToThbIdx] !== '' && !isNaN(parseFloat(row[fxToThbIdx])) ? parseFloat(row[fxToThbIdx]) : null
      });

      loadedPortfolios.add(portfolio);
    }

    setTrades(loadedTrades);
    setPortfolios(Array.from(loadedPortfolios));
    setGoogleSheetSyncCount(loadedTrades.length);

    // Fetch live Yahoo Finance prices via local Vite bridge if available
    let yahooLive = null;
    if (!isTestEnv) {
      yahooLive = await fetchYahooLiveBrowser(loadedTrades);
    }

    if (Object.keys(defaultYahooPrices).length > 0 || (yahooLive && Object.keys(yahooLive.livePrices || {}).length > 0)) {
      setLivePrices(prev => {
        const manual = (() => {
          try {
            return JSON.parse(localStorage.getItem('alphatrader_manual_prices') || '{}');
          } catch {
            return {};
          }
        })();
        const merged = { ...defaultYahooPrices, ...prev, ...(yahooLive?.livePrices || {}), ...manual };
        try {
          localStorage.setItem('alphatrader_live_prices_v4', JSON.stringify(merged));
        } catch {}
        return merged;
      });
    }

    // Direct Binance crypto fetch only for crypto assets
    const cryptoSymbols = Array.from(new Set(
      loadedTrades
        .filter(t => (t.assetType || '').toLowerCase().includes('crypto'))
        .map(t => t.assetName)
        .filter(Boolean)
    ));
    if (cryptoSymbols.length > 0) {
      try {
        const cryptoPrices = await fetchBinanceCryptoPrices(cryptoSymbols);
        if (Object.keys(cryptoPrices).length > 0) {
          setLivePrices(prev => {
            const merged = { ...prev, ...cryptoPrices };
            try {
              localStorage.setItem('alphatrader_live_prices_v4', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      } catch (cErr) {
        console.warn('Binance price fetch note in sheet load:', cErr);
      }
    }

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

    // Fetch Cash Ledger
    let loadedCashLedger = [];
    try {
      const cashRows = await fetchSheetCsv(sheetId, 'Cash_Ledger');
      if (cashRows.length > 1) {
        const cH = cashRows[0].map(h => h.toString().toLowerCase().trim());
        const getVal = (r, k, def = '') => {
          const idx = cH.indexOf(k.toLowerCase());
          return idx !== -1 && r[idx] !== undefined && r[idx] !== '' ? r[idx] : def;
        };
        for (let r = 1; r < cashRows.length; r++) {
          const row = cashRows[r];
          const entryId = getVal(row, 'entry id', '');
          if (!entryId) continue;
          let dateVal = getVal(row, 'entry date', '');
          if (dateVal && dayjs(dateVal).isValid()) {
            dateVal = dayjs(dateVal).format('YYYY-MM-DD');
          }
          loadedCashLedger.push({
            entryId: String(entryId),
            date: dateVal,
            portfolio: String(getVal(row, 'portfolio', 'Main Trading')),
            kind: String(getVal(row, 'kind', 'Deposit')),
            asset: String(getVal(row, 'asset', '')).toUpperCase(),
            currency: String(getVal(row, 'currency', 'THB')),
            gross: parseFloat(getVal(row, 'gross', 0)) || 0,
            withholdingTax: parseFloat(getVal(row, 'withholding tax', 0)) || 0,
            net: parseFloat(getVal(row, 'net', 0)) || 0,
            fxToThb: parseFloat(getVal(row, 'fx to thb', 1.0)) || 1.0,
            note: String(getVal(row, 'note', '')),
            created: String(getVal(row, 'created', ''))
          });
        }
      }
    } catch {
      // Non-critical if Cash_Ledger tab is not yet created
    }
    setCashLedger(loadedCashLedger);

    // Use Yahoo Finance USDTHB=X / EURTHB=X rate consistently so it matches Settings & Yahoo Finance
    if (yahooLive && yahooLive.liveRates) {
      setLiveRates(yahooLive.liveRates);
    } else if (!isTestEnv && yahooSnapshot?.liveRates) {
      setLiveRates(yahooSnapshot.liveRates);
    } else {
      const rates = await fetchExchangeRates();
      setLiveRates(rates);
    }
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
          if (data && data.livePrices) {
            setLivePrices(prev => {
              const merged = { ...prev, ...data.livePrices };
              try {
                localStorage.setItem('alphatrader_live_prices_v4', JSON.stringify(merged));
              } catch {}
              return merged;
            });
          }
          if (data && data.liveRates) setLiveRates(data.liveRates);
          if (data && Array.isArray(data.rebalancePairs) && data.rebalancePairs.length > 0) {
            setRebalancePairs(data.rebalancePairs);
          }
          if (data && Array.isArray(data.rebalanceLog) && data.rebalanceLog.length > 0) {
            setRebalanceLog(data.rebalanceLog);
          }
          if (data && Array.isArray(data.cashLedger) && data.cashLedger.length > 0) {
            setCashLedger(data.cashLedger);
          }
        }
      } catch (priceErr) {
        console.warn('Live prices from Apps Script unavailable, using Yahoo Finance snapshot/bridge:', priceErr);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to load data. Check your Google Sheet ID is correct and the sheet is shared publicly.');
    } finally {
      setIsSyncing(false);
    }
  }, [fetchDirectFromGoogleSheet, googleSheetId]);

  // Sync Live Market Prices (Yahoo Finance + Binance + FX)
  const syncMarketData = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    let updatedCount = 0;
    try {
      // 1. Direct client-side Binance crypto fetch ONLY for Crypto assets
      const cryptoSymbols = Array.from(new Set(
        trades
          .filter(t => (t.assetType || '').toLowerCase().includes('crypto'))
          .map(t => t.assetName)
          .filter(Boolean)
      ));
      let cryptoPrices = {};
      if (cryptoSymbols.length > 0) {
        try {
          cryptoPrices = await fetchBinanceCryptoPrices(cryptoSymbols);
        } catch (cErr) {
          console.warn('Direct Binance sync note:', cErr);
        }
      }

      // 2. Fetch from Google Apps Script if URL is configured
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      let scriptData = null;
      if (scriptUrl) {
        try {
          scriptData = await fetchLiveData(scriptUrl);
        } catch (sErr) {
          console.warn('Apps Script fetch note:', sErr);
        }
      }

      // 2b. Also check real-time Yahoo Finance local bridge if available
      let yahooLive = null;
      if (!isTestEnv) {
        yahooLive = await fetchYahooLiveBrowser(trades);
      }

      // 3. Currency exchange rates (Yahoo Finance USDTHB=X / EURTHB=X takes priority)
      let rates = null;
      if (scriptData && scriptData.liveRates) {
        rates = scriptData.liveRates;
      } else if (yahooLive && yahooLive.liveRates) {
        rates = yahooLive.liveRates;
      } else if (!isTestEnv && yahooSnapshot?.liveRates) {
        rates = yahooSnapshot.liveRates;
      } else {
        try {
          rates = await fetchExchangeRates();
        } catch (rErr) {
          console.warn('FX rates fetch note:', rErr);
        }
      }
      if (rates) setLiveRates(rates);

      // 4. Merge all prices with precedence: Manual > Apps Script / Live Yahoo > Binance (Crypto)
      const currentManual = (() => {
        try {
          return JSON.parse(localStorage.getItem('alphatrader_manual_prices') || '{}');
        } catch {
          return {};
        }
      })();

      const scriptPrices = {
        ...(yahooLive?.livePrices || {}),
        ...((scriptData && scriptData.livePrices) ? scriptData.livePrices : {})
      };
      const newPriceSources = {};
      Object.keys(defaultYahooPrices).forEach(k => {
        newPriceSources[k.toUpperCase()] = 'yahoo';
      });
      Object.keys(scriptPrices).forEach(k => {
        newPriceSources[k.toUpperCase()] = 'yahoo';
      });
      Object.keys(cryptoPrices).forEach(k => {
        newPriceSources[k.toUpperCase()] = 'binance';
      });
      Object.keys(currentManual).forEach(k => {
        newPriceSources[k.toUpperCase()] = 'manual';
      });
      setPriceSources(newPriceSources);

      const combinedPrices = {
        ...defaultYahooPrices,
        ...scriptPrices,
        ...cryptoPrices,
        ...currentManual
      };

      if (Object.keys(combinedPrices).length > 0) {
        setLivePrices(prev => {
          const next = { ...prev, ...combinedPrices };
          try {
            localStorage.setItem('alphatrader_live_prices_v4', JSON.stringify(next));
          } catch {}
          return next;
        });

        // Distinct asset count updated
        const baseUpdatedSymbols = new Set(
          Object.keys(combinedPrices).map(s => s.replace(/:S1X|:SHORT/gi, '').replace(/\.BK$/i, '').trim().toUpperCase())
        );
        updatedCount = baseUpdatedSymbols.size;
      }

      if (scriptData) {
        if (Array.isArray(scriptData.rebalancePairs) && scriptData.rebalancePairs.length > 0) {
          setRebalancePairs(scriptData.rebalancePairs);
        }
        if (Array.isArray(scriptData.rebalanceLog) && scriptData.rebalanceLog.length > 0) {
          setRebalanceLog(scriptData.rebalanceLog);
        }
        if (Array.isArray(scriptData.cashLedger) && scriptData.cashLedger.length > 0) {
          setCashLedger(scriptData.cashLedger);
        }
      }

      setSyncTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));

      if (!silent) {
        if (updatedCount > 0) {
          const sampleKeys = ['BJC', 'KCE', 'MSTR', 'PTG', 'IVL', 'META', 'CRCL']
            .filter(s => combinedPrices[s] !== undefined || combinedPrices[s + '.BK'] !== undefined);
          const sampleInfo = sampleKeys.slice(0, 3).map(s => {
            const p = combinedPrices[s] !== undefined ? combinedPrices[s] : combinedPrices[s + '.BK'];
            const prefix = ['MSTR', 'META', 'CRCL', 'HOOD', 'BTC', 'ETH'].includes(s) ? '$' : '฿';
            return `${s}: ${prefix}${Number(p).toFixed(2)}`;
          }).join(', ');

          message.success(`Live market synced from Yahoo Finance (${updatedCount} assets${sampleInfo ? ': ' + sampleInfo : ''}).`);
        } else if (!scriptUrl) {
          message.warning('Google Apps Script URL is not configured. Live stock prices cannot be fetched without it. Click to configure or set manual prices.');
        } else {
          message.info('Market sync completed.');
        }
      }
    } catch (error) {
      console.warn('Sync market data note:', error);
      try {
        const rates = await fetchExchangeRates();
        setLiveRates(rates);
        setSyncTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
      } catch (fxErr) {
        console.warn('FX rate fallback note:', fxErr);
      }
      if (!silent) {
        message.warning('Could not connect to live market sync service. Preserving cached prices.');
      }
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, [trades]);

  const updateManualPrice = useCallback((rawSymbol, price) => {
    if (!rawSymbol) return;
    const symbol = rawSymbol.trim().toUpperCase();
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      message.warning('Please enter a valid positive price.');
      return;
    }

    setManualPrices(prev => {
      const updated = { ...prev, [symbol]: numPrice };
      try {
        localStorage.setItem('alphatrader_manual_prices', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setLivePrices(prev => {
      const updated = { ...prev, [symbol]: numPrice };
      if (!symbol.includes('.')) {
        updated[`${symbol}.BK`] = numPrice;
      } else if (symbol.endsWith('.BK')) {
        updated[symbol.replace('.BK', '')] = numPrice;
      }
      try {
        localStorage.setItem('alphatrader_live_prices_v4', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setPriceSources(prev => ({
      ...prev,
      [symbol]: 'manual'
    }));

    message.success(`Updated manual price for ${symbol}: ${numPrice}`);
  }, []);

  const clearManualPrice = useCallback((rawSymbol) => {
    if (!rawSymbol) return;
    const symbol = rawSymbol.trim().toUpperCase();
    setManualPrices(prev => {
      const updated = { ...prev };
      delete updated[symbol];
      try {
        localStorage.setItem('alphatrader_manual_prices', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setPriceSources(prev => {
      const updated = { ...prev };
      delete updated[symbol];
      return updated;
    });
    message.info(`Cleared manual price for ${symbol}. Syncing live price...`);
    syncMarketData(true);
  }, [syncMarketData]);

  const clearAllManualPrices = useCallback(() => {
    setManualPrices({});
    setPriceSources(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(k => {
        if (updated[k] === 'manual') delete updated[k];
      });
      return updated;
    });
    try {
      localStorage.removeItem('alphatrader_manual_prices');
    } catch {}
    message.info('Cleared all manual prices. Re-syncing live market prices...');
    syncMarketData(true);
  }, [syncMarketData]);

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
    cashLedger,
    setCashLedger,
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
    manualPrices,
    setManualPrices,
    priceSources,
    setPriceSources,
    isMarketModalOpen,
    setIsMarketModalOpen,
    updateManualPrice,
    clearManualPrice,
    clearAllManualPrices,
    fetchData,
    syncMarketData,
    handleSaveGoogleSheetSettings,
    handleSyncGoogleSheet
  };
};
