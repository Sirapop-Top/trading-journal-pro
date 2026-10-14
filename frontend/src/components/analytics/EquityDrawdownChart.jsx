import { useEffect } from 'react';
import { Card, Row, Col, Typography, Select, Space, Button, Tooltip } from 'antd';
import {
  LineChartOutlined,
  ReloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  ComposedChart,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { useAppData } from '../../context/AppDataContext.jsx';
import { formatCurrency } from '../../lib/constants.js';

const { Text } = Typography;
const { Option } = Select;

const BENCHMARKS = [
  { label: '🇹🇭 SET Index (^SET.BK)', value: '^SET.BK' },
  { label: '🇺🇸 S&P 500 (^GSPC)', value: '^GSPC' },
  { label: '🪙 Bitcoin (BTC-USD)', value: 'BTC-USD' }
];

export const EquityDrawdownChart = () => {
  const {
    equityCurveData,
    normalizedBenchmark,
    selectedBenchmark,
    setSelectedBenchmark,
    fetchHistoricalData,
    isLoadingHistory,
    displayCurrency,
    isCensored
  } = useAppData();

  const { series = [], kpis = {} } = equityCurveData;

  // On mount or when benchmark changes, fetch benchmark historical prices
  useEffect(() => {
    if (selectedBenchmark) {
      fetchHistoricalData([selectedBenchmark], '5y');
    }
  }, [selectedBenchmark, fetchHistoricalData]);

  // Combine equity curve series with normalized benchmark data
  const combinedChartData = series.map(pt => {
    const bVal = normalizedBenchmark?.[pt.date];
    return {
      ...pt,
      benchmark: bVal !== undefined ? bVal : null
    };
  });

  return (
    <Card
      className="glass-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <LineChartOutlined style={{ color: '#00f2fe' }} />
            <span>Portfolio NAV & Underwater Drawdown Analysis</span>
            <Tooltip title="Daily Net Asset Value (Cash + Market Value) compared against selected benchmark normalized to 100 on start date.">
              <InfoCircleOutlined style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </Tooltip>
          </Space>

          <Space wrap>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Benchmark:</Text>
            <Select
              value={selectedBenchmark}
              onChange={setSelectedBenchmark}
              size="small"
              style={{ width: 190 }}
            >
              {BENCHMARKS.map(b => (
                <Option key={b.value} value={b.value}>{b.label}</Option>
              ))}
            </Select>
            <Button
              size="small"
              icon={<ReloadOutlined spin={isLoadingHistory} />}
              onClick={() => fetchHistoricalData([selectedBenchmark], '5y')}
              disabled={isLoadingHistory}
            >
              Sync Index
            </Button>
          </Space>
        </div>
      }
      styles={{ body: { padding: '16px' } }}
    >
      {/* KPI Cards Row */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={8} md={4}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>CURRENT NAV</Text>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {formatCurrency(kpis.currentEquity || 0, displayCurrency, isCensored)}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>ALL-TIME PEAK</Text>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {formatCurrency(kpis.peakEquity || 0, displayCurrency, isCensored)}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <div style={{ background: 'rgba(239, 68, 68, 0.06)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <Text type="secondary" style={{ fontSize: 11, color: '#fca5a5' }}>MAX DRAWDOWN</Text>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#ef4444', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {kpis.maxDrawdownPct ? `${kpis.maxDrawdownPct.toFixed(2)}%` : '0.00%'}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>PEAK DATE</Text>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1', marginTop: 4 }}>
              {kpis.peakDate || '-'}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>TROUGH DATE</Text>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#fca5a5', marginTop: 4 }}>
              {kpis.maxDrawdownDate || '-'}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={8} md={4}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>LONGEST DD DURATION</Text>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#fbbf24', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {kpis.maxDrawdownDurationDays || 0} <span style={{ fontSize: 11, fontWeight: 'normal', color: 'var(--text-muted)' }}>days</span>
            </div>
          </div>
        </Col>
      </Row>

      {/* Main Equity Curve & Benchmark Chart */}
      <div style={{ marginBottom: 12 }}>
        <Text strong style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 8 }}>
          EQUITY GROWTH VS BENCHMARK (NORMALIZED 100)
        </Text>
        <div style={{ height: 260, width: '100%' }}>
          {series.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              No trade data available to plot Equity Curve.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinedChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f2fe" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00f2fe" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                <YAxis
                  yAxisId="equity"
                  stroke="#64748b"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val)}
                />
                <YAxis
                  yAxisId="benchmark"
                  orientation="right"
                  stroke="#94a3b8"
                  tick={{ fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={(val) => `${val.toFixed(0)}`}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                  formatter={(val, name) => {
                    if (name === 'Portfolio Equity') return [formatCurrency(val, displayCurrency, isCensored), name];
                    if (name === 'Benchmark') return [`${Number(val).toFixed(2)} pts`, selectedBenchmark];
                    return [val, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 6 }} />
                <Area
                  yAxisId="equity"
                  type="monotone"
                  dataKey="equity"
                  name="Portfolio Equity"
                  stroke="#00f2fe"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#equityGrad)"
                />
                <Line
                  yAxisId="benchmark"
                  type="monotone"
                  dataKey="benchmark"
                  name="Benchmark"
                  stroke="#f59e0b"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 4"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Underwater Drawdown Chart */}
      <div>
        <Text strong style={{ fontSize: 13, color: '#f87171', display: 'block', marginBottom: 8 }}>
          UNDERWATER DRAWDOWN CURVE (%)
        </Text>
        <div style={{ height: 140, width: '100%' }}>
          {series.length === 0 ? null : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedChartData} margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="drawdownGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.0} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  domain={['auto', 0]}
                  tickFormatter={(val) => `${val.toFixed(0)}%`}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    borderColor: '#334155',
                    borderRadius: 8,
                    fontSize: 12
                  }}
                  formatter={(val) => [`${Number(val).toFixed(2)}%`, 'Drawdown']}
                />
                <Area
                  type="monotone"
                  dataKey="drawdownPct"
                  name="Drawdown %"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#drawdownGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
};
