import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import freezoneService from '../../services/freezoneService';
import SearchableSelect from '../form/SearchableSelect';
import '../modals/Modal.css';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  residenceId: number | null;
  onSuccess: () => void;
  companies: Array<{ company_id: number; company_name: string }>;
  positions: Array<{ position_id: number; posiiton_name: string }>;
  accounts: Array<{ account_ID: number; account_Name: string }>;
  suppliers: Array<{ supp_id: number; supp_name: string }>;
  currencies?: Array<{ currencyID: number; currencyName: string }>;
  residence?: any; // Optional residence data for pre-filling
}

// eVisa Modal
export function FreezoneEVisaModal({ isOpen, onClose, residenceId, onSuccess, companies, positions, accounts, currencies, residence }: BaseModalProps) {
  const [formData, setFormData] = useState({
    companyID: '',
    eVisaPositionID: '',
    eVisaCost: '4020',
    eVisaAccountID: '',
    eVisaCurrencyID: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId) {
      setFormData({
        companyID: '',
        eVisaPositionID: residence?.positionID ? residence.positionID.toString() : '',
        eVisaCost: '4020',
        eVisaAccountID: '',
        eVisaCurrencyID: currencies && currencies.length > 0 ? currencies[0].currencyID.toString() : ''
      });
      setErrors({});
    }
  }, [isOpen, residenceId, residence, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.companyID) newErrors.companyID = 'Establishment is required';
    if (!formData.eVisaPositionID) newErrors.eVisaPositionID = 'Position is required';
    if (!formData.eVisaCost) newErrors.eVisaCost = 'Cost is required';
    if (!formData.eVisaAccountID) newErrors.eVisaAccountID = 'Account is required';
    if (!formData.eVisaCurrencyID) newErrors.eVisaCurrencyID = 'Currency is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await freezoneService.setEVisa(residenceId, {
        companyID: formData.companyID,
        eVisaPositionID: formData.eVisaPositionID,
        eVisaCost: formData.eVisaCost,
        eVisaAccountID: formData.eVisaAccountID,
        eVisaCurrencyID: formData.eVisaCurrencyID
      });

      Swal.fire('Success', 'eVisa set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('eVisa update error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to set eVisa', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  console.log('FreezoneEVisaModal props:', { companies: companies.length, positions: positions.length, residence });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-ticket"></i> Submit eVisa</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-12 mb-3">
                <label className="form-label">Establishment <span className="text-danger">*</span></label>
                <div className={errors.companyID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={companies && companies.length > 0 ? companies.map((company) => ({
                      value: company.company_id.toString(),
                      label: company.company_name
                    })) : []}
                    value={formData.companyID || ''}
                    onChange={(value) => setFormData({ ...formData, companyID: value ? value.toString() : '' })}
                    placeholder="Select Establishment"
                    required
                  />
                </div>
                {errors.companyID && <div className="invalid-feedback d-block">{errors.companyID}</div>}
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Position <span className="text-danger">*</span></label>
                <div className={errors.eVisaPositionID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={positions && positions.length > 0 ? positions.map((pos) => ({
                      value: pos.position_id.toString(),
                      label: pos.posiiton_name || pos.position_name || ''
                    })) : []}
                    value={formData.eVisaPositionID || ''}
                    onChange={(value) => setFormData({ ...formData, eVisaPositionID: value ? value.toString() : '' })}
                    placeholder="Select Position"
                    required
                  />
                </div>
                {errors.eVisaPositionID && <div className="invalid-feedback d-block">{errors.eVisaPositionID}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">eVisa Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control ${errors.eVisaCost ? 'is-invalid' : ''}`}
                  value={formData.eVisaCost}
                  onChange={(e) => setFormData({ ...formData, eVisaCost: e.target.value })}
                />
                {errors.eVisaCost && <div className="invalid-feedback">{errors.eVisaCost}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <div className={errors.eVisaCurrencyID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={currencies && currencies.length > 0 ? currencies.map((currency) => ({
                      value: currency.currencyID.toString(),
                      label: currency.currencyName
                    })) : []}
                    value={formData.eVisaCurrencyID || ''}
                    onChange={(value) => setFormData({ ...formData, eVisaCurrencyID: value ? value.toString() : '' })}
                    placeholder="Select Currency"
                    required
                  />
                </div>
                {errors.eVisaCurrencyID && <div className="invalid-feedback d-block">{errors.eVisaCurrencyID}</div>}
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Account <span className="text-danger">*</span></label>
                <div className={errors.eVisaAccountID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={accounts && accounts.length > 0 ? accounts.map((account) => ({
                      value: account.account_ID.toString(),
                      label: account.account_Name
                    })) : []}
                    value={formData.eVisaAccountID || ''}
                    onChange={(value) => setFormData({ ...formData, eVisaAccountID: value ? value.toString() : '' })}
                    placeholder="Select Account"
                    required
                  />
                </div>
                {errors.eVisaAccountID && <div className="invalid-feedback d-block">{errors.eVisaAccountID}</div>}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// eVisa Accept Modal
export function FreezoneEVisaAcceptModal({ isOpen, onClose, residenceId, onSuccess }: Omit<BaseModalProps, 'companies' | 'positions' | 'accounts' | 'suppliers'>) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    setLoading(true);
    try {
      await freezoneService.acceptEVisa(residenceId, selectedFile || undefined);

      Swal.fire('Success', 'eVisa accepted successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('eVisa accept error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to accept eVisa', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-check-circle"></i> Accept eVisa</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-12 mb-3">
                <label className="form-label">eVisa File</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Change Status Modal
export function FreezoneChangeStatusModal({ isOpen, onClose, residenceId, onSuccess, accounts, suppliers, currencies }: Omit<BaseModalProps, 'companies' | 'positions'>) {
  const [formData, setFormData] = useState({
    changeStatusCost: '1520',
    changeStatusAccountType: '1',
    changeStatusAccountID: '',
    changeStatusSupplierID: '',
    changeStatusCurrencyID: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId) {
      setFormData({
        changeStatusCost: '1520',
        changeStatusAccountType: '1',
        changeStatusAccountID: '',
        changeStatusSupplierID: '',
        changeStatusCurrencyID: currencies && currencies.length > 0 ? currencies[0].currencyID.toString() : ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.changeStatusCost) newErrors.changeStatusCost = 'Cost is required';
    if (!formData.changeStatusCurrencyID) newErrors.changeStatusCurrencyID = 'Currency is required';
    if (formData.changeStatusAccountType === '1' && !formData.changeStatusAccountID) {
      newErrors.changeStatusAccountID = 'Account is required';
    }
    if (formData.changeStatusAccountType === '2' && !formData.changeStatusSupplierID) {
      newErrors.changeStatusSupplierID = 'Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await freezoneService.setChangeStatus(residenceId, {
        changeStatusCost: formData.changeStatusCost,
        changeStatusAccountType: formData.changeStatusAccountType,
        changeStatusAccountID: formData.changeStatusAccountType === '1' ? formData.changeStatusAccountID : undefined,
        changeStatusSupplierID: formData.changeStatusAccountType === '2' ? formData.changeStatusSupplierID : undefined,
        changeStatusCurrencyID: formData.changeStatusCurrencyID,
        changeStatusFile: selectedFile || undefined
      });

      Swal.fire('Success', 'Status changed successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Change status error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to change status', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-exchange"></i> Change Status</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Change Status Cost <span className="text-danger">*</span></label>
                <input
                  type="number"
                  className={`form-control ${errors.changeStatusCost ? 'is-invalid' : ''}`}
                  value={formData.changeStatusCost}
                  onChange={(e) => setFormData({ ...formData, changeStatusCost: e.target.value })}
                />
                {errors.changeStatusCost && <div className="invalid-feedback">{errors.changeStatusCost}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Account Type <span className="text-danger">*</span></label>
                <select
                  className="form-select"
                  value={formData.changeStatusAccountType}
                  onChange={(e) => setFormData({ ...formData, changeStatusAccountType: e.target.value, changeStatusAccountID: '', changeStatusSupplierID: '' })}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
              </div>
              {formData.changeStatusAccountType === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Account <span className="text-danger">*</span></label>
                  <select
                    className={`form-select ${errors.changeStatusAccountID ? 'is-invalid' : ''}`}
                    value={formData.changeStatusAccountID}
                    onChange={(e) => setFormData({ ...formData, changeStatusAccountID: e.target.value })}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((account) => (
                      <option key={account.account_ID} value={account.account_ID}>
                        {account.account_Name}
                      </option>
                    ))}
                  </select>
                  {errors.changeStatusAccountID && <div className="invalid-feedback">{errors.changeStatusAccountID}</div>}
                </div>
              )}
              {formData.changeStatusAccountType === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Supplier <span className="text-danger">*</span></label>
                  <select
                    className={`form-select ${errors.changeStatusSupplierID ? 'is-invalid' : ''}`}
                    value={formData.changeStatusSupplierID}
                    onChange={(e) => setFormData({ ...formData, changeStatusSupplierID: e.target.value })}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.supp_id} value={supplier.supp_id}>
                        {supplier.supp_name}
                      </option>
                    ))}
                  </select>
                  {errors.changeStatusSupplierID && <div className="invalid-feedback">{errors.changeStatusSupplierID}</div>}
                </div>
              )}
              <div className="col-md-6 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <div className={errors.changeStatusCurrencyID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={currencies && currencies.length > 0 ? currencies.map((currency) => ({
                      value: currency.currencyID.toString(),
                      label: currency.currencyName
                    })) : []}
                    value={formData.changeStatusCurrencyID}
                    onChange={(value) => setFormData({ ...formData, changeStatusCurrencyID: value })}
                    placeholder="Select Currency"
                  />
                </div>
                {errors.changeStatusCurrencyID && <div className="invalid-feedback">{errors.changeStatusCurrencyID}</div>}
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Change Status File</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Medical Modal
export function FreezoneMedicalModal({ isOpen, onClose, residenceId, onSuccess, accounts, currencies }: Omit<BaseModalProps, 'companies' | 'positions' | 'suppliers'>) {
  const [formData, setFormData] = useState({
    medicalCost: '275',
    medicalAccountID: '',
    medicalCurrencyID: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId) {
      setFormData({
        medicalCost: '275',
        medicalAccountID: '',
        medicalCurrencyID: currencies && currencies.length > 0 ? currencies[0].currencyID.toString() : ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.medicalCost) newErrors.medicalCost = 'Medical Cost is required';
    if (!formData.medicalAccountID) newErrors.medicalAccountID = 'Account is required';
    if (!formData.medicalCurrencyID) newErrors.medicalCurrencyID = 'Currency is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await freezoneService.setMedical(residenceId, {
        medicalCost: formData.medicalCost,
        medicalAccountID: formData.medicalAccountID,
        medicalCurrencyID: formData.medicalCurrencyID,
        medicalFile: selectedFile || undefined
      });

      Swal.fire('Success', 'Medical set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Medical update error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to set medical', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-medkit"></i> Medical</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Medical Cost <span className="text-danger">*</span></label>
                <input
                  type="number"
                  className={`form-control ${errors.medicalCost ? 'is-invalid' : ''}`}
                  value={formData.medicalCost}
                  onChange={(e) => setFormData({ ...formData, medicalCost: e.target.value })}
                />
                {errors.medicalCost && <div className="invalid-feedback">{errors.medicalCost}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Account <span className="text-danger">*</span></label>
                <div className={errors.medicalAccountID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={accounts && accounts.length > 0 ? accounts.map((account) => ({
                      value: account.account_ID.toString(),
                      label: account.account_Name
                    })) : []}
                    value={formData.medicalAccountID}
                    onChange={(value) => setFormData({ ...formData, medicalAccountID: value })}
                    placeholder="Select Account"
                  />
                </div>
                {errors.medicalAccountID && <div className="invalid-feedback">{errors.medicalAccountID}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <div className={errors.medicalCurrencyID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={currencies && currencies.length > 0 ? currencies.map((currency) => ({
                      value: currency.currencyID.toString(),
                      label: currency.currencyName
                    })) : []}
                    value={formData.medicalCurrencyID}
                    onChange={(value) => setFormData({ ...formData, medicalCurrencyID: value })}
                    placeholder="Select Currency"
                  />
                </div>
                {errors.medicalCurrencyID && <div className="invalid-feedback">{errors.medicalCurrencyID}</div>}
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Medical File</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Emirates ID Modal
export function FreezoneEmiratesIDModal({ isOpen, onClose, residenceId, onSuccess, accounts, currencies }: Omit<BaseModalProps, 'companies' | 'positions' | 'suppliers'>) {
  const [formData, setFormData] = useState({
    emiratesIDCost: '375',
    emiratesIDAccountID: '',
    emiratesIDCurrencyID: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId) {
      setFormData({
        emiratesIDCost: '375',
        emiratesIDAccountID: '',
        emiratesIDCurrencyID: currencies && currencies.length > 0 ? currencies[0].currencyID.toString() : ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.emiratesIDCost) newErrors.emiratesIDCost = 'Emirates ID Cost is required';
    if (!formData.emiratesIDAccountID) newErrors.emiratesIDAccountID = 'Account is required';
    if (!formData.emiratesIDCurrencyID) newErrors.emiratesIDCurrencyID = 'Currency is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await freezoneService.setEmiratesID(residenceId, {
        emiratesIDCost: formData.emiratesIDCost,
        emiratesIDAccountID: formData.emiratesIDAccountID,
        emiratesIDCurrencyID: formData.emiratesIDCurrencyID,
        emiratesIDFile: selectedFile || undefined
      });

      Swal.fire('Success', 'Emirates ID set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Emirates ID update error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to set Emirates ID', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-id-card"></i> Emirates ID</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Emirates ID Cost <span className="text-danger">*</span></label>
                <input
                  type="number"
                  className={`form-control ${errors.emiratesIDCost ? 'is-invalid' : ''}`}
                  value={formData.emiratesIDCost}
                  onChange={(e) => setFormData({ ...formData, emiratesIDCost: e.target.value })}
                />
                {errors.emiratesIDCost && <div className="invalid-feedback">{errors.emiratesIDCost}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Account <span className="text-danger">*</span></label>
                <div className={errors.emiratesIDAccountID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={accounts && accounts.length > 0 ? accounts.map((account) => ({
                      value: account.account_ID.toString(),
                      label: account.account_Name
                    })) : []}
                    value={formData.emiratesIDAccountID}
                    onChange={(value) => setFormData({ ...formData, emiratesIDAccountID: value })}
                    placeholder="Select Account"
                  />
                </div>
                {errors.emiratesIDAccountID && <div className="invalid-feedback">{errors.emiratesIDAccountID}</div>}
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <div className={errors.emiratesIDCurrencyID ? 'is-invalid' : ''}>
                  <SearchableSelect
                    options={currencies && currencies.length > 0 ? currencies.map((currency) => ({
                      value: currency.currencyID.toString(),
                      label: currency.currencyName
                    })) : []}
                    value={formData.emiratesIDCurrencyID}
                    onChange={(value) => setFormData({ ...formData, emiratesIDCurrencyID: value })}
                    placeholder="Select Currency"
                  />
                </div>
                {errors.emiratesIDCurrencyID && <div className="invalid-feedback">{errors.emiratesIDCurrencyID}</div>}
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Emirates ID File</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Visa Stamping Modal
export function FreezoneVisaStampingModal({ isOpen, onClose, residenceId, onSuccess }: Omit<BaseModalProps, 'companies' | 'positions' | 'accounts' | 'suppliers'>) {
  const [formData, setFormData] = useState({
    emiratesIDNumber: '',
    visaExpiryDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId) {
      setFormData({
        emiratesIDNumber: '',
        visaExpiryDate: ''
      });
      setErrors({});
    }
  }, [isOpen, residenceId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.emiratesIDNumber) newErrors.emiratesIDNumber = 'Emirates ID Number is required';
    if (!formData.visaExpiryDate) newErrors.visaExpiryDate = 'Visa Expiry Date is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await freezoneService.setVisaStamping(residenceId, {
        emiratesIDNumber: formData.emiratesIDNumber,
        visaExpiryDate: formData.visaExpiryDate
      });

      Swal.fire('Success', 'Visa stamping set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Visa stamping error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to set visa stamping', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fas fa-stamp"></i> Visa Stamping</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-6 mb-3">
                <label className="form-label">Emirates ID Number <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className={`form-control ${errors.emiratesIDNumber ? 'is-invalid' : ''}`}
                  value={formData.emiratesIDNumber}
                  onChange={(e) => setFormData({ ...formData, emiratesIDNumber: e.target.value })}
                />
                {errors.emiratesIDNumber && <div className="invalid-feedback">{errors.emiratesIDNumber}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Visa Expiry Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  className={`form-control ${errors.visaExpiryDate ? 'is-invalid' : ''}`}
                  value={formData.visaExpiryDate}
                  onChange={(e) => setFormData({ ...formData, visaExpiryDate: e.target.value })}
                />
                {errors.visaExpiryDate && <div className="invalid-feedback">{errors.visaExpiryDate}</div>}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

