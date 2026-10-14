import { Layout, Button, Select, Space, Typography, Switch, DatePicker } from 'antd';
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  SyncOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Header } = Layout;
const { Text } = Typography;
const { Option } = Select;

export const AppHeader = () => {
  const {
    isMobile,
    activePortfolio,
    setActivePortfolio,
    portfolios,
    displayCurrency,
    setDisplayCurrency,
    isCensored,
    toggleCensored,
    appPasscode,
    hasPasscode,
    setIsLocked,
    isSyncing,
    syncMarketData,
    siderCollapsed,
    setSiderCollapsed,
    autoRefresh,
    setAutoRefresh,
    syncTime,
    dateRangePreset,
    setDateRangePreset,
    customDateRange,
    setCustomDateRange
  } = useAppData();

  if (isMobile) {
    return (
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        height: '56px', 
        lineHeight: '56px', 
        padding: '0 12px', 
        background: 'var(--bg-container)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        width: '100%',
        boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-gradient)', boxShadow: '0 0 8px rgba(0,242,254,0.6)' }}></div>
          <span style={{ color: '#ffffff', fontFamily: 'var(--font-family-ui)', fontWeight: 950, fontSize: '13px', letterSpacing: '0.5px' }}>
            {isMobile ? 'A' : 'ALPHA'}<span style={{ color: 'var(--primary-color)' }}>{isMobile ? 'T' : 'TRADER'}</span>
          </span>
          <Select
            value={activePortfolio}
            onChange={(val) => setActivePortfolio(val)}
            style={{ width: 105, marginLeft: '6px' }}
            size="small"
            dropdownStyle={{ background: 'var(--bg-card)' }}
          >
            <Option value="All Portfolios">🗂️ All</Option>
            {portfolios.map(p => (
              <Option key={p} value={p}>💼 {p.slice(0, 8)}{p.length > 8 ? '..' : ''}</Option>
            ))}
          </Select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Select
            value={dateRangePreset}
            onChange={(val) => setDateRangePreset(val)}
            style={{ width: 65 }}
            size="small"
            dropdownStyle={{ background: 'var(--bg-card)' }}
          >
            <Option value="All">All</Option>
            <Option value="YTD">YTD</Option>
            <Option value="1Y">1Y</Option>
            <Option value="3Y">3Y</Option>
          </Select>
          <Select
            value={displayCurrency}
            onChange={(val) => setDisplayCurrency(val)}
            style={{ width: 75 }}
            size="small"
            dropdownStyle={{ background: 'var(--bg-card)' }}
          >
            <Option value="THB">฿ THB</Option>
            <Option value="USD">$ USD</Option>
            <Option value="EUR">€ EUR</Option>
          </Select>
          <Button 
            size="small"
            icon={isCensored ? <EyeInvisibleOutlined /> : <EyeOutlined />} 
            onClick={toggleCensored}
            style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff' }}
          />
          {(hasPasscode || appPasscode) && (
            <Button 
              size="small"
              icon={<LockOutlined />} 
              onClick={() => setIsLocked(true)}
              style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff' }}
            />
          )}
          <Button 
            type="primary" 
            size="small"
            icon={<SyncOutlined spin={isSyncing} />} 
            onClick={() => syncMarketData()}
            loading={isSyncing}
            style={{ background: 'var(--accent-gradient)', border: 'none', color: '#06080f', fontWeight: 'bold' }}
          />
        </div>
      </Header>
    );
  }

  return (
    <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', height: 'auto', minHeight: '72px', padding: '12px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <Button
          type="text"
          icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={() => setSiderCollapsed(!siderCollapsed)}
          style={{
            fontSize: '18px',
            width: 40,
            height: 40,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
          }}
        />
        {siderCollapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', boxShadow: '0 0 8px rgba(0,242,254,0.6)' }}></div>
            <Text style={{ color: '#ffffff', margin: 0, fontFamily: 'var(--font-family-ui)', fontWeight: 900, fontSize: '15px', letterSpacing: '0.8px' }}>
              ALPHA<span style={{ color: 'var(--primary-color)' }}>TRADER</span>
            </Text>
          </div>
        )}
        
        <Space size="small" wrap>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Portfolio:</Text>
            <Select
              value={activePortfolio}
              onChange={(val) => setActivePortfolio(val)}
              style={{ width: 180 }}
            >
              <Option value="All Portfolios">🗂️ All Portfolios (Aggregated)</Option>
              {portfolios.map(p => (
                <Option key={p} value={p}>💼 {p}</Option>
              ))}
            </Select>
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Period:</Text>
            <Select
              value={dateRangePreset}
              onChange={(val) => setDateRangePreset(val)}
              style={{ width: 105 }}
            >
              <Option value="All">All Time</Option>
              <Option value="YTD">YTD</Option>
              <Option value="1Y">1 Year</Option>
              <Option value="3Y">3 Years</Option>
              <Option value="Custom">Custom</Option>
            </Select>
            {dateRangePreset === 'Custom' && (
              <DatePicker.RangePicker
                style={{ width: 220 }}
                value={customDateRange && customDateRange[0] ? [dayjs(customDateRange[0]), dayjs(customDateRange[1])] : null}
                onChange={(dates) => {
                  if (dates && dates[0] && dates[1]) {
                    setCustomDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]);
                  } else {
                    setCustomDateRange(null);
                  }
                }}
              />
            )}
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Text style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Currency:</Text>
            <Select
              value={displayCurrency}
              onChange={(val) => setDisplayCurrency(val)}
              style={{ width: 95 }}
            >
              <Option value="THB">฿ THB</Option>
              <Option value="USD">$ USD</Option>
              <Option value="EUR">€ EUR</Option>
            </Select>
          </span>
        </Space>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold' }}>AUTO-REFRESH:</span>
          <Switch 
            checked={autoRefresh} 
            onChange={(checked) => setAutoRefresh(checked)} 
            checkedChildren="ON"
            unCheckedChildren="OFF"
            size="small"
          />
        </div>

        {syncTime && (
          <Text style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', background: 'rgba(16, 185, 129, 0.08)', padding: '4px 8px', borderRadius: '4px' }} className="financial-num">
            🟢 Synced: {syncTime}
          </Text>
        )}

        <Button 
          icon={isCensored ? <EyeInvisibleOutlined /> : <EyeOutlined />} 
          onClick={toggleCensored}
          style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff', borderRadius: '6px', fontWeight: 'bold' }}
        >
          {isCensored ? "Show Balances" : "Censor Balances"}
        </Button>
        {hasPasscode && (
          <Button 
            icon={<LockOutlined />} 
            onClick={() => setIsLocked(true)}
            style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', color: '#ffffff', borderRadius: '6px', fontWeight: 'bold' }}
          >
            Lock App
          </Button>
        )}
        
        <Button 
          type="primary" 
          icon={<SyncOutlined spin={isSyncing} />} 
          onClick={() => syncMarketData()}
          loading={isSyncing}
          style={{ background: 'var(--accent-gradient)', border: 'none', color: '#06080f', fontWeight: 'bold', borderRadius: '6px' }}
        >
          Sync Markets
        </Button>
      </div>
    </Header>
  );
};
