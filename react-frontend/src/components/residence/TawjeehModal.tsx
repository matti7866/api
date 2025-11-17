import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import '../modals/Modal.css';

interface TawjeehModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (residenceID: number, tawjeehIncluded: number, tawjeehAmount: number) => Promise<void>;
  residence: Residence | null;
}

export default function TawjeehModal({ isOpen, onClose, onSubmit, residence }: TawjeehModalProps) {
  const [tawjeehIncluded, setTawjeehIncluded] = useState<number>(1);
  const [tawjeehAmount, setTawjeehAmount] = useState<number>(150);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && residence) {
      setTawjeehIncluded(residence.tawjeehIncluded);
      setTawjeehAmount(residence.tawjeeh_amount || 150);
    }
  }, [isOpen, residence]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residence) return;

    setLoading(true);
    try {
      await onSubmit(residence.residenceID, tawjeehIncluded, tawjeehAmount);
      onClose();
    } catch (error) {
      console.error('Failed to update TAWJEEH:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !residence) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-file-text"></i> Manage TAWJEEH Service</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-3">Managing TAWJEEH for: <strong>{residence.passenger_name}</strong></p>

            {/* Current Status */}
            <div className="alert alert-info mb-3" style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
              <i className="fa fa-info-circle me-2"></i>
              <strong>Current Status:</strong> {residence.tawjeehIncluded === 1 ? 'Included in sale price' : `Charged separately (${residence.tawjeeh_amount || 150} AED)`}
            </div>

            {/* TAWJEEH Options */}
            <div className="mb-3">
              <label className="form-label"><strong>TAWJEEH Action:</strong></label>
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="radio"
                  name="tawjeehOption"
                  id="tawjeehIncluded"
                  value="1"
                  checked={tawjeehIncluded === 1}
                  onChange={() => setTawjeehIncluded(1)}
                />
                <label className="form-check-label" htmlFor="tawjeehIncluded">
                  <i className="fa fa-check-circle me-2 text-success"></i>
                  Include TAWJEEH in sale price (no additional charge)
                </label>
              </div>
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="tawjeehOption"
                  id="tawjeehSeparate"
                  value="0"
                  checked={tawjeehIncluded === 0}
                  onChange={() => setTawjeehIncluded(0)}
                />
                <label className="form-check-label" htmlFor="tawjeehSeparate">
                  <i className="fa fa-exclamation-triangle me-2 text-warning"></i>
                  Charge TAWJEEH separately
                </label>
              </div>
            </div>

            {/* TAWJEEH Amount (only if charged separately) */}
            {tawjeehIncluded === 0 && (
              <div className="mb-3">
                <label className="form-label"><strong>TAWJEEH Amount (AED):</strong></label>
                <input
                  type="number"
                  className="form-control"
                  value={tawjeehAmount}
                  onChange={(e) => setTawjeehAmount(parseFloat(e.target.value))}
                  min="0"
                  step="0.01"
                  required
                />
                <small className="text-muted">Standard TAWJEEH fee is 150 AED</small>
              </div>
            )}

            {/* Summary */}
            <div className={`alert ${tawjeehIncluded === 1 ? 'alert-success' : 'alert-warning'} mb-0`} style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
              <i className={`fa fa-${tawjeehIncluded === 1 ? 'check' : 'exclamation'}-circle me-2`}></i>
              <strong>Summary:</strong> {tawjeehIncluded === 1 ? 'TAWJEEH will be included in the sale price. No additional charge will be applied.' : `TAWJEEH will be charged separately at ${tawjeehAmount} AED.`}
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
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa fa-save me-2"></i>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




