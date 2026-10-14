import { Modal, Form, Input, InputNumber, Select, DatePicker, Row, Col, Space, Button, Typography } from 'antd';
import { SyncOutlined, CheckCircleFilled, ExclamationCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Option } = Select;
const { Text } = Typography;

export const LogTradeModal = () => {
  const {
    isTradeModalOpen,
    setIsTradeModalOpen,
    tradeForm,
    handleAddTrade,
    activePortfolio,
    portfolios,
    formAction,
    setFormAction,
    tickerValidation,
    setTickerValidation,
    handleValidateTicker
  } = useAppData();

  return (
    <Modal
      title="Log New Trade Entry"
      open={isTradeModalOpen}
      onCancel={() => setIsTradeModalOpen(false)}
      footer={null}
      width={600}
    >
      <Form
        form={tradeForm}
        layout="vertical"
        onFinish={handleAddTrade}
        initialValues={{
          portfolio: activePortfolio === 'All Portfolios' ? (portfolios[0] || 'Main Investment') : activePortfolio,
          action: 'Buy',
          currency: 'THB',
          assetType: 'Thai Stock',
          date: dayjs(),
          feeAmount: 0.0
        }}
      >
        {/* Row 1: Action, Asset Name, Asset Category */}
        <Row gutter={16}>
          <Col xs={24} sm={6}>
            <Form.Item
              name="action"
              label="Action"
              rules={[{ required: true, message: 'Select Action' }]}
              style={{ marginBottom: 0 }}
            >
              <Input style={{ display: 'none' }} />
            </Form.Item>
            <div style={{ marginBottom: '24px' }}>
              <div className="action-segmented">
                <div 
                  className={`action-segmented-btn buy ${formAction === 'Buy' ? 'active' : ''}`}
                  onClick={() => {
                    setFormAction('Buy');
                    tradeForm.setFieldsValue({ action: 'Buy' });
                  }}
                >
                  BUY
                </div>
                <div 
                  className={`action-segmented-btn sell ${formAction === 'Sell' ? 'active' : ''}`}
                  onClick={() => {
                    setFormAction('Sell');
                    tradeForm.setFieldsValue({ action: 'Sell' });
                  }}
                >
                  SELL
                </div>
              </div>
            </div>
          </Col>
          
          <Col xs={24} sm={10}>
            <Form.Item
              name="assetName"
              label="Asset Name (Ticker)"
              rules={[{ required: true, message: 'Please input asset name (e.g. BJC, MSTR)' }]}
              extra={
                <div style={{ marginTop: '4px' }}>
                  {tickerValidation.status === 'validating' && (
                    <div className="ticker-verify-card">
                      <SyncOutlined spin style={{ color: 'var(--primary-color)', fontSize: '18px' }} />
                      <div>
                        <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}>Validating Symbol...</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Verifying ticker on Yahoo Finance</div>
                      </div>
                    </div>
                  )}
                  {tickerValidation.status === 'success' && (
                    <div className="ticker-verify-card success">
                      <CheckCircleFilled style={{ color: 'var(--success-color)', fontSize: '18px' }} />
                      <div>
                        <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}>{tickerValidation.checkedTicker} verified</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{tickerValidation.message}</div>
                      </div>
                    </div>
                  )}
                  {tickerValidation.status === 'error' && (
                    <div className="ticker-verify-card error">
                      <ExclamationCircleOutlined style={{ color: 'var(--danger-color)', fontSize: '18px' }} />
                      <div>
                        <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '13px' }}>Verification Failed</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{tickerValidation.message}</div>
                      </div>
                    </div>
                  )}
                  {tickerValidation.status === 'idle' && (
                    <Text style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Please verify ticker before logging.</Text>
                  )}
                </div>
              }
            >
              <Input 
                placeholder="e.g. BJC, KCE, MSTR" 
                style={{ textTransform: 'uppercase' }} 
                onChange={() => {
                  setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
                }}
                addonAfter={
                  <span 
                    onClick={handleValidateTicker} 
                    style={{ cursor: 'pointer', color: 'var(--primary-color)', fontWeight: 'bold', display: 'inline-block', padding: '0 4px' }}
                  >
                    {tickerValidation.status === 'validating' ? <SyncOutlined spin /> : 'Verify'}
                  </span>
                }
              />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={8}>
            <Form.Item
              name="assetType"
              label="Asset Category"
              rules={[{ required: true, message: 'Please select asset type' }]}
            >
              <Select onChange={() => {
                setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
              }}>
                <Option value="Thai Stock">Thai Stock</Option>
                <Option value="Global Stock">Global Stock</Option>
                <Option value="Crypto">Crypto</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Row 2: Transaction Date, Select Portfolio Target, Local Currency */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="date"
              label="Transaction Date"
              rules={[{ required: true, message: 'Please select a date' }]}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={10}>
            <Form.Item
              name="portfolio"
              label="Select Portfolio Target"
              rules={[{ required: true, message: 'Please select a portfolio' }]}
            >
              <Select>
                {portfolios.map(p => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={6}>
            <Form.Item
              name="currency"
              label="Local Currency"
              rules={[{ required: true, message: 'Select Currency' }]}
            >
              <Select>
                <Option value="THB">THB (฿)</Option>
                <Option value="USD">USD ($)</Option>
                <Option value="EUR">EUR (€)</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        {/* Row 3: Quantity, Price/Unit, Trading Fee Amount */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Input quantity' }]}
            >
              <InputNumber min={0.000001} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={8}>
            <Form.Item
              name="priceUnit"
              label="Price / Unit (Local)"
              rules={[{ required: true, message: 'Input price per unit' }]}
            >
              <InputNumber min={0.000001} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          
          <Col xs={24} sm={8}>
            <Form.Item
              name="feeAmount"
              label="Trading Fee Amount"
              rules={[{ required: true, message: 'Input fee amount' }]}
            >
              <InputNumber
                min={0}
                style={{ width: '100%' }}
                placeholder="e.g. 0.00"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* Row 4: Strategy */}
        <Form.Item
          name="why"
          label="Strategy / Decision Reason"
        >
          <Input placeholder="e.g. CDC Action Zone, RSI > 70, Breakthrough" />
        </Form.Item>

        {/* Row 5: Remarks */}
        <Form.Item
          name="remark"
          label="Remarks (Notes)"
        >
          <Input.TextArea rows={2} placeholder="Optional notes about this trade..." />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setIsTradeModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" style={{ backgroundColor: 'var(--success-color)', border: 'none', fontWeight: 'bold', color: '#06080f' }}>
              Log Trade
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
