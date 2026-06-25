/**
 * Account Number Generator
 * ────────────────────────
 * Generates a 12-digit account number.
 * Format: YYYYXXXXXXXXX where YYYY = year-based prefix.
 *
 * In production, this would check for uniqueness against the DB.
 * For this implementation, the UNIQUE constraint on the
 * accounts.account_number column serves as the final guard —
 * collisions are astronomically unlikely with 8 random digits.
 */

/**
 * Generate a 12-digit account number.
 * @returns {string} A 12-digit string like "202600012345"
 */
const generateAccountNumber = () => {
  const year = new Date().getFullYear().toString();
  const random = Math.floor(10000000 + Math.random() * 90000000).toString();
  return year + random;
};

/**
 * Generate a transaction reference number.
 * Format: TXN-YYYYMMDD-XXXXXXXX
 * @returns {string} e.g., "TXN-20260624-83742951"
 */
const generateReferenceNumber = () => {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `TXN-${dateStr}-${random}`;
};

/**
 * Format currency for display.
 * @param {number} amount - The numeric amount
 * @param {string} currency - ISO currency code (default: INR)
 * @returns {string} Formatted string like "₹1,24,500.00"
 */
const formatCurrency = (amount, currency = 'INR') => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

module.exports = {
  generateAccountNumber,
  generateReferenceNumber,
  formatCurrency,
};
