import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import residenceService from '../../services/residenceService';
import '../modals/Modal.css';

interface RemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  residenceId: number | null;
  currentRemarks?: string;
  currentStep: string;
  onSuccess: () => void;
  showHistoryByDefault?: boolean;
  isFamily?: boolean;
}

export default function RemarksModal({
  isOpen,
  onClose,
  residenceId,
  currentRemarks = '',
  currentStep,
  onSuccess,
  showHistoryByDefault = false,
  isFamily = false
}: RemarksModalProps) {
  const [remarks, setRemarks] = useState('');
  const [remarksHistory, setRemarksHistory] = useState<Array<{
    remarks_id: number;
    remarks: string;
    step: string;
    datetime: string;
    username: string;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isOpen && residenceId) {
      setRemarks(currentRemarks || '');
      setShowHistory(showHistoryByDefault);
      loadRemarksHistory();
    }
  }, [isOpen, residenceId, currentRemarks, showHistoryByDefault]);

  const loadRemarksHistory = async () => {
    if (!residenceId) return;
    setLoadingHistory(true);
    try {
      console.log('Loading remarks history for residence:', residenceId, 'isFamily:', isFamily);
      const history = isFamily 
        ? await residenceService.getFamilyRemarksHistory(residenceId)
        : await residenceService.getRemarksHistory(residenceId);
      console.log('Remarks history received:', history);
      setRemarksHistory(Array.isArray(history) ? history : []);
    } catch (error: any) {
      console.error('Error loading remarks history:', error);
      console.error('Error response:', error.response);
      Swal.fire('Error', error.response?.data?.message || 'Failed to load remarks history', 'error');
      setRemarksHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    setLoading(true);
    try {
      if (isFamily) {
        await residenceService.addFamilyRemarks(residenceId, remarks, currentStep);
      } else {
        await residenceService.addRemarks(residenceId, remarks, currentStep);
      }
      Swal.fire('Success', 'Remarks saved successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to save remarks', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-comment"></i> {currentRemarks ? 'Edit' : 'Add'} Remarks</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">
                <strong>Remarks</strong>
              </label>
              <textarea
                className="form-control"
                rows={5}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Enter remarks here..."
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Remarks History Section */}
            <div className="mb-3">
              <button
                type="button"
                className="btn btn-sm btn-outline-info"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const newShowHistory = !showHistory;
                  setShowHistory(newShowHistory);
                  if (newShowHistory) {
                    loadRemarksHistory();
                  }
                }}
              >
                <i className="fa fa-history"></i> {showHistory ? 'Hide' : 'Show'} History
              </button>
            </div>

            {showHistory && (
              <div className="mb-3">
                <label className="form-label">
                  <strong>Remarks History</strong>
                </label>
                {loadingHistory ? (
                  <div className="text-center py-3">
                    <i className="fa fa-spinner fa-spin"></i> Loading history...
                  </div>
                ) : remarksHistory.length === 0 ? (
                  <div className="alert alert-info">
                    <i className="fa fa-info-circle"></i> No remarks history found
                  </div>
                ) : (
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px' }}>
                    {remarksHistory.map((item, index) => (
                      <div
                        key={item.remarks_id || index}
                        style={{
                          padding: '10px',
                          marginBottom: index < remarksHistory.length - 1 ? '10px' : '0',
                          borderBottom: index < remarksHistory.length - 1 ? '1px solid #e5e7eb' : 'none',
                          background: '#f9fafb',
                          borderRadius: '6px'
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                          <strong>Step {item.step}</strong> • {new Date(item.datetime).toLocaleString()} • {item.username}
                        </div>
                        <div style={{ fontSize: '13px', color: '#000000' }}>{item.remarks}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}
              Save Remarks
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

