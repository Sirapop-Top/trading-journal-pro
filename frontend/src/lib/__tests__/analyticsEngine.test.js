import { describe, it, expect } from 'vitest';
import {
  computeMonthlyHeatmap,
  computeEquityCurveAndDrawdown,
  normalizeBenchmark,
  computeStrategyDetailedStats
} from '../analyticsEngine.js';

describe('Analytics Engine Test Suite (Step 6)', () => {
  describe('computeMonthlyHeatmap', () => {
    it('returns empty structure for empty data', () => {
      const res = computeMonthlyHeatmap([], [], {}, 'THB');
      expect(res.years).toEqual([]);
      expect(res.grandTotal.total).toBe(0);
    });

    it('aggregates realized PnL and dividends by year and month', () => {
      const trades = [
        {
          id: '1',
          date: '2026-03-15',
          action: 'Sell',
          realizedPnL: 5000,
          currency: 'THB',
          fxToThb: 1
        },
        {
          id: '2',
          date: '2026-03-20',
          action: 'Sell',
          realizedPnL: -1000,
          currency: 'THB',
          fxToThb: 1
        },
        {
          id: '3',
          date: '2026-05-10',
          action: 'Sell',
          realizedPnL: 100, // USD
          currency: 'USD',
          fxToThb: 35
        }
      ];

      const cashEntries = [
        {
          entryId: 'CL-1',
          date: '2026-03-25',
          kind: 'Dividend',
          currency: 'THB',
          net: 1500,
          fxToThb: 1
        }
      ];

      const res = computeMonthlyHeatmap(trades, cashEntries, { USD: 35 }, 'THB');
      expect(res.years).toEqual(['2026']);
      
      // March 2026: Realized = 4000 (5000 - 1000), Dividend = 1500, Total = 5500
      const mar = res.grid['2026']['03'];
      expect(mar.realized).toBe(4000);
      expect(mar.dividends).toBe(1500);
      expect(mar.total).toBe(5500);

      // May 2026: Realized = 100 * 35 = 3500
      const may = res.grid['2026']['05'];
      expect(may.realized).toBe(3500);

      // Year total: 5500 + 3500 = 9000
      expect(res.yearTotals['2026'].total).toBe(9000);
      expect(res.grandTotal.total).toBe(9000);
    });
  });

  describe('computeEquityCurveAndDrawdown', () => {
    it('calculates daily equity and max drawdown correctly', () => {
      const cashEntries = [
        {
          date: '2026-01-01',
          kind: 'Deposit',
          net: 100000,
          currency: 'THB',
          fxToThb: 1
        }
      ];

      const trades = [
        {
          id: '1',
          date: '2026-01-02',
          assetName: 'PTT.BK',
          assetType: 'Thai Stock',
          action: 'Buy',
          quantity: 1000,
          priceUnit: 50,
          feeAmount: 50,
          currency: 'THB',
          fxToThb: 1
        }
      ];

      // Simulated prices
      const historicalPrices = {
        'PTT.BK': [
          { date: '2026-01-02', close: 50 },
          { date: '2026-01-03', close: 60 }, // Peak: Stock = 60,000, Cash = 49,950 => Equity = 109,950
          { date: '2026-01-04', close: 40 }, // Trough: Stock = 40,000, Cash = 49,950 => Equity = 89,950
          { date: '2026-01-05', close: 55 }
        ]
      };

      const res = computeEquityCurveAndDrawdown(
        trades,
        historicalPrices,
        cashEntries,
        {},
        'THB',
        { endDate: '2026-01-05' }
      );

      expect(res.series.length).toBeGreaterThanOrEqual(4);
      expect(res.kpis.peakEquity).toBe(109950);
      // Drawdown = (89950 - 109950) / 109950 = -20000 / 109950 ≈ -18.19%
      expect(res.kpis.maxDrawdownPct).toBeCloseTo(-18.19, 1);
      expect(res.kpis.maxDrawdownDate).toBe('2026-01-04');
    });

    it('handles Synthetic Short 1x valuation correctly in equity curve', () => {
      const cashEntries = [
        { date: '2026-06-01', kind: 'Deposit', net: 100000, currency: 'THB' }
      ];

      const trades = [
        {
          id: '1',
          date: '2026-06-01',
          assetName: 'BTC-USD:S1X',
          assetType: 'Crypto Short 1x',
          action: 'Buy',
          quantity: 1,
          priceUnit: 60000,
          feeAmount: 0,
          currency: 'USD',
          fxToThb: 1
        }
      ];

      // BTC price falls from 60,000 to 50,000 -> Short 1x value = 2*60000 - 50000 = 70,000
      const historicalPrices = {
        'BTC-USD:S1X': [
          { date: '2026-06-01', close: 60000 },
          { date: '2026-06-02', close: 50000 }
        ]
      };

      const res = computeEquityCurveAndDrawdown(
        trades,
        historicalPrices,
        cashEntries,
        { USD: 1 },
        'THB',
        { endDate: '2026-06-02' }
      );

      const day2 = res.series.find(s => s.date === '2026-06-02');
      expect(day2.invested).toBe(70000);
      expect(day2.equity).toBe(110000); // 40,000 cash + 70,000 short value
    });
  });

  describe('normalizeBenchmark', () => {
    it('normalizes benchmark to 100 starting from the base date', () => {
      const bSeries = [
        { date: '2026-01-01', close: 1000 },
        { date: '2026-01-02', close: 1050 },
        { date: '2026-01-03', close: 950 }
      ];
      const targetDates = ['2026-01-01', '2026-01-02', '2026-01-03'];

      const norm = normalizeBenchmark(bSeries, targetDates, 100);
      expect(norm['2026-01-01']).toBe(100);
      expect(norm['2026-01-02']).toBe(105);
      expect(norm['2026-01-03']).toBe(95);
    });
  });

  describe('computeStrategyDetailedStats', () => {
    it('computes detailed strategy statistics with attribution fallback', () => {
      const trades = [
        {
          id: '1',
          date: '2026-01-01',
          assetName: 'MSTR',
          action: 'Buy',
          why: 'Breakout 50MA',
          currency: 'THB'
        },
        {
          id: '2',
          date: '2026-01-15',
          assetName: 'MSTR',
          action: 'Sell',
          why: '', // Should fallback to 'Breakout 50MA'
          currency: 'THB'
        },
        {
          id: '3',
          date: '2026-02-01',
          assetName: 'BTC',
          action: 'Buy',
          why: 'DCA',
          currency: 'THB'
        },
        {
          id: '4',
          date: '2026-02-15',
          assetName: 'BTC',
          action: 'Sell',
          why: 'DCA',
          currency: 'THB'
        }
      ];

      const runningStats = {
        '2': { realizedPnL: 5000 },
        '4': { realizedPnL: -1000 }
      };

      const stats = computeStrategyDetailedStats(trades, runningStats, {}, 'THB');
      expect(stats.length).toBe(2);

      const breakout = stats.find(s => s.strategy === 'Breakout 50MA');
      expect(breakout).toBeDefined();
      expect(breakout.trades).toBe(1);
      expect(breakout.wins).toBe(1);
      expect(breakout.winRate).toBe(100);
      expect(breakout.totalPnL).toBe(5000);

      const dca = stats.find(s => s.strategy === 'DCA');
      expect(dca).toBeDefined();
      expect(dca.trades).toBe(1);
      expect(dca.losses).toBe(1);
      expect(dca.winRate).toBe(0);
      expect(dca.totalPnL).toBe(-1000);
    });
  });
});
