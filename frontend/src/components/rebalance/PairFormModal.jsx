import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Slider,
  InputNumber,
  Segmented,
  Switch,
  DatePicker,
  Row,
  Col,
  Typography,
  Divider,
  Alert
} from 'antd';
import dayjs from 'dayjs';

const { Option } = Select;
const { Text } = Typography;

export const PairFormModal = ({
  open,
  initialValues,
  portfolios = [],
  activePortfolio = 'All Portfolios',
  onCancel,
  onSubmit,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [targetAVal, setTargetAVal] = useState(50);
  const [triggerMode, setTriggerMode] = useState('Drift');
  const [customFeeEnabled, setCustomFeeEnabled] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue({
          ...initialValues,
          scheduleAnchor: initialValues.scheduleAnchor ? dayjs(initialValues.scheduleAnchor) : dayjs()
        });
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTargetAVal(initialValues.targetA || 50);
        setTriggerMode(initialValues.mode || 'Drift');
        setCustomFeeEnabled(!!initialValues.customFee);
      } else {
        const defaultPort = activePortfolio !== 'All Portfolios' ? activePortfolio : (portfolios[0] || 'Main Trading');
        form.setFieldsValue({
          portfolio: defaultPort,
          pairName: '',
          assetA: 'BTC-USD',
          assetAType: 'Crypto',
          assetACurrency: 'USD',
          targetA: 50,
          assetB: 'BTC-USD:S1X',
          assetBType: 'Crypto Short 1x',
          assetBCurrency: 'USD',
          targetB: 50,
          mode: 'Drift',
          driftThreshold: 5,
          scheduleFrequency: 'Monthly',
          scheduleAnchor: dayjs(),
          customFee: false,
          feeAMode: 'percent',
          feeAValue: 0.1,
          feeBMode: 'percent',
          feeBValue: 0.05,
          notes: ''
        });
        setTargetAVal(50);
        setTriggerMode('Drift');
        setCustomFeeEnabled(false);
      }
    }
  }, [open, initialValues, activePortfolio, portfolios, form]);

  const handleFinish = (values) => {
    const payload = {
      ...values,
      pairId: initialValues?.pairId,
      targetA: targetAVal,
      targetB: 100 - targetAVal,
      scheduleAnchor: values.scheduleAnchor ? dayjs(values.scheduleAnchor).format('YYYY-MM-DD') : '',
      customFee: customFeeEnabled
    };
    onSubmit(payload);
  };

  return (
    <Modal
      title={initialValues ? `Edit Pair (${initialValues.pairId})` : 'Create Rebalance Pair'}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={loading}
      okText={initialValues ? 'Save Changes' : 'Create Pair'}
      width={620}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={{
          targetA: 50,
          mode: 'Drift',
          driftThreshold: 5,
          scheduleFrequency: 'Monthly'
        }}
      >
        <Row gutter={12}>
          <Col xs={24} sm={12}>
            <Form.Item
              name="portfolio"
              label="Portfolio (Must stay in same portfolio)"
              rules={[{ required: true, message: 'Please select a portfolio' }]}
            >
              <Select placeholder="Select portfolio">
                {portfolios.map(p => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item name="pairName" label="Pair Name (Optional)">
              <Input placeholder="e.g. BTC vs Short 1x" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
          <Text strong style={{ fontSize: 13 }}>Asset A (Base Asset)</Text>
        </Divider>

        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Form.Item
              name="assetA"
              label="Asset A Ticker"
              rules={[{ required: true, message: 'Asset A symbol is required' }]}
            >
              <Input placeholder="e.g. BTC-USD, CPALL" />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="assetAType" label="Type">
              <Select>
                <Option value="Crypto">Crypto</Option>
                <Option value="Thai Stock">Thai Stock</Option>
                <Option value="Global Stock">Global Stock</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="assetACurrency" label="Currency">
              <Select>
                <Option value="USD">USD</Option>
                <Option value="THB">THB</Option>
                <Option value="EUR">EUR</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
          <Text strong style={{ fontSize: 13 }}>Asset B (Counter Asset / Hedge)</Text>
        </Divider>

        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Form.Item
              name="assetB"
              label="Asset B Ticker"
              rules={[
                { required: true, message: 'Asset B symbol is required' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (value && value.toUpperCase() === getFieldValue('assetA')?.toUpperCase()) {
                      return Promise.reject(new Error('Asset B cannot be identical to Asset A'));
                    }
                    return Promise.resolve();
                  }
                })
              ]}
            >
              <Input placeholder="e.g. BTC-USD:S1X, BITI" />
            </Form.Item>
          </Col>
          <Col xs={12} sm={8}>
            <Form.Item name="assetBType" label="Type">
              <Select>
                <Option value="Crypto Short 1x">Crypto Short 1x</Option>
                <Option value="Crypto">Crypto</Option>
                <Option value="Thai Stock">Thai Stock</Option>
                <Option value="Global Stock">Global Stock</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col xs={12} sm={6}>
            <Form.Item name="assetBCurrency" label="Currency">
              <Select>
                <Option value="USD">USD</Option>
                <Option value="THB">THB</Option>
                <Option value="EUR">EUR</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
          <Text strong style={{ fontSize: 13 }}>Target Allocation Ratio</Text>
        </Divider>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text>Target A: <strong style={{ color: '#38bdf8' }}>{targetAVal}%</strong></Text>
            <Text>Target B: <strong style={{ color: '#a855f7' }}>{100 - targetAVal}%</strong></Text>
          </div>
          <Slider
            min={1}
            max={99}
            value={targetAVal}
            onChange={(val) => setTargetAVal(val)}
            tooltip={{ formatter: (val) => `${val}% / ${100 - val}%` }}
          />
        </div>

        <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
          <Text strong style={{ fontSize: 13 }}>Trigger Strategy</Text>
        </Divider>

        <Form.Item name="mode" label="Trigger Mode">
          <Segmented
            block
            value={triggerMode}
            onChange={(val) => setTriggerMode(val)}
            options={[
              { label: 'Drift Threshold', value: 'Drift' },
              { label: 'Fixed Schedule', value: 'Schedule' },
              { label: 'Manual Only', value: 'Manual' }
            ]}
          />
        </Form.Item>

        {triggerMode === 'Drift' && (
          <Form.Item
            name="driftThreshold"
            label="Drift Tolerance (±%)"
            extra="Alerts when actual ratio differs from target by this amount (e.g. 5% means rebalance at 45% or 55%)"
            rules={[{ required: true, message: 'Please specify drift threshold' }]}
          >
            <InputNumber min={0.5} max={40} step={0.5} style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
        )}

        {triggerMode === 'Schedule' && (
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="scheduleFrequency" label="Frequency">
                <Select>
                  <Option value="Weekly">Weekly</Option>
                  <Option value="Monthly">Monthly</Option>
                  <Option value="Quarterly">Quarterly</Option>
                  <Option value="Semiannual">Semiannual</Option>
                  <Option value="Yearly">Yearly</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="scheduleAnchor"
                label="Anchor Start Date"
                rules={[{ required: true, message: 'Anchor date is required' }]}
              >
                <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>
        )}

        {triggerMode === 'Manual' && (
          <Alert
            type="info"
            message="Manual Mode"
            description="You will never receive automatic alerts for this pair. You can initiate rebalancing manually at any time."
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
          <Text strong style={{ fontSize: 13 }}>Custom Fee Settings</Text>
        </Divider>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text>Enable Custom Fee for this pair</Text>
          <Switch checked={customFeeEnabled} onChange={setCustomFeeEnabled} />
        </div>

        {customFeeEnabled && (
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <div style={{ padding: 10, background: 'rgba(15, 23, 42, 0.4)', borderRadius: 6, marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Asset A Fee</Text>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="feeAMode" noStyle>
                      <Select style={{ width: '100%' }}>
                        <Option value="percent">Percent (%)</Option>
                        <Option value="fixed">Fixed</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="feeAValue" noStyle>
                      <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ padding: 10, background: 'rgba(15, 23, 42, 0.4)', borderRadius: 6, marginBottom: 12 }}>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Asset B Fee</Text>
                <Row gutter={8}>
                  <Col span={12}>
                    <Form.Item name="feeBMode" noStyle>
                      <Select style={{ width: '100%' }}>
                        <Option value="percent">Percent (%)</Option>
                        <Option value="fixed">Fixed</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="feeBValue" noStyle>
                      <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>
        )}

        <Form.Item name="notes" label="Notes / Strategy Description">
          <Input.TextArea rows={2} placeholder="e.g. Delta-neutral hedge for holding Bitcoin" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
