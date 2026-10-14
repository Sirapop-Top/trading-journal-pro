import { Card, Progress, Select, Radio, Typography, Space } from 'antd';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar
} from 'recharts';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Text } = Typography;
const { Option } = Select;

export const MobileCharts = () => {
  const {
    mobileChartTab,
    displayCurrency,
    cumulativePnLData,
    kpis,
    isCensored,
    formatCurrency,
    tradingAnalytics,
    allocationDimension,
    setAllocationDimension,
    assetAllocationData,
    pnlMode,
    setPnlMode,
    pnlDimension,
    setPnlDimension,
    pnlDistributionData,
    realizedPnLBreakdownData
  } = useAppData();

  return (
    <>
      {mobileChartTab === 'performance' && (
        <Card title={`Realized Earnings Curve (${displayCurrency})`} bordered={false} style={{ height: '310px' }}>
          {cumulativePnLData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={cumulativePnLData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <defs>
                  <linearGradient id="pnlGradientMob" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={(kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={(kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                          <p className="custom-recharts-tooltip-label" style={{ fontSize: '11px' }}>{label}</p>
                          <p className="custom-recharts-tooltip-value">
                            Profit: {formatCurrency(payload[0].value)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
                <Area 
                  type="monotone" 
                  dataKey="PnL" 
                  stroke={(kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#pnlGradientMob)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No performance curve data.</Text>
            </div>
          )}
        </Card>
      )}

      {mobileChartTab === 'analytics' && (
        <Card title="📊 Trading Performance" bordered={false} className="glass-panel">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
            <Progress
              type="circle"
              percent={Number((tradingAnalytics?.winRate || 0).toFixed(1))}
              strokeWidth={8}
              width={90}
              strokeColor={{
                '0%': 'var(--danger-color)',
                '50%': 'rgba(245, 158, 11, 0.8)',
                '100%': 'var(--success-color)',
              }}
              trailColor="rgba(255,255,255,0.05)"
              format={(pct) => (
                <div style={{ color: '#ffffff' }}>
                  <div style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-family-mono)' }}>{pct}%</div>
                  <div style={{ fontSize: '8px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Win Rate</div>
                </div>
              )}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '11px' }}>
              <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{tradingAnalytics?.winCount || 0}W</span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{tradingAnalytics?.lossCount || 0}L</span>
              <span style={{ color: 'var(--text-muted)' }}>|</span>
              <span style={{ color: '#ffffff' }}>{tradingAnalytics?.totalClosedTrades || 0} Closed</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Actions</span>
              <strong style={{ color: '#ffffff', fontSize: '12px' }} className="financial-num">{tradingAnalytics?.totalTrades || 0} ({tradingAnalytics?.buysCount || 0} B / {tradingAnalytics?.sellsCount || 0} S)</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Profit Factor</span>
              <strong style={{ color: (tradingAnalytics?.profitFactor || 0) >= 1.5 ? 'var(--success-color)' : ((tradingAnalytics?.profitFactor || 0) >= 1.0 ? '#f59e0b' : 'var(--danger-color)'), fontSize: '12px' }} className="financial-num">
                {tradingAnalytics?.profitFactor === Infinity ? '∞' : (tradingAnalytics?.profitFactor || 0).toFixed(2)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Risk-Reward</span>
              <strong style={{ color: '#ffffff', fontSize: '12px' }} className="financial-num">1 : {(tradingAnalytics?.riskRewardRatio || 0).toFixed(2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Avg Win / Loss</span>
              <span className="financial-num" style={{ fontSize: '11px' }}>
                <strong style={{ color: 'var(--success-color)' }}>{formatCurrency(tradingAnalytics?.avgWin)}</strong>
                <strong style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</strong>
                <strong style={{ color: 'var(--danger-color)' }}>{formatCurrency(tradingAnalytics?.avgLoss)}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Max Win / Loss</span>
              <span className="financial-num" style={{ fontSize: '11px' }}>
                <strong style={{ color: 'var(--success-color)' }}>+{formatCurrency(tradingAnalytics?.maxWinVal)}</strong>
                <strong style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</strong>
                <strong style={{ color: 'var(--danger-color)' }}>-{formatCurrency(tradingAnalytics?.maxLossVal)}</strong>
              </span>
            </div>
          </div>
        </Card>
      )}

      {mobileChartTab === 'allocation' && (
        <Card 
          title={`Asset Allocation (${displayCurrency})`}
          extra={
            <Select
              size="small"
              value={allocationDimension}
              onChange={val => setAllocationDimension(val)}
              style={{ width: 110 }}
              dropdownStyle={{ background: 'var(--bg-card)' }}
            >
              <Option value="type">By Category</Option>
              <Option value="name">By Asset</Option>
            </Select>
          } 
          bordered={false} 
          style={{ height: '330px' }}
        >
          {assetAllocationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={assetAllocationData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {assetAllocationData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const entry = payload[0];
                      return (
                        <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                          <p className="custom-recharts-tooltip-label" style={{ color: entry.payload.color || 'var(--primary-color)', fontSize: '11px' }}>
                            ● {entry.name}
                          </p>
                          <p className="custom-recharts-tooltip-value">
                            Value: {formatCurrency(entry.value)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '230px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No active asset allocations.</Text>
            </div>
          )}
        </Card>
      )}

      {mobileChartTab === 'pnl' && (
        <Card 
          title={`Portfolio P&L (${displayCurrency})`}
          extra={
            <Space size={4} wrap>
              <Radio.Group
                size="small"
                value={pnlMode}
                onChange={e => {
                  const mode = e.target.value;
                  if (mode === 'unrealized' && pnlDimension === 'strategy') {
                    setPnlDimension('name');
                  }
                  setPnlMode(mode);
                }}
              >
                <Radio.Button value="realized">Realized</Radio.Button>
                <Radio.Button value="unrealized">Unrealized</Radio.Button>
              </Radio.Group>
              <Select
                size="small"
                value={pnlDimension}
                onChange={val => {
                  if (val === 'strategy' && pnlMode === 'unrealized') {
                    setPnlMode('realized');
                  }
                  setPnlDimension(val);
                }}
                style={{ width: 110 }}
                dropdownStyle={{ background: 'var(--bg-card)' }}
              >
                <Option value="strategy" disabled={pnlMode === 'unrealized'}>By Strategy</Option>
                <Option value="type">By Category</Option>
                <Option value="name">By Asset</Option>
              </Select>
            </Space>
          } 
          bordered={false} 
          style={{ height: '310px' }}
        >
          {pnlDistributionData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pnlDistributionData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0].value;
                      return (
                        <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                          <p className="custom-recharts-tooltip-label" style={{ fontSize: '11px' }}>{label}</p>
                          <p className="custom-recharts-tooltip-value" style={{ color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                            P&L: {formatCurrency(val)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0} stroke="#475569" />
                <Bar dataKey="PnL" radius={[4, 4, 0, 0]}>
                  {pnlDistributionData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.PnL >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No strategy data.</Text>
            </div>
          )}
        </Card>
      )}

      {mobileChartTab === 'breakdown' && (
        <Card title={`Realized P&L Breakdown (${displayCurrency})`} bordered={false} style={{ height: '310px' }}>
          {realizedPnLBreakdownData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={realizedPnLBreakdownData} layout="vertical" margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 8 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 9 }} width={55} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0].value;
                      return (
                        <div className="custom-recharts-tooltip" style={{ padding: '6px 10px', fontSize: '12px' }}>
                          <p className="custom-recharts-tooltip-label" style={{ fontSize: '11px' }}>{label}</p>
                          <p className="custom-recharts-tooltip-value" style={{ color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                            Realized: {formatCurrency(val)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine x={0} stroke="#475569" />
                <Bar dataKey="PnL" radius={[0, 4, 4, 0]}>
                  {realizedPnLBreakdownData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.PnL >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 8px' }}>
              <Text type="secondary" style={{ color: '#5b6b80', fontSize: '12px' }}>No realized gains/losses logged.</Text>
            </div>
          )}
        </Card>
      )}
    </>
  );
};
