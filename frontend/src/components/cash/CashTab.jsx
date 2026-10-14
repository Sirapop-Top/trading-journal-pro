import { Card, Row, Col, Typography, Button, Alert, Space } from 'antd';
import { PlusOutlined, WalletOutlined, DollarOutlined, TransactionOutlined, PercentageOutlined, FundOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { formatCurrency } from '../../lib/constants.js';
import { CashStatementTable } from './CashStatementTable.jsx';
import { CashEntryModal } from './CashEntryModal.jsx';

const { Title, Text } = Typography;

export const CashTab = () => {
  const {
    activePortfolio,
    cashKpis,
    displayCurrency,
    isCensored,
    handleOpenAddCashEntry
  } = useAppData();

  return (
    <div style={{ paddingBottom: '32px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Title level={3} style={{ margin: 0, color: 'var(--text-primary)' }}>
            <WalletOutlined style={{ marginRight: '8px', color: 'var(--primary-color)' }} />
            Cash & Income
          </Title>
          <Text style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Multi-currency cash ledger, dividend income, and running statement for <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>{activePortfolio}</span>
          </Text>
        </div>

        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenAddCashEntry()}
            style={{
              backgroundColor: 'var(--success-color)',
              border: 'none',
              fontWeight: 'bold',
              color: '#06080f'
            }}
          >
            Record Cash Entry
          </Button>
        </Space>
      </div>

      {/* No Deposit Alert Banner */}
      {!cashKpis.hasDeposit && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: '24px', borderRadius: '12px' }}
          message={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontWeight: 'bold' }}>No Opening Deposit Found: </span>
                Currently estimating cash on hand from portfolio initial capital. Record an "Opening Deposit" entry to unlock exact statement accounting.
              </div>
              <Button
                size="small"
                type="primary"
                onClick={() => handleOpenAddCashEntry()}
                style={{ backgroundColor: 'var(--primary-color)', border: 'none', color: '#06080f', fontWeight: 'bold' }}
              >
                + Add Opening Deposit
              </Button>
            </div>
          }
        />
      )}

      {/* KPI Cards Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card className="glass-card" styles={{ body: { padding: '16px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>CASH ON HAND</Text>
              <WalletOutlined style={{ color: 'var(--primary-color)' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '6px', color: cashKpis.cashBalance >= 0 ? '#ffffff' : 'var(--danger-color)', fontFamily: 'monospace' }}>
              {formatCurrency(cashKpis.cashBalance, displayCurrency, isCensored)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {cashKpis.isFallback ? 'Estimated from Initial Capital' : 'Actual Cash Balance'}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={5}>
          <Card className="glass-card" styles={{ body: { padding: '16px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>NET DEPOSITS</Text>
              <DollarOutlined style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '6px', color: '#ffffff', fontFamily: 'monospace' }}>
              {formatCurrency(cashKpis.netDeposits, displayCurrency, isCensored)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              In: {formatCurrency(cashKpis.totalDeposits, displayCurrency, isCensored)} | Out: {formatCurrency(cashKpis.totalWithdraws, displayCurrency, isCensored)}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={5}>
          <Card className="glass-card" styles={{ body: { padding: '16px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>DIVIDENDS YTD</Text>
              <PercentageOutlined style={{ color: '#00f2fe' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '6px', color: 'var(--success-color)', fontFamily: 'monospace' }}>
              {formatCurrency(cashKpis.dividendsYTD, displayCurrency, isCensored)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              All-time: {formatCurrency(cashKpis.totalDividendsEver, displayCurrency, isCensored)}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={5}>
          <Card className="glass-card" styles={{ body: { padding: '16px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>INTEREST YTD</Text>
              <TransactionOutlined style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '6px', color: '#8b5cf6', fontFamily: 'monospace' }}>
              {formatCurrency(cashKpis.interestYTD, displayCurrency, isCensored)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              All-time: {formatCurrency(cashKpis.totalInterestEver, displayCurrency, isCensored)}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8} xl={5}>
          <Card className="glass-card" styles={{ body: { padding: '16px' } }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>TOTAL RETURN</Text>
              <FundOutlined style={{ color: cashKpis.totalReturn >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', marginTop: '6px', color: cashKpis.totalReturn >= 0 ? 'var(--success-color)' : 'var(--danger-color)', fontFamily: 'monospace' }}>
              {formatCurrency(cashKpis.totalReturn, displayCurrency, isCensored)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Realized + Unrealized + Income - Ledger Costs
            </div>
          </Card>
        </Col>
      </Row>

      {/* Cash Statement Table Card */}
      <Card
        className="glass-card"
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TransactionOutlined style={{ color: 'var(--primary-color)' }} />
            <span>Account Statement & Cash Ledger</span>
          </div>
        }
      >
        <CashStatementTable />
      </Card>

      {/* Modal */}
      <CashEntryModal />
    </div>
  );
};
