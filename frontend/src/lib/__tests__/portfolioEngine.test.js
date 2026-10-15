import { describe, it, expect } from 'vitest';
import {
  sortChronologically,
  computeTradeStats,
  computePositions,
  computeKpis,
  computeTradingAnalytics,
  computePortfolioSizing,
  computeCumulativeRealized,
  computePnlByDimension,
  resolveLivePrice
} from '../portfolioEngine.js';

describe('portfolioEngine core WAC calculations', () => {
  it('sorts trades chronologically by date and id', () => {
    const raw = [
      { id: '3', date: '2026-06-03' },
      { id: '1', date: '2026-06-01' },
      { id: '2', date: '2026-06-02' }
    ];
    const sorted = sortChronologically(raw);
    expect(sorted.map(t => t.id)).toEqual(['1', '2', '3']);
  });

  it('calculates WAC correctly on 2 buys and a partial sell with fee', () => {
    const trades = [
      { id: '1', date: '2026-06-01', assetName: 'BTC', action: 'Buy', quantity: 1, priceUnit: 50000, feeAmount: 50, currency: 'USD' },
      { id: '2', date: '2026-06-02', assetName: 'BTC', action: 'Buy', quantity: 1, priceUnit: 60000, feeAmount: 50, currency: 'USD' },
      { id: '3', date: '2026-06-03', assetName: 'BTC', action: 'Sell', quantity: 1, priceUnit: 70000, feeAmount: 70, currency: 'USD' }
    ];

    const stats = computeTradeStats(trades, { BTC: 70000 });

    // Trade 1: cost = 1*50000 + 50 = 50050. Avg cost = 50050.
    expect(stats['1'].avgCostBasis).toBe(50050);
    expect(stats['1'].realizedPnL).toBe(0);

    // Trade 2: total cost = 50050 + 60050 = 110100. Qty = 2. Avg cost = 55050.
    expect(stats['2'].avgCostBasis).toBe(55050);
    expect(stats['2'].realizedPnL).toBe(0);

    // Trade 3: Sell 1 unit at 70000 - 70 fee = 69930 revenue.
    // Cost of shares sold = 1 * 55050 = 55050.
    // Realized P&L = 69930 - 55050 = 14880.
    expect(stats['3'].realizedPnL).toBe(14880);

    const positions = computePositions(trades, { BTC: 75000 }, { USD: 35, THB: 1 }, 'USD');
    expect(positions).toHaveLength(1);
    const btc = positions[0];
    expect(btc.qtyHeld).toBe(1);
    expect(btc.wac).toBe(55050);
    expect(btc.totalCost).toBe(55050);
    expect(btc.liveValue).toBe(75000);
    expect(btc.unrealizedPnL).toBe(75000 - 55050);
    expect(btc.realizedPnL).toBe(14880);
  });

  it('resets cost basis when all shares are sold', () => {
    const trades = [
      { id: '1', date: '2026-06-01', assetName: 'ETH', action: 'Buy', quantity: 2, priceUnit: 3000, feeAmount: 0, currency: 'USD' },
      { id: '2', date: '2026-06-02', assetName: 'ETH', action: 'Sell', quantity: 2, priceUnit: 3500, feeAmount: 0, currency: 'USD' },
      { id: '3', date: '2026-06-03', assetName: 'ETH', action: 'Buy', quantity: 1, priceUnit: 4000, feeAmount: 0, currency: 'USD' }
    ];

    const positions = computePositions(trades, { ETH: 4000 }, { USD: 35, THB: 1 }, 'USD');
    const eth = positions[0];
    expect(eth.qtyHeld).toBe(1);
    expect(eth.wac).toBe(4000);
    expect(eth.realizedPnL).toBe(1000);
  });

  it('handles multi-currency conversion to THB display currency', () => {
    const trades = [
      { id: '1', date: '2026-06-01', assetName: 'AAPL', action: 'Buy', quantity: 10, priceUnit: 150, feeAmount: 0, currency: 'USD' }
    ];
    const liveRates = { USD: 35.0, THB: 1.0 };
    const positions = computePositions(trades, { AAPL: 160 }, liveRates, 'THB');
    const aapl = positions[0];

    // Local USD: 10 * 150 = 1500 USD
    // Converted THB: 1500 * 35 = 52500 THB
    expect(aapl.totalCostConverted).toBe(52500);
    // Live Value: 10 * 160 * 35 = 56000 THB
    expect(aapl.liveValueConverted).toBe(56000);
    expect(aapl.unrealizedPnLConverted).toBe(3500);
  });

  it('computes KPIs and portfolio sizing without double-counting realized PnL in positionSizeCash', () => {
    const positions = [
      {
        qtyHeld: 10,
        totalCostConverted: 50000,
        liveValueConverted: 60000,
        unrealizedPnLConverted: 10000,
        realizedPnLConverted: 5000,
        totalBuyCostConverted: 50000
      }
    ];

    const kpis = computeKpis(positions);
    expect(kpis.totalInvestedConverted).toBe(50000);
    expect(kpis.currentMarketValueConverted).toBe(60000);
    expect(kpis.totalUnrealizedPnLConverted).toBe(10000);
    expect(kpis.totalRealizedPnLConverted).toBe(5000);
    expect(kpis.totalPnLConverted).toBe(15000);
    expect(kpis.totalPnLPct).toBe(30);

    const sizing = computePortfolioSizing({
      portfolios: ['Main'],
      activePortfolio: 'Main',
      configs: { Main: { initialCapital: 100000, targetStocks: 10 } },
      kpis,
      positions
    });
    // cashOnHand = initialCapital (100000) - totalInvested (50000) + totalRealized (5000) = 55000
    expect(sizing.cashOnHand).toBe(55000);
    // positionSizeCash = cashOnHand / targetStocks = 55000 / 10 = 5500 (NOT (55000 + 5000)/10 = 6000)
    expect(sizing.positionSizeCash).toBe(5500);
    expect(sizing.activeHoldingsCount).toBe(1);
  });

  it('computes totalPnLPct correctly even when portfolio is 100% sold out', () => {
    const trades = [
      { id: '1', date: '2026-06-01', assetName: 'BTC', action: 'Buy', quantity: 1, priceUnit: 100000, feeAmount: 0, currency: 'THB' },
      { id: '2', date: '2026-06-02', assetName: 'BTC', action: 'Sell', quantity: 1, priceUnit: 120000, feeAmount: 0, currency: 'THB' }
    ];

    const positions = computePositions(trades, { BTC: 120000 }, { THB: 1 }, 'THB');
    expect(positions[0].qtyHeld).toBe(0);

    const kpis = computeKpis(positions);
    expect(kpis.totalInvestedConverted).toBe(0);
    expect(kpis.totalRealizedPnLConverted).toBe(20000);
    // Denominator should be totalBuyCostEver = 100000, so return is +20%
    expect(kpis.totalPnLPct).toBe(20);
  });

  it('matches cumulative realized P&L final point with kpis.totalRealizedPnLConverted', () => {
    const trades = [
      { id: '1', date: '2026-06-01', assetName: 'MSTR', action: 'Buy', quantity: 10, priceUnit: 1000, feeAmount: 10, currency: 'USD' },
      { id: '2', date: '2026-06-02', assetName: 'MSTR', action: 'Sell', quantity: 5, priceUnit: 1200, feeAmount: 15, currency: 'USD' },
      { id: '3', date: '2026-06-03', assetName: 'MSTR', action: 'Sell', quantity: 5, priceUnit: 1100, feeAmount: 10, currency: 'USD' }
    ];
    const liveRates = { USD: 35.0, THB: 1.0 };
    const positions = computePositions(trades, { MSTR: 1100 }, liveRates, 'THB');
    const kpis = computeKpis(positions);

    const cumulative = computeCumulativeRealized(trades, liveRates, 'THB');
    expect(cumulative).toHaveLength(3); // 1 buy date (0) + 2 sell dates
    const lastPoint = cumulative[cumulative.length - 1];
    expect(lastPoint.PnL).toBe(Number(kpis.totalRealizedPnLConverted.toFixed(2)));
  });

  it('computes P&L by Dimension matching total realized P&L and attributes strategy correctly', () => {
    const trades = [
      { id: '1', date: '2026-06-01', assetName: 'BTC', action: 'Buy', quantity: 1, priceUnit: 50000, feeAmount: 0, why: 'Breakout', currency: 'USD' },
      { id: '2', date: '2026-06-02', assetName: 'ETH', action: 'Buy', quantity: 10, priceUnit: 3000, feeAmount: 0, why: 'Dip Buy', currency: 'USD' },
      { id: '3', date: '2026-06-03', assetName: 'BTC', action: 'Sell', quantity: 1, priceUnit: 60000, feeAmount: 0, why: '', currency: 'USD' }, // empty why -> inherits 'Breakout'
      { id: '4', date: '2026-06-04', assetName: 'ETH', action: 'Sell', quantity: 10, priceUnit: 2800, feeAmount: 0, why: 'Stop Loss', currency: 'USD' }
    ];
    const liveRates = { USD: 1.0 };
    const positions = computePositions(trades, {}, liveRates, 'USD');
    const kpis = computeKpis(positions);

    const pnlByStrategy = computePnlByDimension(trades, {}, liveRates, 'USD', 'strategy', 'realized', positions);
    // BTC: +10000 to 'Breakout', ETH: -2000 to 'Stop Loss'
    const breakout = pnlByStrategy.find(s => s.name === 'Breakout');
    const stopLoss = pnlByStrategy.find(s => s.name === 'Stop Loss');
    expect(breakout.PnL).toBe(10000);
    expect(stopLoss.PnL).toBe(-2000);

    const totalFromGroups = pnlByStrategy.reduce((sum, item) => sum + item.PnL, 0);
    expect(totalFromGroups).toBe(kpis.totalRealizedPnLConverted);
  });

  it('computes trading analytics win rate and profit factor', () => {
    const trades = [
      { id: '1', action: 'Sell', currency: 'THB' },
      { id: '2', action: 'Sell', currency: 'THB' }
    ];
    const statsMap = {
      '1': { realizedPnL: 500 },
      '2': { realizedPnL: -200 }
    };
    const analytics = computeTradingAnalytics(trades, statsMap, { THB: 1 }, 'THB');
    expect(analytics.winCount).toBe(1);
    expect(analytics.lossCount).toBe(1);
    expect(analytics.winRate).toBe(50);
    expect(analytics.profitFactor).toBe(2.5);
  });

  it('honors trade-date fxToThb for realized PnL in THB', () => {
    const trades = [
      { id: '1', date: '2026-06-01', assetName: 'AAPL', action: 'Buy', quantity: 10, priceUnit: 150, feeAmount: 0, currency: 'USD', fxToThb: 34.0 },
      { id: '2', date: '2026-06-15', assetName: 'AAPL', action: 'Sell', quantity: 10, priceUnit: 160, feeAmount: 0, currency: 'USD', fxToThb: 36.5 }
    ];
    // Live rate is 32.0 (different from sell date rate 36.5)
    const liveRates = { USD: 32.0, THB: 1.0 };
    // Realized PnL in USD = (160 - 150) * 10 = $100.
    // In THB, using trade-date FX 36.5: 100 * 36.5 = 3650 THB. (If live rate was used, it would be 3200 THB).
    const positions = computePositions(trades, {}, liveRates, 'THB');
    expect(positions[0].realizedPnLConverted).toBe(3650);

    const statsMap = computeTradeStats(trades);
    const analytics = computeTradingAnalytics(trades, statsMap, liveRates, 'THB');
    expect(analytics.grossProfit).toBe(3650);

    const cumulative = computeCumulativeRealized(trades, liveRates, 'THB');
    expect(cumulative[cumulative.length - 1].PnL).toBe(3650);

    const dimension = computePnlByDimension(trades, {}, liveRates, 'THB', 'name', 'realized', positions);
    expect(dimension[0].PnL).toBe(3650);
  });

  describe('resolveLivePrice and unpriced position handling', () => {
    it('resolves prices across different ticker formats and casing', () => {
      const prices = {
        'BJC.BK': 18.1,
        'KCE': 75.5,
        'BTCUSDT': 68000,
        'ETH-USD': 3500,
        'MSTR': 143.24
      };

      expect(resolveLivePrice('BJC', prices, null)).toBe(18.1);
      expect(resolveLivePrice('bjc', prices, null)).toBe(18.1);
      expect(resolveLivePrice('KCE.BK', prices, null)).toBe(75.5);
      expect(resolveLivePrice('kce', prices, null)).toBe(75.5);
      expect(resolveLivePrice('BTC', prices, null)).toBe(68000);
      expect(resolveLivePrice('ETH', prices, null)).toBe(3500);
      expect(resolveLivePrice('MSTR', prices, null)).toBe(143.24);
      expect(resolveLivePrice('UNKNOWN', prices, null)).toBe(null);
      expect(resolveLivePrice('UNKNOWN', prices, 100)).toBe(100);
    });

    it('marks positions as hasLivePrice: false and unrealizedPnL: 0 when live price is missing', () => {
      const trades = [
        { id: '1', date: '2026-06-01', assetName: 'BJC', action: 'Buy', quantity: 1000, priceUnit: 15.6, feeAmount: 0, currency: 'THB' },
        { id: '2', date: '2026-06-02', assetName: 'KCE', action: 'Buy', quantity: 500, priceUnit: 19.0, feeAmount: 0, currency: 'THB' }
      ];

      // Only BJC has live price, KCE is missing
      const livePrices = { BJC: 18.0 };
      const positions = computePositions(trades, livePrices, { THB: 1 }, 'THB');

      const bjc = positions.find(p => p.assetName === 'BJC');
      const kce = positions.find(p => p.assetName === 'KCE');

      expect(bjc.hasLivePrice).toBe(true);
      expect(bjc.livePrice).toBe(18.0);
      expect(bjc.unrealizedPnL).toBe(1000 * 18.0 - 15600); // +2400

      expect(kce.hasLivePrice).toBe(false);
      expect(kce.livePrice).toBe(19.0); // WAC fallback for conservative NAV
      expect(kce.unrealizedPnL).toBe(0); // Never show artificial 0 P&L as profit

      const kpis = computeKpis(positions);
      expect(kpis.unpricedHoldingsCount).toBe(1);
      expect(kpis.allHoldingsPriced).toBe(false);
      expect(kpis.totalUnrealizedPnLConverted).toBe(2400);
    });

    it('sets allHoldingsPriced: true when all holdings have valid live prices', () => {
      const trades = [
        { id: '1', date: '2026-06-01', assetName: 'BJC', action: 'Buy', quantity: 1000, priceUnit: 15.6, feeAmount: 0, currency: 'THB' },
        { id: '2', date: '2026-06-02', assetName: 'KCE', action: 'Buy', quantity: 500, priceUnit: 19.0, feeAmount: 0, currency: 'THB' }
      ];

      const livePrices = { BJC: 18.0, KCE: 22.0 };
      const positions = computePositions(trades, livePrices, { THB: 1 }, 'THB');
      const kpis = computeKpis(positions);

      expect(kpis.unpricedHoldingsCount).toBe(0);
      expect(kpis.allHoldingsPriced).toBe(true);
      expect(kpis.totalUnrealizedPnLConverted).toBe((18000 - 15600) + (11000 - 9500)); // 2400 + 1500 = 3900
    });
  });
});


