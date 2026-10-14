import { useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Select, DatePicker, Row, Col, Space, Button } from 'antd';
import dayjs from 'dayjs';
import { useAppData } from '../../context/AppDataContext.jsx';
import { CASH_ENTRY_KINDS } from '../../lib/constants.js';

const { Option } = Select;

export const CashEntryModal = () => {
  const {
    isCashModalOpen,
    editingCashEntry,
    cashForm,
    handleCloseCashModal,
    handleSaveCashEntry,
    activePortfolio,
    portfolios,
    liveRates,
    calculateDefaultWht
  } = useAppData();

  const selectedKind = Form.useWatch('kind', cashForm);
  const selectedCurrency = Form.useWatch('currency', cashForm) || 'THB';

  // Initialize or populate form
  useEffect(() => {
    if (isCashModalOpen) {
      if (editingCashEntry) {
        cashForm.setFieldsValue({
          date: editingCashEntry.date ? dayjs(editingCashEntry.date) : dayjs(),
          portfolio: editingCashEntry.portfolio || (activePortfolio === 'All Portfolios' ? (portfolios[0] || 'Main Trading') : activePortfolio),
          kind: editingCashEntry.kind || 'Deposit',
          asset: editingCashEntry.asset || '',
          currency: editingCashEntry.currency || 'THB',
          gross: editingCashEntry.gross !== undefined ? Number(editingCashEntry.gross) : 0,
          withholdingTax: editingCashEntry.withholdingTax !== undefined ? Number(editingCashEntry.withholdingTax) : 0,
          net: editingCashEntry.net !== undefined ? Number(editingCashEntry.net) : 0,
          fxToThb: editingCashEntry.fxToThb || (liveRates[editingCashEntry.currency] || 1.0),
          note: editingCashEntry.note || ''
        });
      } else {
        const defaultPort = activePortfolio === 'All Portfolios' ? (portfolios[0] || 'Main Trading') : activePortfolio;
        cashForm.setFieldsValue({
          date: dayjs(),
          portfolio: defaultPort,
          kind: 'Deposit',
          asset: '',
          currency: 'THB',
          gross: 0,
          withholdingTax: 0,
          net: 0,
          fxToThb: liveRates['THB'] || 1.0,
          note: ''
        });
      }
    }
  }, [isCashModalOpen, editingCashEntry, activePortfolio, portfolios, liveRates, cashForm]);

  // Recalculate net when gross or wht changes
  const handleGrossChange = (val) => {
    const gross = Number(val) || 0;
    const kind = cashForm.getFieldValue('kind');
    const currency = cashForm.getFieldValue('currency') || 'THB';
    const assetType = currency === 'THB' ? 'Thai Stock' : 'Global Stock';

    let newWht = cashForm.getFieldValue('withholdingTax') || 0;
    if (kind === 'Dividend' && !editingCashEntry) {
      newWht = calculateDefaultWht(gross, assetType, currency);
      cashForm.setFieldsValue({ withholdingTax: newWht });
    }
    cashForm.setFieldsValue({ net: Number((gross - newWht).toFixed(2)) });
  };

  const handleWhtChange = (val) => {
    const wht = Number(val) || 0;
    const gross = Number(cashForm.getFieldValue('gross')) || 0;
    cashForm.setFieldsValue({ net: Number((gross - wht).toFixed(2)) });
  };

  const handleCurrencyChange = (curr) => {
    const fx = liveRates[curr] || 1.0;
    cashForm.setFieldsValue({ fxToThb: fx });
  };

  return (
    <Modal
      title={editingCashEntry ? `Edit Cash Entry (${editingCashEntry.entryId})` : 'New Cash / Income Entry'}
      open={isCashModalOpen}
      onCancel={handleCloseCashModal}
      footer={null}
      width={600}
    >
      <Form
        form={cashForm}
        layout="vertical"
        onFinish={handleSaveCashEntry}
      >
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="date"
              label="Transaction Date"
              rules={[{ required: true, message: 'Please select date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="portfolio"
              label="Portfolio"
              rules={[{ required: true, message: 'Select portfolio' }]}
            >
              <Select>
                {portfolios.map(p => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="kind"
              label="Entry Kind"
              rules={[{ required: true, message: 'Select entry kind' }]}
            >
              <Select onChange={(kind) => {
                if (kind === 'Dividend') {
                  const gross = cashForm.getFieldValue('gross') || 0;
                  const currency = cashForm.getFieldValue('currency') || 'THB';
                  const wht = calculateDefaultWht(gross, currency === 'THB' ? 'Thai Stock' : 'Global Stock', currency);
                  cashForm.setFieldsValue({ withholdingTax: wht, net: gross - wht });
                } else if (kind === 'Deposit' || kind === 'Withdraw') {
                  cashForm.setFieldsValue({ withholdingTax: 0, net: cashForm.getFieldValue('gross') || 0 });
                }
              }}>
                {CASH_ENTRY_KINDS.map(k => (
                  <Option key={k} value={k}>{k}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="currency"
              label="Currency"
              rules={[{ required: true, message: 'Select currency' }]}
            >
              <Select onChange={handleCurrencyChange}>
                <Option value="THB">THB (฿)</Option>
                <Option value="USD">USD ($)</Option>
                <Option value="EUR">EUR (€)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {selectedKind === 'Dividend' && (
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="asset"
                label="Asset Name (Ticker)"
                rules={[{ required: true, message: 'Please enter asset symbol (e.g. BJC, PTT)' }]}
                extra="Enter the stock or fund paying this dividend."
              >
                <Input placeholder="e.g. BJC, AAPL, PTT" style={{ textTransform: 'uppercase' }} />
              </Form.Item>
            </Col>
          </Row>
        )}

        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="gross"
              label="Gross Amount"
              rules={[{ required: true, message: 'Enter gross amount' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                onChange={handleGrossChange}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="withholdingTax"
              label="Withholding Tax"
              extra={selectedKind === 'Dividend' && selectedCurrency === 'THB' ? '10% auto-calculated' : null}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                onChange={handleWhtChange}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="net"
              label="Net Amount"
              rules={[{ required: true, message: 'Net amount' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                precision={2}
                placeholder="0.00"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="fxToThb"
              label="FX Rate to THB"
              rules={[{ required: true, message: 'Enter FX rate' }]}
              extra={`Live rate: ${liveRates[selectedCurrency] || 1.0}`}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0.0001}
                precision={4}
                disabled={selectedCurrency === 'THB'}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item
              name="note"
              label="Note / Reference"
            >
              <Input placeholder="e.g. Opening Deposit, Q1 Dividend, Wire transfer #123" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right', marginTop: '16px' }}>
          <Space>
            <Button onClick={handleCloseCashModal}>Cancel</Button>
            <Button
              type="primary"
              htmlType="submit"
              style={{ backgroundColor: 'var(--success-color)', border: 'none', fontWeight: 'bold', color: '#06080f' }}
            >
              {editingCashEntry ? 'Save Changes' : 'Record Entry'}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
