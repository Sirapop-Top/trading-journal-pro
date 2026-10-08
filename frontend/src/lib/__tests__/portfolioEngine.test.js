import { describe, it, expect } from 'vitest';
import {
  sortChronologically,
  computeTradeStats,
  computePositions,
  computeKpis,
  computeTradingAnalytics,
  computePortfolioSizing
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

  it('computes KPIs and portfolio sizing', () => {
    const positions = [
      {
        qtyHeld: 10,
        totalCostConverted: 50000,
        liveValueConverted: 60000,
        unrealizedPnLConverted: 10000,
        realizedPnLConverted: 5000
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
    expect(sizing.activeHoldingsCount).toBe(1);
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
});
