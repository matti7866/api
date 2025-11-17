import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import '../modals/Modal.css';

interface ILOEModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (residenceID: number, insuranceIncluded: number, insuranceAmount: number, iloeFine: number, fineRemarks: string) => Promise<void>;
  residence: Residence | null;
}

export default function ILOEModal({ isOpen, onClose, onSubmit, residence }: ILOEModalProps) {
  const [activeTab, setActiveTab] = useState<'insurance' | 'fine'>('insurance');
  const [insuranceIncluded, setInsuranceIncluded] = useState<number>(1);
  const [insuranceAmount, setInsuranceAmount] = useState<number>(0);
  const [iloeFine, setIloeFine] = useState<number>(0);
  const [fineRemarks, setFineRemarks] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && residence) {
      setInsuranceIncluded(residence.insuranceIncluded);
      setInsuranceAmount(residence.insuranceAmount || 0);
      setIloeFine(residence.iloe_fine || 0);
      setFineRemarks('');
    }
  }, [isOpen, residence]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residence) return;

    setLoading(true);
    try {
      await onSubmit(residence.residenceID, insuranceIncluded, insuranceAmount, iloeFine, fineRemarks);
      onClose();
    } catch (error) {
      console.error('Failed to update ILOE:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !residence) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-shield"></i> Manage ILOE Insurance & Fine</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-3">Managing ILOE for: <strong>{residence.passenger_name}</strong></p>

            {/* Tabs */}
            <ul className="nav nav-tabs mb-3" role="tablist">
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === 'insurance' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab('insurance')}
                >
                  <i className="fa fa-shield me-2"></i>Insurance
                </button>
              </li>
              <li className="nav-item" role="presentation">
                <button
                  className={`nav-link ${activeTab === 'fine' ? 'active' : ''}`}
                  type="button"
                  onClick={() => setActiveTab('fine')}
                >
                  <i className="fa fa-exclamation-triangle me-2"></i>Fine
                </button>
              </li>
            </ul>

            {/* Insurance Tab */}
            {activeTab === 'insurance' && (
              <div className="tab-content">
                {/* Current Status */}
                <div className="alert alert-info mb-3" style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                  <i className="fa fa-info-circle me-2"></i>
                  <strong>Current Status:</strong> {residence.insuranceIncluded === 1 ? 'Included in sale price' : `Charged separately (${residence.insuranceAmount || 0} AED)`}
                </div>

                {/* Insurance Options */}
                <div className="mb-3">
                  <label className="form-label"><strong>Insurance Action:</strong></label>
                  <div className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="insuranceOption"
                      id="insuranceIncluded"
                      value="1"
                      checked={insuranceIncluded === 1}
                      onChange={() => setInsuranceIncluded(1)}
                    />
                    <label className="form-check-label" htmlFor="insuranceIncluded">
                      <i className="fa fa-check-circle me-2 text-success"></i>
                      Include ILOE Insurance in sale price (no additional charge)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="insuranceOption"
                      id="insuranceSeparate"
                      value="0"
                      checked={insuranceIncluded === 0}
                      onChange={() => setInsuranceIncluded(0)}
                    />
                    <label className="form-check-label" htmlFor="insuranceSeparate">
                      <i className="fa fa-exclamation-triangle me-2 text-warning"></i>
                      Charge ILOE Insurance separately
                    </label>
                  </div>
                </div>

                {/* Insurance Amount (only if charged separately) */}
                {insuranceIncluded === 0 && (
                  <div className="mb-3">
                    <label className="form-label"><strong>Insurance Amount (AED):</strong></label>
                    <input
                      type="number"
                      className="form-control"
                      value={insuranceAmount}
                      onChange={(e) => setInsuranceAmount(parseFloat(e.target.value))}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                )}
              </div>
            )}

            {/* Fine Tab */}
            {activeTab === 'fine' && (
              <div className="tab-content">
                {/* Current Fine Status */}
                {residence.iloe_fine && residence.iloe_fine > 0 ? (
                  <div className="alert alert-danger mb-3" style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                    <i className="fa fa-exclamation-circle me-2"></i>
                    <strong>Current Fine:</strong> {residence.iloe_fine} AED
                  </div>
                ) : (
                  <div className="alert alert-success mb-3" style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                    <i className="fa fa-check-circle me-2"></i>
                    <strong>No Fine:</strong> No ILOE fine currently applied
                  </div>
                )}

                {/* Fine Amount */}
                <div className="mb-3">
                  <label className="form-label"><strong>ILOE Fine Amount (AED):</strong></label>
                  <input
                    type="number"
                    className="form-control"
                    value={iloeFine}
                    onChange={(e) => setIloeFine(parseFloat(e.target.value))}
                    min="0"
                    step="0.01"
                    placeholder="Enter fine amount (0 to remove fine)"
                  />
                  <small className="text-muted">Enter 0 to remove the fine</small>
                </div>

                {/* Fine Remarks */}
                <div className="mb-3">
                  <label className="form-label"><strong>Remarks:</strong></label>
                  <textarea
                    className="form-control"
                    value={fineRemarks}
                    onChange={(e) => setFineRemarks(e.target.value)}
                    rows={3}
                    placeholder="Enter reason for fine or adjustment..."
                  />
                </div>
              </div>
            )}
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




