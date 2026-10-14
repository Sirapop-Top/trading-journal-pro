import { useState, useCallback } from 'react';
import { message, Form } from 'antd';
import { addCashEntryApi, editCashEntryApi, deleteCashEntryApi } from '../api/sheetsClient.js';

export const useCashActions = ({ journal }) => {
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [editingCashEntry, setEditingCashEntry] = useState(null);
  const [cashFilterKind, setCashFilterKind] = useState('All');
  const [cashFilterPortfolio, setCashFilterPortfolio] = useState('All');
  const [cashForm] = Form.useForm();

  const handleOpenAddCashEntry = useCallback((defaultPortfolio = null) => {
    setEditingCashEntry(null);
    cashForm.resetFields();
    if (defaultPortfolio && defaultPortfolio !== 'All Portfolios') {
      cashForm.setFieldsValue({ portfolio: defaultPortfolio });
    }
    setIsCashModalOpen(true);
  }, [cashForm]);

  const handleOpenEditCashEntry = useCallback((entry) => {
    setEditingCashEntry(entry);
    setIsCashModalOpen(true);
  }, []);

  const handleCloseCashModal = useCallback(() => {
    setIsCashModalOpen(false);
    setEditingCashEntry(null);
    cashForm.resetFields();
  }, [cashForm]);

  const handleSaveCashEntry = useCallback(async (values) => {
    const scriptUrl = localStorage.getItem('google_apps_script_url');
    if (!scriptUrl) {
      message.error('Apps Script URL is missing. Set it in Settings.');
      return;
    }

    journal.setIsSyncing(true);
    try {
      const formattedDate = values.date ? values.date.format('YYYY-MM-DD') : '';
      const gross = Number(values.gross) || 0;
      const withholdingTax = Number(values.withholdingTax) || 0;
      const net = values.net !== undefined && values.net !== null && values.net !== ''
        ? Number(values.net)
        : (gross - withholdingTax);

      const entryPayload = {
        date: formattedDate,
        portfolio: values.portfolio || 'Main Trading',
        kind: values.kind || 'Deposit',
        asset: values.asset ? values.asset.trim().toUpperCase() : '',
        currency: values.currency || 'THB',
        gross,
        withholdingTax,
        net,
        fxToThb: Number(values.fxToThb) || 1.0,
        note: values.note ? values.note.trim() : ''
      };

      if (editingCashEntry) {
        entryPayload.entryId = editingCashEntry.entryId;
        await editCashEntryApi(scriptUrl, entryPayload);
        message.success(`Cash entry ${entryPayload.entryId} updated!`);
        journal.setCashLedger(prev => prev.map(e => (e.entryId === entryPayload.entryId ? { ...e, ...entryPayload } : e)));
      } else {
        const res = await addCashEntryApi(scriptUrl, entryPayload);
        if (res.entryId) {
          entryPayload.entryId = res.entryId;
        }
        message.success('Cash entry added successfully!');
        journal.setCashLedger(prev => [...prev, entryPayload]);
      }

      handleCloseCashModal();
      journal.fetchData();
    } catch (err) {
      console.error('Error saving cash entry:', err);
      message.error(err.message || 'Failed to save cash entry.');
    } finally {
      journal.setIsSyncing(false);
    }
  }, [editingCashEntry, handleCloseCashModal, journal]);

  const handleDeleteCashEntry = useCallback(async (entryId) => {
    const scriptUrl = localStorage.getItem('google_apps_script_url');
    if (!scriptUrl) {
      message.error('Apps Script URL is missing in Cloud Mode.');
      return;
    }

    journal.setIsSyncing(true);
    try {
      await deleteCashEntryApi(scriptUrl, entryId);
      message.success(`Cash entry ${entryId} deleted successfully.`);
      journal.setCashLedger(prev => prev.filter(e => e.entryId !== entryId));
    } catch (err) {
      console.error('Error deleting cash entry:', err);
      message.error(err.message || 'Failed to delete cash entry.');
    } finally {
      journal.setIsSyncing(false);
    }
  }, [journal]);

  return {
    isCashModalOpen,
    setIsCashModalOpen,
    editingCashEntry,
    cashFilterKind,
    setCashFilterKind,
    cashFilterPortfolio,
    setCashFilterPortfolio,
    cashForm,
    handleOpenAddCashEntry,
    handleOpenEditCashEntry,
    handleCloseCashModal,
    handleSaveCashEntry,
    handleDeleteCashEntry
  };
};
