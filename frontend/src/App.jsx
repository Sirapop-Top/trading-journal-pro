import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Menu, Button, Card, Statistic, Table, Modal, 
  Form, Input, InputNumber, Select, DatePicker, Row, Col, Space, 
  Spin, Tag, Typography, Popconfirm, message, Alert, Switch, ConfigProvider, theme, Checkbox, Progress
} from 'antd';
import { 
  DashboardOutlined, 
  BookOutlined, 
  TableOutlined, 
  SettingOutlined, 
  SyncOutlined, 
  PlusOutlined, 
  DownloadOutlined, 
  DeleteOutlined, 
  GlobalOutlined, 
  WalletOutlined, 
  RiseOutlined, 
  FallOutlined,
  CheckCircleFilled,
  ExclamationCircleOutlined,
  SearchOutlined,
  SwapOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LockOutlined,
  EditOutlined,
  LogoutOutlined,
  BankOutlined,
  PieChartOutlined,
  DollarOutlined,
  SlidersOutlined
} from '@ant-design/icons';
import { 
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine
} from 'recharts';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

// Force Cloud Mode (Google Sheets Serverless DB) to always be true
const isCloudMode = true;

const getApiUrl = (endpoint) => {
  const scriptUrl = localStorage.getItem('google_apps_script_url');
  return { type: 'cloud', url: scriptUrl || '' };
};

// Robust RFC 4180-compliant CSV Parser that handles nested quotes, commas, and newlines
const parseCSV = (csvText) => {
  const lines = [];
  let currentLine = [];
  let currentVal = '';
  let inQuotes = false;
  
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip next escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentLine.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentVal.trim());
      if (currentLine.length > 1 || currentLine[0] !== '') {
        lines.push(currentLine);
      }
      currentLine = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (currentVal || currentLine.length > 0) {
    currentLine.push(currentVal.trim());
    lines.push(currentLine);
  }
  return lines;
};

// Helper to communicate with Google Apps Script without triggering CORS preflight (OPTIONS) requests
const callGoogleAppsScript = async (url, payload = null) => {
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

// Asset type categories for mapping and styling
const ASSET_TYPE_COLORS = {
  'Thai Stock': '#00f2fe',
  'Global Stock': '#3b82f6',
  'Crypto': '#f59e0b'
};

// Currency configurations for symbols
const CURRENCY_SYMBOLS = {
  'THB': '฿',
  'USD': '$',
  'EUR': '€'
};

function App() {
  const getPortfolioConfig = (pName) => {
    try {
      const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
      return configs[pName] || { initialCapital: 2000000, targetStocks: 50 };
    } catch (e) {
      return { initialCapital: 2000000, targetStocks: 50 };
    }
  };

  // Navigation & State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [trades, setTrades] = useState([]);
  const [portfolios, setPortfolios] = useState(['Main Investment', 'Short-Term Trading', 'Crypto']);
  const [activePortfolio, setActivePortfolio] = useState('All Portfolios');
  const [isCensored, setIsCensored] = useState(() => {
    return localStorage.getItem('alphatrader_censored') === 'true';
  });

  const toggleCensored = () => {
    setIsCensored(prev => {
      const newVal = !prev;
      localStorage.setItem('alphatrader_censored', String(newVal));
      return newVal;
    });
  };
  const [allocationDimension, setAllocationDimension] = useState('type'); // 'type' | 'name'
  const [pnlDimension, setPnlDimension] = useState('strategy'); // 'strategy' | 'type' | 'name'
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [mobileChartTab, setMobileChartTab] = useState('performance'); // 'performance' | 'allocation' | 'pnl' | 'breakdown'

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  
  // Table search & filter states
  const [journalSearch, setJournalSearch] = useState('');
  const [journalActionFilter, setJournalActionFilter] = useState('All');
  const [journalAssetTypeFilter, setJournalAssetTypeFilter] = useState('All');
  const [positionsSearch, setPositionsSearch] = useState('');
  const [positionsTypeFilter, setPositionsTypeFilter] = useState('All');

  // Display Currency Configuration
  const [displayCurrency, setDisplayCurrency] = useState('THB');
  
  // Market Data & Sync
  const [livePrices, setLivePrices] = useState({});
  const [liveRates, setLiveRates] = useState({ THB: 1.0, USD: 32.69, EUR: 38.04 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncTime, setSyncTime] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Google Sheet Mobile Sync State
  const [googleSheetId, setGoogleSheetId] = useState(() => localStorage.getItem('google_sheet_id') || '');
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [googleSheetSyncCount, setGoogleSheetSyncCount] = useState(0);
  const [googleAppsScriptUrl, setGoogleAppsScriptUrl] = useState(() => localStorage.getItem('google_apps_script_url') || '');
  const [cloudConnectionError, setCloudConnectionError] = useState(null);
  // isConnected is derived from localStorage — NOT from typing state.
  // This prevents the onboarding guard from exiting while the user is still typing.
  const [isConnected, setIsConnected] = useState(() => !!localStorage.getItem('google_sheet_id'));

  
  // Modals & Forms
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState('');
  const [transferTargetAsset, setTransferTargetAsset] = useState('');
  const [transferSourcePortfolio, setTransferSourcePortfolio] = useState('');
  const [formAction, setFormAction] = useState('Buy');
  const [tradeForm] = Form.useForm();
  const [portfolioForm] = Form.useForm();
  const [renameForm] = Form.useForm();
  const [transferForm] = Form.useForm();

  // Ticker Validation State
  const [tickerValidation, setTickerValidation] = useState({
    status: 'idle',
    message: '',
    checkedTicker: ''
  });

  // Passcode Security States
  const [appPasscode, setAppPasscode] = useState(() => localStorage.getItem('alphatrader_passcode') || '');
  const [isLocked, setIsLocked] = useState(() => !!localStorage.getItem('alphatrader_passcode'));
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState(0);
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(() => Number(localStorage.getItem('alphatrader_autolock') || '0')); // 0 = disabled

  // Edit Strategy States
  const [isEditStrategyModalOpen, setIsEditStrategyModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [editStrategyForm] = Form.useForm();
  const [isCustomStrategy, setIsCustomStrategy] = useState(false);

  // Lockout Timer Cooldown
  useEffect(() => {
    if (lockoutTimeRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutTimeRemaining]);

  // Idle Timer Auto-Lock
  useEffect(() => {
    if (!appPasscode || autoLockMinutes <= 0 || isLocked) return;

    let timeoutId;
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setIsLocked(true);
        message.warning('App locked automatically due to inactivity.');
      }, autoLockMinutes * 60 * 1000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [appPasscode, autoLockMinutes, isLocked]);

  // Load data on startup
  useEffect(() => {
    fetchData();
    fetchGoogleSheetSettings();
  }, []);

  // Auto-refresh cycle (every 60 seconds)
  useEffect(() => {
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        syncMarketData(true); // Silent sync
      }, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, trades]);

  // Helper to fetch Google Sheet directly via CSV (CORS-friendly fallback)
  const fetchDirectFromGoogleSheet = async (sheetId) => {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Journal`;
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`Google Sheets responded with HTTP status ${response.status}`);
    }
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    
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
    
    const dateIdx = findColIdx(["date"]);
    const assetNameIdx = findColIdx(["asset name", "asset_name", "asset"]);
    const assetTypeIdx = findColIdx(["asset type", "asset_type", "type"]);
    const currencyIdx = findColIdx(["currency"]);
    const actionIdx = findColIdx(["action"]);
    const quantityIdx = findColIdx(["quantity", "qty"]);
    const priceUnitIdx = findColIdx(["price/unit", "price_unit", "price unit", "price"]);
    const whyIdx = findColIdx(["why", "decision", "reason"]);
    const remarkIdx = findColIdx(["remark", "note"]);
    const portfolioIdx = findColIdx(["portfolio", "port"]);
    const feeAmountIdx = findColIdx(["fee amount", "fee_amount", "fee"]);
    
    const loadedTrades = [];
    const loadedPortfolios = new Set();
    
    // Fetch Portfolios config sheet if it exists
    let customMappings = {};
    let customPortfoliosList = ["Main Trading", "BTC Stock", "Crypto"];
    try {
      const portCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Portfolios`;
      const portRes = await fetch(portCsvUrl);
      if (portRes.ok) {
        const portCsvText = await portRes.text();
        const portRows = parseCSV(portCsvText);
        if (portRows.length > 1) {
          const pHeaders = portRows[0].map(h => h.toString().toLowerCase().trim());
          const assetCol = pHeaders.indexOf("asset name");
          const portCol = pHeaders.indexOf("portfolio");
          const namesCol = pHeaders.indexOf("portfolio names");
          const initialCapitalCol = pHeaders.indexOf("initial capital");
          const targetStocksCol = pHeaders.indexOf("target stocks");
          
          const tempPortfolios = new Set();
          const tempConfigs = {};
          
          for (let k = 1; k < portRows.length; k++) {
            const pRow = portRows[k];
            // Read mapping
            if (assetCol !== -1 && portCol !== -1 && pRow[assetCol] && pRow[portCol]) {
              const assetName = pRow[assetCol].toString().trim().toUpperCase();
              const portName = pRow[portCol].toString().trim();
              if (assetName && portName) {
                customMappings[assetName] = portName;
              }
            }
            // Read custom portfolio name
            if (namesCol !== -1 && pRow[namesCol]) {
              const pName = pRow[namesCol].toString().trim();
              if (pName) {
                tempPortfolios.add(pName);
                const capital = (initialCapitalCol !== -1 && pRow[initialCapitalCol])
                  ? (parseFloat(pRow[initialCapitalCol]) || 2000000)
                  : 2000000;
                const stocks = (targetStocksCol !== -1 && pRow[targetStocksCol])
                  ? (parseInt(pRow[targetStocksCol]) || 50)
                  : 50;
                tempConfigs[pName] = { initialCapital: capital, targetStocks: stocks };
              }
            }
          }
          
          if (tempPortfolios.size > 0) {
            customPortfoliosList = Array.from(tempPortfolios);
          }
          
          // Cache to localStorage for fast offline access
          localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));
          localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(customPortfoliosList));
          localStorage.setItem('alphatrader_portfolio_configs', JSON.stringify(tempConfigs));
        }
      } else {
        // Portfolios sheet tab doesn't exist yet, try to load from localStorage cache
        customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
        customPortfoliosList = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '["Main Trading", "BTC Stock", "Crypto"]');
      }
    } catch (err) {
      console.warn("Could not load Portfolios config sheet from cloud, loading cached from localStorage:", err);
      try {
        customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
        customPortfoliosList = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '["Main Trading", "BTC Stock", "Crypto"]');
      } catch (e) {}
    }

    customPortfoliosList.forEach(p => loadedPortfolios.add(p));
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const assetName = assetNameIdx !== -1 && row[assetNameIdx] ? row[assetNameIdx].toString().trim() : "";
      if (!assetName) continue;
      
      let dateVal = "";
      if (dateIdx !== -1 && row[dateIdx]) {
        const d = row[dateIdx].toString().trim();
        dateVal = dayjs(d).isValid() ? dayjs(d).format("YYYY-MM-DD") : d;
      } else {
        dateVal = dayjs().format("YYYY-MM-DD");
      }
      
      const assetType = assetTypeIdx !== -1 && row[assetTypeIdx] ? row[assetTypeIdx].toString().trim() : "";
      
      let portfolio = "Main Trading";
      if (portfolioIdx !== -1 && row[portfolioIdx]) {
        portfolio = row[portfolioIdx].toString().trim();
      } else if (assetType.toLowerCase() === "crypto") {
        portfolio = "Crypto";
      } else if (assetType.toLowerCase() === "global stock" || assetType.toLowerCase() === "us stock") {
        portfolio = "BTC Stock";
      }
      
      // Apply custom overrides
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
        } catch (e) {}
      }

      loadedTrades.push({
        id: (i + 1).toString(),   // ID = actual spreadsheet row number (header=row1, data starts at row2)
        date: dateVal,
        portfolio,
        assetName,
        assetType,
        currency: currencyIdx !== -1 && row[currencyIdx] ? row[currencyIdx].toString().trim() : "THB",
        action: actionIdx !== -1 && row[actionIdx] ? row[actionIdx].toString().trim() : "Buy",
        quantity: isNaN(qty) ? 0 : qty,
        priceUnit: isNaN(price) ? 0 : price,
        why: whyIdx !== -1 && row[whyIdx] ? row[whyIdx].toString().trim() : "",
        remark: remarkIdx !== -1 && row[remarkIdx] ? row[remarkIdx].toString().trim() : "",
        feeAmount: parsedFee
      });
      
      loadedPortfolios.add(portfolio);
    }
    
    setTrades(loadedTrades);
    setPortfolios(Array.from(loadedPortfolios));
    setGoogleSheetSyncCount(loadedTrades.length);
    
    // Attempt live exchange rates fetch via a free CORS-enabled API
    try {
      const rateRes = await fetch("https://open.er-api.com/v6/latest/USD");
      if (rateRes.ok) {
        const rateData = await rateRes.json();
        const usdToThb = rateData.rates.THB || 32.69;
        const eurToThb = rateData.rates.THB / rateData.rates.EUR || 38.04;
        setLiveRates({ THB: 1.0, USD: usdToThb, EUR: eurToThb });
      }
    } catch (rateErr) {
      console.error("Live rates API fallback error:", rateErr);
    }
    
    setSyncTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  };

  // Fetch all trades, portfolios, prices, and rates
  const fetchData = async () => {
    setIsSyncing(true);
    setCloudConnectionError(null);
    try {
      const sheetId = localStorage.getItem('google_sheet_id') || googleSheetId;
      if (!sheetId) {
        setCloudConnectionError('No Google Sheet ID configured. Please enter your Sheet ID in the setup screen.');
        setIsSyncing(false);
        return;
      }
      // Step 1: Load trades from the guaranteed-CORS CSV endpoint
      await fetchDirectFromGoogleSheet(sheetId);
      // Step 2: Try to also get live prices from Apps Script (non-critical, best-effort)
      try {
        const scriptUrl = localStorage.getItem('google_apps_script_url');
        if (scriptUrl) {
          const data = await callGoogleAppsScript(`${scriptUrl}?action=getData`);
          if (data && data.livePrices) setLivePrices(data.livePrices);
          if (data && data.liveRates) setLiveRates(data.liveRates);
        }
      } catch (priceErr) {
        // Live prices are optional — don't block or error if this fails
        console.warn('Live prices from Apps Script unavailable, using WAC fallback:', priceErr);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      message.error('Failed to load data. Check your Google Sheet ID is correct and the sheet is shared publicly.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync Yahoo Finance Tickers
  const syncMarketData = async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (!scriptUrl) {
        throw new Error('Google Apps Script URL is not configured in Settings.');
      }
      const data = await callGoogleAppsScript(`${scriptUrl}?action=getData`);
      setLivePrices(data.livePrices || {});
      setLiveRates(data.liveRates || { THB: 1.0, USD: 32.69, EUR: 38.04 });
      if (data.syncTime) {
        setSyncTime(dayjs(data.syncTime).format('YYYY-MM-DD HH:mm:ss'));
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
  };

  // Google Sheet Mobile Sync Helper API Functions
  const fetchGoogleSheetSettings = async () => {
    setGoogleSheetSyncCount(trades.length);
  };

  const handleSaveGoogleSheetSettings = async () => {
    setIsSyncingSheet(true);
    try {
      localStorage.setItem('google_apps_script_url', googleAppsScriptUrl.trim());
      localStorage.setItem('google_sheet_id', googleSheetId.trim());
      message.success('Cloud sync settings saved to browser local storage!');
      await fetchData(); // Fetch trades using the new Apps Script URL
    } catch (err) {
      console.error('Error saving local cloud settings:', err);
      message.error('Failed to save cloud settings.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
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
  };


  // ----------------------------------------------------
  // Dynamic Portfolio Calculations (re-computed instantly)
  // ----------------------------------------------------
  
  // Filtered trades by active portfolio
  const filteredTrades = useMemo(() => {
    if (activePortfolio === 'All Portfolios') {
      return trades;
    }
    return trades.filter(t => t.portfolio === activePortfolio);
  }, [trades, activePortfolio]);

  // Running stats for all filtered trades chronologically
  const tradesWithRunningStats = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });

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
      const isBuy = trade.action.toLowerCase() === 'buy';

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
  }, [filteredTrades, livePrices]);

  // Advanced Trading Analytics
  const tradingAnalytics = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const buysCount = filteredTrades.filter(t => t.action.toLowerCase() === 'buy').length;
    const sellsCount = filteredTrades.filter(t => t.action.toLowerCase() === 'sell').length;

    let winCount = 0;
    let lossCount = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let maxWinVal = 0;
    let maxLossVal = 0;

    filteredTrades.forEach(trade => {
      const stats = tradesWithRunningStats[trade.id];
      if (!stats) return;

      const rateToTHB = liveRates[trade.currency] || 1.0;
      const displayRateToTHB = liveRates[displayCurrency] || 1.0;

      if (trade.action.toLowerCase() === 'sell') {
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
  }, [filteredTrades, tradesWithRunningStats, liveRates, displayCurrency]);

  // Search and filtered trades specifically for the Journal Table display
  const journalFilteredTrades = useMemo(() => {
    let result = filteredTrades;

    // Filter by Action
    if (journalActionFilter !== 'All') {
      result = result.filter(t => t.action.toLowerCase() === journalActionFilter.toLowerCase());
    }

    // Filter by Asset Type
    if (journalAssetTypeFilter !== 'All') {
      result = result.filter(t => t.assetType === journalAssetTypeFilter);
    }

    // Filter by Search Query
    if (journalSearch.trim() !== '') {
      const query = journalSearch.toLowerCase().trim();
      result = result.filter(t => 
        t.assetName.toLowerCase().includes(query) ||
        (t.why && t.why.toLowerCase().includes(query)) ||
        (t.remark && t.remark.toLowerCase().includes(query))
      );
    }

    // Sort by Date (Newest to Oldest)
    return [...result].sort((a, b) => dayjs(b.date).unix() - dayjs(a.date).unix());
  }, [filteredTrades, journalActionFilter, journalAssetTypeFilter, journalSearch]);

  // Holding calculations for all unique assets, converted to the display currency
  const positions = useMemo(() => {
    // Sort all trades in filteredTrades chronologically
    const sorted = [...filteredTrades].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      const idA = parseInt(a.id) || 0;
      const idB = parseInt(b.id) || 0;
      return idA - idB;
    });

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
      const isBuy = trade.action.toLowerCase() === 'buy';

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

    // Map running holdings to final positions array
    return Object.values(runningHoldings).map(holding => {
      const qtyHeld = holding.qty;
      const wac = qtyHeld > 0 ? (holding.totalCost / qtyHeld) : 0;
      const totalCost = holding.totalCost;

      // Single source of truth live price from Yahoo Finance
      const livePrice = livePrices[holding.assetName] !== undefined && livePrices[holding.assetName] !== null
        ? livePrices[holding.assetName]
        : wac; // Fallback to WAC

      const liveValue = qtyHeld * livePrice;
      const unrealizedPnL = liveValue - totalCost;
      const realizedPnL = holding.totalRealizedPnL;

      // Exchange rate conversion logic:
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
        wac, // local currency
        totalCost, // local currency
        livePrice, // local currency
        liveValue, // local currency
        unrealizedPnL, // local currency
        realizedPnL, // local currency
        
        // Converted Values for UI Display
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
  }, [filteredTrades, livePrices, liveRates, displayCurrency]);

  // Render positions applying the search and filter query
  const renderedPositions = useMemo(() => {
    let result = positions;

    if (positionsTypeFilter !== 'All') {
      result = result.filter(p => p.assetType === positionsTypeFilter);
    }

    if (positionsSearch.trim() !== '') {
      const query = positionsSearch.toLowerCase().trim();
      result = result.filter(p => p.assetName.toLowerCase().includes(query));
    }

    return result;
  }, [positions, positionsTypeFilter, positionsSearch]);

  // Aggregate portfolios KPIs (summing up from active holdings and realized gains)
  const kpis = useMemo(() => {
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
  }, [positions]);

  // Portfolio capital configuration and target sizing calculations
  const portfolioSizing = useMemo(() => {
    let initialCapital = 0;
    let targetStocks = 0;
    
    const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
    
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
    
    const totalRealizedPnL = kpis.totalRealizedPnLConverted;
    const totalInvested = kpis.totalInvestedConverted;
    
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
  }, [portfolios, activePortfolio, kpis, positions]);

  // ----------------------------------------------------
  // Chart Visual Data Transformations
  // ----------------------------------------------------

  // 1. Cumulative Realized P&L Line Chart over Time
  const cumulativePnLData = useMemo(() => {
    const sortedTrades = [...filteredTrades].sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());
    
    const assetState = {}; // tracker for WAC and qty per asset
    let runningRealizedPnL = 0;
    const datePnLMap = {};

    sortedTrades.forEach(trade => {
      const name = trade.assetName;
      const qty = Number(trade.quantity) || 0;
      const price = Number(trade.priceUnit) || 0;
      const action = trade.action.toLowerCase();
      const date = trade.date;

      if (!assetState[name]) {
        assetState[name] = { qty: 0, totalCost: 0 };
      }
      const state = assetState[name];

      // Conversion rates
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

        // update quantities
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
  }, [filteredTrades, liveRates, displayCurrency]);

  // 2. Asset Allocation Data (By Category or Asset Name)
  const assetAllocationData = useMemo(() => {
    const allocation = {};
    positions.forEach(pos => {
      if (pos.qtyHeld <= 0) return;
      const key = allocationDimension === 'type' ? (pos.assetType || 'Thai Stock') : pos.assetName;
      allocation[key] = (allocation[key] || 0) + pos.liveValueConverted;
    });

    const colors = [
      '#00f2fe', '#3b82f6', '#f59e0b', '#10b981', '#ec4899', 
      '#8b5cf6', '#14b8a6', '#f43f5e', '#a855f7', '#06b6d4'
    ];

    return Object.keys(allocation).map((key, index) => ({
      name: key,
      value: Number(allocation[key].toFixed(2)),
      color: allocationDimension === 'type'
        ? (ASSET_TYPE_COLORS[key] || '#8884d8')
        : colors[index % colors.length]
    }));
  }, [positions, allocationDimension]);

  // 3. P&L by Dimension (Strategy, Category, or Asset Name)
  const pnlDistributionData = useMemo(() => {
    const groupings = {};
    
    filteredTrades.forEach(trade => {
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
      if (trade.action.toLowerCase() === 'buy') {
        pnlConverted = ((livePrice - buyPrice) * qty * rateToTHB) / displayRateToTHB;
      } else if (trade.action.toLowerCase() === 'sell') {
        pnlConverted = ((buyPrice - livePrice) * qty * rateToTHB) / displayRateToTHB;
      }
      
      groupings[key] = (groupings[key] || 0) + pnlConverted;
    });

    return Object.keys(groupings).map(key => ({
      name: key,
      PnL: Number(groupings[key].toFixed(2))
    }));
  }, [filteredTrades, livePrices, liveRates, displayCurrency, pnlDimension]);

  // 4. Realized P&L Breakdown Data by Asset Name
  const realizedPnLBreakdownData = useMemo(() => {
    const data = [];
    positions.forEach(pos => {
      if (Math.abs(pos.realizedPnLConverted) > 0.01) {
        data.push({
          name: pos.assetName,
          PnL: Number(pos.realizedPnLConverted.toFixed(2))
        });
      }
    });
    return data.sort((a, b) => b.PnL - a.PnL);
  }, [positions]);

  // ----------------------------------------------------
  // Interactions & Operations
  // ----------------------------------------------------

  // Ticker Validation on Yahoo Finance
  const handleValidateTicker = async () => {
    const symbol = tradeForm.getFieldValue('assetName');
    const assetType = tradeForm.getFieldValue('assetType');
    if (!symbol) {
      setTickerValidation({ 
        status: 'error', 
        message: 'Please input an asset name/ticker first.', 
        checkedTicker: '' 
      });
      return;
    }
    
    let resolvedSymbol = symbol.trim().toUpperCase();
    if (assetType && assetType.trim().toLowerCase() === 'crypto' && !resolvedSymbol.includes('-')) {
      resolvedSymbol = `${resolvedSymbol}-USD`;
      tradeForm.setFieldsValue({ assetName: resolvedSymbol });
    }
    const tickerUpper = resolvedSymbol;
    
    setTickerValidation({ 
      status: 'validating', 
      message: 'Checking ticker on Yahoo Finance...', 
      checkedTicker: tickerUpper 
    });
    
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing. Set it in settings to validate tickers.');
      }
      const result = await callGoogleAppsScript(scriptUrl, {
        action: 'validateTicker',
        symbol: resolvedSymbol,
        assetType: assetType
      });

      if (result.valid) {
        setTickerValidation({
          status: 'success',
          message: result.message,
          checkedTicker: tickerUpper
        });
        message.success(`Ticker verified on Yahoo Finance!`);
      } else {
        setTickerValidation({
          status: 'error',
          message: result.message,
          checkedTicker: tickerUpper
        });
        message.error(`Verification Failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Ticker validation connection failed:', error);
      setTickerValidation({
        status: 'error',
        message: `Connection failed: ${error.message || 'Cannot reach validation service.'}`,
        checkedTicker: tickerUpper
      });
      message.error(`Could not connect to verification service.`);
    }
  };

  // Log new trade form submit
  const handleAddTrade = async (values) => {
    let resolvedSymbol = values.assetName.trim().toUpperCase();
    const assetType = values.assetType;
    if (assetType && assetType.trim().toLowerCase() === 'crypto' && !resolvedSymbol.includes('-')) {
      resolvedSymbol = `${resolvedSymbol}-USD`;
      tradeForm.setFieldsValue({ assetName: resolvedSymbol });
    }
    const symbol = resolvedSymbol;
    const scriptUrl = localStorage.getItem('google_apps_script_url');
    
    // Validate ticker before adding trade
    if (tickerValidation.status !== 'success' || tickerValidation.checkedTicker !== symbol) {
      setIsSyncing(true);
      const hideMsg = message.loading('Validating ticker on Yahoo Finance...', 0);
      try {
        if (!scriptUrl) {
          throw new Error('Apps Script URL is missing. Cannot validate ticker.');
        }
        const result = await callGoogleAppsScript(scriptUrl, {
          action: 'validateTicker',
          symbol: symbol,
          assetType: assetType
        });
        hideMsg();
        setIsSyncing(false);
        
        if (!result.valid) {
          setTickerValidation({
            status: 'error',
            message: result.message,
            checkedTicker: symbol
          });
          message.error(`Verification Failed: ${result.message}`);
          return; // Stop form submission
        } else {
          setTickerValidation({
            status: 'success',
            message: result.message,
            checkedTicker: symbol
          });
        }
      } catch (error) {
        hideMsg();
        setIsSyncing(false);
        console.error('Ticker validation failed during submit:', error);
        
        // Return a promise that resolves on dialog confirmation or cancel
        return new Promise((resolve) => {
          Modal.confirm({
            title: 'Ticker Verification Unreachable',
            content: `Could not verify '${symbol}' because: ${error.message || error}. Do you want to log this trade anyway without verification?`,
            okText: 'Log Anyway',
            cancelText: 'Cancel',
            onOk: () => {
              setTickerValidation({
                status: 'success',
                message: 'Validation bypassed by user.',
                checkedTicker: symbol
              });
              handleAddTrade(values).then(resolve);
            },
            onCancel: () => {
              setTickerValidation({
                status: 'error',
                message: 'Verification unreachable. Aborted.',
                checkedTicker: symbol
              });
              resolve();
            }
          });
        });
      }
    }

    setIsSyncing(true);
    try {
      const formattedDate = values.date.format('YYYY-MM-DD');
      
      const newTrade = {
        id: (trades.length + 2).toString(),
        date: formattedDate,
        portfolio: values.portfolio,
        assetName: symbol,
        assetType: values.assetType,
        currency: values.currency,
        action: values.action,
        quantity: values.quantity,
        priceUnit: values.priceUnit,
        why: values.why || '',
        remark: values.remark || '',
        feeAmount: parseFloat(values.feeAmount) || 0.0
      };

      const payload = {
        action: 'addTrade',
        trade: newTrade
      };
      await callGoogleAppsScript(scriptUrl, payload);
      message.success(`Trade for ${newTrade.assetName} logged successfully to Google Sheets.`);
      setIsTradeModalOpen(false);
      tradeForm.resetFields();
      setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
      
      // Auto-save the portfolio mapping for this asset in Cloud Mode
      try {
        const customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
        customMappings[newTrade.assetName] = newTrade.portfolio;
        localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));

        // Also sync mapping via Apps Script transferPosition action in background to keep sheet updated
        if (scriptUrl) {
          callGoogleAppsScript(scriptUrl, {
            action: "transferPosition",
            assetName: newTrade.assetName,
            targetPortfolio: newTrade.portfolio
          }).catch(e => console.error("Error background syncing mapping:", e));
        }
      } catch (e) {
        console.error("Error saving portfolio mapping:", e);
      }

      setTrades(prev => [...prev, newTrade]);
      fetchData(); // Trigger full refresh to sync
    } catch (error) {
      console.error('Error adding trade:', error);
      message.error(error.message || 'Failed to log trade in database.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete trade
  const handleDeleteTrade = async (tradeId) => {
    setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const payload = {
        action: 'deleteTrade',
        tradeId: tradeId
      };
      await callGoogleAppsScript(scriptUrl, payload);
      setTrades(prev => prev.filter(t => t.id !== tradeId));
      message.success('Trade deleted from logs.');
    } catch (error) {
      console.error('Error deleting trade:', error);
      message.error('Failed to delete trade.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateStrategy = async (values) => {
    if (!editingTrade) return;
    setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const finalWhy = values.why === 'Other' ? (values.customWhy || '') : values.why;
      
      const updatedData = {
        quantity: Number(values.quantity),
        priceUnit: Number(values.priceUnit),
        feeAmount: Number(values.feeAmount),
        why: finalWhy,
        remark: values.remark || ''
      };
      
      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing in Cloud Mode.');
      }
      await callGoogleAppsScript(scriptUrl, {
        action: "editTrade",
        tradeId: editingTrade.id,
        quantity: updatedData.quantity,
        priceUnit: updatedData.priceUnit,
        feeAmount: updatedData.feeAmount,
        why: updatedData.why,
        remark: updatedData.remark
      });
      message.success(`Trade entry updated successfully on Google Sheets.`);
      setTrades(prev => prev.map(t => t.id === editingTrade.id ? { ...t, ...updatedData } : t));
      setIsEditStrategyModalOpen(false);
      setEditingTrade(null);
      setIsCustomStrategy(false);
      editStrategyForm.resetFields();
      fetchData();
    } catch (error) {
      console.error('Error updating trade entry:', error);
      message.error(error.message || 'Failed to update trade entry.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Create new portfolio
  const handleAddPortfolio = async (values) => {
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const name = values.name.trim();
      // Save empty custom portfolio to localStorage in Cloud Mode
      const customPortfolios = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '[]');
      if (!customPortfolios.includes(name)) {
        customPortfolios.push(name);
        localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(customPortfolios));
      }
      setPortfolios(prev => {
        if (!prev.includes(name)) {
          return [...prev, name];
        }
        return prev;
      });

      // Sync configs to localStorage in Cloud Mode
      const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
      configs[name] = {
        initialCapital: Number(values.initialCapital) || 2000000,
        targetStocks: Number(values.targetStocks) || 50
      };
      localStorage.setItem('alphatrader_portfolio_configs', JSON.stringify(configs));

      // Sync with Google Sheet Apps Script in the background
      if (scriptUrl) {
        try {
          await callGoogleAppsScript(scriptUrl, {
            action: "addPortfolio",
            name: name
          });
          await callGoogleAppsScript(scriptUrl, {
            action: "updatePortfolioConfig",
            name: name,
            initialCapital: Number(values.initialCapital) || 2000000,
            targetStocks: Number(values.targetStocks) || 50
          });
        } catch (cloudErr) {
          console.error("Error syncing addPortfolio to cloud:", cloudErr);
        }
      }

      message.success(`Portfolio "${name}" created.`);
      setIsPortfolioModalOpen(false);
      portfolioForm.resetFields();
    } catch (error) {
      console.error('Error creating portfolio:', error);
      message.error(error.message || 'Failed to create portfolio.');
    }
  };

  // Delete portfolio
  const handleDeletePortfolio = async (portfolioName) => {
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      // Validation: check if portfolio has any active trades in Cloud Mode
      const hasTrades = trades.some(t => t.portfolio === portfolioName);
      if (hasTrades) {
        message.error("Cannot delete portfolio with existing trades. Please reassign or delete the trades first.");
        return;
      }

      // Delete from custom portfolios in localStorage
      const customPortfolios = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '[]');
      const updatedCustomPortfolios = customPortfolios.filter(p => p !== portfolioName);
      localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(updatedCustomPortfolios));

      // Delete custom mapping overrides for this portfolio
      const customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
      let changed = false;
      for (const asset in customMappings) {
        if (customMappings[asset] === portfolioName) {
          delete customMappings[asset];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));
      }

      // Update active selection and portfolios list in state
      setPortfolios(prev => prev.filter(p => p !== portfolioName));
      if (activePortfolio === portfolioName) {
        setActivePortfolio('All Portfolios');
      }

      // Sync with Google Sheet Apps Script in the background
      if (scriptUrl) {
        try {
          await callGoogleAppsScript(scriptUrl, {
            action: "deletePortfolio",
            portfolioName: portfolioName
          });
        } catch (cloudErr) {
          console.error("Error syncing deletePortfolio to cloud:", cloudErr);
        }
      }

      message.success(`Portfolio "${portfolioName}" deleted.`);
      await fetchData();
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      message.error(error.message || 'Failed to delete portfolio.');
    }
  };

  // Rename/Configure portfolio
  const handleRenamePortfolio = async (values) => {
    try {
      const oldName = renameTarget;
      const newName = values.name.trim();
      const initialCapital = Number(values.initialCapital) || 0;
      const targetStocks = Number(values.targetStocks) || 1;

      // Update configs in localStorage
      const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
      configs[newName] = { initialCapital, targetStocks };
      if (oldName !== newName && oldName) {
        delete configs[oldName];
      }
      localStorage.setItem('alphatrader_portfolio_configs', JSON.stringify(configs));

      const scriptUrl = localStorage.getItem('google_apps_script_url');
      // Sync with Google Sheet Apps Script in the background
      if (scriptUrl) {
        try {
          await callGoogleAppsScript(scriptUrl, {
            action: "updatePortfolioConfig",
            name: oldName,
            initialCapital: initialCapital,
            targetStocks: targetStocks
          });
          if (oldName !== newName) {
            await callGoogleAppsScript(scriptUrl, {
              action: "renamePortfolio",
              oldName: oldName,
              newName: newName
            });
            await callGoogleAppsScript(scriptUrl, {
              action: "updatePortfolioConfig",
              name: newName,
              initialCapital: initialCapital,
              targetStocks: targetStocks
            });
          }
        } catch (cloudErr) {
          console.error("Error syncing configs to cloud:", cloudErr);
        }
      }

      if (oldName !== newName) {
        // Update custom portfolios in localStorage
        const customPortfolios = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '[]');
        const updatedCustomPortfolios = customPortfolios.map(p => p === oldName ? newName : p);
        localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(updatedCustomPortfolios));

        // Update custom mappings in localStorage
        const customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
        let changed = false;
        for (const asset in customMappings) {
          if (customMappings[asset] === oldName) {
            customMappings[asset] = newName;
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));
        }

        // Update state
        setPortfolios(prev => prev.map(p => p === oldName ? newName : p));
        if (activePortfolio === oldName) {
          setActivePortfolio(newName);
        }
        message.success(`Portfolio renamed successfully to "${newName}".`);
      } else {
        message.success(`Portfolio "${newName}" configuration updated.`);
      }

      setIsRenameModalOpen(false);
      renameForm.resetFields();
      await fetchData();
    } catch (error) {
      console.error('Error configuring portfolio:', error);
      message.error(error.message || 'Failed to configure portfolio.');
    }
  };

  // Transfer individual trade to another portfolio
  const handleTransferTrade = async (values) => {
    if (!editingTrade) return;
    setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const targetPortfolio = values.targetPortfolio;
      
      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing in Cloud Mode.');
      }
      await callGoogleAppsScript(scriptUrl, {
        action: "updateTradePortfolio",
        tradeId: editingTrade.id,
        targetPortfolio: targetPortfolio
      });
      message.success(`Trade transferred to '${targetPortfolio}' successfully on Google Sheets.`);
      setTrades(prev => prev.map(t => t.id === editingTrade.id ? { ...t, portfolio: targetPortfolio } : t));
      setIsTransferModalOpen(false);
      setEditingTrade(null);
      transferForm.resetFields();
      fetchData();
    } catch (error) {
      console.error('Error transferring trade:', error);
      message.error(error.message || 'Failed to transfer trade.');
    } finally {
      setIsSyncing(false);
    }
  };

  // CSV Exporter
  const exportJournalToCSV = () => {
    if (filteredTrades.length === 0) {
      message.warning('No trades to export in the current portfolio filter.');
      return;
    }

    const headers = [
      'ID', 'Date', 'Portfolio', 'Asset Name', 'Asset Type', 'Local Currency', 
      'Action', 'Quantity', 'Price/Unit (Local)', 'Amount (Local)', 
      `Live Price (${displayCurrency})`, `Live Value (${displayCurrency})`, 
      `P&L (${displayCurrency})`, 'P&L %', 'Strategy / Why', 'Remark'
    ];

    const rows = filteredTrades.map(trade => {
      const qty = Number(trade.quantity) || 0;
      const price = Number(trade.priceUnit) || 0;
      const amountLocal = qty * price;
      
      const livePriceLocal = livePrices[trade.assetName] !== undefined && livePrices[trade.assetName] !== null
        ? livePrices[trade.assetName]
        : price;
        
      const rateToTHB = liveRates[trade.currency] || 1.0;
      const displayRateToTHB = liveRates[displayCurrency] || 1.0;

      const livePriceConverted = (livePriceLocal * rateToTHB) / displayRateToTHB;
      const liveValueConverted = (qty * livePriceLocal * rateToTHB) / displayRateToTHB;
      
      let pnlConverted = 0;
      if (trade.action.toLowerCase() === 'buy') {
        pnlConverted = ((livePriceLocal - price) * qty * rateToTHB) / displayRateToTHB;
      } else if (trade.action.toLowerCase() === 'sell') {
        pnlConverted = ((price - livePriceLocal) * qty * rateToTHB) / displayRateToTHB;
      }
      
      const pnlPct = amountLocal > 0 ? ((livePriceLocal - price) * qty / amountLocal) * 100 : 0;

      return [
        trade.id,
        trade.date,
        trade.portfolio,
        trade.assetName,
        trade.assetType,
        trade.currency,
        trade.action,
        qty,
        price,
        amountLocal.toFixed(2),
        livePriceConverted.toFixed(2),
        liveValueConverted.toFixed(2),
        pnlConverted.toFixed(2),
        `${pnlPct.toFixed(2)}%`,
        `"${trade.why?.replace(/"/g, '""') || ''}"`,
        `"${trade.remark?.replace(/"/g, '""') || ''}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const portfolioLabel = activePortfolio.replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Trading_Journal_${portfolioLabel}_${displayCurrency}_${dayjs().format('YYYYMMDD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(`Trading journal CSV (${displayCurrency}) exported successfully.`);
  };

  // Formatting helper
  const formatCurrency = (val, currencyCode = displayCurrency) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '-';
    const symbol = CURRENCY_SYMBOLS[currencyCode] || '';
    if (isCensored) return `${symbol} ****`;
    const formattedNum = Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${symbol} ${formattedNum}`;
  };

  // ----------------------------------------------------
  // Table Column Definitions
  // ----------------------------------------------------

  const journalColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Portfolio',
      dataIndex: 'portfolio',
      key: 'portfolio',
      width: 140,
      filters: portfolios.map(p => ({ text: p, value: p })),
      onFilter: (value, record) => record.portfolio === value,
      render: (text) => <Tag color="geekblue" style={{ borderRadius: '4px', fontWeight: 'bold' }}>{text}</Tag>
    },
    {
      title: 'Asset',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 130,
      render: (text, record) => (
        <span>
          <strong style={{ color: '#ffffff', fontSize: '14px' }}>{text}</strong>
          <br />
          <Text type="secondary" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{record.assetType}</Text>
        </span>
      )
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      align: 'center',
      width: 90,
      render: (action) => (
        <span className={`pill ${action.toLowerCase() === 'buy' ? 'pill-buy' : 'pill-sell'}`}>
          {action.toUpperCase()}
        </span>
      )
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      width: 110,
      className: 'financial-num',
      render: (val) => (val !== undefined && val !== null) ? (isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })) : '-'
    },
    {
      title: 'Price/Unit',
      dataIndex: 'priceUnit',
      key: 'priceUnit',
      align: 'right',
      width: 120,
      className: 'financial-num',
      render: (val, record) => formatCurrency(val, record.currency)
    },
    {
      title: 'Fee',
      key: 'feeAmount',
      align: 'right',
      width: 100,
      className: 'financial-num',
      render: (_, record) => {
        const val = record.feeAmount !== undefined ? Number(record.feeAmount) : 0.0;
        return val > 0 ? formatCurrency(val, record.currency) : <span style={{ color: 'var(--text-muted)' }}>Free</span>;
      }
    },
    {
      title: 'Total Cost',
      key: 'amount',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (_, record) => {
        const qty = record.quantity;
        const price = record.priceUnit;
        const feeAmount = record.feeAmount !== undefined ? Number(record.feeAmount) : 0.0;
        const isBuy = record.action.toLowerCase() === 'buy';
        const total = isBuy ? (qty * price + feeAmount) : (qty * price - feeAmount);
        return formatCurrency(total, record.currency);
      }
    },
    {
      title: 'Avg. Cost Basis',
      key: 'avgCostBasis',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (_, record) => {
        const stats = tradesWithRunningStats[record.id];
        const val = stats ? stats.avgCostBasis : 0;
        return formatCurrency(val, record.currency);
      }
    },
    {
      title: `Live Price (${displayCurrency})`,
      key: 'livePriceConverted',
      align: 'right',
      width: 130,
      className: 'financial-num',
      render: (_, record) => {
        const lp = livePrices[record.assetName];
        if (lp === undefined || lp === null) return '-';
        const rateToTHB = liveRates[record.currency] || 1.0;
        const displayRateToTHB = liveRates[displayCurrency] || 1.0;
        const priceConverted = (lp * rateToTHB) / displayRateToTHB;
        return formatCurrency(priceConverted, displayCurrency);
      }
    },
    {
      title: `Realized / Unrealized P&L (${displayCurrency})`,
      key: 'pnl',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (_, record) => {
        const stats = tradesWithRunningStats[record.id];
        if (!stats) return '-';
        
        const rateToTHB = liveRates[record.currency] || 1.0;
        const displayRateToTHB = liveRates[displayCurrency] || 1.0;
        
        const isBuy = record.action.toLowerCase() === 'buy';
        const pnlLocal = isBuy ? stats.unrealizedPnL : stats.realizedPnL;
        const pnlConverted = (pnlLocal * rateToTHB) / displayRateToTHB;
        
        const isProfit = pnlConverted >= 0;
        return (
          <div style={{ textAlign: 'right' }}>
            <span className={isProfit ? 'trend-up' : 'trend-down'} style={{ fontWeight: 'bold', display: 'block' }}>
              {isProfit ? '+' : ''}{isCensored ? '****' : pnlConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {isBuy ? 'Unrealized' : 'Realized'}
            </span>
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 130,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined style={{ color: 'var(--primary-color)' }} />} 
            size="small" 
            title="Edit Trade Entry"
            onClick={() => {
              const standardStrategies = [
                "CDC Action Zone",
                "Breakout",
                "EMA Cross",
                "Support/Resistance Bounce",
                "Value Investment",
                "Rebalance"
              ];
              const isCustom = record.why && !standardStrategies.includes(record.why);
              setEditingTrade(record);
              setIsCustomStrategy(isCustom);
              editStrategyForm.setFieldsValue({
                quantity: record.quantity !== undefined ? Number(record.quantity) : 0,
                priceUnit: record.priceUnit !== undefined ? Number(record.priceUnit) : 0,
                feeAmount: record.feeAmount !== undefined ? Number(record.feeAmount) : 0,
                why: isCustom ? 'Other' : (record.why || undefined),
                customWhy: isCustom ? record.why : '',
                remark: record.remark
              });
              setIsEditStrategyModalOpen(true);
            }}
          />
          <Button 
            type="text" 
            icon={<SwapOutlined style={{ color: 'var(--warning-color)' }} />} 
            size="small" 
            title="Transfer Trade to Portfolio"
            onClick={() => {
              setEditingTrade(record);
              transferForm.setFieldsValue({
                targetPortfolio: record.portfolio
              });
              setIsTransferModalOpen(true);
            }}
          />
          <Popconfirm
            title="Delete Trade"
            description="Are you sure you want to delete this trade from your journal? This will rewrite the spreadsheet."
            onConfirm={() => handleDeleteTrade(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const positionColumns = [
    {
      title: 'Asset Name',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 140,
      render: (text, record) => (
        <span>
          <strong style={{ color: '#ffffff', fontSize: '15px' }}>{text}</strong>
          {record.qtyHeld === 0 && <Tag color="default" style={{ marginLeft: 8, borderRadius: '4px' }}>Closed</Tag>}
        </span>
      )
    },
    {
      title: 'Allocation',
      key: 'allocation',
      align: 'left',
      width: 140,
      render: (_, record) => {
        if (record.qtyHeld <= 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
        const pct = kpis.currentMarketValueConverted > 0
          ? (record.liveValueConverted / kpis.currentMarketValueConverted) * 100
          : 0;
        return (
          <div style={{ minWidth: '100px', display: 'inline-block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <div className="concentration-track">
              <div className="concentration-fill" style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        );
      }
    },
    {
      title: 'Category',
      dataIndex: 'assetType',
      key: 'assetType',
      width: 130,
      render: (type) => (
        <Tag color={type === 'Thai Stock' ? 'cyan' : type === 'Global Stock' ? 'blue' : 'orange'} style={{ borderRadius: '4px', fontWeight: 'bold' }}>
          {type}
        </Tag>
      )
    },
    {
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      width: 90,
    },
    {
      title: 'Qty Held',
      dataIndex: 'qtyHeld',
      key: 'qtyHeld',
      align: 'right',
      width: 120,
      className: 'financial-num',
      render: (val) => (val !== undefined && val !== null) ? (isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })) : '-'
    },
    {
      title: 'Avg Cost (Local)',
      dataIndex: 'wac',
      key: 'wac',
      align: 'right',
      width: 130,
      className: 'financial-num',
      render: (val, record) => formatCurrency(val, record.currency)
    },
    {
      title: `Total Cost (${displayCurrency})`,
      dataIndex: 'totalCostConverted',
      key: 'totalCostConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (val) => formatCurrency(val, displayCurrency)
    },
    {
      title: `Live Price (${displayCurrency})`,
      dataIndex: 'livePriceConverted',
      key: 'livePriceConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (val) => formatCurrency(val, displayCurrency)
    },
    {
      title: `Current Value (${displayCurrency})`,
      dataIndex: 'liveValueConverted',
      key: 'liveValueConverted',
      align: 'right',
      width: 150,
      className: 'financial-num',
      render: (val) => formatCurrency(val, displayCurrency)
    },
    {
      title: `Unrealized P&L`,
      key: 'unrealizedPnLConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      sorter: (a, b) => a.unrealizedPnLConverted - b.unrealizedPnLConverted,
      render: (_, record) => {
        const val = record.unrealizedPnLConverted;
        const pct = record.unrealizedPnLPct;
        if (val === undefined || val === null || isNaN(val)) return '-';
        const isProfit = val >= 0;
        return (
          <span>
            <div className={isProfit ? 'trend-up' : 'trend-down'}>
              {isProfit ? '+' : ''}{isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: isProfit ? '#34d399' : '#fb7185', fontWeight: 'bold' }}>
              {isProfit ? '+' : ''}{isCensored ? '****' : pct.toFixed(2) + '%'}
            </div>
          </span>
        );
      }
    },
    {
      title: `Realized P&L`,
      dataIndex: 'realizedPnLConverted',
      key: 'realizedPnLConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      sorter: (a, b) => a.realizedPnLConverted - b.realizedPnLConverted,
      render: (val) => {
        if (val === undefined || val === null || isNaN(val)) return '-';
        const isProfit = val >= 0;
        return (
          <span className={isProfit ? 'trend-up' : 'trend-down'}>
            {isProfit ? '+' : ''}{isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    }
  ];

  // Guard: show onboarding only when NOT yet connected (localStorage has no Sheet ID).
  // IMPORTANT: check localStorage via isConnected state — NOT the React typing states
  // (googleSheetId/googleAppsScriptUrl change on every keystroke and would cause
  // premature exit from the onboarding screen before the user clicks Connect).
  if (isCloudMode && !isConnected) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#00f2fe',
            colorBgBase: '#06080f',
            colorBgContainer: '#0b0e17',
            colorBorder: '#1f293d',
            fontFamily: "'Outfit', sans-serif"
          }
        }}
      >
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #141b2d 0%, #06080f 80%)', padding: '20px' }}>
          <Card 
            style={{ width: '100%', maxWidth: '480px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', borderRadius: '12px' }}
            bordered={false}
          >
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>📱</div>
              <Title level={3} style={{ margin: 0, background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                AlphaTrader Cloud
              </Title>
              <Text type="secondary" style={{ fontSize: '13px' }}>
                Link your phone to your Google Sheet database
              </Text>
            </div>
            
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div style={{ background: '#0b0e17', border: '1px solid #1f293d', padding: '16px', borderRadius: '8px' }}>
                <strong style={{ color: '#ffffff', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
                  1. Paste Google Sheet ID: <span style={{ color: '#f43f5e' }}>*</span>
                </strong>
                <Input 
                  placeholder=""
                  value={googleSheetId}
                  onChange={(e) => setGoogleSheetId(e.target.value)}
                  style={{ width: '100%', borderRadius: '4px', marginBottom: '16px' }}
                />

                <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                  2. Paste Apps Script URL: <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '12px' }}>(optional — needed for writing trades from mobile)</span>
                </strong>
                <Input.Password
                  placeholder=""
                  value={googleAppsScriptUrl}
                  onChange={(e) => setGoogleAppsScriptUrl(e.target.value)}
                  style={{ width: '100%', borderRadius: '4px' }}
                />
              </div>

              <Button 
                type="primary" 
                block 
                size="large"
                style={{ fontWeight: 'bold', color: '#06080f' }}
                onClick={() => {
                  if (!googleSheetId.trim()) {
                    message.error('Please enter your Google Sheet ID.');
                    return;
                  }
                  const scriptUrl = googleAppsScriptUrl.trim();
                  if (scriptUrl && !scriptUrl.startsWith('https://script.google.com')) {
                    message.error('Invalid Apps Script URL format.');
                    return;
                  }
                  // Save to localStorage FIRST — isConnected reads from localStorage
                  localStorage.setItem('google_sheet_id', googleSheetId.trim());
                  if (scriptUrl) {
                    localStorage.setItem('google_apps_script_url', scriptUrl);
                  }
                  // setIsConnected triggers re-render into main app (safe — not a typing state)
                  setIsConnected(true);
                  message.success('Connected! Loading your journal...');
                }}
              >
                Connect Journal
              </Button>

              <Button 
                danger
                block 
                size="large"
                icon={<LogoutOutlined />}
                style={{ fontWeight: 'bold' }}
                onClick={() => {
                  localStorage.removeItem('google_sheet_id');
                  localStorage.removeItem('google_apps_script_url');
                  localStorage.removeItem('alphatrader_passcode');
                  localStorage.removeItem('alphatrader_autolock');
                  setGoogleSheetId('');
                  setGoogleAppsScriptUrl('');
                  setAppPasscode('');
                  setIsConnected(false);
                  message.success('Cleared all connection settings and logged out.');
                }}
              >
                Clear Settings & Log Out
              </Button>

              <Alert 
                type="info"
                showIcon
                message={<span style={{ fontWeight: 'bold' }}>First Time Setup?</span>}
                description={
                  <span style={{ fontSize: '12px' }}>
                    Only the <strong>Google Sheet ID</strong> is required to view your trades. The Apps Script URL is needed to <em>add or delete</em> trades from mobile.
                  </span>
                }
              />
            </Space>
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  if (isLocked) {
    return (
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#00f2fe',
            colorSuccess: '#10b981',
            colorError: '#f43f5e',
            colorBgBase: '#06080f',
            colorBgContainer: '#0b0e17',
            colorBorder: '#1f293d',
            fontFamily: "'Outfit', sans-serif"
          }
        }}
      >
        <div style={{
          minHeight: '100vh',
          background: 'radial-gradient(circle at center, #0b0e17 0%, #06080f 100%)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'rgba(0, 242, 254, 0.04)',
            filter: 'blur(80px)',
            top: '10%',
            left: '20%'
          }}></div>
          <div style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            background: 'rgba(123, 92, 246, 0.04)',
            filter: 'blur(80px)',
            bottom: '10%',
            right: '20%'
          }}></div>

          <Card
            bordered={false}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: 'rgba(11, 14, 23, 0.7)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              borderRadius: '16px',
              textAlign: 'center',
              padding: '24px 16px'
            }}
          >
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(0, 242, 254, 0.1)',
                border: '1px solid rgba(0, 242, 254, 0.2)',
                boxShadow: '0 0 15px rgba(0, 242, 254, 0.1)',
                color: 'var(--primary-color)',
                fontSize: '28px',
                marginBottom: '16px'
              }}>
                <LockOutlined />
              </div>
              <h2 style={{ color: '#ffffff', margin: '0 0 8px 0', fontFamily: 'var(--font-family-ui)', fontWeight: 800, letterSpacing: '0.5px' }}>
                ALPHA<span style={{ color: 'var(--primary-color)' }}>TRADER</span> SECURED
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                This terminal is locked. Please enter your passcode to access.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input.Password
                placeholder="Enter passcode"
                size="large"
                value={enteredPasscode}
                onChange={(e) => setEnteredPasscode(e.target.value)}
                onPressEnter={() => {
                  if (lockoutTimeRemaining > 0) return;
                  if (enteredPasscode === appPasscode) {
                    setIsLocked(false);
                    setFailedAttempts(0);
                    setEnteredPasscode('');
                    message.success('Welcome back!');
                  } else {
                    const attempts = failedAttempts + 1;
                    setFailedAttempts(attempts);
                    setEnteredPasscode('');
                    if (attempts >= 5) {
                      setLockoutTimeRemaining(60);
                      message.error('Too many failed attempts. Locked out for 60 seconds.');
                    } else {
                      message.error(`Incorrect passcode. ${5 - attempts} attempts remaining.`);
                    }
                  }
                }}
                disabled={lockoutTimeRemaining > 0}
                style={{
                  textAlign: 'center',
                  letterSpacing: '4px',
                  fontSize: '18px',
                  background: 'rgba(6, 8, 15, 0.5)',
                  border: '1px solid var(--border-color)',
                  color: '#ffffff'
                }}
                autoFocus
              />

              <Button
                type="primary"
                size="large"
                disabled={lockoutTimeRemaining > 0}
                onClick={() => {
                  if (enteredPasscode === appPasscode) {
                    setIsLocked(false);
                    setFailedAttempts(0);
                    setEnteredPasscode('');
                    message.success('Welcome back!');
                  } else {
                    const attempts = failedAttempts + 1;
                    setFailedAttempts(attempts);
                    setEnteredPasscode('');
                    if (attempts >= 5) {
                      setLockoutTimeRemaining(60);
                      message.error('Too many failed attempts. Locked out for 60 seconds.');
                    } else {
                      message.error(`Incorrect passcode. ${5 - attempts} attempts remaining.`);
                    }
                  }
                }}
                style={{
                  background: 'var(--accent-gradient)',
                  border: 'none',
                  color: '#06080f',
                  fontWeight: 'bold',
                  fontSize: '15px',
                  height: '44px',
                  borderRadius: '8px'
                }}
              >
                Unlock Terminal
              </Button>

              {lockoutTimeRemaining > 0 && (
                <div style={{
                  color: 'var(--danger-color)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  background: 'rgba(244, 63, 94, 0.08)',
                  padding: '10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(244, 63, 94, 0.2)'
                }}>
                  Too many incorrect attempts. Locked out for {lockoutTimeRemaining}s
                </div>
              )}
            </div>
          </Card>
        </div>
      </ConfigProvider>
    );
  }

  const netAssetValue = (portfolioSizing?.cashOnHand || 0) + (kpis?.currentMarketValueConverted || 0);
  const netProfit = netAssetValue - (portfolioSizing?.initialCapital || 0);
  const netProfitPct = (portfolioSizing?.initialCapital || 0) > 0 ? (netProfit / portfolioSizing.initialCapital) * 100 : 0;
  const investedPct = netAssetValue > 0 ? Math.min(100, ((kpis?.currentMarketValueConverted || 0) / netAssetValue) * 100) : 0;
  const cashPct = 100 - investedPct;

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00f2fe',
          colorSuccess: '#10b981',
          colorError: '#f43f5e',
          colorBgBase: '#06080f',
          colorBgContainer: '#0b0e17',
          colorBorder: '#1f293d',
          fontFamily: "'Outfit', sans-serif"
        }
      }}
    >
      <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
        {/* Sidebar Navigation (PC only) */}
        {!isMobile && (
          <Sider 
            collapsible 
            collapsed={siderCollapsed} 
            onCollapse={(value) => setSiderCollapsed(value)}
            breakpoint="lg" 
            collapsedWidth="0" 
            theme="dark" 
            width={240}
            trigger={null}
          >
            <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', boxShadow: '0 0 10px rgba(0,242,254,0.6)' }}></div>
              <Title level={4} style={{ color: '#ffffff', margin: 0, fontFamily: 'var(--font-family-ui)', fontWeight: 900, letterSpacing: '0.8px' }}>
                ALPHA<span style={{ color: 'var(--primary-color)' }}>TRADER</span>
              </Title>
            </div>
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={[activeTab]}
              onClick={({ key }) => setActiveTab(key)}
              style={{ paddingTop: '16px' }}
            >
              <Menu.Item key="dashboard" icon={<DashboardOutlined />}>Dashboard</Menu.Item>
              <Menu.Item key="journal" icon={<BookOutlined />}>Trading Journal</Menu.Item>
              <Menu.Item key="positions" icon={<TableOutlined />}>Active Positions</Menu.Item>
              <Menu.Item key="settings" icon={<SettingOutlined />}>Terminal Settings</Menu.Item>
            </Menu>

            {/* Global Connection Info in Sider Footer */}
            <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '16px', borderTop: '1px solid var(--border-color)', background: 'rgba(6, 8, 15, 0.4)' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>USD/THB:</Text>
                  <Tag color="cyan" style={{ margin: 0, fontFamily: 'var(--font-family-mono)', fontSize: '10px', border: 'none', background: 'rgba(0, 242, 254, 0.12)' }}>
                    ฿ {liveRates.USD.toFixed(2)}
                  </Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>EUR/THB:</Text>
                  <Tag color="purple" style={{ margin: 0, fontFamily: 'var(--font-family-mono)', fontSize: '10px', border: 'none', background: 'rgba(147, 51, 234, 0.12)' }}>
                    ฿ {liveRates.EUR.toFixed(2)}
                  </Tag>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                  <Text style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Yahoo Feed:</Text>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span className="glow-green" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                    <Text style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>Live</Text>
                  </div>
                </div>
              </Space>
            </div>
          </Sider>
        )}

        <Layout>
          {/* Header Bar */}
          {isMobile ? (
            <Header style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              height: '56px', 
              lineHeight: '56px', 
              padding: '0 12px', 
              background: 'var(--bg-container)',
              borderBottom: '1px solid var(--border-color)',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              width: '100%',
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-gradient)', boxShadow: '0 0 8px rgba(0,242,254,0.6)' }}></div>
                <span style={{ color: '#ffffff', fontFamily: 'var(--font-family-ui)', fontWeight: 950, fontSize: '13px', letterSpacing: '0.5px' }}>
                  {isMobile ? 'A' : 'ALPHA'}<span style={{ color: 'var(--primary-color)' }}>{isMobile ? 'T' : 'TRADER'}</span>
                </span>
                <Select
                  value={activePortfolio}
                  onChange={(val) => setActivePortfolio(val)}
                  style={{ width: 105, marginLeft: '6px' }}
                  size="small"
                  dropdownStyle={{ background: 'var(--bg-card)' }}
                >
                  <Option value="All Portfolios">🗂️ All</Option>
                  {portfolios.map(p => (
                    <Option key={p} value={p}>💼 {p.slice(0, 8)}{p.length > 8 ? '..' : ''}</Option>
                  ))}
                </Select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Select
                  value={displayCurrency}
                  onChange={(val) => setDisplayCurrency(val)}
                  style={{ width: 75 }}
                  size="small"
                  dropdownStyle={{ background: 'var(--bg-card)' }}
                >
                  <Option value="THB">฿ THB</Option>
                  <Option value="USD">$ USD</Option>
                  <Option value="EUR">€ EUR</Option>
                </Select>
                <Button 
                  size="small"
                  icon={isCensored ? <EyeInvisibleOutlined /> : <EyeOutlined />} 
                  onClick={toggleCensored}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff' }}
                />
                {appPasscode && (
                  <Button 
                    size="small"
                    icon={<LockOutlined />} 
                    onClick={() => setIsLocked(true)}
                    style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff' }}
                  />
                )}
                <Button 
                  type="primary" 
                  size="small"
                  icon={<SyncOutlined spin={isSyncing} />} 
                  onClick={() => syncMarketData()}
                  loading={isSyncing}
                  style={{ background: 'var(--accent-gradient)', border: 'none', color: '#06080f', fontWeight: 'bold' }}
                />
              </div>
            </Header>
          ) : (
            <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', height: 'auto', minHeight: '72px', padding: '12px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <Button
                  type="text"
                  icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setSiderCollapsed(!siderCollapsed)}
                  style={{
                    fontSize: '18px',
                    width: 40,
                    height: 40,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px',
                  }}
                />
                {siderCollapsed && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', boxShadow: '0 0 8px rgba(0,242,254,0.6)' }}></div>
                    <Text style={{ color: '#ffffff', margin: 0, fontFamily: 'var(--font-family-ui)', fontWeight: 900, fontSize: '15px', letterSpacing: '0.8px' }}>
                      ALPHA<span style={{ color: 'var(--primary-color)' }}>TRADER</span>
                    </Text>
                  </div>
                )}
                
                <Space size="small" wrap>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Portfolio:</Text>
                    <Select
                      value={activePortfolio}
                      onChange={(val) => setActivePortfolio(val)}
                      style={{ width: 180 }}
                    >
                      <Option value="All Portfolios">🗂️ All Portfolios (Aggregated)</Option>
                      {portfolios.map(p => (
                        <Option key={p} value={p}>💼 {p}</Option>
                      ))}
                    </Select>
                  </span>

                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Currency:</Text>
                    <Select
                      value={displayCurrency}
                      onChange={(val) => setDisplayCurrency(val)}
                      style={{ width: 95 }}
                    >
                      <Option value="THB">฿ THB</Option>
                      <Option value="USD">$ USD</Option>
                      <Option value="EUR">€ EUR</Option>
                    </Select>
                  </span>
                </Space>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold' }}>AUTO-REFRESH:</span>
                  <Switch 
                    checked={autoRefresh} 
                    onChange={(checked) => setAutoRefresh(checked)} 
                    checkedChildren="ON"
                    unCheckedChildren="OFF"
                    size="small"
                  />
                </div>

                {syncTime && (
                  <Text style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.08)', padding: '4px 8px', borderRadius: '4px' }} className="financial-num">
                    🟢 Synced: {syncTime}
                  </Text>
                )}

                <Button 
                  icon={isCensored ? <EyeInvisibleOutlined /> : <EyeOutlined />} 
                  onClick={toggleCensored}
                  style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff', borderRadius: '6px', fontWeight: 'bold' }}
                >
                  {isCensored ? "Show Balances" : "Censor Balances"}
                </Button>
                {appPasscode && (
                  <Button 
                    icon={<LockOutlined />} 
                    onClick={() => setIsLocked(true)}
                    style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff', borderRadius: '6px', fontWeight: 'bold' }}
                  >
                    Lock App
                  </Button>
                )}
                
                <Button 
                  type="primary" 
                  icon={<SyncOutlined spin={isSyncing} />} 
                  onClick={() => syncMarketData()}
                  loading={isSyncing}
                  style={{ background: 'var(--accent-gradient)', border: 'none', color: '#06080f', fontWeight: 'bold', borderRadius: '6px' }}
                >
                  Sync Markets
                </Button>
              </div>
            </Header>
          )}

          {/* Content Area */}
          <Content style={{ padding: isMobile ? '12px 10px 80px 10px' : '24px', minHeight: 280, overflowY: 'auto' }}>
            <Spin spinning={isSyncing && trades.length === 0} tip="Syncing Terminal Feed...">
              {cloudConnectionError && (
                <Alert
                  message={<strong>Cloud Sync Connection Blocked</strong>}
                  description={
                    <div style={{ fontSize: '13px' }}>
                      <p style={{ margin: '0 0 8px 0' }}>
                        AlphaTrader was unable to fetch data from your Google Apps Script Web App: <code>{cloudConnectionError}</code>
                      </p>
                      <p style={{ margin: '0 0 8px 0' }}>
                        If this is a CORS/tracking blocker error, you can disable tracking protection for this page, or open the link in Incognito/Private mode. We have loaded a <strong>read-only direct Google Sheet fallback</strong> so you can still view your portfolio metrics, trades, and balance!
                      </p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <Button 
                          size="small" 
                          type="primary" 
                          ghost 
                          onClick={() => {
                            localStorage.removeItem('google_apps_script_url');
                            localStorage.removeItem('google_sheet_id');
                            window.location.reload();
                          }}
                        >
                          Reset Cloud Connection Settings
                        </Button>
                        <Button 
                          size="small" 
                          onClick={() => fetchData()}
                        >
                          Retry Connection
                        </Button>
                      </div>
                    </div>
                  }
                  type="warning"
                  showIcon
                  style={{ marginBottom: '16px', border: '1px solid rgba(250, 173, 20, 0.2)', background: 'rgba(250, 173, 20, 0.05)' }}
                />
              )}
              
              {/* 1. DASHBOARD PAGE - MOBILE */}
              {activeTab === 'dashboard' && isMobile && (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  
                  {/* Mobile Account Summary (NAV Hero) */}
                  <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '16px' } }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                          Net Asset Value (NAV)
                        </span>
                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '2px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(netAssetValue)}
                        </div>
                      </div>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: netProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
                      }}>
                        {netProfit >= 0 ? '▲' : '▼'} {netProfitPct.toFixed(1)}%
                      </span>
                    </div>

                    {/* Capital utilization bar */}
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                        <span>Exposure: <strong>{investedPct.toFixed(0)}%</strong></span>
                        <span>Cash: <strong>{cashPct.toFixed(0)}%</strong></span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                        <div style={{ width: `${investedPct}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)' }} />
                        <div style={{ width: `${cashPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)' }} />
                      </div>
                    </div>
                  </Card>

                  {/* 2x2 Grid of Key Financials */}
                  <Row gutter={[10, 10]}>
                    <Col span={12}>
                      <Card 
                        bordered={false} 
                        className={`glass-panel ${kpis.totalPnLConverted >= 0 ? 'glow-card-green' : 'glow-card-red'}`}
                        styles={{ body: { padding: '12px' } }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Total Return
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: 'bold', color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                            {kpis.totalPnLPct.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
                          {kpis.totalPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalPnLConverted)}
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Realized P&L
                          </span>
                          <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '11px' }} />
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(kpis.totalRealizedPnLConverted)}
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Live Valuation
                          </span>
                          <GlobalOutlined style={{ color: 'var(--primary-color)', fontSize: '11px' }} />
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(kpis.currentMarketValueConverted)}
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                            Cash Power
                          </span>
                          <DollarOutlined style={{ color: 'var(--success-color)', fontSize: '11px' }} />
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(portfolioSizing.cashOnHand)}
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* Sizing & Allocation Blueprint Card for Mobile */}
                  <Card bordered={false} className="glass-panel" styles={{ body: { padding: '14px' } }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Blueprint & Risk Management
                      </span>
                      <PieChartOutlined style={{ color: 'var(--primary-color)', fontSize: '12px' }} />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Holdings Slots:</span>
                      <strong style={{ color: '#ffffff', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>
                        {portfolioSizing.activeHoldingsCount} / {portfolioSizing.targetStocks} stocks
                      </strong>
                    </div>

                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ 
                        width: `${Math.min(100, (portfolioSizing.activeHoldingsCount / (portfolioSizing.targetStocks || 1)) * 100)}%`, 
                        height: '100%', 
                        background: 'var(--primary-color)' 
                      }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                      <div>
                        <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Initial Capital</span>
                        <strong style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(portfolioSizing.initialCapital)}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Target Pos. Size</span>
                        <strong style={{ fontSize: '12px', color: 'var(--primary-color)', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(portfolioSizing.positionSizeCash)}</strong>
                      </div>
                    </div>
                  </Card>

                  {/* Chart Selector Horizontal Pills for Mobile */}
                  <div className="mobile-pill-container">
                    <button 
                      className={`mobile-pill-btn ${mobileChartTab === 'performance' ? 'active' : ''}`}
                      onClick={() => setMobileChartTab('performance')}
                    >
                      📈 Earnings
                    </button>
                    <button 
                      className={`mobile-pill-btn ${mobileChartTab === 'analytics' ? 'active' : ''}`}
                      onClick={() => setMobileChartTab('analytics')}
                    >
                      📊 Stats
                    </button>
                    <button 
                      className={`mobile-pill-btn ${mobileChartTab === 'allocation' ? 'active' : ''}`}
                      onClick={() => setMobileChartTab('allocation')}
                    >
                      🍰 Allocation
                    </button>
                    <button 
                      className={`mobile-pill-btn ${mobileChartTab === 'pnl' ? 'active' : ''}`}
                      onClick={() => setMobileChartTab('pnl')}
                    >
                      ⚖️ P&L
                    </button>
                    <button 
                      className={`mobile-pill-btn ${mobileChartTab === 'breakdown' ? 'active' : ''}`}
                      onClick={() => setMobileChartTab('breakdown')}
                    >
                      📋 Realized
                    </button>
                  </div>

                  {/* Render single selected chart for Mobile */}
                  {mobileChartTab === 'performance' && (
                    <Card title={`Realized Earnings Curve (${displayCurrency})`} bordered={false} style={{ height: '310px' }}>
                      {cumulativePnLData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <AreaChart data={cumulativePnLData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <defs>
                              <linearGradient id="pnlGradientMob" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.25}/>
                                <stop offset="95%" stopColor={kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.01}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                            <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                                      <p className="custom-recharts-tooltip-label" style={{ fontSize: '11px' }}>{label}</p>
                                      <p className="custom-recharts-tooltip-value">
                                        Profit: {formatCurrency(payload[0].value)}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                            <Area 
                              type="monotone" 
                              dataKey="PnL" 
                              stroke={kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#pnlGradientMob)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No performance curve data.</Text>
                        </div>
                      )}
                    </Card>
                  )}

                  {mobileChartTab === 'analytics' && (
                    <Card title="📊 Trading Performance" bordered={false} className="glass-panel">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
                        <Progress
                          type="circle"
                          percent={Number(tradingAnalytics.winRate.toFixed(1))}
                          strokeWidth={8}
                          width={90}
                          strokeColor={{
                            '0%': 'var(--danger-color)',
                            '50%': 'rgba(245, 158, 11, 0.8)',
                            '100%': 'var(--success-color)',
                          }}
                          trailColor="rgba(255,255,255,0.05)"
                          format={(pct) => (
                            <div style={{ color: '#ffffff' }}>
                              <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-family-mono)' }}>{pct}%</div>
                              <div style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Win Rate</div>
                            </div>
                          )}
                        />
                        <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px' }}>
                          <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{tradingAnalytics.winCount}W</span>
                          <span style={{ color: 'var(--text-muted)' }}>|</span>
                          <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{tradingAnalytics.lossCount}L</span>
                          <span style={{ color: 'var(--text-muted)' }}>|</span>
                          <span style={{ color: '#ffffff' }}>{tradingAnalytics.totalClosedTrades} Closed</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Actions</span>
                          <strong style={{ color: '#ffffff', fontSize: '12px' }} className="financial-num">{tradingAnalytics.totalTrades} ({tradingAnalytics.buysCount} B / {tradingAnalytics.sellsCount} S)</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Profit Factor</span>
                          <strong style={{ color: tradingAnalytics.profitFactor >= 1.5 ? 'var(--success-color)' : (tradingAnalytics.profitFactor >= 1.0 ? '#f59e0b' : 'var(--danger-color)'), fontSize: '12px' }} className="financial-num">
                            {tradingAnalytics.profitFactor === Infinity ? '∞' : tradingAnalytics.profitFactor.toFixed(2)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Risk-Reward</span>
                          <strong style={{ color: '#ffffff', fontSize: '12px' }} className="financial-num">1 : {tradingAnalytics.riskRewardRatio.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Avg Win / Loss</span>
                          <span className="financial-num" style={{ fontSize: '11px' }}>
                            <strong style={{ color: 'var(--success-color)' }}>{formatCurrency(tradingAnalytics.avgWin)}</strong>
                            <strong style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</strong>
                            <strong style={{ color: 'var(--danger-color)' }}>{formatCurrency(tradingAnalytics.avgLoss)}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Max Win / Loss</span>
                          <span className="financial-num" style={{ fontSize: '11px' }}>
                            <strong style={{ color: 'var(--success-color)' }}>+{formatCurrency(tradingAnalytics.maxWinVal)}</strong>
                            <strong style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</strong>
                            <strong style={{ color: 'var(--danger-color)' }}>-{formatCurrency(tradingAnalytics.maxLossVal)}</strong>
                          </span>
                        </div>
                      </div>
                    </Card>
                  )}

                  {mobileChartTab === 'allocation' && (
                    <Card 
                      title={`Asset Allocation (${displayCurrency})`}
                      extra={
                        <Select
                          size="small"
                          value={allocationDimension}
                          onChange={val => setAllocationDimension(val)}
                          style={{ width: 110 }}
                          dropdownStyle={{ background: 'var(--bg-card)' }}
                        >
                          <Option value="type">By Category</Option>
                          <Option value="name">By Asset</Option>
                        </Select>
                      } 
                      bordered={false} 
                      style={{ height: '330px' }}
                    >
                      {assetAllocationData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={230}>
                          <PieChart>
                            <Pie
                              data={assetAllocationData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {assetAllocationData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const entry = payload[0];
                                  return (
                                    <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                                      <p className="custom-recharts-tooltip-label" style={{ color: entry.payload.color || 'var(--primary-color)', fontSize: '11px' }}>
                                        ● {entry.name}
                                      </p>
                                      <p className="custom-recharts-tooltip-value">
                                        Value: {formatCurrency(entry.value)}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: '10px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No active asset allocations.</Text>
                        </div>
                      )}
                    </Card>
                  )}

                  {mobileChartTab === 'pnl' && (
                    <Card 
                      title={`Portfolio P&L (${displayCurrency})`}
                      extra={
                        <Select
                          size="small"
                          value={pnlDimension}
                          onChange={val => setPnlDimension(val)}
                          style={{ width: 110 }}
                          dropdownStyle={{ background: 'var(--bg-card)' }}
                        >
                          <Option value="strategy">By Strategy</Option>
                          <Option value="type">By Category</Option>
                          <Option value="name">By Asset</Option>
                        </Select>
                      } 
                      bordered={false} 
                      style={{ height: '310px' }}
                    >
                      {pnlDistributionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={pnlDistributionData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const val = payload[0].value;
                                  return (
                                    <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                                      <p className="custom-recharts-tooltip-label" style={{ fontSize: '11px' }}>{label}</p>
                                      <p className="custom-recharts-tooltip-value" style={{ color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                                        P&L: {formatCurrency(val)}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <ReferenceLine y={0} stroke="#475569" />
                            <Bar dataKey="PnL" radius={[4, 4, 0, 0]}>
                              {pnlDistributionData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.PnL >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No strategy data.</Text>
                        </div>
                      )}
                    </Card>
                  )}

                  {mobileChartTab === 'breakdown' && (
                    <Card title={`Realized P&L Breakdown (${displayCurrency})`} bordered={false} style={{ height: '310px' }}>
                      {realizedPnLBreakdownData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={realizedPnLBreakdownData} layout="vertical" margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 8 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} width={55} />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                              content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                  const val = payload[0].value;
                                  return (
                                    <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                                      <p className="custom-recharts-tooltip-label" style={{ fontSize: '11px' }}>{label}</p>
                                      <p className="custom-recharts-tooltip-value" style={{ color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                                        Realized: {formatCurrency(val)}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <ReferenceLine x={0} stroke="#475569" />
                            <Bar dataKey="PnL" radius={[0, 4, 4, 0]}>
                              {realizedPnLBreakdownData.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.PnL >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 8px' }}>
                          <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No realized gains/losses logged.</Text>
                        </div>
                      )}
                    </Card>
                  )}

                  {/* Top Positions Panel for Mobile (Custom List Layout) */}
                  <Card title="Top Portfolio Positions" bordered={false}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {positions
                        .filter(p => p.qtyHeld > 0)
                        .sort((a, b) => b.liveValueConverted - a.liveValueConverted)
                        .slice(0, 5)
                        .map((p) => {
                          const pct = kpis.currentMarketValueConverted > 0
                            ? (p.liveValueConverted / kpis.currentMarketValueConverted) * 100
                            : 0;
                          const isProfit = p.unrealizedPnLConverted >= 0;
                          return (
                            <div key={p.assetName} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ color: '#ffffff', fontSize: '13px' }}>{p.assetName}</strong>
                                  <Tag color="cyan" style={{ marginLeft: '8px', fontSize: '9px', border: 'none', background: 'rgba(0, 242, 254, 0.12)' }}>
                                    {p.assetType}
                                  </Tag>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }} className="financial-num">
                                    {formatCurrency(p.liveValueConverted)}
                                  </span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Weight: {pct.toFixed(1)}%</span>
                                  <div className="concentration-track" style={{ flex: 1, height: '3px', margin: 0 }}>
                                    <div className="concentration-fill" style={{ width: `${pct}%` }}></div>
                                  </div>
                                </div>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: isProfit ? 'var(--success-color)' : 'var(--danger-color)', marginLeft: '12px' }} className="financial-num">
                                  {isProfit ? '▲' : '▼'} {isProfit ? '+' : ''}{isCensored ? '****' : p.unrealizedPnLConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      }
                      {positions.filter(p => p.qtyHeld > 0).length === 0 && (
                        <div style={{ textAlign: 'center', padding: '12px 0' }}>
                          <Text type="secondary" style={{ fontSize: '11px' }}>No active positions in this portfolio.</Text>
                        </div>
                      )}
                    </div>
                  </Card>
                </Space>
              )}

              {/* 1. DASHBOARD PAGE - PC */}
              {activeTab === 'dashboard' && !isMobile && (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  
                  {/* HERO GRID SECTION */}
                  <Row gutter={[24, 24]}>
                    {/* Hero Widget 1: Account Valuation & Capital Efficiency */}
                    <Col xs={24} lg={10}>
                      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '24px' } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                              Net Asset Value (NAV)
                            </span>
                            <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', marginTop: '4px', fontFamily: 'var(--font-family-mono)', letterSpacing: '-0.5px' }}>
                              {formatCurrency(netAssetValue)}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '10px', borderRadius: '12px' }}>
                            <WalletOutlined style={{ color: 'var(--primary-color)', fontSize: '24px' }} />
                          </div>
                        </div>

                        {/* Net ROI indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px', gap: '8px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: netProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
                          }}>
                            {netProfit >= 0 ? '▲' : '▼'} {netProfit >= 0 ? '+' : ''}{netProfitPct.toFixed(2)}%
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            ROI ({netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)})
                          </span>
                        </div>

                        {/* Capital Utilization / Exposure Bar */}
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              Exposure: <strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(kpis.currentMarketValueConverted)} ({investedPct.toFixed(1)}%)</strong>
                            </span>
                            <span style={{ color: 'var(--text-secondary)' }}>
                              Cash: <strong style={{ color: 'var(--success-color)' }}>{formatCurrency(portfolioSizing.cashOnHand)} ({cashPct.toFixed(1)}%)</strong>
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${investedPct}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)', transition: 'width 0.5s ease' }} />
                            <div style={{ width: `${cashPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', transition: 'width 0.5s ease' }} />
                          </div>
                        </div>
                      </Card>
                    </Col>

                    {/* Hero Widget 2: Portfolio Return Metrics */}
                    <Col xs={24} sm={12} lg={7}>
                      <Card bordered={false} className={`glass-panel ${kpis.totalPnLConverted >= 0 ? 'glow-card-green' : 'glow-card-red'}`} styles={{ body: { padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                              Total Return P&L
                            </span>
                            {kpis.totalPnLConverted >= 0 
                              ? <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '20px' }} /> 
                              : <FallOutlined style={{ color: 'var(--danger-color)', fontSize: '20px' }} />
                            }
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 800, color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', marginTop: '8px', fontFamily: 'var(--font-family-mono)' }}>
                            {kpis.totalPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalPnLConverted)}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            All-time yield: <strong style={{ color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{kpis.totalPnLPct.toFixed(2)}%</strong>
                          </div>
                        </div>

                        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Realized P&L</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontFamily: 'var(--font-family-mono)' }}>
                              {kpis.totalRealizedPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalRealizedPnLConverted)}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Paper P&L</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: kpis.totalUnrealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontFamily: 'var(--font-family-mono)' }}>
                              {kpis.totalUnrealizedPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalUnrealizedPnLConverted)}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Col>

                    {/* Hero Widget 3: Sizing & Blueprint */}
                    <Col xs={24} sm={12} lg={7}>
                      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                              Holdings Blueprint
                            </span>
                            <PieChartOutlined style={{ color: 'var(--primary-color)', fontSize: '20px' }} />
                          </div>
                          
                          {/* Active Stocks / Target occupied slots */}
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '8px' }}>
                            <span style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-family-mono)' }}>
                              {portfolioSizing.activeHoldingsCount}
                            </span>
                            <span style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                              / {portfolioSizing.targetStocks} Target Stocks
                            </span>
                          </div>

                          {/* Progress bar of slot occupancy */}
                          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
                            <div style={{ 
                              width: `${Math.min(100, (portfolioSizing.activeHoldingsCount / (portfolioSizing.targetStocks || 1)) * 100)}%`, 
                              height: '100%', 
                              background: 'var(--primary-color)', 
                              transition: 'width 0.5s ease' 
                            }} />
                          </div>
                        </div>

                        <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Initial Capital</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-family-mono)' }}>
                              {formatCurrency(portfolioSizing.initialCapital)}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Pos. Size/Trade</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-color)', fontFamily: 'var(--font-family-mono)' }}>
                              {formatCurrency(portfolioSizing.positionSizeCash)}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  </Row>

                  {/* Cumulative Performance Line Chart (Over time) */}
                  <Row gutter={[24, 24]}>
                    <Col span={24}>
                      <Card title={`Realized Earnings Curve (${displayCurrency})`} bordered={false} style={{ height: '360px' }}>
                        {cumulativePnLData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={270}>
                            <AreaChart
                              data={cumulativePnLData}
                              margin={{ top: 10, right: 15, left: 10, bottom: 10 }}
                            >
                              <defs>
                                <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.25}/>
                                  <stop offset="95%" stopColor={kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.01}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="custom-recharts-tooltip">
                                        <p className="custom-recharts-tooltip-label">{label}</p>
                                        <p className="custom-recharts-tooltip-value">
                                          Realized Profit: {formatCurrency(payload[0].value)}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                              <Area 
                                type="monotone" 
                                dataKey="PnL" 
                                stroke={kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                                strokeWidth={2.5}
                                fillOpacity={1} 
                                fill="url(#pnlGradient)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Text type="secondary" style={{ color: '#5b6b80' }}>No trade history to calculate realized performance curve.</Text>
                          </div>
                        )}
                      </Card>
                    </Col>
                  </Row>

                  {/* Trading Analytics Section */}
                  <Row gutter={[24, 24]}>
                    <Col span={24}>
                      <Card title="📊 Trading Analytics & Performance Statistics" bordered={false} className="glass-panel">
                        <Row gutter={[32, 24]} align="middle">
                          {/* Circular Win Rate Meter */}
                          <Col xs={24} md={8} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: !isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                            <div style={{ position: 'relative', display: 'inline-flex' }}>
                              <Progress
                                type="circle"
                                percent={Number(tradingAnalytics.winRate.toFixed(1))}
                                strokeWidth={8}
                                width={120}
                                strokeColor={{
                                  '0%': 'var(--danger-color)',
                                  '50%': 'rgba(245, 158, 11, 0.8)',
                                  '100%': 'var(--success-color)',
                                }}
                                trailColor="rgba(255,255,255,0.05)"
                                format={(pct) => (
                                  <div style={{ color: '#ffffff' }}>
                                    <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-family-mono)' }}>{pct}%</div>
                                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Win Rate</div>
                                  </div>
                                )}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '20px', marginTop: '16px', textAlign: 'center' }}>
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 700, display: 'block' }}>{tradingAnalytics.winCount} Wins</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Green Deals</span>
                              </div>
                              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '24px' }} />
                              <div>
                                <span style={{ fontSize: '11px', color: 'var(--danger-color)', fontWeight: 700, display: 'block' }}>{tradingAnalytics.lossCount} Losses</span>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Red Deals</span>
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 500 }}>
                              Total Closed Transactions: <strong style={{ color: '#ffffff' }}>{tradingAnalytics.totalClosedTrades}</strong>
                            </div>
                          </Col>

                          {/* Efficiency & Averages Metrics */}
                          <Col xs={24} md={16}>
                            <Row gutter={[24, 20]}>
                              {/* Profit Factor */}
                              <Col xs={12} sm={8}>
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Profit Factor</span>
                                  <strong style={{ 
                                    fontSize: '22px', 
                                    color: tradingAnalytics.profitFactor >= 1.5 ? 'var(--success-color)' : (tradingAnalytics.profitFactor >= 1.0 ? '#f59e0b' : 'var(--danger-color)'), 
                                    fontFamily: 'var(--font-family-mono)',
                                    marginTop: '4px'
                                  }}>
                                    {tradingAnalytics.profitFactor === Infinity ? '∞' : tradingAnalytics.profitFactor.toFixed(2)}
                                  </strong>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {tradingAnalytics.profitFactor >= 1.5 ? '🏆 Excellent' : (tradingAnalytics.profitFactor >= 1.0 ? '⚖️ Profitable' : '⚠️ Unprofitable')}
                                  </span>
                                  <div style={{ marginTop: '8px' }}>
                                    <Progress 
                                      percent={Math.min(100, (tradingAnalytics.profitFactor / 3.0) * 100)} 
                                      showInfo={false} 
                                      size="small" 
                                      status={tradingAnalytics.profitFactor >= 1.5 ? 'success' : (tradingAnalytics.profitFactor >= 1.0 ? 'normal' : 'exception')}
                                      strokeColor={tradingAnalytics.profitFactor >= 1.5 ? 'var(--success-color)' : (tradingAnalytics.profitFactor >= 1.0 ? '#f59e0b' : 'var(--danger-color)')}
                                    />
                                  </div>
                                </div>
                              </Col>

                              {/* Risk Reward */}
                              <Col xs={12} sm={8}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Risk-Reward Ratio</span>
                                  <strong style={{ fontSize: '22px', color: '#ffffff', fontFamily: 'var(--font-family-mono)', marginTop: '4px' }}>
                                    1 : {tradingAnalytics.riskRewardRatio.toFixed(2)}
                                  </strong>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    Avg Loss vs Avg Win
                                  </span>
                                  <div style={{ marginTop: '8px' }}>
                                    <Progress 
                                      percent={Math.min(100, (tradingAnalytics.riskRewardRatio / 3.0) * 100)} 
                                      showInfo={false} 
                                      size="small" 
                                      strokeColor="var(--primary-color)"
                                    />
                                  </div>
                                </div>
                              </Col>

                              {/* Total Trades Count */}
                              <Col xs={12} sm={8}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Actions logged</span>
                                  <strong style={{ fontSize: '22px', color: '#ffffff', fontFamily: 'var(--font-family-mono)', marginTop: '4px' }}>
                                    {tradingAnalytics.totalTrades}
                                  </strong>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {tradingAnalytics.buysCount} Buys / {tradingAnalytics.sellsCount} Sells
                                  </span>
                                </div>
                              </Col>

                              {/* Avg Win / Loss */}
                              <Col xs={12} sm={12}>
                                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Avg Win vs Avg Loss</span>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>AVERAGE WIN</span>
                                      <strong style={{ color: 'var(--success-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(tradingAnalytics.avgWin)}</strong>
                                    </div>
                                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', height: '20px' }} />
                                    <div>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>AVERAGE LOSS</span>
                                      <strong style={{ color: 'var(--danger-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(tradingAnalytics.avgLoss)}</strong>
                                    </div>
                                  </div>
                                </div>
                              </Col>

                              {/* Max Win / Loss */}
                              <Col xs={12} sm={12}>
                                <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Extreme Trades (Max)</span>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>BIGGEST WIN</span>
                                      <strong style={{ color: 'var(--success-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>+{formatCurrency(tradingAnalytics.maxWinVal)}</strong>
                                    </div>
                                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', height: '20px' }} />
                                    <div>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>BIGGEST LOSS</span>
                                      <strong style={{ color: 'var(--danger-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>-{formatCurrency(tradingAnalytics.maxLossVal)}</strong>
                                    </div>
                                  </div>
                                </div>
                              </Col>
                            </Row>
                          </Col>
                        </Row>
                      </Card>
                    </Col>
                  </Row>

                  {/* Allocation & Strategy Charts Row */}
                  <Row gutter={[24, 24]}>
                    {/* Allocation Pie Chart */}
                    <Col xs={24} lg={8}>
                      <Card 
                        title={`Asset Allocation (${displayCurrency})`}
                        extra={
                          <Select
                            size="small"
                            value={allocationDimension}
                            onChange={val => setAllocationDimension(val)}
                            style={{ width: 130 }}
                            dropdownStyle={{ background: 'var(--bg-card)' }}
                          >
                            <Option value="type">By Category</Option>
                            <Option value="name">By Asset Name</Option>
                          </Select>
                        } 
                        bordered={false} 
                        style={{ height: '370px' }}
                      >
                        {assetAllocationData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={270}>
                            <PieChart>
                              <Pie
                                data={assetAllocationData}
                                cx="50%"
                                cy="50%"
                                innerRadius={65}
                                outerRadius={90}
                                paddingAngle={4}
                                dataKey="value"
                              >
                                {assetAllocationData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const entry = payload[0];
                                    return (
                                      <div className="custom-recharts-tooltip">
                                        <p className="custom-recharts-tooltip-label" style={{ color: entry.payload.color || 'var(--primary-color)' }}>
                                          ● {entry.name}
                                        </p>
                                        <p className="custom-recharts-tooltip-value">
                                          Value: {formatCurrency(entry.value)}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Text type="secondary" style={{ color: '#5b6b80' }}>No active asset allocations in this portfolio.</Text>
                          </div>
                        )}
                      </Card>
                    </Col>

                    {/* Portfolio P&L Distribution Bar Chart */}
                    <Col xs={24} lg={8}>
                      <Card 
                        title={`Portfolio P&L (${displayCurrency})`}
                        extra={
                          <Select
                            size="small"
                            value={pnlDimension}
                            onChange={val => setPnlDimension(val)}
                            style={{ width: 140 }}
                            dropdownStyle={{ background: 'var(--bg-card)' }}
                          >
                            <Option value="strategy">By Strategy</Option>
                            <Option value="type">By Category</Option>
                            <Option value="name">By Asset Name</Option>
                          </Select>
                        } 
                        bordered={false} 
                        style={{ height: '370px' }}
                      >
                        {pnlDistributionData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={270}>
                            <BarChart
                              data={pnlDistributionData}
                              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                              <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                              <Tooltip 
                                cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    const val = payload[0].value;
                                    return (
                                      <div className="custom-recharts-tooltip">
                                        <p className="custom-recharts-tooltip-label">{label}</p>
                                        <p className="custom-recharts-tooltip-value" style={{ color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                                          P&L: {formatCurrency(val)}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <ReferenceLine y={0} stroke="#475569" />
                              <Bar dataKey="PnL" radius={[4, 4, 0, 0]}>
                                {pnlDistributionData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.PnL >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Text type="secondary" style={{ color: '#5b6b80' }}>No strategy data logged in this portfolio.</Text>
                          </div>
                        )}
                      </Card>
                    </Col>

                    {/* Realized P&L Breakdown by Asset Chart */}
                    <Col xs={24} lg={8}>
                      <Card title={`Realized P&L Breakdown (${displayCurrency})`} bordered={false} style={{ height: '370px' }}>
                        {realizedPnLBreakdownData.length > 0 ? (
                          <ResponsiveContainer width="100%" height={270}>
                            <BarChart
                              data={realizedPnLBreakdownData}
                              layout="vertical"
                              margin={{ top: 10, right: 15, left: 15, bottom: 10 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" horizontal={false} />
                              <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                              <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} width={55} />
                              <Tooltip 
                                cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    const val = payload[0].value;
                                    return (
                                      <div className="custom-recharts-tooltip">
                                        <p className="custom-recharts-tooltip-label">{label}</p>
                                        <p className="custom-recharts-tooltip-value" style={{ color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                                          Realized P&L: {formatCurrency(val)}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <ReferenceLine x={0} stroke="#475569" />
                              <Bar dataKey="PnL" radius={[0, 4, 4, 0]}>
                                {realizedPnLBreakdownData.map((entry, index) => (
                                  <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.PnL >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div style={{ height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', textAlign: 'center' }}>
                            <Text type="secondary" style={{ color: '#5b6b80', fontSize: '13px' }}>
                              No realized gains/losses logged yet.
                              <br />
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Realized returns are locked in upon SELL transactions.</span>
                            </Text>
                          </div>
                        )}
                      </Card>
                    </Col>
                  </Row>

                  {/* Top Holdings Panel */}
                  <Card title="Top Portfolio Positions" bordered={false}>
                    <Table 
                      columns={positionColumns.slice(0, 9)} 
                      dataSource={positions.filter(p => p.qtyHeld > 0).sort((a, b) => b.liveValueConverted - a.liveValueConverted).slice(0, 5)} 
                      rowKey="assetName"
                      pagination={false}
                      size="middle"
                      scroll={{ x: 'max-content' }}
                    />
                  </Card>
                </Space>
              )}

              {/* 2. TRADING JOURNAL PAGE */}
              {activeTab === 'journal' && (
                isMobile ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Title level={4} style={{ color: '#ffffff', margin: 0 }}>Trading Journal</Title>
                      <Space>
                        <Button 
                          type="primary" 
                          icon={<PlusOutlined />} 
                          onClick={() => {
                            setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
                            setFormAction('Buy');
                            tradeForm.resetFields();
                            setIsTradeModalOpen(true);
                          }}
                          style={{ backgroundColor: 'var(--success-color)', border: 'none', fontWeight: 'bold', color: '#06080f' }}
                          size="small"
                        >
                          Log Trade
                        </Button>
                        <Button 
                          icon={<DownloadOutlined />} 
                          onClick={exportJournalToCSV}
                          disabled={filteredTrades.length === 0}
                          size="small"
                        />
                      </Space>
                    </div>

                    {/* Mobile Filters */}
                    <Card bordered={false} styles={{ body: { padding: '12px' } }}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Input
                          placeholder="Search asset, strategy, notes..."
                          value={journalSearch}
                          onChange={e => setJournalSearch(e.target.value)}
                          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                          allowClear
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Select
                            value={journalActionFilter}
                            onChange={val => setJournalActionFilter(val)}
                            style={{ flex: 1 }}
                            dropdownStyle={{ background: 'var(--bg-card)' }}
                          >
                            <Option value="All">All Actions</Option>
                            <Option value="Buy">Buys</Option>
                            <Option value="Sell">Sells</Option>
                          </Select>
                          <Select
                            value={journalAssetTypeFilter}
                            onChange={val => setJournalAssetTypeFilter(val)}
                            style={{ flex: 1 }}
                            dropdownStyle={{ background: 'var(--bg-card)' }}
                          >
                            <Option value="All">All Categories</Option>
                            <Option value="Thai Stock">Thai Stock</Option>
                            <Option value="Global Stock">Global Stock</Option>
                            <Option value="Crypto">Crypto</Option>
                          </Select>
                        </div>
                      </Space>
                    </Card>

                    {/* Mobile Cards Feed */}
                    <div className="mobile-card-list">
                      {journalFilteredTrades.length > 0 ? (
                        journalFilteredTrades.map(trade => {
                          const actionLower = trade.action.toLowerCase();
                          const isBuy = actionLower === 'buy';
                          const qty = trade.quantity;
                          const buyPrice = trade.priceUnit;
                          const feeAmount = trade.feeAmount !== undefined ? Number(trade.feeAmount) : 0.0;
                          
                          const stats = tradesWithRunningStats[trade.id];
                          const rateToTHB = liveRates[trade.currency] || 1.0;
                          const displayRateToTHB = liveRates[displayCurrency] || 1.0;
                          
                          const pnlLocal = stats ? (isBuy ? stats.unrealizedPnL : stats.realizedPnL) : 0.0;
                          const pnlConverted = (pnlLocal * rateToTHB) / displayRateToTHB;
                          const totalCost = isBuy ? (qty * buyPrice + feeAmount) : (qty * buyPrice - feeAmount);
                          
                          const isProfit = pnlConverted >= 0;
                          const hasDetails = trade.why || trade.remark;
                          
                          return (
                            <div key={trade.id} className={`mobile-feed-card ${isBuy ? 'buy' : 'sell'}`}>
                              <div className="mobile-feed-card-header">
                                <div className="mobile-feed-card-title">
                                  <span className="mobile-feed-card-ticker">{trade.assetName}</span>
                                  <span className={`pill ${isBuy ? 'pill-buy' : 'pill-sell'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                                    {trade.action.toUpperCase()}
                                  </span>
                                  <Tag color="geekblue" style={{ fontSize: '9px', margin: 0 }}>
                                    {trade.portfolio}
                                  </Tag>
                                </div>
                                <span className="mobile-feed-card-date">{trade.date}</span>
                              </div>

                              <div className="mobile-feed-card-grid">
                                <div>
                                  <div className="mobile-feed-card-label">Quantity</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {isCensored ? '****' : qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Price/Unit</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {formatCurrency(buyPrice, trade.currency)}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Fee</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {feeAmount > 0 ? formatCurrency(feeAmount, trade.currency) : 'Free'}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Total Cost</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {formatCurrency(totalCost, trade.currency)}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Avg Cost Basis</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {formatCurrency(stats ? stats.avgCostBasis : buyPrice, trade.currency)}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">{isBuy ? 'Unrealized P&L' : 'Realized P&L'}</div>
                                  <div className={`mobile-feed-card-value financial-num ${isProfit ? 'trend-up' : 'trend-down'}`}>
                                    {isProfit ? '+' : ''}{isCensored ? '****' : pnlConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>

                              {hasDetails && (
                                <div className="mobile-feed-card-expandable">
                                  {trade.why && (
                                    <div style={{ marginBottom: trade.remark ? '6px' : 0 }}>
                                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Strategy</span>
                                      <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{trade.why}</span>
                                    </div>
                                  )}
                                  {trade.remark && (
                                    <div>
                                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Private Notes</span>
                                      <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{trade.remark}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              <div className="mobile-feed-card-footer">
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Category: {trade.assetType}</span>
                                <Space size="middle">
                                  <Button 
                                    type="text" 
                                    icon={<EditOutlined style={{ color: 'var(--primary-color)' }} />} 
                                    size="small" 
                                    title="Edit Trade Entry"
                                    onClick={() => {
                                      const standardStrategies = [
                                        "CDC Action Zone",
                                        "Breakout",
                                        "EMA Cross",
                                        "Support/Resistance Bounce",
                                        "Value Investment",
                                        "Rebalance"
                                      ];
                                      const isCustom = trade.why && !standardStrategies.includes(trade.why);
                                      setEditingTrade(trade);
                                      setIsCustomStrategy(isCustom);
                                      editStrategyForm.setFieldsValue({
                                        quantity: trade.quantity !== undefined ? Number(trade.quantity) : 0,
                                        priceUnit: trade.priceUnit !== undefined ? Number(trade.priceUnit) : 0,
                                        feeAmount: trade.feeAmount !== undefined ? Number(trade.feeAmount) : 0,
                                        why: isCustom ? 'Other' : (trade.why || undefined),
                                        customWhy: isCustom ? trade.why : '',
                                        remark: trade.remark
                                      });
                                      setIsEditStrategyModalOpen(true);
                                    }}
                                    style={{ padding: 0 }}
                                  />
                                  <Button 
                                    type="text" 
                                    icon={<SwapOutlined style={{ color: 'var(--warning-color)' }} />} 
                                    size="small" 
                                    title="Transfer Portfolio"
                                    onClick={() => {
                                      setEditingTrade(trade);
                                      transferForm.setFieldsValue({
                                        targetPortfolio: trade.portfolio
                                      });
                                      setIsTransferModalOpen(true);
                                    }}
                                    style={{ padding: 0 }}
                                  />
                                  <Popconfirm
                                    title="Delete Trade"
                                    description="Are you sure you want to delete this trade?"
                                    onConfirm={() => handleDeleteTrade(trade.id)}
                                    okText="Delete"
                                    cancelText="Cancel"
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button type="text" danger icon={<DeleteOutlined />} size="small" style={{ padding: 0 }} />
                                  </Popconfirm>
                                </Space>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(11, 14, 23, 0.4)', borderRadius: '12px' }}>
                          <Text type="secondary">No transactions match search.</Text>
                        </div>
                      )}
                    </div>
                  </Space>
                ) : (
                  <Card 
                    title="Trading Journal Logs"
                    extra={
                      <Space>
                        <Button 
                          type="primary" 
                          icon={<PlusOutlined />} 
                          onClick={() => {
                            setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
                            setFormAction('Buy');
                            tradeForm.resetFields();
                            setIsTradeModalOpen(true);
                          }}
                          style={{ backgroundColor: 'var(--success-color)', border: 'none', fontWeight: 'bold', color: '#06080f' }}
                        >
                          Log Trade
                        </Button>
                        <Button 
                          icon={<DownloadOutlined />} 
                          onClick={exportJournalToCSV}
                          disabled={filteredTrades.length === 0}
                          style={{ fontWeight: 'bold' }}
                        >
                          Export CSV
                        </Button>
                      </Space>
                    } 
                    bordered={false}
                  >
                    {/* Search and Filters Toolbar */}
                    <Space wrap size="middle" style={{ marginBottom: 20, width: '100%' }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>SEARCH</Text>
                        <Input
                          placeholder="Search asset, strategy, notes..."
                          value={journalSearch}
                          onChange={e => setJournalSearch(e.target.value)}
                          style={{ width: 260 }}
                          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                          allowClear
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>ACTION</Text>
                        <Select
                          value={journalActionFilter}
                          onChange={val => setJournalActionFilter(val)}
                          style={{ width: 130 }}
                        >
                          <Option value="All">All Actions</Option>
                          <Option value="Buy">Buys</Option>
                          <Option value="Sell">Sells</Option>
                        </Select>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>CATEGORY</Text>
                        <Select
                          value={journalAssetTypeFilter}
                          onChange={val => setJournalAssetTypeFilter(val)}
                          style={{ width: 160 }}
                        >
                          <Option value="All">All Categories</Option>
                          <Option value="Thai Stock">Thai Stock</Option>
                          <Option value="Global Stock">Global Stock</Option>
                          <Option value="Crypto">Crypto</Option>
                        </Select>
                      </div>
                    </Space>

                    <Table 
                      columns={journalColumns} 
                      dataSource={journalFilteredTrades} 
                      rowKey="id"
                      pagination={{ 
                        defaultPageSize: 10,
                        showSizeChanger: true,
                        pageSizeOptions: ['10', '20', '30'],
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} transactions`
                      }}
                      size="middle"
                      scroll={{ x: 'max-content' }}
                      expandable={{
                        expandedRowRender: (record) => (
                          <div className="expanded-remarks" style={{ padding: '16px 24px' }}>
                            <div style={{ fontWeight: 'bold', color: '#ffffff', marginBottom: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Trade Analysis & Diary
                            </div>
                            <Row gutter={[16, 16]}>
                              <Col xs={24} sm={12}>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Strategy / Trigger</Text>
                                <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
                                  {record.why || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>None specified</span>}
                                </div>
                              </Col>
                              <Col xs={24} sm={12}>
                                <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Private Notes</Text>
                                <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
                                  {record.remark || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No notes</span>}
                                </div>
                              </Col>
                            </Row>
                          </div>
                        ),
                        rowExpandable: (record) => !!(record.why || record.remark),
                      }}
                    />
                  </Card>
                )
              )}

              {/* 3. ACTIVE POSITIONS PAGE */}
              {activeTab === 'positions' && (
                isMobile ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Title level={4} style={{ color: '#ffffff', margin: 0 }}>Active Positions</Title>
                    </div>

                    <Card bordered={false} styles={{ body: { padding: '12px' } }}>
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Input
                          placeholder="Search asset symbol..."
                          value={positionsSearch}
                          onChange={e => setPositionsSearch(e.target.value)}
                          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                          allowClear
                        />
                        <Select
                          value={positionsTypeFilter}
                          onChange={val => setPositionsTypeFilter(val)}
                          style={{ width: '100%' }}
                          dropdownStyle={{ background: 'var(--bg-card)' }}
                        >
                          <Option value="All">All Categories</Option>
                          <Option value="Thai Stock">Thai Stock</Option>
                          <Option value="Global Stock">Global Stock</Option>
                          <Option value="Crypto">Crypto</Option>
                        </Select>
                      </Space>
                    </Card>

                    {/* Mobile Positions Feed */}
                    <div className="mobile-card-list">
                      {renderedPositions.length > 0 ? (
                        renderedPositions.map(pos => {
                          const pct = kpis.currentMarketValueConverted > 0
                            ? (pos.liveValueConverted / kpis.currentMarketValueConverted) * 100
                            : 0;
                          const isUnrealizedProfit = pos.unrealizedPnLConverted >= 0;
                          const isRealizedProfit = pos.realizedPnLConverted >= 0;
                          
                          return (
                            <div key={pos.assetName} className="mobile-feed-card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                              <div className="mobile-feed-card-header">
                                <div className="mobile-feed-card-title">
                                  <strong className="mobile-feed-card-ticker">{pos.assetName}</strong>
                                  <Tag color="cyan" style={{ fontSize: '9px', margin: 0 }}>
                                    {pos.assetType}
                                  </Tag>
                                  {pos.qtyHeld === 0 && <Tag color="default" style={{ fontSize: '9px', margin: 0 }}>Closed</Tag>}
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }} className="financial-num">
                                  {pct.toFixed(1)}% alloc
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <div className="concentration-track" style={{ flex: 1, height: '4px', margin: 0 }}>
                                  <div className="concentration-fill" style={{ width: `${pct}%` }}></div>
                                </div>
                              </div>

                              <div className="mobile-feed-card-grid">
                                <div>
                                  <div className="mobile-feed-card-label">Qty Held</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {isCensored ? '****' : pos.qtyHeld.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Avg Buy Price</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {formatCurrency(pos.wac, pos.currency)}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Live Price</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {livePrices[pos.assetName] !== undefined ? formatCurrency(livePrices[pos.assetName], pos.currency) : '-'}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Live Value</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {formatCurrency(pos.liveValueConverted, displayCurrency)}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Unrealized P&L</div>
                                  <div className={`mobile-feed-card-value financial-num ${isUnrealizedProfit ? 'trend-up' : 'trend-down'}`}>
                                    {isUnrealizedProfit ? '+' : ''}{isCensored ? '****' : pos.unrealizedPnLConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">Realized P&L</div>
                                  <div className={`mobile-feed-card-value financial-num ${isRealizedProfit ? 'trend-up' : 'trend-down'}`}>
                                    {isRealizedProfit ? '+' : ''}{isCensored ? '****' : pos.realizedPnLConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </div>
                                </div>
                              </div>

                              <div className="mobile-feed-card-footer">
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cost: {formatCurrency(pos.totalCostConverted, displayCurrency)}</span>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(11, 14, 23, 0.4)', borderRadius: '12px' }}>
                          <Text type="secondary">No active positions match filters.</Text>
                        </div>
                      )}
                    </div>
                  </Space>
                ) : (
                  <Card title={`Active Positions & Portfolio Composition (${displayCurrency})`} bordered={false}>
                    {/* Search and Filter Toolbar */}
                    <Space wrap size="middle" style={{ marginBottom: 20, width: '100%' }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>SEARCH SYMBOL</Text>
                        <Input
                          placeholder="Search asset symbol..."
                          value={positionsSearch}
                          onChange={e => setPositionsSearch(e.target.value)}
                          style={{ width: 220 }}
                          prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                          allowClear
                        />
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>CATEGORY</Text>
                        <Select
                          value={positionsTypeFilter}
                          onChange={val => setPositionsTypeFilter(val)}
                          style={{ width: 160 }}
                        >
                          <Option value="All">All Categories</Option>
                          <Option value="Thai Stock">Thai Stock</Option>
                          <Option value="Global Stock">Global Stock</Option>
                          <Option value="Crypto">Crypto</Option>
                        </Select>
                      </div>
                    </Space>

                    <Table 
                      columns={positionColumns} 
                      dataSource={renderedPositions} 
                      rowKey="assetName"
                      pagination={false}
                      size="middle"
                      scroll={{ x: 'max-content' }}
                      summary={(pageData) => {
                        let totalCostSum = 0;
                        let totalValueSum = 0;
                        let totalUnrealizedPnLSum = 0;
                        let totalRealizedPnLSum = 0;

                        pageData.forEach(({ totalCostConverted, liveValueConverted, unrealizedPnLConverted, realizedPnLConverted }) => {
                          totalCostSum += totalCostConverted;
                          totalValueSum += liveValueConverted;
                          totalUnrealizedPnLSum += unrealizedPnLConverted;
                          totalRealizedPnLSum += realizedPnLConverted;
                        });

                        return (
                          <Table.Summary.Row style={{ backgroundColor: 'rgba(31, 41, 61, 0.25)' }}>
                            <Table.Summary.Cell index={0} colSpan={6}><strong style={{ color: '#ffffff' }}>AGGREGATED TOTALS ({displayCurrency})</strong></Table.Summary.Cell>
                            <Table.Summary.Cell index={1} align="right" className="financial-num">
                              <strong style={{ color: '#ffffff' }}>{formatCurrency(totalCostSum, displayCurrency)}</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={2}></Table.Summary.Cell>
                            <Table.Summary.Cell index={3} align="right" className="financial-num">
                              <strong style={{ color: '#ffffff' }}>{formatCurrency(totalValueSum, displayCurrency)}</strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={4} align="right" className="financial-num">
                              <strong className={totalUnrealizedPnLSum >= 0 ? 'trend-up' : 'trend-down'}>
                                {totalUnrealizedPnLSum >= 0 ? '+' : ''}{isCensored ? '****' : totalUnrealizedPnLSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </Table.Summary.Cell>
                            <Table.Summary.Cell index={5} align="right" className="financial-num">
                              <strong className={totalRealizedPnLSum >= 0 ? 'trend-up' : 'trend-down'}>
                                {totalRealizedPnLSum >= 0 ? '+' : ''}{isCensored ? '****' : totalRealizedPnLSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </Table.Summary.Cell>
                          </Table.Summary.Row>
                        );
                      }}
                    />
                  </Card>
                )
              )}

              {/* 4. SETTINGS PAGE */}
              {activeTab === 'settings' && (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  
                  {/* Portfolios Management Card */}
                  <Card 
                    title="Portfolio Customizer"
                    extra={
                      <Button 
                        type="primary" 
                        icon={<PlusOutlined />} 
                        onClick={() => setIsPortfolioModalOpen(true)}
                        size="small"
                        style={{ color: '#06080f', fontWeight: 'bold' }}
                      >
                        Create Portfolio
                      </Button>
                    } 
                    bordered={false}
                  >
                    {isMobile ? (
                      <div className="mobile-card-list" style={{ paddingBottom: 0 }}>
                        {portfolios.map(p => {
                          const count = trades.filter(t => t.portfolio === p).length;
                          const config = getPortfolioConfig(p);
                          return (
                            <div key={p} className="mobile-feed-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--info-color)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <span style={{ fontSize: '18px' }}>💼</span>
                                  <div>
                                    <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>{p}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{count} trades logged</div>
                                  </div>
                                </div>
                                <Space size="middle">
                                  <Button 
                                    type="text" 
                                    icon={<SettingOutlined />} 
                                    style={{ padding: 0 }}
                                    onClick={() => {
                                      const conf = getPortfolioConfig(p);
                                      setRenameTarget(p);
                                      renameForm.setFieldsValue({ 
                                        name: p,
                                        initialCapital: conf.initialCapital,
                                        targetStocks: conf.targetStocks
                                      });
                                      setIsRenameModalOpen(true);
                                    }}
                                  >
                                    Configure
                                  </Button>
                                  <Popconfirm
                                    title="Delete Portfolio"
                                    description={`Are you sure you want to delete portfolio "${p}"?`}
                                    onConfirm={() => handleDeletePortfolio(p)}
                                    okText="Delete"
                                    cancelText="Cancel"
                                    disabled={portfolios.length > 0 && p === portfolios[0]}
                                    okButtonProps={{ danger: true }}
                                  >
                                    <Button 
                                      type="text" 
                                      danger 
                                      icon={<DeleteOutlined />} 
                                      style={{ padding: 0 }}
                                      disabled={portfolios.length > 0 && p === portfolios[0]}
                                    />
                                  </Popconfirm>
                                </Space>
                              </div>
                              <div style={{ display: 'flex', gap: '20px', fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '28px' }}>
                                <div>Capital: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{formatCurrency(config.initialCapital, displayCurrency)}</span></div>
                                <div>Target: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{config.targetStocks} stocks</span></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Table
                        dataSource={portfolios.map(p => ({ name: p }))}
                        rowKey="name"
                        pagination={false}
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        columns={[
                          {
                            title: 'Portfolio Name',
                            dataIndex: 'name',
                            key: 'name',
                            render: (text) => (
                              <span style={{ fontSize: '14px' }}>
                                💼 <strong style={{ color: '#ffffff' }}>{text}</strong>
                              </span>
                            )
                          },
                          {
                            title: 'Connected Trades count',
                            key: 'trades_count',
                            render: (_, record) => {
                              const count = trades.filter(t => t.portfolio === record.name).length;
                              return <Tag color="blue" style={{ borderRadius: '4px' }}>{count} trades</Tag>;
                            }
                          },
                          {
                            title: 'Initial Capital',
                            key: 'initial_capital',
                            render: (_, record) => {
                              const conf = getPortfolioConfig(record.name);
                              return <span style={{ color: '#ffffff', fontWeight: 'bold', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(conf.initialCapital, displayCurrency)}</span>;
                            }
                          },
                          {
                            title: 'Target Stocks to Hold',
                            key: 'target_stocks',
                            render: (_, record) => {
                              const conf = getPortfolioConfig(record.name);
                              return <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{conf.targetStocks}</span>;
                            }
                          },
                          {
                            title: 'Action',
                            key: 'portfolio_actions',
                            align: 'right',
                            render: (_, record) => (
                              <Space size="middle">
                                <Button 
                                  type="text" 
                                  icon={<SettingOutlined />} 
                                  onClick={() => {
                                    const conf = getPortfolioConfig(record.name);
                                    setRenameTarget(record.name);
                                    renameForm.setFieldsValue({ 
                                      name: record.name,
                                      initialCapital: conf.initialCapital,
                                      targetStocks: conf.targetStocks
                                    });
                                    setIsRenameModalOpen(true);
                                  }}
                                >
                                  Configure
                                </Button>
                                <Popconfirm
                                  title="Delete Portfolio"
                                  description={`Are you sure you want to delete portfolio "${record.name}"? This is only possible if there are no logged trades associated with it.`}
                                  onConfirm={() => handleDeletePortfolio(record.name)}
                                  okText="Delete"
                                  cancelText="Cancel"
                                  disabled={portfolios.length > 0 && record.name === portfolios[0]}
                                  okButtonProps={{ danger: true }}
                                >
                                  <Button 
                                    type="text" 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    disabled={portfolios.length > 0 && record.name === portfolios[0]}
                                  >
                                    Delete
                                  </Button>
                                </Popconfirm>
                              </Space>
                            )
                          }
                        ]}
                      />
                    )}
                  </Card>

                  {/* Google Sheets Mobile Sync Card */}
                  <Card title="📱 Cloud Google Sheets & Mobile Sync" bordered={false}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                        Enable mobile access 24/7 with your PC closed. Sync your database to Google Sheets to read and write trades dynamically.
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#ffffff', minWidth: '160px' }}>Google Sheet ID (Read):</strong>
                          <Input 
                            placeholder="" 
                            value={googleSheetId} 
                            onChange={(e) => setGoogleSheetId(e.target.value)} 
                            style={{ maxWidth: '400px', flex: 1 }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#ffffff', minWidth: '160px' }}>Apps Script URL (Write):</strong>
                          <Input 
                            placeholder="" 
                            value={googleAppsScriptUrl} 
                            onChange={(e) => setGoogleAppsScriptUrl(e.target.value)} 
                            style={{ maxWidth: '400px', flex: 1 }}
                          />
                        </div>

                        <div style={{ marginTop: '5px' }}>
                          <Button 
                            type="primary" 
                            onClick={handleSaveGoogleSheetSettings} 
                            loading={isSyncingSheet}
                            style={{ color: '#06080f', fontWeight: 'bold' }}
                          >
                            Save Settings & Sync
                          </Button>
                        </div>
                      </div>

                      {googleSheetId && (
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '5px', flexWrap: 'wrap' }}>
                          <Button 
                            icon={<SyncOutlined spin={isSyncingSheet} />} 
                            onClick={handleSyncGoogleSheet}
                            loading={isSyncingSheet}
                            style={{ fontWeight: 'bold' }}
                          >
                            Sync Google Sheet Now
                          </Button>
                          <Button 
                            danger
                            icon={<LogoutOutlined />}
                            onClick={() => {
                              localStorage.removeItem('google_sheet_id');
                              localStorage.removeItem('google_apps_script_url');
                              localStorage.removeItem('alphatrader_passcode');
                              localStorage.removeItem('alphatrader_autolock');
                              setGoogleSheetId('');
                              setGoogleAppsScriptUrl('');
                              setAppPasscode('');
                              setIsConnected(false);
                              message.success('Logged out successfully from Google Sheet.');
                            }}
                            style={{ fontWeight: 'bold' }}
                          >
                            Log Out / Disconnect
                          </Button>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            Total synced trades: <Tag color="cyan">{googleSheetSyncCount}</Tag>
                          </span>
                        </div>
                      )}

                      <Alert 
                        message={<span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>Setup Guides & Codes</span>}
                        description={
                          <div style={{ fontSize: '12px' }}>
                            <p style={{ margin: '0 0 8px 0' }}><strong>1. Share settings:</strong> Ensure your Google Sheet is set to <strong>"Anyone with the link can view"</strong> (read-only link sharing) so AlphaTrader can read data.</p>
                            <p style={{ margin: 0 }}><strong>2. Apps Script (for Mobile Logging):</strong> To write trades from mobile, open your Google Sheet, click <em>Extensions &rarr; Apps Script</em>, paste the script code from the deployment guide, and deploy it as a <strong>Web App</strong> (Execute as: Me, Who has access: Anyone).</p>
                          </div>
                        }
                        type="success"
                        showIcon
                        style={{ border: '1px solid rgba(82, 196, 26, 0.15)', background: 'rgba(82, 196, 26, 0.02)', color: 'var(--text-primary)' }}
                      />
                    </Space>
                  </Card>

                  {/* App Security & Lock Card */}
                  <Card title="🔒 App Security & Lock" bordered={false}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
                        Secure your trading journal data with a lock passcode. When enabled, you must enter the passcode to access the terminal.
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#ffffff', minWidth: '160px' }}>Enable Passcode Lock:</strong>
                          <Switch 
                            checked={!!appPasscode} 
                            onChange={(checked) => {
                              if (!checked) {
                                setAppPasscode('');
                                localStorage.removeItem('alphatrader_passcode');
                                message.success('Passcode lock disabled.');
                              } else {
                                message.info('Please enter a passcode below to enable lock.');
                              }
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#ffffff', minWidth: '160px' }}>Passcode:</strong>
                          <Input.Password 
                            placeholder="Enter 4-6 digit code or password" 
                            value={appPasscode} 
                            onChange={(e) => {
                              const val = e.target.value;
                              setAppPasscode(val);
                              if (val) {
                                localStorage.setItem('alphatrader_passcode', val);
                              } else {
                                localStorage.removeItem('alphatrader_passcode');
                              }
                            }} 
                            style={{ maxWidth: '400px', flex: 1 }}
                          />
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <strong style={{ color: '#ffffff', minWidth: '160px' }}>Auto-Lock on Idle:</strong>
                          <Select 
                            value={autoLockMinutes} 
                            onChange={(val) => {
                              setAutoLockMinutes(val);
                              localStorage.setItem('alphatrader_autolock', val.toString());
                              message.success(`Auto-lock configured for ${val === 0 ? 'Disabled' : `${val} minute(s)`}.`);
                            }}
                            style={{ width: '180px' }}
                          >
                            <Option value={0}>Disabled</Option>
                            <Option value={1}>1 Minute</Option>
                            <Option value={3}>3 Minutes</Option>
                            <Option value={5}>5 Minutes</Option>
                            <Option value={10}>10 Minutes</Option>
                            <Option value={30}>30 Minutes</Option>
                          </Select>
                        </div>

                        <div style={{ marginTop: '5px' }}>
                          <Button 
                            type="primary" 
                            onClick={async () => {
                              localStorage.setItem('alphatrader_passcode', appPasscode);
                              localStorage.setItem('alphatrader_autolock', autoLockMinutes.toString());
                              message.success('Security settings saved successfully!');
                            }} 
                            style={{ color: '#06080f', fontWeight: 'bold' }}
                          >
                            Save Security Settings
                          </Button>
                        </div>
                      </div>
                    </Space>
                  </Card>

                  {/* Feed & API Status Card */}
                  <Card title="Yahoo Finance Data Config" bordered={false}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: '#ffffff' }}>Yahoo Finance Auto-Refresh</strong>
                          <br />
                          <Text style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Automatically query Yahoo Finance API tickers and exchange rates every 60 seconds.</Text>
                        </div>
                        <Switch 
                          checked={autoRefresh} 
                          onChange={(checked) => setAutoRefresh(checked)} 
                          checkedChildren="ON"
                          unCheckedChildren="OFF"
                        />
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <strong style={{ color: '#ffffff' }}>Single Source of Truth (SSOT) Ticker Mappings</strong>
                        <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>
                          <ul>
                            <li>Thai Stocks: Ticker mapped dynamically to <code>[ASSET_NAME].BK</code>. Fallback rules applied (e.g. BJC &rarr; <code>BJC.BK</code>).</li>
                            <li>Global Stocks: Directly calls symbol ticker (e.g. MSTR &rarr; <code>MSTR</code>).</li>
                            <li>Crypto Assets: Key in standard symbols (e.g. <code>BTC</code>, <code>ETH</code>, <code>SOL</code>). App automatically appends <code>-USD</code> (e.g. <code>BTC-USD</code>) for Yahoo Finance verification.</li>
                            <li>USD to THB Rate: Fetched from Yahoo Forex ticker <code>USDTHB=X</code> (currently: {liveRates.USD.toFixed(4)}).</li>
                            <li>EUR to THB Rate: Fetched from Yahoo Forex ticker <code>EURTHB=X</code> (currently: {liveRates.EUR.toFixed(4)}).</li>
                          </ul>
                        </div>
                      </div>

                      <Alert 
                        message={<span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>Rate Limit Protection Active</span>}
                        description="FastAPI caching prevents rapid consecutive calls from getting rate limited. Clicking 'Sync Markets' forces a background refresh and invalidates the local price cache safely."
                        type="info"
                        showIcon
                        style={{ border: '1px solid rgba(0, 242, 254, 0.15)', background: 'rgba(0, 242, 254, 0.02)', color: 'var(--text-primary)' }}
                      />
                    </Space>
                  </Card>
                </Space>
              )}

            </Spin>
          </Content>
        </Layout>

        {/* MODAL: EDIT TRADE ENTRY */}
        <Modal
          title={`Edit Trade Entry for ${editingTrade?.action.toUpperCase()} ${editingTrade?.assetName}`}
          open={isEditStrategyModalOpen}
          onCancel={() => {
            setIsEditStrategyModalOpen(false);
            setEditingTrade(null);
            editStrategyForm.resetFields();
          }}
          footer={null}
          width={500}
        >
          <Form
            form={editStrategyForm}
            layout="vertical"
            onFinish={handleUpdateStrategy}
          >
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="quantity"
                  label="Quantity"
                  rules={[{ required: true, message: 'Please input quantity' }]}
                >
                  <InputNumber min={0.000001} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="priceUnit"
                  label="Price / Unit"
                  rules={[{ required: true, message: 'Please input price per unit' }]}
                >
                  <InputNumber min={0.000001} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="feeAmount"
                  label="Fee Amount"
                  rules={[{ required: true, message: 'Please input fee amount' }]}
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="why"
              label="Strategy / Decision Reason"
              rules={[{ required: true, message: 'Please select a strategy' }]}
            >
              <Select 
                placeholder="Select strategy" 
                onChange={(value) => {
                  setIsCustomStrategy(value === 'Other');
                }}
              >
                <Option value="CDC Action Zone">CDC Action Zone</Option>
                <Option value="Breakout">Breakout</Option>
                <Option value="EMA Cross">EMA Cross</Option>
                <Option value="Support/Resistance Bounce">Support/Resistance Bounce</Option>
                <Option value="Value Investment">Value Investment</Option>
                <Option value="Rebalance">Rebalance</Option>
                <Option value="Other">Other (Type custom strategy...)</Option>
              </Select>
            </Form.Item>

            {isCustomStrategy && (
              <Form.Item
                name="customWhy"
                label="Custom Strategy"
                rules={[{ required: true, message: 'Please input your custom strategy' }]}
              >
                <Input placeholder="Enter your custom strategy (e.g. RSI > 70)" />
              </Form.Item>
            )}

            <Form.Item
              name="remark"
              label="Private Notes / Diary"
            >
              <Input.TextArea rows={4} placeholder="Log trade notes, emotional state, or exit plan..." />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setIsEditStrategyModalOpen(false);
                  setEditingTrade(null);
                  editStrategyForm.resetFields();
                }}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={isSyncing} style={{ color: '#06080f', fontWeight: 'bold' }}>
                  Save Changes
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* MODAL 1: LOG NEW TRADE */}
        <Modal
          title="Log New Trade Entry"
          open={isTradeModalOpen}
          onCancel={() => setIsTradeModalOpen(false)}
          footer={null}
          width={600}
        >
          <Form
            form={tradeForm}
            layout="vertical"
            onFinish={handleAddTrade}
            initialValues={{
              portfolio: activePortfolio === 'All Portfolios' ? (portfolios[0] || 'Main Investment') : activePortfolio,
              action: 'Buy',
              currency: 'THB',
              assetType: 'Thai Stock',
              date: dayjs(),
              feeAmount: 0.0
            }}
          >
            {/* Row 1: Action, Asset Name, Asset Category */}
            <Row gutter={16}>
              <Col xs={24} sm={6}>
                <Form.Item
                  name="action"
                  label="Action"
                  rules={[{ required: true, message: 'Select Action' }]}
                  style={{ marginBottom: 0 }}
                >
                  <Input style={{ display: 'none' }} />
                </Form.Item>
                <div style={{ marginBottom: '24px' }}>
                  <div className="action-segmented">
                    <div 
                      className={`action-segmented-btn buy ${formAction === 'Buy' ? 'active' : ''}`}
                      onClick={() => {
                        setFormAction('Buy');
                        tradeForm.setFieldsValue({ action: 'Buy' });
                      }}
                    >
                      BUY
                    </div>
                    <div 
                      className={`action-segmented-btn sell ${formAction === 'Sell' ? 'active' : ''}`}
                      onClick={() => {
                        setFormAction('Sell');
                        tradeForm.setFieldsValue({ action: 'Sell' });
                      }}
                    >
                      SELL
                    </div>
                  </div>
                </div>
              </Col>
              
              <Col xs={24} sm={10}>
                <Form.Item
                  name="assetName"
                  label="Asset Name (Ticker)"
                  rules={[{ required: true, message: 'Please input asset name (e.g. BJC, MSTR)' }]}
                  extra={
                    <div style={{ marginTop: '4px' }}>
                      {tickerValidation.status === 'validating' && (
                        <div className="ticker-verify-card">
                          <SyncOutlined spin style={{ color: 'var(--primary-color)', fontSize: '18px' }} />
                          <div>
                            <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}>Validating Symbol...</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Verifying ticker on Yahoo Finance</div>
                          </div>
                        </div>
                      )}
                      {tickerValidation.status === 'success' && (
                        <div className="ticker-verify-card success">
                          <CheckCircleFilled style={{ color: 'var(--success-color)', fontSize: '18px' }} />
                          <div>
                            <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}>{tickerValidation.checkedTicker} verified</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{tickerValidation.message}</div>
                          </div>
                        </div>
                      )}
                      {tickerValidation.status === 'error' && (
                        <div className="ticker-verify-card error">
                          <ExclamationCircleOutlined style={{ color: 'var(--danger-color)', fontSize: '18px' }} />
                          <div>
                            <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}>Verification Failed</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{tickerValidation.message}</div>
                          </div>
                        </div>
                      )}
                      {tickerValidation.status === 'idle' && (
                        <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Please verify ticker before logging.</Text>
                      )}
                    </div>
                  }
                >
                  <Input 
                    placeholder="e.g. BJC, KCE, MSTR" 
                    style={{ textTransform: 'uppercase' }} 
                    onChange={(e) => {
                      setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
                    }}
                    addonAfter={
                      <span 
                        onClick={handleValidateTicker} 
                        style={{ cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 'bold', display: 'inline-block', padding: '0 4px' }}
                      >
                        {tickerValidation.status === 'validating' ? <SyncOutlined spin /> : 'Verify'}
                      </span>
                    }
                  />
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={8}>
                <Form.Item
                  name="assetType"
                  label="Asset Category"
                  rules={[{ required: true, message: 'Please select asset type' }]}
                >
                  <Select onChange={() => {
                    setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
                  }}>
                    <Option value="Thai Stock">Thai Stock</Option>
                    <Option value="Global Stock">Global Stock</Option>
                    <Option value="Crypto">Crypto</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Row 2: Transaction Date, Select Portfolio Target, Local Currency */}
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="date"
                  label="Transaction Date"
                  rules={[{ required: true, message: 'Please select a date' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={10}>
                <Form.Item
                  name="portfolio"
                  label="Select Portfolio Target"
                  rules={[{ required: true, message: 'Please select a portfolio' }]}
                >
                  <Select>
                    {portfolios.map(p => (
                      <Option key={p} value={p}>{p}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={6}>
                <Form.Item
                  name="currency"
                  label="Local Currency"
                  rules={[{ required: true, message: 'Select Currency' }]}
                >
                  <Select>
                    <Option value="THB">THB (฿)</Option>
                    <Option value="USD">USD ($)</Option>
                    <Option value="EUR">EUR (€)</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Row 3: Quantity, Price/Unit, Trading Fee Amount */}
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="quantity"
                  label="Quantity"
                  rules={[{ required: true, message: 'Input quantity' }]}
                >
                  <InputNumber min={0.000001} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={8}>
                <Form.Item
                  name="priceUnit"
                  label="Price / Unit (Local)"
                  rules={[{ required: true, message: 'Input price per unit' }]}
                >
                  <InputNumber min={0.000001} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              
              <Col xs={24} sm={8}>
                <Form.Item
                  name="feeAmount"
                  label="Trading Fee Amount"
                  rules={[{ required: true, message: 'Input fee amount' }]}
                >
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="e.g. 0.00"
                  />
                </Form.Item>
              </Col>
            </Row>

            {/* Row 4: Strategy */}
            <Form.Item
              name="why"
              label="Strategy / Decision Reason"
            >
              <Input placeholder="e.g. CDC Action Zone, RSI > 70, Breakthrough" />
            </Form.Item>

            {/* Row 5: Remarks */}
            <Form.Item
              name="remark"
              label="Remarks (Notes)"
            >
              <Input.TextArea rows={2} placeholder="Optional notes about this trade..." />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsTradeModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ backgroundColor: 'var(--success-color)', border: 'none', fontWeight: 'bold', color: '#06080f' }}>
                  Log Trade
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* MODAL 2: CREATE PORTFOLIO */}
        <Modal
          title="Create Custom Portfolio"
          open={isPortfolioModalOpen}
          onCancel={() => setIsPortfolioModalOpen(false)}
          footer={null}
        >
          <Form
            form={portfolioForm}
            layout="vertical"
            onFinish={handleAddPortfolio}
          >
            <Form.Item
              name="name"
              label="Portfolio Name"
              rules={[
                { required: true, message: 'Please input portfolio name' },
                { 
                  validator: (_, value) => {
                    if (value && portfolios.includes(value.trim())) {
                      return Promise.reject(new Error('Portfolio name already exists!'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="e.g. Retirement Savings, Swing Trade" />
            </Form.Item>

            <Form.Item
              name="initialCapital"
              label="Initial Capital"
              initialValue={2000000}
              rules={[{ required: true, message: 'Please input initial capital' }]}
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\$\s?|(,*)/g, '')}
              />
            </Form.Item>

            <Form.Item
              name="targetStocks"
              label="Amount of Stock to Hold (Target)"
              initialValue={50}
              rules={[{ required: true, message: 'Please input amount of stocks' }]}
            >
              <InputNumber min={1} max={500} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsPortfolioModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ color: '#06080f', fontWeight: 'bold' }}>
                  Create Portfolio
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* MODAL 3: CONFIGURE PORTFOLIO */}
        <Modal
          title="Configure Portfolio"
          open={isRenameModalOpen}
          onCancel={() => setIsRenameModalOpen(false)}
          footer={null}
        >
          <Form
            form={renameForm}
            layout="vertical"
            onFinish={handleRenamePortfolio}
          >
            <Form.Item
              name="name"
              label="Portfolio Name"
              rules={[
                { required: true, message: 'Please input a portfolio name' },
                { 
                  validator: (_, value) => {
                    if (value && portfolios.includes(value.trim()) && value.trim() !== renameTarget) {
                      return Promise.reject(new Error('Portfolio name already exists!'));
                    }
                    return Promise.resolve();
                  }
                }
              ]}
            >
              <Input placeholder="e.g. Retirement Fund, Swing Trades" />
            </Form.Item>

            <Form.Item
              name="initialCapital"
              label="Initial Capital"
              rules={[{ required: true, message: 'Please input initial capital' }]}
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\$\s?|(,*)/g, '')}
              />
            </Form.Item>

            <Form.Item
              name="targetStocks"
              label="Amount of Stock to Hold (Target)"
              rules={[{ required: true, message: 'Please input amount of stocks' }]}
            >
              <InputNumber min={1} max={500} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsRenameModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ color: '#06080f', fontWeight: 'bold' }}>
                  Save Configuration
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* MODAL 4: TRANSFER TRADE */}
        <Modal
          title={`Transfer Trade (${editingTrade?.action.toUpperCase()} ${editingTrade?.quantity} ${editingTrade?.assetName}) to Portfolio`}
          open={isTransferModalOpen}
          onCancel={() => {
            setIsTransferModalOpen(false);
            setEditingTrade(null);
            transferForm.resetFields();
          }}
          footer={null}
        >
          <div style={{ marginBottom: '18px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <Text style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Moving transaction of <strong>{editingTrade?.assetName}</strong>.
            </Text>
            <Text style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Current Portfolio: <strong style={{ color: 'var(--primary-color)' }}>{editingTrade?.portfolio}</strong>
            </Text>
          </div>

          <Form
            form={transferForm}
            layout="vertical"
            onFinish={handleTransferTrade}
          >
            <Form.Item
              name="targetPortfolio"
              label="Select Destination Portfolio"
              rules={[{ required: true, message: 'Please select a destination portfolio' }]}
            >
              <Select placeholder="Choose target portfolio...">
                {portfolios.filter(p => p !== editingTrade?.portfolio).map(p => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setIsTransferModalOpen(false);
                  setEditingTrade(null);
                  transferForm.resetFields();
                }}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ color: '#06080f', fontWeight: 'bold' }}>
                  Confirm Transfer
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
        {isMobile && (
          <div className="mobile-tabbar">
            <button 
              className={`mobile-tabbar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <DashboardOutlined className="mobile-tabbar-icon" />
              <span>Dashboard</span>
            </button>
            <button 
              className={`mobile-tabbar-item ${activeTab === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveTab('journal')}
            >
              <BookOutlined className="mobile-tabbar-icon" />
              <span>Journal</span>
            </button>
            <button 
              className={`mobile-tabbar-item ${activeTab === 'positions' ? 'active' : ''}`}
              onClick={() => setActiveTab('positions')}
            >
              <TableOutlined className="mobile-tabbar-icon" />
              <span>Positions</span>
            </button>
            <button 
              className={`mobile-tabbar-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <SettingOutlined className="mobile-tabbar-icon" />
              <span>Settings</span>
            </button>
          </div>
        )}
      </Layout>
    </ConfigProvider>
  );
}

export default App;
