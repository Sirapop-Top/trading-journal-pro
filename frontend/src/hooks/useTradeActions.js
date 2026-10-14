import { useCallback } from 'react';
import { Modal, message } from 'antd';
import dayjs from 'dayjs';
import {
  validateTickerApi,
  addTradeApi,
  deleteTradeApi,
  editTradeApi,
  updateTradePortfolioApi
} from '../api/sheetsClient.js';

export const useTradeActions = ({
  journal,
  derived,
  tradeForm,
  editStrategyForm,
  transferForm,
  editingTrade,
  setEditingTrade,
  setIsTradeModalOpen,
  setIsEditStrategyModalOpen,
  setIsTransferModalOpen,
  setIsCustomStrategy,
  tickerValidation,
  setTickerValidation
}) => {
  // Ticker Validation on Yahoo Finance
  const handleValidateTicker = useCallback(async () => {
    const symbol = tradeForm.getFieldValue('assetName');
    const assetType = tradeForm.getFieldValue('assetType');
    if (!symbol) {
      setTickerValidation({
        status: 'error',
        message: 'Please input an asset name/ticker first.',
        checkedTicker: ''
      });
      return;
    }

    let resolvedSymbol = symbol.trim().toUpperCase();
    if (assetType && assetType.trim().toLowerCase() === 'crypto' && !resolvedSymbol.includes('-')) {
      resolvedSymbol = `${resolvedSymbol}-USD`;
      tradeForm.setFieldsValue({ assetName: resolvedSymbol });
    }
    const tickerUpper = resolvedSymbol;

    setTickerValidation({
      status: 'validating',
      message: 'Checking ticker on Yahoo Finance...',
      checkedTicker: tickerUpper
    });

    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing. Set it in settings to validate tickers.');
      }
      const result = await validateTickerApi(scriptUrl, resolvedSymbol, assetType);

      if (result.valid) {
        setTickerValidation({
          status: 'success',
          message: result.message,
          checkedTicker: tickerUpper
        });
        message.success('Ticker verified on Yahoo Finance!');
      } else {
        setTickerValidation({
          status: 'error',
          message: result.message,
          checkedTicker: tickerUpper
        });
        message.error(`Verification Failed: ${result.message}`);
      }
    } catch (error) {
      console.error('Ticker validation connection failed:', error);
      setTickerValidation({
        status: 'error',
        message: `Connection failed: ${error.message || 'Cannot reach validation service.'}`,
        checkedTicker: tickerUpper
      });
      message.error('Could not connect to verification service.');
    }
  }, [setTickerValidation, tradeForm]);

  // Log new trade
  const handleAddTrade = useCallback(async (values) => {
    let resolvedSymbol = values.assetName.trim().toUpperCase();
    const assetType = values.assetType;
    if (assetType && assetType.trim().toLowerCase() === 'crypto' && !resolvedSymbol.includes('-')) {
      resolvedSymbol = `${resolvedSymbol}-USD`;
      tradeForm.setFieldsValue({ assetName: resolvedSymbol });
    }
    const symbol = resolvedSymbol;
    const scriptUrl = localStorage.getItem('google_apps_script_url');

    // Validate ticker before adding trade
    if (tickerValidation.status !== 'success' || tickerValidation.checkedTicker !== symbol) {
      journal.setIsSyncing(true);
      const hideMsg = message.loading('Validating ticker on Yahoo Finance...', 0);
      try {
        if (!scriptUrl) {
          throw new Error('Apps Script URL is missing. Cannot validate ticker.');
        }
        const result = await validateTickerApi(scriptUrl, symbol, assetType);
        hideMsg();
        journal.setIsSyncing(false);

        if (!result.valid) {
          setTickerValidation({
            status: 'error',
            message: result.message,
            checkedTicker: symbol
          });
          message.error(`Verification Failed: ${result.message}`);
          return;
        } else {
          setTickerValidation({
            status: 'success',
            message: result.message,
            checkedTicker: symbol
          });
        }
      } catch (error) {
        hideMsg();
        journal.setIsSyncing(false);
        console.error('Ticker validation failed during submit:', error);

        return new Promise((resolve) => {
          Modal.confirm({
            title: 'Ticker Verification Unreachable',
            content: `Could not verify '${symbol}' because: ${error.message || error}. Do you want to log this trade anyway without verification?`,
            okText: 'Log Anyway',
            cancelText: 'Cancel',
            onOk: () => {
              setTickerValidation({
                status: 'success',
                message: 'Validation bypassed by user.',
                checkedTicker: symbol
              });
              resolve(handleAddTrade(values));
            },
            onCancel: () => resolve()
          });
        });
      }
    }

    journal.setIsSyncing(true);
    try {
      const formattedDate = values.date.format('YYYY-MM-DD');
      const quantity = Number(values.quantity);
      const priceUnit = Number(values.priceUnit);
      const feeAmount = values.feeAmount !== undefined ? Number(values.feeAmount) : 0.0;
      const fxToThb = values.fxToThb !== undefined && values.fxToThb !== null && !isNaN(Number(values.fxToThb))
        ? Number(values.fxToThb)
        : (journal.liveRates[values.currency] || 1.0);

      const tradePayload = {
        date: formattedDate,
        assetName: symbol,
        assetType: values.assetType,
        currency: values.currency,
        action: values.action,
        quantity,
        priceUnit,
        why: values.why || '',
        remark: values.remark || '',
        portfolio: values.portfolio,
        feeAmount,
        fxToThb
      };

      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing. Set it in Settings.');
      }

      await addTradeApi(scriptUrl, tradePayload);
      message.success('Trade logged successfully to Google Sheets!');

      setIsTradeModalOpen(false);
      tradeForm.resetFields();
      setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });

      journal.fetchData();
    } catch (error) {
      console.error('Error logging trade:', error);
      message.error(error.message || 'Failed to log trade to Google Sheets.');
    } finally {
      journal.setIsSyncing(false);
    }
  }, [journal, setTickerValidation, setIsTradeModalOpen, tickerValidation, tradeForm]);

  // Delete trade
  const handleDeleteTrade = useCallback(async (id) => {
    journal.setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing in Cloud Mode.');
      }
      await deleteTradeApi(scriptUrl, id);
      message.success('Trade deleted successfully from Google Sheets.');
      journal.setTrades(prev => prev.filter(t => t.id !== id));
      journal.fetchData();
    } catch (error) {
      console.error('Error deleting trade:', error);
      message.error(error.message || 'Failed to delete trade.');
    } finally {
      journal.setIsSyncing(false);
    }
  }, [journal]);

  // Update strategy / edit trade
  const handleUpdateStrategy = useCallback(async (values) => {
    if (!editingTrade) return;
    journal.setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const finalWhy = values.why === 'Other' ? (values.customWhy || '') : values.why;

      const updatedData = {
        quantity: Number(values.quantity),
        priceUnit: Number(values.priceUnit),
        feeAmount: Number(values.feeAmount),
        why: finalWhy,
        remark: values.remark || ''
      };

      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing in Cloud Mode.');
      }
      await editTradeApi(scriptUrl, editingTrade.id, updatedData);
      message.success('Trade entry updated successfully on Google Sheets.');
      journal.setTrades(prev => prev.map(t => t.id === editingTrade.id ? { ...t, ...updatedData } : t));
      setIsEditStrategyModalOpen(false);
      setEditingTrade(null);
      setIsCustomStrategy(false);
      editStrategyForm.resetFields();
      journal.fetchData();
    } catch (error) {
      console.error('Error updating trade entry:', error);
      message.error(error.message || 'Failed to update trade entry.');
    } finally {
      journal.setIsSyncing(false);
    }
  }, [editingTrade, editStrategyForm, journal, setEditingTrade, setIsCustomStrategy, setIsEditStrategyModalOpen]);

  // Transfer trade to another portfolio
  const handleTransferTrade = useCallback(async (values) => {
    if (!editingTrade) return;
    journal.setIsSyncing(true);
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const targetPortfolio = values.targetPortfolio;

      if (!scriptUrl) {
        throw new Error('Apps Script URL is missing in Cloud Mode.');
      }
      await updateTradePortfolioApi(scriptUrl, editingTrade.id, targetPortfolio);
      message.success(`Trade transferred to '${targetPortfolio}' successfully on Google Sheets.`);
      journal.setTrades(prev => prev.map(t => t.id === editingTrade.id ? { ...t, portfolio: targetPortfolio } : t));
      setIsTransferModalOpen(false);
      setEditingTrade(null);
      transferForm.resetFields();
      journal.fetchData();
    } catch (error) {
      console.error('Error transferring trade:', error);
      message.error(error.message || 'Failed to transfer trade.');
    } finally {
      journal.setIsSyncing(false);
    }
  }, [editingTrade, journal, setEditingTrade, setIsTransferModalOpen, transferForm]);

  // Export CSV
  const exportToCSV = useCallback(() => {
    if (derived.filteredTrades.length === 0) {
      message.warning('No trades to export.');
      return;
    }

    const headers = [
      'Trade ID', 'Date', 'Portfolio', 'Asset Name', 'Asset Type', 'Currency',
      'Action', 'Quantity', 'Price/Unit (Local)', 'Total Amount (Local)',
      `Live Price (${journal.displayCurrency})`, `Live Market Value (${journal.displayCurrency})`,
      `P&L (${journal.displayCurrency})`, 'P&L %', 'Decision Reason', 'Remark'
    ];

    const rows = derived.filteredTrades.map(trade => {
      const qty = Number(trade.quantity) || 0;
      const price = Number(trade.priceUnit) || 0;
      const amountLocal = qty * price;

      const rateToTHB = journal.liveRates[trade.currency] || 1.0;
      const displayRateToTHB = journal.liveRates[journal.displayCurrency] || 1.0;

      const livePriceLocal = journal.livePrices[trade.assetName] !== undefined
        ? journal.livePrices[trade.assetName]
        : price;

      const livePriceConverted = (livePriceLocal * rateToTHB) / displayRateToTHB;
      const liveValueConverted = livePriceConverted * qty;

      let pnlConverted = 0;
      let pnlPct = 0;
      if (trade.action.toLowerCase() === 'buy') {
        pnlConverted = ((livePriceLocal - price) * qty * rateToTHB) / displayRateToTHB;
        pnlPct = price > 0 ? ((livePriceLocal - price) / price) * 100 : 0;
      } else if (trade.action.toLowerCase() === 'sell') {
        pnlConverted = ((price - livePriceLocal) * qty * rateToTHB) / displayRateToTHB;
        pnlPct = livePriceLocal > 0 ? ((price - livePriceLocal) / livePriceLocal) * 100 : 0;
      }

      return [
        trade.id,
        trade.date,
        trade.portfolio,
        trade.assetName,
        trade.assetType,
        trade.currency,
        trade.action,
        qty,
        price,
        amountLocal.toFixed(2),
        livePriceConverted.toFixed(2),
        liveValueConverted.toFixed(2),
        pnlConverted.toFixed(2),
        `${pnlPct.toFixed(2)}%`,
        `"${trade.why?.replace(/"/g, '""') || ''}"`,
        `"${trade.remark?.replace(/"/g, '""') || ''}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const portfolioLabel = journal.activePortfolio.replace(/\s+/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Trading_Journal_${portfolioLabel}_${journal.displayCurrency}_${dayjs().format('YYYYMMDD')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(`Trading journal CSV (${journal.displayCurrency}) exported successfully.`);
  }, [derived.filteredTrades, journal.activePortfolio, journal.displayCurrency, journal.livePrices, journal.liveRates]);

  return {
    handleValidateTicker,
    handleAddTrade,
    handleDeleteTrade,
    handleUpdateStrategy,
    handleTransferTrade,
    exportToCSV
  };
};
