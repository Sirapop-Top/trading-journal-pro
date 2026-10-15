import { Card, Select, Typography } from 'antd';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Option } = Select;
const { Text } = Typography;

export const AllocationChart = () => {
  const {
    displayCurrency,
    allocationDimension,
    setAllocationDimension,
    assetAllocationData,
    formatCurrency
  } = useAppData();

  return (
    <Card 
      title={`Asset Allocation (${displayCurrency})`}
      extra={
        <Select
          size="small"
          value={allocationDimension}
          onChange={val => setAllocationDimension(val)}
          style={{ width: 130 }}
          dropdownStyle={{ background: 'var(--bg-card)' }}
        >
          <Option value="type">By Category</Option>
          <Option value="name">By Asset Name</Option>
        </Select>
      } 
      bordered={false} 
      className="glass-panel card-header-synced equal-height-card"
      style={{ height: '380px' }}
    >
      {assetAllocationData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={assetAllocationData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={88}
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
                    <div className="custom-recharts-tooltip">
                      <p className="custom-recharts-tooltip-label" style={{ color: entry.payload.color || 'var(--primary-color)' }}>
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
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text type="secondary" style={{ color: '#5b6b80' }}>No active asset allocations in this portfolio.</Text>
        </div>
      )}
    </Card>
  );
};
