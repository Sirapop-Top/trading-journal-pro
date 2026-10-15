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
    formatCurrency,
    cashKpis
  } = useAppData();

  const netAssetValue = (portfolioSizing?.cashOnHand || 0) + (kpis?.currentMarketValueConverted || 0);
  const netProfit = netAssetValue - (portfolioSizing?.initialCapital || 0);
  const netProfitPct = (portfolioSizing?.initialCapital || 0) > 0 ? (netProfit / portfolioSizing.initialCapital) * 100 : 0;
  const investedPct = netAssetValue > 0 ? Math.min(100, Math.max(0, ((kpis?.currentMarketValueConverted || 0) / netAssetValue) * 100)) : 0;
  const cashPct = Math.max(0, 100 - investedPct);
  const activeCount = portfolioSizing?.activeHoldingsCount || 0;
  const targetCount = portfolioSizing?.targetStocks || 50;
  const occupancyPct = Math.min(100, (activeCount / (targetCount || 1)) * 100);

  return (
    <Row gutter={[20, 20]} align="stretch">
      {/* Hero Widget 1: Account Valuation & Capital Efficiency */}
      <Col xs={24} md={8} lg={8} style={{ display: 'flex' }}>
        <Card
          bordered={false}
          className="glass-panel equal-height-card glow-card-cyan"
          style={{ width: '100%', height: '100%' }}
          styles={{ body: { padding: '22px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '32px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Net Asset Value (NAV)
              </span>
              <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '6px 8px', borderRadius: '8px' }}>
                <WalletOutlined style={{ color: 'var(--primary-color)', fontSize: '18px' }} />
              </div>
            </div>

            <div style={{ minHeight: '44px', display: 'flex', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.5px' }} className="financial-num">
                {formatCurrency(netAssetValue)}
              </span>
            </div>

            {/* Net ROI indicator */}
            <div style={{ minHeight: '26px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: netProfit >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                color: netProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
              }}>
                {netProfit >= 0 ? '▲ +' : '▼ '}{netProfitPct.toFixed(2)}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }} className="financial-num">
                ROI ({netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)})
              </span>
            </div>

            {/* Capital Utilization / Exposure Bar */}
            <div style={{ minHeight: '48px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Invested: <strong style={{ color: 'var(--primary-color)' }}>{investedPct.toFixed(1)}%</strong>
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Cash: <strong style={{ color: 'var(--success-color)' }}>{cashPct.toFixed(1)}%</strong>
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${investedPct}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)', transition: 'width 0.4s ease' }} />
                <div style={{ width: `${cashPct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          </div>

          {/* Bottom aligned metrics */}
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Market Value</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }} className="financial-num">
                {formatCurrency(kpis?.currentMarketValueConverted)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Cash on Hand</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success-color)' }} className="financial-num">
                {formatCurrency(portfolioSizing?.cashOnHand)}
              </span>
            </div>
          </div>
        </Card>
      </Col>

      {/* Hero Widget 2: Portfolio Return Metrics */}
      <Col xs={24} md={8} lg={8} style={{ display: 'flex' }}>
        <Card
          bordered={false}
          className={`glass-panel equal-height-card ${(kpis?.totalPnLConverted || 0) >= 0 ? 'glow-card-green' : 'glow-card-red'}`}
          style={{ width: '100%', height: '100%' }}
          styles={{ body: { padding: '22px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '32px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Total Return P&L
              </span>
              <div style={{ background: (kpis?.totalPnLConverted || 0) >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', padding: '6px 8px', borderRadius: '8px' }}>
                {(kpis?.totalPnLConverted || 0) >= 0 
                  ? <RiseOutlined style={{ color: 'var(--success-color)', fontSize: '18px' }} /> 
                  : <FallOutlined style={{ color: 'var(--danger-color)', fontSize: '18px' }} />
                }
              </div>
            </div>

            <div style={{ minHeight: '44px', display: 'flex', alignItems: 'center', marginTop: '6px' }}>
              <span style={{ 
                fontSize: '28px', 
                fontWeight: 800, 
                color: (kpis?.totalPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)', 
                letterSpacing: '-0.5px' 
              }} className="financial-num">
                {(kpis?.totalPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalPnLConverted)}
              </span>
            </div>

            <div style={{ minHeight: '26px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: (kpis?.totalPnLConverted || 0) >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                color: (kpis?.totalPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'
              }}>
                {(kpis?.totalPnLConverted || 0) >= 0 ? '▲ +' : '▼ '}{(kpis?.totalPnLPct || 0).toFixed(2)}%
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                All-time yield
              </span>
            </div>

            {/* Realized vs Unrealized balance bar */}
            <div style={{ minHeight: '48px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Realized: <strong style={{ color: (kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {(kpis?.totalRealizedPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalRealizedPnLConverted)}
                  </strong>
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  Paper: <strong style={{ color: (kpis?.totalUnrealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
                    {(kpis?.totalUnrealizedPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalUnrealizedPnLConverted)}
                  </strong>
                </span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ 
                  width: `${(kpis?.totalPnLConverted || 0) !== 0 ? Math.min(100, Math.max(10, Math.abs(kpis?.totalRealizedPnLConverted || 0) / (Math.abs(kpis?.totalRealizedPnLConverted || 0) + Math.abs(kpis?.totalUnrealizedPnLConverted || 0) || 1) * 100)) : 50}%`, 
                  height: '100%', 
                  background: (kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' 
                }} />
                <div style={{ 
                  flex: 1, 
                  height: '100%', 
                  background: (kpis?.totalUnrealizedPnLConverted || 0) >= 0 ? 'rgba(0, 242, 254, 0.7)' : 'rgba(244, 63, 94, 0.6)' 
                }} />
              </div>
            </div>
          </div>

          {/* Bottom aligned metrics */}
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Realized</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: (kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }} className="financial-num">
                {(kpis?.totalRealizedPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalRealizedPnLConverted)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Paper P&L</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: (kpis?.totalUnrealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }} className="financial-num">
                {(kpis?.totalUnrealizedPnLConverted || 0) >= 0 ? '+' : ''}{formatCurrency(kpis?.totalUnrealizedPnLConverted)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Dividends</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#00f2fe' }} className="financial-num">
                +{formatCurrency(cashKpis?.totalDividendsEver || 0)}
              </span>
            </div>
          </div>
        </Card>
      </Col>

      {/* Hero Widget 3: Sizing & Blueprint */}
      <Col xs={24} md={8} lg={8} style={{ display: 'flex' }}>
        <Card
          bordered={false}
          className="glass-panel equal-height-card glow-card-cyan"
          style={{ width: '100%', height: '100%' }}
          styles={{ body: { padding: '22px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '32px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Holdings Blueprint
              </span>
              <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '6px 8px', borderRadius: '8px' }}>
                <PieChartOutlined style={{ color: 'var(--primary-color)', fontSize: '18px' }} />
              </div>
            </div>
            
            <div style={{ minHeight: '44px', display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: '#ffffff' }} className="financial-num">
                {activeCount}
              </span>
              <span style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                / {targetCount} Target Slots
              </span>
            </div>

            <div style={{ minHeight: '26px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: occupancyPct <= 100 ? 'rgba(0, 242, 254, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: occupancyPct <= 100 ? 'var(--primary-color)' : '#f59e0b'
              }}>
                {occupancyPct.toFixed(1)}% Occupancy
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {targetCount - activeCount > 0 ? `${targetCount - activeCount} slots open` : 'Fully allocated'}
              </span>
            </div>

            {/* Progress bar of slot occupancy */}
            <div style={{ minHeight: '48px', marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Slot Allocation</span>
                <span style={{ color: 'var(--primary-color)', fontWeight: 600 }}>{activeCount} of {targetCount}</span>
              </div>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${occupancyPct}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #00f2fe 0%, #4facfe 100%)', 
                  transition: 'width 0.4s ease' 
                }} />
              </div>
            </div>
          </div>

          {/* Bottom aligned metrics */}
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Initial Capital</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }} className="financial-num">
                {formatCurrency(portfolioSizing?.initialCapital)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', fontWeight: 600 }}>Size / Slot</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-color)' }} className="financial-num">
                {formatCurrency(portfolioSizing?.positionSizeCash)}
              </span>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );
};
