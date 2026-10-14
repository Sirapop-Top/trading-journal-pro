import { useMemo, useCallback } from 'react';
import { message } from 'antd';
import dayjs from 'dayjs';
import {
  savePairApi,
  setPairStatusApi,
  deletePairApi,
  executeRebalanceApi,
  revertRebalanceApi
} from '../api/sheetsClient.js';
import {
  computePairState,
  evaluateDue
} from '../lib/rebalanceEngine.js';

export const useRebalanceActions = ({
  trades,
  rebalancePairs,
  setRebalancePairs,
  livePrices,
  liveRates,
  fetchData
}) => {
  const scriptUrl = typeof localStorage !== 'undefined' ? (localStorage.getItem('google_apps_script_url') || '') : '';
  const today = dayjs().format('YYYY-MM-DD');

  // Compute status & due info for all pairs
  const pairsWithStatus = useMemo(() => {
    return (rebalancePairs || []).map(pair => {
      const state = computePairState(pair, trades, livePrices, liveRates);
      const dueInfo = evaluateDue(pair, state, today);
      return {
        ...pair,
        state,
        dueInfo
      };
    });
  }, [rebalancePairs, trades, livePrices, liveRates, today]);

  // Count active pairs that require rebalancing right now (for badges and banners)
  const dueCount = useMemo(() => {
    return pairsWithStatus.filter(p => p.status === 'Active' && p.dueInfo.due).length;
  }, [pairsWithStatus]);

  // Save pair (create or edit)
  const handleSavePair = useCallback(async (pairData) => {
    if (!scriptUrl) {
      message.error('Apps Script URL is not configured.');
      return false;
    }
    try {
      const res = await savePairApi(scriptUrl, pairData);
      if (res && res.success) {
        message.success(pairData.pairId ? 'Pair updated successfully!' : 'New pair created successfully!');
        if (fetchData) await fetchData();
        return true;
      } else {
        message.error((res && res.error) || 'Failed to save pair.');
        return false;
      }
    } catch (err) {
      console.error('Save pair error:', err);
      message.error('Failed to save pair: ' + err.message);
      return false;
    }
  }, [scriptUrl, fetchData]);

  // Pause / Activate pair
  const handleTogglePairStatus = useCallback(async (pairId, currentStatus) => {
    if (!scriptUrl) {
      message.error('Apps Script URL is not configured.');
      return false;
    }
    const nextStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    try {
      // Optimistic update
      setRebalancePairs(prev => prev.map(p => p.pairId === pairId ? { ...p, status: nextStatus } : p));
      const res = await setPairStatusApi(scriptUrl, pairId, nextStatus);
      if (res && res.success) {
        message.success(`Pair set to ${nextStatus}.`);
        if (fetchData) await fetchData();
        return true;
      } else {
        message.error((res && res.error) || 'Failed to change pair status.');
        if (fetchData) await fetchData();
        return false;
      }
    } catch (err) {
      console.error('Status change error:', err);
      message.error('Failed to change status: ' + err.message);
      if (fetchData) await fetchData();
      return false;
    }
  }, [scriptUrl, setRebalancePairs, fetchData]);

  // Delete pair
  const handleDeletePair = useCallback(async (pairId) => {
    if (!scriptUrl) {
      message.error('Apps Script URL is not configured.');
      return false;
    }
    try {
      // Optimistic update
      setRebalancePairs(prev => prev.filter(p => p.pairId !== pairId));
      const res = await deletePairApi(scriptUrl, pairId);
      if (res && res.success) {
        message.success('Pair deleted.');
        if (fetchData) await fetchData();
        return true;
      } else {
        message.error((res && res.error) || 'Failed to delete pair.');
        if (fetchData) await fetchData();
        return false;
      }
    } catch (err) {
      console.error('Delete pair error:', err);
      message.error('Failed to delete pair: ' + err.message);
      if (fetchData) await fetchData();
      return false;
    }
  }, [scriptUrl, setRebalancePairs, fetchData]);

  // Execute Rebalance
  const handleExecuteRebalance = useCallback(async (rebalanceData) => {
    if (!scriptUrl) {
      message.error('Apps Script URL is not configured.');
      return false;
    }
    try {
      const res = await executeRebalanceApi(scriptUrl, rebalanceData);
      if (res && res.success) {
        message.success(`Rebalance executed! (ID: ${res.rebalanceId})`);
        if (fetchData) await fetchData();
        return true;
      } else {
        message.error((res && res.error) || 'Rebalance execution failed.');
        return false;
      }
    } catch (err) {
      console.error('Execute rebalance error:', err);
      message.error('Rebalance execution failed: ' + err.message);
      return false;
    }
  }, [scriptUrl, fetchData]);

  // Revert Rebalance
  const handleRevertRebalance = useCallback(async (rebalanceId) => {
    if (!scriptUrl) {
      message.error('Apps Script URL is not configured.');
      return false;
    }
    try {
      const res = await revertRebalanceApi(scriptUrl, rebalanceId);
      if (res && res.success) {
        message.success(`Rebalance ${rebalanceId} reverted successfully!`);
        if (fetchData) await fetchData();
        return true;
      } else {
        message.error((res && res.error) || 'Revert failed.');
        return false;
      }
    } catch (err) {
      console.error('Revert rebalance error:', err);
      message.error('Revert failed: ' + err.message);
      return false;
    }
  }, [scriptUrl, fetchData]);

  return {
    pairsWithStatus,
    dueCount,
    handleSavePair,
    handleTogglePairStatus,
    handleDeletePair,
    handleExecuteRebalance,
    handleRevertRebalance
  };
};
