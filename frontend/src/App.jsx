import React, { useState, useEffect, useMemo } from 'react';
import { 
  Layout, Menu, Button, Card, Statistic, Table, Modal, 
  Form, Input, InputNumber, Select, DatePicker, Row, Col, Space, 
  Spin, Tag, Typography, Popconfirm, message, Alert, Switch, ConfigProvider, theme
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
  EditOutlined
} from '@ant-design/icons';
import { 
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine
} from 'recharts';
import axios from 'axios';
import dayjs from 'dayjs';

const { Header, Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE = import.meta.env.VITE_API_URL || '';

// Detect if we should run in serverless Cloud Mode (e.g. on GitHub Pages)
const isCloudMode = !window.location.hostname.match(/^(localhost|127.0.0.1|100\.\d+\.\d+\.\d+)$/) && window.location.hostname !== "";

const getApiUrl = (endpoint) => {
  const scriptUrl = localStorage.getItem('google_apps_script_url');
  const useCloud = isCloudMode || !window.location.hostname;
  
  if (useCloud) {
    return { type: 'cloud', url: scriptUrl || '' }; // Always cloud on GitHub Pages; url may be empty
  }
  return { type: 'local', url: `${API_BASE}${endpoint}` }; // Routes to local FastAPI Backend
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
          
          const tempPortfolios = new Set();
          
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
              }
            }
          }
          
          if (tempPortfolios.size > 0) {
            customPortfoliosList = Array.from(tempPortfolios);
          }
          
          // Cache to localStorage for fast offline access
          localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));
          localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(customPortfoliosList));
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
      if (assetType.toLowerCase() === "crypto") {
        portfolio = "Crypto";
      } else if (assetType.toLowerCase() === "global stock" || assetType.toLowerCase() === "us stock") {
        portfolio = "BTC Stock";
      }
      
      // Apply custom overrides
      if (customMappings[assetName]) {
        portfolio = customMappings[assetName];
      }
      
      const qty = quantityIdx !== -1 ? parseFloat(row[quantityIdx]) : 0;
      const price = priceUnitIdx !== -1 ? parseFloat(row[priceUnitIdx]) : 0;
      
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
        remark: remarkIdx !== -1 && row[remarkIdx] ? row[remarkIdx].toString().trim() : ""
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
      const api = getApiUrl('/api/data');
      if (api.type === 'cloud') {
        // In Cloud Mode: always use the direct CSV URL as the PRIMARY source for trade data.
        // The gviz/tq CSV endpoint has full CORS support and never redirects,
        // so it works on ALL browsers including Safari/Brave on mobile.
        // Apps Script is only used as a fallback to also fetch live prices.
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
      } else {
        const response = await axios.get(api.url);
        setTrades(response.data.trades);
        setPortfolios(response.data.portfolios);
        setLivePrices(response.data.livePrices || {});
        setLiveRates(response.data.liveRates || { THB: 1.0, USD: 32.69, EUR: 38.04 });
        if (response.data.syncTime) {
          setSyncTime(dayjs(response.data.syncTime).format('YYYY-MM-DD HH:mm:ss'));
        }
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
      const api = getApiUrl('/api/sync');
      if (api.type === 'cloud') {
        const data = await callGoogleAppsScript(`${api.url}?action=getData`);
        setLivePrices(data.livePrices || {});
        setLiveRates(data.liveRates || { THB: 1.0, USD: 32.69, EUR: 38.04 });
        if (data.syncTime) {
          setSyncTime(dayjs(data.syncTime).format('YYYY-MM-DD HH:mm:ss'));
        }
        if (!silent) {
          message.success('Live market prices synced from Yahoo Finance.');
        }
      } else {
        const response = await axios.post(api.url);
        setLivePrices(response.data.livePrices || {});
        setLiveRates(response.data.liveRates || { THB: 1.0, USD: 32.69, EUR: 38.04 });
        if (response.data.syncTime) {
          setSyncTime(dayjs(response.data.syncTime).format('YYYY-MM-DD HH:mm:ss'));
        }
        if (!silent) {
          message.success('Live market prices & exchange rates synced from Yahoo Finance.');
        }
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
    if (isCloudMode) {
      setGoogleSheetSyncCount(trades.length);
      return;
    }
    try {
      const response = await axios.get(`${API_BASE}/api/google-sheet-settings`);
      setGoogleSheetId(response.data.google_sheet_id || '');
      if (response.data.google_apps_script_url) {
        setGoogleAppsScriptUrl(response.data.google_apps_script_url);
        localStorage.setItem('google_apps_script_url', response.data.google_apps_script_url);
      } else {
        const localUrl = localStorage.getItem('google_apps_script_url') || '';
        if (localUrl) {
          setGoogleAppsScriptUrl(localUrl);
          axios.post(`${API_BASE}/api/google-sheet-settings`, {
            google_sheet_id: response.data.google_sheet_id || '',
            google_apps_script_url: localUrl,
            app_passcode: response.data.app_passcode || ''
          }).catch(err => console.error("Auto-syncing script URL to backend failed:", err));
        }
      }
      if (response.data.app_passcode) {
        setAppPasscode(response.data.app_passcode);
        localStorage.setItem('alphatrader_passcode', response.data.app_passcode);
      } else {
        setAppPasscode('');
        localStorage.removeItem('alphatrader_passcode');
      }
      setGoogleSheetSyncCount(response.data.synced_count || 0);
    } catch (error) {
      console.error('Error fetching Google Sheet settings:', error);
    }
  };

  const handleSaveGoogleSheetSettings = async () => {
    setIsSyncingSheet(true);
    
    // In Cloud Mode (GitHub Pages), save directly to browser localStorage and refresh trades list
    if (isCloudMode) {
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
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE}/api/google-sheet-settings`, {
        google_sheet_id: googleSheetId,
        google_apps_script_url: googleAppsScriptUrl,
        app_passcode: appPasscode
      });
      if (response.data.success) {
        message.success('Google Sheet sync settings saved successfully.');
        if (response.data.sync_success) {
          message.success('Initial Google Sheets sync completed!');
          fetchData();
        }
        fetchGoogleSheetSettings();
      }
    } catch (error) {
      console.error('Error saving Google Sheet settings:', error);
      message.error('Failed to save settings.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    setIsSyncingSheet(true);
    if (isCloudMode) {
      try {
        await fetchData();
        message.success('Refreshed data from cloud Google Sheets!');
      } catch (err) {
        console.error('Error refreshing cloud data:', err);
        message.error('Failed to refresh data.');
      } finally {
        setIsSyncingSheet(false);
      }
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE}/api/google-sheet-sync`);
      if (response.data.success) {
        message.success('Google Sheet trades synced successfully!');
        fetchData();
        fetchGoogleSheetSettings();
      }
    } catch (error) {
      console.error('Error syncing Google Sheet:', error);
      message.error(error.response?.data?.detail || 'Failed to sync Google Sheet.');
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

  // Advanced Trading Analytics
  const tradingAnalytics = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const buysCount = filteredTrades.filter(t => t.action.toLowerCase() === 'buy').length;
    const sellsCount = filteredTrades.filter(t => t.action.toLowerCase() === 'sell').length;

    const sortedTrades = [...filteredTrades].sort((a, b) => dayjs(a.date).unix() - dayjs(b.date).unix());
    const assetState = {};
    let winCount = 0;
    let lossCount = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let maxWinVal = 0;
    let maxLossVal = 0;

    sortedTrades.forEach(trade => {
      const name = trade.assetName;
      const qty = Number(trade.quantity) || 0;
      const price = Number(trade.priceUnit) || 0;
      const action = trade.action.toLowerCase();

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
        const realizedPnL = (price - wac) * qty;
        const realizedPnLConverted = (realizedPnL * rateToTHB) / displayRateToTHB;

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

        state.qty = Math.max(0, state.qty - qty);
        state.totalCost = Math.max(0, state.totalCost - (qty * wac));
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
  }, [filteredTrades, liveRates, displayCurrency]);

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
    const assetsData = {};

    // First pass: Group trades by assetName to sum buys and sells
    filteredTrades.forEach(trade => {
      const name = trade.assetName;
      if (!name) return;

      if (!assetsData[name]) {
        assetsData[name] = {
          assetName: name,
          assetType: trade.assetType || 'Thai Stock',
          currency: trade.currency || 'THB',
          totalBuyQty: 0,
          totalBuyCost: 0,
          totalSellQty: 0,
          totalSellRevenue: 0,
          trades: []
        };
      }

      assetsData[name].trades.push(trade);

      const qty = Number(trade.quantity) || 0;
      const price = Number(trade.priceUnit) || 0;

      if (trade.action.toLowerCase() === 'buy') {
        assetsData[name].totalBuyQty += qty;
        assetsData[name].totalBuyCost += qty * price;
      } else if (trade.action.toLowerCase() === 'sell') {
        assetsData[name].totalSellQty += qty;
        assetsData[name].totalSellRevenue += qty * price;
      }
    });

    // Second pass: Calculate WAC, holdings, live valuations, and P&Ls converted to displayCurrency
    return Object.values(assetsData).map(asset => {
      const qtyHeld = asset.totalBuyQty - asset.totalSellQty;
      // WAC is average cost of ALL purchases
      const wac = asset.totalBuyQty > 0 ? (asset.totalBuyCost / asset.totalBuyQty) : 0;
      const totalCost = qtyHeld * wac;

      // Single source of truth live price from Yahoo Finance
      const livePrice = livePrices[asset.assetName] !== undefined && livePrices[asset.assetName] !== null
        ? livePrices[asset.assetName]
        : wac; // Fallback to WAC

      const liveValue = qtyHeld * livePrice;
      const unrealizedPnL = liveValue - totalCost;
      
      // Realized P&L is total sell revenue minus average cost of quantity sold
      const realizedPnL = asset.totalSellRevenue - (asset.totalSellQty * wac);

      // Exchange rate conversion logic:
      const rateToTHB = liveRates[asset.currency] || 1.0;
      const displayRateToTHB = liveRates[displayCurrency] || 1.0;

      const totalCostConverted = (totalCost * rateToTHB) / displayRateToTHB;
      const liveValueConverted = (liveValue * rateToTHB) / displayRateToTHB;
      const unrealizedPnLConverted = (unrealizedPnL * rateToTHB) / displayRateToTHB;
      const realizedPnLConverted = (realizedPnL * rateToTHB) / displayRateToTHB;
      const totalPnLConverted = unrealizedPnLConverted + realizedPnLConverted;
      const wacConverted = (wac * rateToTHB) / displayRateToTHB;
      const livePriceConverted = (livePrice * rateToTHB) / displayRateToTHB;

      return {
        ...asset,
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
    
    const tickerUpper = symbol.trim().toUpperCase();
    setTickerValidation({ 
      status: 'validating', 
      message: 'Checking ticker on Yahoo Finance...', 
      checkedTicker: tickerUpper 
    });
    
    try {
      const api = getApiUrl('/api/trades');
      let response;
      if (api.type === 'cloud') {
        if (!api.url) {
          throw new Error('Apps Script URL is missing. Set it in settings to validate tickers.');
        }
        const result = await callGoogleAppsScript(api.url, {
          action: 'validateTicker',
          symbol: symbol,
          assetType: assetType
        });
        response = { data: result };
      } else {
        response = await axios.get(`${API_BASE}/api/validate-ticker`, {
          params: { symbol, asset_type: assetType }
        });
      }

      if (response.data.valid) {
        setTickerValidation({
          status: 'success',
          message: response.data.message,
          checkedTicker: tickerUpper
        });
        message.success(`Ticker verified on Yahoo Finance!`);
      } else {
        setTickerValidation({
          status: 'error',
          message: response.data.message,
          checkedTicker: tickerUpper
        });
        message.error(`Verification Failed: ${response.data.message}`);
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
    const symbol = values.assetName.trim().toUpperCase();
    const api = getApiUrl('/api/trades');
    
    // Validate ticker before adding trade
    if (tickerValidation.status !== 'success' || tickerValidation.checkedTicker !== symbol) {
      setIsSyncing(true);
      const hideMsg = message.loading('Validating ticker on Yahoo Finance...', 0);
      try {
        let response;
        if (api.type === 'cloud') {
          if (!api.url) {
            throw new Error('Apps Script URL is missing. Cannot validate ticker.');
          }
          const result = await callGoogleAppsScript(api.url, {
            action: 'validateTicker',
            symbol: values.assetName,
            assetType: values.assetType
          });
          response = { data: result };
        } else {
          response = await axios.get(`${API_BASE}/api/validate-ticker`, {
            params: { symbol: values.assetName, asset_type: values.assetType }
          });
        }
        hideMsg();
        setIsSyncing(false);
        
        if (!response.data.valid) {
          setTickerValidation({
            status: 'error',
            message: response.data.message,
            checkedTicker: symbol
          });
          message.error(`Verification Failed: ${response.data.message}`);
          return; // Stop form submission
        } else {
          setTickerValidation({
            status: 'success',
            message: response.data.message,
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
        id: (trades.length + 1).toString(),
        date: formattedDate,
        portfolio: values.portfolio,
        assetName: values.assetName.trim().toUpperCase(),
        assetType: values.assetType,
        currency: values.currency,
        action: values.action,
        quantity: values.quantity,
        priceUnit: values.priceUnit,
        why: values.why || '',
        remark: values.remark || ''
      };

      if (api.type === 'cloud') {
        const payload = {
          action: 'addTrade',
          trade: newTrade
        };
        await callGoogleAppsScript(api.url, payload);
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
          if (api.url) {
            callGoogleAppsScript(api.url, {
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
      } else {
        const response = await axios.post(api.url, newTrade);
        message.success(`Trade for ${newTrade.assetName} logged successfully.`);
        setIsTradeModalOpen(false);
        tradeForm.resetFields();
        setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
        setTrades(prev => [...prev, response.data]);
        syncMarketData(true);
      }
    } catch (error) {
      console.error('Error adding trade:', error);
      message.error(error.response?.data?.detail || 'Failed to log trade in database.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete trade
  const handleDeleteTrade = async (tradeId) => {
    setIsSyncing(true);
    try {
      const api = getApiUrl(`/api/trades/${tradeId}`);
      if (api.type === 'cloud') {
        const payload = {
          action: 'deleteTrade',
          tradeId: tradeId
        };
        await callGoogleAppsScript(api.url, payload);
        setTrades(prev => prev.filter(t => t.id !== tradeId));
        message.success('Trade deleted from logs.');
      } else {
        await axios.delete(api.url);
        setTrades(prev => prev.filter(t => t.id !== tradeId));
        message.success('Trade deleted from logs.');
      }
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
      const api = getApiUrl(`/api/trades/${editingTrade.id}/strategy`);
      
      const updatedData = {
        why: values.why,
        remark: values.remark || ''
      };
      
      if (api.type === 'cloud') {
        if (!api.url) {
          throw new Error('Apps Script URL is missing in Cloud Mode.');
        }
        await callGoogleAppsScript(api.url, {
          action: "updateTradeStrategy",
          tradeId: editingTrade.id,
          why: updatedData.why,
          remark: updatedData.remark
        });
        message.success(`Trade strategy updated successfully on Google Sheets.`);
        setTrades(prev => prev.map(t => t.id === editingTrade.id ? { ...t, ...updatedData } : t));
        setIsEditStrategyModalOpen(false);
        setEditingTrade(null);
        editStrategyForm.resetFields();
        fetchData();
      } else {
        const response = await axios.put(api.url, updatedData);
        message.success(`Trade strategy updated successfully.`);
        setIsEditStrategyModalOpen(false);
        setEditingTrade(null);
        editStrategyForm.resetFields();
        setTrades(prev => prev.map(t => t.id === response.data.id ? response.data : t));
        syncMarketData(true);
      }
    } catch (error) {
      console.error('Error updating trade strategy:', error);
      message.error(error.response?.data?.detail || 'Failed to update trade strategy.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Create new portfolio
  const handleAddPortfolio = async (values) => {
    try {
      const api = getApiUrl('/api/portfolios');
      if (api.type === 'cloud') {
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

        // Sync with Google Sheet Apps Script in the background
        if (api.url) {
          try {
            await callGoogleAppsScript(api.url, {
              action: "addPortfolio",
              name: name
            });
          } catch (cloudErr) {
            console.error("Error syncing addPortfolio to cloud:", cloudErr);
          }
        }

        message.success(`Portfolio "${name}" created.`);
        setIsPortfolioModalOpen(false);
        portfolioForm.resetFields();
      } else {
        const response = await axios.post(api.url, { name: values.name });
        setPortfolios(response.data.portfolios);
        message.success(`Portfolio "${values.name}" created.`);
        setIsPortfolioModalOpen(false);
        portfolioForm.resetFields();
      }
    } catch (error) {
      console.error('Error creating portfolio:', error);
      message.error(error.response?.data?.detail || 'Failed to create portfolio.');
    }
  };

  // Delete portfolio
  const handleDeletePortfolio = async (portfolioName) => {
    try {
      const api = getApiUrl(`/api/portfolios/${portfolioName}`);
      if (api.type === 'cloud') {
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
        if (api.url) {
          try {
            await callGoogleAppsScript(api.url, {
              action: "deletePortfolio",
              portfolioName: portfolioName
            });
          } catch (cloudErr) {
            console.error("Error syncing deletePortfolio to cloud:", cloudErr);
          }
        }

        message.success(`Portfolio "${portfolioName}" deleted.`);
        await fetchData();
      } else {
        const response = await axios.delete(`${API_BASE}/api/portfolios/${portfolioName}`);
        setPortfolios(response.data.portfolios);
        if (activePortfolio === portfolioName) {
          setActivePortfolio('All Portfolios');
        }
        message.success(`Portfolio "${portfolioName}" deleted.`);
      }
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      message.error(error.response?.data?.detail || 'Failed to delete portfolio.');
    }
  };

  // Rename portfolio
  const handleRenamePortfolio = async (values) => {
    try {
      const api = getApiUrl('/api/portfolios/rename');
      const oldName = renameTarget;
      const newName = values.name.trim();
      
      if (oldName === newName) {
        message.error("New name must be different from the old name.");
        return;
      }

      if (api.type === 'cloud') {
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

        // Sync with Google Sheet Apps Script in the background
        if (api.url) {
          try {
            await callGoogleAppsScript(api.url, {
              action: "renamePortfolio",
              oldName: oldName,
              newName: newName
            });
          } catch (cloudErr) {
            console.error("Error syncing renamePortfolio to cloud:", cloudErr);
          }
        }

        message.success(`Portfolio renamed successfully to "${newName}".`);
        setIsRenameModalOpen(false);
        renameForm.resetFields();
        await fetchData();
      } else {
        const response = await axios.put(`${API_BASE}/api/portfolios/rename`, {
          oldName: oldName,
          newName: newName
        });
        setPortfolios(response.data.portfolios);
        await fetchData();
        if (activePortfolio === oldName) {
          setActivePortfolio(newName);
        }
        message.success(`Portfolio renamed successfully to "${newName}".`);
        setIsRenameModalOpen(false);
        renameForm.resetFields();
      }
    } catch (error) {
      console.error('Error renaming portfolio:', error);
      message.error(error.response?.data?.detail || 'Failed to rename portfolio.');
    }
  };

  // Transfer whole position trades to another portfolio
  const handleTransferPosition = async (values) => {
    try {
      const api = getApiUrl('/api/portfolios/transfer-position');
      const targetPortfolio = values.targetPortfolio;
      
      if (api.type === 'cloud') {
        // Save portfolio override mapping for this asset in localStorage
        const customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
        customMappings[transferTargetAsset] = targetPortfolio;
        localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));

        // Sync with Google Sheet Apps Script in the background
        if (api.url) {
          try {
            await callGoogleAppsScript(api.url, {
              action: "transferPosition",
              assetName: transferTargetAsset,
              targetPortfolio: targetPortfolio
            });
          } catch (cloudErr) {
            console.error("Error syncing transferPosition to cloud:", cloudErr);
          }
        }

        message.success(`Successfully transferred ${transferTargetAsset} position to '${targetPortfolio}'.`);
        setIsTransferModalOpen(false);
        await fetchData();
      } else {
        const response = await axios.put(`${API_BASE}/api/portfolios/transfer-position`, {
          assetName: transferTargetAsset,
          sourcePortfolio: transferSourcePortfolio,
          targetPortfolio: targetPortfolio
        });
        message.success(response.data.message);
        setIsTransferModalOpen(false);
        await fetchData();
      }
    } catch (error) {
      console.error('Error transferring position:', error);
      message.error(error.response?.data?.detail || 'Failed to transfer position.');
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
      title: 'Cost Amount',
      key: 'amount',
      align: 'right',
      width: 130,
      className: 'financial-num',
      render: (_, record) => formatCurrency(record.quantity * record.priceUnit, record.currency)
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
      title: `P&L (${displayCurrency})`,
      key: 'pnl',
      align: 'right',
      width: 130,
      className: 'financial-num',
      render: (_, record) => {
        const qty = record.quantity;
        const buyPrice = record.priceUnit;
        const livePrice = livePrices[record.assetName] !== undefined ? livePrices[record.assetName] : buyPrice;
        
        const rateToTHB = liveRates[record.currency] || 1.0;
        const displayRateToTHB = liveRates[displayCurrency] || 1.0;
        
        let pnlConverted = 0;
        if (record.action.toLowerCase() === 'buy') {
          pnlConverted = ((livePrice - buyPrice) * qty * rateToTHB) / displayRateToTHB;
        } else {
          pnlConverted = ((buyPrice - livePrice) * qty * rateToTHB) / displayRateToTHB;
        }
        
        const isProfit = pnlConverted >= 0;
        return (
          <span className={isProfit ? 'trend-up' : 'trend-down'}>
            {isProfit ? '+' : ''}{isCensored ? '****' : pnlConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 100,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined style={{ color: 'var(--primary-color)' }} />} 
            size="small" 
            onClick={() => {
              setEditingTrade(record);
              editStrategyForm.setFieldsValue({
                why: record.why,
                remark: record.remark
              });
              setIsEditStrategyModalOpen(true);
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
    },
    {
      title: 'Action',
      key: 'position_transfer_action',
      align: 'center',
      width: 120,
      render: (_, record) => {
        if (record.qtyHeld <= 0) return null;
        if (activePortfolio === 'All Portfolios') {
          return (
            <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic', color: 'var(--text-muted)' }}>
              Select portfolio
            </Text>
          );
        }
        return (
          <Button
            type="text"
            icon={<SwapOutlined />}
            style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}
            onClick={() => {
              setTransferTargetAsset(record.assetName);
              setTransferSourcePortfolio(activePortfolio);
              transferForm.resetFields();
              setIsTransferModalOpen(true);
            }}
          >
            Transfer
          </Button>
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
                  ALPHA<span style={{ color: 'var(--primary-color)' }}>TRADER</span>
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
                  {/* Compact KPIs in a 2x2 Grid */}
                  <Row gutter={[12, 12]}>
                    <Col span={12}>
                      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Invested
                          </span>
                          <WalletOutlined style={{ color: 'var(--primary-color)', fontSize: '13px' }} />
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '6px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(kpis.totalInvestedConverted)}
                        </div>
                      </Card>
                    </Col>
                    
                    <Col span={12}>
                      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Value
                          </span>
                          <GlobalOutlined style={{ color: 'var(--primary-color)', fontSize: '13px' }} />
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', marginTop: '6px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(kpis.currentMarketValueConverted)}
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card 
                        bordered={false} 
                        className={`glass-panel ${kpis.totalRealizedPnLConverted >= 0 ? 'glow-card-green' : 'glow-card-red'}`}
                        styles={{ body: { padding: '12px' } }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Realized
                          </span>
                          {kpis.totalRealizedPnLConverted >= 0 
                            ? <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '13px' }} /> 
                            : <FallOutlined style={{ color: 'var(--danger-color)', fontSize: '13px' }} />
                          }
                        </div>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: 700, 
                          color: kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', 
                          marginTop: '6px', 
                          fontFamily: 'var(--font-family-mono)' 
                        }}>
                          {kpis.totalRealizedPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalRealizedPnLConverted)}
                        </div>
                      </Card>
                    </Col>

                    <Col span={12}>
                      <Card 
                        bordered={false} 
                        className={`glass-panel ${kpis.totalPnLConverted >= 0 ? 'glow-card-green' : 'glow-card-red'}`}
                        styles={{ body: { padding: '12px' } }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Return
                          </span>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
                          }}>
                            {kpis.totalPnLConverted >= 0 ? '▲' : '▼'} {kpis.totalPnLPct.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: 700, 
                          color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', 
                          marginTop: '6px', 
                          fontFamily: 'var(--font-family-mono)' 
                        }}>
                          {kpis.totalPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalPnLConverted)}
                        </div>
                      </Card>
                    </Col>
                  </Row>

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
                    <Card title="📊 Trading Analytics" bordered={false}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Total Trades</span>
                          <strong style={{ color: '#ffffff', fontSize: '13px' }} className="financial-num">{tradingAnalytics.totalTrades} ({tradingAnalytics.buysCount} B / {tradingAnalytics.sellsCount} S)</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Win Rate</span>
                          <strong style={{ color: tradingAnalytics.winRate >= 50 ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '13px' }} className="financial-num">{tradingAnalytics.winRate.toFixed(1)}% ({tradingAnalytics.winCount}W / {tradingAnalytics.lossCount}L)</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Profit Factor</span>
                          <strong style={{ color: tradingAnalytics.winRate >= 50 ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '13px' }} className="financial-num">
                            {tradingAnalytics.profitFactor === Infinity ? '∞' : tradingAnalytics.profitFactor.toFixed(2)}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Risk-Reward</span>
                          <strong style={{ color: '#ffffff', fontSize: '13px' }} className="financial-num">1 : {tradingAnalytics.riskRewardRatio.toFixed(2)}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Avg Win / Loss</span>
                          <span className="financial-num" style={{ fontSize: '12px' }}>
                            <strong style={{ color: 'var(--success-color)' }}>{formatCurrency(tradingAnalytics.avgWin)}</strong>
                            <strong style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</strong>
                            <strong style={{ color: 'var(--danger-color)' }}>{formatCurrency(tradingAnalytics.avgLoss)}</strong>
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Max Win / Loss</span>
                          <span className="financial-num" style={{ fontSize: '12px' }}>
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
                  
                  {/* KPI Cards Row */}
                  <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12} md={6}>
                      <Card bordered={false} className="glass-panel glow-card-cyan">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Total Invested
                          </span>
                          <WalletOutlined style={{ color: 'var(--primary-color)', fontSize: '16px' }} />
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', marginTop: '10px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(kpis.totalInvestedConverted)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
                          Active capital in current assets
                        </div>
                      </Card>
                    </Col>
                    
                    <Col xs={24} sm={12} md={6}>
                      <Card bordered={false} className="glass-panel glow-card-cyan">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Current Value
                          </span>
                          <GlobalOutlined style={{ color: 'var(--primary-color)', fontSize: '16px' }} />
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', marginTop: '10px', fontFamily: 'var(--font-family-mono)' }}>
                          {formatCurrency(kpis.currentMarketValueConverted)}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
                          Valuation based on live feeds
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                      <Card 
                        bordered={false} 
                        className={`glass-panel ${kpis.totalRealizedPnLConverted >= 0 ? 'glow-card-green' : 'glow-card-red'}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Realized P&L
                          </span>
                          {kpis.totalRealizedPnLConverted >= 0 
                            ? <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '16px' }} /> 
                            : <FallOutlined style={{ color: 'var(--danger-color)', fontSize: '16px' }} />
                          }
                        </div>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 700, 
                          color: kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', 
                          marginTop: '10px', 
                          fontFamily: 'var(--font-family-mono)' 
                        }}>
                          {kpis.totalRealizedPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalRealizedPnLConverted)}
                        </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: kpis.totalRealizedPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', 
                          marginTop: '4px', 
                          fontWeight: 600,
                          opacity: 0.85
                        }}>
                          {kpis.totalRealizedPnLConverted >= 0 ? '● Locked-in profits' : '● Locked-in losses'}
                        </div>
                      </Card>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                      <Card 
                        bordered={false} 
                        className={`glass-panel ${kpis.totalPnLConverted >= 0 ? 'glow-card-green' : 'glow-card-red'}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Total Return
                          </span>
                          {kpis.totalPnLConverted >= 0 
                            ? <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '16px' }} /> 
                            : <FallOutlined style={{ color: 'var(--danger-color)', fontSize: '16px' }} />
                          }
                        </div>
                        <div style={{ 
                          fontSize: '24px', 
                          fontWeight: 700, 
                          color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)', 
                          marginTop: '10px', 
                          fontFamily: 'var(--font-family-mono)' 
                        }}>
                          {kpis.totalPnLConverted >= 0 ? '+' : ''}{formatCurrency(kpis.totalPnLConverted)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            background: kpis.totalPnLConverted >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: kpis.totalPnLConverted >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
                          }}>
                            {kpis.totalPnLConverted >= 0 ? '▲' : '▼'} {kpis.totalPnLPct.toFixed(2)}%
                          </span>
                          <span style={{ marginLeft: '6px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 500 }}>
                            All-time yield
                          </span>
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

                  {/* Trading Analytics Card Row */}
                  <Row gutter={[24, 24]}>
                    <Col span={24}>
                      <Card title="📊 Trading Analytics & Statistics" bordered={false}>
                        <Row gutter={[16, 16]}>
                          <Col xs={12} sm={8} md={4}>
                            <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 6px' }}>
                              <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Total Trades</Text>
                              <Title level={4} style={{ color: '#ffffff', margin: 0 }} className="financial-num">{tradingAnalytics.totalTrades}</Title>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {tradingAnalytics.buysCount} Buy | {tradingAnalytics.sellsCount} Sell
                              </div>
                            </div>
                          </Col>
                          <Col xs={12} sm={8} md={4}>
                            <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 6px' }}>
                              <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Win Rate</Text>
                              <Title level={4} style={{ color: tradingAnalytics.winRate >= 50 ? 'var(--success-color)' : 'var(--danger-color)', margin: 0 }} className="financial-num">
                                {tradingAnalytics.winRate.toFixed(1)}%
                              </Title>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                {tradingAnalytics.winCount} W - {tradingAnalytics.lossCount} L
                              </div>
                            </div>
                          </Col>
                          <Col xs={12} sm={8} md={4}>
                            <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 6px' }}>
                              <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Profit Factor</Text>
                              <Title level={4} style={{ color: tradingAnalytics.profitFactor >= 1.5 ? 'var(--success-color)' : (tradingAnalytics.profitFactor >= 1 ? '#ffffff' : 'var(--danger-color)'), margin: 0 }} className="financial-num">
                                {tradingAnalytics.profitFactor === Infinity ? '∞' : tradingAnalytics.profitFactor.toFixed(2)}
                              </Title>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Gross Profit / Loss
                              </div>
                            </div>
                          </Col>
                          <Col xs={12} sm={8} md={4}>
                            <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 6px' }}>
                              <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Risk-Reward Ratio</Text>
                              <Title level={4} style={{ color: '#ffffff', margin: 0 }} className="financial-num">
                                1 : {tradingAnalytics.riskRewardRatio.toFixed(2)}
                              </Title>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Avg Loss vs Avg Win
                              </div>
                            </div>
                          </Col>
                          <Col xs={12} sm={8} md={4}>
                            <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 6px' }}>
                              <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Avg Win / Avg Loss</Text>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }} className="financial-num">
                                <span style={{ color: 'var(--success-color)', fontSize: '13px', fontWeight: 'bold' }}>{formatCurrency(tradingAnalytics.avgWin)}</span>
                                <span style={{ color: 'var(--danger-color)', fontSize: '13px', fontWeight: 'bold' }}>{formatCurrency(tradingAnalytics.avgLoss)}</span>
                              </div>
                            </div>
                          </Col>
                          <Col xs={12} sm={8} md={4}>
                            <div style={{ textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 6px' }}>
                              <Text type="secondary" style={{ fontSize: '10px', textTransform: 'uppercase', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Max Win / Max Loss</Text>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }} className="financial-num">
                                <span style={{ color: 'var(--success-color)', fontSize: '13px', fontWeight: 'bold' }}>+{formatCurrency(tradingAnalytics.maxWinVal)}</span>
                                <span style={{ color: 'var(--danger-color)', fontSize: '13px', fontWeight: 'bold' }}>-{formatCurrency(tradingAnalytics.maxLossVal)}</span>
                              </div>
                            </div>
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
                          const livePrice = livePrices[trade.assetName] !== undefined ? livePrices[trade.assetName] : buyPrice;
                          
                          const rateToTHB = liveRates[trade.currency] || 1.0;
                          const displayRateToTHB = liveRates[displayCurrency] || 1.0;
                          
                          let pnlConverted = 0;
                          if (isBuy) {
                            pnlConverted = ((livePrice - buyPrice) * qty * rateToTHB) / displayRateToTHB;
                          } else {
                            pnlConverted = ((buyPrice - livePrice) * qty * rateToTHB) / displayRateToTHB;
                          }
                          
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
                                  <div className="mobile-feed-card-label">Total Cost</div>
                                  <div className="mobile-feed-card-value financial-num">
                                    {formatCurrency(qty * buyPrice, trade.currency)}
                                  </div>
                                </div>
                                <div>
                                  <div className="mobile-feed-card-label">P&L ({displayCurrency})</div>
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
                                    {formatCurrency(pos.avgBuyPrice, pos.currency)}
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
                                {pos.qtyHeld > 0 && activePortfolio !== 'All Portfolios' && (
                                  <Button
                                    type="text"
                                    icon={<SwapOutlined />}
                                    size="small"
                                    style={{ color: 'var(--primary-color)', fontWeight: 'bold', padding: 0 }}
                                    onClick={() => {
                                      setTransferTargetAsset(pos.assetName);
                                      setTransferSourcePortfolio(activePortfolio);
                                      transferForm.resetFields();
                                      setIsTransferModalOpen(true);
                                    }}
                                  >
                                    Transfer
                                  </Button>
                                )}
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
                          return (
                            <div key={p} className="mobile-feed-card" style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '4px solid var(--info-color)' }}>
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
                                    setRenameTarget(p);
                                    renameForm.setFieldsValue({ name: p });
                                    setIsRenameModalOpen(true);
                                  }}
                                >
                                  Rename
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
                            title: 'Action',
                            key: 'portfolio_actions',
                            align: 'right',
                            render: (_, record) => (
                              <Space size="middle">
                                <Button 
                                  type="text" 
                                  icon={<SettingOutlined />} 
                                  onClick={() => {
                                    setRenameTarget(record.name);
                                    renameForm.setFieldsValue({ name: record.name });
                                    setIsRenameModalOpen(true);
                                  }}
                                >
                                  Rename
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
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '5px' }}>
                          <Button 
                            icon={<SyncOutlined spin={isSyncingSheet} />} 
                            onClick={handleSyncGoogleSheet}
                            loading={isSyncingSheet}
                            style={{ fontWeight: 'bold' }}
                          >
                            Sync Google Sheet Now
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
                                if (!isCloudMode) {
                                  axios.post(`${API_BASE}/api/google-sheet-settings`, {
                                    google_sheet_id: googleSheetId,
                                    google_apps_script_url: googleAppsScriptUrl,
                                    app_passcode: ''
                                  }).catch(err => console.error("Syncing disabled passcode failed:", err));
                                }
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
                              if (!isCloudMode) {
                                try {
                                  await axios.post(`${API_BASE}/api/google-sheet-settings`, {
                                    google_sheet_id: googleSheetId,
                                    google_apps_script_url: googleAppsScriptUrl,
                                    app_passcode: appPasscode
                                  });
                                } catch (e) {
                                  console.error("Failed to sync passcode to backend:", e);
                                }
                              }
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

        {/* MODAL: EDIT TRADE STRATEGY */}
        <Modal
          title={`Edit Strategy for ${editingTrade?.action.toUpperCase()} ${editingTrade?.assetName}`}
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
            <Form.Item
              name="why"
              label="Strategy / Decision Reason"
              rules={[{ required: true, message: 'Please input strategy reason' }]}
            >
              <Select placeholder="Select or type custom strategy" showSearch optionFilterProp="children" mode="combobox">
                <Option value="CDC Action Zone">CDC Action Zone</Option>
                <Option value="Breakout">Breakout</Option>
                <Option value="EMA Cross">EMA Cross</Option>
                <Option value="Support/Resistance Bounce">Support/Resistance Bounce</Option>
                <Option value="Value Investment">Value Investment</Option>
                <Option value="Rebalance">Rebalance</Option>
              </Select>
            </Form.Item>

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
              date: dayjs()
            }}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="date"
                  label="Transaction Date"
                  rules={[{ required: true, message: 'Please select a date' }]}
                >
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              
              <Col span={12}>
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
            </Row>

            <Row gutter={16}>
              <Col span={12}>
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
              
              <Col span={12}>
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

            <Row gutter={16}>
              <Col span={8}>
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

              <Col span={8}>
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

              <Col span={8}>
                <Form.Item
                  name="quantity"
                  label="Quantity"
                  rules={[{ required: true, message: 'Input quantity' }]}
                >
                  <InputNumber min={0.000001} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="priceUnit"
                  label="Price / Unit (Local)"
                  rules={[{ required: true, message: 'Input price per unit' }]}
                >
                  <InputNumber min={0.000001} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item
                  name="why"
                  label="Strategy / Decision Reason"
                >
                  <Input placeholder="e.g. CDC Action Zone, RSI > 70, Breakthrough" />
                </Form.Item>
              </Col>
            </Row>

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

        {/* MODAL 3: RENAME PORTFOLIO */}
        <Modal
          title="Rename Portfolio"
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
              label="New Portfolio Name"
              rules={[
                { required: true, message: 'Please input a new portfolio name' },
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

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsRenameModalOpen(false)}>Cancel</Button>
                <Button type="primary" htmlType="submit" style={{ color: '#06080f', fontWeight: 'bold' }}>
                  Rename Portfolio
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* MODAL 4: TRANSFER ACTIVE POSITION */}
        <Modal
          title={`Transfer ${transferTargetAsset} Active Position`}
          open={isTransferModalOpen}
          onCancel={() => setIsTransferModalOpen(false)}
          footer={null}
        >
          <div style={{ marginBottom: '18px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
            <Text style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Moving active position for <strong>{transferTargetAsset}</strong>.
            </Text>
            <Text style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Current Portfolio Source: <strong style={{ color: 'var(--primary-color)' }}>{transferSourcePortfolio}</strong>
            </Text>
            <Text style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
              * This will migrate all historical BUY/SELL trades of {transferTargetAsset} in this portfolio to the destination portfolio.
            </Text>
          </div>

          <Form
            form={transferForm}
            layout="vertical"
            onFinish={handleTransferPosition}
          >
            <Form.Item
              name="targetPortfolio"
              label="Select Destination Portfolio"
              rules={[{ required: true, message: 'Please select a destination portfolio' }]}
            >
              <Select placeholder="Choose target portfolio...">
                {portfolios.filter(p => p !== transferSourcePortfolio).map(p => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIsTransferModalOpen(false)}>Cancel</Button>
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
