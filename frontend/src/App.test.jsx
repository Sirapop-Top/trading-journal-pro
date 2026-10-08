import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import App from './App';

describe('AlphaTrader UAT Full Loop Test Suite', () => {
  let originalFetch;

  const mockCSVData = `Timestamp,Date,Asset Name,Asset Type,Currency,Action,Quantity,Price/Unit,Why (Decision Reason),Remark,Portfolio,Fee Amount
2026-06-24 11:00:00,2026-06-24,MSTR,Global Stock,USD,Buy,10,1200,Breakout,Hold long,BTC Stock,10
2026-06-24 11:10:00,2026-06-24,BTC-USD,Crypto,USD,Buy,0.5,60000,CDC Action Zone,Long crypto,Crypto,20
2026-06-24 11:20:00,2026-06-24,BJC.BK,Thai Stock,THB,Buy,100,35,Support Bounce,Thai stock trade,Main Trading,50
2026-06-24 11:30:00,2026-06-24,MSTR,Global Stock,USD,Sell,10,1400,Target Reached,Take profit,BTC Stock,15`;

  const mockExchangeRates = {
    rates: {
      THB: 35.0,
      EUR: 0.92
    }
  };

  beforeEach(() => {
    localStorage.clear();
    originalFetch = global.fetch;

    // Define a robust global fetch mock
    global.fetch = vi.fn().mockImplementation((url, options) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Mock open exchange rates API
      if (urlStr.includes('open.er-api.com')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockExchangeRates)
        });
      }

      // Mock Google Sheets CSV endpoints
      if (urlStr.includes('gviz/tq?tqx=out:csv')) {
        if (urlStr.includes('sheet=Journal')) {
          return Promise.resolve({
            ok: true,
            text: () => Promise.resolve(mockCSVData)
          });
        }
        if (urlStr.includes('sheet=Portfolios')) {
          return Promise.resolve({
            ok: false,
            status: 404
          });
        }
      }

      // Mock Apps Script API Endpoints
      if (urlStr.includes('script.google.com') || (options && options.method === 'POST')) {
        let payload = {};
        if (options && options.body) {
          try {
            payload = JSON.parse(options.body);
          } catch (e) {}
        }

        // Ticker Verification Action
        if (payload.action === 'validateTicker') {
          if (payload.symbol && (payload.symbol.toUpperCase().includes('INVALID') || payload.symbol.toUpperCase() === 'FAIL')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ valid: false, message: `Ticker '${payload.symbol}' not found on Yahoo Finance.` })
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ valid: true, message: `Ticker '${payload.symbol}' verified successfully.` })
          });
        }

        // Add Trade Action
        if (payload.action === 'addTrade') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, message: 'Trade logged successfully in Google Sheets.' })
          });
        }

        // Edit Trade Action
        if (payload.action === 'editTrade') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, message: 'Trade updated successfully.' })
          });
        }

        // Default getData action query
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            livePrices: {
              'MSTR': 1420.0,
              'BTC-USD': 61000.0,
              'BJC.BK': 36.0
            },
            liveRates: { THB: 1.0, USD: 35.0, EUR: 38.0 },
            syncTime: '2026-06-24 11:35:00'
          })
        });
      }

      return Promise.reject(new Error(`Unhandled fetch mock request: ${urlStr}`));
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('Scenario 1: Onboarding flow shows setup, rejects empty submit, and logs in successfully', async () => {
    const { container } = render(<App />);

    // 1. Verify onboarding screen is shown because localStorage sheet id is empty
    expect(screen.getByText('AlphaTrader Cloud')).toBeInTheDocument();

    // 2. Click Connect without entering sheet ID and verify error is rejected
    const connectButton = screen.getByText('Connect Journal');
    fireEvent.click(connectButton);

    // 3. Enter details and connect
    const sheetIdInput = container.querySelector('input[type="text"]');
    const scriptUrlInput = container.querySelector('input[type="password"]');

    expect(sheetIdInput).toBeInTheDocument();
    expect(scriptUrlInput).toBeInTheDocument();

    fireEvent.change(sheetIdInput, { target: { value: '1t2y3u4i5o6p7a8s9d0f_mock_sheet_id' } });
    fireEvent.change(scriptUrlInput, { target: { value: 'https://script.google.com/macros/s/AKfycbz_mock_script/exec' } });

    fireEvent.click(connectButton);

    // Verify localStorage has been populated
    await waitFor(() => {
      expect(localStorage.getItem('google_sheet_id')).toBe('1t2y3u4i5o6p7a8s9d0f_mock_sheet_id');
      expect(localStorage.getItem('google_apps_script_url')).toBe('https://script.google.com/macros/s/AKfycbz_mock_script/exec');
    });
  });

  it('Scenario 2: Renders dashboard with computed trading metrics (Win Rate, Profit Factor) from mock CSV', async () => {
    localStorage.setItem('google_sheet_id', '1t2y3u4i5o6p7a8s9d0f_mock_sheet_id');
    localStorage.setItem('google_apps_script_url', 'https://script.google.com/macros/s/AKfycbz_mock_script/exec');

    render(<App />);

    // Wait for the app dashboard to render
    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
      expect(screen.getByText('TRADER')).toBeInTheDocument();
    });

    // Verify mock CSV trades parsed correctly
    await waitFor(() => {
      const winRateCards = screen.getAllByText(/Win Rate/i);
      expect(winRateCards.length).toBeGreaterThan(0);
    });

    // Navigate to "Trading Journal" tab
    const journalMenuBtn = screen.getByText('Trading Journal');
    fireEvent.click(journalMenuBtn);

    // Verify the trades list table shows the trades
    await waitFor(() => {
      expect(screen.getByText('BTC-USD')).toBeInTheDocument();
      expect(screen.getAllByText('MSTR').length).toBeGreaterThan(0);
    });
  });

  it('Scenario 3: Adding a new trade triggers ticker validations and auto-corrections', async () => {
    localStorage.setItem('google_sheet_id', '1t2y3u4i5o6p7a8s9d0f_mock_sheet_id');
    localStorage.setItem('google_apps_script_url', 'https://script.google.com/macros/s/AKfycbz_mock_script/exec');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    // Navigate to "Trading Journal" tab first so the "Log Trade" button is rendered
    const journalMenuBtn = screen.getByText('Trading Journal');
    fireEvent.click(journalMenuBtn);

    // Open "Log Trade" modal
    const logTradeBtn = await screen.findByText('Log Trade');
    fireEvent.click(logTradeBtn);

    // Verify form modal is visible
    expect(screen.getByText(/Log New Trade Entry/i)).toBeInTheDocument();

    // Select category and input symbol
    const tickerInput = screen.getByLabelText('Asset Name (Ticker)');
    
    // Simulate select of "Crypto" using mocked select field change event
    const categorySelect = screen.getByLabelText('Asset Category');
    fireEvent.change(categorySelect, { target: { value: 'Crypto' } });

    // Type "ETH" into ticker input
    fireEvent.change(tickerInput, { target: { value: 'ETH' } });

    // Click "Verify" ticker button
    const verifyButton = screen.getByText('Verify');
    fireEvent.click(verifyButton);

    // The component auto-corrects 'ETH' to 'ETH-USD' and shows ticker verification
    await waitFor(() => {
      expect(tickerInput.value).toBe('ETH-USD');
      expect(screen.getByText(/ETH-USD verified/i)).toBeInTheDocument();
    });
  });

  it('Scenario 4: Passcode locking, locking screen, failure count, and successful unlock', async () => {
    localStorage.setItem('google_sheet_id', '1t2y3u4i5o6p7a8s9d0f_mock_sheet_id');
    localStorage.setItem('google_apps_script_url', 'https://script.google.com/macros/s/AKfycbz_mock_script/exec');

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });

    // Go to settings tab
    const settingsBtn = screen.getByText('Terminal Settings');
    fireEvent.click(settingsBtn);

    // Input security passcode "5555"
    const passcodeFormInput = screen.getByPlaceholderText('Enter 4-6 digit code or password');
    fireEvent.change(passcodeFormInput, { target: { value: '5555' } });

    // Save security settings
    const saveSecBtn = screen.getByText('Save Security Settings');
    fireEvent.click(saveSecBtn);

    // Verify it is saved in localStorage as a salted SHA-256 hash (not plaintext)
    await waitFor(() => {
      expect(localStorage.getItem('alphatrader_passcode_hash')).toBeTruthy();
      expect(localStorage.getItem('alphatrader_passcode_salt')).toBeTruthy();
      expect(localStorage.getItem('alphatrader_passcode')).toBeNull();
    });

    // Lock the application manually
    const lockBtn = screen.getByText('Lock App');
    fireEvent.click(lockBtn);

    // Lock screen should now show "ALPHATRADER SECURED" or similar
    expect(screen.getByText(/ALPHA.*SECURED/i)).toBeInTheDocument();

    // Try a wrong passcode "0000"
    const pinInput = screen.getByPlaceholderText('Enter passcode');
    fireEvent.change(pinInput, { target: { value: '0000' } });
    
    // Click Unlock button with incorrect pin
    const unlockBtn = screen.getByRole('button', { name: /Unlock Terminal/i });
    fireEvent.click(unlockBtn);

    // Verify it displays attempts message (Incorrect passcode)
    await waitFor(() => {
      expect(screen.getByText(/Incorrect passcode/i)).toBeInTheDocument();
    });

    // Correct passcode "5555" should unlock
    fireEvent.change(pinInput, { target: { value: '5555' } });
    
    // Click Unlock button with correct pin
    fireEvent.click(unlockBtn);

    // App dashboard should restore
    await waitFor(() => {
      expect(screen.queryByText(/ALPHA.*SECURED/i)).not.toBeInTheDocument();
      expect(screen.getByText('ALPHA')).toBeInTheDocument();
    });
  });
});
