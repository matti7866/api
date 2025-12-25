import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import supplierService from '../../services/supplierService';
import type { SupplierLedgerTransaction, SupplierInfo } from '../../types/supplier';
import './SupplierLedger.css';

export default function SupplierLedger() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const supplierId = Number(searchParams.get('id'));
  const currencyId = Number(searchParams.get('curID'));
  const printAreaRef = useRef<HTMLDivElement>(null);
  
  // Fetch supplier info
  const { data: supplierInfo } = useQuery<SupplierInfo>({
    queryKey: ['supplier-info', supplierId],
    queryFn: () => supplierService.getSupplierInfo(supplierId),
    enabled: !!supplierId
  });
  
  // Fetch currency name
  const { data: currencyData } = useQuery<{ currencyName: string }>({
    queryKey: ['currency-name', currencyId],
    queryFn: () => supplierService.getCurrencyName(currencyId),
    enabled: !!currencyId
  });
  
  // Fetch ledger transactions
  const { data: transactions = [], isLoading } = useQuery<SupplierLedgerTransaction[]>({
    queryKey: ['supplier-ledger', supplierId, currencyId],
    queryFn: () => supplierService.getLedger(supplierId, currencyId),
    enabled: !!supplierId && !!currencyId
  });
  
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
  
  // Calculate running balance for each row
  const transactionsWithBalance = transactions.map((transaction, index) => {
    let runningBalance = 0;
    for (let i = 0; i <= index; i++) {
      runningBalance += parseFloat(String(transactions[i].Debit)) || 0;
      runningBalance -= parseFloat(String(transactions[i].Credit)) || 0;
    }
    return { ...transaction, runningBalance };
  });
  
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
          margin: 15mm;
        }
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
        }
        .ledger-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        .company-info {
          flex: 1;
        }
        .logo-section {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          margin-bottom: 20px;
          background: #000;
          padding: 15px 20px;
          border-radius: 8px;
        }
        .company-logo {
          height: auto;
          width: auto;
          max-height: 150px;
          max-width: 200px;
          margin-right: 0;
          object-fit: contain;
          display: block;
        }
        .company-details p {
          margin-bottom: 0;
          font-size: 15px;
        }
        .company-title {
          font-size: 20px;
          margin-top: 3px;
          margin-bottom: 0;
        }
        .supplier-info-box {
          width: 350px;
          margin-left: 20px;
        }
        .section-title {
          font-size: 18px;
          color: #dc2626;
          font-weight: bold;
          margin-left: 47px;
          margin-top: 20px;
        }
        .divider {
          border: none;
          width: 230px;
          border-bottom: 2px solid black;
          margin-left: 47px;
        }
        .supplier-info-box p {
          font-size: 15px;
          margin-bottom: 0;
          margin-left: 47px;
        }
        .date-text {
          font-size: 15px;
          margin-left: 47px;
        }
        .table-container {
          margin: 30px 0;
        }
        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .ledger-table thead {
          background: #dc2626;
          color: #fff;
        }
        .ledger-table th {
          padding: 12px 8px;
          text-align: left;
          border: 1px solid #ddd;
        }
        .ledger-table tbody td {
          padding: 10px 8px;
          border: 1px solid #ddd;
        }
        .ledger-table tbody tr:nth-of-type(odd) {
          background-color: rgba(0, 0, 0, 0.05);
        }
        .ledger-table tbody tr.payment-row td {
          background-color: #6b7280;
          color: white;
        }
        .totals-section {
          margin-top: 30px;
          padding-left: 33.33%;
          background: #fff;
          color: #000;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          background: #fff;
          padding: 5px 0;
        }
        .total-label {
          font-weight: bold;
          font-size: 20px;
          margin: 0;
          color: #000;
          background: #fff;
        }
        .total-value {
          font-size: 20px;
          margin: 0;
          color: #000;
          background: #fff;
          text-align: right;
        }
        .total-row.outstanding {
          background: #fff !important;
        }
        .total-row.outstanding .total-label,
        .total-row.outstanding .total-value {
          font-size: 30px;
          color: #000 !important;
          background: #fff !important;
        }
        .totals-section hr {
          border: none;
          border-top: 2px solid #000;
          margin: 10px 0;
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
          <title>Supplier Ledger</title>
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
  
  const handleBackToSupplier = () => {
    navigate('/supplier');
  };
  
  if (!supplierId || !currencyId) {
    return (
      <div className="supplier-ledger-page">
        <div className="panel">
          <div className="panel-body">
            <div className="alert alert-danger">
              <i className="fa fa-exclamation-circle me-2"></i>
              Invalid parameters. Supplier ID and Currency ID are required.
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="supplier-ledger-page">
      <div className="no-print">
        <div className="print-actions">
          <button className="btn btn-secondary" onClick={handleBackToSupplier}>
            <i className="fa fa-arrow-left me-2"></i>
            Back to Supplier
          </button>
          <button className="btn btn-danger" onClick={handlePrint}>
            <i className="fa fa-print me-2"></i>
            Print Ledger
          </button>
        </div>
      </div>
      
      <div ref={printAreaRef} className="print-area">
        {/* Header */}
        <div className="ledger-header">
          <div className="company-info">
            <div className="logo-section">
              <img src="/assets/logo-white.png" alt="Logo" className="company-logo" />
            </div>
            <div className="company-details">
              <p className="company-title"><strong>Selab Nadiry Travel & Tourism</strong></p>
              <p>Frij Murar Shop# 15, Deira, Dubai</p>
              <p>Contact: +971 4 298 4564, +971 58 514 0764</p>
            </div>
          </div>
          
          <div className="supplier-info-box">
            <h3 className="section-title">Supplier Information</h3>
            <hr className="divider" />
            <p>Name: <span className="text-capitalize">{supplierInfo?.supp_name || '-'}</span></p>
            <p>Email: <span>{supplierInfo?.supp_email || 'Nill'}</span></p>
            <p>Phone: <span>{supplierInfo?.supp_phone || 'Nill'}</span></p>
            
            <h3 className="section-title mt-4">Date</h3>
            <hr className="divider" />
            <h3 className="date-text">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</h3>
          </div>
        </div>
        
        {/* Ledger Table */}
        <div className="table-container">
          {isLoading ? (
            <div className="text-center p-4">
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p className="mt-2">Loading...</p>
            </div>
          ) : (
            <table className="ledger-table">
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
                  transactionsWithBalance.map((transaction, index) => (
                    <tr key={index} className={transaction.TRANSACTION_Type === 'Payment' ? 'payment-row' : ''}>
                      <td>{index + 1}</td>
                      <td className="text-capitalize">{transaction.TRANSACTION_Type}</td>
                      <td className="text-capitalize">
                        {transaction.TRANSACTION_Type === 'Payment' 
                          ? transaction.remarks 
                          : transaction.passenger_name || '-'}
                      </td>
                      <td>{transaction.date}</td>
                      <td>
                        {transaction.TRANSACTION_Type === 'Payment' 
                          ? `Payment Details: ${transaction.remarks}`
                          : transaction.Identification || '-'}
                      </td>
                      <td>{transaction.Orgin || '-'}</td>
                      <td>{transaction.Destination || '-'}</td>
                      <td>{parseFloat(String(transaction.Debit)).toLocaleString()}</td>
                      <td>{parseFloat(String(transaction.Credit)).toLocaleString()}</td>
                      <td>{transaction.runningBalance.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Totals */}
        <div className="totals-section">
          <div className="total-row">
            <p className="total-label">Total Charges:</p>
            <p className="total-value">{totals.totalCharges.toLocaleString()} {currencyData?.currencyName || ''}</p>
          </div>
          <hr />
          <div className="total-row">
            <p className="total-label">Total Paid:</p>
            <p className="total-value">{totals.totalPaid.toLocaleString()} {currencyData?.currencyName || ''}</p>
          </div>
          <div className="total-row">
            <p className="total-label">Total Refund:</p>
            <p className="total-value">{totals.totalRefund.toLocaleString()} {currencyData?.currencyName || ''}</p>
          </div>
          <hr />
          <div className="total-row outstanding">
            <p className="total-label"><strong>Outstanding Balance:</strong></p>
            <p className="total-value"><strong>{outstandingBalance.toLocaleString()} {currencyData?.currencyName || ''}</strong></p>
          </div>
          <hr />
        </div>
      </div>
    </div>
  );
}


