import { useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../services/api';
import './AffiliateLedgerView.css';

interface AffiliateLedgerTransaction {
  TRANSACTION_Type: string;
  customer_name: string;
  Passenger_Name: string | null;
  datetime: string;
  date: string;
  Identification: string;
  Orgin: string;
  Destination: string;
  Debit: number;
  Credit: number;
}

interface CustomerInfo {
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
}

export default function AffiliateLedgerView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const customerId = Number(searchParams.get('id'));
  const currencyId = Number(searchParams.get('curID'));
  const affiliateId = Number(searchParams.get('affID'));
  const printAreaRef = useRef<HTMLDivElement>(null);
  
  // Fetch customer info
  const { data: customerInfo } = useQuery<CustomerInfo>({
    queryKey: ['affiliate-customer-info', customerId],
    queryFn: async () => {
      const response = await apiClient.post('/affiliate/affiliateLedgerView.php', {
        action: 'getCustomerInfo',
        customer_id: customerId
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Customer not found');
    },
    enabled: !!customerId
  });
  
  // Fetch currency name
  const { data: currencyData } = useQuery<{ currencyName: string }>({
    queryKey: ['affiliate-currency-name', currencyId],
    queryFn: async () => {
      const response = await apiClient.post('/affiliate/affiliateLedgerView.php', {
        action: 'getCurrencyName',
        currency_id: currencyId
      });
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      throw new Error(response.data.message || 'Currency not found');
    },
    enabled: !!currencyId
  });
  
  // Fetch ledger transactions
  const { data: transactions = [], isLoading } = useQuery<AffiliateLedgerTransaction[]>({
    queryKey: ['affiliate-ledger-view', customerId, currencyId, affiliateId],
    queryFn: async () => {
      const response = await apiClient.post('/affiliate/affiliateLedgerView.php', {
        action: 'getLedger',
        customer_id: customerId,
        currency_id: currencyId,
        affiliate_id: affiliateId
      });
      return response.data.success ? response.data.data : [];
    },
    enabled: !!customerId && !!currencyId && !!affiliateId
  });
  
  // Calculate totals and running balance
  const transactionsWithBalance = transactions.map((transaction, index) => {
    const debit = parseFloat(String(transaction.Debit)) || 0;
    const credit = parseFloat(String(transaction.Credit)) || 0;
    
    let runningBalance = 0;
    for (let i = 0; i <= index; i++) {
      const d = parseFloat(String(transactions[i].Debit)) || 0;
      const c = parseFloat(String(transactions[i].Credit)) || 0;
      runningBalance += d - c;
    }
    
    return {
      ...transaction,
      runningBalance
    };
  });
  
  // Calculate totals separated by customer and business
  const totals = transactions.reduce((acc, transaction) => {
    const debit = parseFloat(String(transaction.Debit)) || 0;
    const credit = parseFloat(String(transaction.Credit)) || 0;
    const isPayment = transaction.TRANSACTION_Type === 'Payment';
    const isRefund = transaction.TRANSACTION_Type === 'Refund';
    const isBusinessTransaction = transaction.customer_name === 'SN Trips';
    
    if (isBusinessTransaction) {
      // Business (Affiliate supplier) side
      if (isPayment && debit > 0) {
        acc.totalBusinessPaid += debit;
      } else if (isRefund && debit > 0) {
        acc.totalBusinessRefund += debit;
      } else if (!isPayment && credit > 0) {
        acc.totalBusinessCharges += credit;
      }
    } else {
      // Customer side
      if (isPayment && credit > 0) {
        acc.totalCustomerPaid += credit;
      } else if (isRefund && credit > 0) {
        acc.totalCustomerRefund += credit;
      } else if (debit > 0) {
        acc.totalCustomerCharges += debit;
      }
    }
    
    return acc;
  }, {
    totalCustomerCharges: 0,
    totalCustomerPaid: 0,
    totalCustomerRefund: 0,
    totalBusinessCharges: 0,
    totalBusinessPaid: 0,
    totalBusinessRefund: 0
  });
  
  const affiliateSubtotal = totals.totalCustomerCharges - totals.totalCustomerPaid - totals.totalCustomerRefund;
  const businessSubtotal = totals.totalBusinessCharges - totals.totalBusinessPaid - totals.totalBusinessRefund;
  const outstandingBalance = affiliateSubtotal - businessSubtotal;
  
  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };
  
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print');
      return;
    }
    
    const printContent = printAreaRef.current?.innerHTML || '';
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
        .company-info { flex: 1; }
        .logo-section {
          display: inline-flex;
          align-items: center;
          margin-bottom: 12px;
          background: #000;
          padding: 10px 15px;
          border-radius: 5px;
        }
        .company-logo {
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
        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          margin: 15px 0;
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
          padding-left: 33.33%;
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
        .text-capitalize { text-transform: capitalize; }
        .text-center { text-align: center; }
      </style>
    `;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Affiliate Business Ledger</title>
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
  
  const handleBackToAffiliate = () => {
    navigate('/ledger/affiliate');
  };
  
  if (!customerId || !currencyId || !affiliateId) {
    return (
      <div className="affiliate-ledger-view-page">
        <div className="panel">
          <div className="panel-body">
            <div className="alert alert-danger">
              Invalid customer, currency, or affiliate ID
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="affiliate-ledger-view-page">
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
    <div className="affiliate-ledger-view-page">
      <div className="print-actions">
        <button className="btn btn-secondary" onClick={handleBackToAffiliate}>
          <i className="fa fa-arrow-left me-2"></i>Back to Affiliate Ledger
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
            <h3 className="section-title">Affiliate Information</h3>
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
                <th>Customer</th>
                <th>Passenger</th>
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
                  <td colSpan={11} className="text-center">No transactions found</td>
                </tr>
              ) : (
                transactionsWithBalance.map((transaction, index) => {
                  const isPayment = transaction.TRANSACTION_Type === 'Payment';
                  const isBusinessRow = transaction.customer_name === 'SN Trips';
                  return (
                    <tr key={index} className={isPayment ? 'payment-row' : ''}>
                      <td className="text-center">{index + 1}</td>
                      <td className="text-capitalize">{transaction.TRANSACTION_Type}</td>
                      <td className="text-capitalize">{transaction.customer_name || ''}</td>
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
            <p className="total-label">Total Affiliate Charges:</p>
            <p className="total-value">{formatNumber(totals.totalCustomerCharges)} {currencyData?.currencyName || ''}</p>
          </div>
          <div className="total-row">
            <p className="total-label">Total Affiliate Paid:</p>
            <p className="total-value">{formatNumber(totals.totalCustomerPaid)} {currencyData?.currencyName || ''}</p>
          </div>
          <div className="total-row">
            <p className="total-label">Total Affiliate Refund:</p>
            <p className="total-value">{formatNumber(totals.totalCustomerRefund)} {currencyData?.currencyName || ''}</p>
          </div>
          <hr />
          <div className="total-row">
            <p className="total-label">Affiliate SubTotal:</p>
            <p className="total-value">{formatNumber(affiliateSubtotal)} {currencyData?.currencyName || ''}</p>
          </div>
          <hr />
          <div className="total-row">
            <p className="total-label">Total Business Charges:</p>
            <p className="total-value">{formatNumber(totals.totalBusinessCharges)} {currencyData?.currencyName || ''}</p>
          </div>
          <div className="total-row">
            <p className="total-label">Total Business Paid:</p>
            <p className="total-value">{formatNumber(totals.totalBusinessPaid)} {currencyData?.currencyName || ''}</p>
          </div>
          <div className="total-row">
            <p className="total-label">Total Business Refund:</p>
            <p className="total-value">{formatNumber(totals.totalBusinessRefund)} {currencyData?.currencyName || ''}</p>
          </div>
          <hr />
          <div className="total-row">
            <p className="total-label">Business SubTotal:</p>
            <p className="total-value">{formatNumber(businessSubtotal)} {currencyData?.currencyName || ''}</p>
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



