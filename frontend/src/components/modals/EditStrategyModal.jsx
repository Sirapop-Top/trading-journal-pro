import { Modal, Form, Input, InputNumber, Select, Row, Col, Space, Button } from 'antd';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Option } = Select;

export const EditStrategyModal = () => {
  const {
    isEditStrategyModalOpen,
    setIsEditStrategyModalOpen,
    editingTrade,
    setEditingTrade,
    editStrategyForm,
    handleUpdateStrategy,
    isCustomStrategy,
    setIsCustomStrategy,
    isSyncing
  } = useAppData();

  return (
    <Modal
      title={`Edit Trade Entry for ${editingTrade?.action?.toUpperCase() || ''} ${editingTrade?.assetName || ''}`}
      open={isEditStrategyModalOpen}
      onCancel={() => {
        setIsEditStrategyModalOpen(false);
        setEditingTrade(null);
        editStrategyForm.resetFields();
      }}
      footer={null}
      width={500}
    >
      <Form
        form={editStrategyForm}
        layout="vertical"
        onFinish={handleUpdateStrategy}
      >
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="quantity"
              label="Quantity"
              rules={[{ required: true, message: 'Please input quantity' }]}
            >
              <InputNumber min={0.000001} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="priceUnit"
              label="Price / Unit"
              rules={[{ required: true, message: 'Please input price per unit' }]}
            >
              <InputNumber min={0.000001} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item
              name="feeAmount"
              label="Fee Amount"
              rules={[{ required: true, message: 'Please input fee amount' }]}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="why"
          label="Strategy / Decision Reason"
          rules={[{ required: true, message: 'Please select a strategy' }]}
        >
          <Select 
            placeholder="Select strategy" 
            onChange={(value) => {
              setIsCustomStrategy(value === 'Other');
            }}
          >
            <Option value="CDC Action Zone">CDC Action Zone</Option>
            <Option value="Breakout">Breakout</Option>
            <Option value="EMA Cross">EMA Cross</Option>
            <Option value="Support/Resistance Bounce">Support/Resistance Bounce</Option>
            <Option value="Value Investment">Value Investment</Option>
            <Option value="Rebalance">Rebalance</Option>
            <Option value="Other">Other (Type custom strategy...)</Option>
          </Select>
        </Form.Item>

        {isCustomStrategy && (
          <Form.Item
            name="customWhy"
            label="Custom Strategy"
            rules={[{ required: true, message: 'Please input your custom strategy' }]}
          >
            <Input placeholder="Enter your custom strategy (e.g. RSI > 70)" />
          </Form.Item>
        )}

        <Form.Item
          name="remark"
          label="Private Notes / Diary"
        >
          <Input.TextArea rows={4} placeholder="Log trade notes, emotional state, or exit plan..." />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => {
              setIsEditStrategyModalOpen(false);
              setEditingTrade(null);
              editStrategyForm.resetFields();
            }}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={isSyncing} style={{ color: '#06080f', fontWeight: 'bold' }}>
              Save Changes
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};
