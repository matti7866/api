import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { customerLedgerService } from '../../services/customerLedgerService';
import type { CustomerLedgerTransaction, CustomerInfo } from '../../types/customerLedger';
import './CustomerLedgerView.css';

export default function CustomerLedgerView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerId = Number(searchParams.get('id'));
  const currencyId = Number(searchParams.get('curID'));
  const printAreaRef = useRef<HTMLDivElement>(null);
  
  // Fetch customer info
  const { data: customerInfo } = useQuery<CustomerInfo>({
    queryKey: ['customer-info', customerId],
    queryFn: () => customerLedgerService.getCustomerInfo(customerId),
    enabled: !!customerId
  });
  
  // Fetch currency name
  const { data: currencyData } = useQuery<{ currencyName: string }>({
    queryKey: ['currency-name', currencyId],
    queryFn: () => customerLedgerService.getCurrencyName(currencyId),
    enabled: !!currencyId
  });
  
  // Fetch ledger transactions
  const { data: transactions = [], isLoading } = useQuery<CustomerLedgerTransaction[]>({
    queryKey: ['customer-ledger', customerId, currencyId],
    queryFn: () => customerLedgerService.getLedger(customerId, currencyId),
    enabled: !!customerId && !!currencyId
  });
  
  // Calculate running balance for each row
  const [transactionsWithBalance, setTransactionsWithBalance] = useState<Array<CustomerLedgerTransaction & { runningBalance: number }>>([]);
  
  useEffect(() => {
    let runningBalance = 0;
    const transactionsWithBal = transactions.map((transaction) => {
      runningBalance += parseFloat(String(transaction.Debit)) || 0;
      runningBalance -= parseFloat(String(transaction.Credit)) || 0;
      return { ...transaction, runningBalance };
    });
    setTransactionsWithBalance(transactionsWithBal);
  }, [transactions]);
  
  // Calculate totals
  const totals = transactions.reduce((acc, transaction) => {
    acc.totalCharges += parseFloat(String(transaction.Debit)) || 0;
    acc.totalPaid += parseFloat(String(transaction.Credit)) || 0;
    
    // Track refunds separately
    if (transaction.TRANSACTION_Type === 'Refund') {
      acc.totalRefund += parseFloat(String(transaction.Credit)) || 0;
    }
    
    return acc;
  }, { totalCharges: 0, totalPaid: 0, totalRefund: 0 });
  
  const outstandingBalance = totals.totalCharges - totals.totalPaid;
  
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };
  
  const handlePrint = () => {
    if (!printAreaRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }
    
    const printContent = printAreaRef.current.innerHTML;
    const printStyles = `
      <style>
        @page {
          size: A4;
          margin: 12mm;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 15px;
          font-size: 11px;
        }
        .ledger-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        .company-info {
          flex: 1;
        }
        .logo-section {
          display: inline-flex;
          align-items: center;
          margin-bottom: 12px;
          background: #000;
          padding: 10px 15px;
          border-radius: 5px;
        }
        .company-logo {
          height: auto;
          width: auto;
          max-height: 80px;
          max-width: 140px;
          object-fit: contain;
          display: block;
        }
        .company-details p {
          font-size: 10px;
          margin-bottom: 3px;
          line-height: 1.4;
        }
        .company-title {
          font-size: 13px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .customer-info-box {
          width: 280px;
          margin-left: 18px;
        }
        .section-title {
          font-size: 11px;
          color: #dc2626;
          font-weight: bold;
          margin-left: 20px;
          margin-top: 12px;
          margin-bottom: 4px;
        }
        .divider {
          border: none;
          width: 200px;
          border-bottom: 1px solid black;
          margin-left: 20px;
          margin-bottom: 6px;
        }
        .customer-info-box p {
          font-size: 10px;
          margin-bottom: 3px;
          margin-left: 20px;
          line-height: 1.5;
        }
        .date-text {
          font-size: 10px;
          margin-left: 20px;
          font-weight: bold;
        }
        .table-container {
          margin: 15px 0;
        }
        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .ledger-table thead {
          background: #dc2626;
          color: #fff;
        }
        .ledger-table th {
          padding: 6px 5px;
          text-align: center;
          border: 1px solid #ddd;
          font-size: 10px;
          font-weight: 600;
        }
        .ledger-table tbody td {
          padding: 5px 4px;
          border: 1px solid #ddd;
          font-size: 10px;
        }
        .ledger-table tbody tr:nth-of-type(odd) {
          background-color: rgba(0, 0, 0, 0.05);
        }
        .ledger-table tbody tr.payment-row td {
          background-color: #6b7280;
          color: white;
        }
        .totals-section {
          margin-top: 15px;
          padding-left: 50%;
          background: #fff;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          padding: 3px 0;
        }
        .total-label {
          font-weight: bold;
          font-size: 11px;
          color: #000;
        }
        .total-value {
          font-size: 11px;
          color: #000;
          font-weight: 600;
        }
        .total-row.outstanding {
          margin-top: 6px;
          padding-top: 6px;
        }
        .total-row.outstanding .total-label,
        .total-row.outstanding .total-value {
          font-size: 13px;
          font-weight: 700;
        }
        .totals-section hr {
          border: none;
          border-top: 1px solid #000;
          margin: 4px 0;
        }
        .text-capitalize {
          text-transform: capitalize;
        }
        .text-center {
          text-align: center;
        }
      </style>
    `;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Customer Ledger</title>
          ${printStyles}
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };
  
  const handleBackToCustomer = () => {
    navigate('/ledger/customer');
  };
  
  if (!customerId || !currencyId) {
    return (
      <div className="customer-ledger-view-page">
        <div className="panel">
          <div className="panel-body">
            <div className="alert alert-danger">
              Invalid customer or currency ID
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="customer-ledger-view-page">
        <div className="panel">
          <div className="panel-body text-center">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  
  return (
    <div className="customer-ledger-view-page">
      <div className="print-actions">
        <button className="btn btn-secondary" onClick={handleBackToCustomer}>
          <i className="fa fa-arrow-left me-2"></i>Back to Customer Ledger
        </button>
        <button className="btn btn-danger" onClick={handlePrint}>
          <i className="fa fa-print me-2"></i>Print Ledger
        </button>
      </div>
      
      <div className="print-area" ref={printAreaRef}>
        <div className="ledger-header">
          <div className="company-info">
            <div className="logo-section">
              <img src="/assets/logo-white.png" alt="Company Logo" className="company-logo" />
            </div>
            <div className="company-details">
              <p className="company-title"><b>Selab Nadiry Travel & Tourism</b></p>
              <p>Address: Frij Murar Shop# 15, Deira, Dubai</p>
              <p>Contact: +971 4 298 4564, +971 58 514 0764</p>
            </div>
          </div>
          
          <div className="customer-info-box">
            <h3 className="section-title">Customer Information</h3>
            <hr className="divider" />
            <p>Name: <span className="text-capitalize">{customerInfo?.customer_name || 'N/A'}</span></p>
            <p>Email: <span>{customerInfo?.customer_email || 'Nill'}</span></p>
            <p>Phone: <span>{customerInfo?.customer_phone || 'Nill'}</span></p>
            <p>Currency: <span>{currencyData?.currencyName || 'N/A'}</span></p>
            
            <h3 className="section-title">Date</h3>
            <hr className="divider" />
            <h3 className="date-text">{currentDate}</h3>
          </div>
        </div>
        
        <div className="table-container">
          <table className="ledger-table table-striped table-hover table-bordered">
            <thead>
              <tr>
                <th>S#</th>
                <th>Transaction Type</th>
                <th>Passenger Name</th>
                <th>Date</th>
                <th>Identification</th>
                <th>Origin</th>
                <th>Destination</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactionsWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center">No transactions found</td>
                </tr>
              ) : (
                transactionsWithBalance.map((transaction, index) => {
                  const isPayment = transaction.TRANSACTION_Type === 'Payment';
                  return (
                    <tr key={index} className={isPayment ? 'payment-row' : ''}>
                      <td className="text-center">{index + 1}</td>
                      <td className="text-capitalize">{transaction.TRANSACTION_Type}</td>
                      <td className="text-capitalize">
                        {transaction.Passenger_Name || ''}
                      </td>
                      <td className="text-center">{transaction.date || ''}</td>
                      <td>{transaction.Identification || ''}</td>
                      <td className="text-center">{transaction.Orgin || ''}</td>
                      <td className="text-center">{transaction.Destination || ''}</td>
                      <td className="text-center">{formatNumber(transaction.Debit || 0)}</td>
                      <td className="text-center">{formatNumber(transaction.Credit || 0)}</td>
                      <td className="text-center">{formatNumber(transaction.runningBalance || 0)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        <div className="totals-section">
          <div className="total-row">
            <p className="total-label">Total Charges:</p>
            <p className="total-value">{formatNumber(totals.totalCharges)} {currencyData?.currencyName || ''}</p>
          </div>
          <hr />
          <div className="total-row">
            <p className="total-label">Total Paid:</p>
            <p className="total-value">{formatNumber(totals.totalPaid)} {currencyData?.currencyName || ''}</p>
          </div>
          <div className="total-row">
            <p className="total-label">Total Refund:</p>
            <p className="total-value">{formatNumber(totals.totalRefund)} {currencyData?.currencyName || ''}</p>
          </div>
          <hr />
          <div className="total-row outstanding">
            <p className="total-label"><b>Outstanding Balance:</b></p>
            <p className="total-value"><b>{formatNumber(outstandingBalance)} {currencyData?.currencyName || ''}</b></p>
          </div>
          <hr />
        </div>
      </div>
    </div>
  );
}

