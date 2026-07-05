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

export const getTransactionAmountStyling = (type) => {
  const isIncoming = type === 'deposit';
  return {
    prefix: isIncoming ? '+' : '-',
    color: isIncoming ? 'var(--accent-green)' : type === 'withdrawal' ? 'var(--danger)' : 'var(--text-primary)',
    cssClass: isIncoming ? 'transaction-row__amount--credit' : type === 'withdrawal' ? 'transaction-row__amount--debit' : 'transaction-row__amount--neutral'
  };
};

export const maskAccountNumber = (num) => {
  if (!num) return '—';
  const str = String(num);
  return `XXXX XXXX ${str.slice(-4)}`;
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-IN').format(Number(num) || 0);
};

export const formatPercentage = (num) => {
  return `${Number(num || 0).toFixed(2)}%`;
};