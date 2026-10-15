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
    validateTickerApi: vi.fn()
  };
});

describe('AlphaTrader Step 5: Cash Ledger & Income Integration Suite', () => {
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

    sheetsClient.fetchLiveData.mockResolvedValue({
      trades: [
        {
          id: 'TR-0001',
          date: '2026-06-05',
          assetName: 'PTT.BK',
          assetType: 'Thai Stock',
          currency: 'THB',
          action: 'Buy',
          quantity: 100,
          priceUnit: 34,
          feeAmount: 10,
          portfolio: 'Main Trading',
          fxToThb: 1
        }
      ],
      portfolios: ['Main Trading'],
      rebalancePairs: [],
      rebalanceLog: [],
      cashLedger: [
        {
          entryId: 'CL-0001',
          date: '2026-06-01',
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
          date: '2026-06-15',
          portfolio: 'Main Trading',
          kind: 'Dividend',
          asset: 'PTT.BK',
          currency: 'THB',
          gross: 1000,
          withholdingTax: 100,
          net: 900,
          fxToThb: 1,
          note: 'H1 2026 dividend'
        }
      ],
      livePrices: {
        'PTT.BK': 36
      },
      liveRates: { THB: 1.0, USD: 35.0, EUR: 38.0 }
    });

    sheetsClient.fetchSheetCsv.mockImplementation((sheetId, tabName) => {
      if (tabName === 'Journal') {
        return Promise.resolve([
          ['Timestamp', 'Date', 'Asset Name', 'Asset Type', 'Currency', 'Action', 'Quantity', 'Price/Unit', 'Amount', 'Current Price', 'Current Value', 'P&L', 'P&L %', 'Why (Decision Reason)', 'Remark', 'Portfolio', 'Fee Amount', 'Rebalance ID', 'FX To THB'],
          ['2026-06-05T00:00:00Z', '2026-06-05', 'PTT.BK', 'Thai Stock', 'THB', 'Buy', '100', '34', '3400', '36', '3600', '200', '0.05', 'Fundamental', '', 'Main Trading', '10', '', '1']
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
          ['CL-0001', '2026-06-01', 'Main Trading', 'Deposit', '', 'THB', '100000', '0', '100000', '1', 'Opening capital', '2026-06-01'],
          ['CL-0002', '2026-06-15', 'Main Trading', 'Dividend', 'PTT.BK', 'THB', '1000', '100', '900', '1', 'H1 2026 dividend', '2026-06-15']
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('renders Cash & Income menu and switches to Cash tab', async () => {
    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    // Click Cash & Income in navigation
    const cashNavItem = screen.getByText('Cash & Income');
    expect(cashNavItem).toBeInTheDocument();
    fireEvent.click(cashNavItem);

    // Verify Cash tab content is displayed
    await waitFor(() => {
      expect(screen.getByText('Record Cash Entry')).toBeInTheDocument();
    });

    // Check KPI cards & Statement Table entries (wait for async fetch to finish)
    await waitFor(() => {
      expect(screen.getAllByText(/CASH ON HAND/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/NET DEPOSITS/i)).toBeInTheDocument();
      expect(screen.getByText(/DIVIDENDS YTD/i)).toBeInTheDocument();
      expect(screen.getByText('Opening capital')).toBeInTheDocument();
      expect(screen.getByText('H1 2026 dividend')).toBeInTheDocument();
    });
  });

  it('opens CashEntryModal when Record Cash Entry button is clicked', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    const cashNavItem = screen.getByText('Cash & Income');
    fireEvent.click(cashNavItem);

    await waitFor(() => {
      expect(screen.getByText('Record Cash Entry')).toBeInTheDocument();
    });

    const recordBtn = screen.getByText('Record Cash Entry');
    fireEvent.click(recordBtn);

    // Verify modal appears
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('New Cash / Income Entry')).toBeInTheDocument();
    });
  });
});
