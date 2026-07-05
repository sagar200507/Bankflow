/**
 * ═══════════════════════════════════════════════════════════════
 *  AccountCards — Horizontal Scrolling Account Cards
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatCurrency, formatAccountNumber } from '../../utils/formatters';
import './AccountCards.css';

const typeMap = {
  savings: 'savings',
  checking: 'checking',
  business: 'business',
  current: 'checking',
};

const AccountCards = ({ accounts = [] }) => {
  return (
    <div className="account-cards">
      <div className="account-cards__header">
        <h3 className="account-cards__title">Your Accounts</h3>
        <span className="account-cards__count">
          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="account-cards__scroll">
        {accounts.map((account, index) => {
          const rawType = account.account_type || account.type || 'checking';
          const acctType = typeMap[rawType.toLowerCase()] || 'checking';

          return (
            <motion.div
              key={account.id || account._id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.5,
                delay: 0.15 + index * 0.1,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <Link
                to={`/accounts/${account.id || account._id}`}
                className={`account-card account-card--${acctType}`}
              >
                {/* Accent bar is rendered via ::before */}

                {/* Top row: badge + status */}
                <div className="account-card__top">
                  <span className="account-card__type-badge">
                    {rawType.charAt(0).toUpperCase() + rawType.slice(1)}
                  </span>
                  <span className="account-card__status">
                    <span
                      className={`account-card__status-dot ${
                        account.status === 'inactive'
                          ? 'account-card__status-dot--inactive'
                          : ''
                      }`}
                    />
                    {account.status || 'Active'}
                  </span>
                </div>

                {/* Masked account number */}
                <div className="account-card__number">
                  {formatAccountNumber(account.account_number || account.accountNumber)}
                </div>

                {/* Balance */}
                <div className="account-card__balance-label">Available Balance</div>
                <div>
                  <span className="account-card__balance">
                    {formatCurrency(account.balance)}
                  </span>
                  <span className="account-card__currency">
                    {account.currency || 'INR'}
                  </span>
                </div>

                {/* Decorative orb */}
                <div className="account-card__glow-orb" aria-hidden="true" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default AccountCards;
