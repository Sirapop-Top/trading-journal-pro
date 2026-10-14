import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { Form } from 'antd';
import dayjs from 'dayjs';
import { useJournalData } from '../hooks/useJournalData.js';
import { usePortfolioDerived } from '../hooks/usePortfolioDerived.js';
import { useResponsive } from '../hooks/useResponsive.js';
import { usePasscodeLock } from '../hooks/usePasscodeLock.js';
import { usePortfolioActions } from '../hooks/usePortfolioActions.js';
import { useTradeActions } from '../hooks/useTradeActions.js';
import { useRebalanceActions } from '../hooks/useRebalanceActions.js';
import { useCashActions } from '../hooks/useCashActions.js';
import { computeCashLedgerStatement, computeCashKpis, calculateDefaultWht } from '../lib/cashEngine.js';
import {
  computeMonthlyHeatmap,
  computeEquityCurveAndDrawdown,
  normalizeBenchmark,
  computeStrategyDetailedStats
} from '../lib/analyticsEngine.js';
import { fetchHistoryApi } from '../api/sheetsClient.js';

const AppDataContext = createContext(null);

export const AppDataProvider = ({ children }) => {
  // Navigation & Sider
  const [activeTab, setActiveTab] = useState('dashboard');
  const [siderCollapsed, setSiderCollapsed] = useState(false);

  // Global Date Range (Step 6 Analytics & UX)
  // preset: 'All' | 'YTD' | '1Y' | '3Y' | 'Custom'
  const [dateRangePreset, setDateRangePreset] = useState('All');
  const [customDateRange, setCustomDateRange] = useState(null);

  const dateRange = useMemo(() => {
    const today = dayjs().format('YYYY-MM-DD');
    if (dateRangePreset === 'YTD') {
      return [dayjs().startOf('year').format('YYYY-MM-DD'), today];
    }
    if (dateRangePreset === '1Y') {
      return [dayjs().subtract(1, 'year').format('YYYY-MM-DD'), today];
    }
    if (dateRangePreset === '3Y') {
      return [dayjs().subtract(3, 'year').format('YYYY-MM-DD'), today];
    }
    if (dateRangePreset === 'Custom') {
      return customDateRange;
    }
    return null;
  }, [dateRangePreset, customDateRange]);

  // Online / Offline Status (Step 6.9 PWA Resilience)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Filters & Dimensions
  const [journalActionFilter, setJournalActionFilter] = useState('All');
  const [journalAssetTypeFilter, setJournalAssetTypeFilter] = useState('All');
  const [journalSearch, setJournalSearch] = useState('');
  const [positionsTypeFilter, setPositionsTypeFilter] = useState('All');
  const [positionsSearch, setPositionsSearch] = useState('');
  const [allocationDimension, setAllocationDimension] = useState('type'); // 'type' | 'name'
  const [pnlDimension, setPnlDimension] = useState('strategy'); // 'strategy' | 'type' | 'name'
  const [pnlMode, setPnlMode] = useState('realized'); // 'realized' | 'unrealized'
  const [mobileChartTab, setMobileChartTab] = useState('performance');

  // Hooks
  const responsive = useResponsive();
  const passcode = usePasscodeLock();
  const journal = useJournalData();

  // Load initial data on mount
  useEffect(() => {
    journal.fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived calculations
  const derived = usePortfolioDerived({
    trades: journal.trades,
    portfolios: journal.portfolios,
    activePortfolio: journal.activePortfolio,
    livePrices: journal.livePrices,
    liveRates: journal.liveRates,
    displayCurrency: journal.displayCurrency,
    cashEntries: journal.cashLedger,
    dateRange,
    journalActionFilter,
    journalAssetTypeFilter,
    journalSearch,
    positionsTypeFilter,
    positionsSearch,
    allocationDimension,
    pnlDimension,
    pnlMode
  });

  // Modals & Forms
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [isPortfolioModalOpen, setIsPortfolioModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditStrategyModalOpen, setIsEditStrategyModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState('');
  const [transferTargetAsset, setTransferTargetAsset] = useState('');
  const [transferSourcePortfolio, setTransferSourcePortfolio] = useState('');
  const [formAction, setFormAction] = useState('Buy');
  const [editingTrade, setEditingTrade] = useState(null);
  const [isCustomStrategy, setIsCustomStrategy] = useState(false);

  const [tradeForm] = Form.useForm();
  const [portfolioForm] = Form.useForm();
  const [renameForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [editStrategyForm] = Form.useForm();

  const [tickerValidation, setTickerValidation] = useState({
    status: 'idle',
    message: '',
    checkedTicker: ''
  });

  // Portfolio actions & calculations
  const portfolioActions = usePortfolioActions({
    journal,
    portfolioForm,
    renameForm,
    renameTarget,
    setIsPortfolioModalOpen,
    setIsRenameModalOpen
  });

  // Trade actions & validations
  const tradeActions = useTradeActions({
    journal,
    derived,
    tradeForm,
    editStrategyForm,
    transferForm,
    editingTrade,
    setEditingTrade,
    setIsTradeModalOpen,
    setIsEditStrategyModalOpen,
    setIsTransferModalOpen,
    setIsCustomStrategy,
    tickerValidation,
    setTickerValidation
  });

  // Rebalance actions & calculations
  const rebalanceActions = useRebalanceActions({
    trades: journal.trades,
    rebalancePairs: journal.rebalancePairs,
    setRebalancePairs: journal.setRebalancePairs,
    rebalanceLog: journal.rebalanceLog,
    setRebalanceLog: journal.setRebalanceLog,
    livePrices: journal.livePrices,
    liveRates: journal.liveRates,
    fetchData: journal.fetchData
  });

  // Cash actions (Step 5 Accounting)
  const cashActions = useCashActions({ journal });

  // Cash KPIs and Statement
  const cashKpis = computeCashKpis({
    portfolio: journal.activePortfolio,
    cashEntries: journal.cashLedger,
    trades: journal.trades,
    liveRates: journal.liveRates,
    displayCurrency: journal.displayCurrency,
    realizedPnLConverted: derived.kpis.totalRealizedPnLConverted,
    unrealizedPnLConverted: derived.kpis.totalUnrealizedPnLConverted,
    fallbackCashOnHand: derived.portfolioSizing.cashOnHand
  });

  const cashStatement = computeCashLedgerStatement({
    portfolio: journal.activePortfolio,
    cashEntries: journal.cashLedger,
    trades: journal.trades,
    liveRates: journal.liveRates,
    displayCurrency: journal.displayCurrency
  });

  // 6.3 Historical Prices & Benchmark State
  const [selectedBenchmark, setSelectedBenchmark] = useState('^SET.BK');
  const [historicalPrices, setHistoricalPrices] = useState({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fetchHistoricalData = useCallback(async (symbols = [], range = '1y') => {
    if (!symbols.length) return;
    setIsLoadingHistory(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (scriptUrl) {
        const res = await fetchHistoryApi(scriptUrl, symbols, range);
        if (res && res.success && res.history) {
          setHistoricalPrices(prev => ({ ...prev, ...res.history }));
        }
      }
    } catch (e) {
      console.error('fetchHistoricalData error:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // 6.2 Monthly P&L Heatmap
  const monthlyHeatmap = useMemo(() => {
    return computeMonthlyHeatmap(
      derived.filteredTrades,
      journal.cashLedger,
      journal.liveRates,
      journal.displayCurrency
    );
  }, [derived.filteredTrades, journal.cashLedger, journal.liveRates, journal.displayCurrency]);

  // 6.4 Equity Curve and Drawdown
  const equityCurveData = useMemo(() => {
    return computeEquityCurveAndDrawdown(
      derived.filteredTrades,
      historicalPrices,
      journal.cashLedger,
      journal.liveRates,
      journal.displayCurrency
    );
  }, [derived.filteredTrades, historicalPrices, journal.cashLedger, journal.liveRates, journal.displayCurrency]);

  // 6.5 Benchmark Normalization
  const normalizedBenchmark = useMemo(() => {
    const targetDates = equityCurveData.series.map(s => s.date);
    const benchmarkSeries = historicalPrices[selectedBenchmark] || [];
    return normalizeBenchmark(benchmarkSeries, targetDates, 100);
  }, [equityCurveData.series, historicalPrices, selectedBenchmark]);

  // 6.6 Strategy Detailed Stats
  const strategyDetailedStats = useMemo(() => {
    return computeStrategyDetailedStats(
      derived.filteredTrades,
      derived.tradesWithRunningStats,
      journal.liveRates,
      journal.displayCurrency
    );
  }, [derived.filteredTrades, derived.tradesWithRunningStats, journal.liveRates, journal.displayCurrency]);

  // 6.8 CSV Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const value = {
    // Navigation
    activeTab,
    setActiveTab,
    siderCollapsed,
    setSiderCollapsed,

    // Global Date Range (Step 6.1)
    dateRange,
    dateRangePreset,
    setDateRangePreset,
    customDateRange,
    setCustomDateRange,

    // PWA & Connectivity (Step 6.9)
    isOnline,

    // Analytics (Step 6.2 - 6.6)
    monthlyHeatmap,
    equityCurveData,
    normalizedBenchmark,
    strategyDetailedStats,
    selectedBenchmark,
    setSelectedBenchmark,
    historicalPrices,
    isLoadingHistory,
    fetchHistoricalData,

    // CSV Import Modal (Step 6.8)
    isImportModalOpen,
    setIsImportModalOpen,

    // Filters & View Dimensions
    journalActionFilter,
    setJournalActionFilter,
    journalAssetTypeFilter,
    setJournalAssetTypeFilter,
    journalSearch,
    setJournalSearch,
    positionsTypeFilter,
    setPositionsTypeFilter,
    positionsSearch,
    setPositionsSearch,
    allocationDimension,
    setAllocationDimension,
    pnlDimension,
    setPnlDimension,
    pnlMode,
    setPnlMode,
    mobileChartTab,
    setMobileChartTab,

    // Hooks data
    ...journal,
    ...derived,
    ...responsive,
    ...passcode,

    // Cash Ledger (Step 5)
    cashKpis,
    cashStatement,
    calculateDefaultWht,

    // Modals & Forms
    isTradeModalOpen,
    setIsTradeModalOpen,
    isPortfolioModalOpen,
    setIsPortfolioModalOpen,
    isRenameModalOpen,
    setIsRenameModalOpen,
    isTransferModalOpen,
    setIsTransferModalOpen,
    isEditStrategyModalOpen,
    setIsEditStrategyModalOpen,
    renameTarget,
    setRenameTarget,
    transferTargetAsset,
    setTransferTargetAsset,
    transferSourcePortfolio,
    setTransferSourcePortfolio,
    formAction,
    setFormAction,
    editingTrade,
    setEditingTrade,
    isCustomStrategy,
    setIsCustomStrategy,
    tradeForm,
    portfolioForm,
    renameForm,
    transferForm,
    editStrategyForm,
    tickerValidation,
    setTickerValidation,

    // Actions & Handlers
    ...portfolioActions,
    ...tradeActions,
    ...rebalanceActions,
    ...cashActions
  };

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return context;
};
