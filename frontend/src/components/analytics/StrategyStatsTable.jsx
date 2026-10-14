import { Card, Table, Tag, Progress, Space } from 'antd';
import { AimOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { formatCurrency } from '../../lib/constants.js';

export const StrategyStatsTable = () => {
  const {
    strategyDetailedStats = [],
    displayCurrency,
    isCensored
  } = useAppData();

  const columns = [
    {
      title: 'Strategy / Playbook',
      dataIndex: 'strategy',
      key: 'strategy',
      render: (val) => (
        <Space>
          <AimOutlined style={{ color: 'var(--primary-color)' }} />
          <strong style={{ color: '#ffffff' }}>{val || 'Unspecified'}</strong>
        </Space>
      )
    },
    {
      title: 'Closed Trades',
      dataIndex: 'trades',
      key: 'trades',
      align: 'right',
      sorter: (a, b) => a.trades - b.trades
    },
    {
      title: 'Win Rate',
      key: 'winRate',
      width: 170,
      sorter: (a, b) => a.winRate - b.winRate,
      render: (_, r) => (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
            <span style={{ color: '#94a3b8' }}>{r.wins}W / {r.losses}L</span>
            <strong style={{ color: r.winRate >= 50 ? '#34d399' : '#f87171' }}>{r.winRate.toFixed(1)}%</strong>
          </div>
          <Progress
            percent={r.winRate}
            showInfo={false}
            size="small"
            strokeColor={r.winRate >= 50 ? '#10b981' : '#ef4444'}
            trailColor="rgba(255,255,255,0.08)"
          />
        </div>
      )
    },
    {
      title: 'Total Realized P&L',
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      align: 'right',
      sorter: (a, b) => a.totalPnL - b.totalPnL,
      render: (val) => (
        <span
          style={{
            color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)',
            fontWeight: 800,
            fontFamily: 'var(--font-family-mono)'
          }}
        >
          {formatCurrency(val, displayCurrency, isCensored)}
        </span>
      )
    },
    {
      title: 'Profit Factor',
      dataIndex: 'profitFactor',
      key: 'profitFactor',
      align: 'right',
      sorter: (a, b) => a.profitFactor - b.profitFactor,
      render: (val) => {
        const color = val >= 2.0 ? '#34d399' : (val >= 1.0 ? '#38bdf8' : '#f87171');
        return (
          <Tag color="default" style={{ borderColor: color, color, fontWeight: 700 }}>
            {val >= 999 ? '∞' : val.toFixed(2)}
          </Tag>
        );
      }
    },
    {
      title: 'Avg Win',
      dataIndex: 'avgWin',
      key: 'avgWin',
      align: 'right',
      render: (val) => (
        <span style={{ color: '#34d399', fontFamily: 'var(--font-family-mono)' }}>
          {val > 0 ? formatCurrency(val, displayCurrency, isCensored) : '-'}
        </span>
      )
    },
    {
      title: 'Avg Loss',
      dataIndex: 'avgLoss',
      key: 'avgLoss',
      align: 'right',
      render: (val) => (
        <span style={{ color: '#f87171', fontFamily: 'var(--font-family-mono)' }}>
          {val > 0 ? formatCurrency(-val, displayCurrency, isCensored) : '-'}
        </span>
      )
    },
    {
      title: 'Payoff Ratio (W/L)',
      dataIndex: 'payoffRatio',
      key: 'payoffRatio',
      align: 'right',
      sorter: (a, b) => a.payoffRatio - b.payoffRatio,
      render: (val) => (
        <span style={{ fontWeight: 600, fontFamily: 'var(--font-family-mono)' }}>
          {val > 0 ? `${val.toFixed(2)}x` : '-'}
        </span>
      )
    }
  ];

  return (
    <Card
      className="glass-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AimOutlined style={{ color: '#f59e0b' }} />
          <span>Strategy Win Rate & Expectancy Analytics</span>
        </div>
      }
      styles={{ body: { padding: '12px' } }}
    >
      <Table
        columns={columns}
        dataSource={strategyDetailedStats}
        rowKey="strategy"
        pagination={false}
        size="small"
        scroll={{ x: 950 }}
        locale={{ emptyText: 'No closed trades recorded to evaluate strategy performance.' }}
      />
    </Card>
  );
};
