import { Card, Table, Tag, Typography, Input, Select, Space, Button, Popconfirm, Row, Col } from 'antd';
import {
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  SearchOutlined,
  EditOutlined,
  SwapOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppData } from '../../context/AppDataContext.jsx';
import { MobileJournalFeed } from './MobileJournalFeed.jsx';

const { Title, Text } = Typography;
const { Option } = Select;

export const JournalTab = () => {
  const {
    isMobile,
    setTickerValidation,
    setFormAction,
    tradeForm,
    setIsTradeModalOpen,
    setIsImportModalOpen,
    exportToCSV,
    filteredTrades,
    journalSearch,
    setJournalSearch,
    journalActionFilter,
    setJournalActionFilter,
    journalAssetTypeFilter,
    setJournalAssetTypeFilter,
    journalFilteredTrades,
    tradesWithRunningStats,
    liveRates,
    livePrices,
    displayCurrency,
    isCensored,
    formatCurrency,
    portfolios,
    setEditingTrade,
    setIsCustomStrategy,
    editStrategyForm,
    setIsEditStrategyModalOpen,
    transferForm,
    setIsTransferModalOpen,
    handleDeleteTrade,
    handleRevertRebalance
  } = useAppData();

  const openLogTrade = () => {
    setTickerValidation({ status: 'idle', message: '', checkedTicker: '' });
    setFormAction('Buy');
    tradeForm.resetFields();
    setIsTradeModalOpen(true);
  };

  const handleEditClick = (record) => {
    const standardStrategies = [
      "CDC Action Zone",
      "Breakout",
      "EMA Cross",
      "Support/Resistance Bounce",
      "Value Investment",
      "Rebalance"
    ];
    const isCustom = record.why && !standardStrategies.includes(record.why);
    setEditingTrade(record);
    setIsCustomStrategy(isCustom);
    editStrategyForm.setFieldsValue({
      quantity: record.quantity !== undefined ? Number(record.quantity) : 0,
      priceUnit: record.priceUnit !== undefined ? Number(record.priceUnit) : 0,
      feeAmount: record.feeAmount !== undefined ? Number(record.feeAmount) : 0,
      why: isCustom ? 'Other' : (record.why || undefined),
      customWhy: isCustom ? record.why : '',
      remark: record.remark
    });
    setIsEditStrategyModalOpen(true);
  };

  const handleTransferClick = (record) => {
    setEditingTrade(record);
    transferForm.setFieldsValue({
      targetPortfolio: record.portfolio
    });
    setIsTransferModalOpen(true);
  };

  const journalColumns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Portfolio',
      dataIndex: 'portfolio',
      key: 'portfolio',
      width: 140,
      filters: portfolios.map(p => ({ text: p, value: p })),
      onFilter: (value, record) => record.portfolio === value,
      render: (text) => <Tag color="geekblue" style={{ borderRadius: '4px', fontWeight: 'bold' }}>{text}</Tag>
    },
    {
      title: 'Asset',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 130,
      render: (text, record) => (
        <span>
          <strong style={{ color: '#ffffff', fontSize: '14px' }}>{text}</strong>
          <br />
          <Text type="secondary" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{record.assetType}</Text>
        </span>
      )
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      align: 'center',
      width: 100,
      render: (action, record) => (
        <Space direction="vertical" size={2} style={{ alignItems: 'center' }}>
          <span className={`pill ${action.toLowerCase() === 'buy' ? 'pill-buy' : 'pill-sell'}`}>
            {action.toUpperCase()}
          </span>
          {record.rebalanceId && (
            <Tag color="blue" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
              {record.rebalanceId}
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      width: 110,
      className: 'financial-num',
      render: (val) => (val !== undefined && val !== null) ? (isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })) : '-'
    },
    {
      title: 'Price/Unit',
      dataIndex: 'priceUnit',
      key: 'priceUnit',
      align: 'right',
      width: 120,
      className: 'financial-num',
      render: (val, record) => formatCurrency(val, record.currency)
    },
    {
      title: 'Fee',
      key: 'feeAmount',
      align: 'right',
      width: 100,
      className: 'financial-num',
      render: (_, record) => {
        const val = record.feeAmount !== undefined ? Number(record.feeAmount) : 0.0;
        return val > 0 ? formatCurrency(val, record.currency) : <span style={{ color: 'var(--text-muted)' }}>Free</span>;
      }
    },
    {
      title: 'Total Cost',
      key: 'amount',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (_, record) => {
        const qty = record.quantity;
        const price = record.priceUnit;
        const feeAmount = record.feeAmount !== undefined ? Number(record.feeAmount) : 0.0;
        const isBuy = record.action.toLowerCase() === 'buy';
        const total = isBuy ? (qty * price + feeAmount) : (qty * price - feeAmount);
        return formatCurrency(total, record.currency);
      }
    },
    {
      title: 'Avg. Cost Basis',
      key: 'avgCostBasis',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (_, record) => {
        const stats = tradesWithRunningStats[record.id];
        const val = stats ? stats.avgCostBasis : 0;
        return formatCurrency(val, record.currency);
      }
    },
    {
      title: `Live Price (${displayCurrency})`,
      key: 'livePriceConverted',
      align: 'right',
      width: 130,
      className: 'financial-num',
      render: (_, record) => {
        const lp = livePrices[record.assetName];
        if (lp === undefined || lp === null) return '-';
        const rateToTHB = liveRates[record.currency] || 1.0;
        const displayRateToTHB = liveRates[displayCurrency] || 1.0;
        const priceConverted = (lp * rateToTHB) / displayRateToTHB;
        return formatCurrency(priceConverted, displayCurrency);
      }
    },
    {
      title: `Realized / Unrealized P&L (${displayCurrency})`,
      key: 'pnl',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (_, record) => {
        const stats = tradesWithRunningStats[record.id];
        if (!stats) return '-';
        
        const rateToTHB = liveRates[record.currency] || 1.0;
        const displayRateToTHB = liveRates[displayCurrency] || 1.0;
        
        const isBuy = record.action.toLowerCase() === 'buy';
        const pnlLocal = isBuy ? stats.unrealizedPnL : stats.realizedPnL;
        const pnlConverted = (pnlLocal * rateToTHB) / displayRateToTHB;
        
        const isProfit = pnlConverted >= 0;
        return (
          <div style={{ textAlign: 'right' }}>
            <span className={isProfit ? 'trend-up' : 'trend-down'} style={{ fontWeight: 'bold', display: 'block' }}>
              {isProfit ? '+' : ''}{isCensored ? '****' : pnlConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {isBuy ? 'Unrealized' : 'Realized'}
            </span>
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center',
      width: 130,
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="text" 
            icon={<EditOutlined style={{ color: 'var(--primary-color)' }} />} 
            size="small" 
            title="Edit Trade Entry"
            onClick={() => handleEditClick(record)}
          />
          <Button 
            type="text" 
            icon={<SwapOutlined style={{ color: 'var(--warning-color)' }} />} 
            size="small" 
            title="Transfer Trade to Portfolio"
            onClick={() => handleTransferClick(record)}
          />
          <Popconfirm
            title={record.rebalanceId ? "Revert Entire Rebalance" : "Delete Trade"}
            description={
              record.rebalanceId
                ? `This trade is part of Rebalance ${record.rebalanceId}. Reverting will remove BOTH the buy and sell trades. Proceed?`
                : "Are you sure you want to delete this trade from your journal? This will rewrite the spreadsheet."
            }
            onConfirm={() => record.rebalanceId ? handleRevertRebalance(record.rebalanceId) : handleDeleteTrade(record.id)}
            okText={record.rebalanceId ? "Revert Rebalance" : "Delete"}
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (isMobile) {
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ color: '#ffffff', margin: 0 }}>Trading Journal</Title>
          <Space>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={openLogTrade}
              style={{ backgroundColor: 'var(--success-color)', border: 'none', fontWeight: 'bold', color: '#06080f' }}
              size="small"
            >
              Log Trade
            </Button>
            <Button 
              icon={<UploadOutlined />} 
              onClick={() => setIsImportModalOpen(true)}
              size="small"
              title="Import CSV"
            />
            <Button 
              icon={<DownloadOutlined />} 
              onClick={exportToCSV}
              disabled={filteredTrades.length === 0}
              size="small"
              title="Export CSV"
            />
          </Space>
        </div>

        {/* Mobile Filters */}
        <Card bordered={false} styles={{ body: { padding: '12px' } }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Input
              placeholder="Search asset, strategy, notes..."
              value={journalSearch}
              onChange={e => setJournalSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              allowClear
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Select
                value={journalActionFilter}
                onChange={val => setJournalActionFilter(val)}
                style={{ flex: 1 }}
                dropdownStyle={{ background: 'var(--bg-card)' }}
              >
                <Option value="All">All Actions</Option>
                <Option value="Buy">Buys</Option>
                <Option value="Sell">Sells</Option>
                <Option value="Rebalance">Rebalance</Option>
              </Select>
              <Select
                value={journalAssetTypeFilter}
                onChange={val => setJournalAssetTypeFilter(val)}
                style={{ flex: 1 }}
                dropdownStyle={{ background: 'var(--bg-card)' }}
              >
                <Option value="All">All Categories</Option>
                <Option value="Thai Stock">Thai Stock</Option>
                <Option value="Global Stock">Global Stock</Option>
                <Option value="Crypto">Crypto</Option>
              </Select>
            </div>
          </Space>
        </Card>

        {/* Mobile Cards Feed */}
        <MobileJournalFeed />
      </Space>
    );
  }

  return (
    <Card 
      title="Trading Journal Logs"
      extra={
        <Space>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={openLogTrade}
            style={{ backgroundColor: 'var(--success-color)', border: 'none', fontWeight: 'bold', color: '#06080f' }}
          >
            Log Trade
          </Button>
          <Button 
            icon={<UploadOutlined />} 
            onClick={() => setIsImportModalOpen(true)}
            style={{ fontWeight: 'bold' }}
          >
            Import CSV
          </Button>
          <Button 
            icon={<DownloadOutlined />} 
            onClick={exportToCSV}
            disabled={filteredTrades.length === 0}
            style={{ fontWeight: 'bold' }}
          >
            Export CSV
          </Button>
        </Space>
      } 
      bordered={false}
    >
      {/* Search and Filters Toolbar */}
      <Space wrap size="middle" style={{ marginBottom: 20, width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>SEARCH</Text>
          <Input
            placeholder="Search asset, strategy, notes..."
            value={journalSearch}
            onChange={e => setJournalSearch(e.target.value)}
            style={{ width: 260 }}
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
            allowClear
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>ACTION</Text>
          <Select
            value={journalActionFilter}
            onChange={val => setJournalActionFilter(val)}
            style={{ width: 130 }}
          >
            <Option value="All">All Actions</Option>
            <Option value="Buy">Buys</Option>
            <Option value="Sell">Sells</Option>
            <Option value="Rebalance">Rebalance</Option>
          </Select>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>CATEGORY</Text>
          <Select
            value={journalAssetTypeFilter}
            onChange={val => setJournalAssetTypeFilter(val)}
            style={{ width: 160 }}
          >
            <Option value="All">All Categories</Option>
            <Option value="Thai Stock">Thai Stock</Option>
            <Option value="Global Stock">Global Stock</Option>
            <Option value="Crypto">Crypto</Option>
          </Select>
        </div>
      </Space>

      <Table 
        columns={journalColumns} 
        dataSource={journalFilteredTrades} 
        rowKey="id"
        pagination={{ 
          defaultPageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '30'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} transactions`
        }}
        size="middle"
        scroll={{ x: 'max-content' }}
        expandable={{
          expandedRowRender: (record) => (
            <div className="expanded-remarks" style={{ padding: '16px 24px' }}>
              <div style={{ fontWeight: 'bold', color: '#ffffff', marginBottom: '8px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Trade Analysis & Diary
              </div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Strategy / Trigger</Text>
                  <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
                    {record.why || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>None specified</span>}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Private Notes</Text>
                  <div style={{ color: '#e2e8f0', fontSize: '13px' }}>
                    {record.remark || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No notes</span>}
                  </div>
                </Col>
              </Row>
            </div>
          ),
          rowExpandable: (record) => !!(record.why || record.remark),
        }}
      />
    </Card>
  );
};
