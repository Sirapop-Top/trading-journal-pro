import { describe, it, expect } from 'vitest';
import * as E from '../rebalanceEngine';

const near = (a, b, tol = 1e-6) => {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
};

describe('rebalanceEngine', () => {
  const rates = { THB: 1, USD: 35 };
  const base = [
    { seq: 1, date: '2026-06-01', portfolio: 'P', assetName: 'BTC-USD', assetType: 'Crypto', currency: 'USD', action: 'Buy', quantity: 0.5, priceUnit: 60000, feeAmount: 0 },
    { seq: 2, date: '2026-06-01', portfolio: 'P', assetName: 'BTC-USD:S1X', assetType: 'Crypto Short 1x', currency: 'USD', action: 'Buy', quantity: 0.5, priceUnit: 60000, feeAmount: 0 },
  ];
  const pair = {
    portfolio: 'P',
    assetA: 'BTC-USD',
    assetAType: 'Crypto',
    assetACurrency: 'USD',
    assetB: 'BTC-USD:S1X',
    assetBType: 'Crypto Short 1x',
    assetBCurrency: 'USD',
    targetA: 50,
    mode: 'Drift',
    driftThreshold: 5,
    status: 'Active'
  };

  it('short 1x valuation = 2*entry - price', () => {
    const st = E.computePairState(pair, base, { 'BTC-USD': 66000 }, rates);
    near(st.valueA / 35, 33000);
    near(st.valueB / 35, 27000);
    near(st.total / 35, 60000); // delta neutral!
    near(st.pctA, 55);
  });

  it('short liquidates at 2x entry (value floored at 0)', () => {
    const st = E.computePairState(pair, base, { 'BTC-USD': 130000 }, rates);
    expect(st.valueB).toBe(0);
  });

  it('rebalance BTC -> short restores 50/50 and realizes BTC gain (no fees)', () => {
    const o = E.computeOrder(pair, base, { 'BTC-USD': 66000 }, rates, { date: '2026-07-01' });
    expect(o.noAction).toBe(false);
    expect(o.direction).toBe('A_TO_B');
    near(o.sell.quantity, 0.04545454, 1e-8); // 3000 / 66000 floored 8dp
    near(o.afterPctA, 50, 0.001);
    near(o.estRealizedTHB / 35, 0.04545454 * 6000, 0.01);
  });

  it('covering short realizes short P&L with correct sign', () => {
    const trades = base.concat([
      { seq: 3, date: '2026-07-01', portfolio: 'P', assetName: 'BTC-USD:S1X', assetType: 'Crypto Short 1x', currency: 'USD', action: 'Sell', quantity: 0.25, priceUnit: 54000, feeAmount: 0 }
    ]);
    const h = E.computeHoldings(trades, 'P')['BTC-USD:S1X'];
    near(h.realized, 0.25 * 6000);
    near(h.qty, 0.25);
  });

  it('rebalance short -> BTC when BTC falls', () => {
    const o = E.computeOrder(pair, base, { 'BTC-USD': 54000 }, rates, {});
    expect(o.direction).toBe('B_TO_A');
    near(o.afterPctA, 50, 0.001);
  });

  it('fees percent vs fixed', () => {
    near(E.feeAmount({ mode: 'percent', value: 0.1 }, 2, 1000), 2);
    near(E.feeAmount({ mode: 'fixed', value: 5 }, 2, 1000), 5);
    near(E.feeAmount({ mode: 'fixed', value: 5 }, 0, 1000), 0);
    const o = E.computeOrder(pair, base, { 'BTC-USD': 66000 }, rates, {
      fees: { A: { mode: 'percent', value: 0.1 }, B: { mode: 'fixed', value: 2 } }
    });
    expect(o.sell.feeAmount).toBeGreaterThan(0);
    expect(o.buy.feeAmount).toBe(2);
  });

  it('thai board lot rounding', () => {
    expect(E.roundQty('Thai Stock', 1299)).toBe(1200);
    expect(E.roundQty('Thai Stock', 99)).toBe(0);
    expect(E.roundQty('Global Stock', 1.23456)).toBe(1.2345);
    expect(E.roundQty('Crypto', 1.123456789)).toBe(1.12345678);
  });

  it('schedule: month-end safe and next date', () => {
    expect(E.addPeriods('2026-01-31', 'Monthly', 1)).toBe('2026-02-28');
    expect(E.addPeriods('2026-01-31', 'Monthly', 2)).toBe('2026-03-31');
    expect(E.addPeriods('2026-01-01', 'Weekly', 1)).toBe('2026-01-08');
    expect(E.nextScheduleDate('2026-07-01', '2026-09-01', 'Monthly')).toBe('2026-10-01');
    expect(E.nextScheduleDate('2026-07-01', null, 'Quarterly')).toBe('2026-07-01');
    expect(E.nextScheduleDate('2026-01-15', '2026-04-20', 'Quarterly')).toBe('2026-07-15');
  });

  it('evaluateDue modes and severity', () => {
    const st = E.computePairState(pair, base, { 'BTC-USD': 66000 }, rates); // drift 5
    expect(E.evaluateDue(pair, st, '2026-10-07').severity).toBe('due');
    expect(E.evaluateDue({ ...pair, mode: 'Manual' }, st, '2026-10-07').due).toBe(false);
    expect(
      E.evaluateDue(
        {
          ...pair,
          mode: 'Schedule',
          scheduleAnchor: '2026-07-01',
          scheduleFrequency: 'Monthly',
          lastRebalanced: '2026-09-01'
        },
        st,
        '2026-10-07'
      ).due
    ).toBe(true);
  });

  it('noAction under min drift', () => {
    const o = E.computeOrder(pair, base, { 'BTC-USD': 60100 }, rates, {});
    expect(o.noAction).toBe(true);
  });
});
