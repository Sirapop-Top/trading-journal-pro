import { createContext, useContext, useState, useEffect } from 'react';
import { Form } from 'antd';
import { useJournalData } from '../hooks/useJournalData.js';
import { usePortfolioDerived } from '../hooks/usePortfolioDerived.js';
import { useResponsive } from '../hooks/useResponsive.js';
import { usePasscodeLock } from '../hooks/usePasscodeLock.js';
import { usePortfolioActions } from '../hooks/usePortfolioActions.js';
import { useTradeActions } from '../hooks/useTradeActions.js';

const AppDataContext = createContext(null);

export const AppDataProvider = ({ children }) => {
  // Navigation & Sider
  const [activeTab, setActiveTab] = useState('dashboard');
  const [siderCollapsed, setSiderCollapsed] = useState(false);

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

  const value = {
    // Navigation
    activeTab,
    setActiveTab,
    siderCollapsed,
    setSiderCollapsed,

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
    ...tradeActions
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
