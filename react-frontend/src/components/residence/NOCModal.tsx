import { useState } from 'react';
import '../modals/Modal.css';

interface NOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: NOCData) => void;
  passengerName: string;
}

export interface NOCData {
  purpose: 'general' | 'travel' | 'visa' | 'employment';
  destination?: string;
  from_date?: string;
  to_date?: string;
}

export default function NOCModal({ isOpen, onClose, onGenerate, passengerName }: NOCModalProps) {
  const [formData, setFormData] = useState<NOCData>({
    purpose: 'general',
    destination: '',
    from_date: '',
    to_date: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate travel fields if purpose is travel
    if (formData.purpose === 'travel') {
      if (!formData.destination || !formData.from_date || !formData.to_date) {
        alert('Please fill in all travel details');
        return;
      }
    }
    
    onGenerate(formData);
    handleReset();
  };

  const handleReset = () => {
    setFormData({
      purpose: 'general',
      destination: '',
      from_date: '',
      to_date: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>
            <i className="fa fa-file-text"></i> Generate NOC - {passengerName}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group mb-4">
              <label className="form-label">
                Purpose of NOC <span className="text-danger">*</span>
              </label>
              <select
                className="form-control"
                value={formData.purpose}
                onChange={(e) => {
                  const newPurpose = e.target.value as NOCData['purpose'];
                  if (newPurpose !== 'travel') {
                    setFormData({ 
                      purpose: newPurpose,
                      destination: '',
                      from_date: '',
                      to_date: ''
                    });
                  } else {
                    setFormData({ ...formData, purpose: newPurpose });
                  }
                }}
                required
              >
                <option value="general">General Purpose</option>
                <option value="travel">Travel</option>
                <option value="visa">Visa Application</option>
                <option value="employment">Additional Employment</option>
              </select>
            </div>

            {formData.purpose === 'travel' && (
              <>
                <div className="form-group mb-4">
                  <label className="form-label">
                    Travel Destination <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="e.g., United States, Dubai, London"
                    required
                  />
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <div className="form-group mb-4">
                      <label className="form-label">
                        Travel From Date <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.from_date}
                        onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-group mb-4">
                      <label className="form-label">
                        Travel To Date <span className="text-danger">*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={formData.to_date}
                        onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                        required
                        min={formData.from_date}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="alert alert-info" style={{ 
              backgroundColor: '#1f2937', 
              border: '1px solid #3b82f6', 
              color: '#93c5fd',
              padding: '12px',
              borderRadius: '6px',
              marginTop: '16px'
            }}>
              <i className="fa fa-info-circle me-2"></i>
              {formData.purpose === 'travel' && 'The NOC will include travel dates and destination.'}
              {formData.purpose === 'visa' && 'The NOC will be suitable for visa application purposes.'}
              {formData.purpose === 'employment' && 'The NOC will confirm no objection to additional employment.'}
              {formData.purpose === 'general' && 'A general NOC will be generated.'}
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                handleReset();
                onClose();
              }}
            >
              <i className="fa fa-times me-2"></i>
              Cancel
            </button>
            <button 
              type="submit"
              className="btn btn-primary"
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none'
              }}
            >
              <i className="fa fa-file-text me-2"></i>
              Generate NOC
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

