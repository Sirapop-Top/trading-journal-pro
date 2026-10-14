import { useState } from 'react';
import { Card, Table, Typography, Tag, Select, Space, Tooltip } from 'antd';
import { CalendarOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { formatCurrency } from '../../lib/constants.js';

const { Text } = Typography;
const { Option } = Select;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const MonthlyHeatmap = () => {
  const {
    monthlyHeatmap,
    displayCurrency,
    isCensored
  } = useAppData();

  const [selectedYear, setSelectedYear] = useState('All');

  const { years = [], grid = {}, yearTotals = {}, grandTotal = { total: 0 } } = monthlyHeatmap;

  const displayedYears = selectedYear === 'All' ? years : [selectedYear];

  // Helper to determine cell background color based on PnL value
  const getCellBg = (val) => {
    if (!val || Math.abs(val) < 0.01) return 'rgba(255, 255, 255, 0.02)';
    if (val > 0) {
      if (val > 50000) return 'rgba(16, 185, 129, 0.35)';
      if (val > 10000) return 'rgba(16, 185, 129, 0.25)';
      return 'rgba(16, 185, 129, 0.15)';
    } else {
      if (val < -50000) return 'rgba(239, 68, 68, 0.35)';
      if (val < -10000) return 'rgba(239, 68, 68, 0.25)';
      return 'rgba(239, 68, 68, 0.15)';
    }
  };

  const getTextColor = (val) => {
    if (!val || Math.abs(val) < 0.01) return 'var(--text-muted)';
    return val > 0 ? '#34d399' : '#f87171';
  };

  const columns = [
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      fixed: 'left',
      width: 80,
      render: (yr) => <strong style={{ color: '#ffffff' }}>{yr}</strong>
    },
    ...MONTH_NAMES.map((mName, idx) => {
      const mStr = String(idx + 1).padStart(2, '0');
      return {
        title: mName,
        key: mStr,
        align: 'right',
        width: 100,
        render: (_, record) => {
          const cell = grid[record.year]?.[mStr] || { total: 0, realized: 0, dividends: 0, tradeCount: 0, divCount: 0 };
          const val = cell.total;
          const bg = getCellBg(val);
          const color = getTextColor(val);

          const tooltipContent = (
            <div style={{ fontSize: '11px', lineHeight: '18px' }}>
              <div><strong>{mName} {record.year}</strong></div>
              <div>Realized P&L: {formatCurrency(cell.realized, displayCurrency, isCensored)} ({cell.tradeCount} trades)</div>
              <div>Dividends: {formatCurrency(cell.dividends, displayCurrency, isCensored)} ({cell.divCount} payouts)</div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 4, paddingTop: 4 }}>
                <strong>Net Total: {formatCurrency(val, displayCurrency, isCensored)}</strong>
              </div>
            </div>
          );

          return (
            <Tooltip title={tooltipContent} placement="top">
              <div
                style={{
                  background: bg,
                  padding: '8px 4px',
                  borderRadius: '6px',
                  textAlign: 'right',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}
              >
                <span style={{ color, fontWeight: 700, fontSize: '12px', fontFamily: 'var(--font-family-mono)' }}>
                  {val !== 0 ? formatCurrency(val, displayCurrency, isCensored) : '-'}
                </span>
              </div>
            </Tooltip>
          );
        }
      };
    }),
    {
      title: 'YTD / Full Year',
      key: 'total',
      align: 'right',
      fixed: 'right',
      width: 130,
      render: (_, record) => {
        const yTotal = yearTotals[record.year]?.total || 0;
        const color = getTextColor(yTotal);
        return (
          <div style={{ fontWeight: 800, fontSize: '13px', color, fontFamily: 'var(--font-family-mono)' }}>
            {formatCurrency(yTotal, displayCurrency, isCensored)}
          </div>
        );
      }
    }
  ];

  const dataSource = displayedYears.map(yr => ({ key: yr, year: yr }));

  return (
    <Card
      className="glass-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <CalendarOutlined style={{ color: 'var(--primary-color)' }} />
            <span>Monthly Performance Heatmap</span>
            <Tooltip title="Aggregates Realized Capital Gains from closed trades + Net Dividend Income.">
              <InfoCircleOutlined style={{ color: 'var(--text-muted)', fontSize: 12 }} />
            </Tooltip>
          </Space>

          <Space>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Filter Year:</Text>
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              size="small"
              style={{ width: 100 }}
            >
              <Option value="All">All Years</Option>
              {years.map(yr => (
                <Option key={yr} value={yr}>{yr}</Option>
              ))}
            </Select>
            <Tag color={grandTotal.total >= 0 ? 'success' : 'error'} style={{ fontWeight: 700, padding: '2px 8px' }}>
              All-Time: {formatCurrency(grandTotal.total, displayCurrency, isCensored)}
            </Tag>
          </Space>
        </div>
      }
      styles={{ body: { padding: '12px' } }}
    >
      <Table
        columns={columns}
        dataSource={dataSource}
        pagination={false}
        scroll={{ x: 1300 }}
        size="small"
        locale={{ emptyText: 'No closed trades or dividend entries recorded yet.' }}
      />
    </Card>
  );
};
