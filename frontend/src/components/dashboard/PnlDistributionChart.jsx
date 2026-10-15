import { Card, Select, Typography } from 'antd';
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

const { Option } = Select;
const { Text } = Typography;

export const PnlDistributionChart = () => {
  const {
    displayCurrency,
    pnlMode,
    setPnlMode,
    pnlDimension,
    setPnlDimension,
    pnlDistributionData,
    isCensored,
    formatCurrency
  } = useAppData();

  const handleSelectView = (val) => {
    const [mode, dim] = val.split(':');
    setPnlMode(mode);
    setPnlDimension(dim);
  };

  const currentVal = `${pnlMode}:${pnlDimension}`;

  return (
    <Card 
      title={`P&L Distribution (${displayCurrency})`}
      extra={
        <Select
          size="small"
          value={currentVal}
          onChange={handleSelectView}
          style={{ width: 140 }}
          dropdownStyle={{ background: 'var(--bg-card)' }}
        >
          <Option value="realized:strategy">Realized • Strategy</Option>
          <Option value="realized:name">Realized • Asset</Option>
          <Option value="realized:type">Realized • Category</Option>
          <Option value="unrealized:name">Paper • Asset</Option>
          <Option value="unrealized:type">Paper • Category</Option>
        </Select>
      } 
      bordered={false} 
      className="glass-panel card-header-synced equal-height-card"
      style={{ height: '380px' }}
    >
      {pnlDistributionData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={pnlDistributionData}
            margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
            <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={val => isCensored ? '****' : val.toLocaleString()} />
            <Tooltip 
              cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value;
                  return (
                    <div className="custom-recharts-tooltip">
                      <p className="custom-recharts-tooltip-label">{label}</p>
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
        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary" style={{ color: '#5b6b80' }}>No strategy data logged in this portfolio.</Text>
        </div>
      )}
    </Card>
  );
};
