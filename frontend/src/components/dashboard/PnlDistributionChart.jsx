import { Card, Space, Radio, Select, Typography } from 'antd';
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

  return (
    <Card 
      title={`Portfolio P&L (${displayCurrency})`}
      extra={
        <Space size="small">
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
            style={{ width: 130 }}
            dropdownStyle={{ background: 'var(--bg-card)' }}
          >
            <Option value="strategy" disabled={pnlMode === 'unrealized'}>By Strategy</Option>
            <Option value="type">By Category</Option>
            <Option value="name">By Asset Name</Option>
          </Select>
        </Space>
      } 
      bordered={false} 
      style={{ height: '370px' }}
    >
      {pnlDistributionData.length > 0 ? (
        <ResponsiveContainer width="100%" height={270}>
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
        <div style={{ height: '270px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary" style={{ color: '#5b6b80' }}>No strategy data logged in this portfolio.</Text>
        </div>
      )}
    </Card>
  );
};
