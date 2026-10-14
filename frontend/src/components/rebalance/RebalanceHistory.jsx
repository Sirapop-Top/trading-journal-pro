import { useState, useMemo } from 'react';
import {
  Table,
  Tag,
  Button,
  Popconfirm,
  Space,
  Select,
  Typography,
  Card
} from 'antd';
import { UndoOutlined, HistoryOutlined } from '@ant-design/icons';
import { formatCurrency } from '../../lib/constants.js';

const { Text } = Typography;
const { Option } = Select;

export const RebalanceHistory = ({
  rebalanceLog = [],
  portfolios = [],
  activePortfolio = 'All Portfolios',
  displayCurrency = 'THB',
  liveRates = {},
  isCensored = false,
  onRevert,
  loading = false
}) => {
  const [filterPortfolio, setFilterPortfolio] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const filteredLogs = useMemo(() => {
    return (rebalanceLog || []).filter(item => {
      const matchPort = filterPortfolio === 'All'
        ? (activePortfolio === 'All Portfolios' || item.portfolio === activePortfolio)
        : item.portfolio === filterPortfolio;
      const matchStatus = filterStatus === 'All' || item.status === filterStatus;
      return matchPort && matchStatus;
    });
  }, [rebalanceLog, filterPortfolio, filterStatus, activePortfolio]);

  const formatVal = (thbVal) => {
    if (isCensored) return '••••••';
    const rate = displayCurrency === 'THB' ? 1 : (liveRates[displayCurrency] || 1);
    return formatCurrency(thbVal / rate, displayCurrency);
  };

  const columns = [
    {
      title: 'Rebalance ID',
      dataIndex: 'rebalanceId',
      key: 'rebalanceId',
      render: (id) => <Tag color="blue">{id}</Tag>
    },
    {
      title: 'Date',
      dataIndex: 'executedOn',
      key: 'executedOn',
      sorter: (a, b) => (a.executedOn > b.executedOn ? 1 : -1)
    },
    {
      title: 'Portfolio',
      dataIndex: 'portfolio',
      key: 'portfolio',
      render: (port) => <Tag color="cyan">{port}</Tag>
    },
    {
      title: 'Pair ID',
      dataIndex: 'pairId',
      key: 'pairId'
    },
    {
      title: 'Sold',
      key: 'sold',
      render: (_, r) => (
        <span>
          <span style={{ color: '#f87171', fontWeight: 600 }}>{r.sellAsset}</span>{' '}
          <Text type="secondary">({r.sellQty} @ {r.sellPrice})</Text>
        </span>
      )
    },
    {
      title: 'Bought',
      key: 'bought',
      render: (_, r) => (
        <span>
          <span style={{ color: '#34d399', fontWeight: 600 }}>{r.buyAsset}</span>{' '}
          <Text type="secondary">({r.buyQty} @ {r.buyPrice})</Text>
        </span>
      )
    },
    {
      title: 'Capital Moved',
      dataIndex: 'valueMovedTHB',
      key: 'valueMovedTHB',
      render: (val) => formatVal(val || 0)
    },
    {
      title: 'Ratio',
      key: 'ratio',
      render: (_, r) => (
        <span style={{ fontSize: 12 }}>
          {r.beforePctA?.toFixed(1)}% &rarr; <strong>{r.afterPctA?.toFixed(1)}%</strong>
        </span>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Done' ? 'success' : 'default'}>
          {status || 'Done'}
        </Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => {
        if (r.status === 'Reverted') {
          return <Text type="secondary" style={{ fontSize: 12 }}>Reverted</Text>;
        }
        return (
          <Popconfirm
            title="Revert Rebalance"
            description={`Are you sure you want to revert ${r.rebalanceId}? Both buy and sell journal trades will be removed.`}
            onConfirm={() => onRevert(r.rebalanceId)}
            okText="Yes, revert"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              danger
              icon={<UndoOutlined />}
              size="small"
              loading={loading}
            >
              Revert
            </Button>
          </Popconfirm>
        );
      }
    }
  ];

  return (
    <Card
      className="glassmorphism-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <HistoryOutlined style={{ color: '#38bdf8' }} />
          <span>Rebalance Audit & Execution History</span>
        </div>
      }
      extra={
        <Space orientation="horizontal" size="small">
          <Select
            value={filterPortfolio}
            onChange={setFilterPortfolio}
            style={{ width: 140 }}
            size="small"
          >
            <Option value="All">All Portfolios</Option>
            {portfolios.map(p => (
              <Option key={p} value={p}>{p}</Option>
            ))}
          </Select>
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 110 }}
            size="small"
          >
            <Option value="All">All Status</Option>
            <Option value="Done">Done</Option>
            <Option value="Reverted">Reverted</Option>
          </Select>
        </Space>
      }
    >
      <Table
        dataSource={filteredLogs}
        columns={columns}
        rowKey="rebalanceId"
        size="small"
        pagination={{ pageSize: 8, showSizeChanger: false }}
        locale={{ emptyText: 'No rebalance history logged yet.' }}
      />
    </Card>
  );
};
