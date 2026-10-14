import { Row, Col, Card, Typography } from 'antd';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine
} from 'recharts';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Text } = Typography;

export const CumulativePnlChart = () => {
  const {
    displayCurrency,
    cumulativePnLData,
    kpis,
    isCensored,
    formatCurrency
  } = useAppData();

  return (
    <Row gutter={[24, 24]}>
      <Col span={24}>
        <Card title={`Realized Earnings Curve (${displayCurrency})`} bordered={false} style={{ height: '360px' }}>
          {cumulativePnLData.length > 0 ? (
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart
                data={cumulativePnLData}
                margin={{ top: 10, right: 15, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={(kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.25}/>
                    <stop offset="95%" stopColor={(kpis?.totalRealizedPnLConverted || 0) >= 0 ? 'var(--success-color)' : 'var(--danger-color)'} stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="custom-recharts-tooltip">
                          <p className="custom-recharts-tooltip-label">{label}</p>
                          <p className="custom-recharts-tooltip-value">
                            Realized Profit: {formatCurrency(payload[0].value)}
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
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#pnlGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text type="secondary" style={{ color: '#5b6b80' }}>No trade history to calculate realized performance curve.</Text>
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
};
