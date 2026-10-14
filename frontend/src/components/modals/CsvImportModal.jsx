import { useState, useMemo } from 'react';
import {
  Modal,
  Steps,
  Upload,
  Button,
  Select,
  Table,
  Typography,
  Row,
  Col,
  Checkbox,
  Tag,
  Alert,
  message
} from 'antd';
import {
  InboxOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { parseCsvText, detectCsvMapping, findDuplicateTrades } from '../../lib/csvHelper.js';
import { addTradesBatchApi } from '../../api/sheetsClient.js';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Dragger } = Upload;
const { Text } = Typography;
const { Option } = Select;

const TRADE_FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'assetName', label: 'Asset Name / Ticker', required: true },
  { key: 'action', label: 'Action (Buy / Sell)', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'priceUnit', label: 'Price / Unit', required: true },
  { key: 'assetType', label: 'Asset Type', required: false },
  { key: 'currency', label: 'Currency', required: false },
  { key: 'feeAmount', label: 'Fee Amount', required: false },
  { key: 'portfolio', label: 'Portfolio', required: false },
  { key: 'why', label: 'Why (Strategy)', required: false },
  { key: 'remark', label: 'Remark / Notes', required: false },
  { key: 'fxToThb', label: 'FX To THB', required: false }
];

export const CsvImportModal = ({ open, onClose }) => {
  const {
    trades: existingTrades = [],
    portfolios = [],
    activePortfolio,
    fetchData,
    liveRates
  } = useAppData();

  const [currentStep, setCurrentStep] = useState(0);
  const [csvData, setCsvData] = useState({ headers: [], rows: [] });
  const [columnMapping, setColumnMapping] = useState({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when closing
  const handleClose = () => {
    setCurrentStep(0);
    setCsvData({ headers: [], rows: [] });
    setColumnMapping({});
    onClose();
  };

  // Step 0: Handle File Upload
  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseCsvText(text);
        if (!parsed.headers.length || !parsed.rows.length) {
          message.error('The selected file is empty or has an invalid CSV format.');
          return;
        }

        setCsvData(parsed);

        // Load saved mapping or auto-detect
        const savedMappingStr = localStorage.getItem('alphatrader_csv_mapping');
        let initialMapping = {};
        if (savedMappingStr) {
          try {
            initialMapping = JSON.parse(savedMappingStr);
          } catch (err) {}
        }

        const detected = detectCsvMapping(parsed.headers);
        const combined = { ...detected, ...initialMapping };
        // Ensure mapped headers actually exist in current file
        Object.keys(combined).forEach(k => {
          if (combined[k] && !parsed.headers.includes(combined[k])) {
            combined[k] = detected[k] || null;
          }
        });

        setColumnMapping(combined);
        setCurrentStep(1);
      } catch (err) {
        message.error('Error reading CSV file: ' + err.toString());
      }
    };
    reader.readAsText(file, 'utf-8');
    return false; // prevent default upload POST
  };

  // Step 1: Mapping validation
  const isMappingValid = useMemo(() => {
    return TRADE_FIELDS.filter(f => f.required).every(f => !!columnMapping[f.key]);
  }, [columnMapping]);

  const handleSaveMappingAndPreview = () => {
    localStorage.setItem('alphatrader_csv_mapping', JSON.stringify(columnMapping));
    setCurrentStep(2);
  };

  // Step 2: Transform parsed rows into candidate trade objects
  const candidateTrades = useMemo(() => {
    if (!csvData.rows.length || currentStep < 2) return [];

    const rawCandidates = csvData.rows.map((row, idx) => {
      const getVal = (field) => {
        const col = columnMapping[field];
        return col && row[col] !== undefined ? String(row[col]).trim() : '';
      };

      const rawDate = getVal('date');
      const d = dayjs(rawDate);
      const dateStr = d.isValid() ? d.format('YYYY-MM-DD') : rawDate;

      const rawAction = getVal('action').toLowerCase();
      const action = rawAction.includes('sell') ? 'Sell' : 'Buy';

      const assetName = getVal('assetName').toUpperCase();
      let assetType = getVal('assetType');
      if (!assetType) {
        if (assetName.includes('-USD') || assetName.includes('BTC') || assetName.includes('ETH')) assetType = 'Crypto';
        else if (assetName.endsWith('.BK')) assetType = 'Thai Stock';
        else assetType = 'Thai Stock';
      }

      const qty = parseFloat(getVal('quantity').replace(/,/g, '')) || 0;
      const price = parseFloat(getVal('priceUnit').replace(/,/g, '')) || 0;
      const fee = parseFloat(getVal('feeAmount').replace(/,/g, '')) || 0;

      let currency = getVal('currency').toUpperCase();
      if (!currency) {
        currency = (assetType === 'Thai Stock' || assetName.endsWith('.BK')) ? 'THB' : 'USD';
      }

      const defaultPort = activePortfolio === 'All Portfolios' ? (portfolios[0] || 'Main Trading') : activePortfolio;
      const port = getVal('portfolio') || defaultPort;

      const fx = parseFloat(getVal('fxToThb')) || (currency === 'THB' ? 1.0 : (liveRates[currency] || 1.0));

      const isValid = dateStr && assetName && qty > 0 && price > 0;

      return {
        id: `import-${idx}`,
        date: dateStr,
        assetName,
        assetType,
        action,
        quantity: qty,
        priceUnit: price,
        feeAmount: fee,
        currency,
        portfolio: port,
        why: getVal('why') || 'CSV Import',
        remark: getVal('remark') || '',
        fxToThb: fx,
        isValid
      };
    });

    return findDuplicateTrades(rawCandidates, existingTrades);
  }, [csvData, columnMapping, currentStep, activePortfolio, portfolios, liveRates, existingTrades]);

  const tradesToImport = useMemo(() => {
    return candidateTrades.filter(t => {
      if (!t.isValid) return false;
      if (skipDuplicates && t.isDuplicate) return false;
      return true;
    });
  }, [candidateTrades, skipDuplicates]);

  // Step 3: Submit Batch
  const handleExecuteImport = async () => {
    if (!tradesToImport.length) {
      message.warning('No valid trades to import.');
      return;
    }

    const scriptUrl = localStorage.getItem('google_apps_script_url');
    if (!scriptUrl) {
      message.error('Google Apps Script URL is not configured in Terminal Settings.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Chunk in batches of 150 to stay within server limits
      const chunkSize = 150;
      let importedCount = 0;

      for (let i = 0; i < tradesToImport.length; i += chunkSize) {
        const chunk = tradesToImport.slice(i, i + chunkSize);
        const res = await addTradesBatchApi(scriptUrl, chunk);
        if (!res.success) {
          throw new Error(res.error || 'Failed to import batch');
        }
        importedCount += chunk.length;
      }

      message.success(`Successfully imported ${importedCount} trades!`);
      await fetchData();
      handleClose();
    } catch (err) {
      message.error('Import failed: ' + err.toString());
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewColumns = [
    {
      title: 'Status',
      key: 'status',
      width: 110,
      render: (_, r) => {
        if (!r.isValid) return <Tag color="error">Invalid</Tag>;
        if (r.isDuplicate) return <Tag color="warning">Duplicate</Tag>;
        return <Tag color="success">Ready</Tag>;
      }
    },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 100 },
    { title: 'Asset', dataIndex: 'assetName', key: 'assetName', width: 100, render: v => <strong>{v}</strong> },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: v => <Tag color={v === 'Buy' ? 'cyan' : 'orange'}>{v}</Tag>
    },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'right', width: 90 },
    { title: 'Price', dataIndex: 'priceUnit', key: 'priceUnit', align: 'right', width: 90 },
    { title: 'Fee', dataIndex: 'feeAmount', key: 'feeAmount', align: 'right', width: 80 },
    { title: 'Cur', dataIndex: 'currency', key: 'currency', width: 70 },
    { title: 'Portfolio', dataIndex: 'portfolio', key: 'portfolio', width: 120 }
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UploadOutlined style={{ color: 'var(--primary-color)' }} />
          <span>Import Trades from CSV</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      width={780}
      footer={null}
      destroyOnClose
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Upload CSV' },
          { title: 'Map Columns' },
          { title: 'Preview & Import' }
        ]}
      />

      {/* STEP 0: Upload */}
      {currentStep === 0 && (
        <div style={{ padding: '20px 0' }}>
          <Dragger
            accept=".csv"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            style={{ padding: '32px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '2px dashed var(--border-color)', borderRadius: 12 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ color: 'var(--primary-color)', fontSize: 48 }} />
            </p>
            <p className="ant-upload-text" style={{ color: '#ffffff', fontSize: 16, fontWeight: 700 }}>
              Click or drag CSV file to this area to import
            </p>
            <p className="ant-upload-hint" style={{ color: 'var(--text-secondary)' }}>
              Supports standard broker exports (Streaming, InnovestX, Binance, TradingView) or AlphaTrader CSV backups.
            </p>
          </Dragger>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose}>Cancel</Button>
          </div>
        </div>
      )}

      {/* STEP 1: Map Columns */}
      {currentStep === 1 && (
        <div>
          <Alert
            message="Map your CSV columns to AlphaTrader trade fields"
            description="Fields marked with an asterisk (*) are mandatory. The system will remember your selections for next time."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={[16, 12]}>
            {TRADE_FIELDS.map(field => (
              <Col xs={24} sm={12} key={field.key}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Text strong style={{ fontSize: 12 }}>
                    {field.label} {field.required && <span style={{ color: '#ef4444' }}>*</span>}
                  </Text>
                  <Select
                    value={columnMapping[field.key] || undefined}
                    onChange={(val) => setColumnMapping(prev => ({ ...prev, [field.key]: val }))}
                    placeholder={`Select CSV column`}
                    allowClear={!field.required}
                    size="middle"
                  >
                    {csvData.headers.map(h => (
                      <Option key={h} value={h}>{h}</Option>
                    ))}
                  </Select>
                </div>
              </Col>
            ))}
          </Row>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep(0)}>
              Back
            </Button>
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              disabled={!isMappingValid}
              onClick={handleSaveMappingAndPreview}
              style={{ background: 'var(--accent-gradient)', border: 'none', color: '#06080f', fontWeight: 'bold' }}
            >
              Continue to Preview
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Preview & Import */}
      {currentStep === 2 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <Text strong style={{ fontSize: 14 }}>
                Ready to Import: <span style={{ color: '#34d399' }}>{tradesToImport.length}</span> of {candidateTrades.length} trades
              </Text>
            </div>
            <Checkbox
              checked={skipDuplicates}
              onChange={(e) => setSkipDuplicates(e.target.checked)}
            >
              Skip Duplicates ({candidateTrades.filter(t => t.isDuplicate).length} detected)
            </Checkbox>
          </div>

          <Table
            columns={previewColumns}
            dataSource={candidateTrades}
            rowKey="id"
            pagination={{ pageSize: 6, size: 'small' }}
            scroll={{ x: 800 }}
            size="small"
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setCurrentStep(1)} disabled={isSubmitting}>
              Back to Mapping
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={isSubmitting}
              disabled={tradesToImport.length === 0}
              onClick={handleExecuteImport}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', fontWeight: 'bold' }}
            >
              Import {tradesToImport.length} Trades Now
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
