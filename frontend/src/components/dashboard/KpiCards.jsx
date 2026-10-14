import { Row, Col, Card } from 'antd';
import {
  WalletOutlined,
  RiseOutlined,
  FallOutlined,
  PieChartOutlined
} from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';

export const KpiCards = () => {
  const {
    kpis,
    portfolioSizing,
    formatCurrency
  } = useAppData();

  const netAssetValue = (portfolioSizing?.cashOnHand || 0) + (kpis?.currentMarketValueConverted || 0);
  const netProfit = netAssetValue - (portfolioSizing?.initialCapital || 0);
  const netProfitPct = (portfolioSizing?.initialCapital || 0) > 0 ? (netProfit / portfolioSizing.initialCapital) * 100 : 0;
  const investedPct = netAssetValue > 0 ? Math.min(100, ((kpis?.currentMarketValueConverted || 0) / netAssetValue) * 100) : 0;
  const cashPct = 100 - investedPct;

  return (
    <Row gutter={[24, 24]}>
      {/* Hero Widget 1: Account Valuation & Capital Efficiency */}
      <Col xs={24} lg={10}>
        <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '24px' } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Net Asset Value (NAV)
              </span>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#ffffff', marginTop: '4px', fontFamily: 'var(--font-family-mono)', letterSpacing: '-0.5px' }}>
                {formatCurrency(netAssetValue)}
              </div>
            </div>
            <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '10px', borderRadius: '12px' }}>
              <WalletOutlined style={{ color: 'var(--primary-color)', fontSize: '24px' }} />
            </div>
          </div>

          {/* Net ROI indicator */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 'bold',
              background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
              color: netProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
            }}>
              {netProfit >= 0 ? '▲' : '▼'} {netProfit >= 0 ? '+' : ''}{netProfitPct.toFixed(2)}%
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              ROI ({netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)})
            </span>
          </div>

          {/* Capital Utilization / Exposure Bar */}
          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                Exposure: <strong style={{ color: 'var(--primary-color)' }}>{formatCurrency(kpis?.currentMarketValueConverted)} ({investedPct.toFixed(1)}%)</strong>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Cash: <strong style={{ color: 'var(--success-color)' }}>{formatCurrency(portfolioSizing?.cashOnHand)} ({cashPct.toFixed(1)}%)</strong>
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${investedPct}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)', transition: 'width 0.5s ease' }} />
              <div style={{ width: `${cashPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', transition: 'width 0.5s ease' }} />
            </div>
          </div>
        </Card>
      </Col>

      {/* Hero Widget 2: Portfolio Return Metrics */}
      <Col xs={24} sm={12} lg={7}>
        <Card bordered={false} className={`glass-panel ${(kpis?.totalPnLConverted || 0) >= 0 ? 'glow-card-green' : 'glow-card-red'}`} styles={{ body: { padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Total Return P&L
              </span>
              {(kpis?.totalPnLConverted || 0) >= 0 
                ? <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '20px' }} /> 
                : <FallOutlined style={{ color: 'var(--danger-color)', fontSize: '20px' }} />
              }
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: (kpis?.totalPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', marginTop: '8px', fontFamily: 'var(--font-family-mono)' }}>
              {(kpis?.totalPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalPnLConverted)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              All-time yield: <strong style={{ color: (kpis?.totalPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{(kpis?.totalPnLPct || 0).toFixed(2)}%</strong>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Realized P&L</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: (kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontFamily: 'var(--font-family-mono)' }}>
                {(kpis?.totalRealizedPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalRealizedPnLConverted)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Paper P&L</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: (kpis?.totalUnrealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontFamily: 'var(--font-family-mono)' }}>
                {(kpis?.totalUnrealizedPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalUnrealizedPnLConverted)}
              </span>
            </div>
          </div>
        </Card>
      </Col>

      {/* Hero Widget 3: Sizing & Blueprint */}
      <Col xs={24} sm={12} lg={7}>
        <Card bordered={false} className="glass-panel glow-card-cyan" styles={{ body: { padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                Holdings Blueprint
              </span>
              <PieChartOutlined style={{ color: 'var(--primary-color)', fontSize: '20px' }} />
            </div>
            
            {/* Active Stocks / Target occupied slots */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-family-mono)' }}>
                {portfolioSizing?.activeHoldingsCount || 0}
              </span>
              <span style={{ fontSize: '16px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                / {portfolioSizing?.targetStocks || 50} Target Stocks
              </span>
            </div>

            {/* Progress bar of slot occupancy */}
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{ 
                width: `${Math.min(100, ((portfolioSizing?.activeHoldingsCount || 0) / (portfolioSizing?.targetStocks || 1)) * 100)}%`, 
                height: '100%', 
                background: 'var(--primary-color)', 
                transition: 'width 0.5s ease' 
              }} />
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Initial Capital</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', fontFamily: 'var(--font-family-mono)' }}>
                {formatCurrency(portfolioSizing?.initialCapital)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Pos. Size/Trade</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary-color)', fontFamily: 'var(--font-family-mono)' }}>
                {formatCurrency(portfolioSizing?.positionSizeCash)}
              </span>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );
};
