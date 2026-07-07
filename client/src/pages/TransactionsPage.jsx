import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, FileText, Download, ShieldAlert } from 'lucide-react';
import { transactionsAPI, accountsAPI } from '../services/api';
import { formatCurrency, formatDateTime, getStatusColor, getTypeColor, getTransactionAmountStyling, getTransactionDescription, isInternalTransfer } from '../utils/formatters';
import { generateReceipt } from '../utils/receiptGenerator';
import toast, { Toaster } from 'react-hot-toast';
import FraudExplanation from '../components/history/FraudExplanation';
import { useAuth } from '../context/AuthContext';
import './TransactionsPage.css';

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [expandedFlagRow, setExpandedFlagRow] = useState(null);

  useEffect(() => {
    accountsAPI.getAll().then(({ data }) => setAccounts(data.data.accounts || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const fetchFn = selectedAccount === 'all'
      ? transactionsAPI.getAll({ page, limit: 15 })
      : transactionsAPI.getByAccount(selectedAccount, { page, limit: 15 });
    fetchFn.then(({ data }) => {
      setTransactions(data.data.transactions || []);
      setPagination(data.pagination || {});
    }).catch(() => toast.error('Failed to load transactions'))
      .finally(() => setLoading(false));
  }, [selectedAccount, page]);

  const typeIcons = { deposit: ArrowDownLeft, withdrawal: ArrowUpRight, transfer: ArrowLeftRight };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' } }} />
      <motion.div className="txn-page" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="txn-header">
          <h1>Transaction History</h1>
          <select className="txn-filter" value={selectedAccount} onChange={(e) => { setSelectedAccount(e.target.value); setPage(1); }}>
            <option value="all">All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.account_type} · ···{a.account_number?.slice(-4)}</option>)}
          </select>
        </div>

        <div className="txn-table-card">
          {loading ? (
            <div className="txn-loading">{[1,2,3,4,5].map(i => <div key={i} className="txn-row skeleton" />)}</div>
          ) : transactions.length === 0 ? (
            <div className="empty-state"><FileText size={48} /><h3>No transactions yet</h3><p>Your transaction history will appear here.</p></div>
          ) : (
            <div className="txn-list">
              {transactions.map((txn, i) => {
                const actualType = txn.transaction_type || txn.type;
                const Icon = typeIcons[actualType] || ArrowLeftRight;
                return (
                  <div key={txn.ledger_id || txn.id} className="txn-row-container">
                    <motion.div className="txn-row" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                      <div className="txn-icon" style={{ background: `${getTypeColor(actualType)}15`, color: getTypeColor(actualType) }}><Icon size={18} /></div>
                      <div className="txn-details">
                        <span className="txn-desc" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getTransactionDescription(txn)}
                          {isInternalTransfer(txn) && (
                            <span style={{ fontSize: '10px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--card-border)', color: 'var(--text-secondary)' }}>
                              ↔ Internal Transfer
                            </span>
                          )}
                        </span>
                        <span className="txn-ref">{txn.reference_number}</span>
                      </div>
                      <div className="txn-amount" style={{ color: getTransactionAmountStyling(txn).color }}>
                        {getTransactionAmountStyling(txn).prefix}{formatCurrency(Math.abs(txn.amount))}
                      </div>
                      <span className="txn-status" style={{ background: `${getStatusColor(txn.status)}15`, color: getStatusColor(txn.status) }}>{txn.status}</span>
                      <span className="txn-date">{formatDateTime(txn.created_at)}</span>
                      <div className="txn-actions">
                        {txn.is_flagged && (
                          <button 
                            className={`txn-flag-btn ${expandedFlagRow === txn.id ? 'active' : ''}`} 
                            onClick={() => setExpandedFlagRow(prev => prev === txn.id ? null : txn.id)}
                            title="Why was this flagged?"
                          >
                            <ShieldAlert size={16} />
                          </button>
                        )}
                        <button 
                          className="txn-receipt-btn" 
                          onClick={() => generateReceipt(txn)}
                          title="Download Receipt"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </motion.div>
                    <AnimatePresence>
                      {expandedFlagRow === txn.id && (
                        <FraudExplanation transactionId={txn.id} onClose={() => setExpandedFlagRow(null)} />
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="txn-pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span>Page {page} of {pagination.totalPages}</span>
            <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </motion.div>
    </>
  );
}
