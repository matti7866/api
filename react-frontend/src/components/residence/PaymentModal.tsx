import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import residenceService from '../../services/residenceService';
import type { Residence } from '../../types/residence';
import '../modals/Modal.css';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  residence: Residence | null;
  accounts: Array<{ accountID: number; accountName: string }>;
  currencies?: Array<{ currencyID: number; currencyName: string }>;
  isFamilyResidence?: boolean;
}

interface UnifiedBreakdown {
  residence_outstanding: number;
  fine_outstanding: number;
  tawjeeh_outstanding: number;
  iloe_insurance_outstanding: number;
  iloe_fine_outstanding: number;
  cancellation_outstanding: number;
  custom_charges_outstanding: number;
  total_outstanding: number;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onSubmit,
  residence,
  accounts,
  isFamilyResidence = false
}: PaymentModalProps) {
  const [breakdown, setBreakdown] = useState<UnifiedBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    paymentAmount: '',
    accountID: '',
    remarks: 'Unified payment for all outstanding charges'
  });

  useEffect(() => {
    if (isOpen && residence) {
      loadBreakdown();
    }
  }, [isOpen, residence]);

  const loadBreakdown = async () => {
    if (!residence) return;

    setLoading(true);
    try {
      if (isFamilyResidence) {
        // For family residence, calculate outstanding directly
        const salePrice = parseFloat(residence.sale_price as any) || 0;
        const paidAmount = parseFloat((residence as any).paid_amount as any) || 0;
        const outstanding = salePrice - paidAmount;
        
        setBreakdown({
          residence_outstanding: outstanding,
          fine_outstanding: 0,
          tawjeeh_outstanding: 0,
          iloe_insurance_outstanding: 0,
          iloe_fine_outstanding: 0,
          cancellation_outstanding: 0,
          custom_charges_outstanding: 0,
          total_outstanding: outstanding
        });
        
        if (outstanding > 0) {
          setFormData(prev => ({
            ...prev,
            paymentAmount: outstanding.toFixed(2)
          }));
        }
      } else {
        const data = await residenceService.getUnifiedOutstanding(residence.residenceID);
        setBreakdown(data);
        
        // Set default payment amount to total outstanding
        if (data.total_outstanding > 0) {
          setFormData(prev => ({
            ...prev,
            paymentAmount: data.total_outstanding.toFixed(2)
          }));
        }
      }
    } catch (error) {
      console.error('Error loading breakdown:', error);
      Swal.fire('Error', 'Failed to load payment information', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!residence || !breakdown) return;

    const paymentAmount = parseFloat(formData.paymentAmount);

    // Validation
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      Swal.fire('Validation Error', 'Please enter a valid payment amount', 'error');
      return;
    }

    if (!formData.accountID) {
      Swal.fire('Validation Error', 'Please select a payment account', 'error');
      return;
    }

    if (paymentAmount > breakdown.total_outstanding) {
      Swal.fire('Validation Error', 'Payment amount cannot exceed total outstanding', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (isFamilyResidence) {
        await residenceService.processFamilyPayment({
          familyResidenceID: residence.residenceID,
          paymentAmount,
          accountID: parseInt(formData.accountID),
          remarks: formData.remarks
        });
        Swal.fire('Success!', 'Family residence payment processed successfully', 'success');
      } else {
        await residenceService.processUnifiedPayment({
          residenceID: residence.residenceID,
          paymentAmount,
          accountID: parseInt(formData.accountID),
          remarks: formData.remarks
        });
        Swal.fire('Success!', 'Unified payment processed successfully', 'success');
      }
      onClose();
      onSubmit({});
    } catch (error: any) {
      console.error('Error processing payment:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to process payment', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !residence) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
          {/* Header */}
          <div className="modal-header">
            <h3>
              <i className="fa fa-credit-card"></i> Pay Total Outstanding
            </h3>
            <button className="modal-close" onClick={onClose} aria-label="Close">
              <i className="fa fa-times"></i>
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* Info Alert */}
              <div className="alert alert-info d-flex align-items-start mb-3">
                <i className="fa fa-info-circle me-2 mt-1"></i>
                <div>
                  <strong>Unified Payment System</strong><br/>
                  <small>This payment will cover all outstanding charges for this residence in a single transaction.</small>
                </div>
              </div>

              {/* Passenger Name */}
              <div className="mb-3">
                <label className="form-label">Passenger Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={residence.passenger_name}
                  readOnly
                  style={{ background: '#f8f9fa' }}
                />
              </div>

              {/* Payment Breakdown */}
              <div className="card mb-3 border-0 shadow-sm">
                <div className="card-header text-white" style={{ background: '#343a40' }}>
                  <strong><i className="fa fa-list me-2"></i>Payment Breakdown</strong>
                </div>
                <div className="card-body p-0">
                  {loading ? (
                    <div className="text-center py-4">
                      <i className="fa fa-spinner fa-spin fa-2x text-primary"></i>
                      <p className="mt-2 text-muted">Loading breakdown...</p>
                    </div>
                  ) : breakdown ? (
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Charge Type</th>
                            <th className="text-end">Amount (AED)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {breakdown.residence_outstanding > 0 && (
                            <tr>
                              <td><i className="fa fa-home me-2 text-primary"></i>Residence Fee</td>
                              <td className="text-end">{breakdown.residence_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                          {breakdown.fine_outstanding > 0 && (
                            <tr>
                              <td><i className="fa fa-exclamation-triangle me-2 text-warning"></i>E-Visa Fine</td>
                              <td className="text-end">{breakdown.fine_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                          {breakdown.tawjeeh_outstanding > 0 && (
                            <tr>
                              <td><i className="fa fa-check-circle me-2 text-success"></i>TAWJEEH Service</td>
                              <td className="text-end">{breakdown.tawjeeh_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                          {breakdown.iloe_insurance_outstanding > 0 && (
                            <tr>
                              <td><i className="fa fa-shield-alt me-2 text-info"></i>ILOE Insurance</td>
                              <td className="text-end">{breakdown.iloe_insurance_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                          {breakdown.iloe_fine_outstanding > 0 && (
                            <tr>
                              <td><i className="fa fa-exclamation-circle me-2 text-danger"></i>ILOE Fine</td>
                              <td className="text-end">{breakdown.iloe_fine_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                          {breakdown.cancellation_outstanding > 0 && (
                            <tr>
                              <td><i className="fa fa-times-circle me-2 text-danger"></i>Cancellation Fee</td>
                              <td className="text-end">{breakdown.cancellation_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                          {breakdown.custom_charges_outstanding > 0 && (
                            <tr>
                              <td><i className="fa fa-plus-square me-2 text-warning"></i>Custom Charges</td>
                              <td className="text-end">{breakdown.custom_charges_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          )}
                          {breakdown.total_outstanding === 0 && (
                            <tr>
                              <td colSpan={2} className="text-center text-success py-3">
                                <i className="fa fa-check-circle me-2"></i>
                                No outstanding payments
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="table-light">
                          <tr>
                            <th>Total Outstanding</th>
                            <th className="text-end">
                              <strong>{breakdown.total_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} AED</strong>
                            </th>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted">
                      No breakdown available
                    </div>
                  )}
                </div>
              </div>

              {/* Total Outstanding Amount (Display Only) */}
              <div className="mb-3">
                <label className="form-label"><strong>Total Outstanding Amount (AED)</strong></label>
                <input
                  type="text"
                  className="form-control form-control-lg"
                  value={breakdown ? breakdown.total_outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                  readOnly
                  style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 'bold',
                    background: '#f8f9fa',
                    color: '#000'
                  }}
                />
              </div>

              <hr className="my-3" />

              {/* Note Alert */}
              <div className="alert alert-info d-flex align-items-start mb-3">
                <i className="fa fa-info-circle me-2 mt-1"></i>
                <div>
                  <strong>Note:</strong> This creates a single unified payment record that covers all outstanding charges for this residence. You can pay any amount up to the total outstanding.
                </div>
              </div>

              {/* Amount to Pay Now */}
              <div className="mb-3">
                <label className="form-label">
                  Amount to Pay Now (AED) <span className="text-danger">*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.paymentAmount}
                  onChange={(e) => setFormData({ ...formData, paymentAmount: e.target.value })}
                  placeholder="Enter amount to pay"
                  required
                  min="0.01"
                  step="0.01"
                  disabled={!breakdown || breakdown.total_outstanding === 0}
                />
                <small className="form-text text-muted">Enter the amount you want to pay now</small>
              </div>

              {/* Payment Account */}
              <div className="mb-3">
                <label className="form-label">
                  Payment Account <span className="text-danger">*</span>
                </label>
                {!accounts || accounts.length === 0 ? (
                  <div className="alert alert-warning">
                    <i className="fa fa-exclamation-triangle me-2"></i>
                    No accounts available. Please refresh the page or contact administrator.
                  </div>
                ) : (
                  <select
                    className="form-control"
                    value={formData.accountID}
                    onChange={(e) => setFormData({ ...formData, accountID: e.target.value })}
                    required
                    disabled={!breakdown || breakdown.total_outstanding === 0}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((account) => (
                      <option key={account.accountID} value={account.accountID}>
                        {account.accountName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Payment Remarks */}
              <div className="mb-3">
                <label className="form-label">Payment Remarks</label>
                <textarea
                  className="form-control"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  rows={3}
                  placeholder="Enter payment remarks (optional)"
                  disabled={!breakdown || breakdown.total_outstanding === 0}
                ></textarea>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
                disabled={loading}
              >
                <i className="fa fa-times me-1"></i> Close
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={loading || !breakdown || breakdown.total_outstanding === 0}
              >
                {loading ? (
                  <>
                    <i className="fa fa-spinner fa-spin me-1"></i> Processing...
                  </>
                ) : (
                  <>
                    <i className="fa fa-credit-card me-1"></i> Process Payment
                  </>
                )}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}




