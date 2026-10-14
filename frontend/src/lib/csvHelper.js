import dayjs from 'dayjs';

/**
 * Escapes a single CSV cell value
 */
export const escapeCsvCell = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Exports data to CSV with UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
 */
export const exportToCsv = (filename, headers = [], rows = []) => {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const rowLines = rows.map(r => {
    if (Array.isArray(r)) {
      return r.map(escapeCsvCell).join(',');
    }
    return headers.map(h => escapeCsvCell(r[h])).join(',');
  });

  const csvContent = '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  if (typeof window !== 'undefined' && window.document) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return csvContent;
};

/**
 * Generates an Annual Tax Report dataset (Trades Realized + Dividends + WHT)
 */
export const generateTaxReport = (
  trades = [],
  cashEntries = [],
  targetYear = null,
  liveRates = {}
) => {
  const yearFilter = targetYear ? String(targetYear) : null;

  // Filter sells
  const sellTrades = trades.filter(t => {
    if (String(t.action || '').trim().toLowerCase() !== 'sell') return false;
    if (yearFilter && dayjs(t.date).format('YYYY') !== yearFilter) return false;
    return true;
  });

  // Filter dividends
  const dividendEntries = cashEntries.filter(c => {
    if (String(c.kind || '').trim().toLowerCase() !== 'dividend') return false;
    if (yearFilter && dayjs(c.date).format('YYYY') !== yearFilter) return false;
    return true;
  });

  let totalCapitalGainsTHB = 0;
  let totalGrossDividendsTHB = 0;
  let totalWhtTHB = 0;
  let totalNetDividendsTHB = 0;

  const tradeRows = sellTrades.map(t => {
    const tradeFx = (t.fxToThb !== undefined && t.fxToThb !== null && !isNaN(Number(t.fxToThb)))
      ? Number(t.fxToThb)
      : (t.currency === 'THB' ? 1.0 : (liveRates[t.currency] || 1.0));

    const pnl = Number(t.realizedPnL) || 0;
    const pnlThb = pnl * tradeFx;
    totalCapitalGainsTHB += pnlThb;

    return {
      'Date': t.date,
      'Portfolio': t.portfolio || 'Main Trading',
      'Asset Name': t.assetName,
      'Asset Type': t.assetType,
      'Quantity': t.quantity,
      'Price': t.priceUnit,
      'Currency': t.currency,
      'Realized P&L (Local)': pnl.toFixed(2),
      'FX To THB': tradeFx,
      'Realized P&L (THB)': pnlThb.toFixed(2),
      'Strategy / Why': t.why || ''
    };
  });

  const dividendRows = dividendEntries.map(d => {
    const entryFx = (d.fxToThb !== undefined && d.fxToThb !== null && !isNaN(Number(d.fxToThb)))
      ? Number(d.fxToThb)
      : (d.currency === 'THB' ? 1.0 : (liveRates[d.currency] || 1.0));

    const gross = Number(d.gross) || 0;
    const wht = Number(d.withholdingTax) || 0;
    const net = d.net !== undefined ? Number(d.net) : (gross - wht);

    const grossThb = gross * entryFx;
    const whtThb = wht * entryFx;
    const netThb = net * entryFx;

    totalGrossDividendsTHB += grossThb;
    totalWhtTHB += whtThb;
    totalNetDividendsTHB += netThb;

    return {
      'Date': d.date,
      'Portfolio': d.portfolio || 'Main Trading',
      'Asset': d.asset || '',
      'Currency': d.currency || 'THB',
      'Gross': gross.toFixed(2),
      'Withholding Tax': wht.toFixed(2),
      'Net': net.toFixed(2),
      'FX To THB': entryFx,
      'Gross (THB)': grossThb.toFixed(2),
      'WHT (THB)': whtThb.toFixed(2),
      'Net (THB)': netThb.toFixed(2),
      'Note': d.note || ''
    };
  });

  return {
    year: targetYear || 'All Years',
    tradeRows,
    dividendRows,
    summary: {
      totalCapitalGainsTHB: Math.round(totalCapitalGainsTHB * 100) / 100,
      totalGrossDividendsTHB: Math.round(totalGrossDividendsTHB * 100) / 100,
      totalWhtTHB: Math.round(totalWhtTHB * 100) / 100,
      totalNetDividendsTHB: Math.round(totalNetDividendsTHB * 100) / 100
    }
  };
};

/**
 * Parses raw CSV string handling quoted cells and multi-line content
 */
export const parseCsvText = (text) => {
  if (!text || !text.trim()) return { headers: [], rows: [] };

  // Strip UTF-8 BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }

  const lines = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        lines.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0];
  const rawRows = lines.slice(1);

  const rows = rawRows.map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx] : '';
    });
    return obj;
  });

  return { headers, rows };
};

/**
 * Automatically suggests column mappings from CSV headers to standard Trade fields
 */
export const detectCsvMapping = (csvHeaders = []) => {
  const mapping = {
    date: null,
    assetName: null,
    assetType: null,
    action: null,
    quantity: null,
    priceUnit: null,
    currency: null,
    feeAmount: null,
    portfolio: null,
    why: null,
    remark: null,
    fxToThb: null
  };

  const aliases = {
    date: ['date', 'trade date', 'time', 'timestamp', 'datetime', 'วันที่', 'วัน'],
    assetName: ['asset name', 'asset', 'symbol', 'ticker', 'code', 'name', 'หุ้น', 'ชื่อหุ้น'],
    assetType: ['asset type', 'type', 'market', 'category', 'สินทรัพย์'],
    action: ['action', 'side', 'buy/sell', 'คำสั่ง', 'ประเภทคำสั่ง'],
    quantity: ['quantity', 'qty', 'shares', 'units', 'volume', 'amount_units', 'จำนวน'],
    priceUnit: ['price/unit', 'price', 'unit price', 'cost', 'avg price', 'ราคา'],
    currency: ['currency', 'ccy', 'curr', 'สกุลเงิน'],
    feeAmount: ['fee amount', 'fee', 'commission', 'vat', 'total fee', 'ค่าธรรมเนียม'],
    portfolio: ['portfolio', 'port', 'account', 'พอร์ต'],
    why: ['why (decision reason)', 'why', 'strategy', 'reason', 'กลยุทธ์', 'เหตุผล'],
    remark: ['remark', 'note', 'comment', 'memo', 'หมายเหตุ'],
    fxToThb: ['fx to thb', 'fx', 'exchange rate', 'rate', 'อัตราแลกเปลี่ยน']
  };

  const lowerHeaders = csvHeaders.map(h => ({ original: h, lower: h.toLowerCase().trim() }));

  Object.keys(aliases).forEach(field => {
    const candidates = aliases[field];
    for (const cand of candidates) {
      const match = lowerHeaders.find(h => h.lower === cand || h.lower.includes(cand));
      if (match) {
        mapping[field] = match.original;
        break;
      }
    }
  });

  return mapping;
};

/**
 * Detects duplicate trades against existing journal trades
 * Duplicate signature: date + assetName + action + quantity + priceUnit
 */
export const findDuplicateTrades = (candidateTrades = [], existingTrades = []) => {
  const makeSig = (t) => {
    const d = dayjs(t.date).isValid() ? dayjs(t.date).format('YYYY-MM-DD') : String(t.date || '').trim();
    const asset = String(t.assetName || '').trim().toUpperCase();
    const action = String(t.action || '').trim().toLowerCase();
    const qty = Number(t.quantity) || 0;
    const price = Number(t.priceUnit) || 0;
    return `${d}_${asset}_${action}_${qty}_${price}`;
  };

  const existingSet = new Set(existingTrades.map(makeSig));

  return candidateTrades.map(cand => {
    const sig = makeSig(cand);
    const isDuplicate = existingSet.has(sig);
    return {
      ...cand,
      isDuplicate
    };
  });
};
