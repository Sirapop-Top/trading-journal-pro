import { useState, useMemo } from 'react';
import { Table, Tag, Input, Select, Space, Button, Popconfirm, Typography } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { formatCurrency, CASH_KIND_COLORS, CURRENCY_SYMBOLS } from '../../lib/constants.js';

const { Option } = Select;
const { Text } = Typography;

export const CashStatementTable = () => {
  const {
    cashStatement = [],
    displayCurrency,
    isCensored,
    handleOpenEditCashEntry,
    handleDeleteCashEntry,
    activePortfolio
  } = useAppData();

  const [searchText, setSearchText] = useState('');
  const [kindFilter, setKindFilter] = useState('All');

  const filteredStatement = useMemo(() => {
    return cashStatement.filter(item => {
      // Kind filter
      if (kindFilter !== 'All') {
        if (kindFilter === 'Trades') {
          if (!item.isTrade) return false;
        } else if (kindFilter === 'Cash Entries') {
          if (item.isTrade) return false;
        } else {
          if ((item.kind || '').toLowerCase() !== kindFilter.toLowerCase()) return false;
        }
      }

      // Search text
      if (searchText.trim() !== '') {
        const q = searchText.toLowerCase().trim();
        const descMatch = (item.description || '').toLowerCase().includes(q);
        const assetMatch = (item.asset || '').toLowerCase().includes(q);
        const portMatch = (item.portfolio || '').toLowerCase().includes(q);
        if (!descMatch && !assetMatch && !portMatch) return false;
      }

      return true;
    });
  }, [cashStatement, kindFilter, searchText]);

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d) => <span style={{ fontFamily: 'monospace' }}>{d}</span>
    },
    ...(activePortfolio === 'All Portfolios' ? [{
      title: 'Portfolio',
      dataIndex: 'portfolio',
      key: 'portfolio',
      width: 130,
      render: (p) => <Tag color="blue">{p}</Tag>
    }] : []),
    {
      title: 'Type',
      dataIndex: 'kind',
      key: 'kind',
      width: 120,
      render: (k, row) => {
        if (row.isTrade) {
          const isBuy = (k || '').toLowerCase().includes('buy');
          return <Tag color={isBuy ? 'volcano' : 'cyan'}>{k}</Tag>;
        }
        const color = CASH_KIND_COLORS[k] || '#8b5cf6';
        return <Tag style={{ color: '#fff', backgroundColor: color, border: 'none' }}>{k}</Tag>;
      }
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc, row) => (
        <span>
          <Text strong style={{ color: 'var(--text-primary)' }}>{desc}</Text>
          {row.rawItem?.note && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {row.rawItem.note}
            </div>
          )}
        </span>
      )
    },
    {
      title: 'Net (Local)',
      key: 'netLocal',
      align: 'right',
      width: 140,
      render: (_, row) => {
        const sym = CURRENCY_SYMBOLS[row.currency] || row.currency || '';
        const amt = isCensored ? '****' : (row.net || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return <span style={{ fontFamily: 'monospace' }}>{sym} {amt}</span>;
      }
    },
    {
      title: 'FX Rate',
      dataIndex: 'fxToThb',
      key: 'fxToThb',
      align: 'right',
      width: 90,
      render: (fx, row) => {
        if (row.currency === 'THB') return <span style={{ color: 'var(--text-muted)' }}>1.00</span>;
        return <span style={{ fontFamily: 'monospace' }}>{Number(fx || 1).toFixed(2)}</span>;
      }
    },
    {
      title: `Flow (${displayCurrency})`,
      dataIndex: 'flowConverted',
      key: 'flowConverted',
      align: 'right',
      width: 150,
      render: (flow) => {
        const isPos = flow >= 0;
        const color = isPos ? 'var(--success-color)' : 'var(--danger-color)';
        const sign = isPos ? '+' : '';
        return (
          <span style={{ color, fontWeight: 'bold', fontFamily: 'monospace' }}>
            {sign}{formatCurrency(flow, displayCurrency, isCensored)}
          </span>
        );
      }
    },
    {
      title: `Balance (${displayCurrency})`,
      dataIndex: 'runningBalance',
      key: 'runningBalance',
      align: 'right',
      width: 160,
      render: (bal) => (
        <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: bal >= 0 ? '#ffffff' : 'var(--danger-color)' }}>
          {formatCurrency(bal, displayCurrency, isCensored)}
        </span>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 90,
      align: 'center',
      render: (_, row) => {
        if (row.isTrade) {
          return (
            <span title="Trades are managed in Trading Journal" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
              <InfoCircleOutlined />
            </span>
          );
        }
        return (
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: 'var(--primary-color)' }} />}
              onClick={() => handleOpenEditCashEntry(row.rawItem)}
            />
            <Popconfirm
              title={`Delete ${row.kind} (${row.id})?`}
              description="Are you sure you want to remove this cash transaction?"
              onConfirm={() => handleDeleteCashEntry(row.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined style={{ color: 'var(--danger-color)' }} />}
              />
            </Popconfirm>
          </Space>
        );
      }
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <Space wrap>
          <Input
            placeholder="Search by note or asset..."
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            value={kindFilter}
            onChange={setKindFilter}
            style={{ width: 150 }}
          >
            <Option value="All">All Transactions</Option>
            <Option value="Cash Entries">Cash Entries Only</Option>
            <Option value="Trades">Trades Only</Option>
            <Option value="Deposit">Deposit</Option>
            <Option value="Withdraw">Withdraw</Option>
            <Option value="Dividend">Dividend</Option>
            <Option value="Interest">Interest</Option>
            <Option value="Fee">Fee</Option>
            <Option value="Tax">Tax</Option>
          </Select>
        </Space>
        <Text style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Showing {filteredStatement.length} entries
        </Text>
      </div>

      <Table
        dataSource={filteredStatement}
        columns={columns}
        rowKey="id"
        pagination={{ pageSize: 15, showSizeChanger: true }}
        size="small"
        scroll={{ x: 800 }}
      />
    </div>
  );
};
