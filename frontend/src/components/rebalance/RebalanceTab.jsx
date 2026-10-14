import { useState, useMemo } from 'react';
import {
  Row,
  Col,
  Button,
  Space,
  Tag,
  Typography,
  Empty,
  Badge,
  Segmented
} from 'antd';
import {
  PlusOutlined,
  SwapOutlined,
  HistoryOutlined,
  AlertOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { PairCard } from './PairCard.jsx';
import { PairFormModal } from './PairFormModal.jsx';
import { RebalanceCalculator } from './RebalanceCalculator.jsx';
import { RebalanceHistory } from './RebalanceHistory.jsx';

const { Title, Text } = Typography;

export const RebalanceTab = () => {
  const {
    portfolios,
    activePortfolio,
    trades,
    livePrices,
    liveRates,
    displayCurrency,
    isCensored,
    pairsWithStatus,
    dueCount,
    portfolioSizing,
    rebalanceLog,
    handleSavePair,
    handleTogglePairStatus,
    handleDeletePair,
    handleExecuteRebalance,
    handleRevertRebalance
  } = useAppData();

  const [activeView, setActiveView] = useState('pairs'); // 'pairs' | 'history'
  const [isPairModalOpen, setIsPairModalOpen] = useState(false);
  const [editingPair, setEditingPair] = useState(null);

  const [isCalcOpen, setIsCalcOpen] = useState(false);
  const [selectedCalcPair, setSelectedCalcPair] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter pairs based on active portfolio
  const displayedPairs = useMemo(() => {
    if (activePortfolio === 'All Portfolios') {
      return pairsWithStatus;
    }
    return pairsWithStatus.filter(p => p.portfolio === activePortfolio);
  }, [pairsWithStatus, activePortfolio]);

  const activeCount = useMemo(() => {
    return displayedPairs.filter(p => p.status === 'Active').length;
  }, [displayedPairs]);

  const handleOpenCreate = () => {
    setEditingPair(null);
    setIsPairModalOpen(true);
  };

  const handleOpenEdit = (pair) => {
    setEditingPair(pair);
    setIsPairModalOpen(true);
  };

  const handleOpenRebalance = (pair) => {
    setSelectedCalcPair(pair);
    setIsCalcOpen(true);
  };

  const handleSavePairSubmit = async (values) => {
    setActionLoading(true);
    const ok = await handleSavePair(values);
    setActionLoading(false);
    if (ok) {
      setIsPairModalOpen(false);
      setEditingPair(null);
    }
  };

  const handleExecuteRebalanceSubmit = async (payload) => {
    setActionLoading(true);
    const ok = await handleExecuteRebalance(payload);
    setActionLoading(false);
    if (ok) {
      setIsCalcOpen(false);
      setSelectedCalcPair(null);
    }
  };

  const handleRevertSubmit = async (rebalanceId) => {
    setActionLoading(true);
    await handleRevertRebalance(rebalanceId);
    setActionLoading(false);
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 20
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
            <SwapOutlined style={{ color: '#38bdf8' }} />
            Portfolio Rebalancing Center
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Maintain target asset ratios, manage synthetic hedges, and capture automated volatility drift.
          </Text>
        </div>

        <Space orientation="horizontal" size="middle">
          <Segmented
            value={activeView}
            onChange={setActiveView}
            options={[
              { label: 'Active Pairs', value: 'pairs', icon: <SwapOutlined /> },
              { label: 'Rebalance Log', value: 'history', icon: <HistoryOutlined /> }
            ]}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            style={{
              background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
              borderColor: '#0ea5e9'
            }}
          >
            New Pair
          </Button>
        </Space>
      </div>

      {/* Summary KPI Pills */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <Tag color="blue" style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}>
          Total Pairs: <strong>{displayedPairs.length}</strong>
        </Tag>
        <Tag color="cyan" style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6 }}>
          Active: <strong>{activeCount}</strong>
        </Tag>
        {dueCount > 0 && (
          <Badge count={dueCount} overflowCount={99}>
            <Tag color="error" style={{ padding: '4px 10px', fontSize: 13, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertOutlined /> Needs Rebalance: <strong>{dueCount}</strong>
            </Tag>
          </Badge>
        )}
      </div>

      {/* View Switch */}
      {activeView === 'history' ? (
        <RebalanceHistory
          rebalanceLog={rebalanceLog}
          portfolios={portfolios}
          activePortfolio={activePortfolio}
          displayCurrency={displayCurrency}
          liveRates={liveRates}
          isCensored={isCensored}
          onRevert={handleRevertSubmit}
          loading={actionLoading}
        />
      ) : displayedPairs.length === 0 ? (
        <div
          className="glassmorphism-card"
          style={{
            padding: 40,
            textAlign: 'center',
            borderRadius: 12,
            border: '1px dashed rgba(255, 255, 255, 0.15)'
          }}
        >
          <Empty
            description={
              <div>
                <Text strong style={{ fontSize: 16, color: '#f8fafc', display: 'block', marginBottom: 4 }}>
                  No Rebalance Pairs in this Portfolio
                </Text>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Configure your first asset pair to enable automated drift tracking and synthetic hedging.
                </Text>
              </div>
            }
          >
            <Space orientation="horizontal" size="middle" style={{ marginTop: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
                Create Custom Pair
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                onClick={() => {
                  setEditingPair(null);
                  setIsPairModalOpen(true);
                }}
              >
                Quick BTC Delta-Neutral Pair
              </Button>
            </Space>
          </Empty>
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {displayedPairs.map(pair => (
            <Col xs={24} md={12} xl={8} key={pair.pairId}>
              <PairCard
                pair={pair}
                displayCurrency={displayCurrency}
                liveRates={liveRates}
                isCensored={isCensored}
                onRebalanceNow={handleOpenRebalance}
                onEdit={handleOpenEdit}
                onToggleStatus={handleTogglePairStatus}
                onDelete={handleDeletePair}
              />
            </Col>
          ))}
        </Row>
      )}

      {/* Create / Edit Pair Modal */}
      <PairFormModal
        open={isPairModalOpen}
        initialValues={editingPair}
        portfolios={portfolios}
        activePortfolio={activePortfolio}
        onCancel={() => {
          setIsPairModalOpen(false);
          setEditingPair(null);
        }}
        onSubmit={handleSavePairSubmit}
        loading={actionLoading}
      />

      {/* Rebalance Calculator Drawer */}
      <RebalanceCalculator
        open={isCalcOpen}
        pair={selectedCalcPair}
        trades={trades}
        livePrices={livePrices}
        liveRates={liveRates}
        displayCurrency={displayCurrency}
        cashOnHand={portfolioSizing?.cashOnHand}
        onClose={() => {
          setIsCalcOpen(false);
          setSelectedCalcPair(null);
        }}
        onExecute={handleExecuteRebalanceSubmit}
        loading={actionLoading}
      />
    </div>
  );
};
