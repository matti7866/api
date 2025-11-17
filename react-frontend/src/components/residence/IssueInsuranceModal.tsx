import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import '../modals/Modal.css';

interface IssueInsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { residenceID: number; cost: number; accountID: number; notes: string; uid?: string; labourCard?: string; passport?: string; attachment?: File }) => Promise<void>;
  residence: Residence | null;
  accounts: Array<{ accountID: number; accountName: string }>;
}

export default function IssueInsuranceModal({ isOpen, onClose, onSubmit, residence, accounts }: IssueInsuranceModalProps) {
  const [uid, setUid] = useState('');
  const [labourCard, setLabourCard] = useState('');
  const [passport, setPassport] = useState('');
  const [cost, setCost] = useState('126');
  const [accountID, setAccountID] = useState('');
  const [notes, setNotes] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && residence) {
      setUid(residence.uid || '');
      setLabourCard(residence.LabourCardNumber || '');
      setPassport(residence.passportNumber || '');
      setCost('126');
      setAccountID('');
      setNotes('');
      setAttachment(null);
    }
  }, [isOpen, residence]);

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
        labourCard: labourCard || undefined,
        passport: passport || undefined,
        attachment: attachment || undefined
      });
      onClose();
    } catch (error) {
      console.error('Failed to issue insurance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !residence) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-shield"></i> Issue Insurance (ILOE)</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-3">Issuing insurance for: <strong>{residence.passenger_name}</strong></p>

            <div className="row mb-3">
              <div className="col-md-4">
                <label className="form-label">Passenger Name</label>
                <input type="text" className="form-control" value={residence.passenger_name} readOnly />
              </div>
              <div className="col-md-4">
                <label className="form-label">UID Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  placeholder="Enter UID number"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Labour Card Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={labourCard}
                  onChange={(e) => setLabourCard(e.target.value)}
                  placeholder="Enter labour card number"
                />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Passport Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={passport}
                  onChange={(e) => setPassport(e.target.value)}
                  placeholder="Enter passport number"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Cost (AED) <span className="text-danger">*</span></label>
                <input
                  type="number"
                  className="form-control"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="Enter insurance cost"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
            </div>

            <div className="row mb-3">
              <div className="col-md-6">
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
              <div className="col-md-6">
                <label className="form-label">Insurance Document (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                />
                <small className="form-text text-muted">Upload insurance certificate or related document</small>
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Enter any additional notes about the insurance"
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
                  <i className="fa fa-shield me-2"></i>
                  Issue Insurance
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




