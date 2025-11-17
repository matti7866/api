import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import residenceService from '../../../services/residenceService';
import '../../modals/Modal.css';

interface OfferLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  residenceId: number | null;
  onSuccess: () => void;
  companies: Array<{ company_id: number; company_name: string; starting_quota: number; totalEmployees: number }>;
  currencies: Array<{ currencyID: number; currencyName: string }>;
  accounts: Array<{ account_ID: number; account_Name: string }>;
  suppliers: Array<{ supp_id: number; supp_name: string }>;
}

export default function OfferLetterModal({
  isOpen,
  onClose,
  residenceId,
  onSuccess,
  companies,
  currencies,
  accounts,
  suppliers
}: OfferLetterModalProps) {
  const [formData, setFormData] = useState({
    company_id: '',
    mbNumber: '',
    offerLetterCost: '50',
    offerLetterCurrency: '',
    offerLetterChargeOn: '1',
    offerLetterChargeAccount: '',
    offerLetterChargeSupplier: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId) {
      // Reset form
      setFormData({
        company_id: '',
        mbNumber: '',
        offerLetterCost: '50',
        offerLetterCurrency: currencies.length > 0 ? currencies[0].currencyID.toString() : '',
        offerLetterChargeOn: '1',
        offerLetterChargeAccount: '',
        offerLetterChargeSupplier: ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.company_id) newErrors.company_id = 'Establishment is required';
    if (!formData.mbNumber) newErrors.mbNumber = 'MB Number is required';
    if (!formData.offerLetterCost) newErrors.offerLetterCost = 'Offer Letter Cost is required';
    if (!formData.offerLetterCurrency) newErrors.offerLetterCurrency = 'Currency is required';
    if (!formData.offerLetterChargeOn) newErrors.offerLetterChargeOn = 'Charge On is required';
    if (formData.offerLetterChargeOn === '1' && !formData.offerLetterChargeAccount) {
      newErrors.offerLetterChargeAccount = 'Charge Account is required';
    }
    if (formData.offerLetterChargeOn === '2' && !formData.offerLetterChargeSupplier) {
      newErrors.offerLetterChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await residenceService.updateStep(residenceId, {
        step: 1,
        markComplete: true,
        company: formData.company_id,
        mb_number: formData.mbNumber,
        offerLetterCost: formData.offerLetterCost,
        offerLetterCostCur: formData.offerLetterCurrency,
        offerLChargOpt: formData.offerLetterChargeOn,
        offerLChargedEntity: formData.offerLetterChargeOn === '1' ? formData.offerLetterChargeAccount : formData.offerLetterChargeSupplier,
        files: selectedFile ? { offerLetterFile: selectedFile } : {}
      });

      Swal.fire('Success', 'Offer letter set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to set offer letter';
      Swal.fire('Error', errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', background: '#fff', color: '#222' }}>
        <div className="modal-header">
          <h3><i className="fa fa-envelope"></i> Offer Letter</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ background: '#fff', padding: '2rem', border: '2px solid #d32f2f', borderRadius: '8px' }}>
            <div className="row">
              <div className="col-md-12 mb-3">
                <label className="form-label">Establishment <span className="text-danger">*</span></label>
                <select
                  name="company_id"
                  className={`form-select ${errors.company_id ? 'is-invalid' : ''}`}
                  value={formData.company_id}
                  onChange={handleChange}
                >
                  <option value="">Select Establishment</option>
                  {companies.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                      {company.company_name} ({company.starting_quota - company.totalEmployees})
                    </option>
                  ))}
                </select>
                {errors.company_id && <div className="invalid-feedback">{errors.company_id}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">MB Number <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="mbNumber"
                  className={`form-control ${errors.mbNumber ? 'is-invalid' : ''}`}
                  value={formData.mbNumber}
                  onChange={handleChange}
                  placeholder="MBXXXXXXAE"
                />
                {errors.mbNumber && <div className="invalid-feedback">{errors.mbNumber}</div>}
              </div>
              <div className="col-md-8 mb-3">
                <label className="form-label">Offer Letter File</label>
                <input
                  type="file"
                  name="offerLetterFile"
                  className="form-control"
                  accept=".pdf"
                  onChange={handleFileChange}
                />
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Offer Letter Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="offerLetterCost"
                  className={`form-control ${errors.offerLetterCost ? 'is-invalid' : ''}`}
                  value={formData.offerLetterCost}
                  onChange={handleChange}
                />
                {errors.offerLetterCost && <div className="invalid-feedback">{errors.offerLetterCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="offerLetterCurrency"
                  className={`form-select ${errors.offerLetterCurrency ? 'is-invalid' : ''}`}
                  value={formData.offerLetterCurrency}
                  onChange={handleChange}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((currency) => (
                    <option key={currency.currencyID} value={currency.currencyID}>
                      {currency.currencyName}
                    </option>
                  ))}
                </select>
                {errors.offerLetterCurrency && <div className="invalid-feedback">{errors.offerLetterCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="offerLetterChargeOn"
                  className={`form-select ${errors.offerLetterChargeOn ? 'is-invalid' : ''}`}
                  value={formData.offerLetterChargeOn}
                  onChange={handleChange}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
                {errors.offerLetterChargeOn && <div className="invalid-feedback">{errors.offerLetterChargeOn}</div>}
              </div>
              {formData.offerLetterChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="offerLetterChargeAccount"
                    className={`form-select ${errors.offerLetterChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.offerLetterChargeAccount}
                    onChange={handleChange}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((account) => (
                      <option key={account.account_ID} value={account.account_ID}>
                        {account.account_Name}
                      </option>
                    ))}
                  </select>
                  {errors.offerLetterChargeAccount && <div className="invalid-feedback">{errors.offerLetterChargeAccount}</div>}
                </div>
              )}
              {formData.offerLetterChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="offerLetterChargeSupplier"
                    className={`form-select ${errors.offerLetterChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.offerLetterChargeSupplier}
                    onChange={handleChange}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.supp_id} value={supplier.supp_id}>
                        {supplier.supp_name}
                      </option>
                    ))}
                  </select>
                  {errors.offerLetterChargeSupplier && <div className="invalid-feedback">{errors.offerLetterChargeSupplier}</div>}
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

