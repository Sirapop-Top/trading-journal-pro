import { Card, Tag, Button, Progress, Popconfirm, Space, Typography, Tooltip } from 'antd';
import {
  SwapOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  DeleteOutlined,
  AlertOutlined,
  CalendarOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../lib/constants.js';

const { Text } = Typography;

export const PairCard = ({
  pair,
  displayCurrency = 'THB',
  liveRates = {},
  isCensored = false,
  onRebalanceNow,
  onEdit,
  onToggleStatus,
  onDelete
}) => {
  const {
    pairId,
    portfolio,
    pairName,
    assetA,
    assetAType,
    targetA,
    assetB,
    assetBType,
    targetB,
    mode,
    driftThreshold,
    state,
    dueInfo,
    status
  } = pair;

  const isPaused = status === 'Paused';
  const { pctA, pctB, drift, valueA, valueB, total, missingPrice, hA, hB } = state || {};
  const isDue = dueInfo?.due;
  const severity = dueInfo?.severity || 'ok';

  // Severity color tokens
  const badgeColor = isPaused
    ? 'default'
    : severity === 'due'
    ? 'error'
    : severity === 'warn'
    ? 'warning'
    : 'success';

  // Format local values into display currency
  const formatVal = (thbVal) => {
    if (isCensored) return '••••••';
    const rate = displayCurrency === 'THB' ? 1 : (liveRates[displayCurrency] || 1);
    const converted = thbVal / rate;
    return formatCurrency(converted, displayCurrency);
  };

  return (
    <Card
      className="glassmorphism-card"
      style={{
        border: isDue ? '1px solid rgba(239, 68, 68, 0.4)' : undefined,
        background: isDue ? 'rgba(239, 68, 68, 0.04)' : undefined,
        marginBottom: 16
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space orientation="horizontal" size="small">
            <Text strong style={{ fontSize: 16, color: '#f8fafc' }}>
              {pairName || `${assetA} vs ${assetB}`}
            </Text>
            <Tag color="cyan" style={{ fontSize: 11 }}>{portfolio}</Tag>
            <Tag color={badgeColor} style={{ fontSize: 11 }}>
              {isPaused ? 'Paused' : `${mode} Mode`}
            </Tag>
          </Space>
          <Text type="secondary" style={{ fontSize: 12 }}>ID: {pairId}</Text>
        </div>
      }
      extra={
        <Space orientation="horizontal" size="small">
          <Button
            type="primary"
            icon={<SwapOutlined />}
            size="small"
            disabled={isPaused || missingPrice || total <= 0}
            onClick={() => onRebalanceNow(pair)}
            style={{
              background: isDue ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined,
              borderColor: isDue ? '#ef4444' : undefined
            }}
          >
            Rebalance
          </Button>
          <Tooltip title="Edit Pair">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => onEdit(pair)}
            />
          </Tooltip>
          <Tooltip title={isPaused ? 'Activate' : 'Pause'}>
            <Button
              icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              size="small"
              onClick={() => onToggleStatus(pairId, status)}
            />
          </Tooltip>
          <Popconfirm
            title="Delete Pair"
            description={`Are you sure you want to delete ${pairName || pairId}?`}
            onConfirm={() => onDelete(pairId)}
            okText="Yes, delete"
            cancelText="No"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      }
    >
      {/* Due / Warning Banner */}
      {isDue && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 6,
            padding: '6px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: '#f87171',
            fontSize: 12
          }}
        >
          <AlertOutlined />
          <span style={{ fontWeight: 600 }}>Action Required:</span>
          <span>{dueInfo?.reason}</span>
        </div>
      )}

      {/* Proportional Allocation Progress */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
          <span>
            <strong style={{ color: '#38bdf8' }}>{assetA}</strong>: {pctA?.toFixed(1) || 0}%{' '}
            <Text type="secondary">(Target: {targetA}%)</Text>
          </span>
          <span>
            <strong style={{ color: '#a855f7' }}>{assetB}</strong>: {pctB?.toFixed(1) || 0}%{' '}
            <Text type="secondary">(Target: {targetB}%)</Text>
          </span>
        </div>
        <Progress
          percent={pctA || 0}
          success={{ percent: targetA, strokeColor: 'rgba(255, 255, 255, 0.3)' }}
          strokeColor="#38bdf8"
          railColor="rgba(168, 85, 247, 0.6)"
          showInfo={false}
          size={['100%', 10]}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12 }}>
          <Text type="secondary">
            Drift:{' '}
            <span
              style={{
                color: Math.abs(drift || 0) >= (driftThreshold || 5) ? '#f87171' : '#34d399',
                fontWeight: 600
              }}
            >
              {(drift || 0) > 0 ? `+${(drift || 0).toFixed(2)}%` : `${(drift || 0).toFixed(2)}%`}
            </span>
          </Text>
          {mode === 'Schedule' && dueInfo?.nextDueDate && (
            <Text type="secondary">
              <CalendarOutlined style={{ marginRight: 4 }} />
              Next: {dueInfo.nextDueDate}
            </Text>
          )}
          {mode === 'Drift' && (
            <Text type="secondary">Threshold: ±{driftThreshold}%</Text>
          )}
        </div>
      </div>

      {/* Assets Breakdown Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          padding: 10,
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: 8
        }}
      >
        <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8' }} />
            <Text strong style={{ color: '#f8fafc', fontSize: 13 }}>{assetA}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {assetAType} · {hA?.qty > 0 ? (isCensored ? '••••' : hA.qty) : '0 units'}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Text strong style={{ fontSize: 13, color: '#f1f5f9' }}>
              {formatVal(valueA || 0)}
            </Text>
          </div>
        </div>

        <div style={{ paddingLeft: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }} />
            <Text strong style={{ color: '#f8fafc', fontSize: 13 }}>{assetB}</Text>
          </div>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
            {assetBType} · {hB?.qty > 0 ? (isCensored ? '••••' : hB.qty) : '0 units'}
          </Text>
          <div style={{ marginTop: 4 }}>
            <Text strong style={{ fontSize: 13, color: '#f1f5f9' }}>
              {formatVal(valueB || 0)}
            </Text>
          </div>
        </div>
      </div>

      {/* Total pair value & status info */}
      <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
        <Text type="secondary">
          Pair Total: <strong style={{ color: '#f8fafc' }}>{formatVal(total || 0)}</strong>
        </Text>
        {missingPrice ? (
          <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>Live price missing</Tag>
        ) : !isDue && !isPaused ? (
          <Space orientation="horizontal" size={4} style={{ color: '#34d399', fontSize: 11 }}>
            <CheckCircleOutlined /> Balanced
          </Space>
        ) : null}
      </div>
    </Card>
  );
};
