import { Modal, Form, Input, InputNumber, Select, Space, Button, Typography } from 'antd';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Text } = Typography;
const { Option } = Select;

export const PortfolioModals = () => {
  const {
    isPortfolioModalOpen,
    setIsPortfolioModalOpen,
    portfolioForm,
    handleAddPortfolio,
    portfolios,
    isRenameModalOpen,
    setIsRenameModalOpen,
    renameForm,
    handleRenamePortfolio,
    renameTarget,
    isTransferModalOpen,
    setIsTransferModalOpen,
    editingTrade,
    setEditingTrade,
    transferForm,
    handleTransferTrade
  } = useAppData();

  return (
    <>
      {/* MODAL 2: CREATE PORTFOLIO */}
      <Modal
        title="Create Custom Portfolio"
        open={isPortfolioModalOpen}
        onCancel={() => setIsPortfolioModalOpen(false)}
        footer={null}
      >
        <Form
          form={portfolioForm}
          layout="vertical"
          onFinish={handleAddPortfolio}
        >
          <Form.Item
            name="name"
            label="Portfolio Name"
            rules={[
              { required: true, message: 'Please input portfolio name' },
              { 
                validator: (_, value) => {
                  if (value && portfolios.includes(value.trim())) {
                    return Promise.reject(new Error('Portfolio name already exists!'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input placeholder="e.g. Retirement Savings, Swing Trade" />
          </Form.Item>

          <Form.Item
            name="initialCapital"
            label="Initial Capital"
            initialValue={2000000}
            rules={[{ required: true, message: 'Please input initial capital' }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            name="targetStocks"
            label="Amount of Stock to Hold (Target)"
            initialValue={50}
            rules={[{ required: true, message: 'Please input amount of stocks' }]}
          >
            <InputNumber min={1} max={500} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsPortfolioModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ color: '#06080f', fontWeight: 'bold' }}>
                Create Portfolio
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 3: CONFIGURE PORTFOLIO */}
      <Modal
        title="Configure Portfolio"
        open={isRenameModalOpen}
        onCancel={() => setIsRenameModalOpen(false)}
        footer={null}
      >
        <Form
          form={renameForm}
          layout="vertical"
          onFinish={handleRenamePortfolio}
        >
          <Form.Item
            name="name"
            label="Portfolio Name"
            rules={[
              { required: true, message: 'Please input a portfolio name' },
              { 
                validator: (_, value) => {
                  if (value && portfolios.includes(value.trim()) && value.trim() !== renameTarget) {
                    return Promise.reject(new Error('Portfolio name already exists!'));
                  }
                  return Promise.resolve();
                }
              }
            ]}
          >
            <Input placeholder="e.g. Retirement Fund, Swing Trades" />
          </Form.Item>

          <Form.Item
            name="initialCapital"
            label="Initial Capital"
            rules={[{ required: true, message: 'Please input initial capital' }]}
          >
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            name="targetStocks"
            label="Amount of Stock to Hold (Target)"
            rules={[{ required: true, message: 'Please input amount of stocks' }]}
          >
            <InputNumber min={1} max={500} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setIsRenameModalOpen(false)}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ color: '#06080f', fontWeight: 'bold' }}>
                Save Configuration
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL 4: TRANSFER TRADE */}
      <Modal
        title={`Transfer Trade (${editingTrade?.action?.toUpperCase() || ''} ${editingTrade?.quantity || ''} ${editingTrade?.assetName || ''}) to Portfolio`}
        open={isTransferModalOpen}
        onCancel={() => {
          setIsTransferModalOpen(false);
          setEditingTrade(null);
          transferForm.resetFields();
        }}
        footer={null}
      >
        <div style={{ marginBottom: '18px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
          <Text style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Moving transaction of <strong>{editingTrade?.assetName}</strong>.
          </Text>
          <Text style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Current Portfolio: <strong style={{ color: 'var(--primary-color)' }}>{editingTrade?.portfolio}</strong>
          </Text>
        </div>

        <Form
          form={transferForm}
          layout="vertical"
          onFinish={handleTransferTrade}
        >
          <Form.Item
            name="targetPortfolio"
            label="Select Destination Portfolio"
            rules={[{ required: true, message: 'Please select a destination portfolio' }]}
          >
            <Select placeholder="Choose target portfolio...">
              {portfolios.filter(p => p !== editingTrade?.portfolio).map(p => (
                <Option key={p} value={p}>{p}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => {
                setIsTransferModalOpen(false);
                setEditingTrade(null);
                transferForm.resetFields();
              }}>Cancel</Button>
              <Button type="primary" htmlType="submit" style={{ color: '#06080f', fontWeight: 'bold' }}>
                Confirm Transfer
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};
