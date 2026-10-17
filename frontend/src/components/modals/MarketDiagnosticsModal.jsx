import { useState } from 'react';
import { Modal, Table, Tag, Button, Input, InputNumber, Space, Alert, Typography } from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  UndoOutlined,
  ApiOutlined
} from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { testGoogleAppsScript } from '../../api/sheetsClient.js';

const { Text } = Typography;

export const MarketDiagnosticsModal = () => {
  const {
    isMarketModalOpen,
    setIsMarketModalOpen,
    activeHoldings,
    livePrices,
    liveRates,
    priceSources,
    manualPrices,
    updateManualPrice,
    clearManualPrice,
    clearAllManualPrices,
    googleAppsScriptUrl,
    setGoogleAppsScriptUrl,
    handleSaveGoogleSheetSettings,
    syncMarketData,
    isSyncing,
    formatCurrency
  } = useAppData();

  const [editingPrices, setEditingPrices] = useState({});
  const [testingScript, setTestingScript] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTestConnection = async () => {
    setTestingScript(true);
    setTestResult(null);
    try {
      const res = await testGoogleAppsScript(googleAppsScriptUrl);
      setTestResult(res);
      if (res.ok) {
        localStorage.setItem('google_apps_script_url', googleAppsScriptUrl.trim());
        await syncMarketData(false);
      }
    } finally {
      setTestingScript(false);
    }
  };

  const getYahooSymbol = (record) => {
    const clean = String(record.assetName || '').replace(/:S1X|:SHORT/gi, '').trim().toUpperCase();
    const typeLower = String(record.assetType || '').toLowerCase();
    if (typeLower.includes('crypto')) {
      return clean.endsWith('-USD') ? clean : `${clean}-USD`;
    }
    if (typeLower.includes('thai') || (record.currency === 'THB' && !typeLower.includes('global') && !typeLower.includes('us'))) {
      return clean.endsWith('.BK') ? clean : `${clean}.BK`;
    }
    return clean;
  };

  const columns = [
    {
      title: 'Asset',
      dataIndex: 'assetName',
      key: 'assetName',
      render: (name, record) => (
        <div>
          <strong style={{ color: '#ffffff', fontSize: '13px' }}>{name}</strong>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Yahoo: <code>{getYahooSymbol(record)}</code> ({record.currency})
          </div>
        </div>
      )
    },
    {
      title: 'Avg Cost',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      align: 'right',
      render: (val, record) => (
        <span className="financial-num" style={{ color: 'var(--text-secondary)' }}>
          {formatCurrency(val, record.currency)}
        </span>
      )
    },
    {
      title: 'Market Price',
      key: 'currentPrice',
      align: 'right',
      render: (_, record) => (
        <span className="financial-num" style={{ color: record.hasLivePrice ? '#00f2fe' : '#f59e0b', fontWeight: 700 }}>
          {formatCurrency(record.currentPrice, record.currency)}
        </span>
      )
    },
    {
      title: 'Source',
      key: 'source',
      align: 'center',
      render: (_, record) => {
        const clean = String(record.assetName || '').toUpperCase().trim();
        const src = manualPrices?.[clean] !== undefined
          ? 'manual'
          : (priceSources?.[clean] || priceSources?.[`${clean}.BK`] || (record.hasLivePrice ? 'yahoo' : 'fallback'));

        if (src === 'manual') return <Tag color="gold">Manual Override</Tag>;
        if (src === 'binance') return <Tag color="cyan">Binance Live</Tag>;
        if (src === 'yahoo') return <Tag color="success" icon={<CheckCircleOutlined />}>Yahoo Finance</Tag>;
        return <Tag color="warning" icon={<ExclamationCircleOutlined />}>Cost Fallback</Tag>;
      }
    },
    {
      title: 'Manual Override',
      key: 'override',
      align: 'right',
      render: (_, record) => {
        const clean = String(record.assetName || '').toUpperCase().trim();
        const isManual = manualPrices?.[clean] !== undefined;
        const inputVal = editingPrices[clean] !== undefined ? editingPrices[clean] : record.currentPrice;

        return (
          <Space size={6}>
            <InputNumber
              size="small"
              min={0.0001}
              step={0.25}
              value={inputVal}
              onChange={(val) => setEditingPrices(prev => ({ ...prev, [clean]: val }))}
              style={{ width: 95 }}
            />
            <Button
              size="small"
              type="primary"
              ghost
              icon={<EditOutlined />}
              onClick={() => updateManualPrice(clean, editingPrices[clean] ?? record.currentPrice)}
            >
              Set
            </Button>
            {isManual && (
              <Button
                size="small"
                danger
                ghost
                icon={<UndoOutlined />}
                onClick={() => clearManualPrice(clean)}
                title="Reset to Live Price"
              />
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <ApiOutlined style={{ color: 'var(--primary-color)' }} />
          <span>Yahoo Finance Market Price Feed & Diagnostics</span>
        </Space>
      }
      open={isMarketModalOpen}
      onCancel={() => setIsMarketModalOpen(false)}
      width={780}
      footer={[
        Object.keys(manualPrices || {}).length > 0 && (
          <Button key="clearAll" danger ghost onClick={clearAllManualPrices}>
            Reset All Manual Overrides
          </Button>
        ),
        <Button
          key="sync"
          type="primary"
          icon={<SyncOutlined spin={isSyncing} />}
          loading={isSyncing}
          onClick={() => syncMarketData(false)}
          style={{ color: '#06080f', fontWeight: 700 }}
        >
          Sync Market Prices Now
        </Button>,
        <Button key="close" onClick={() => setIsMarketModalOpen(false)}>
          Close
        </Button>
      ]}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <Text strong style={{ color: '#ffffff' }}>Google Apps Script Web App URL (Yahoo Finance Live Bridge)</Text>
            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              FX: 1 USD = ฿{(liveRates?.USD || 32.69).toFixed(2)} | 1 EUR = ฿{(liveRates?.EUR || 38.04).toFixed(2)}
            </Text>
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="https://script.google.com/macros/s/.../exec"
              value={googleAppsScriptUrl}
              onChange={(e) => setGoogleAppsScriptUrl(e.target.value)}
            />
            <Button
              type="primary"
              loading={testingScript}
              onClick={handleTestConnection}
              style={{ color: '#06080f', fontWeight: 700 }}
            >
              Test & Save URL
            </Button>
            <Button onClick={handleSaveGoogleSheetSettings}>
              Save
            </Button>
          </Space.Compact>

          {testResult && (
            <Alert
              style={{ marginTop: '10px' }}
              type={testResult.ok ? 'success' : 'error'}
              showIcon
              message={
                testResult.ok
                  ? `Connected to Apps Script (v${testResult.schemaVersion}) — Fetched ${Object.keys(testResult.livePrices || {}).length} live price keys`
                  : `Connection Failed: ${testResult.error}`
              }
            />
          )}
        </div>

        <Table
          dataSource={activeHoldings || []}
          columns={columns}
          rowKey="assetName"
          size="small"
          pagination={false}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No active holdings in the selected portfolio.' }}
        />
      </Space>
    </Modal>
  );
};
