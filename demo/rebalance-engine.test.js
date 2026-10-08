// Quick sanity tests for demo/rebalance-engine.js — run: node demo/rebalance-engine.test.js
const E = require('./rebalance-engine.js');
const assert = require('assert');
let n = 0;
const near = (a, b, tol = 1e-6, msg = '') => { assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b} got ${a}`); };
const t = (name, fn) => { fn(); n++; console.log('✓', name); };

const rates = { THB: 1, USD: 35 };
const base = [
  { seq: 1, date: '2026-06-01', portfolio: 'P', assetName: 'BTC-USD', assetType: 'Crypto', currency: 'USD', action: 'Buy', quantity: 0.5, priceUnit: 60000, feeAmount: 0 },
  { seq: 2, date: '2026-06-01', portfolio: 'P', assetName: 'BTC-USD:S1X', assetType: 'Crypto Short 1x', currency: 'USD', action: 'Buy', quantity: 0.5, priceUnit: 60000, feeAmount: 0 },
];
const pair = { portfolio: 'P', assetA: 'BTC-USD', assetAType: 'Crypto', assetACurrency: 'USD', assetB: 'BTC-USD:S1X', assetBType: 'Crypto Short 1x', assetBCurrency: 'USD', targetA: 50, mode: 'Drift', driftThreshold: 5, status: 'Active' };

t('short 1x valuation = 2*entry - price', () => {
  const st = E.computePairState(pair, base, { 'BTC-USD': 66000 }, rates);
  near(st.valueA / 35, 33000); near(st.valueB / 35, 27000); near(st.total / 35, 60000); // delta neutral
  near(st.pctA, 55);
});

t('short liquidates at 2x entry (value floored at 0)', () => {
  const st = E.computePairState(pair, base, { 'BTC-USD': 130000 }, rates);
  near(st.valueB, 0);
});

t('rebalance BTC→short restores 50/50 and realizes BTC gain (no fees)', () => {
  const o = E.computeOrder(pair, base, { 'BTC-USD': 66000 }, rates, { date: '2026-07-01' });
  assert.strictEqual(o.noAction, false);
  assert.strictEqual(o.direction, 'A_TO_B');
  near(o.sell.quantity, 0.04545454, 1e-8); // 3000 / 66000 floored 8dp
  near(o.afterPctA, 50, 0.001);
  near(o.estRealizedTHB / 35, 0.04545454 * 6000, 0.01);
});

t('covering short realizes short P&L with correct sign', () => {
  const trades = base.concat([{ seq: 3, date: '2026-07-01', portfolio: 'P', assetName: 'BTC-USD:S1X', assetType: 'Crypto Short 1x', currency: 'USD', action: 'Sell', quantity: 0.25, priceUnit: 54000, feeAmount: 0 }]);
  const h = E.computeHoldings(trades, 'P')['BTC-USD:S1X'];
  near(h.realized, 0.25 * 6000); near(h.qty, 0.25);
});

t('rebalance short→BTC when BTC falls', () => {
  const o = E.computeOrder(pair, base, { 'BTC-USD': 54000 }, rates, {});
  assert.strictEqual(o.direction, 'B_TO_A');
  near(o.afterPctA, 50, 0.001);
});

t('fees percent vs fixed', () => {
  near(E.feeAmount({ mode: 'percent', value: 0.1 }, 2, 1000), 2);
  near(E.feeAmount({ mode: 'fixed', value: 5 }, 2, 1000), 5);
  near(E.feeAmount({ mode: 'fixed', value: 5 }, 0, 1000), 0);
  const o = E.computeOrder(pair, base, { 'BTC-USD': 66000 }, rates, { fees: { A: { mode: 'percent', value: 0.1 }, B: { mode: 'fixed', value: 2 } } });
  assert.ok(o.sell.feeAmount > 0 && o.buy.feeAmount === 2);
});

t('thai board lot rounding', () => {
  assert.strictEqual(E.roundQty('Thai Stock', 1299), 1200);
  assert.strictEqual(E.roundQty('Thai Stock', 99), 0);
  assert.strictEqual(E.roundQty('Global Stock', 1.23456), 1.2345);
});

t('schedule: month-end safe and next date', () => {
  assert.strictEqual(E.addPeriods('2026-01-31', 'Monthly', 1), '2026-02-28');
  assert.strictEqual(E.addPeriods('2026-01-31', 'Monthly', 2), '2026-03-31');
  assert.strictEqual(E.addPeriods('2026-01-01', 'Weekly', 1), '2026-01-08');
  assert.strictEqual(E.nextScheduleDate('2026-07-01', '2026-09-01', 'Monthly'), '2026-10-01');
  assert.strictEqual(E.nextScheduleDate('2026-07-01', null, 'Quarterly'), '2026-07-01');
  assert.strictEqual(E.nextScheduleDate('2026-01-15', '2026-04-20', 'Quarterly'), '2026-07-15');
});

t('evaluateDue modes', () => {
  const st = E.computePairState(pair, base, { 'BTC-USD': 66000 }, rates); // drift 5
  assert.strictEqual(E.evaluateDue(pair, st, '2026-10-07').severity, 'due');
  assert.strictEqual(E.evaluateDue(Object.assign({}, pair, { mode: 'Manual' }), st, '2026-10-07').due, false);
  assert.strictEqual(E.evaluateDue(Object.assign({}, pair, { mode: 'Schedule', scheduleAnchor: '2026-07-01', scheduleFrequency: 'Monthly', lastRebalanced: '2026-09-01' }), st, '2026-10-07').due, true);
});

t('noAction under min drift', () => {
  const o = E.computeOrder(pair, base, { 'BTC-USD': 60100 }, rates, {});
  assert.strictEqual(o.noAction, true);
});

console.log(`\n${n} tests passed`);
