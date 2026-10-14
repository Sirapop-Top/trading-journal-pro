import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';
import * as sheetsClient from './api/sheetsClient';

vi.mock('./api/sheetsClient', async () => {
  const actual = await vi.importActual('./api/sheetsClient');
  return {
    ...actual,
    fetchSheetCsv: vi.fn(),
    fetchExchangeRates: vi.fn(),
    fetchLiveData: vi.fn(),
    addCashEntryApi: vi.fn(),
    editCashEntryApi: vi.fn(),
    deleteCashEntryApi: vi.fn(),
    validateTickerApi: vi.fn(),
    fetchHistoryApi: vi.fn(),
    addTradesBatchApi: vi.fn()
  };
});

describe('AlphaTrader Step 6: Analytics, Heatmap, Tax Report & CSV Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    localStorage.setItem('google_sheet_id', 'mock-sheet-id');
    localStorage.setItem('google_apps_script_url', 'https://mock.script.url');

    sheetsClient.fetchExchangeRates.mockResolvedValue({
      THB: 1.0,
      USD: 35.0,
      EUR: 38.0
    });

    sheetsClient.fetchHistoryApi.mockResolvedValue({
      '^SET.BK': {
        timestamps: ['2026-01-01', '2026-06-01'],
        closes: [1400, 1450]
      }
    });

    sheetsClient.fetchLiveData.mockResolvedValue({
      trades: [
        {
          id: 'TR-0001',
          date: '2026-02-10',
          assetName: 'PTT.BK',
          assetType: 'Thai Stock',
          currency: 'THB',
          action: 'Buy',
          quantity: 100,
          priceUnit: 30,
          feeAmount: 10,
          portfolio: 'Main Trading',
          why: 'Breakout',
          fxToThb: 1
        },
        {
          id: 'TR-0002',
          date: '2026-05-15',
          assetName: 'PTT.BK',
          assetType: 'Thai Stock',
          currency: 'THB',
          action: 'Sell',
          quantity: 100,
          priceUnit: 35,
          feeAmount: 10,
          portfolio: 'Main Trading',
          why: 'Breakout',
          fxToThb: 1
        }
      ],
      portfolios: ['Main Trading'],
      rebalancePairs: [],
      rebalanceLog: [],
      cashLedger: [
        {
          entryId: 'CL-0001',
          date: '2026-01-01',
          portfolio: 'Main Trading',
          kind: 'Deposit',
          asset: '',
          currency: 'THB',
          gross: 100000,
          withholdingTax: 0,
          net: 100000,
          fxToThb: 1,
          note: 'Opening capital'
        },
        {
          entryId: 'CL-0002',
          date: '2026-04-10',
          portfolio: 'Main Trading',
          kind: 'Dividend',
          asset: 'PTT.BK',
          currency: 'THB',
          gross: 2000,
          withholdingTax: 200,
          net: 1800,
          fxToThb: 1,
          note: 'Q1 Dividend'
        }
      ],
      livePrices: {
        'PTT.BK': 35
      },
      liveRates: { THB: 1.0, USD: 35.0, EUR: 38.0 }
    });

    sheetsClient.fetchSheetCsv.mockImplementation((sheetId, tabName) => {
      if (tabName === 'Journal') {
        return Promise.resolve([
          ['Timestamp', 'Date', 'Asset Name', 'Asset Type', 'Currency', 'Action', 'Quantity', 'Price/Unit', 'Amount', 'Current Price', 'Current Value', 'P&L', 'P&L %', 'Why (Decision Reason)', 'Remark', 'Portfolio', 'Fee Amount', 'Rebalance ID', 'FX To THB'],
          ['2026-02-10T00:00:00Z', '2026-02-10', 'PTT.BK', 'Thai Stock', 'THB', 'Buy', '100', '30', '3000', '35', '3500', '500', '0.16', 'Breakout', '', 'Main Trading', '10', '', '1'],
          ['2026-05-15T00:00:00Z', '2026-05-15', 'PTT.BK', 'Thai Stock', 'THB', 'Sell', '100', '35', '3500', '35', '3500', '480', '0.16', 'Breakout', '', 'Main Trading', '10', '', '1']
        ]);
      }
      if (tabName === 'Portfolios') {
        return Promise.resolve([
          ['Asset Name', 'Portfolio', 'Portfolio Names', 'Initial Capital', 'Target Stocks'],
          ['', '', 'Main Trading', '100000', '10']
        ]);
      }
      if (tabName === 'Cash_Ledger') {
        return Promise.resolve([
          ['Entry ID', 'Entry Date', 'Portfolio', 'Kind', 'Asset', 'Currency', 'Gross', 'Withholding Tax', 'Net', 'FX To THB', 'Note', 'Created'],
          ['CL-0001', '2026-01-01', 'Main Trading', 'Deposit', '', 'THB', '100000', '0', '100000', '1', 'Opening capital', '2026-01-01'],
          ['CL-0002', '2026-04-10', 'Main Trading', 'Dividend', 'PTT.BK', 'THB', '2000', '200', '1800', '1', 'Q1 Dividend', '2026-04-10']
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('navigates to Analytics & Reports tab and renders sub-views', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    // Check Header Date Range options exist
    expect(screen.getByText('All Time')).toBeInTheDocument();
    expect(screen.getByText(/Period:/i)).toBeInTheDocument();

    // Click Analytics & Reports in navigation
    const analyticsNav = screen.getByText('Analytics & Reports');
    expect(analyticsNav).toBeInTheDocument();
    fireEvent.click(analyticsNav);

    // Verify Analytics view
    await waitFor(() => {
      expect(screen.getByText('Portfolio Analytics & Reports')).toBeInTheDocument();
    });

    // Verify all four core analytical cards are rendered
    expect(screen.getByText('Portfolio NAV & Underwater Drawdown Analysis')).toBeInTheDocument();
    expect(screen.getByText('Monthly Performance Heatmap')).toBeInTheDocument();
    expect(screen.getByText('Strategy Win Rate & Expectancy Analytics')).toBeInTheDocument();
    expect(screen.getByText('Annual Tax Filing Report')).toBeInTheDocument();
    expect(screen.getByText('Export CSV (BOM)')).toBeInTheDocument();
  });

  it('opens and closes CSV Import Modal from Trading Journal', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    // Navigate to Trading Journal
    const journalNav = screen.getByText('Trading Journal');
    fireEvent.click(journalNav);

    await waitFor(() => {
      expect(screen.getByText('Import CSV')).toBeInTheDocument();
    });

    // Click Import CSV
    fireEvent.click(screen.getByText('Import CSV'));

    // Verify modal is open
    await waitFor(() => {
      expect(screen.getByText('Import Trades from CSV')).toBeInTheDocument();
      expect(screen.getByText('Upload CSV')).toBeInTheDocument();
      expect(screen.getByText('Click or drag CSV file to this area to import')).toBeInTheDocument();
    });

    // Close modal
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Import Trades from CSV')).not.toBeInTheDocument();
    });
  });
});
