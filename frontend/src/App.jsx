import { Layout, Spin, Alert, Button, ConfigProvider, theme } from 'antd';
import { AppDataProvider, useAppData } from './context/AppDataContext.jsx';
import { OnboardingScreen } from './components/layout/OnboardingScreen.jsx';
import { LockScreen } from './components/layout/LockScreen.jsx';
import { AppSider } from './components/layout/AppSider.jsx';
import { AppHeader } from './components/layout/AppHeader.jsx';
import { MobileTabBar } from './components/layout/MobileTabBar.jsx';
import { DashboardTab } from './components/dashboard/DashboardTab.jsx';
import { JournalTab } from './components/journal/JournalTab.jsx';
import { PositionsTab } from './components/positions/PositionsTab.jsx';
import { RebalanceTab } from './components/rebalance/RebalanceTab.jsx';
import { CashTab } from './components/cash/CashTab.jsx';
import { SettingsTab } from './components/settings/SettingsTab.jsx';
import { LogTradeModal } from './components/modals/LogTradeModal.jsx';
import { EditStrategyModal } from './components/modals/EditStrategyModal.jsx';
import { PortfolioModals } from './components/modals/PortfolioModals.jsx';

const { Content } = Layout;

const AppContent = () => {
  const {
    isConnected,
    isLocked,
    isMobile,
    isSyncing,
    trades,
    cloudConnectionError,
    fetchData,
    activeTab
  } = useAppData();

  if (!isConnected) {
    return <OnboardingScreen />;
  }

  if (isLocked) {
    return <LockScreen />;
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar Navigation (PC only) */}
      <AppSider />

      <Layout>
        {/* Header Bar */}
        <AppHeader />

        {/* Content Area */}
        <Content style={{ padding: isMobile ? '12px 10px 80px 10px' : '24px', minHeight: 280, overflowY: 'auto' }}>
          <Spin spinning={isSyncing && trades.length === 0} tip="Syncing Terminal Feed...">
            {cloudConnectionError && (
              <Alert
                message={<strong>Cloud Sync Connection Blocked</strong>}
                description={
                  <div style={{ fontSize: '13px' }}>
                    <p style={{ margin: '0 0 8px 0' }}>
                      AlphaTrader was unable to fetch data from your Google Apps Script Web App: <code>{cloudConnectionError}</code>
                    </p>
                    <p style={{ margin: '0 0 8px 0' }}>
                      If this is a CORS/tracking blocker error, you can disable tracking protection for this page, or open the link in Incognito/Private mode. We have loaded a <strong>read-only direct Google Sheet fallback</strong> so you can still view your portfolio metrics, trades, and balance!
                    </p>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <Button 
                        size="small" 
                        type="primary" 
                        ghost 
                        onClick={() => {
                          localStorage.removeItem('google_apps_script_url');
                          localStorage.removeItem('google_sheet_id');
                          window.location.reload();
                        }}
                      >
                        Reset Cloud Connection Settings
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => fetchData()}
                      >
                        Retry Connection
                      </Button>
                    </div>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginBottom: '16px', border: '1px solid rgba(250, 173, 20, 0.2)', background: 'rgba(250, 173, 20, 0.05)' }}
              />
            )}

            {/* Tab Routing */}
            {activeTab === 'dashboard' && <DashboardTab />}
            {activeTab === 'journal' && <JournalTab />}
            {activeTab === 'positions' && <PositionsTab />}
            {activeTab === 'rebalance' && <RebalanceTab />}
            {activeTab === 'cash' && <CashTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </Spin>
        </Content>
      </Layout>

      {/* Global Modals */}
      <LogTradeModal />
      <EditStrategyModal />
      <PortfolioModals />

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar />
    </Layout>
  );
};

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#00f2fe',
          colorSuccess: '#10b981',
          colorError: '#f43f5e',
          colorBgBase: '#06080f',
          colorBgContainer: '#0b0e17',
          colorBorder: '#1f293d',
          fontFamily: "'Outfit', sans-serif"
        }
      }}
    >
      <AppDataProvider>
        <AppContent />
      </AppDataProvider>
    </ConfigProvider>
  );
}

export default App;
