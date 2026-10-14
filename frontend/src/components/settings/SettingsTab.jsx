import { Card, Table, Tag, Typography, Input, Select, Space, Button, Popconfirm, Switch, Alert, message } from 'antd';
import {
  PlusOutlined,
  SettingOutlined,
  DeleteOutlined,
  SyncOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Text } = Typography;
const { Option } = Select;

export const SettingsTab = () => {
  const {
    isMobile,
    portfolios,
    trades,
    getPortfolioConfig,
    setRenameTarget,
    renameForm,
    setIsRenameModalOpen,
    handleDeletePortfolio,
    formatCurrency,
    displayCurrency,
    setIsPortfolioModalOpen,
    googleSheetId,
    setGoogleSheetId,
    googleAppsScriptUrl,
    setGoogleAppsScriptUrl,
    handleSaveGoogleSheetSettings,
    isSyncingSheet,
    handleSyncGoogleSheet,
    setAppPasscode,
    setHasPasscode,
    setIsConnected,
    googleSheetSyncCount,
    hasPasscode,
    appPasscode,
    autoLockMinutes,
    setAutoLockMinutes,
    handleSaveSecuritySettings,
    handleDisablePasscode,
    autoRefresh,
    setAutoRefresh,
    liveRates
  } = useAppData();

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* Portfolios Management Card */}
      <Card 
        title="Portfolio Customizer"
        extra={
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setIsPortfolioModalOpen(true)}
            size="small"
            style={{ color: '#06080f', fontWeight: 'bold' }}
          >
            Create Portfolio
          </Button>
        } 
        bordered={false}
      >
        {isMobile ? (
          <div className="mobile-card-list" style={{ paddingBottom: 0 }}>
            {portfolios.map(p => {
              const count = trades.filter(t => t.portfolio === p).length;
              const config = getPortfolioConfig(p);
              return (
                <div key={p} className="mobile-feed-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--info-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '18px' }}>💼</span>
                      <div>
                        <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '14px' }}>{p}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{count} trades logged</div>
                      </div>
                    </div>
                    <Space size="middle">
                      <Button 
                        type="text" 
                        icon={<SettingOutlined />} 
                        style={{ padding: 0 }}
                        onClick={() => {
                          const conf = getPortfolioConfig(p);
                          setRenameTarget(p);
                          renameForm.setFieldsValue({ 
                            name: p,
                            initialCapital: conf.initialCapital,
                            targetStocks: conf.targetStocks
                          });
                          setIsRenameModalOpen(true);
                        }}
                      >
                        Configure
                      </Button>
                      <Popconfirm
                        title="Delete Portfolio"
                        description={`Are you sure you want to delete portfolio "${p}"?`}
                        onConfirm={() => handleDeletePortfolio(p)}
                        okText="Delete"
                        cancelText="Cancel"
                        disabled={portfolios.length > 0 && p === portfolios[0]}
                        okButtonProps={{ danger: true }}
                      >
                        <Button 
                          type="text" 
                          danger 
                          icon={<DeleteOutlined />} 
                          style={{ padding: 0 }}
                          disabled={portfolios.length > 0 && p === portfolios[0]}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '11px', color: 'var(--text-secondary)', paddingLeft: '28px' }}>
                    <div>Capital: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{formatCurrency(config.initialCapital, displayCurrency)}</span></div>
                    <div>Target: <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{config.targetStocks} stocks</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Table
            dataSource={portfolios.map(p => ({ name: p }))}
            rowKey="name"
            pagination={false}
            size="middle"
            scroll={{ x: 'max-content' }}
            columns={[
              {
                title: 'Portfolio Name',
                dataIndex: 'name',
                key: 'name',
                render: (text) => (
                  <span style={{ fontSize: '14px' }}>
                    💼 <strong style={{ color: '#ffffff' }}>{text}</strong>
                  </span>
                )
              },
              {
                title: 'Connected Trades count',
                key: 'trades_count',
                render: (_, record) => {
                  const count = trades.filter(t => t.portfolio === record.name).length;
                  return <Tag color="blue" style={{ borderRadius: '4px' }}>{count} trades</Tag>;
                }
              },
              {
                title: 'Initial Capital',
                key: 'initial_capital',
                render: (_, record) => {
                  const conf = getPortfolioConfig(record.name);
                  return <span style={{ color: '#ffffff', fontWeight: 'bold', fontFamily: 'var(--font-family-mono)' }}>{formatCurrency(conf.initialCapital, displayCurrency)}</span>;
                }
              },
              {
                title: 'Target Stocks to Hold',
                key: 'target_stocks',
                render: (_, record) => {
                  const conf = getPortfolioConfig(record.name);
                  return <span style={{ color: '#ffffff', fontWeight: 'bold' }}>{conf.targetStocks}</span>;
                }
              },
              {
                title: 'Action',
                key: 'portfolio_actions',
                align: 'right',
                render: (_, record) => (
                  <Space size="middle">
                    <Button 
                      type="text" 
                      icon={<SettingOutlined />} 
                      onClick={() => {
                        const conf = getPortfolioConfig(record.name);
                        setRenameTarget(record.name);
                        renameForm.setFieldsValue({ 
                          name: record.name,
                          initialCapital: conf.initialCapital,
                          targetStocks: conf.targetStocks
                        });
                        setIsRenameModalOpen(true);
                      }}
                    >
                      Configure
                    </Button>
                    <Popconfirm
                      title="Delete Portfolio"
                      description={`Are you sure you want to delete portfolio "${record.name}"? This is only possible if there are no logged trades associated with it.`}
                      onConfirm={() => handleDeletePortfolio(record.name)}
                      okText="Delete"
                      cancelText="Cancel"
                      disabled={portfolios.length > 0 && record.name === portfolios[0]}
                      okButtonProps={{ danger: true }}
                    >
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        disabled={portfolios.length > 0 && record.name === portfolios[0]}
                      >
                        Delete
                      </Button>
                    </Popconfirm>
                  </Space>
                )
              }
            ]}
          />
        )}
      </Card>

      {/* Google Sheets Mobile Sync Card */}
      <Card title="📱 Cloud Google Sheets & Mobile Sync" bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            Enable mobile access 24/7 with your PC closed. Sync your database to Google Sheets to read and write trades dynamically.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: '#ffffff', minWidth: '160px' }}>Google Sheet ID (Read):</strong>
              <Input 
                placeholder="" 
                value={googleSheetId} 
                onChange={(e) => setGoogleSheetId(e.target.value)} 
                style={{ maxWidth: '400px', flex: 1 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: '#ffffff', minWidth: '160px' }}>Apps Script URL (Write):</strong>
              <Input 
                placeholder="" 
                value={googleAppsScriptUrl} 
                onChange={(e) => setGoogleAppsScriptUrl(e.target.value)} 
                style={{ maxWidth: '400px', flex: 1 }}
              />
            </div>

            <div style={{ marginTop: '5px' }}>
              <Button 
                type="primary" 
                onClick={handleSaveGoogleSheetSettings} 
                loading={isSyncingSheet}
                style={{ color: '#06080f', fontWeight: 'bold' }}
              >
                Save Settings & Sync
              </Button>
            </div>
          </div>

          {googleSheetId && (
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '5px', flexWrap: 'wrap' }}>
              <Button 
                icon={<SyncOutlined spin={isSyncingSheet} />} 
                onClick={handleSyncGoogleSheet}
                loading={isSyncingSheet}
                style={{ fontWeight: 'bold' }}
              >
                Sync Google Sheet Now
              </Button>
              <Button 
                danger
                icon={<LogoutOutlined />}
                onClick={() => {
                  localStorage.removeItem('google_sheet_id');
                  localStorage.removeItem('google_apps_script_url');
                  localStorage.removeItem('alphatrader_passcode');
                  localStorage.removeItem('alphatrader_passcode_hash');
                  localStorage.removeItem('alphatrader_passcode_salt');
                  localStorage.removeItem('alphatrader_autolock');
                  setGoogleSheetId('');
                  setGoogleAppsScriptUrl('');
                  setAppPasscode('');
                  setHasPasscode(false);
                  setIsConnected(false);
                  message.success('Logged out successfully from Google Sheet.');
                }}
                style={{ fontWeight: 'bold' }}
              >
                Log Out / Disconnect
              </Button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Total synced trades: <Tag color="cyan">{googleSheetSyncCount}</Tag>
              </span>
            </div>
          )}

          <Alert 
            message={<span style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>Setup Guides & Codes</span>}
            description={
              <div style={{ fontSize: '12px' }}>
                <p style={{ margin: '0 0 8px 0' }}><strong>1. Share settings:</strong> Ensure your Google Sheet is set to <strong>"Anyone with the link can view"</strong> (read-only link sharing) so AlphaTrader can read data.</p>
                <p style={{ margin: 0 }}><strong>2. Apps Script (for Mobile Logging):</strong> To write trades from mobile, open your Google Sheet, click <em>Extensions &rarr; Apps Script</em>, paste the script code from the deployment guide, and deploy it as a <strong>Web App</strong> (Execute as: Me, Who has access: Anyone).</p>
              </div>
            }
            type="success"
            showIcon
            style={{ border: '1px solid rgba(82, 196, 26, 0.15)', background: 'rgba(82, 196, 26, 0.02)', color: 'var(--text-primary)' }}
          />
        </Space>
      </Card>

      {/* App Security & Lock Card */}
      <Card title="🔒 App Security & Lock" bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>
            Secure your trading journal data with a lock passcode. When enabled, you must enter the passcode to access the terminal.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: '#ffffff', minWidth: '160px' }}>Enable Passcode Lock:</strong>
              <Switch 
                checked={hasPasscode} 
                onChange={(checked) => {
                  if (!checked) {
                    handleDisablePasscode();
                  } else {
                    message.info('Please enter a passcode below and click Save Security Settings.');
                  }
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: '#ffffff', minWidth: '160px' }}>Passcode:</strong>
              <Input.Password 
                placeholder="Enter 4-6 digit code or password" 
                value={appPasscode} 
                onChange={(e) => setAppPasscode(e.target.value)} 
                style={{ maxWidth: '400px', flex: 1 }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ color: '#ffffff', minWidth: '160px' }}>Auto-Lock on Idle:</strong>
              <Select 
                value={autoLockMinutes} 
                onChange={(val) => {
                  setAutoLockMinutes(val);
                  localStorage.setItem('alphatrader_autolock', val.toString());
                  message.success(`Auto-lock configured for ${val === 0 ? 'Disabled' : `${val} minute(s)`}.`);
                }}
                style={{ width: '180px' }}
              >
                <Option value={0}>Disabled</Option>
                <Option value={1}>1 Minute</Option>
                <Option value={3}>3 Minutes</Option>
                <Option value={5}>5 Minutes</Option>
                <Option value={10}>10 Minutes</Option>
                <Option value={30}>30 Minutes</Option>
              </Select>
            </div>

            <div style={{ marginTop: '5px' }}>
              <Button 
                type="primary" 
                onClick={() => handleSaveSecuritySettings(appPasscode, autoLockMinutes)} 
                style={{ color: '#06080f', fontWeight: 'bold' }}
              >
                Save Security Settings
              </Button>
            </div>
          </div>
        </Space>
      </Card>

      {/* Feed & API Status Card */}
      <Card title="Yahoo Finance Data Config" bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: '#ffffff' }}>Yahoo Finance Auto-Refresh</strong>
              <br />
              <Text style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Automatically query Yahoo Finance API tickers and exchange rates every 60 seconds.</Text>
            </div>
            <Switch 
              checked={autoRefresh} 
              onChange={(checked) => setAutoRefresh(checked)} 
              checkedChildren="ON"
              unCheckedChildren="OFF"
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <strong style={{ color: '#ffffff' }}>Single Source of Truth (SSOT) Ticker Mappings</strong>
            <div style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>
              <ul>
                <li>Thai Stocks: Ticker mapped dynamically to <code>[ASSET_NAME].BK</code>. Fallback rules applied (e.g. BJC &rarr; <code>BJC.BK</code>).</li>
                <li>Global Stocks: Directly calls symbol ticker (e.g. MSTR &rarr; <code>MSTR</code>).</li>
                <li>Crypto Assets: Key in standard symbols (e.g. <code>BTC</code>, <code>ETH</code>, <code>SOL</code>). App automatically appends <code>-USD</code> (e.g. <code>BTC-USD</code>) for Yahoo Finance verification.</li>
                <li>USD to THB Rate: Fetched from Yahoo Forex ticker <code>USDTHB=X</code> (currently: {liveRates.USD.toFixed(4)}).</li>
                <li>EUR to THB Rate: Fetched from Yahoo Forex ticker <code>EURTHB=X</code> (currently: {liveRates.EUR.toFixed(4)}).</li>
              </ul>
            </div>
          </div>

          <Alert 
            message={<span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>Rate Limit Protection Active</span>}
            description="FastAPI caching prevents rapid consecutive calls from getting rate limited. Clicking 'Sync Markets' forces a background refresh and invalidates the local price cache safely."
            type="info"
            showIcon
            style={{ border: '1px solid rgba(0, 242, 254, 0.15)', background: 'rgba(0, 242, 254, 0.02)', color: 'var(--text-primary)' }}
          />
        </Space>
      </Card>
    </Space>
  );
};
