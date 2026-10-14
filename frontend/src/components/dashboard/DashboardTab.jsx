import { Space, Row, Col, Card, Table, Tag, Alert, Button } from 'antd';
import { useAppData } from '../../context/AppDataContext.jsx';
import { MobileDashboard } from './MobileDashboard.jsx';
import { KpiCards } from './KpiCards.jsx';
import { CumulativePnlChart } from './CumulativePnlChart.jsx';
import { AnalyticsGrid } from './AnalyticsGrid.jsx';
import { AllocationChart } from './AllocationChart.jsx';
import { PnlDistributionChart } from './PnlDistributionChart.jsx';
import { RealizedBreakdownChart } from './RealizedBreakdownChart.jsx';

export const DashboardTab = () => {
  const {
    isMobile,
    positions,
    kpis,
    isCensored,
    formatCurrency,
    displayCurrency,
    dueCount,
    setActiveTab
  } = useAppData();

  if (isMobile) {
    return <MobileDashboard />;
  }

  const topPositionColumns = [
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
        const pct = (kpis?.currentMarketValueConverted || 0) > 0
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
    }
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {dueCount > 0 && (
        <Alert
          message={<strong>Rebalance Action Required</strong>}
          description={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span>You have <strong>{dueCount}</strong> pair{dueCount > 1 ? 's' : ''} with target drift or scheduled date due.</span>
              <Button type="primary" size="small" onClick={() => setActiveTab('rebalance')} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
                Go to Rebalance Hub &rarr;
              </Button>
            </div>
          }
          type="error"
          showIcon
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
        />
      )}

      {/* HERO GRID SECTION */}
      <KpiCards />

      {/* Cumulative Performance Line Chart (Over time) */}
      <CumulativePnlChart />

      {/* Trading Analytics Section */}
      <AnalyticsGrid />

      {/* Allocation & Strategy Charts Row */}
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={8}>
          <AllocationChart />
        </Col>
        <Col xs={24} lg={8}>
          <PnlDistributionChart />
        </Col>
        <Col xs={24} lg={8}>
          <RealizedBreakdownChart />
        </Col>
      </Row>

      {/* Top Holdings Panel */}
      <Card title="Top Portfolio Positions" bordered={false}>
        <Table 
          columns={topPositionColumns} 
          dataSource={positions.filter(p => p.qtyHeld > 0).sort((a, b) => b.liveValueConverted - a.liveValueConverted).slice(0, 5)} 
          rowKey="assetName"
          pagination={false}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </Space>
  );
};
