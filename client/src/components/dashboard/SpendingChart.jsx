/**
 * ═══════════════════════════════════════════════════════════════
 *  SpendingChart — Monthly Spending Area Chart
 * ═══════════════════════════════════════════════════════════════
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import './SpendingChart.css';

/* ── Fallback data for preview ───────────────────────────────── */
const defaultData = [
  { month: 'Jan', spending: 2400 },
  { month: 'Feb', spending: 1398 },
  { month: 'Mar', spending: 3200 },
  { month: 'Apr', spending: 2780 },
  { month: 'May', spending: 1890 },
  { month: 'Jun', spending: 2390 },
  { month: 'Jul', spending: 3490 },
  { month: 'Aug', spending: 2000 },
  { month: 'Sep', spending: 2780 },
  { month: 'Oct', spending: 1890 },
  { month: 'Nov', spending: 3578 },
  { month: 'Dec', spending: 2390 },
];

/* ── Custom Glassmorphism Tooltip ────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{label}</div>
      <div className="chart-tooltip__value">
        {formatCurrency(payload[0].value)}
      </div>
    </div>
  );
};

const SpendingChart = ({ data, period = 'Last 12 Months' }) => {
  const chartData = data?.length ? data : defaultData;

  return (
    <motion.div
      className="spending-chart"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      {/* Header */}
      <div className="spending-chart__header">
        <h3 className="spending-chart__title">Spending Overview</h3>
        <span className="spending-chart__period">{period}</span>
      </div>

      {/* Chart */}
      <div className="spending-chart__container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              dy={8}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
            />

            <Tooltip content={<CustomTooltip />} cursor={false} />

            <Area
              type="monotone"
              dataKey="spending"
              stroke="#3b82f6"
              strokeWidth={2.5}
              fill="url(#spendingGradient)"
              dot={false}
              activeDot={{
                r: 5,
                fill: '#3b82f6',
                stroke: '#0f172a',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default SpendingChart;
