import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import {
  hasDeposit,
  getCashFlowForEntry,
  getCashFlowForTrade,
  computeCashBalance,
  computeCashLedgerStatement,
  computeCashKpis,
  calculateDefaultWht
} from '../cashEngine.js';

describe('cashEngine unit tests', () => {
  it('detects deposit correctly per portfolio and across All Portfolios', () => {
    const entries = [
      { entryId: 'CL-0001', portfolio: 'Main Trading', kind: 'Deposit', net: 100000 },
      { entryId: 'CL-0002', portfolio: 'Crypto', kind: 'Dividend', net: 500 }
    ];

    expect(hasDeposit('Main Trading', entries)).toBe(true);
    expect(hasDeposit('Crypto', entries)).toBe(false);
    expect(hasDeposit('All Portfolios', entries)).toBe(true);
    expect(hasDeposit('BTC Stock', entries)).toBe(false);
    expect(hasDeposit('Main Trading', [])).toBe(false);
  });

  it('calculates cash flows for various entry types including foreign currency', () => {
    const liveRates = { USD: 35.0, THB: 1.0 };

    const depositTHB = { kind: 'Deposit', currency: 'THB', gross: 50000, withholdingTax: 0, net: 50000 };
    expect(getCashFlowForEntry(depositTHB, liveRates, 'THB')).toBe(50000);

    const withdrawUSD = { kind: 'Withdraw', currency: 'USD', gross: 100, withholdingTax: 0, net: 100, fxToThb: 36.0 };
    // 100 * 36.0 = 3600 THB
    expect(getCashFlowForEntry(withdrawUSD, liveRates, 'THB')).toBe(-3600);

    const dividendThai = { kind: 'Dividend', currency: 'THB', gross: 1000, withholdingTax: 100, net: 900 };
    expect(getCashFlowForEntry(dividendThai, liveRates, 'THB')).toBe(900);

    const fee = { kind: 'Fee', currency: 'THB', net: 50 };
    expect(getCashFlowForEntry(fee, liveRates, 'THB')).toBe(-50);
  });

  it('calculates cash flows for trades (Buy reduces cash, Sell increases cash)', () => {
    const liveRates = { USD: 35.0, THB: 1.0 };

    const buyTrade = {
      action: 'Buy',
      quantity: 100,
      priceUnit: 50,
      feeAmount: 15,
      currency: 'THB'
    };
    // Spent = 100 * 50 + 15 = 5015 THB
    expect(getCashFlowForTrade(buyTrade, liveRates, 'THB')).toBe(-5015);

    const sellTrade = {
      action: 'Sell',
      quantity: 10,
      priceUnit: 100,
      feeAmount: 2,
      currency: 'USD',
      fxToThb: 35.0
    };
    // Received = 10 * 100 - 2 = 998 USD * 35 = 34930 THB
    expect(getCashFlowForTrade(sellTrade, liveRates, 'THB')).toBe(34930);
  });

  it('falls back to legacy cashOnHand when no deposit has been logged', () => {
    const res = computeCashBalance({
      portfolio: 'Main Trading',
      cashEntries: [],
      trades: [],
      fallbackCashOnHand: 1500000
    });
    expect(res.hasDeposit).toBe(false);
    expect(res.isFallback).toBe(true);
    expect(res.cashBalance).toBe(1500000);
  });

  it('computes exact cash balance according to manual calculation', () => {
    // Scenario:
    // Deposit: 100,000 THB
    // Buy: 100 shares @ 100 THB + 10 THB fee = -10,010 THB
    // Dividend: Gross 500, WHT 50, Net 450 THB = +450 THB
    // Sell: 50 shares @ 120 THB - 10 THB fee = 6,000 - 10 = +5,990 THB
    // Withdraw: 20,000 THB = -20,000 THB
    // Expected Cash Balance = 100,000 - 10,010 + 450 + 5,990 - 20,000 = 76,430 THB
    const cashEntries = [
      { entryId: 'CL-1', portfolio: 'Main Trading', date: '2026-01-01', kind: 'Deposit', net: 100000, currency: 'THB' },
      { entryId: 'CL-2', portfolio: 'Main Trading', date: '2026-01-10', kind: 'Dividend', gross: 500, withholdingTax: 50, net: 450, currency: 'THB' },
      { entryId: 'CL-3', portfolio: 'Main Trading', date: '2026-01-20', kind: 'Withdraw', net: 20000, currency: 'THB' }
    ];

    const trades = [
      { id: '1', portfolio: 'Main Trading', date: '2026-01-05', action: 'Buy', quantity: 100, priceUnit: 100, feeAmount: 10, currency: 'THB' },
      { id: '2', portfolio: 'Main Trading', date: '2026-01-15', action: 'Sell', quantity: 50, priceUnit: 120, feeAmount: 10, currency: 'THB' }
    ];

    const res = computeCashBalance({
      portfolio: 'Main Trading',
      cashEntries,
      trades,
      liveRates: { THB: 1.0 },
      displayCurrency: 'THB'
    });

    expect(res.hasDeposit).toBe(true);
    expect(res.isFallback).toBe(false);
    expect(res.cashBalance).toBe(76430);
  });

  it('generates chronological statement with accurate running balance', () => {
    const cashEntries = [
      { entryId: 'CL-1', portfolio: 'Port A', date: '2026-01-01', kind: 'Deposit', net: 50000, currency: 'THB' },
      { entryId: 'CL-2', portfolio: 'Port A', date: '2026-01-10', kind: 'Fee', net: 100, currency: 'THB' }
    ];
    const trades = [
      { id: '1', portfolio: 'Port A', date: '2026-01-05', action: 'Buy', assetName: 'BJC', quantity: 100, priceUnit: 25, feeAmount: 5, currency: 'THB' }
    ];

    const statement = computeCashLedgerStatement({
      portfolio: 'Port A',
      cashEntries,
      trades,
      liveRates: { THB: 1.0 },
      displayCurrency: 'THB'
    });

    expect(statement).toHaveLength(3);
    // Row 1: Deposit 50,000 -> Running: 50,000
    expect(statement[0].id).toBe('CL-1');
    expect(statement[0].flowConverted).toBe(50000);
    expect(statement[0].runningBalance).toBe(50000);

    // Row 2: Trade Buy 100*25 + 5 = 2505 -> Running: 47,495
    expect(statement[1].id).toBe('trade-1');
    expect(statement[1].flowConverted).toBe(-2505);
    expect(statement[1].runningBalance).toBe(47495);

    // Row 3: Fee 100 -> Running: 47,395
    expect(statement[2].id).toBe('CL-2');
    expect(statement[2].flowConverted).toBe(-100);
    expect(statement[2].runningBalance).toBe(47395);
  });

  it('computes KPIs correctly including Total Return and YTD dividends', () => {
    const currentYear = dayjs().year();
    const cashEntries = [
      { entryId: 'CL-1', portfolio: 'Port A', date: `${currentYear}-02-01`, kind: 'Deposit', net: 100000, currency: 'THB' },
      { entryId: 'CL-2', portfolio: 'Port A', date: `${currentYear}-03-01`, kind: 'Withdraw', net: 10000, currency: 'THB' },
      { entryId: 'CL-3', portfolio: 'Port A', date: `${currentYear}-04-01`, kind: 'Dividend', net: 2500, currency: 'THB' },
      { entryId: 'CL-4', portfolio: 'Port A', date: `${currentYear - 1}-05-01`, kind: 'Dividend', net: 1000, currency: 'THB' }, // Previous year
      { entryId: 'CL-5', portfolio: 'Port A', date: `${currentYear}-06-01`, kind: 'Interest', net: 300, currency: 'THB' },
      { entryId: 'CL-6', portfolio: 'Port A', date: `${currentYear}-07-01`, kind: 'Fee', net: 200, currency: 'THB' }
    ];

    const kpis = computeCashKpis({
      portfolio: 'Port A',
      cashEntries,
      trades: [],
      liveRates: { THB: 1.0 },
      displayCurrency: 'THB',
      realizedPnLConverted: 15000,
      unrealizedPnLConverted: 5000
    });

    expect(kpis.netDeposits).toBe(90000); // 100,000 - 10,000
    expect(kpis.dividendsYTD).toBe(2500);
    expect(kpis.totalDividendsEver).toBe(3500); // 2500 + 1000
    expect(kpis.interestYTD).toBe(300);
    expect(kpis.totalInterestEver).toBe(300);
    expect(kpis.totalLedgerFees).toBe(200);

    // Total return = Realized (15000) + Unrealized (5000) + Total Dividends (3500) + Interest (300) - Ledger Fees (200)
    // = 23,600 THB
    expect(kpis.totalReturn).toBe(23600);
  });

  it('suggests 10% withholding tax for Thai Stock and THB dividends', () => {
    expect(calculateDefaultWht(1000, 'Thai Stock', 'THB')).toBe(100);
    expect(calculateDefaultWht(500, 'Thai Stock', 'USD')).toBe(50);
    expect(calculateDefaultWht(2000, 'Global Stock', 'THB')).toBe(200);
    expect(calculateDefaultWht(1000, 'Global Stock', 'USD')).toBe(0);
  });
});
