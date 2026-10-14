import { useState, useMemo } from 'react';
import { Card, Row, Col, Typography, Select, Button, Table, Tabs, Space } from 'antd';
import { FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { generateTaxReport, exportToCsv } from '../../lib/csvHelper.js';
import { formatCurrency } from '../../lib/constants.js';

const { Text } = Typography;
const { Option } = Select;

export const AnnualTaxReport = () => {
  const {
    trades = [],
    cashLedger = [],
    liveRates = {},
    isCensored
  } = useAppData();

  // Extract all available years from trades and dividends
  const availableYears = useMemo(() => {
    const ySet = new Set();
    trades.forEach(t => t.date && ySet.add(t.date.slice(0, 4)));
    cashLedger.forEach(c => c.date && ySet.add(c.date.slice(0, 4)));
    return Array.from(ySet).sort((a, b) => b.localeCompare(a));
  }, [trades, cashLedger]);

  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(availableYears[0] || currentYear);

  const report = useMemo(() => {
    return generateTaxReport(trades, cashLedger, selectedYear === 'All' ? null : selectedYear, liveRates);
  }, [trades, cashLedger, selectedYear, liveRates]);

  const handleExportCsv = () => {
    const filename = `AlphaTrader_Tax_Report_${selectedYear}`;
    // Export combined or section-based CSV
    const rows = [
      ['=== ANNUAL TAX REPORT: ' + selectedYear + ' ==='],
      ['Total Capital Gains (THB)', report.summary.totalCapitalGainsTHB],
      ['Total Gross Dividends (THB)', report.summary.totalGrossDividendsTHB],
      ['Total Withholding Tax Paid (THB)', report.summary.totalWhtTHB],
      ['Total Net Dividends Received (THB)', report.summary.totalNetDividendsTHB],
      [],
      ['=== SECTION 1: REALIZED CAPITAL GAINS ==='],
      ['Date', 'Portfolio', 'Asset Name', 'Asset Type', 'Quantity', 'Price', 'Currency', 'Realized P&L (Local)', 'FX To THB', 'Realized P&L (THB)', 'Strategy / Why'],
      ...report.tradeRows.map(r => Object.values(r)),
      [],
      ['=== SECTION 2: DIVIDEND INCOME & WITHHOLDING TAX ==='],
      ['Date', 'Portfolio', 'Asset', 'Currency', 'Gross', 'Withholding Tax', 'Net', 'FX To THB', 'Gross (THB)', 'WHT (THB)', 'Net (THB)', 'Note'],
      ...report.dividendRows.map(r => Object.values(r))
    ];

    exportToCsv(filename, ['AlphaTrader Tax Summary Report'], rows);
  };

  const tradeColumns = [
    { title: 'Date', dataIndex: 'Date', key: 'Date', width: 110 },
    { title: 'Portfolio', dataIndex: 'Portfolio', key: 'Portfolio', width: 120 },
    { title: 'Asset', dataIndex: 'Asset Name', key: 'Asset Name', width: 110, render: (v) => <strong>{v}</strong> },
    { title: 'Type', dataIndex: 'Asset Type', key: 'Asset Type', width: 120 },
    { title: 'Qty Sold', dataIndex: 'Quantity', key: 'Quantity', align: 'right', width: 90 },
    { title: 'Sell Price', dataIndex: 'Price', key: 'Price', align: 'right', width: 100 },
    { title: 'Cur', dataIndex: 'Currency', key: 'Currency', width: 70 },
    { title: 'Realized (Local)', dataIndex: 'Realized P&L (Local)', key: 'localPnl', align: 'right', width: 130 },
    { title: 'FX', dataIndex: 'FX To THB', key: 'fx', align: 'right', width: 80 },
    {
      title: 'Realized (THB)',
      dataIndex: 'Realized P&L (THB)',
      key: 'pnlThb',
      align: 'right',
      width: 140,
      render: (v) => {
        const num = parseFloat(v) || 0;
        return (
          <span style={{ color: num >= 0 ? '#34d399' : '#f87171', fontWeight: 800, fontFamily: 'var(--font-family-mono)' }}>
            {formatCurrency(num, 'THB', isCensored)}
          </span>
        );
      }
    }
  ];

  const dividendColumns = [
    { title: 'Date', dataIndex: 'Date', key: 'Date', width: 110 },
    { title: 'Portfolio', dataIndex: 'Portfolio', key: 'Portfolio', width: 120 },
    { title: 'Asset', dataIndex: 'Asset', key: 'Asset', width: 110, render: (v) => <strong>{v || '-'}</strong> },
    { title: 'Currency', dataIndex: 'Currency', key: 'Currency', width: 90 },
    { title: 'Gross (Local)', dataIndex: 'Gross', key: 'Gross', align: 'right', width: 120 },
    { title: 'WHT (Local)', dataIndex: 'Withholding Tax', key: 'WHT', align: 'right', width: 120 },
    { title: 'Net (Local)', dataIndex: 'Net', key: 'Net', align: 'right', width: 120 },
    { title: 'FX', dataIndex: 'FX To THB', key: 'fx', align: 'right', width: 80 },
    {
      title: 'Net (THB)',
      dataIndex: 'Net (THB)',
      key: 'netThb',
      align: 'right',
      width: 140,
      render: (v) => (
        <span style={{ color: '#00f2fe', fontWeight: 800, fontFamily: 'var(--font-family-mono)' }}>
          {formatCurrency(parseFloat(v) || 0, 'THB', isCensored)}
        </span>
      )
    }
  ];

  return (
    <Card
      className="glass-card"
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <FileTextOutlined style={{ color: '#10b981' }} />
            <span>Annual Tax Filing Report</span>
          </Space>

          <Space>
            <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tax Year:</Text>
            <Select
              value={selectedYear}
              onChange={setSelectedYear}
              size="small"
              style={{ width: 110 }}
            >
              <Option value="All">All Years</Option>
              {availableYears.map(y => (
                <Option key={y} value={y}>{y}</Option>
              ))}
            </Select>

            <Button
              type="primary"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleExportCsv}
              style={{ background: 'var(--accent-gradient)', border: 'none', color: '#06080f', fontWeight: 'bold' }}
            >
              Export CSV (BOM)
            </Button>
          </Space>
        </div>
      }
      styles={{ body: { padding: '16px' } }}
    >
      {/* Summary KPI Banner */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>TOTAL CAPITAL GAINS</Text>
            <div style={{ fontSize: 16, fontWeight: 800, color: report.summary.totalCapitalGainsTHB >= 0 ? '#34d399' : '#f87171', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {formatCurrency(report.summary.totalCapitalGainsTHB, 'THB', isCensored)}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>GROSS DIVIDENDS</Text>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {formatCurrency(report.summary.totalGrossDividendsTHB, 'THB', isCensored)}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>WITHHOLDING TAX (WHT)</Text>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {formatCurrency(report.summary.totalWhtTHB, 'THB', isCensored)}
            </div>
          </div>
        </Col>

        <Col xs={12} sm={6}>
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>NET DIVIDENDS RECEIVED</Text>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#00f2fe', fontFamily: 'var(--font-family-mono)', marginTop: 2 }}>
              {formatCurrency(report.summary.totalNetDividendsTHB, 'THB', isCensored)}
            </div>
          </div>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="trades"
        items={[
          {
            key: 'trades',
            label: `Capital Gains (${report.tradeRows.length} sales)`,
            children: (
              <Table
                columns={tradeColumns}
                dataSource={report.tradeRows}
                rowKey={(r, idx) => `tax-tr-${idx}`}
                pagination={{ pageSize: 8, size: 'small' }}
                scroll={{ x: 1000 }}
                size="small"
                locale={{ emptyText: 'No closed trades in selected tax year.' }}
              />
            )
          },
          {
            key: 'dividends',
            label: `Dividends & WHT (${report.dividendRows.length} payouts)`,
            children: (
              <Table
                columns={dividendColumns}
                dataSource={report.dividendRows}
                rowKey={(r, idx) => `tax-div-${idx}`}
                pagination={{ pageSize: 8, size: 'small' }}
                scroll={{ x: 1000 }}
                size="small"
                locale={{ emptyText: 'No dividend payouts in selected tax year.' }}
              />
            )
          }
        ]}
      />
    </Card>
  );
};
