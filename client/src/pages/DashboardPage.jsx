import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Landmark,
  ShieldAlert,
  X,
  Send,
  FileText,
  PlusCircle,
  BarChart3,
  ArrowRight
} from 'lucide-react';

import StatCard from '../components/dashboard/StatCard';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI } from '../services/api';
import './DashboardPage.css';

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.3 } },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // TODO: Add real fraud alert endpoint + wire banner to it.
  // const [showFraudBanner, setShowFraudBanner] = useState(false);
  // const fraudEventId = 'fraud-evt-8492';

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await analyticsAPI.getDashboard();
        setDashboardData(data.data);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Unable to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="dashboard-page dashboard-skeleton">
        <div className="skeleton" style={{ width: 280, height: 36, marginBottom: 8 }} />
        <div className="skeleton" style={{ width: 200, height: 20, marginBottom: 32 }} />
        <div className="skeleton-stat-grid">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-stat" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page dashboard-error">
        <h2>Dashboard Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  const { stats, recentTransactions } = dashboardData || {};

  return (
    <motion.div
      className="dashboard-page"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* 
        TODO: Uncomment and wire to real backend when fraud endpoint exists.
        <AnimatePresence>
          {showFraudBanner && (
            <motion.div 
              className="fraud-banner"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
            >
              <div className="fraud-banner__content">
                <ShieldAlert size={20} className="fraud-banner__icon" />
                <div>
                  <strong>Security Notice:</strong> We blocked a suspicious login attempt from an unrecognized device in Moscow, RU yesterday. Your account is secured.
                </div>
              </div>
              <button className="fraud-banner__close" onClick={dismissFraudBanner} aria-label="Dismiss">
                <X size={18} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      */}

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="dashboard-header__text">
          <h1>Welcome back, {user?.first_name || 'User'}</h1>
          <p>Here's what's happening with your accounts today.</p>
        </div>
        <div className="dashboard-header__actions">
          <Link to="/transfer" className="btn-primary">
            <Send size={16} /> New transfer
          </Link>
        </div>
      </header>

      {/* ── Stat Row (4 cards) ── */}
      <div className="stat-cards-grid">
        <StatCard
          icon={Wallet}
          label="Total Balance"
          value={stats?.total_balance}
          change={stats?.balance_change}
          color="blue"
          isCurrency
          index={0}
        />
        <StatCard
          icon={ArrowDownToLine}
          label="Recent Income (30d)"
          value={stats?.monthly_income}
          change={4.2} // Mocked change since we don't have historical delta
          color="mint"
          isCurrency
          index={1}
        />
        <StatCard
          icon={ArrowUpFromLine}
          label="Spend (30d)"
          value={stats?.monthly_spending}
          change={stats?.spending_change}
          color="amber"
          isCurrency
          index={2}
        />
        <div className="stat-card">
          <div className="stat-card__icon stat-card__icon--purple"><Landmark size={20} /></div>
          <div className="stat-card__label">Active loan status</div>
          <div className="stat-card__value">Not enrolled</div>
        </div>
      </div>

      {/* ── Two-Column Body ── */}
      <div className="dashboard-body">
        
        {/* Left Column: Recent Transactions */}
        <div className="dashboard-body__left">
          <RecentTransactions transactions={recentTransactions} />
        </div>

        {/* Right Column: Quick Actions & Loan CTA */}
        <div className="dashboard-body__right">
          
          <div className="panel quick-actions">
            <h3 className="panel__title">Quick Actions</h3>
            <div className="quick-actions__grid">
              <Link to="/transfer" className="action-btn">
                <Send size={20} />
                <span>Send money</span>
              </Link>
              <button className="action-btn" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>
                <FileText size={20} />
                <span>Coming soon</span>
              </button>
              <Link to="/accounts" state={{ openDeposit: true }} className="action-btn">
                <PlusCircle size={20} />
                <span>Add funds</span>
              </Link>
              <Link to="/transactions" className="action-btn">
                <BarChart3 size={20} />
                <span>View analytics</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Section: Promo/Loans ── */}
      <div className="dashboard-bottom">
        <div className="panel loan-cta">
          <div className="loan-cta__info">
            <div className="loan-cta__icon"><Landmark size={24} /></div>
            <div className="loan-cta__text">
              <h3>Flexible business loans</h3>
              <p>You don't have an active loan. Get up to ₹25,00,000 in capital based on your revenue.</p>
            </div>
          </div>
          <button className="btn-secondary loan-cta__btn" disabled>
            Coming soon
          </button>
        </div>
      </div>
    </motion.div>
  );
}
