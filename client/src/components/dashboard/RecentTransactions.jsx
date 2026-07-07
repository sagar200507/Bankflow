/**
 * ═══════════════════════════════════════════════════════════════
 *  RecentTransactions — Transaction List Component
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Receipt,
} from 'lucide-react';
import { formatCurrency, formatDate, getTransactionAmountStyling, getTransactionDescription, isInternalTransfer } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import './RecentTransactions.css';

const typeConfig = {
  deposit: {
    icon: ArrowDownLeft,
    className: 'transaction-row__icon--deposit',
  },
  withdrawal: {
    icon: ArrowUpRight,
    className: 'transaction-row__icon--withdrawal',
  },
  transfer: {
    icon: ArrowLeftRight,
    className: 'transaction-row__icon--transfer',
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const RecentTransactions = ({ transactions = [] }) => {
  const { user } = useAuth();
  const isEmpty = transactions.length === 0;

  return (
    <motion.div
      className="recent-transactions"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    >
      {/* Header */}
      <div className="recent-transactions__header">
        <h3 className="recent-transactions__title">Recent Transactions</h3>
        <Link to="/transactions" className="recent-transactions__view-all">
          View All
        </Link>
      </div>

      {/* Transaction rows or empty state */}
      {isEmpty ? (
        <div className="recent-transactions__empty">
          <div className="recent-transactions__empty-icon">
            <Receipt />
          </div>
          <p className="recent-transactions__empty-title">No transactions yet</p>
          <p className="recent-transactions__empty-text">
            Your recent transactions will appear here once you make your first transfer.
          </p>
        </div>
      ) : (
        <motion.div
          className="recent-transactions__list"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {transactions.map((tx) => {
            const config = typeConfig[tx.transaction_type || tx.type] || typeConfig.transfer;
            const IconComp = config.icon;

            return (
              <motion.div
                key={tx.id || tx._id}
                className="transaction-row"
                variants={rowVariants}
              >
                {/* Type Icon */}
                <div className={`transaction-row__icon ${config.className}`}>
                  <IconComp />
                </div>

                {/* Info */}
                <div className="transaction-row__info">
                  <div className="transaction-row__description" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getTransactionDescription(tx)}
                    {isInternalTransfer(tx) && (
                      <span style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                        ↔ Internal Transfer
                      </span>
                    )}
                  </div>
                  <div className="transaction-row__date">
                    {formatDate(tx.created_at || tx.date || tx.createdAt)}
                  </div>
                </div>

                {/* Amount */}
                <div
                  className={`transaction-row__amount ${getTransactionAmountStyling(tx).cssClass}`}
                >
                  {getTransactionAmountStyling(tx).prefix}{formatCurrency(Math.abs(tx.amount))}
                </div>

                {/* Status badge */}
                {tx.status && (
                  <span
                    className={`transaction-row__status transaction-row__status--${tx.status}`}
                  >
                    {tx.status}
                  </span>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
};

export default RecentTransactions;
