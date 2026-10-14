import {
  DashboardOutlined,
  BookOutlined,
  TableOutlined,
  SwapOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { Badge } from 'antd';
import { useAppData } from '../../context/AppDataContext.jsx';

export const MobileTabBar = () => {
  const { isMobile, activeTab, setActiveTab, dueCount } = useAppData();

  if (!isMobile) return null;

  return (
    <div className="mobile-tabbar">
      <button 
        className={`mobile-tabbar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
        onClick={() => setActiveTab('dashboard')}
      >
        <DashboardOutlined className="mobile-tabbar-icon" />
        <span>Dashboard</span>
      </button>
      <button 
        className={`mobile-tabbar-item ${activeTab === 'journal' ? 'active' : ''}`}
        onClick={() => setActiveTab('journal')}
      >
        <BookOutlined className="mobile-tabbar-icon" />
        <span>Journal</span>
      </button>
      <button 
        className={`mobile-tabbar-item ${activeTab === 'positions' ? 'active' : ''}`}
        onClick={() => setActiveTab('positions')}
      >
        <TableOutlined className="mobile-tabbar-icon" />
        <span>Positions</span>
      </button>
      <button 
        className={`mobile-tabbar-item ${activeTab === 'rebalance' ? 'active' : ''}`}
        onClick={() => setActiveTab('rebalance')}
      >
        <Badge count={dueCount} size="small" offset={[6, -2]}>
          <SwapOutlined className="mobile-tabbar-icon" />
        </Badge>
        <span>Rebalance</span>
      </button>
      <button 
        className={`mobile-tabbar-item ${activeTab === 'settings' ? 'active' : ''}`}
        onClick={() => setActiveTab('settings')}
      >
        <SettingOutlined className="mobile-tabbar-icon" />
        <span>Settings</span>
      </button>
    </div>
  );
};
