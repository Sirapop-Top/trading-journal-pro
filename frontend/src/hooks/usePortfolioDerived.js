import { useMemo } from 'react';
import dayjs from 'dayjs';
import { ASSET_TYPE_COLORS } from '../lib/constants.js';
import {
  computeTradeStats,
  computeTradingAnalytics,
  computePositions,
  computeKpis,
  computePortfolioSizing,
  computeCumulativeRealized,
  computePnlByDimension
} from '../lib/portfolioEngine.js';
import { hasDeposit, computeCashBalance } from '../lib/cashEngine.js';

export const usePortfolioDerived = ({
  trades = [],
  portfolios = [],
  activePortfolio = 'All Portfolios',
  livePrices = {},
  liveRates = {},
  displayCurrency = 'THB',
  cashEntries = [],
  dateRange = null,
  journalActionFilter = 'All',
  journalAssetTypeFilter = 'All',
  journalSearch = '',
  positionsTypeFilter = 'All',
  positionsSearch = '',
  allocationDimension = 'type',
  pnlDimension = 'strategy',
  pnlMode = 'realized'
}) => {
  // Filtered trades by active portfolio
  const filteredTrades = useMemo(() => {
    if (activePortfolio === 'All Portfolios') {
      return trades;
    }
    return trades.filter(t => t.portfolio === activePortfolio);
  }, [trades, activePortfolio]);

  // Date range filtered trades for realized analytics and charts
  const dateRangeFilteredTrades = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) {
      return filteredTrades;
    }
    return filteredTrades.filter(t => t.date >= dateRange[0] && t.date <= dateRange[1]);
  }, [filteredTrades, dateRange]);

  // Running stats for all filtered trades chronologically
  const tradesWithRunningStats = useMemo(() => {
    return computeTradeStats(filteredTrades, livePrices);
  }, [filteredTrades, livePrices]);

  // Advanced Trading Analytics (computed for the selected date range)
  const tradingAnalytics = useMemo(() => {
    return computeTradingAnalytics(dateRangeFilteredTrades, tradesWithRunningStats, liveRates, displayCurrency);
  }, [dateRangeFilteredTrades, tradesWithRunningStats, liveRates, displayCurrency]);

  // Search and filtered trades specifically for the Journal Table display
  const journalFilteredTrades = useMemo(() => {
    let result = filteredTrades;

    // Filter by Action
    if (journalActionFilter !== 'All') {
      if (journalActionFilter === 'Rebalance') {
        result = result.filter(t => !!t.rebalanceId);
      } else {
        result = result.filter(t => t.action.toLowerCase() === journalActionFilter.toLowerCase());
      }
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
    return computePositions(filteredTrades, livePrices, liveRates, displayCurrency, { dateRange });
  }, [filteredTrades, livePrices, liveRates, displayCurrency, dateRange]);

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
  const kpis = useMemo(() => computeKpis(positions), [positions]);

  // Portfolio capital configuration and target sizing calculations
  const portfolioSizing = useMemo(() => {
    const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
    const baseSizing = computePortfolioSizing({
      portfolios,
      activePortfolio,
      configs,
      kpis,
      positions
    });

    const depositExists = hasDeposit(activePortfolio, cashEntries);
    if (depositExists) {
      const { cashBalance } = computeCashBalance({
        portfolio: activePortfolio,
        cashEntries,
        trades,
        liveRates,
        displayCurrency,
        fallbackCashOnHand: baseSizing.cashOnHand
      });
      const posSizeCash = baseSizing.targetStocks > 0 ? cashBalance / baseSizing.targetStocks : 0;
      return {
        ...baseSizing,
        cashOnHand: cashBalance,
        positionSizeCash: posSizeCash,
        hasDeposit: true
      };
    }

    return {
      ...baseSizing,
      hasDeposit: false
    };
  }, [portfolios, activePortfolio, kpis, positions, cashEntries, trades, liveRates, displayCurrency]);

  // 1. Cumulative Realized P&L Line Chart over Time
  const cumulativePnLData = useMemo(() => {
    return computeCumulativeRealized(dateRangeFilteredTrades, liveRates, displayCurrency);
  }, [dateRangeFilteredTrades, liveRates, displayCurrency]);

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
    return computePnlByDimension(dateRangeFilteredTrades, livePrices, liveRates, displayCurrency, pnlDimension, pnlMode, positions);
  }, [dateRangeFilteredTrades, livePrices, liveRates, displayCurrency, pnlDimension, pnlMode, positions]);

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

  return {
    filteredTrades,
    tradesWithRunningStats,
    tradingAnalytics,
    journalFilteredTrades,
    positions,
    renderedPositions,
    kpis,
    portfolioSizing,
    cumulativePnLData,
    assetAllocationData,
    pnlDistributionData,
    realizedPnLBreakdownData
  };
};
