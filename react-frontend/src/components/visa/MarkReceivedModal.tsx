import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import visaService from '../../services/visaService';
import '../modals/Modal.css';

interface EIDTask {
  residenceID: number;
  passenger_name: string;
  passportNumber: string;
  EmiratesIDNumber: string;
  completedStep: number;
  customer_name: string;
  remaining_balance: number;
  type: 'ML' | 'FZ';
}

interface MarkReceivedModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: EIDTask;
  onSuccess: () => void;
}

export default function MarkReceivedModal({ isOpen, onClose, task, onSuccess }: MarkReceivedModalProps) {
  const [formData, setFormData] = useState({
    eidNumber: '784-',
    eidExpiryDate: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    passenger_name: '',
    gender: 'male',
    dob: '',
    occupation: '',
    establishmentName: ''
  });
  const [residenceData, setResidenceData] = useState<any>(null);
  const [positions, setPositions] = useState<Array<{ position_id: number; position_name: string }>>([]);
  const [companies, setCompanies] = useState<Array<{ company_id: number; company_name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emiratesIDBackFile, setEmiratesIDBackFile] = useState<File | null>(null);
  const [emiratesIDFrontFile, setEmiratesIDFrontFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && task) {
      loadResidenceData();
      loadPositions();
      loadCompanies();
    }
  }, [isOpen, task]);

  useEffect(() => {
    if (residenceData) {
      setFormData(prev => ({
        ...prev,
        passenger_name: residenceData.passenger_name || task.passenger_name || '',
        dob: residenceData.dob || '',
        gender: residenceData.gender || 'male',
        occupation: residenceData.positionID ? String(residenceData.positionID) : '',
        establishmentName: residenceData.company ? String(residenceData.company) : ''
      }));
    }
  }, [residenceData]);

  const loadResidenceData = async () => {
    setLoadingData(true);
    try {
      const data = await visaService.getEIDResidence(task.residenceID, task.type);
      if (data && data.residence) {
        setResidenceData(data.residence);
      }
    } catch (error: any) {
      console.error('Error loading residence data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const loadPositions = async () => {
    try {
      const data = await visaService.getEIDPositions();
      if (data && data.positions) {
        setPositions(data.positions);
      }
    } catch (error: any) {
      console.error('Error loading positions:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const data = await visaService.getEIDCompanies();
      if (data && data.companies) {
        setCompanies(data.companies);
      }
    } catch (error: any) {
      console.error('Error loading companies:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'back' | 'front') => {
    const file = e.target.files?.[0];
    if (file) {
      if (type === 'back') {
        setEmiratesIDBackFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setBackPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setEmiratesIDFrontFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
          setFrontPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.eidNumber || formData.eidNumber.trim() === '') {
      newErrors.eidNumber = 'EID Number is required';
    }
    if (!formData.eidExpiryDate) {
      newErrors.eidExpiryDate = 'EID Expiry Date is required';
    }
    if (!formData.passenger_name || formData.passenger_name.trim() === '') {
      newErrors.passenger_name = 'Passenger Name is required';
    }
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }
    if (!formData.dob) {
      newErrors.dob = 'Date of Birth is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await visaService.markEIDReceived({
        id: task.residenceID,
        type: task.type,
        eidNumber: formData.eidNumber,
        eidExpiryDate: formData.eidExpiryDate,
        passenger_name: formData.passenger_name,
        gender: formData.gender,
        dob: formData.dob,
        occupation: formData.occupation ? parseInt(formData.occupation) : null,
        establishmentName: formData.establishmentName ? parseInt(formData.establishmentName) : null,
        emiratesIDBackFile: emiratesIDBackFile,
        emiratesIDFrontFile: emiratesIDFrontFile
      });

      Swal.fire('Success', 'Emirates ID marked as received successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error marking as received:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to mark as received', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h3><i className="fa fa-check-circle"></i> Mark as Received</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {loadingData ? (
              <div className="text-center py-4">
                <i className="fa fa-spinner fa-spin fa-2x"></i>
                <p className="mt-2">Loading residence data...</p>
              </div>
            ) : (
              <>
                <div className="row">
                  <div className="col-md-8 mb-3">
                    <label className="form-label">EID Number <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${errors.eidNumber ? 'is-invalid' : ''}`}
                      value={formData.eidNumber}
                      onChange={(e) => { setFormData(prev => ({ ...prev, eidNumber: e.target.value })); setErrors(prev => ({ ...prev, eidNumber: '' })); }}
                      placeholder="784-XXXX-XXXXXXX-X"
                    />
                    {errors.eidNumber && <div className="invalid-feedback">{errors.eidNumber}</div>}
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">EID Expiry Date <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className={`form-control ${errors.eidExpiryDate ? 'is-invalid' : ''}`}
                      value={formData.eidExpiryDate}
                      onChange={(e) => { setFormData(prev => ({ ...prev, eidExpiryDate: e.target.value })); setErrors(prev => ({ ...prev, eidExpiryDate: '' })); }}
                    />
                    {errors.eidExpiryDate && <div className="invalid-feedback">{errors.eidExpiryDate}</div>}
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Passenger Full Name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control ${errors.passenger_name ? 'is-invalid' : ''}`}
                      value={formData.passenger_name}
                      onChange={(e) => { setFormData(prev => ({ ...prev, passenger_name: e.target.value })); setErrors(prev => ({ ...prev, passenger_name: '' })); }}
                    />
                    {errors.passenger_name && <div className="invalid-feedback">{errors.passenger_name}</div>}
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Gender <span className="text-danger">*</span></label>
                    <select
                      className={`form-select ${errors.gender ? 'is-invalid' : ''}`}
                      value={formData.gender}
                      onChange={(e) => { setFormData(prev => ({ ...prev, gender: e.target.value })); setErrors(prev => ({ ...prev, gender: '' })); }}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    {errors.gender && <div className="invalid-feedback">{errors.gender}</div>}
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Date of Birth <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className={`form-control ${errors.dob ? 'is-invalid' : ''}`}
                      value={formData.dob}
                      onChange={(e) => { setFormData(prev => ({ ...prev, dob: e.target.value })); setErrors(prev => ({ ...prev, dob: '' })); }}
                    />
                    {errors.dob && <div className="invalid-feedback">{errors.dob}</div>}
                  </div>
                  <div className="col-md-4 mb-3">
                    <label className="form-label">Occupation <span className="text-muted">(From ID)</span></label>
                    <select
                      className="form-select"
                      value={formData.occupation}
                      onChange={(e) => setFormData(prev => ({ ...prev, occupation: e.target.value }))}
                    >
                      <option value="">-- Select Occupation --</option>
                      {positions.map((pos) => (
                        <option key={pos.position_id} value={pos.position_id}>
                          {pos.position_name}
                        </option>
                      ))}
                    </select>
                    {residenceData?.positionName && (
                      <small className="text-muted">Current: {residenceData.positionName}</small>
                    )}
                  </div>
                  <div className="col-md-8 mb-3">
                    <label className="form-label">Establishment Name <small className="text-muted">(From Emirates ID)</small></label>
                    <select
                      className="form-select"
                      value={formData.establishmentName}
                      onChange={(e) => setFormData(prev => ({ ...prev, establishmentName: e.target.value }))}
                    >
                      <option value="">-- Select Company --</option>
                      {companies.map((comp) => (
                        <option key={comp.company_id} value={comp.company_id}>
                          {comp.company_name}
                        </option>
                      ))}
                    </select>
                    {residenceData?.company_name && (
                      <small className="text-muted">Current: {residenceData.company_name}</small>
                    )}
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Emirates ID Front <small className="text-muted">(Upload to auto-extract details)</small></label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(e) => handleFileChange(e, 'back')}
                    />
                    {backPreview && (
                      <div className="mt-2">
                        <img src={backPreview} alt="Preview" className="img-thumbnail" style={{ maxHeight: '200px' }} />
                        <button
                          type="button"
                          className="btn btn-sm btn-danger mt-1"
                          onClick={() => { setBackPreview(null); setEmiratesIDBackFile(null); }}
                        >
                          <i className="fa fa-times"></i> Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-12 mb-3">
                    <label className="form-label">Emirates ID Back <small className="text-muted">(Upload to store in database)</small></label>
                    <input
                      type="file"
                      className="form-control"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={(e) => handleFileChange(e, 'front')}
                    />
                    {frontPreview && (
                      <div className="mt-2">
                        <img src={frontPreview} alt="Preview" className="img-thumbnail" style={{ maxHeight: '200px' }} />
                        <button
                          type="button"
                          className="btn btn-sm btn-danger mt-1"
                          onClick={() => { setFrontPreview(null); setEmiratesIDFrontFile(null); }}
                        >
                          <i className="fa fa-times"></i> Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading || loadingData}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

