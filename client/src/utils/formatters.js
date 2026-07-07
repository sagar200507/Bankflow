export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(num);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
};

export const formatAccountNumber = (num) => {
  if (!num) return '—';
  const str = String(num);
  return `XXXX XXXX ${str.slice(-4)}`;
};

export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateStr);
};

export const getStatusColor = (status) => {
  const map = { completed: 'var(--accent-green)', pending: 'var(--accent-amber)', failed: 'var(--danger)', reversed: 'var(--accent-purple)' };
  return map[status] || 'var(--text-muted)';
};

export const getTypeColor = (type) => {
  const map = { deposit: 'var(--accent-green)', withdrawal: 'var(--danger)', transfer: 'var(--accent-blue)' };
  return map[type] || 'var(--text-muted)';
};

export const getTransactionAmountStyling = (txn) => {
  const isIncoming = txn.entry_type === 'CREDIT';
  const isOutgoing = txn.entry_type === 'DEBIT';

  return {
    prefix: isIncoming ? '+' : isOutgoing ? '-' : '',
    color: isIncoming ? 'var(--accent-green)' : isOutgoing ? 'var(--danger)' : 'var(--text-primary)',
    cssClass: isIncoming ? 'transaction-row__amount--credit' : isOutgoing ? 'transaction-row__amount--debit' : 'transaction-row__amount--neutral'
  };
};


export const isInternalTransfer = (txn) => {
  const actualType = txn.transaction_type || txn.type;
  return actualType === 'transfer' && txn.from_user_id === txn.to_user_id;
};

const formatAccountName = (type, number) => {
  const masked = number ? `(••${String(number).slice(-4)})` : '';
  if (type) {
    const capitalized = type.charAt(0).toUpperCase() + type.slice(1);
    return `${capitalized} ${masked}`.trim();
  }
  return `Account ${masked}`.trim();
};

export const getTransactionDescription = (txn) => {
  const actualType = txn.transaction_type || txn.type;
  
  if (actualType === 'transfer') {
    if (txn.entry_type === 'DEBIT') {
      return `Transfer to ${formatAccountName(txn.to_account_type, txn.to_account_number)}`;
    } else if (txn.entry_type === 'CREDIT') {
      return `Transfer from ${formatAccountName(txn.from_account_type, txn.from_account_number)}`;
    }
  }
  
  // Fallback to description from DB (or legacy logic)
  return txn.description || actualType;
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN').format(Number(num) || 0);
};

export const formatPercentage = (num) => {
  return `${Number(num || 0).toFixed(2)}%`;
};