import { useState, useEffect } from 'react';
import axios from '../../services/api';
import Swal from 'sweetalert2';

interface Establishment {
  company_id: number;
  company_name: string;
  company_type: string;
  company_number: string;
  expiry_date: string;
  quota: number;
  username?: string;
  password?: string;
  letterhead?: string;
  stamp?: string;
  signature?: string;
  trade_license?: string;
  establishment_card?: string;
}

interface EditEstablishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  establishment: Establishment | null;
}

export default function EditEstablishmentModal({ isOpen, onClose, onSuccess, establishment }: EditEstablishmentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    number: '',
    expiry: '',
    quota: '0',
    username: '',
    password: ''
  });

  const [files, setFiles] = useState({
    letterhead: null as File | null,
    stamp: null as File | null,
    signature: null as File | null,
    tradeLicense: null as File | null,
    establishmentCard: null as File | null
  });

  const [existingFiles, setExistingFiles] = useState({
    letterhead: '',
    stamp: '',
    signature: '',
    tradeLicense: '',
    establishmentCard: ''
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (isOpen && establishment) {
      setFormData({
        name: establishment.company_name || '',
        type: establishment.company_type || '',
        number: establishment.company_number || '',
        expiry: establishment.expiry_date || '',
        quota: establishment.quota?.toString() || '0',
        username: establishment.username || '',
        password: establishment.password || ''
      });
      setExistingFiles({
        letterhead: establishment.letterhead || '',
        stamp: establishment.stamp || '',
        signature: establishment.signature || '',
        tradeLicense: establishment.trade_license || '',
        establishmentCard: establishment.establishment_card || ''
      });
    }
  }, [isOpen, establishment]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors((prev: any) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [fieldName]: file }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!establishment) return;

    setLoading(true);
    setErrors({});

    try {
      const submitFormData = new FormData();
      submitFormData.append('action', 'updateCompany');
      submitFormData.append('idEdit', establishment.company_id.toString());
      submitFormData.append('nameEdit', formData.name);
      submitFormData.append('typeEdit', formData.type);
      submitFormData.append('numberEdit', formData.number);
      submitFormData.append('expiryEdit', formData.expiry);
      submitFormData.append('quotaEdit', formData.quota);
      submitFormData.append('usernameEdit', formData.username);
      submitFormData.append('passwordEdit', formData.password);

      // Add files only if new files are selected
      if (files.letterhead) submitFormData.append('letterHeadEdit', files.letterhead);
      if (files.stamp) submitFormData.append('stampEdit', files.stamp);
      if (files.signature) submitFormData.append('signatureEdit', files.signature);
      if (files.tradeLicense) submitFormData.append('tradeLicenseEdit', files.tradeLicense);
      if (files.establishmentCard) submitFormData.append('establishmentCardEdit', files.establishmentCard);

      const response = await axios.post('/establishments/manage-establishments.php', submitFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        Swal.fire('Success', response.data.message || 'Establishment updated successfully', 'success');
        onSuccess();
        onClose();
      } else if (response.data && response.data.message === 'form_errors') {
        setErrors(response.data.errors || {});
      } else {
        Swal.fire('Error', response.data?.message || 'Failed to update establishment', 'error');
      }
    } catch (error: any) {
      console.error('Error updating establishment:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to update establishment', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !establishment) return null;

  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-warning">
            <h3 className="modal-title text-white">
              <i className="fa fa-edit"></i> Edit Establishment
            </h3>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="row">
                {/* Basic Information */}
                <div className="col-md-12 mb-3">
                  <h5><i className="fa fa-info-circle"></i> Basic Information</h5>
                  <hr />
                </div>

                <div className="col-md-8 mb-2">
                  <label className="form-label">Establishment Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="name"
                    className={`form-control ${errors.nameEdit ? 'is-invalid' : ''}`}
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                  {errors.nameEdit && <div className="invalid-feedback d-block">{errors.nameEdit}</div>}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Type <span className="text-danger">*</span></label>
                  <select
                    name="type"
                    className={`form-select ${errors.typeEdit ? 'is-invalid' : ''}`}
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="Mainland">Mainland</option>
                    <option value="Freezone">Freezone</option>
                  </select>
                  {errors.typeEdit && <div className="invalid-feedback d-block">{errors.typeEdit}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Company Number <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="number"
                    className={`form-control ${errors.numberEdit ? 'is-invalid' : ''}`}
                    value={formData.number}
                    onChange={handleInputChange}
                  />
                  {errors.numberEdit && <div className="invalid-feedback d-block">{errors.numberEdit}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Expiry Date <span className="text-danger">*</span></label>
                  <input
                    type="date"
                    name="expiry"
                    className={`form-control ${errors.expiryEdit ? 'is-invalid' : ''}`}
                    value={formData.expiry}
                    onChange={handleInputChange}
                  />
                  {errors.expiryEdit && <div className="invalid-feedback d-block">{errors.expiryEdit}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Starting Quota <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    name="quota"
                    className={`form-control ${errors.quotaEdit ? 'is-invalid' : ''}`}
                    value={formData.quota}
                    onChange={handleInputChange}
                  />
                  {errors.quotaEdit && <div className="invalid-feedback d-block">{errors.quotaEdit}</div>}
                </div>

                {/* Login Credentials */}
                <div className="col-md-12 mb-3 mt-3">
                  <h5><i className="fa fa-lock"></i> Login Credentials</h5>
                  <hr />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    name="username"
                    className="form-control"
                    value={formData.username}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Password</label>
                  <input
                    type="text"
                    name="password"
                    className="form-control"
                    value={formData.password}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Documents */}
                <div className="col-md-12 mb-3 mt-3">
                  <h5><i className="fa fa-file"></i> Standard Documents</h5>
                  <small className="text-muted">Upload new files only if you want to replace existing ones</small>
                  <hr />
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Letterhead</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'letterhead')}
                  />
                  {existingFiles.letterhead && (
                    <small className="text-success">
                      <i className="fa fa-check"></i> File exists
                    </small>
                  )}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Stamp</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'stamp')}
                  />
                  {existingFiles.stamp && (
                    <small className="text-success">
                      <i className="fa fa-check"></i> File exists
                    </small>
                  )}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Signature</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'signature')}
                  />
                  {existingFiles.signature && (
                    <small className="text-success">
                      <i className="fa fa-check"></i> File exists
                    </small>
                  )}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Trade License Copy</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'tradeLicense')}
                  />
                  {existingFiles.tradeLicense && (
                    <small className="text-success">
                      <i className="fa fa-check"></i> File exists
                    </small>
                  )}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Establishment Card</label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'establishmentCard')}
                  />
                  {existingFiles.establishmentCard && (
                    <small className="text-success">
                      <i className="fa fa-check"></i> File exists
                    </small>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="submit" className="btn btn-warning" disabled={loading}>
                {loading ? (
                  <><i className="fa fa-spinner fa-spin"></i> Updating...</>
                ) : (
                  <><i className="fa fa-save"></i> Update Establishment</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}




