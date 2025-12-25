import { useState } from 'react';
import axios from '../../services/api';
import Swal from 'sweetalert2';

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddPersonModal({ isOpen, onClose, onSuccess }: AddPersonModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    role: '',
    passportNumber: '',
    emiratesId: '',
    phone: '',
    email: '',
    nationality: '',
    dateOfBirth: ''
  });

  const [files, setFiles] = useState({
    passportCopy: null as File | null,
    emiratesIdCopy: null as File | null,
    photo: null as File | null
  });

  const [additionalDocs, setAdditionalDocs] = useState<Array<{ name: string; type: string; file: File | null }>>([
    { name: '', type: '', file: null }
  ]);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<any>({});

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

  const handleAddDocument = () => {
    setAdditionalDocs(prev => [...prev, { name: '', type: '', file: null }]);
  };

  const handleRemoveDocument = (index: number) => {
    setAdditionalDocs(prev => prev.filter((_, i) => i !== index));
  };

  const handleDocumentChange = (index: number, field: 'name' | 'type' | 'file', value: any) => {
    setAdditionalDocs(prev => {
      const newDocs = [...prev];
      newDocs[index][field] = value;
      return newDocs;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const submitFormData = new FormData();
      submitFormData.append('action', 'addPerson');
      submitFormData.append('fullName', formData.fullName);
      submitFormData.append('role', formData.role);
      submitFormData.append('passportNumber', formData.passportNumber);
      submitFormData.append('emiratesId', formData.emiratesId);
      submitFormData.append('phone', formData.phone);
      submitFormData.append('email', formData.email);
      submitFormData.append('nationality', formData.nationality);
      submitFormData.append('dateOfBirth', formData.dateOfBirth);

      // Add standard files
      if (files.passportCopy) submitFormData.append('passportCopy', files.passportCopy);
      if (files.emiratesIdCopy) submitFormData.append('emiratesIdCopy', files.emiratesIdCopy);
      if (files.photo) submitFormData.append('photo', files.photo);

      // Add additional documents
      additionalDocs.forEach((doc, index) => {
        if (doc.name && doc.type && doc.file) {
          submitFormData.append(`documentNames[${index}]`, doc.name);
          submitFormData.append(`documentTypes[${index}]`, doc.type);
          submitFormData.append(`additionalDocuments[${index}]`, doc.file);
        }
      });

      const response = await axios.post('/establishments/manage-establishments.php', submitFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data && response.data.success) {
        Swal.fire('Success', response.data.message || 'Person added successfully', 'success');
        onSuccess();
        onClose();
        // Reset form
        setFormData({
          fullName: '',
          role: '',
          passportNumber: '',
          emiratesId: '',
          phone: '',
          email: '',
          nationality: '',
          dateOfBirth: ''
        });
        setFiles({
          passportCopy: null,
          emiratesIdCopy: null,
          photo: null
        });
        setAdditionalDocs([{ name: '', type: '', file: null }]);
      } else if (response.data && response.data.message === 'form_errors') {
        setErrors(response.data.errors || {});
      } else {
        Swal.fire('Error', response.data?.message || 'Failed to add person', 'error');
      }
    } catch (error: any) {
      console.error('Error adding person:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to add person', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <div className="modal-header bg-info">
            <h3 className="modal-title text-white">
              <i className="fa fa-user-plus"></i> Add New Person
            </h3>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="row">
                {/* Personal Information */}
                <div className="col-md-12 mb-3">
                  <h5><i className="fa fa-user"></i> Personal Information</h5>
                  <hr />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Full Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    name="fullName"
                    className={`form-control ${errors.fullName ? 'is-invalid' : ''}`}
                    value={formData.fullName}
                    onChange={handleInputChange}
                  />
                  {errors.fullName && <div className="invalid-feedback d-block">{errors.fullName}</div>}
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Role</label>
                  <select
                    name="role"
                    className="form-select"
                    value={formData.role}
                    onChange={handleInputChange}
                  >
                    <option value="">Select role</option>
                    <option value="Manager">Manager</option>
                    <option value="Owner">Owner</option>
                    <option value="Partner">Partner</option>
                    <option value="Director">Director</option>
                    <option value="Shareholder">Shareholder</option>
                  </select>
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Passport Number</label>
                  <input
                    type="text"
                    name="passportNumber"
                    className="form-control"
                    value={formData.passportNumber}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Emirates ID</label>
                  <input
                    type="text"
                    name="emiratesId"
                    className="form-control"
                    value={formData.emiratesId}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    className="form-control"
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    name="email"
                    className="form-control"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Nationality</label>
                  <input
                    type="text"
                    name="nationality"
                    className="form-control"
                    value={formData.nationality}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="col-md-6 mb-2">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    className="form-control"
                    value={formData.dateOfBirth}
                    onChange={handleInputChange}
                  />
                </div>

                {/* Documents */}
                <div className="col-md-12 mb-3 mt-3">
                  <h5><i className="fa fa-file"></i> Documents</h5>
                  <hr />
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Passport Copy <span className="text-danger">*</span></label>
                  <input
                    type="file"
                    className={`form-control ${errors.passportCopy ? 'is-invalid' : ''}`}
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'passportCopy')}
                  />
                  {errors.passportCopy && <div className="invalid-feedback d-block">{errors.passportCopy}</div>}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Emirates ID Copy <span className="text-danger">*</span></label>
                  <input
                    type="file"
                    className={`form-control ${errors.emiratesIdCopy ? 'is-invalid' : ''}`}
                    accept="image/*,.pdf"
                    onChange={(e) => handleFileChange(e, 'emiratesIdCopy')}
                  />
                  {errors.emiratesIdCopy && <div className="invalid-feedback d-block">{errors.emiratesIdCopy}</div>}
                </div>

                <div className="col-md-4 mb-2">
                  <label className="form-label">Photo <span className="text-danger">*</span></label>
                  <input
                    type="file"
                    className={`form-control ${errors.photo ? 'is-invalid' : ''}`}
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'photo')}
                  />
                  {errors.photo && <div className="invalid-feedback d-block">{errors.photo}</div>}
                </div>

                {/* Additional Documents */}
                <div className="col-md-12 mb-3 mt-3">
                  <h5><i className="fa fa-files-o"></i> Additional Documents (Optional)</h5>
                  <hr />
                </div>

                <div className="col-md-12 mb-2">
                  {additionalDocs.map((doc, index) => (
                    <div key={index} className="row mb-2">
                      <div className="col-md-4">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Document name"
                          value={doc.name}
                          onChange={(e) => handleDocumentChange(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="col-md-3">
                        <select
                          className="form-select"
                          value={doc.type}
                          onChange={(e) => handleDocumentChange(index, 'type', e.target.value)}
                        >
                          <option value="">Document type</option>
                          <option value="Visa">Visa</option>
                          <option value="License">License</option>
                          <option value="Certificate">Certificate</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="col-md-3">
                        <input
                          type="file"
                          className="form-control"
                          onChange={(e) => handleDocumentChange(index, 'file', e.target.files?.[0] || null)}
                        />
                      </div>
                      <div className="col-md-2">
                        {index === additionalDocs.length - 1 ? (
                          <button
                            type="button"
                            className="btn btn-success w-100"
                            onClick={handleAddDocument}
                          >
                            <i className="fa fa-plus"></i>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-danger w-100"
                            onClick={() => handleRemoveDocument(index)}
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
              <button type="submit" className="btn btn-info" disabled={loading}>
                {loading ? (
                  <><i className="fa fa-spinner fa-spin"></i> Saving...</>
                ) : (
                  <><i className="fa fa-save"></i> Save Person</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}




