import { Space, Typography } from 'antd';
import { BarChartOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { EquityDrawdownChart } from './EquityDrawdownChart.jsx';
import { MonthlyHeatmap } from './MonthlyHeatmap.jsx';
import { StrategyStatsTable } from './StrategyStatsTable.jsx';
import { AnnualTaxReport } from './AnnualTaxReport.jsx';

const { Title, Text } = Typography;

export const AnalyticsTab = () => {
  const { activePortfolio } = useAppData();

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Header Bar */}
      <div style={{ marginBottom: '24px' }}>
        <Title level={3} style={{ margin: 0, color: 'var(--text-primary)' }}>
          <BarChartOutlined style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
          Portfolio Analytics & Reports
        </Title>
        <Text style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          Deep-dive performance metrics, drawdown curves, monthly returns heatmap, and tax reports for <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{activePortfolio}</span>
        </Text>
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 1. Equity Curve & Drawdown Analysis */}
        <EquityDrawdownChart />

        {/* 2. Monthly Performance Heatmap */}
        <MonthlyHeatmap />

        {/* 3. Strategy Expectancy & Win Rates */}
        <StrategyStatsTable />

        {/* 4. Annual Tax Filing Report */}
        <AnnualTaxReport />
      </Space>
    </div>
  );
};
