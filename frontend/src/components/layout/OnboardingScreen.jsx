import { Card, Button, Input, Space, Typography, Alert, message } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Title, Text } = Typography;

export const OnboardingScreen = () => {
  const {
    googleSheetId,
    setGoogleSheetId,
    googleAppsScriptUrl,
    setGoogleAppsScriptUrl,
    setIsConnected,
    setAppPasscode,
    setHasPasscode,
    fetchData
  } = useAppData();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at top, #141b2d 0%, #06080f 80%)', padding: '20px' }}>
      <Card 
        style={{ width: '100%', maxWidth: '480px', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)', borderRadius: '12px' }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>📱</div>
          <Title level={3} style={{ margin: 0, background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AlphaTrader Cloud
          </Title>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            Link your phone to your Google Sheet database
          </Text>
        </div>
        
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ background: '#0b0e17', border: '1px solid #1f293d', padding: '16px', borderRadius: '8px' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '8px', fontSize: '14px' }}>
              1. Paste Google Sheet ID: <span style={{ color: '#f43f5e' }}>*</span>
            </strong>
            <Input 
              placeholder=""
              value={googleSheetId}
              onChange={(e) => setGoogleSheetId(e.target.value)}
              style={{ width: '100%', borderRadius: '4px', marginBottom: '16px' }}
            />

            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '4px', fontSize: '14px' }}>
              2. Paste Apps Script URL: <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '12px' }}>(recommended — needed for live Yahoo Finance stock sync & writing trades)</span>
            </strong>
            <Input.Password
              placeholder=""
              value={googleAppsScriptUrl}
              onChange={(e) => setGoogleAppsScriptUrl(e.target.value)}
              style={{ width: '100%', borderRadius: '4px' }}
            />
          </div>

          <Button 
            type="primary" 
            block 
            size="large"
            style={{ fontWeight: 'bold', color: '#06080f' }}
            onClick={() => {
              if (!googleSheetId.trim()) {
                message.error('Please enter your Google Sheet ID.');
                return;
              }
              const scriptUrl = googleAppsScriptUrl.trim();
              if (scriptUrl && !scriptUrl.startsWith('https://script.google.com')) {
                message.error('Invalid Apps Script URL format.');
                return;
              }
              localStorage.setItem('google_sheet_id', googleSheetId.trim());
              if (scriptUrl) {
                localStorage.setItem('google_apps_script_url', scriptUrl);
              }
              setIsConnected(true);
              message.success('Connected! Loading your journal...');
              if (typeof fetchData === 'function') {
                fetchData();
              }
            }}
          >
            Connect Journal
          </Button>

          <Button 
            danger
            block 
            size="large"
            icon={<LogoutOutlined />}
            style={{ fontWeight: 'bold' }}
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
              message.success('Cleared all connection settings and logged out.');
            }}
          >
            Clear Settings & Log Out
          </Button>

          <Alert 
            type="info"
            showIcon
            message={<span style={{ fontWeight: 'bold' }}>First Time Setup?</span>}
            description={
              <span style={{ fontSize: '12px' }}>
                Only the <strong>Google Sheet ID</strong> is required to view your trades. The Apps Script URL is needed to <em>add or delete</em> trades from mobile.
              </span>
            }
          />
        </Space>
      </Card>
    </div>
  );
};
