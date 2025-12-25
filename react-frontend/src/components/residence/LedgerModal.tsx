import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import residenceService from '../../services/residenceService';
import '../modals/Modal.css';
import './LedgerModal.css';

interface LedgerTransaction {
  transactionType: string;
  passenger_name: string;
  dt: string;
  visaType: string;
  debit: number;
  credit: number;
}

interface LedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerID: number;
  customerName: string;
  passengerName?: string;
  currencyID: number;
  currencyName: string;
}

export default function LedgerModal({
  isOpen,
  onClose,
  customerID,
  customerName,
  passengerName,
  currencyID,
  currencyName
}: LedgerModalProps) {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState(0);

  useEffect(() => {
    console.log('LedgerModal useEffect - isOpen:', isOpen, 'customerID:', customerID, 'currencyID:', currencyID);
    if (isOpen) {
      loadLedger();
    }
  }, [isOpen, customerID, currencyID, passengerName]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const data = await residenceService.getResidenceLedger(customerID, currencyID, passengerName || null);
      setTransactions(data);
      
      // Calculate totals
      let runningTotal = 0;
      let totalDebit = 0;
      let totalCredit = 0;
      
      data.forEach((transaction: LedgerTransaction) => {
        if (transaction.transactionType === 'Residence Payment' || transaction.transactionType === 'Residence Fine Payment') {
          runningTotal -= parseFloat(transaction.credit.toString());
          totalCredit += parseFloat(transaction.credit.toString());
        } else {
          runningTotal += parseFloat(transaction.debit.toString());
          totalDebit += parseFloat(transaction.debit.toString());
        }
      });
      
      setTotal(totalDebit);
      setTotalPaid(totalCredit);
      setOutstandingBalance(runningTotal);
    } catch (error: any) {
      console.error('Error loading ledger:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to load ledger', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = document.getElementById('ledger-print-area');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Residence Ledger - ${customerName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .payment { background-color: #d4edda; }
            .fine { background-color: #fff3cd; }
            .fine_payment { background-color: #cfe2ff; }
            .summary { margin-top: 20px; padding: 15px; background-color: #f8f9fa; border: 1px solid #dee2e6; }
            .summary-row { display: flex; justify-content: space-between; margin: 10px 0; }
            .summary-label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Residence Ledger</h2>
          <p><strong>Customer:</strong> ${customerName}</p>
          ${passengerName ? `<p><strong>Passenger:</strong> ${passengerName}</p>` : ''}
          <p><strong>Currency:</strong> ${currencyName}</p>
          ${printContent.innerHTML}
          <div class="summary">
            <div class="summary-row">
              <span class="summary-label">Total:</span>
              <span>${total.toLocaleString()} ${currencyName}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Total Paid:</span>
              <span>${totalPaid.toLocaleString()} ${currencyName}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Outstanding Balance:</span>
              <span>${outstandingBalance.toLocaleString()} ${currencyName}</span>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getTransactionClass = (type: string) => {
    if (type === 'Residence Payment') return 'payment';
    if (type === 'Residence Fine') return 'fine';
    if (type === 'Residence Fine Payment') return 'fine_payment';
    return '';
  };

  const calculateRunningBalance = (index: number) => {
    let balance = 0;
    for (let i = 0; i <= index; i++) {
      const transaction = transactions[i];
      if (transaction.transactionType === 'Residence Payment' || transaction.transactionType === 'Residence Fine Payment') {
        balance -= parseFloat(transaction.credit.toString());
      } else {
        balance += parseFloat(transaction.debit.toString());
      }
    }
    return balance;
  };

  console.log('LedgerModal render - isOpen:', isOpen);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="modal-container ledger-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95%' }}>
        <div className="modal-header">
          <h3><i className="fa fa-book me-2"></i>Residence Ledger</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {/* Customer Info */}
          <div className="mb-4 p-3" style={{ background: '#f8f9fa', borderRadius: '8px' }}>
            <div className="row">
              <div className="col-md-4">
                <strong>Customer:</strong> {customerName}
              </div>
              {passengerName && (
                <div className="col-md-4">
                  <strong>Passenger:</strong> {passengerName}
                </div>
              )}
              <div className="col-md-4">
                <strong>Currency:</strong> {currencyName}
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="row mb-4">
            <div className="col-md-4">
              <div className="card text-center" style={{ background: '#e3f2fd' }}>
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Total</h6>
                  <h4 className="card-title">{total.toLocaleString()} {currencyName}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card text-center" style={{ background: '#e8f5e9' }}>
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Total Paid</h6>
                  <h4 className="card-title text-success">{totalPaid.toLocaleString()} {currencyName}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card text-center" style={{ background: outstandingBalance > 0 ? '#fff3e0' : '#e8f5e9' }}>
                <div className="card-body">
                  <h6 className="card-subtitle mb-2 text-muted">Outstanding Balance</h6>
                  <h4 className={`card-title ${outstandingBalance > 0 ? 'text-warning' : 'text-success'}`}>
                    {outstandingBalance.toLocaleString()} {currencyName}
                  </h4>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          {loading ? (
            <div className="text-center py-5">
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p className="mt-2">Loading ledger...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="alert alert-info text-center">
              <i className="fa fa-info-circle me-2"></i>No transactions found
            </div>
          ) : (
            <div id="ledger-print-area">
              <div className="table-responsive">
                <table className="table table-bordered table-hover">
                  <thead className="table-dark">
                    <tr>
                      <th width="5%">#</th>
                      <th width="20%">Transaction Type</th>
                      <th width="15%">Passenger Name</th>
                      <th width="12%">Date</th>
                      <th width="15%">Visa Type</th>
                      <th width="12%" className="text-end">Debit</th>
                      <th width="12%" className="text-end">Credit</th>
                      <th width="13%" className="text-end">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((transaction, index) => {
                      const runningBalance = calculateRunningBalance(index);
                      const rowClass = getTransactionClass(transaction.transactionType);
                      
                      return (
                        <tr key={index} className={rowClass}>
                          <td>{index + 1}</td>
                          <td className="text-capitalize">{transaction.transactionType}</td>
                          <td className="text-capitalize">{transaction.passenger_name}</td>
                          <td>{transaction.dt}</td>
                          <td>{transaction.visaType}</td>
                          <td className="text-end">{parseFloat(transaction.debit.toString()).toLocaleString()}</td>
                          <td className="text-end">{parseFloat(transaction.credit.toString()).toLocaleString()}</td>
                          <td className="text-end fw-bold">
                            {runningBalance.toLocaleString()} {currencyName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            <i className="fa fa-times me-2"></i>Close
          </button>
          {transactions.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={handlePrint}>
              <i className="fa fa-print me-2"></i>Print Ledger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

