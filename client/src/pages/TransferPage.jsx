import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowRight, CheckCircle, AlertCircle, Download } from 'lucide-react';
import { accountsAPI, transactionsAPI } from '../services/api';
import { formatCurrency, formatAccountNumber } from '../utils/formatters';
import { generateReceipt } from '../utils/receiptGenerator';
import toast, { Toaster } from 'react-hot-toast';
import './TransferPage.css';

export default function TransferPage() {
  const [accounts, setAccounts] = useState([]);
  const [step, setStep] = useState('form'); // 'form' | 'confirm' | 'success'
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ fromAccountId: '', toAccountId: '', amount: '', description: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    accountsAPI.getAll().then(({ data }) => {
      const accs = data.data.accounts || [];
      setAccounts(accs);
      if (accs.length > 0) setForm((f) => ({ ...f, fromAccountId: accs[0].id }));
    }).catch(() => toast.error('Failed to load accounts'));
  }, []);

  const selectedFrom = accounts.find((a) => a.id === form.fromAccountId);

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!form.fromAccountId || !form.toAccountId || !form.amount) { toast.error('Please fill all fields'); return; }
    if (parseFloat(form.amount) <= 0) { toast.error('Amount must be positive'); return; }
    if (form.fromAccountId === form.toAccountId) { toast.error('Cannot transfer to the same account'); return; }
    setStep('confirm');
  };

  const handleTransfer = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await transactionsAPI.transfer({
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        amount: parseFloat(form.amount),
        description: form.description,
      });
      setResult(data.data);
      setStep('success');
      toast.success('Transfer successful!');
    } catch (err) {
      let errorMsg = err.response?.data?.message || 'Transfer failed. Please check the destination account and try again.';
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        errorMsg = err.response.data.errors.map(e => e.message).join(' | ');
      }
      toast.error(errorMsg);
      setError(errorMsg);
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ fromAccountId: accounts[0]?.id || '', toAccountId: '', amount: '', description: '' });
    setResult(null);
    setError(null);
    setStep('form');
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' } }} />
      <motion.div className="transfer-page" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="transfer-container">
          <div className="transfer-steps">
            {['Details', 'Confirm', 'Complete'].map((s, i) => (
              <div key={s} className={`step ${i === ['form','confirm','success'].indexOf(step) ? 'active' : i < ['form','confirm','success'].indexOf(step) ? 'done' : ''}`}>
                <div className="step-circle">{i < ['form','confirm','success'].indexOf(step) ? '✓' : i + 1}</div>
                <span>{s}</span>
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.form key="form" className="transfer-card" onSubmit={handleConfirm} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="transfer-card-header"><Send size={24} /><h2>Transfer Details</h2></div>
                {error && (
                  <div className="form-error-banner" style={{ background: 'var(--danger-light, rgba(239, 68, 68, 0.1))', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}
                <label className="form-label">From Account</label>
                <select className="form-input" value={form.fromAccountId} onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })} required>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_type} · {formatAccountNumber(a.account_number)} · {formatCurrency(a.balance)}</option>)}
                </select>
                <label className="form-label">To Account ID</label>
                <input className="form-input" placeholder="Enter recipient account UUID" value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })} required />
                <label className="form-label">Amount (₹)</label>
                <div className="amount-input-wrapper">
                  <span className="amount-prefix">₹</span>
                  <input className="form-input amount-input" type="number" step="0.01" min="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                </div>
                <label className="form-label">Description (optional)</label>
                <textarea className="form-input form-textarea" placeholder="What's this transfer for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
                <button type="submit" className="auth-submit"><span>Review Transfer</span><ArrowRight size={18} /></button>
              </motion.form>
            )}

            {step === 'confirm' && (
              <motion.div key="confirm" className="transfer-card" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="transfer-card-header"><AlertCircle size={24} style={{ color: 'var(--accent-amber)' }} /><h2>Confirm Transfer</h2></div>
                <div className="confirm-summary">
                  <div className="confirm-row"><span>From</span><span>{selectedFrom?.account_type} · {formatAccountNumber(selectedFrom?.account_number)}</span></div>
                  <div className="confirm-row"><span>To</span><span className="mono">{form.toAccountId.slice(0, 8)}...{form.toAccountId.slice(-4)}</span></div>
                  <div className="confirm-row highlight"><span>Amount</span><span>{formatCurrency(parseFloat(form.amount))}</span></div>
                  {form.description && <div className="confirm-row"><span>Note</span><span>{form.description}</span></div>}
                  <div className="confirm-row"><span>Available</span><span>{formatCurrency(selectedFrom?.balance)}</span></div>
                </div>
                <div className="confirm-actions">
                  <button className="btn-secondary" onClick={() => setStep('form')}>Back</button>
                  <button className="auth-submit" style={{ flex: 1 }} onClick={handleTransfer} disabled={loading}>
                    {loading ? <span className="spinner" /> : <><span>Confirm & Send</span><Send size={18} /></>}
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" className="transfer-card success-card" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <motion.div className="success-icon" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}>
                  <CheckCircle size={64} />
                </motion.div>
                <h2>Transfer Complete!</h2>
                <p className="success-amount">{formatCurrency(parseFloat(form.amount))}</p>
                {result?.transaction?.reference_number && <p className="success-ref">Ref: {result.transaction.reference_number}</p>}
                
                <div className="success-actions" style={{ display: 'flex', gap: '12px', marginTop: '24px', width: '100%' }}>
                  <button className="btn-secondary" onClick={() => generateReceipt(result.transaction, `${selectedFrom?.account_type} · ${formatAccountNumber(selectedFrom?.account_number)}`, form.toAccountId)} style={{ flex: 1 }}>
                    <Download size={18} />
                    <span>Receipt</span>
                  </button>
                  <button className="auth-submit" onClick={resetForm} style={{ flex: 1 }}>
                    <span>New Transfer</span><ArrowRight size={18} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
