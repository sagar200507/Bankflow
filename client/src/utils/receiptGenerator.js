import { jsPDF } from 'jspdf';
import { formatCurrency, formatDateTime, getTransactionAmountStyling, getTransactionDescription } from './formatters';

export const generateReceipt = (transaction, fromAccountDetails = null, toAccountDetails = null) => {
  const doc = new jsPDF();
  
  // Set fonts and colors
  doc.setFont('helvetica');
  
  // Header / Branding (Purple Gradient style fallback)
  doc.setFillColor(79, 70, 229); // var(--primary) equivalent
  doc.rect(0, 0, 210, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('BankFlow', 20, 28);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Transaction Receipt', 145, 28);
  
  // Content styling
  doc.setTextColor(30, 41, 59); // text-primary equivalent
  let y = 65;
  
  const addRow = (label, value) => {
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // text-secondary
    doc.text(label, 20, y);
    
    // Value (Right aligned)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    // Sanitize non-ASCII characters that jsPDF's built-in fonts don't support
    const valueStr = String(value || '-')
      .replace(/₹/g, 'INR ')
      .replace(/—/g, '-')
      .replace(/·/g, '-');
    doc.text(valueStr, 190, y, { align: 'right' });
    
    // Divider line
    doc.setDrawColor(226, 232, 240); // border color
    doc.line(20, y + 6, 190, y + 6);
    
    y += 16;
  };

  const amountStyle = getTransactionAmountStyling(transaction);
  const formattedAmount = `${amountStyle.prefix}${formatCurrency(Math.abs(transaction.amount))}`;

  // Helper to mask account ID if full details aren't provided
  const mask = (id) => id ? `XXXX XXXX ${id.slice(-4)}` : '-';
  
  // Build rows
  addRow('Reference Number', transaction.reference_number || transaction.id?.slice(0, 8));
  addRow('Date & Time', formatDateTime(transaction.created_at || new Date()));
  addRow('Transaction Type', (transaction.type || '').toUpperCase());
  addRow('Status', (transaction.status || 'COMPLETED').toUpperCase());
  
  if (transaction.from_account_id) {
    addRow('From Account', fromAccountDetails ? fromAccountDetails : mask(transaction.from_account_id));
  }
  if (transaction.to_account_id) {
    addRow('To Account', toAccountDetails ? toAccountDetails : mask(transaction.to_account_id));
  }
  
  addRow('Amount', formattedAmount);
  
  // We'll just print the newly enhanced description. 
  // getTransactionDescription gives us "Transfer to Savings Account" 
  // or falls back to standard description.
  addRow('Description', getTransactionDescription(transaction));
  
  // Footer
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // muted text
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer-generated receipt and does not require a physical signature.', 105, 275, { align: 'center' });
  doc.text(`Generated on ${formatDateTime(new Date())}`, 105, 282, { align: 'center' });
  
  // Save PDF
  const refNum = transaction.reference_number || transaction.id?.slice(0, 8) || 'Unknown';
  const filename = `BankFlow-Receipt-${refNum}.pdf`;
  doc.save(filename);
};
