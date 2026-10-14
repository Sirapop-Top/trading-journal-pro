import { Row, Col, Card, Progress } from 'antd';
import { useAppData } from '../../context/AppDataContext.jsx';

export const AnalyticsGrid = () => {
  const {
    tradingAnalytics,
    formatCurrency,
    isMobile
  } = useAppData();

  return (
    <Row gutter={[24, 24]}>
      <Col span={24}>
        <Card title="📊 Trading Analytics & Performance Statistics" bordered={false} className="glass-panel">
          <Row gutter={[32, 24]} align="middle">
            {/* Circular Win Rate Meter */}
            <Col xs={24} md={8} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: !isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Progress
                  type="circle"
                  percent={Number((tradingAnalytics?.winRate || 0).toFixed(1))}
                  strokeWidth={8}
                  width={120}
                  strokeColor={{
                    '0%': 'var(--danger-color)',
                    '50%': 'rgba(245, 158, 11, 0.8)',
                    '100%': 'var(--success-color)',
                  }}
                  trailColor="rgba(255,255,255,0.05)"
                  format={(pct) => (
                    <div style={{ color: '#ffffff' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-family-mono)' }}>{pct}%</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Win Rate</div>
                    </div>
                  )}
                />
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '16px', textAlign: 'center' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--success-color)', fontWeight: 700, display: 'block' }}>{tradingAnalytics?.winCount || 0} Wins</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Green Deals</span>
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '24px' }} />
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--danger-color)', fontWeight: 700, display: 'block' }}>{tradingAnalytics?.lossCount || 0} Losses</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Red Deals</span>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 500 }}>
                Total Closed Transactions: <strong style={{ color: '#ffffff' }}>{tradingAnalytics?.totalClosedTrades || 0}</strong>
              </div>
            </Col>

            {/* Efficiency & Averages Metrics */}
            <Col xs={24} md={16}>
              <Row gutter={[24, 20]}>
                {/* Profit Factor */}
                <Col xs={12} sm={8}>
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Profit Factor</span>
                    <strong style={{ 
                      fontSize: '22px', 
                      color: (tradingAnalytics?.profitFactor || 0) >= 1.5 ? 'var(--success-color)' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? '#f59e0b' : 'var(--danger-color)'), 
                      fontFamily: 'var(--font-family-mono)',
                      marginTop: '4px'
                    }}>
                      {tradingAnalytics?.profitFactor === Infinity ? '∞' : (tradingAnalytics?.profitFactor || 0).toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {(tradingAnalytics?.profitFactor || 0) >= 1.5 ? '🏆 Excellent' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? '⚖️ Profitable' : '⚠️ Unprofitable')}
                    </span>
                    <div style={{ marginTop: '8px' }}>
                      <Progress 
                        percent={Math.min(100, ((tradingAnalytics?.profitFactor || 0) / 3.0) * 100)} 
                        showInfo={false} 
                        size="small" 
                        status={(tradingAnalytics?.profitFactor || 0) >= 1.5 ? 'success' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? 'normal' : 'exception')}
                        strokeColor={(tradingAnalytics?.profitFactor || 0) >= 1.5 ? 'var(--success-color)' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? '#f59e0b' : 'var(--danger-color)')}
                      />
                    </div>
                  </div>
                </Col>

                {/* Risk Reward */}
                <Col xs={12} sm={8}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Risk-Reward Ratio</span>
                    <strong style={{ fontSize: '22px', color: '#ffffff', fontFamily: 'var(--font-family-mono)', marginTop: '4px' }}>
                      1 : {(tradingAnalytics?.riskRewardRatio || 0).toFixed(2)}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Avg Loss vs Avg Win
                    </span>
                    <div style={{ marginTop: '8px' }}>
                      <Progress 
                        percent={Math.min(100, ((tradingAnalytics?.riskRewardRatio || 0) / 3.0) * 100)} 
                        showInfo={false} 
                        size="small" 
                        strokeColor="var(--primary-color)"
                      />
                    </div>
                  </div>
                </Col>

                {/* Total Trades Count */}
                <Col xs={12} sm={8}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Total Actions logged</span>
                    <strong style={{ fontSize: '22px', color: '#ffffff', fontFamily: 'var(--font-family-mono)', marginTop: '4px' }}>
                      {tradingAnalytics?.totalTrades || 0}
                    </strong>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {tradingAnalytics?.buysCount || 0} Buys / {tradingAnalytics?.sellsCount || 0} Sells
                    </span>
                  </div>
                </Col>

                {/* Avg Win / Loss */}
                <Col xs={12} sm={12}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Avg Win vs Avg Loss</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>AVERAGE WIN</span>
                        <strong style={{ color: 'var(--success-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(tradingAnalytics?.avgWin)}</strong>
                      </div>
                      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', height: '20px' }} />
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>AVERAGE LOSS</span>
                        <strong style={{ color: 'var(--danger-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(tradingAnalytics?.avgLoss)}</strong>
                      </div>
                    </div>
                  </div>
                </Col>

                {/* Max Win / Loss */}
                <Col xs={12} sm={12}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Extreme Trades (Max)</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>BIGGEST WIN</span>
                        <strong style={{ color: 'var(--success-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>+{formatCurrency(tradingAnalytics?.maxWinVal)}</strong>
                      </div>
                      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', height: '20px' }} />
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>BIGGEST LOSS</span>
                        <strong style={{ color: 'var(--danger-color)', fontSize: '14px', fontFamily: 'var(--font-family-mono)' }}>-{formatCurrency(tradingAnalytics?.maxLossVal)}</strong>
                      </div>
                    </div>
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
};
