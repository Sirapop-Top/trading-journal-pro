import { Layout, Menu, Typography, Space, Tag } from 'antd';
import {
  DashboardOutlined,
  BookOutlined,
  TableOutlined,
  SwapOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';

const { Sider } = Layout;
const { Title, Text } = Typography;

export const AppSider = () => {
  const {
    isMobile,
    siderCollapsed,
    setSiderCollapsed,
    activeTab,
    setActiveTab,
    dueCount,
    liveRates
  } = useAppData();

  if (isMobile) return null;

  return (
    <Sider 
      collapsible 
      collapsed={siderCollapsed} 
      onCollapse={(value) => setSiderCollapsed(value)}
      breakpoint="lg" 
      collapsedWidth="0" 
      theme="dark" 
      width={240}
      trigger={null}
    >
      <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)', boxShadow: '0 0 10px rgba(0,242,254,0.6)' }}></div>
        <Title level={4} style={{ color: '#ffffff', margin: 0, fontFamily: 'var(--font-family-ui)', fontWeight: 900, letterSpacing: '0.8px' }}>
          ALPHA<span style={{ color: 'var(--primary-color)' }}>TRADER</span>
        </Title>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[activeTab]}
        onClick={({ key }) => setActiveTab(key)}
        style={{ paddingTop: '16px' }}
      >
        <Menu.Item key="dashboard" icon={<DashboardOutlined />}>Dashboard</Menu.Item>
        <Menu.Item key="journal" icon={<BookOutlined />}>Trading Journal</Menu.Item>
        <Menu.Item key="positions" icon={<TableOutlined />}>Active Positions</Menu.Item>
        <Menu.Item key="rebalance" icon={<SwapOutlined />}>
          Rebalance {dueCount > 0 && <Tag color="error" style={{ marginLeft: 6, fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>{dueCount}</Tag>}
        </Menu.Item>
        <Menu.Item key="settings" icon={<SettingOutlined />}>Terminal Settings</Menu.Item>
      </Menu>

      {/* Global Connection Info in Sider Footer */}
      <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '16px', borderTop: '1px solid var(--border-color)', background: 'rgba(6, 8, 15, 0.4)' }}>
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>USD/THB:</Text>
            <Tag color="cyan" style={{ margin: 0, fontFamily: 'var(--font-family-mono)', fontSize: '10px', border: 'none', background: 'rgba(0, 242, 254, 0.12)' }}>
              ฿ {liveRates.USD ? liveRates.USD.toFixed(2) : '36.50'}
            </Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>EUR/THB:</Text>
            <Tag color="purple" style={{ margin: 0, fontFamily: 'var(--font-family-mono)', fontSize: '10px', border: 'none', background: 'rgba(147, 51, 234, 0.12)' }}>
              ฿ {liveRates.EUR ? liveRates.EUR.toFixed(2) : '39.80'}
            </Tag>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
            <Text style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>Yahoo Feed:</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span className="glow-green" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
              <Text style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>Live</Text>
            </div>
          </div>
        </Space>
      </div>
    </Sider>
  );
};
