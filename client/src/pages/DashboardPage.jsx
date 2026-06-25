/**
 * ═══════════════════════════════════════════════════════════════
 *  DashboardPage — Main Dashboard Composition
 * ═══════════════════════════════════════════════════════════════
 *  Fetches analytics data and composes all dashboard widgets.
 *  Layout: Stats → Accounts + Chart → Recent Transactions
 * ═══════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';

import { motion } from 'framer-motion';
import {
  Wallet,
  Landmark,
  ArrowLeftRight,
  CreditCard,
} from 'lucide-react';

import StatCard from '../components/dashboard/StatCard';
import AccountCards from '../components/dashboard/AccountCards';
import SpendingChart from '../components/dashboard/SpendingChart';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../services/api';
import { formatCurrency } from '../utils/formatters';

import './DashboardPage.css';

/* ── Page transition variants ────────────────────────────────── */
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.3 },
  },
};

/* ── Loading Skeleton ────────────────────────────────────────── */
const DashboardSkeleton = () => (
  <div className="dashboard-page">
    <div className="dashboard-page__header">
      <div className="skeleton" style={{ width: 280, height: 36, marginBottom: 8 }} />
      <div className="skeleton" style={{ width: 200, height: 20 }} />
    </div>
    <div className="skeleton-stat-grid">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton skeleton-stat" />
      ))}
    </div>
    <div className="skeleton-middle">
      <div className="skeleton skeleton-card-tall" />
      <div className="skeleton skeleton-card-tall" />
    </div>
    <div className="skeleton skeleton-card-wide" />
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const { data } = await analyticsAPI.getDashboard();
        setDashboardData(data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err.message);
        setDashboardData(getDemoData());
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) return <DashboardSkeleton />;

  const { stats, recentTransactions, accounts, spendingData } =
    dashboardData || getDemoData();

  return (
    <motion.div
      className="dashboard-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <motion.div
        className="dashboard-page__header"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h1 className="dashboard-page__greeting">
          Welcome back, <span>{user?.first_name || 'User'}</span>
        </h1>
        <p className="dashboard-page__subtitle">
          Here's an overview of your finances today
        </p>
      </motion.div>

      {/* ── Row 1: Stat Cards ────────────────────────────────── */}
      <div className="dashboard-page__stats">
        <div className="stat-cards-grid">
          <StatCard
            icon={Wallet}
            label="Total Balance"
            value={stats?.totalBalance}
            change={stats?.balanceChange}
            color="blue"
            isCurrency
            index={0}
          />
          <StatCard
            icon={Landmark}
            label="Accounts"
            value={stats?.totalAccounts}
            change={stats?.accountsChange}
            color="purple"
            isCurrency={false}
            index={1}
          />
          <StatCard
            icon={ArrowLeftRight}
            label="Transactions"
            value={stats?.totalTransactions}
            change={stats?.transactionsChange}
            color="green"
            isCurrency={false}
            index={2}
          />
          <StatCard
            icon={CreditCard}
            label="Monthly Spending"
            value={stats?.monthlySpending}
            change={stats?.spendingChange}
            color="amber"
            isCurrency
            index={3}
          />
        </div>
      </div>

      {/* ── Row 2: Accounts + Chart ──────────────────────────── */}
      <div className="dashboard-page__middle">
        <AccountCards accounts={accounts} />
        <SpendingChart data={spendingData} />
      </div>

      {/* ── Row 3: Recent Transactions ───────────────────────── */}
      <div className="dashboard-page__bottom">
        <RecentTransactions transactions={recentTransactions} />
      </div>
    </motion.div>
  );
};

/* ── Demo / fallback data ────────────────────────────────────── */
function getDemoData() {
  return {
    stats: {
      totalBalance: 284750.63,
      balanceChange: 12.5,
      totalAccounts: 4,
      accountsChange: 0,
      totalTransactions: 1243,
      transactionsChange: 8.3,
      monthlySpending: 4285.92,
      spendingChange: -3.2,
    },
    accounts: [
      {
        id: '1',
        type: 'Checking',
        accountNumber: '4821739856',
        balance: 45230.85,
        currency: 'USD',
        status: 'active',
      },
      {
        id: '2',
        type: 'Savings',
        accountNumber: '7293018465',
        balance: 189520.78,
        currency: 'USD',
        status: 'active',
      },
      {
        id: '3',
        type: 'Business',
        accountNumber: '5018273640',
        balance: 50000.0,
        currency: 'USD',
        status: 'active',
      },
    ],
    recentTransactions: [
      {
        id: 't1',
        type: 'deposit',
        description: 'Salary Deposit — Acme Corp',
        amount: 8500,
        date: new Date(Date.now() - 86400000).toISOString(),
        status: 'completed',
      },
      {
        id: 't2',
        type: 'withdrawal',
        description: 'AWS Cloud Services',
        amount: 349.99,
        date: new Date(Date.now() - 172800000).toISOString(),
        status: 'completed',
      },
      {
        id: 't3',
        type: 'transfer',
        description: 'Transfer to Savings',
        amount: 2000,
        date: new Date(Date.now() - 259200000).toISOString(),
        status: 'completed',
      },
      {
        id: 't4',
        type: 'withdrawal',
        description: 'Figma Pro Subscription',
        amount: 15,
        date: new Date(Date.now() - 345600000).toISOString(),
        status: 'completed',
      },
      {
        id: 't5',
        type: 'deposit',
        description: 'Freelance Payment — Design',
        amount: 3200,
        date: new Date(Date.now() - 432000000).toISOString(),
        status: 'completed',
      },
      {
        id: 't6',
        type: 'withdrawal',
        description: 'Uber Ride',
        amount: 24.5,
        date: new Date(Date.now() - 518400000).toISOString(),
        status: 'pending',
      },
    ],
    spendingData: [
      { month: 'Jan', spending: 3200 },
      { month: 'Feb', spending: 2800 },
      { month: 'Mar', spending: 4100 },
      { month: 'Apr', spending: 3600 },
      { month: 'May', spending: 2950 },
      { month: 'Jun', spending: 4285 },
      { month: 'Jul', spending: 3800 },
      { month: 'Aug', spending: 3100 },
      { month: 'Sep', spending: 3650 },
      { month: 'Oct', spending: 2700 },
      { month: 'Nov', spending: 4500 },
      { month: 'Dec', spending: 3900 },
    ],
  };
}

export default DashboardPage;
