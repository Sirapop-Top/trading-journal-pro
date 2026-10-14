import { describe, it, expect } from 'vitest';
import {
  exportToCsv,
  parseCsvText,
  detectCsvMapping,
  findDuplicateTrades,
  generateTaxReport
} from '../csvHelper.js';

describe('CSV Helper Test Suite (Step 6)', () => {
  describe('exportToCsv', () => {
    it('prepends UTF-8 BOM and escapes commas/quotes', () => {
      const headers = ['Date', 'Asset Name', 'Remark'];
      const rows = [
        { Date: '2026-06-01', 'Asset Name': 'PTT.BK', Remark: 'Bought, with "high" volume' }
      ];

      const csv = exportToCsv('test', headers, rows);
      expect(csv.charCodeAt(0)).toBe(0xFEFF); // UTF-8 BOM
      expect(csv).toContain('"Bought, with ""high"" volume"');
    });
  });

  describe('parseCsvText', () => {
    it('correctly parses CSV text with BOM and quotes', () => {
      const raw = '\uFEFFDate,Asset Name,Price\r\n2026-06-01,PTT.BK,34.5\r\n2026-06-02,"BTC, Crypto",60000';
      const parsed = parseCsvText(raw);

      expect(parsed.headers).toEqual(['Date', 'Asset Name', 'Price']);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[1]['Asset Name']).toBe('BTC, Crypto');
      expect(parsed.rows[1]['Price']).toBe('60000');
    });
  });

  describe('detectCsvMapping', () => {
    it('auto-detects English and Thai column headers', () => {
      const headers = ['วันที่', 'Symbol', 'Side', 'Qty', 'Unit Price', 'Fee', 'กลยุทธ์'];
      const mapping = detectCsvMapping(headers);

      expect(mapping.date).toBe('วันที่');
      expect(mapping.assetName).toBe('Symbol');
      expect(mapping.action).toBe('Side');
      expect(mapping.quantity).toBe('Qty');
      expect(mapping.priceUnit).toBe('Unit Price');
      expect(mapping.feeAmount).toBe('Fee');
      expect(mapping.why).toBe('กลยุทธ์');
    });
  });

  describe('findDuplicateTrades', () => {
    it('identifies duplicates using trade signature', () => {
      const existing = [
        { date: '2026-06-01', assetName: 'PTT.BK', action: 'Buy', quantity: 100, priceUnit: 34 }
      ];

      const candidates = [
        { date: '2026-06-01', assetName: 'PTT.BK', action: 'Buy', quantity: 100, priceUnit: 34 },
        { date: '2026-06-02', assetName: 'PTT.BK', action: 'Buy', quantity: 100, priceUnit: 35 }
      ];

      const checked = findDuplicateTrades(candidates, existing);
      expect(checked[0].isDuplicate).toBe(true);
      expect(checked[1].isDuplicate).toBe(false);
    });
  });

  describe('generateTaxReport', () => {
    it('generates capital gains and dividend breakdown with THB conversion', () => {
      const trades = [
        {
          date: '2026-05-10',
          action: 'Sell',
          assetName: 'NVDA',
          assetType: 'Global Stock',
          currency: 'USD',
          quantity: 10,
          priceUnit: 120,
          realizedPnL: 200,
          fxToThb: 35
        }
      ];

      const cash = [
        {
          date: '2026-05-15',
          kind: 'Dividend',
          asset: 'PTT.BK',
          currency: 'THB',
          gross: 1000,
          withholdingTax: 100,
          net: 900,
          fxToThb: 1
        }
      ];

      const rep = generateTaxReport(trades, cash, '2026', { USD: 35 });
      expect(rep.tradeRows.length).toBe(1);
      expect(rep.dividendRows.length).toBe(1);
      expect(rep.summary.totalCapitalGainsTHB).toBe(7000); // 200 * 35
      expect(rep.summary.totalGrossDividendsTHB).toBe(1000);
      expect(rep.summary.totalWhtTHB).toBe(100);
      expect(rep.summary.totalNetDividendsTHB).toBe(900);
    });
  });
});
