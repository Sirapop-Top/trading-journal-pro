import { Card, Typography } from 'antd';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell
} from 'recharts';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Text } = Typography;

export const RealizedBreakdownChart = () => {
  const {
    displayCurrency,
    realizedPnLBreakdownData,
    isCensored,
    formatCurrency
  } = useAppData();

  return (
    <Card title={`Realized P&L Breakdown (${displayCurrency})`} bordered={false} style={{ height: '370px' }}>
      {realizedPnLBreakdownData.length > 0 ? (
        <ResponsiveContainer width="100%" height={270}>
          <BarChart
            data={realizedPnLBreakdownData}
            layout="vertical"
            margin={{ top: 10, right: 15, left: 15, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
            <YAxis dataKey="name" type="category" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} width={55} />
            <Tooltip 
              cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value;
                  return (
                    <div className="custom-recharts-tooltip">
                      <p className="custom-recharts-tooltip-label">{label}</p>
                      <p className="custom-recharts-tooltip-value" style={{ color: val >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontWeight: 'bold' }}>
                        Realized P&L: {formatCurrency(val)}
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
        <div style={{ height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', textAlign: 'center' }}>
          <Text type="secondary" style={{ color: '#5b6b80', fontSize: '13px' }}>
            No realized gains/losses logged yet.
            <br />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Realized returns are locked in upon SELL transactions.</span>
          </Text>
        </div>
      )}
    </Card>
  );
};
