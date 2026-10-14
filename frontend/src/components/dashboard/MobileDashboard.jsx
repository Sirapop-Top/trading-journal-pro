import { Space, Card, Row, Col, Typography, Tag, Alert, Button } from 'antd';
import {
  RiseOutlined,
  GlobalOutlined,
  DollarOutlined,
  PieChartOutlined,
  AlertOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { MobileCharts } from './MobileCharts.jsx';

const { Text } = Typography;

export const MobileDashboard = () => {
  const {
    kpis,
    portfolioSizing,
    formatCurrency,
    mobileChartTab,
    setMobileChartTab,
    isCensored,
    positions,
    dueCount,
    setActiveTab,
    cashKpis
  } = useAppData();

  const netAssetValue = (portfolioSizing?.cashOnHand || 0) + (kpis?.currentMarketValueConverted || 0);
  const netProfit = netAssetValue - (portfolioSizing?.initialCapital || 0);
  const netProfitPct = (portfolioSizing?.initialCapital || 0) > 0 ? (netProfit / portfolioSizing.initialCapital) * 100 : 0;
  const investedPct = netAssetValue > 0 ? Math.min(100, ((kpis?.currentMarketValueConverted || 0) / netAssetValue) * 100) : 0;
  const cashPct = 100 - investedPct;

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {dueCount > 0 && (
        <Alert
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span><AlertOutlined /> <strong>{dueCount}</strong> pair(s) need rebalancing</span>
              <Button type="primary" size="small" onClick={() => setActiveTab('rebalance')} style={{ background: '#ef4444', borderColor: '#ef4444', fontSize: '11px', height: '24px' }}>
                Fix &rarr;
              </Button>
            </div>
          }
          type="error"
          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px' }}
        />
      )}
      {!cashKpis?.hasDeposit && (
        <Alert
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '12px' }}><InfoCircleOutlined /> No Opening Deposit recorded</span>
              <Button type="primary" size="small" onClick={() => setActiveTab('cash')} style={{ background: 'var(--primary-color)', color: '#06080f', borderColor: 'var(--primary-color)', fontSize: '11px', height: '24px', fontWeight: 600 }}>
                Cash &rarr;
              </Button>
            </div>
          }
          type="info"
          style={{ background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)', padding: '6px 12px' }}
        />
      )}
      {/* Mobile Account Summary (NAV Hero) */}
      <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '16px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Net Asset Value (NAV)
            </span>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#ffffff', marginTop: '2px', fontFamily: 'var(--font-family-mono)' }}>
              {formatCurrency(netAssetValue)}
            </div>
          </div>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold',
            background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            color: netProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
          }}>
            {netProfit >= 0 ? '▲' : '▼'} {netProfitPct.toFixed(1)}%
          </span>
        </div>

        {/* Capital utilization bar */}
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
            <span>Exposure: <strong>{investedPct.toFixed(0)}%</strong></span>
            <span>Cash: <strong>{cashPct.toFixed(0)}%</strong></span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: `${investedPct}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)' }} />
            <div style={{ width: `${cashPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)' }} />
          </div>
        </div>
      </Card>

      {/* 2x2 Grid of Key Financials */}
      <Row gutter={[10, 10]}>
        <Col span={12}>
          <Card 
            bordered={false} 
            className={`glass-panel ${(kpis?.totalPnLConverted || 0) >= 0 ? 'glow-card-green' : 'glow-card-red'}`}
            styles={{ body: { padding: '12px' } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Total Return
              </span>
              <span style={{ fontSize: '9px', fontWeight: 'bold', color: (kpis?.totalPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                {(kpis?.totalPnLPct || 0).toFixed(1)}%
              </span>
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: (kpis?.totalPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
              {(kpis?.totalPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalPnLConverted)}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Realized P&L
              </span>
              <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '11px' }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: (kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
              {formatCurrency(kpis?.totalRealizedPnLConverted)}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Live Valuation
              </span>
              <GlobalOutlined style={{ color: 'var(--primary-color)', fontSize: '11px' }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
              {formatCurrency(kpis?.currentMarketValueConverted)}
            </div>
          </Card>
        </Col>

        <Col span={12}>
          <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '12px' } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                Cash Power
              </span>
              <DollarOutlined style={{ color: 'var(--success-color)', fontSize: '11px' }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', marginTop: '4px', fontFamily: 'var(--font-family-mono)' }}>
              {formatCurrency(portfolioSizing?.cashOnHand)}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Sizing & Allocation Blueprint Card for Mobile */}
      <Card bordered={false} className="glass-panel" styles={{ body: { padding: '14px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
            Blueprint & Risk Management
          </span>
          <PieChartOutlined style={{ color: 'var(--primary-color)', fontSize: '12px' }} />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Holdings Slots:</span>
          <strong style={{ color: '#ffffff', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>
            {portfolioSizing?.activeHoldingsCount || 0} / {portfolioSizing?.targetStocks || 50} stocks
          </strong>
        </div>

        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginBottom: '12px' }}>
          <div style={{ 
            width: `${Math.min(100, ((portfolioSizing?.activeHoldingsCount || 0) / (portfolioSizing?.targetStocks || 1)) * 100)}%`, 
            height: '100%', 
            background: 'var(--primary-color)' 
          }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
          <div>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Initial Capital</span>
            <strong style={{ fontSize: '12px', color: '#ffffff', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(portfolioSizing?.initialCapital)}</strong>
          </div>
          <div>
            <span style={{ fontSize: '8px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Target Pos. Size</span>
            <strong style={{ fontSize: '12px', color: 'var(--primary-color)', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(portfolioSizing?.positionSizeCash)}</strong>
          </div>
        </div>
      </Card>

      {/* Chart Selector Horizontal Pills for Mobile */}
      <div className="mobile-pill-container">
        <button 
          className={`mobile-pill-btn ${mobileChartTab === 'performance' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('performance')}
        >
          📈 Earnings
        </button>
        <button 
          className={`mobile-pill-btn ${mobileChartTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('analytics')}
        >
          📊 Stats
        </button>
        <button 
          className={`mobile-pill-btn ${mobileChartTab === 'allocation' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('allocation')}
        >
          🍰 Allocation
        </button>
        <button 
          className={`mobile-pill-btn ${mobileChartTab === 'pnl' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('pnl')}
        >
          ⚖️ P&L
        </button>
        <button 
          className={`mobile-pill-btn ${mobileChartTab === 'breakdown' ? 'active' : ''}`}
          onClick={() => setMobileChartTab('breakdown')}
        >
          📋 Realized
        </button>
      </div>

      {/* Render single selected chart for Mobile */}
      <MobileCharts />

      {/* Top Positions Panel for Mobile (Custom List Layout) */}
      <Card title="Top Portfolio Positions" bordered={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {positions
            .filter(p => p.qtyHeld > 0)
            .sort((a, b) => b.liveValueConverted - a.liveValueConverted)
            .slice(0, 5)
            .map((p) => {
              const pct = (kpis?.currentMarketValueConverted || 0) > 0
                ? (p.liveValueConverted / kpis.currentMarketValueConverted) * 100
                : 0;
              const isProfit = p.unrealizedPnLConverted >= 0;
              return (
                <div key={p.assetName} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ color: '#ffffff', fontSize: '13px' }}>{p.assetName}</strong>
                      <Tag color="cyan" style={{ marginLeft: '8px', fontSize: '9px', border: 'none', background: 'rgba(0, 242, 254, 0.12)' }}>
                        {p.assetType}
                      </Tag>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }} className="financial-num">
                        {formatCurrency(p.liveValueConverted)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Weight: {pct.toFixed(1)}%</span>
                      <div className="concentration-track" style={{ flex: 1, height: '3px', margin: 0 }}>
                        <div className="concentration-fill" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: isProfit ? 'var(--success-color)' : 'var(--danger-color)', marginLeft: '12px' }} className="financial-num">
                      {isProfit ? '▲' : '▼'} {isProfit ? '+' : ''}{isCensored ? '****' : p.unrealizedPnLConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })
          }
          {positions.filter(p => p.qtyHeld > 0).length === 0 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>No active positions in this portfolio.</Text>
            </div>
          )}
        </div>
      </Card>
    </Space>
  );
};
