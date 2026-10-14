import { Card, Table, Tag, Typography, Input, Select, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Title, Text } = Typography;
const { Option } = Select;

export const PositionsTab = () => {
  const {
    isMobile,
    positionsSearch,
    setPositionsSearch,
    positionsTypeFilter,
    setPositionsTypeFilter,
    renderedPositions,
    kpis,
    isCensored,
    formatCurrency,
    livePrices,
    displayCurrency
  } = useAppData();

  const positionColumns = [
    {
      title: 'Asset Name',
      dataIndex: 'assetName',
      key: 'assetName',
      width: 140,
      render: (text, record) => (
        <span>
          <strong style={{ color: '#ffffff', fontSize: '15px' }}>{text}</strong>
          {record.qtyHeld === 0 && <Tag color="default" style={{ marginLeft: 8, borderRadius: '4px' }}>Closed</Tag>}
        </span>
      )
    },
    {
      title: 'Allocation',
      key: 'allocation',
      align: 'left',
      width: 140,
      render: (_, record) => {
        if (record.qtyHeld <= 0) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
        const pct = kpis.currentMarketValueConverted > 0
          ? (record.liveValueConverted / kpis.currentMarketValueConverted) * 100
          : 0;
        return (
          <div style={{ minWidth: '100px', display: 'inline-block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1', fontWeight: 600 }}>
              <span>{pct.toFixed(1)}%</span>
            </div>
            <div className="concentration-track">
              <div className="concentration-fill" style={{ width: `${pct}%` }}></div>
            </div>
          </div>
        );
      }
    },
    {
      title: 'Category',
      dataIndex: 'assetType',
      key: 'assetType',
      width: 130,
      render: (type) => (
        <Tag color={type === 'Thai Stock' ? 'cyan' : type === 'Global Stock' ? 'blue' : 'orange'} style={{ borderRadius: '4px', fontWeight: 'bold' }}>
          {type}
        </Tag>
      )
    },
    {
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      width: 90,
    },
    {
      title: 'Qty Held',
      dataIndex: 'qtyHeld',
      key: 'qtyHeld',
      align: 'right',
      width: 120,
      className: 'financial-num',
      render: (val) => (val !== undefined && val !== null) ? (isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })) : '-'
    },
    {
      title: 'Avg Cost (Local)',
      dataIndex: 'wac',
      key: 'wac',
      align: 'right',
      width: 130,
      className: 'financial-num',
      render: (val, record) => formatCurrency(val, record.currency)
    },
    {
      title: `Total Cost (${displayCurrency})`,
      dataIndex: 'totalCostConverted',
      key: 'totalCostConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (val) => formatCurrency(val, displayCurrency)
    },
    {
      title: `Live Price (${displayCurrency})`,
      dataIndex: 'livePriceConverted',
      key: 'livePriceConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      render: (val) => formatCurrency(val, displayCurrency)
    },
    {
      title: `Current Value (${displayCurrency})`,
      dataIndex: 'liveValueConverted',
      key: 'liveValueConverted',
      align: 'right',
      width: 150,
      className: 'financial-num',
      render: (val) => formatCurrency(val, displayCurrency)
    },
    {
      title: `Unrealized P&L`,
      key: 'unrealizedPnLConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      sorter: (a, b) => a.unrealizedPnLConverted - b.unrealizedPnLConverted,
      render: (_, record) => {
        const val = record.unrealizedPnLConverted;
        const pct = record.unrealizedPnLPct;
        if (val === undefined || val === null || isNaN(val)) return '-';
        const isProfit = val >= 0;
        return (
          <span>
            <div className={isProfit ? 'trend-up' : 'trend-down'}>
              {isProfit ? '+' : ''}{isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: isProfit ? '#34d399' : '#fb7185', fontWeight: 'bold' }}>
              {isProfit ? '+' : ''}{isCensored ? '****' : pct.toFixed(2) + '%'}
            </div>
          </span>
        );
      }
    },
    {
      title: `Realized P&L`,
      dataIndex: 'realizedPnLConverted',
      key: 'realizedPnLConverted',
      align: 'right',
      width: 140,
      className: 'financial-num',
      sorter: (a, b) => a.realizedPnLConverted - b.realizedPnLConverted,
      render: (val) => {
        if (val === undefined || val === null || isNaN(val)) return '-';
        const isProfit = val >= 0;
        return (
          <span className={isProfit ? 'trend-up' : 'trend-down'}>
            {isProfit ? '+' : ''}{isCensored ? '****' : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        );
      }
    }
  ];

  if (isMobile) {
    return (
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4} style={{ color: '#ffffff', margin: 0 }}>Active Positions</Title>
        </div>

        <Card bordered={false} styles={{ body: { padding: '12px' } }}>
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Input
              placeholder="Search asset symbol..."
              value={positionsSearch}
              onChange={e => setPositionsSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              allowClear
            />
            <Select
              value={positionsTypeFilter}
              onChange={val => setPositionsTypeFilter(val)}
              style={{ width: '100%' }}
              dropdownStyle={{ background: 'var(--bg-card)' }}
            >
              <Option value="All">All Categories</Option>
              <Option value="Thai Stock">Thai Stock</Option>
              <Option value="Global Stock">Global Stock</Option>
              <Option value="Crypto">Crypto</Option>
            </Select>
          </Space>
        </Card>

        {/* Mobile Positions Feed */}
        <div className="mobile-card-list">
          {renderedPositions.length > 0 ? (
            renderedPositions.map(pos => {
              const pct = kpis.currentMarketValueConverted > 0
                ? (pos.liveValueConverted / kpis.currentMarketValueConverted) * 100
                : 0;
              const isUnrealizedProfit = pos.unrealizedPnLConverted >= 0;
              const isRealizedProfit = pos.realizedPnLConverted >= 0;
              
              return (
                <div key={pos.assetName} className="mobile-feed-card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
                  <div className="mobile-feed-card-header">
                    <div className="mobile-feed-card-title">
                      <strong className="mobile-feed-card-ticker">{pos.assetName}</strong>
                      <Tag color="cyan" style={{ fontSize: '9px', margin: 0 }}>
                        {pos.assetType}
                      </Tag>
                      {pos.qtyHeld === 0 && <Tag color="default" style={{ fontSize: '9px', margin: 0 }}>Closed</Tag>}
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ffffff' }} className="financial-num">
                      {pct.toFixed(1)}% alloc
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <div className="concentration-track" style={{ flex: 1, height: '4px', margin: 0 }}>
                      <div className="concentration-fill" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>

                  <div className="mobile-feed-card-grid">
                    <div>
                      <div className="mobile-feed-card-label">Qty Held</div>
                      <div className="mobile-feed-card-value financial-num">
                        {isCensored ? '****' : pos.qtyHeld.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                      </div>
                    </div>
                    <div>
                      <div className="mobile-feed-card-label">Avg Buy Price</div>
                      <div className="mobile-feed-card-value financial-num">
                        {formatCurrency(pos.wac, pos.currency)}
                      </div>
                    </div>
                    <div>
                      <div className="mobile-feed-card-label">Live Price</div>
                      <div className="mobile-feed-card-value financial-num">
                        {livePrices[pos.assetName] !== undefined ? formatCurrency(livePrices[pos.assetName], pos.currency) : '-'}
                      </div>
                    </div>
                    <div>
                      <div className="mobile-feed-card-label">Live Value</div>
                      <div className="mobile-feed-card-value financial-num">
                        {formatCurrency(pos.liveValueConverted, displayCurrency)}
                      </div>
                    </div>
                    <div>
                      <div className="mobile-feed-card-label">Unrealized P&L</div>
                      <div className={`mobile-feed-card-value financial-num ${isUnrealizedProfit ? 'trend-up' : 'trend-down'}`}>
                        {isUnrealizedProfit ? '+' : ''}{isCensored ? '****' : pos.unrealizedPnLConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="mobile-feed-card-label">Realized P&L</div>
                      <div className={`mobile-feed-card-value financial-num ${isRealizedProfit ? 'trend-up' : 'trend-down'}`}>
                        {isRealizedProfit ? '+' : ''}{isCensored ? '****' : pos.realizedPnLConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="mobile-feed-card-footer">
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Cost: {formatCurrency(pos.totalCostConverted, displayCurrency)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(11, 14, 23, 0.4)', borderRadius: '12px' }}>
              <Text type="secondary">No active positions match filters.</Text>
            </div>
          )}
        </div>
      </Space>
    );
  }

  return (
    <Card title={`Active Positions & Portfolio Composition (${displayCurrency})`} bordered={false}>
      {/* Search and Filter Toolbar */}
      <Space wrap size="middle" style={{ marginBottom: 20, width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>SEARCH SYMBOL</Text>
          <Input
            placeholder="Search asset symbol..."
            value={positionsSearch}
            onChange={e => setPositionsSearch(e.target.value)}
            style={{ width: 220 }}
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
            allowClear
          />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '4px', fontWeight: 600 }}>CATEGORY</Text>
          <Select
            value={positionsTypeFilter}
            onChange={val => setPositionsTypeFilter(val)}
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
        columns={positionColumns} 
        dataSource={renderedPositions} 
        rowKey="assetName"
        pagination={false}
        size="middle"
        scroll={{ x: 'max-content' }}
        summary={(pageData) => {
          let totalCostSum = 0;
          let totalValueSum = 0;
          let totalUnrealizedPnLSum = 0;
          let totalRealizedPnLSum = 0;

          pageData.forEach(({ totalCostConverted, liveValueConverted, unrealizedPnLConverted, realizedPnLConverted }) => {
            totalCostSum += totalCostConverted;
            totalValueSum += liveValueConverted;
            totalUnrealizedPnLSum += unrealizedPnLConverted;
            totalRealizedPnLSum += realizedPnLConverted;
          });

          return (
            <Table.Summary.Row style={{ backgroundColor: 'rgba(31, 41, 61, 0.25)' }}>
              <Table.Summary.Cell index={0} colSpan={6}><strong style={{ color: '#ffffff' }}>AGGREGATED TOTALS ({displayCurrency})</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right" className="financial-num">
                <strong style={{ color: '#ffffff' }}>{formatCurrency(totalCostSum, displayCurrency)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}></Table.Summary.Cell>
              <Table.Summary.Cell index={3} align="right" className="financial-num">
                <strong style={{ color: '#ffffff' }}>{formatCurrency(totalValueSum, displayCurrency)}</strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={4} align="right" className="financial-num">
                <strong className={totalUnrealizedPnLSum >= 0 ? 'trend-up' : 'trend-down'}>
                  {totalUnrealizedPnLSum >= 0 ? '+' : ''}{isCensored ? '****' : totalUnrealizedPnLSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} align="right" className="financial-num">
                <strong className={totalRealizedPnLSum >= 0 ? 'trend-up' : 'trend-down'}>
                  {totalRealizedPnLSum >= 0 ? '+' : ''}{isCensored ? '****' : totalRealizedPnLSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          );
        }}
      />
    </Card>
  );
};
