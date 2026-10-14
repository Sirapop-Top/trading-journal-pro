import { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
  Alert,
  Typography,
  Divider,
  Row,
  Col,
  Input,
  InputNumber,
  Button,
  Space,
  Tag
} from 'antd';
import {
  SwapOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  computeOrder,
  DEFAULT_FEES,
  previewAfter,
  round2
} from '../../lib/rebalanceEngine.js';
import { formatCurrency } from '../../lib/constants.js';

const { Text } = Typography;

export const RebalanceCalculator = ({
  open,
  pair,
  trades = [],
  livePrices = {},
  liveRates = {},
  displayCurrency = 'THB',
  cashOnHand = null,
  onClose,
  onExecute,
  loading = false
}) => {
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [reason, setReason] = useState('');

  // Editable legs state
  const [sellQty, setSellQty] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [sellFee, setSellFee] = useState(0);
  const [buyQty, setBuyQty] = useState(0);
  const [buyPrice, setBuyPrice] = useState(0);
  const [buyFee, setBuyFee] = useState(0);

  // Compute fee settings
  const feeConfigs = useMemo(() => {
    if (!pair) return {};
    if (pair.customFee) {
      return {
        A: { mode: pair.feeAMode || 'percent', value: pair.feeAValue || 0 },
        B: { mode: pair.feeBMode || 'percent', value: pair.feeBValue || 0 }
      };
    }
    return {
      A: DEFAULT_FEES[pair.assetAType] || { mode: 'percent', value: 0.1 },
      B: DEFAULT_FEES[pair.assetBType] || { mode: 'percent', value: 0.1 }
    };
  }, [pair]);

  // Initial suggested order
  const suggestedOrder = useMemo(() => {
    if (!open || !pair) return null;
    return computeOrder(pair, trades, livePrices, liveRates, {
      fees: feeConfigs,
      date,
      minDrift: 0 // allow calculation anytime calculator is opened
    });
  }, [open, pair, trades, livePrices, liveRates, feeConfigs, date]);

  // Sync state with suggested order on open
  useEffect(() => {
    if (suggestedOrder && !suggestedOrder.noAction) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSellQty(suggestedOrder.sell.quantity);
      setSellPrice(suggestedOrder.sell.priceUnit);
      setSellFee(suggestedOrder.sell.feeAmount);
      setBuyQty(suggestedOrder.buy.quantity);
      setBuyPrice(suggestedOrder.buy.priceUnit);
      setBuyFee(suggestedOrder.buy.feeAmount);
      setReason(
        suggestedOrder.state?.drift
          ? `Drift ${Math.abs(suggestedOrder.state.drift).toFixed(2)}% > ${pair.driftThreshold || 5}%`
          : `Rebalance ${pair.pairName || pair.pairId}`
      );
    }
  }, [suggestedOrder, pair]);

  // Dynamically recalculated preview after user edits
  const dynamicPreview = useMemo(() => {
    if (!pair || !suggestedOrder || suggestedOrder.noAction) return null;
    const sellLeg = {
      ...suggestedOrder.sell,
      quantity: sellQty,
      priceUnit: sellPrice,
      feeAmount: sellFee,
      date
    };
    const buyLeg = {
      ...suggestedOrder.buy,
      quantity: buyQty,
      priceUnit: buyPrice,
      feeAmount: buyFee,
      date
    };
    return previewAfter(pair, trades, [sellLeg, buyLeg], livePrices, liveRates);
  }, [pair, suggestedOrder, sellQty, sellPrice, sellFee, buyQty, buyPrice, buyFee, date, trades, livePrices, liveRates]);

  const formatVal = (thb) => {
    const rate = displayCurrency === 'THB' ? 1 : (liveRates[displayCurrency] || 1);
    return formatCurrency(thb / rate, displayCurrency);
  };

  const handleConfirm = () => {
    if (!suggestedOrder || !pair) return;
    const rebalancePayload = {
      pairId: pair.pairId,
      portfolio: pair.portfolio,
      date,
      trigger: pair.mode,
      reason,
      sell: {
        ...suggestedOrder.sell,
        quantity: sellQty,
        priceUnit: sellPrice,
        feeAmount: round2(sellFee)
      },
      buy: {
        ...suggestedOrder.buy,
        quantity: buyQty,
        priceUnit: buyPrice,
        feeAmount: round2(buyFee)
      },
      snapshot: {
        beforePctA: round2(suggestedOrder.beforePctA),
        targetPctA: round2(pair.targetA),
        afterPctA: round2(dynamicPreview?.pctA ?? suggestedOrder.afterPctA),
        valueMovedTHB: round2(suggestedOrder.valueMovedTHB),
        realizedPnLTHB: round2(dynamicPreview?.realizedTHB ?? suggestedOrder.estRealizedTHB)
      }
    };
    onExecute(rebalancePayload);
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SwapOutlined style={{ color: '#38bdf8' }} />
          <span>Execute Rebalance — {pair?.pairName || pair?.pairId}</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={560}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="primary"
            disabled={!suggestedOrder || suggestedOrder.noAction || sellQty <= 0 || buyQty <= 0}
            loading={loading}
            onClick={handleConfirm}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
              borderColor: '#0ea5e9'
            }}
          >
            Confirm & Log Rebalance
          </Button>
        </div>
      }
    >
      {!suggestedOrder ? null : suggestedOrder.noAction ? (
        <Alert
          type="warning"
          message="Rebalance Not Needed / Unavailable"
          description={suggestedOrder.message || 'Holding values or price feeds are insufficient for order sizing.'}
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : (
        <div>
          {/* Summary Banner */}
          <div
            style={{
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 8,
              padding: 14,
              marginBottom: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>REBALANCE DIRECTION</Text>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                  Sell <span style={{ color: '#f87171' }}>{suggestedOrder.sell.assetName}</span>
                  {' '}<ArrowRightOutlined style={{ fontSize: 12, margin: '0 4px' }} />{' '}
                  Buy <span style={{ color: '#34d399' }}>{suggestedOrder.buy.assetName}</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>PORTFOLIO RATIO</Text>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                  <span style={{ color: '#94a3b8' }}>{suggestedOrder.beforePctA?.toFixed(1)}%</span>
                  {' '}&rarr;{' '}
                  <span style={{ color: '#38bdf8' }}>{dynamicPreview?.pctA?.toFixed(1) || suggestedOrder.afterPctA?.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            {typeof cashOnHand === 'number' && (
              <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed rgba(56, 189, 248, 0.2)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Portfolio Cash on Hand:</span>
                <span style={{ fontWeight: 600, color: '#38bdf8', fontFamily: 'var(--font-family-mono)' }}>
                  {formatCurrency(cashOnHand, displayCurrency)}
                </span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {suggestedOrder.warnings?.length > 0 && (
            <Alert
              type="warning"
              message={suggestedOrder.warnings.join(' ')}
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Rebalance Parameters */}
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col span={12}>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Date</Text>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </Col>
            <Col span={12}>
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Reason / Notes</Text>
              <Input
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Decision reason"
              />
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '14px 0 10px' }}>
            <Text strong style={{ color: '#f87171' }}>Leg 1: Sell Asset</Text>
          </Divider>

          <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text strong style={{ color: '#f8fafc' }}>{suggestedOrder.sell.assetName}</Text>
              <Tag color="volcano">SELL</Tag>
            </div>
            <Row gutter={8}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Quantity</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 2 }}
                  value={sellQty}
                  onChange={v => setSellQty(Number(v) || 0)}
                  min={0}
                  step={0.0001}
                />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Price / Unit</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 2 }}
                  value={sellPrice}
                  onChange={v => setSellPrice(Number(v) || 0)}
                  min={0}
                />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Fee ({suggestedOrder.sell.currency})</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 2 }}
                  value={sellFee}
                  onChange={v => setSellFee(Number(v) || 0)}
                  min={0}
                  step={0.01}
                />
              </Col>
            </Row>
          </div>

          <Divider orientation="left" style={{ margin: '14px 0 10px' }}>
            <Text strong style={{ color: '#34d399' }}>Leg 2: Buy Asset</Text>
          </Divider>

          <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text strong style={{ color: '#f8fafc' }}>{suggestedOrder.buy.assetName}</Text>
              <Tag color="green">BUY</Tag>
            </div>
            <Row gutter={8}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Quantity</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 2 }}
                  value={buyQty}
                  onChange={v => setBuyQty(Number(v) || 0)}
                  min={0}
                  step={0.0001}
                />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Price / Unit</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 2 }}
                  value={buyPrice}
                  onChange={v => setBuyPrice(Number(v) || 0)}
                  min={0}
                />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>Fee ({suggestedOrder.buy.currency})</Text>
                <InputNumber
                  style={{ width: '100%', marginTop: 2 }}
                  value={buyFee}
                  onChange={v => setBuyFee(Number(v) || 0)}
                  min={0}
                  step={0.01}
                />
              </Col>
            </Row>
          </div>

          {/* Impact summary */}
          <div
            style={{
              padding: 12,
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <Text type="secondary">Est. Capital Moved:</Text>
              <Text strong style={{ color: '#f8fafc' }}>{formatVal(suggestedOrder.valueMovedTHB)}</Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text type="secondary">Est. Realized P&L from Sell:</Text>
              <Text
                strong
                style={{
                  color: (dynamicPreview?.realizedTHB ?? suggestedOrder.estRealizedTHB) >= 0 ? '#34d399' : '#f87171'
                }}
              >
                {formatVal(dynamicPreview?.realizedTHB ?? suggestedOrder.estRealizedTHB)}
              </Text>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <Space orientation="horizontal" size={6} style={{ color: '#94a3b8', fontSize: 12 }}>
              <CheckCircleOutlined />
              <span>
                Both trades will be tagged with <strong>RB ID</strong> in your Journal.
              </span>
            </Space>
          </div>
        </div>
      )}
    </Drawer>
  );
};
