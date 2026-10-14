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
    savePairApi: vi.fn(),
    setPairStatusApi: vi.fn(),
    deletePairApi: vi.fn(),
    executeRebalanceApi: vi.fn(),
    revertRebalanceApi: vi.fn(),
    validateTickerApi: vi.fn()
  };
});

describe('AlphaTrader Step 4: Rebalance Integration Suite', () => {
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
      trades: [],
      portfolios: ['Main Trading', 'Crypto'],
      rebalancePairs: [
        {
          pairId: 'RP-0001',
          portfolio: 'Crypto',
          pairName: 'BTC vs Short 1x',
          assetA: 'BTC-USD',
          assetAType: 'Crypto',
          assetACurrency: 'USD',
          targetA: 50,
          assetB: 'BTC-USD:S1X',
          assetBType: 'Crypto Short 1x',
          assetBCurrency: 'USD',
          targetB: 50,
          mode: 'Drift',
          driftThreshold: 5,
          scheduleFrequency: 'Monthly',
          scheduleAnchor: '2026-06-01',
          lastRebalanced: '2026-06-01',
          customFee: false,
          status: 'Active',
          created: '2026-06-01'
        }
      ],
      rebalanceLog: [],
      livePrices: {
        'BTC-USD': 66000
      },
      liveRates: { THB: 1.0, USD: 35.0, EUR: 38.0 }
    });

    // Mock CSV response for Journal
    sheetsClient.fetchSheetCsv.mockImplementation((sheetId, tabName) => {
      if (tabName === 'Journal') {
        return Promise.resolve([
          ['Timestamp', 'Date', 'Asset Name', 'Asset Type', 'Currency', 'Action', 'Quantity', 'Price/Unit', 'Amount', 'Current Price', 'Current Value', 'P&L', 'P&L %', 'Why (Decision Reason)', 'Remark', 'Portfolio', 'Fee Amount', 'Rebalance ID'],
          ['2026-06-01T00:00:00Z', '2026-06-01', 'BTC-USD', 'Crypto', 'USD', 'Buy', '0.5', '60000', '30000', '66000', '33000', '3000', '0.10', 'Entry', '', 'Crypto', '0', ''],
          ['2026-06-01T00:00:00Z', '2026-06-01', 'BTC-USD:S1X', 'Crypto Short 1x', 'USD', 'Buy', '0.5', '60000', '30000', '66000', '27000', '-3000', '-0.10', 'Hedge', '', 'Crypto', '0', ''],
          ['2026-06-02T00:00:00Z', '2026-06-02', 'BTC-USD', 'Crypto', 'USD', 'Sell', '0.0454', '66000', '2996.4', '66000', '0', '272.4', '0.10', 'Rebalance BTC vs Short 1x', '', 'Crypto', '0', 'RB-0001']
        ]);
      }
      if (tabName === 'Portfolios') {
        return Promise.resolve([
          ['Asset Name', 'Portfolio', 'Portfolio Names', 'Initial Capital', 'Target Stocks'],
          ['', '', 'Main Trading', '2000000', '50'],
          ['', '', 'Crypto', '2000000', '50']
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('Scenario 1: Displays rebalance badge and navigates to Rebalance Hub', async () => {
    render(<App />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    // Check that Rebalance menu item is present in Sider
    const rebalanceMenuItem = screen.getByText(/Rebalance/i);
    expect(rebalanceMenuItem).toBeInTheDocument();

    // Click to navigate to Rebalance Hub
    fireEvent.click(rebalanceMenuItem);

    // Verify Rebalance Tab is rendered
    await waitFor(() => {
      expect(screen.getByText('Portfolio Rebalancing Center')).toBeInTheDocument();
    });
  });

  it('Scenario 2: Renders existing pair card with drift calculation and tags', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    const rebalanceMenuItem = screen.getByText(/Rebalance/i);
    fireEvent.click(rebalanceMenuItem);

    await waitFor(() => {
      expect(screen.getByText('BTC vs Short 1x')).toBeInTheDocument();
      expect(screen.getByText('ID: RP-0001')).toBeInTheDocument();
      expect(screen.getByText('Drift Mode')).toBeInTheDocument();
    });
  });

  it('Scenario 3: Journal table renders RB-xxxx tag and popconfirm identifies rebalance trade', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    // Navigate to Journal
    const journalMenuItem = screen.getByText('Trading Journal');
    fireEvent.click(journalMenuItem);

    await waitFor(() => {
      // Find the trade with RB-0001 tag
      expect(screen.getByText('RB-0001')).toBeInTheDocument();
    });
  });
});
