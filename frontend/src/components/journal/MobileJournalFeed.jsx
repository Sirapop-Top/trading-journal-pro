import { Space, Button, Popconfirm, Tag, Typography } from 'antd';
import { EditOutlined, SwapOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppData } from '../../context/AppDataContext.jsx';
import { resolveLivePrice } from '../../lib/portfolioEngine.js';

const { Text } = Typography;

export const MobileJournalFeed = () => {
  const {
    journalFilteredTrades,
    tradesWithRunningStats,
    liveRates,
    livePrices,
    displayCurrency,
    isCensored,
    formatCurrency,
    setEditingTrade,
    setIsCustomStrategy,
    editStrategyForm,
    setIsEditStrategyModalOpen,
    transferForm,
    setIsTransferModalOpen,
    handleDeleteTrade,
    handleRevertRebalance
  } = useAppData();

  const handleEditClick = (record) => {
    const standardStrategies = [
      "CDC Action Zone",
      "Breakout",
      "EMA Cross",
      "Support/Resistance Bounce",
      "Value Investment",
      "Rebalance"
    ];
    const isCustom = record.why && !standardStrategies.includes(record.why);
    setEditingTrade(record);
    setIsCustomStrategy(isCustom);
    editStrategyForm.setFieldsValue({
      quantity: record.quantity !== undefined ? Number(record.quantity) : 0,
      priceUnit: record.priceUnit !== undefined ? Number(record.priceUnit) : 0,
      feeAmount: record.feeAmount !== undefined ? Number(record.feeAmount) : 0,
      why: isCustom ? 'Other' : (record.why || undefined),
      customWhy: isCustom ? record.why : '',
      remark: record.remark
    });
    setIsEditStrategyModalOpen(true);
  };

  const handleTransferClick = (record) => {
    setEditingTrade(record);
    transferForm.setFieldsValue({
      targetPortfolio: record.portfolio
    });
    setIsTransferModalOpen(true);
  };

  return (
    <div className="mobile-card-list">
      {journalFilteredTrades.length > 0 ? (
        journalFilteredTrades.map(trade => {
          const actionLower = trade.action.toLowerCase();
          const isBuy = actionLower === 'buy';
          const qty = trade.quantity;
          const buyPrice = trade.priceUnit;
          const feeAmount = trade.feeAmount !== undefined ? Number(trade.feeAmount) : 0.0;
          
          const stats = tradesWithRunningStats[trade.id];
          const rateToTHB = liveRates[trade.currency] || 1.0;
          const displayRateToTHB = liveRates[displayCurrency] || 1.0;
          const lp = resolveLivePrice(trade.assetName, livePrices, null);
          const livePriceConverted = lp !== null ? (lp * rateToTHB) / displayRateToTHB : null;
          
          const pnlLocal = stats ? (isBuy ? stats.unrealizedPnL : stats.realizedPnL) : 0.0;
          const pnlConverted = (pnlLocal * rateToTHB) / displayRateToTHB;
          const totalCost = isBuy ? (qty * buyPrice + feeAmount) : (qty * buyPrice - feeAmount);
          
          const isProfit = pnlConverted >= 0;
          const hasDetails = trade.why || trade.remark;
          
          return (
            <div key={trade.id} className={`mobile-feed-card ${isBuy ? 'buy' : 'sell'}`}>
              <div className="mobile-feed-card-header">
                <div className="mobile-feed-card-title">
                  <span className="mobile-feed-card-ticker">{trade.assetName}</span>
                  <span className={`pill ${isBuy ? 'pill-buy' : 'pill-sell'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                    {trade.action.toUpperCase()}
                  </span>
                  {trade.rebalanceId && (
                    <Tag color="blue" style={{ fontSize: '9px', margin: 0 }}>
                      {trade.rebalanceId}
                    </Tag>
                  )}
                  <Tag color="geekblue" style={{ fontSize: '9px', margin: 0 }}>
                    {trade.portfolio}
                  </Tag>
                </div>
                <span className="mobile-feed-card-date">{trade.date}</span>
              </div>

              <div className="mobile-feed-card-grid">
                <div>
                  <div className="mobile-feed-card-label">Quantity</div>
                  <div className="mobile-feed-card-value financial-num">
                    {isCensored ? '****' : qty.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </div>
                </div>
                <div>
                  <div className="mobile-feed-card-label">Price/Unit</div>
                  <div className="mobile-feed-card-value financial-num">
                    {formatCurrency(buyPrice, trade.currency)}
                  </div>
                </div>
                <div>
                  <div className="mobile-feed-card-label">Live Price ({displayCurrency})</div>
                  <div className="mobile-feed-card-value financial-num" style={{ color: '#00f2fe' }}>
                    {livePriceConverted !== null ? formatCurrency(livePriceConverted, displayCurrency) : '-'}
                  </div>
                </div>
                <div>
                  <div className="mobile-feed-card-label">Total Cost</div>
                  <div className="mobile-feed-card-value financial-num">
                    {formatCurrency(totalCost, trade.currency)}
                  </div>
                </div>
                <div>
                  <div className="mobile-feed-card-label">Avg Cost Basis</div>
                  <div className="mobile-feed-card-value financial-num">
                    {formatCurrency(stats ? stats.avgCostBasis : buyPrice, trade.currency)}
                  </div>
                </div>
                <div>
                  <div className="mobile-feed-card-label">{isBuy ? 'Unrealized P&L' : 'Realized P&L'}</div>
                  <div className={`mobile-feed-card-value financial-num ${isProfit ? 'trend-up' : 'trend-down'}`}>
                    {isProfit ? '+' : ''}{isCensored ? '****' : pnlConverted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {hasDetails && (
                <div className="mobile-feed-card-expandable">
                  {trade.why && (
                    <div style={{ marginBottom: trade.remark ? '6px' : 0 }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Strategy</span>
                      <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{trade.why}</span>
                    </div>
                  )}
                  {trade.remark && (
                    <div>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Private Notes</span>
                      <span style={{ fontSize: '11px', color: '#e2e8f0' }}>{trade.remark}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="mobile-feed-card-footer">
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Category: {trade.assetType}</span>
                <Space size="middle">
                  <Button 
                    type="text" 
                    icon={<EditOutlined style={{ color: 'var(--primary-color)' }} />} 
                    size="small" 
                    title="Edit Trade Entry"
                    onClick={() => handleEditClick(trade)}
                    style={{ padding: 0 }}
                  />
                  <Button 
                    type="text" 
                    icon={<SwapOutlined style={{ color: 'var(--warning-color)' }} />} 
                    size="small" 
                    title="Transfer Portfolio"
                    onClick={() => handleTransferClick(trade)}
                    style={{ padding: 0 }}
                  />
                  <Popconfirm
                    title={trade.rebalanceId ? "Revert Entire Rebalance" : "Delete Trade"}
                    description={
                      trade.rebalanceId
                        ? `This trade is part of Rebalance ${trade.rebalanceId}. Reverting will remove BOTH the buy and sell trades. Proceed?`
                        : "Are you sure you want to delete this trade?"
                    }
                    onConfirm={() => trade.rebalanceId ? handleRevertRebalance(trade.rebalanceId) : handleDeleteTrade(trade.id)}
                    okText={trade.rebalanceId ? "Revert Rebalance" : "Delete"}
                    cancelText="Cancel"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />} size="small" style={{ padding: 0 }} />
                  </Popconfirm>
                </Space>
              </div>
            </div>
          );
        })
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(11, 14, 23, 0.4)', borderRadius: '12px' }}>
          <Text type="secondary">No transactions match search.</Text>
        </div>
      )}
    </div>
  );
};
