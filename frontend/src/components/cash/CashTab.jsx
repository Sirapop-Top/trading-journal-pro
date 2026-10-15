import { Card, Typography, Button, Alert, Space } from 'antd';
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
      <div className="kpi-5-col-grid">
        <Card className="glass-panel equal-height-card" styles={{ body: { padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>CASH ON HAND</Text>
              <WalletOutlined style={{ color: 'var(--primary-color)' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: cashKpis.cashBalance >= 0 ? '#ffffff' : 'var(--danger-color)' }} className="financial-num">
              {formatCurrency(cashKpis.cashBalance, displayCurrency, isCensored)}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            {cashKpis.isFallback ? 'Estimated (Initial Capital)' : 'Actual Cash Balance'}
          </div>
        </Card>

        <Card className="glass-panel equal-height-card" styles={{ body: { padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>NET DEPOSITS</Text>
              <DollarOutlined style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#ffffff' }} className="financial-num">
              {formatCurrency(cashKpis.netDeposits, displayCurrency, isCensored)}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            In: {formatCurrency(cashKpis.totalDeposits, displayCurrency, isCensored)} | Out: {formatCurrency(cashKpis.totalWithdraws, displayCurrency, isCensored)}
          </div>
        </Card>

        <Card className="glass-panel equal-height-card" styles={{ body: { padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>DIVIDENDS YTD</Text>
              <PercentageOutlined style={{ color: '#00f2fe' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: 'var(--success-color)' }} className="financial-num">
              {formatCurrency(cashKpis.dividendsYTD, displayCurrency, isCensored)}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            All-time: {formatCurrency(cashKpis.totalDividendsEver, displayCurrency, isCensored)}
          </div>
        </Card>

        <Card className="glass-panel equal-height-card" styles={{ body: { padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>INTEREST YTD</Text>
              <TransactionOutlined style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: '#8b5cf6' }} className="financial-num">
              {formatCurrency(cashKpis.interestYTD, displayCurrency, isCensored)}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            All-time: {formatCurrency(cashKpis.totalInterestEver, displayCurrency, isCensored)}
          </div>
        </Card>

        <Card className="glass-panel equal-height-card" styles={{ body: { padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' } }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>TOTAL CASH RETURN</Text>
              <FundOutlined style={{ color: cashKpis.totalReturn >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }} />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '6px', color: cashKpis.totalReturn >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }} className="financial-num">
              {formatCurrency(cashKpis.totalReturn, displayCurrency, isCensored)}
            </div>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            Realized + Unrealized + Cash Income
          </div>
        </Card>
      </div>

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
