import { useState, useEffect } from 'react';
import axios from '../../services/api';
import Swal from 'sweetalert2';

interface Person {
  person_id: number;
  person_name: string;
}

interface Signatory {
  role: string;
  personId: string;
}

interface AddEstablishmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddEstablishmentModal({ isOpen, onClose, onSuccess }: AddEstablishmentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    number: '',
    expiry: '',
    quota: '0',
    username: '',
    password: ''
  });

  const [persons, setPersons] = useState<Person[]>([]);
  const [signatories, setSignatories] = useState<Signatory[]>([{ role: '', personId: '' }]);
  const [files, setFiles] = useState({
    letterhead: null as File | null,
    stamp: null as File | null,
    signature: null as File | null,
    tradeLicense: null as File | null,
    establishmentCard: null as File | null
  });
  const [additionalFiles, setAdditionalFiles] = useState<Array<{ name: string; file: File | null }>>([
    { name: '', file: null }
  ]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

  useEffect(() => {
    if (isOpen) {
      loadPersons();
    }
  }, [isOpen]);

  const loadPersons = async () => {
    try {
      const formData = new FormData();
      formData.append('action', 'getPersons');

      const response = await axios.post('/establishments/manage-establishments.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        setPersons(response.data.persons || []);
      }
    } catch (error) {
      console.error('Error loading persons:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors((prev: any) => ({ ...prev, [name]: '' }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0] || null;
    setFiles(prev => ({ ...prev, [fieldName]: file }));
    setErrors((prev: any) => ({ ...prev, [fieldName]: '' }));
  };

  const handleAddSignatory = () => {
    setSignatories(prev => [...prev, { role: '', personId: '' }]);
  };

  const handleRemoveSignatory = (index: number) => {
    setSignatories(prev => prev.filter((_, i) => i !== index));
  };

  const handleSignatoryChange = (index: number, field: 'role' | 'personId', value: string) => {
    setSignatories(prev => {
      const newSignatories = [...prev];
      newSignatories[index][field] = value;
      return newSignatories;
    });
  };

  const handleAddAdditionalFile = () => {
    setAdditionalFiles(prev => [...prev, { name: '', file: null }]);
  };

  const handleRemoveAdditionalFile = (index: number) => {
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAdditionalFileChange = (index: number, field: 'name' | 'file', value: any) => {
    setAdditionalFiles(prev => {
      const newFiles = [...prev];
      newFiles[index][field] = value;
      return newFiles;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const submitFormData = new FormData();
      submitFormData.append('action', 'addCompany');
      submitFormData.append('nameAdd', formData.name);
      submitFormData.append('typeAdd', formData.type);
      submitFormData.append('numberAdd', formData.number);
      submitFormData.append('expiryAdd', formData.expiry);
      submitFormData.append('quotaAdd', formData.quota);
      submitFormData.append('usernameAdd', formData.username);
      submitFormData.append('passwordAdd', formData.password);

      // Add signatories
      signatories.forEach((sig, index) => {
        submitFormData.append(`signatoryRoles[${index}]`, sig.role);
        submitFormData.append(`signatoryPersons[${index}]`, sig.personId);
      });

      // Add standard files
      if (files.letterhead) submitFormData.append('letterHeadAdd', files.letterhead);
      if (files.stamp) submitFormData.append('stampAdd', files.stamp);
      if (files.signature) submitFormData.append('signatureAdd', files.signature);
      if (files.tradeLicense) submitFormData.append('tradeLicenseAdd', files.tradeLicense);
      if (files.establishmentCard) submitFormData.append('establishmentCardAdd', files.establishmentCard);

      // Add additional files
      additionalFiles.forEach((item, index) => {
        if (item.name && item.file) {
          submitFormData.append(`fileNames[${index}]`, item.name);
          submitFormData.append(`additionalFiles[${index}]`, item.file);
        }
      });

      const response = await axios.post('/establishments/manage-establishments.php', submitFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        Swal.fire('Success', response.data.message || 'Establishment added successfully', 'success');
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          name: '',
          type: '',
          number: '',
          expiry: '',
          quota: '0',
          username: '',
          password: ''
        });
        setSignatories([{ role: '', personId: '' }]);
        setFiles({
          letterhead: null,
          stamp: null,
          signature: null,
          tradeLicense: null,
          establishmentCard: null
        });
        setAdditionalFiles([{ name: '', file: null }]);
      } else if (response.data && response.data.message === 'form_errors') {
        setErrors(response.data.errors || {});
      } else {
        Swal.fire('Error', response.data?.message || 'Failed to add establishment', 'error');
      }
    } catch (error: any) {
      console.error('Error adding establishment:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to add establishment', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-dark">
            <h3 className="modal-title text-white">
              <i className="fa fa-plus"></i> Add New Establishment
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
                    className={`form-control ${errors.nameAdd ? 'is-invalid' : ''}`}
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                  {errors.nameAdd && <div className="invalid-feedback d-block">{errors.nameAdd}</div>}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Type <span className="text-danger">*</span></label>
                  <select
                    name="type"
                    className={`form-select ${errors.typeAdd ? 'is-invalid' : ''}`}
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    <option value="">Choose type</option>
                    <option value="Mainland">Mainland</option>
                    <option value="Freezone">Freezone</option>
                  </select>
                  {errors.typeAdd && <div className="invalid-feedback d-block">{errors.typeAdd}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Company Number <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="number"
                    className={`form-control ${errors.numberAdd ? 'is-invalid' : ''}`}
                    value={formData.number}
                    onChange={handleInputChange}
                  />
                  {errors.numberAdd && <div className="invalid-feedback d-block">{errors.numberAdd}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Expiry Date <span className="text-danger">*</span></label>
                  <input
                    type="date"
                    name="expiry"
                    className={`form-control ${errors.expiryAdd ? 'is-invalid' : ''}`}
                    value={formData.expiry}
                    onChange={handleInputChange}
                  />
                  {errors.expiryAdd && <div className="invalid-feedback d-block">{errors.expiryAdd}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Starting Quota <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    name="quota"
                    className={`form-control ${errors.quotaAdd ? 'is-invalid' : ''}`}
                    value={formData.quota}
                    onChange={handleInputChange}
                  />
                  {errors.quotaAdd && <div className="invalid-feedback d-block">{errors.quotaAdd}</div>}
                </div>

                {/* Authorized Signatories */}
                <div className="col-md-12 mb-2">
                  <label className="form-label">Authorized Signatories <span className="text-danger">*</span></label>
                  {signatories.map((sig, index) => (
                    <div key={index} className="row mb-2">
                      <div className="col-md-4">
                        <select
                          className="form-select"
                          value={sig.role}
                          onChange={(e) => handleSignatoryChange(index, 'role', e.target.value)}
                        >
                          <option value="">Select role</option>
                          <option value="Manager">Manager</option>
                          <option value="Owner">Owner</option>
                          <option value="Partner">Partner</option>
                          <option value="Director">Director</option>
                          <option value="Authorized Signatory">Authorized Signatory</option>
                          <option value="Secretary">Secretary</option>
                        </select>
                      </div>
                      <div className="col-md-6">
                        <select
                          className="form-select"
                          value={sig.personId}
                          onChange={(e) => handleSignatoryChange(index, 'personId', e.target.value)}
                        >
                          <option value="">Select person</option>
                          {persons.map((person) => (
                            <option key={person.person_id} value={person.person_id}>
                              {person.person_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-2">
                        {index === signatories.length - 1 ? (
                          <button
                            type="button"
                            className="btn btn-success w-100"
                            onClick={handleAddSignatory}
                          >
                            <i className="fa fa-plus"></i>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-danger w-100"
                            onClick={() => handleRemoveSignatory(index)}
                          >
                            <i className="fa fa-minus"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {errors.authorizedSignatoriesAdd && (
                    <div className="text-danger small">{errors.authorizedSignatoriesAdd}</div>
                  )}
                  <small className="text-muted">Add multiple authorized signatories with their roles</small>
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

                {/* Standard Documents */}
                <div className="col-md-12 mb-3 mt-3">
                  <h5><i className="fa fa-file"></i> Standard Documents</h5>
                  <hr />
                </div>

                <div className="col-md-12 mb-2">
                  <small className="text-muted">
                    <i className="fa fa-info-circle"></i> Documents are optional. You can upload them later using the Attachments button.
                  </small>
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Letterhead</label>
                  <input
                    type="file"
                    className={`form-control ${errors.letterHeadAdd ? 'is-invalid' : ''}`}
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'letterhead')}
                  />
                  {errors.letterHeadAdd && <div className="invalid-feedback d-block">{errors.letterHeadAdd}</div>}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Stamp</label>
                  <input
                    type="file"
                    className={`form-control ${errors.stampAdd ? 'is-invalid' : ''}`}
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'stamp')}
                  />
                  {errors.stampAdd && <div className="invalid-feedback d-block">{errors.stampAdd}</div>}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Signature</label>
                  <input
                    type="file"
                    className={`form-control ${errors.signatureAdd ? 'is-invalid' : ''}`}
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'signature')}
                  />
                  {errors.signatureAdd && <div className="invalid-feedback d-block">{errors.signatureAdd}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Trade License Copy</label>
                  <input
                    type="file"
                    className={`form-control ${errors.tradeLicenseAdd ? 'is-invalid' : ''}`}
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'tradeLicense')}
                  />
                  {errors.tradeLicenseAdd && <div className="invalid-feedback d-block">{errors.tradeLicenseAdd}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Establishment Card</label>
                  <input
                    type="file"
                    className={`form-control ${errors.establishmentCardAdd ? 'is-invalid' : ''}`}
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'establishmentCard')}
                  />
                  {errors.establishmentCardAdd && <div className="invalid-feedback d-block">{errors.establishmentCardAdd}</div>}
                </div>

                {/* Additional Documents */}
                <div className="col-md-12 mb-3 mt-3">
                  <h5><i className="fa fa-files-o"></i> Additional Documents</h5>
                  <hr />
                </div>

                <div className="col-md-12 mb-2">
                  {additionalFiles.map((item, index) => (
                    <div key={index} className="row mb-2">
                      <div className="col-md-5">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Document name"
                          value={item.name}
                          onChange={(e) => handleAdditionalFileChange(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="col-md-5">
                        <input
                          type="file"
                          className="form-control"
                          onChange={(e) => handleAdditionalFileChange(index, 'file', e.target.files?.[0] || null)}
                        />
                      </div>
                      <div className="col-md-2">
                        {index === additionalFiles.length - 1 ? (
                          <button
                            type="button"
                            className="btn btn-success w-100"
                            onClick={handleAddAdditionalFile}
                          >
                            <i className="fa fa-plus"></i>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-danger w-100"
                            onClick={() => handleRemoveAdditionalFile(index)}
                          >
                            <i className="fa fa-minus"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? (
                  <><i className="fa fa-spinner fa-spin"></i> Saving...</>
                ) : (
                  <><i className="fa fa-save"></i> Save Establishment</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

