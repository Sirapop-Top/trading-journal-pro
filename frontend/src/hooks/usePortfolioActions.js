import { useCallback } from 'react';
import { message } from 'antd';
import { CURRENCY_SYMBOLS } from '../lib/constants.js';
import {
  addPortfolioApi,
  deletePortfolioApi,
  updatePortfolioConfigApi,
  renamePortfolioApi
} from '../api/sheetsClient.js';

export const usePortfolioActions = ({
  journal,
  portfolioForm,
  renameForm,
  renameTarget,
  setIsPortfolioModalOpen,
  setIsRenameModalOpen
}) => {
  // Formatting helper
  const formatCurrency = useCallback((val, currencyCode = journal.displayCurrency) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '-';
    const symbol = CURRENCY_SYMBOLS[currencyCode] || '';
    if (journal.isCensored) return `${symbol} ****`;
    const formattedNum = Number(val).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${symbol} ${formattedNum}`;
  }, [journal.displayCurrency, journal.isCensored]);

  const getPortfolioConfig = useCallback((pName) => {
    try {
      const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
      return configs[pName] || { initialCapital: 2000000, targetStocks: 50 };
    } catch {
      return { initialCapital: 2000000, targetStocks: 50 };
    }
  }, []);

  const handleSavePortfolioConfig = useCallback(async (pName, initialCapital, targetStocks) => {
    try {
      const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
      configs[pName] = {
        initialCapital: Number(initialCapital) || 2000000,
        targetStocks: Number(targetStocks) || 50
      };
      localStorage.setItem('alphatrader_portfolio_configs', JSON.stringify(configs));

      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (scriptUrl) {
        updatePortfolioConfigApi(scriptUrl, pName, initialCapital, targetStocks).catch(e =>
          console.error('Error syncing config to cloud:', e)
        );
      }
      message.success(`Configuration for "${pName}" saved.`);
      journal.fetchData();
    } catch (err) {
      console.error('Error saving portfolio config:', err);
      message.error('Failed to save portfolio config.');
    }
  }, [journal]);

  // Add portfolio
  const handleAddPortfolio = useCallback(async (values) => {
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const name = values.name.trim();

      const customPortfolios = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '[]');
      if (!customPortfolios.includes(name)) {
        customPortfolios.push(name);
        localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(customPortfolios));
      }
      journal.setPortfolios(prev => {
        if (!prev.includes(name)) {
          return [...prev, name];
        }
        return prev;
      });

      const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
      configs[name] = {
        initialCapital: Number(values.initialCapital) || 2000000,
        targetStocks: Number(values.targetStocks) || 50
      };
      localStorage.setItem('alphatrader_portfolio_configs', JSON.stringify(configs));

      if (scriptUrl) {
        try {
          await addPortfolioApi(scriptUrl, name, Number(values.initialCapital) || 2000000, Number(values.targetStocks) || 50);
          await updatePortfolioConfigApi(scriptUrl, name, Number(values.initialCapital) || 2000000, Number(values.targetStocks) || 50);
        } catch (cloudErr) {
          console.error('Error syncing addPortfolio to cloud:', cloudErr);
        }
      }

      message.success(`Portfolio "${name}" created.`);
      setIsPortfolioModalOpen(false);
      portfolioForm.resetFields();
    } catch (error) {
      console.error('Error creating portfolio:', error);
      message.error(error.message || 'Failed to create portfolio.');
    }
  }, [journal, portfolioForm, setIsPortfolioModalOpen]);

  // Delete portfolio
  const handleDeletePortfolio = useCallback(async (portfolioName) => {
    try {
      const scriptUrl = localStorage.getItem('google_apps_script_url');
      const hasTrades = journal.trades.some(t => t.portfolio === portfolioName);
      if (hasTrades) {
        message.error('Cannot delete portfolio with existing trades. Please reassign or delete the trades first.');
        return;
      }

      const customPortfolios = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '[]');
      const updatedCustomPortfolios = customPortfolios.filter(p => p !== portfolioName);
      localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(updatedCustomPortfolios));

      const customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
      let changed = false;
      for (const asset in customMappings) {
        if (customMappings[asset] === portfolioName) {
          delete customMappings[asset];
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));
      }

      journal.setPortfolios(prev => prev.filter(p => p !== portfolioName));
      if (journal.activePortfolio === portfolioName) {
        journal.setActivePortfolio('All Portfolios');
      }

      if (scriptUrl) {
        try {
          await deletePortfolioApi(scriptUrl, portfolioName);
        } catch (cloudErr) {
          console.error('Error syncing deletePortfolio to cloud:', cloudErr);
        }
      }

      message.success(`Portfolio "${portfolioName}" deleted.`);
      await journal.fetchData();
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      message.error(error.message || 'Failed to delete portfolio.');
    }
  }, [journal]);

  // Rename/Configure portfolio
  const handleRenamePortfolio = useCallback(async (values) => {
    try {
      const oldName = renameTarget;
      const newName = values.name.trim();
      const initialCapital = Number(values.initialCapital) || 0;
      const targetStocks = Number(values.targetStocks) || 1;

      const configs = JSON.parse(localStorage.getItem('alphatrader_portfolio_configs') || '{}');
      configs[newName] = { initialCapital, targetStocks };
      if (oldName !== newName && oldName) {
        delete configs[oldName];
      }
      localStorage.setItem('alphatrader_portfolio_configs', JSON.stringify(configs));

      const scriptUrl = localStorage.getItem('google_apps_script_url');
      if (scriptUrl) {
        try {
          await updatePortfolioConfigApi(scriptUrl, oldName, initialCapital, targetStocks);
          if (oldName !== newName) {
            await renamePortfolioApi(scriptUrl, oldName, newName);
            await updatePortfolioConfigApi(scriptUrl, newName, initialCapital, targetStocks);
          }
        } catch (cloudErr) {
          console.error('Error syncing configs to cloud:', cloudErr);
        }
      }

      if (oldName !== newName) {
        const customPortfolios = JSON.parse(localStorage.getItem('alphatrader_custom_portfolios') || '[]');
        const updatedCustomPortfolios = customPortfolios.map(p => p === oldName ? newName : p);
        localStorage.setItem('alphatrader_custom_portfolios', JSON.stringify(updatedCustomPortfolios));

        const customMappings = JSON.parse(localStorage.getItem('alphatrader_portfolio_mappings') || '{}');
        let changed = false;
        for (const asset in customMappings) {
          if (customMappings[asset] === oldName) {
            customMappings[asset] = newName;
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem('alphatrader_portfolio_mappings', JSON.stringify(customMappings));
        }

        journal.setPortfolios(prev => prev.map(p => p === oldName ? newName : p));
        if (journal.activePortfolio === oldName) {
          journal.setActivePortfolio(newName);
        }
        message.success(`Portfolio renamed successfully to "${newName}".`);
      } else {
        message.success(`Portfolio "${newName}" configuration updated.`);
      }

      setIsRenameModalOpen(false);
      renameForm.resetFields();
      await journal.fetchData();
    } catch (error) {
      console.error('Error configuring portfolio:', error);
      message.error(error.message || 'Failed to configure portfolio.');
    }
  }, [journal, renameForm, renameTarget, setIsRenameModalOpen]);

  return {
    formatCurrency,
    getPortfolioConfig,
    handleSavePortfolioConfig,
    handleAddPortfolio,
    handleDeletePortfolio,
    handleRenamePortfolio
  };
};
