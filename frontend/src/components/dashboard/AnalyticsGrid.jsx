import { Row, Col, Card, Progress } from 'antd';
import { useAppData } from '../../context/AppDataContext.jsx';

export const AnalyticsGrid = () => {
  const {
    tradingAnalytics,
    formatCurrency,
    isMobile
  } = useAppData();

  const buysCount = tradingAnalytics?.buysCount || 0;
  const sellsCount = tradingAnalytics?.sellsCount || 0;
  const totalTrades = tradingAnalytics?.totalTrades || 0;
  const buyRatio = totalTrades > 0 ? (buysCount / totalTrades) * 100 : 50;

  return (
    <Row gutter={[20, 20]}>
      <Col span={24}>
        <Card title="📊 Trading Analytics & Performance Statistics" bordered={false} className="glass-panel">
          <Row gutter={[24, 24]} align="middle">
            {/* Circular Win Rate Meter */}
            <Col xs={24} md={8} lg={7} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: !isMobile ? '1px solid rgba(255,255,255,0.06)' : 'none', padding: '12px 16px' }}>
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Progress
                  type="circle"
                  percent={Number((tradingAnalytics?.winRate || 0).toFixed(1))}
                  strokeWidth={8}
                  size={124}
                  strokeColor={{
                    '0%': 'var(--danger-color)',
                    '50%': 'rgba(245, 158, 11, 0.8)',
                    '100%': 'var(--success-color)',
                  }}
                  trailColor="rgba(255,255,255,0.05)"
                  format={(pct) => (
                    <div style={{ color: '#ffffff' }}>
                      <div style={{ fontSize: '22px', fontWeight: 800, fontFamily: 'var(--font-family-mono)' }} className="financial-num">{pct}%</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: '2px' }}>Win Rate</div>
                    </div>
                  )}
                />
              </div>
              <div style={{ display: 'flex', gap: '20px', marginTop: '16px', textAlign: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--success-color)', fontWeight: 700, display: 'block' }} className="financial-num">{tradingAnalytics?.winCount || 0} Wins</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Profitable Deals</span>
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', height: '26px' }} />
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--danger-color)', fontWeight: 700, display: 'block' }} className="financial-num">{tradingAnalytics?.lossCount || 0} Losses</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Losing Deals</span>
                </div>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '10px', fontWeight: 500 }}>
                Closed Deals: <strong style={{ color: '#ffffff' }} className="financial-num">{tradingAnalytics?.totalClosedTrades || 0}</strong>
              </div>
            </Col>

            {/* Efficiency & Averages Metrics */}
            <Col xs={24} md={16} lg={17}>
              <Row gutter={[16, 16]}>
                {/* 1. Profit Factor */}
                <Col xs={24} sm={8}>
                  <div className="analytics-stat-card" style={{ minHeight: '110px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Profit Factor</span>
                    <strong style={{ 
                      fontSize: '22px', 
                      color: (tradingAnalytics?.profitFactor || 0) >= 1.5 ? 'var(--success-color)' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? '#f59e0b' : 'var(--danger-color)'), 
                      marginTop: '2px'
                    }} className="financial-num">
                      {tradingAnalytics?.profitFactor === Infinity ? '∞' : (tradingAnalytics?.profitFactor || 0).toFixed(2)}
                    </strong>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      <span>{(tradingAnalytics?.profitFactor || 0) >= 1.5 ? '🏆 Strong' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? '⚖️ Positive' : '⚠️ Drawdown')}</span>
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <Progress 
                        percent={Math.min(100, ((tradingAnalytics?.profitFactor || 0) / 3.0) * 100)} 
                        showInfo={false} 
                        size="small" 
                        strokeColor={(tradingAnalytics?.profitFactor || 0) >= 1.5 ? 'var(--success-color)' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? '#f59e0b' : 'var(--danger-color)')}
                        trailColor="rgba(255,255,255,0.05)"
                      />
                    </div>
                  </div>
                </Col>

                {/* 2. Risk Reward */}
                <Col xs={24} sm={8}>
                  <div className="analytics-stat-card" style={{ minHeight: '110px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Risk / Reward</span>
                    <strong style={{ fontSize: '22px', color: '#ffffff', marginTop: '2px' }} className="financial-num">
                      1 : {(tradingAnalytics?.riskRewardRatio || 0).toFixed(2)}
                    </strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Loss vs Win Ratio
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <Progress 
                        percent={Math.min(100, ((tradingAnalytics?.riskRewardRatio || 0) / 3.0) * 100)} 
                        showInfo={false} 
                        size="small" 
                        strokeColor="var(--primary-color)"
                        trailColor="rgba(255,255,255,0.05)"
                      />
                    </div>
                  </div>
                </Col>

                {/* 3. Total Logged Actions */}
                <Col xs={24} sm={8}>
                  <div className="analytics-stat-card" style={{ minHeight: '110px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>Logged Actions</span>
                    <strong style={{ fontSize: '22px', color: '#ffffff', marginTop: '2px' }} className="financial-num">
                      {totalTrades}
                    </strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {buysCount} Buys / {sellsCount} Sells
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <Progress 
                        percent={buyRatio} 
                        showInfo={false} 
                        size="small" 
                        strokeColor="var(--primary-color)"
                        trailColor="rgba(244, 63, 94, 0.5)"
                      />
                    </div>
                  </div>
                </Col>

                {/* 4. Avg Win vs Avg Loss */}
                <Col xs={24} sm={12}>
                  <div className="analytics-stat-card" style={{ minHeight: '105px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Average Results</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Avg Win</span>
                        <strong style={{ color: 'var(--success-color)', fontSize: '15px' }} className="financial-num">+{formatCurrency(tradingAnalytics?.avgWin)}</strong>
                      </div>
                      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', height: '24px' }} />
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Avg Loss</span>
                        <strong style={{ color: 'var(--danger-color)', fontSize: '15px' }} className="financial-num">-{formatCurrency(tradingAnalytics?.avgLoss)}</strong>
                      </div>
                    </div>
                  </div>
                </Col>

                {/* 5. Max Win / Loss */}
                <Col xs={24} sm={12}>
                  <div className="analytics-stat-card" style={{ minHeight: '105px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginBottom: '4px' }}>Outlier Extremes</span>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Biggest Win</span>
                        <strong style={{ color: 'var(--success-color)', fontSize: '15px' }} className="financial-num">+{formatCurrency(tradingAnalytics?.maxWinVal)}</strong>
                      </div>
                      <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', height: '24px' }} />
                      <div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Biggest Loss</span>
                        <strong style={{ color: 'var(--danger-color)', fontSize: '15px' }} className="financial-num">-{formatCurrency(tradingAnalytics?.maxLossVal)}</strong>
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
