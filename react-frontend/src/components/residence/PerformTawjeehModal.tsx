import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import residenceService from '../../services/residenceService';
import '../modals/Modal.css';

interface PerformTawjeehModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { residenceID: number; cost: number; accountID: number; notes: string; uid?: string; labourCard?: string }) => Promise<void>;
  residence: Residence | null;
  accounts: Array<{ accountID: number; accountName: string }>;
}

export default function PerformTawjeehModal({ isOpen, onClose, onSubmit, residence, accounts }: PerformTawjeehModalProps) {
  const [uid, setUid] = useState('');
  const [labourCard, setLabourCard] = useState('');
  const [cost, setCost] = useState('150');
  const [accountID, setAccountID] = useState('');
  const [notes, setNotes] = useState('');
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && residence) {
      setUid(residence.uid || '');
      setLabourCard(residence.LabourCardNumber || '');
      setCost('150');
      setAccountID('');
      setNotes('');
      setIsFree(false);
    }
  }, [isOpen, residence]);

  const handleFreeToggle = () => {
    setIsFree(!isFree);
    if (!isFree) {
      setCost('0');
    } else {
      setCost('150');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residence) return;

    if (!cost || parseFloat(cost) < 0) {
      alert('Please enter a valid cost amount');
      return;
    }

    if (!accountID) {
      alert('Please select an account');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        residenceID: residence.residenceID,
        cost: parseFloat(cost),
        accountID: parseInt(accountID),
        notes,
        uid: uid || undefined,
        labourCard: labourCard || undefined
      });
      onClose();
    } catch (error) {
      console.error('Failed to perform Tawjeeh:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !residence) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-id-card"></i> Perform Tawjeeh Operation</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-3">Performing Tawjeeh for: <strong>{residence.passenger_name}</strong></p>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Passenger Name</label>
                <input type="text" className="form-control" value={residence.passenger_name} readOnly />
              </div>
              <div className="col-md-6">
                <label className="form-label">UID Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Enter UID number"
                />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Labour Card Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={labourCard}
                  onChange={(e) => setLabourCard(e.target.value)}
                  placeholder="Enter labour card number"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Cost (AED) <span className="text-danger">*</span></label>
                <div className="input-group">
                  <input
                    type="number"
                    className="form-control"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Enter cost amount"
                    step="0.01"
                    min="0"
                    required
                    disabled={isFree}
                  />
                  <button
                    className="btn btn-outline-success"
                    type="button"
                    onClick={handleFreeToggle}
                  >
                    <i className="fa fa-gift"></i> Free
                  </button>
                </div>
                <div className="form-check mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={isFree}
                    onChange={handleFreeToggle}
                  />
                  <label className="form-check-label text-success">
                    <i className="fa fa-gift me-1"></i>
                    This tawjeeh service is provided free of charge
                  </label>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Account <span className="text-danger">*</span></label>
              {!accounts || accounts.length === 0 ? (
                <div className="alert alert-warning mb-0">
                  <i className="fa fa-exclamation-triangle me-2"></i>
                  No accounts available. Please refresh the page or contact administrator.
                </div>
              ) : (
              <select
                className="form-control"
                value={accountID}
                onChange={(e) => setAccountID(e.target.value)}
                required
              >
                <option value="">Select Account</option>
                {accounts.map(acc => (
                  <option key={acc.accountID} value={acc.accountID}>{acc.accountName}</option>
                ))}
              </select>
              )}
            </div>

            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Enter any additional notes"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              <i className="fa fa-times"></i> Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Processing...
                </>
              ) : (
                <>
                  <i className="fa fa-check me-2"></i>
                  Perform Tawjeeh
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




