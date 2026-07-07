import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, ArrowDownLeft, ArrowUpRight, X, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { accountsAPI, transactionsAPI } from '../services/api';
import { formatCurrency, formatAccountNumber, formatDateTime, getTransactionAmountStyling, getTransactionDescription, isInternalTransfer } from '../utils/formatters';
import toast, { Toaster } from 'react-hot-toast';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './AccountsPage.css';

export default function AccountsPage() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [loadingTxns, setLoadingTxns] = useState(true);
  const [modal, setModal] = useState(null); // 'create' | 'deposit' | 'withdraw'
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [formData, setFormData] = useState({ accountType: 'savings', amount: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const fetchAccounts = async () => {
    try {
      const { data } = await accountsAPI.getAll();
      setAccounts(data.data.accounts || []);
    } catch { toast.error('Failed to load accounts'); }
    finally { setLoading(false); }
  };

  const fetchTransactions = async () => {
    try {
      const { data } = await transactionsAPI.getAll({ limit: 5 });
      setTransactions(data.data.transactions || []);
    } catch {
      // ignore
    } finally {
      setLoadingTxns(false);
    }
  };

  useEffect(() => { 
    fetchAccounts(); 
    fetchTransactions();
  }, []);

  // Handle auto-opening deposit modal from Dashboard "Add funds" link
  useEffect(() => {
    if (location.state?.openDeposit && accounts.length > 0) {
      const activeAccount = accounts.find(a => a.status === 'active');
      if (activeAccount) {
        setModal('deposit');
        setSelectedAccount(activeAccount);
        // Clear the state so it doesn't re-trigger on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [accounts, location, navigate]);

  const handleCreate = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await accountsAPI.create({ accountType: formData.accountType });
      toast.success('Account created!'); setModal(null); fetchAccounts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create account'); }
    finally { setSubmitting(false); }
  };

  const handleDeposit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await accountsAPI.deposit(selectedAccount.id, { amount: parseFloat(formData.amount), description: formData.description });
      toast.success('Deposit successful!'); setModal(null); setFormData({ ...formData, amount: '', description: '' }); fetchAccounts();
    } catch (err) { toast.error(err.response?.data?.message || 'Deposit failed'); }
    finally { setSubmitting(false); }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await accountsAPI.withdraw(selectedAccount.id, { amount: parseFloat(formData.amount), description: formData.description });
      toast.success('Withdrawal successful!'); setModal(null); setFormData({ ...formData, amount: '', description: '' }); fetchAccounts();
    } catch (err) { toast.error(err.response?.data?.message || 'Withdrawal failed'); }
    finally { setSubmitting(false); }
  };

  const typeColors = { savings: 'var(--accent-green)', checking: 'var(--accent-blue)', business: 'var(--accent-purple)' };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' } }} />
      <motion.div className="accounts-page" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="accounts-header">
          <div><h1>Your Accounts</h1><p>{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p></div>
        </div>

        {loading ? (
          <div className="accounts-grid">{[1,2,3].map(i => <div key={i} className="account-card skeleton" />)}</div>
        ) : accounts.length === 0 ? (
          <div className="empty-state">
            <Wallet size={48} />
            <h3>No accounts yet</h3>
            <p>Create your first bank account to get started.</p>
            <button className="btn-primary" onClick={() => setModal('create')} style={{ marginTop: '16px' }}>
              <Plus size={16} /> Create Account
            </button>
          </div>
        ) : (
          <div className="accounts-grid">
            {accounts.map((acc, i) => (
              <motion.div key={acc.id} className="account-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <div className="acc-header">
                  <span className="acc-type-badge" style={{ background: `${typeColors[acc.account_type]}20`, color: typeColors[acc.account_type] }}>{acc.account_type}</span>
                  <span className="acc-status"><span className="status-dot" style={{ background: acc.status === 'active' ? 'var(--accent-green)' : 'var(--danger)' }} />{acc.status}</span>
                </div>
                <div className="acc-holder-name">
                  {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Account Holder'}
                </div>
                <div className="acc-number-wrapper">
                  <div className="acc-number">{formatAccountNumber(acc.account_number)}</div>
                  <button 
                    className="copy-btn" 
                    title="Copy full account number"
                    onClick={() => {
                      navigator.clipboard.writeText(acc.account_number);
                      toast.success('Account number copied!');
                    }}
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="acc-balance">{formatCurrency(acc.balance)}</div>
                <div className="acc-currency">{acc.currency}</div>
                <div className="acc-actions">
                  <button className="acc-btn deposit" onClick={() => { setSelectedAccount(acc); setModal('deposit'); }}><ArrowDownLeft size={16} />Deposit</button>
                  <button className="acc-btn withdraw" onClick={() => { setSelectedAccount(acc); setModal('withdraw'); }}><ArrowUpRight size={16} />Withdraw</button>
                </div>
              </motion.div>
            ))}
            
            <motion.div 
              className="account-card-placeholder"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: accounts.length * 0.1 }}
              onClick={() => setModal('create')}
            >
              <div className="placeholder-content">
                <div className="placeholder-icon"><Plus size={24} /></div>
                <span>Add another account</span>
              </div>
            </motion.div>
          </div>
        )}

        <div className="recent-txns-section">
          <div className="recent-txns-header">
            <h2>Recent Transactions</h2>
            <Link to="/dashboard/transactions" className="view-all-link">View all</Link>
          </div>
          <div className="recent-txns-card">
            {loadingTxns ? (
              <div className="txn-loading">{[1,2,3].map(i => <div key={i} className="preview-txn-row skeleton" />)}</div>
            ) : transactions.length === 0 ? (
              <div className="empty-state-small"><p>No transactions yet</p></div>
            ) : (
              <div className="preview-txn-list">
                {transactions.map((txn, i) => {
                  const isIncoming = txn.type === 'deposit';
                  return (
                    <motion.div key={txn.id} className="preview-txn-row" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <div className="preview-txn-info">
                        <div className="preview-txn-desc" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getTransactionDescription(txn)}
                          {isInternalTransfer(txn) && (
                            <span style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                              ↔ Internal Transfer
                            </span>
                          )}
                        </div>
                        <div className="preview-txn-date">{formatDateTime(txn.created_at)}</div>
                      </div>
                      <div className="preview-txn-amount" style={{ color: getTransactionAmountStyling(txn).color }}>
                        {getTransactionAmountStyling(txn).prefix}{formatCurrency(Math.abs(txn.amount))}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {modal && (
          <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModal(null)}>
            <motion.div className="modal-card" initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{modal === 'create' ? 'Create Account' : modal === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}</h3>
                <button className="modal-close" onClick={() => setModal(null)}><X size={20} /></button>
              </div>

              {modal === 'create' ? (
                <form onSubmit={handleCreate}>
                  <label className="form-label">Account Type</label>
                  <div className="type-selector">
                    {['savings', 'checking', 'business'].map((t) => (
                      <button key={t} type="button" className={`type-btn ${formData.accountType === t ? 'active' : ''}`} onClick={() => setFormData({ ...formData, accountType: t })}
                        style={formData.accountType === t ? { borderColor: typeColors[t], background: `${typeColors[t]}15` } : {}}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? <span className="spinner" /> : 'Create Account'}</button>
                </form>
              ) : (
                <form onSubmit={modal === 'deposit' ? handleDeposit : handleWithdraw}>
                  <div className="modal-acc-info">
                    <span>{selectedAccount?.account_type}</span>
                    <span>{formatAccountNumber(selectedAccount?.account_number)}</span>
                    <span>Balance: {formatCurrency(selectedAccount?.balance)}</span>
                  </div>
                  <label className="form-label">Amount (₹)</label>
                  <input className="form-input" type="number" step="0.01" min="0.01" placeholder="0.00" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} required />
                  <label className="form-label">Description (optional)</label>
                  <input className="form-input" placeholder="Add a note..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                  <button type="submit" className="auth-submit" disabled={submitting} style={{ background: modal === 'deposit' ? 'linear-gradient(135deg, var(--accent-green), var(--accent-blue))' : 'linear-gradient(135deg, var(--accent-amber), var(--danger))' }}>
                    {submitting ? <span className="spinner" /> : modal === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
