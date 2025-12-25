import { useState, useEffect } from 'react';
import type { Residence, PaymentHistory } from '../../types/residence';
import '../modals/Modal.css';

interface PaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  residence: Residence | null;
  onLoadHistory: (residenceID: number) => Promise<PaymentHistory[]>;
}

export default function PaymentHistoryModal({ isOpen, onClose, residence, onLoadHistory }: PaymentHistoryModalProps) {
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && residence) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, residence]);

  const loadHistory = async () => {
    if (!residence) return;
    
    setLoading(true);
    try {
      const data = await onLoadHistory(residence.residenceID);
      console.log('Payment history loaded:', data); // Debug log
      setHistory(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to load payment history:', error);
      console.error('Error details:', error.response?.data);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !residence) return null;

  // Ensure history is always an array
  const historyArray = Array.isArray(history) ? history : [];
  const totalPaid = historyArray.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-history"></i> Payment History</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted">Loading payment history...</p>
            </div>
          ) : history.length > 0 ? (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Type</th>
                    <th>Account</th>
                    <th>Staff</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {historyArray.map((payment, index) => (
                    <tr key={payment.payment_id || index}>
                      <td style={{ fontWeight: '600', color: '#6b7280' }}>{index + 1}</td>
                      <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: '600', color: '#10b981' }}>{payment.amount.toLocaleString()}</td>
                      <td>{payment.currency_name}</td>
                      <td>
                        <span className={`badge bg-${
                          payment.payment_type === 'residence' ? 'primary' :
                          payment.payment_type === 'tawjeeh' ? 'warning' :
                          payment.payment_type === 'insurance' ? 'info' :
                          payment.payment_type === 'insurance_fine' ? 'danger' : 'secondary'
                        }`}>
                          {payment.payment_type ? payment.payment_type.replace('_', ' ').toUpperCase() : 'RESIDENCE'}
                        </span>
                      </td>
                      <td>{payment.account_name}</td>
                      <td>{payment.staff_name}</td>
                      <td style={{ fontSize: '0.875rem', color: '#6b7280' }}>{payment.remarks || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={2} style={{ textAlign: 'right' }}>Total Paid:</th>
                    <th style={{ color: '#10b981', fontSize: '1.125rem' }}>{totalPaid.toLocaleString()} AED</th>
                    <th colSpan={5}></th>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <i className="fa fa-inbox fa-3x text-muted mb-3"></i>
              <p className="text-muted">No payment history found</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            <i className="fa fa-times"></i> Close
          </button>
        </div>
      </div>
    </div>
  );
}

