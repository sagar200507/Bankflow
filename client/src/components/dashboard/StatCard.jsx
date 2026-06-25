/**
 * ═══════════════════════════════════════════════════════════════
 *  StatCard — Glassmorphism KPI Card Component
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';
import './StatCard.css';

const StatCard = ({ icon: Icon, label, value, change, color = 'blue', isCurrency = true, index = 0 }) => {
  const isPositive = change >= 0;

  const displayValue = isCurrency ? formatCurrency(value) : formatNumber(value);

  return (
    <motion.div
      className={`stat-card stat-card--${color}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{ scale: 1.02 }}
    >
      {/* Header: Icon + Change badge */}
      <div className="stat-card__header">
        <div className="stat-card__icon">
          <Icon />
        </div>
        {change != null && (
          <span
            className={`stat-card__change ${
              isPositive ? 'stat-card__change--up' : 'stat-card__change--down'
            }`}
          >
            {isPositive ? <TrendingUp /> : <TrendingDown />}
            {formatPercentage(change)}
          </span>
        )}
      </div>

      {/* Value */}
      <div className="stat-card__value">{displayValue}</div>

      {/* Label */}
      <div className="stat-card__label">{label}</div>

      {/* Decorative blob */}
      <div className="stat-card__blob" aria-hidden="true" />
    </motion.div>
  );
};

export default StatCard;
