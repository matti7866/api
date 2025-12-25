import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import residenceService from '../../../services/residenceService';
import '../../modals/Modal.css';

interface BaseStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  residenceId: number | null;
  onSuccess: () => void;
  currencies: Array<{ currencyID: number; currencyName: string }>;
  accounts: Array<{ account_ID: number; account_Name: string }>;
  suppliers: Array<{ supp_id: number; supp_name: string }>;
  isFamily?: boolean; // Add isFamily prop
}

// Insurance Modal
export function InsuranceModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers }: BaseStepModalProps) {
  const [formData, setFormData] = useState({
    insuranceCost: '145',
    insuranceCurrency: '',
    insuranceChargeOn: '1',
    insuranceChargeAccount: '',
    insuranceChargeSupplier: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData({
        insuranceCost: '145',
        insuranceCurrency: currencies[0].currencyID.toString(),
        insuranceChargeOn: '1',
        insuranceChargeAccount: '',
        insuranceChargeSupplier: ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.insuranceCost) newErrors.insuranceCost = 'Insurance Cost is required';
    if (!formData.insuranceCurrency) newErrors.insuranceCurrency = 'Currency is required';
    if (!formData.insuranceChargeOn) newErrors.insuranceChargeOn = 'Charge On is required';
    if (formData.insuranceChargeOn === '1' && !formData.insuranceChargeAccount) {
      newErrors.insuranceChargeAccount = 'Charge Account is required';
    }
    if (formData.insuranceChargeOn === '2' && !formData.insuranceChargeSupplier) {
      newErrors.insuranceChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await residenceService.updateStep(residenceId, {
        step: 2,
        markComplete: true,
        insuranceCost: formData.insuranceCost,
        insuranceCur: formData.insuranceCurrency,
        insuranceChargOpt: formData.insuranceChargeOn,
        insuranceChargedEntity: formData.insuranceChargeOn === '1' ? formData.insuranceChargeAccount : formData.insuranceChargeSupplier,
        files: selectedFile ? { insuranceFile: selectedFile } : {}
      });

      Swal.fire('Success', 'Insurance set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Insurance update error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to set insurance', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-shield"></i> Insurance</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Insurance Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="insuranceCost"
                  className={`form-control ${errors.insuranceCost ? 'is-invalid' : ''}`}
                  value={formData.insuranceCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, insuranceCost: e.target.value })); setErrors(prev => ({ ...prev, insuranceCost: '' })); }}
                />
                {errors.insuranceCost && <div className="invalid-feedback">{errors.insuranceCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="insuranceCurrency"
                  className={`form-select ${errors.insuranceCurrency ? 'is-invalid' : ''}`}
                  value={formData.insuranceCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, insuranceCurrency: e.target.value })); setErrors(prev => ({ ...prev, insuranceCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.insuranceCurrency && <div className="invalid-feedback">{errors.insuranceCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="insuranceChargeOn"
                  className={`form-select ${errors.insuranceChargeOn ? 'is-invalid' : ''}`}
                  value={formData.insuranceChargeOn}
                  onChange={(e) => { setFormData(prev => ({ ...prev, insuranceChargeOn: e.target.value })); setErrors(prev => ({ ...prev, insuranceChargeOn: '' })); }}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
                {errors.insuranceChargeOn && <div className="invalid-feedback">{errors.insuranceChargeOn}</div>}
              </div>
              {formData.insuranceChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="insuranceChargeAccount"
                    className={`form-select ${errors.insuranceChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.insuranceChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, insuranceChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, insuranceChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.insuranceChargeAccount && <div className="invalid-feedback">{errors.insuranceChargeAccount}</div>}
                </div>
              )}
              {formData.insuranceChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="insuranceChargeSupplier"
                    className={`form-select ${errors.insuranceChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.insuranceChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, insuranceChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, insuranceChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.insuranceChargeSupplier && <div className="invalid-feedback">{errors.insuranceChargeSupplier}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">Insurance File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Labour Card Modal
export function LabourCardModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers }: BaseStepModalProps & { labourCardNumber?: string }) {
  const [formData, setFormData] = useState({
    labourCardNumber: '',
    labourCardCost: '1210',
    labourCardCurrency: '',
    labourCardChargeOn: '1',
    labourCardChargeAccount: '',
    labourCardChargeSupplier: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData(prev => ({
        ...prev,
        labourCardCurrency: currencies[0].currencyID.toString(),
        labourCardNumber: (onSuccess as any)?.labourCardNumber || ''
      }));
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.labourCardNumber) newErrors.labourCardNumber = 'Labour Card Number is required';
    if (!formData.labourCardCost) newErrors.labourCardCost = 'Labour Card Cost is required';
    if (!formData.labourCardCurrency) newErrors.labourCardCurrency = 'Currency is required';
    if (!formData.labourCardChargeOn) newErrors.labourCardChargeOn = 'Charge On is required';
    if (formData.labourCardChargeOn === '1' && !formData.labourCardChargeAccount) {
      newErrors.labourCardChargeAccount = 'Charge Account is required';
    }
    if (formData.labourCardChargeOn === '2' && !formData.labourCardChargeSupplier) {
      newErrors.labourCardChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await residenceService.updateStep(residenceId, {
        step: 3,
        markComplete: true,
        labor_card_id: formData.labourCardNumber,
        labour_card_fee: formData.labourCardCost,
        laborCardCur: formData.labourCardCurrency,
        lrbChargOpt: formData.labourCardChargeOn,
        lbrChargedEntity: formData.labourCardChargeOn === '1' ? formData.labourCardChargeAccount : formData.labourCardChargeSupplier,
        files: selectedFile ? { laborCardFile: selectedFile } : {}
      });

      Swal.fire('Success', 'Labour card set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to set labour card', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-credit-card"></i> Labour Card</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Labour Card Number <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="labourCardNumber"
                  className={`form-control ${errors.labourCardNumber ? 'is-invalid' : ''}`}
                  value={formData.labourCardNumber}
                  onChange={(e) => { setFormData(prev => ({ ...prev, labourCardNumber: e.target.value })); setErrors(prev => ({ ...prev, labourCardNumber: '' })); }}
                />
                {errors.labourCardNumber && <div className="invalid-feedback">{errors.labourCardNumber}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Labour Card Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="labourCardCost"
                  className={`form-control ${errors.labourCardCost ? 'is-invalid' : ''}`}
                  value={formData.labourCardCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, labourCardCost: e.target.value })); setErrors(prev => ({ ...prev, labourCardCost: '' })); }}
                />
                {errors.labourCardCost && <div className="invalid-feedback">{errors.labourCardCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="labourCardCurrency"
                  className={`form-select ${errors.labourCardCurrency ? 'is-invalid' : ''}`}
                  value={formData.labourCardCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, labourCardCurrency: e.target.value })); setErrors(prev => ({ ...prev, labourCardCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.labourCardCurrency && <div className="invalid-feedback">{errors.labourCardCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="labourCardChargeOn"
                  className={`form-select ${errors.labourCardChargeOn ? 'is-invalid' : ''}`}
                  value={formData.labourCardChargeOn}
                  onChange={(e) => { setFormData(prev => ({ ...prev, labourCardChargeOn: e.target.value })); setErrors(prev => ({ ...prev, labourCardChargeOn: '' })); }}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
                {errors.labourCardChargeOn && <div className="invalid-feedback">{errors.labourCardChargeOn}</div>}
              </div>
              {formData.labourCardChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="labourCardChargeAccount"
                    className={`form-select ${errors.labourCardChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.labourCardChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, labourCardChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, labourCardChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.labourCardChargeAccount && <div className="invalid-feedback">{errors.labourCardChargeAccount}</div>}
                </div>
              )}
              {formData.labourCardChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="labourCardChargeSupplier"
                    className={`form-select ${errors.labourCardChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.labourCardChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, labourCardChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, labourCardChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.labourCardChargeSupplier && <div className="invalid-feedback">{errors.labourCardChargeSupplier}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">Labour Card File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// E-Visa Modal (Step 4 for residence, Step 1 for family)
export function EVisaModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers, isFamily = false }: BaseStepModalProps) {
  const [formData, setFormData] = useState({
    eVisaCost: '500',
    eVisaCurrency: '',
    eVisaChargeOn: '1',
    eVisaChargeAccount: '',
    eVisaChargeSupplier: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData({
        eVisaCost: '500',
        eVisaCurrency: currencies[0].currencyID.toString(),
        eVisaChargeOn: '1',
        eVisaChargeAccount: '',
        eVisaChargeSupplier: ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.eVisaCost) newErrors.eVisaCost = 'E-Visa Cost is required';
    if (!formData.eVisaCurrency) newErrors.eVisaCurrency = 'Currency is required';
    if (formData.eVisaChargeOn === '1' && !formData.eVisaChargeAccount) {
      newErrors.eVisaChargeAccount = 'Charge Account is required';
    }
    if (formData.eVisaChargeOn === '2' && !formData.eVisaChargeSupplier) {
      newErrors.eVisaChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (isFamily) {
        // For family residence, use simpler update
        await residenceService.updateFamilyStep(residenceId, {
          step: 1, // E-Visa is step 1 for family
          cost: parseFloat(formData.eVisaCost),
          account: formData.eVisaChargeOn === '1' ? parseInt(formData.eVisaChargeAccount) : null
        });
      } else {
        await residenceService.updateStep(residenceId, {
          step: 4,
          markComplete: true,
          eVisaCost: formData.eVisaCost,
          eVisaCur: formData.eVisaCurrency,
          eVisaChargOpt: formData.eVisaChargeOn,
          eVisaChargedEntity: formData.eVisaChargeOn === '1' ? formData.eVisaChargeAccount : formData.eVisaChargeSupplier,
          files: selectedFile ? { eVisaFile: selectedFile } : {}
        });
      }

      Swal.fire('Success', 'E-Visa set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to set E-Visa', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-ticket"></i> E-Visa</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">E-Visa Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="eVisaCost"
                  className={`form-control ${errors.eVisaCost ? 'is-invalid' : ''}`}
                  value={formData.eVisaCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, eVisaCost: e.target.value })); setErrors(prev => ({ ...prev, eVisaCost: '' })); }}
                />
                {errors.eVisaCost && <div className="invalid-feedback">{errors.eVisaCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="eVisaCurrency"
                  className={`form-select ${errors.eVisaCurrency ? 'is-invalid' : ''}`}
                  value={formData.eVisaCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, eVisaCurrency: e.target.value })); setErrors(prev => ({ ...prev, eVisaCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.eVisaCurrency && <div className="invalid-feedback">{errors.eVisaCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="eVisaChargeOn"
                  className="form-select"
                  value={formData.eVisaChargeOn}
                  onChange={(e) => setFormData(prev => ({ ...prev, eVisaChargeOn: e.target.value }))}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
              </div>
              {formData.eVisaChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="eVisaChargeAccount"
                    className={`form-select ${errors.eVisaChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.eVisaChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, eVisaChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, eVisaChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.eVisaChargeAccount && <div className="invalid-feedback">{errors.eVisaChargeAccount}</div>}
                </div>
              )}
              {formData.eVisaChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="eVisaChargeSupplier"
                    className={`form-select ${errors.eVisaChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.eVisaChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, eVisaChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, eVisaChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.eVisaChargeSupplier && <div className="invalid-feedback">{errors.eVisaChargeSupplier}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">E-Visa File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Change Status Modal (Step 5 for residence, Step 2 for family)
export function ChangeStatusModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers, isFamily = false }: BaseStepModalProps) {
  const [formData, setFormData] = useState({
    changeStatusCost: '300',
    changeStatusCurrency: '',
    changeStatusChargeOn: '1',
    changeStatusChargeAccount: '',
    changeStatusChargeSupplier: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData({
        changeStatusCost: '300',
        changeStatusCurrency: currencies[0].currencyID.toString(),
        changeStatusChargeOn: '1',
        changeStatusChargeAccount: '',
        changeStatusChargeSupplier: ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.changeStatusCost) newErrors.changeStatusCost = 'Change Status Cost is required';
    if (!formData.changeStatusCurrency) newErrors.changeStatusCurrency = 'Currency is required';
    if (formData.changeStatusChargeOn === '1' && !formData.changeStatusChargeAccount) {
      newErrors.changeStatusChargeAccount = 'Charge Account is required';
    }
    if (formData.changeStatusChargeOn === '2' && !formData.changeStatusChargeSupplier) {
      newErrors.changeStatusChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (isFamily) {
        await residenceService.updateFamilyStep(residenceId, {
          step: 2, // Change Status is step 2 for family
          cost: parseFloat(formData.changeStatusCost),
          account: formData.changeStatusChargeOn === '1' ? parseInt(formData.changeStatusChargeAccount) : null
        });
      } else {
        await residenceService.updateStep(residenceId, {
          step: 5,
          markComplete: true,
          changeStatusCost: formData.changeStatusCost,
          changeStatusCur: formData.changeStatusCurrency,
          changeStatusChargOpt: formData.changeStatusChargeOn,
          changeStatusChargedEntity: formData.changeStatusChargeOn === '1' ? formData.changeStatusChargeAccount : formData.changeStatusChargeSupplier,
          files: selectedFile ? { changeStatusFile: selectedFile } : {}
        });
      }

      Swal.fire('Success', 'Change Status set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to set Change Status', 'error');
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
                  type="text"
                  name="changeStatusCost"
                  className={`form-control ${errors.changeStatusCost ? 'is-invalid' : ''}`}
                  value={formData.changeStatusCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, changeStatusCost: e.target.value })); setErrors(prev => ({ ...prev, changeStatusCost: '' })); }}
                />
                {errors.changeStatusCost && <div className="invalid-feedback">{errors.changeStatusCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="changeStatusCurrency"
                  className={`form-select ${errors.changeStatusCurrency ? 'is-invalid' : ''}`}
                  value={formData.changeStatusCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, changeStatusCurrency: e.target.value })); setErrors(prev => ({ ...prev, changeStatusCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.changeStatusCurrency && <div className="invalid-feedback">{errors.changeStatusCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="changeStatusChargeOn"
                  className="form-select"
                  value={formData.changeStatusChargeOn}
                  onChange={(e) => setFormData(prev => ({ ...prev, changeStatusChargeOn: e.target.value }))}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
              </div>
              {formData.changeStatusChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="changeStatusChargeAccount"
                    className={`form-select ${errors.changeStatusChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.changeStatusChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, changeStatusChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, changeStatusChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.changeStatusChargeAccount && <div className="invalid-feedback">{errors.changeStatusChargeAccount}</div>}
                </div>
              )}
              {formData.changeStatusChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="changeStatusChargeSupplier"
                    className={`form-select ${errors.changeStatusChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.changeStatusChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, changeStatusChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, changeStatusChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.changeStatusChargeSupplier && <div className="invalid-feedback">{errors.changeStatusChargeSupplier}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">Change Status File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Medical Modal (Step 6 for residence, Step 3 for family)
export function MedicalModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers, isFamily = false }: BaseStepModalProps) {
  const [formData, setFormData] = useState({
    medicalCost: '200',
    medicalCurrency: '',
    medicalChargeOn: '1',
    medicalChargeAccount: '',
    medicalChargeSupplier: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData({
        medicalCost: '200',
        medicalCurrency: currencies[0].currencyID.toString(),
        medicalChargeOn: '1',
        medicalChargeAccount: '',
        medicalChargeSupplier: ''
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
    if (!formData.medicalCurrency) newErrors.medicalCurrency = 'Currency is required';
    if (formData.medicalChargeOn === '1' && !formData.medicalChargeAccount) {
      newErrors.medicalChargeAccount = 'Charge Account is required';
    }
    if (formData.medicalChargeOn === '2' && !formData.medicalChargeSupplier) {
      newErrors.medicalChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (isFamily) {
        await residenceService.updateFamilyStep(residenceId, {
          step: 3, // Medical is step 3 for family
          cost: parseFloat(formData.medicalCost),
          account: formData.medicalChargeOn === '1' ? parseInt(formData.medicalChargeAccount) : null
        });
      } else {
        await residenceService.updateStep(residenceId, {
          step: 6,
          markComplete: true,
          medicalCost: formData.medicalCost,
          medicalCur: formData.medicalCurrency,
          medicalChargOpt: formData.medicalChargeOn,
          medicalChargedEntity: formData.medicalChargeOn === '1' ? formData.medicalChargeAccount : formData.medicalChargeSupplier,
          files: selectedFile ? { medicalFile: selectedFile } : {}
        });
      }

      Swal.fire('Success', 'Medical set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to set Medical', 'error');
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
                  type="text"
                  name="medicalCost"
                  className={`form-control ${errors.medicalCost ? 'is-invalid' : ''}`}
                  value={formData.medicalCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, medicalCost: e.target.value })); setErrors(prev => ({ ...prev, medicalCost: '' })); }}
                />
                {errors.medicalCost && <div className="invalid-feedback">{errors.medicalCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="medicalCurrency"
                  className={`form-select ${errors.medicalCurrency ? 'is-invalid' : ''}`}
                  value={formData.medicalCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, medicalCurrency: e.target.value })); setErrors(prev => ({ ...prev, medicalCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.medicalCurrency && <div className="invalid-feedback">{errors.medicalCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="medicalChargeOn"
                  className="form-select"
                  value={formData.medicalChargeOn}
                  onChange={(e) => setFormData(prev => ({ ...prev, medicalChargeOn: e.target.value }))}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
              </div>
              {formData.medicalChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="medicalChargeAccount"
                    className={`form-select ${errors.medicalChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.medicalChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, medicalChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, medicalChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.medicalChargeAccount && <div className="invalid-feedback">{errors.medicalChargeAccount}</div>}
                </div>
              )}
              {formData.medicalChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="medicalChargeSupplier"
                    className={`form-select ${errors.medicalChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.medicalChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, medicalChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, medicalChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.medicalChargeSupplier && <div className="invalid-feedback">{errors.medicalChargeSupplier}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">Medical File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Emirates ID Modal (Step 7)
export function EmiratesIDModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers, isFamily = false }: BaseStepModalProps) {
  const [formData, setFormData] = useState({
    emiratesIDCost: '250',
    emiratesIDCurrency: '',
    emiratesIDChargeOn: '1',
    emiratesIDChargeAccount: '',
    emiratesIDChargeSupplier: '',
    emiratesIDNumber: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData({
        emiratesIDCost: '250',
        emiratesIDCurrency: currencies[0].currencyID.toString(),
        emiratesIDChargeOn: '1',
        emiratesIDChargeAccount: '',
        emiratesIDChargeSupplier: '',
        emiratesIDNumber: ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.emiratesIDNumber) newErrors.emiratesIDNumber = 'Emirates ID Number is required';
    if (!formData.emiratesIDCost) newErrors.emiratesIDCost = 'Emirates ID Cost is required';
    if (!formData.emiratesIDCurrency) newErrors.emiratesIDCurrency = 'Currency is required';
    if (formData.emiratesIDChargeOn === '1' && !formData.emiratesIDChargeAccount) {
      newErrors.emiratesIDChargeAccount = 'Charge Account is required';
    }
    if (formData.emiratesIDChargeOn === '2' && !formData.emiratesIDChargeSupplier) {
      newErrors.emiratesIDChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (isFamily) {
        await residenceService.updateFamilyStep(residenceId, {
          step: 4, // Emirates ID is step 4 for family
          cost: parseFloat(formData.emiratesIDCost),
          account: formData.emiratesIDChargeOn === '1' ? parseInt(formData.emiratesIDChargeAccount) : null
        });
      } else {
        await residenceService.updateStep(residenceId, {
          step: 7,
          markComplete: true,
          emiratesIDNumber: formData.emiratesIDNumber,
          emiratesIDCost: formData.emiratesIDCost,
          emiratesIDCur: formData.emiratesIDCurrency,
          emiratesIDChargOpt: formData.emiratesIDChargeOn,
          emiratesIDChargedEntity: formData.emiratesIDChargeOn === '1' ? formData.emiratesIDChargeAccount : formData.emiratesIDChargeSupplier,
          files: selectedFile ? { emiratesIDFile: selectedFile } : {}
        });
      }

      Swal.fire('Success', 'Emirates ID set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
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
              <div className="col-md-12 mb-3">
                <label className="form-label">Emirates ID Number <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="emiratesIDNumber"
                  className={`form-control ${errors.emiratesIDNumber ? 'is-invalid' : ''}`}
                  value={formData.emiratesIDNumber}
                  onChange={(e) => { setFormData(prev => ({ ...prev, emiratesIDNumber: e.target.value })); setErrors(prev => ({ ...prev, emiratesIDNumber: '' })); }}
                  placeholder="784-XXXX-XXXXXXX-X"
                />
                {errors.emiratesIDNumber && <div className="invalid-feedback">{errors.emiratesIDNumber}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Emirates ID Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="emiratesIDCost"
                  className={`form-control ${errors.emiratesIDCost ? 'is-invalid' : ''}`}
                  value={formData.emiratesIDCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, emiratesIDCost: e.target.value })); setErrors(prev => ({ ...prev, emiratesIDCost: '' })); }}
                />
                {errors.emiratesIDCost && <div className="invalid-feedback">{errors.emiratesIDCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="emiratesIDCurrency"
                  className={`form-select ${errors.emiratesIDCurrency ? 'is-invalid' : ''}`}
                  value={formData.emiratesIDCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, emiratesIDCurrency: e.target.value })); setErrors(prev => ({ ...prev, emiratesIDCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.emiratesIDCurrency && <div className="invalid-feedback">{errors.emiratesIDCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="emiratesIDChargeOn"
                  className="form-select"
                  value={formData.emiratesIDChargeOn}
                  onChange={(e) => setFormData(prev => ({ ...prev, emiratesIDChargeOn: e.target.value }))}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
              </div>
              {formData.emiratesIDChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="emiratesIDChargeAccount"
                    className={`form-select ${errors.emiratesIDChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.emiratesIDChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, emiratesIDChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, emiratesIDChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.emiratesIDChargeAccount && <div className="invalid-feedback">{errors.emiratesIDChargeAccount}</div>}
                </div>
              )}
              {formData.emiratesIDChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="emiratesIDChargeSupplier"
                    className={`form-select ${errors.emiratesIDChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.emiratesIDChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, emiratesIDChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, emiratesIDChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.emiratesIDChargeSupplier && <div className="invalid-feedback">{errors.emiratesIDChargeSupplier}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">Emirates ID File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Visa Stamping Modal (Step 8 for residence, Step 5 for family)
export function VisaStampingModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers, isFamily = false }: BaseStepModalProps) {
  const [formData, setFormData] = useState({
    visaStampingCost: '150',
    visaStampingCurrency: '',
    visaStampingChargeOn: '1',
    visaStampingChargeAccount: '',
    visaStampingChargeSupplier: '',
    visaStampingExpiry: '' // Add expiry for family
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData({
        visaStampingCost: '150',
        visaStampingCurrency: currencies[0].currencyID.toString(),
        visaStampingChargeOn: '1',
        visaStampingChargeAccount: '',
        visaStampingChargeSupplier: '',
        visaStampingExpiry: ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.visaStampingCost) newErrors.visaStampingCost = 'Visa Stamping Cost is required';
    if (!formData.visaStampingCurrency) newErrors.visaStampingCurrency = 'Currency is required';
    if (formData.visaStampingChargeOn === '1' && !formData.visaStampingChargeAccount) {
      newErrors.visaStampingChargeAccount = 'Charge Account is required';
    }
    if (formData.visaStampingChargeOn === '2' && !formData.visaStampingChargeSupplier) {
      newErrors.visaStampingChargeSupplier = 'Charge Supplier is required';
    }
    if (isFamily && !formData.visaStampingExpiry) {
      newErrors.visaStampingExpiry = 'Visa Expiry is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      if (isFamily) {
        await residenceService.updateFamilyStep(residenceId, {
          step: 5, // Visa Stamping is step 5 for family
          cost: parseFloat(formData.visaStampingCost),
          account: formData.visaStampingChargeOn === '1' ? parseInt(formData.visaStampingChargeAccount) : null,
          expiry: formData.visaStampingExpiry
        });
      } else {
        await residenceService.updateStep(residenceId, {
          step: 8,
          markComplete: true,
          visaStampingCost: formData.visaStampingCost,
          visaStampingCur: formData.visaStampingCurrency,
          visaStampingChargOpt: formData.visaStampingChargeOn,
          visaStampingChargedEntity: formData.visaStampingChargeOn === '1' ? formData.visaStampingChargeAccount : formData.visaStampingChargeSupplier,
          files: selectedFile ? { visaStampingFile: selectedFile } : {}
        });
      }

      Swal.fire('Success', 'Visa Stamping set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to set Visa Stamping', 'error');
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
              <div className="col-md-4 mb-3">
                <label className="form-label">Visa Stamping Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="visaStampingCost"
                  className={`form-control ${errors.visaStampingCost ? 'is-invalid' : ''}`}
                  value={formData.visaStampingCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, visaStampingCost: e.target.value })); setErrors(prev => ({ ...prev, visaStampingCost: '' })); }}
                />
                {errors.visaStampingCost && <div className="invalid-feedback">{errors.visaStampingCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="visaStampingCurrency"
                  className={`form-select ${errors.visaStampingCurrency ? 'is-invalid' : ''}`}
                  value={formData.visaStampingCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, visaStampingCurrency: e.target.value })); setErrors(prev => ({ ...prev, visaStampingCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.visaStampingCurrency && <div className="invalid-feedback">{errors.visaStampingCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="visaStampingChargeOn"
                  className="form-select"
                  value={formData.visaStampingChargeOn}
                  onChange={(e) => setFormData(prev => ({ ...prev, visaStampingChargeOn: e.target.value }))}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
              </div>
              {formData.visaStampingChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="visaStampingChargeAccount"
                    className={`form-select ${errors.visaStampingChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.visaStampingChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, visaStampingChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, visaStampingChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.visaStampingChargeAccount && <div className="invalid-feedback">{errors.visaStampingChargeAccount}</div>}
                </div>
              )}
              {formData.visaStampingChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="visaStampingChargeSupplier"
                    className={`form-select ${errors.visaStampingChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.visaStampingChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, visaStampingChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, visaStampingChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.visaStampingChargeSupplier && <div className="invalid-feedback">{errors.visaStampingChargeSupplier}</div>}
                </div>
              )}
              {isFamily && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Visa Expiry <span className="text-danger">*</span></label>
                  <input
                    type="date"
                    name="visaStampingExpiry"
                    className={`form-control ${errors.visaStampingExpiry ? 'is-invalid' : ''}`}
                    value={formData.visaStampingExpiry}
                    onChange={(e) => { setFormData(prev => ({ ...prev, visaStampingExpiry: e.target.value })); setErrors(prev => ({ ...prev, visaStampingExpiry: '' })); }}
                  />
                  {errors.visaStampingExpiry && <div className="invalid-feedback">{errors.visaStampingExpiry}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">Visa Stamping File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Contract Submission Modal (Step 9)
export function ContractSubmissionModal({ isOpen, onClose, residenceId, onSuccess, currencies, accounts, suppliers }: BaseStepModalProps) {
  const [formData, setFormData] = useState({
    contractSubmissionCost: '100',
    contractSubmissionCurrency: '',
    contractSubmissionChargeOn: '1',
    contractSubmissionChargeAccount: '',
    contractSubmissionChargeSupplier: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && residenceId && currencies.length > 0) {
      setFormData({
        contractSubmissionCost: '100',
        contractSubmissionCurrency: currencies[0].currencyID.toString(),
        contractSubmissionChargeOn: '1',
        contractSubmissionChargeAccount: '',
        contractSubmissionChargeSupplier: ''
      });
      setSelectedFile(null);
      setErrors({});
    }
  }, [isOpen, residenceId, currencies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!residenceId) return;

    const newErrors: Record<string, string> = {};
    if (!formData.contractSubmissionCost) newErrors.contractSubmissionCost = 'Contract Submission Cost is required';
    if (!formData.contractSubmissionCurrency) newErrors.contractSubmissionCurrency = 'Currency is required';
    if (formData.contractSubmissionChargeOn === '1' && !formData.contractSubmissionChargeAccount) {
      newErrors.contractSubmissionChargeAccount = 'Charge Account is required';
    }
    if (formData.contractSubmissionChargeOn === '2' && !formData.contractSubmissionChargeSupplier) {
      newErrors.contractSubmissionChargeSupplier = 'Charge Supplier is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      await residenceService.updateStep(residenceId, {
        step: 9,
        markComplete: true,
        contractSubmissionCost: formData.contractSubmissionCost,
        contractSubmissionCur: formData.contractSubmissionCurrency,
        contractSubmissionChargOpt: formData.contractSubmissionChargeOn,
        contractSubmissionChargedEntity: formData.contractSubmissionChargeOn === '1' ? formData.contractSubmissionChargeAccount : formData.contractSubmissionChargeSupplier,
        files: selectedFile ? { contractSubmissionFile: selectedFile } : {}
      });

      Swal.fire('Success', 'Contract Submission set successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to set Contract Submission', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fas fa-file-signature"></i> Contract Submission</h3>
          <button className="modal-close" onClick={onClose}><i className="fa fa-times"></i></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="row">
              <div className="col-md-4 mb-3">
                <label className="form-label">Contract Submission Cost <span className="text-danger">*</span></label>
                <input
                  type="text"
                  name="contractSubmissionCost"
                  className={`form-control ${errors.contractSubmissionCost ? 'is-invalid' : ''}`}
                  value={formData.contractSubmissionCost}
                  onChange={(e) => { setFormData(prev => ({ ...prev, contractSubmissionCost: e.target.value })); setErrors(prev => ({ ...prev, contractSubmissionCost: '' })); }}
                />
                {errors.contractSubmissionCost && <div className="invalid-feedback">{errors.contractSubmissionCost}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Currency <span className="text-danger">*</span></label>
                <select
                  name="contractSubmissionCurrency"
                  className={`form-select ${errors.contractSubmissionCurrency ? 'is-invalid' : ''}`}
                  value={formData.contractSubmissionCurrency}
                  onChange={(e) => { setFormData(prev => ({ ...prev, contractSubmissionCurrency: e.target.value })); setErrors(prev => ({ ...prev, contractSubmissionCurrency: '' })); }}
                >
                  <option value="">Select Currency</option>
                  {currencies.map((c) => <option key={c.currencyID} value={c.currencyID}>{c.currencyName}</option>)}
                </select>
                {errors.contractSubmissionCurrency && <div className="invalid-feedback">{errors.contractSubmissionCurrency}</div>}
              </div>
              <div className="col-md-4 mb-3">
                <label className="form-label">Charge On <span className="text-danger">*</span></label>
                <select
                  name="contractSubmissionChargeOn"
                  className="form-select"
                  value={formData.contractSubmissionChargeOn}
                  onChange={(e) => setFormData(prev => ({ ...prev, contractSubmissionChargeOn: e.target.value }))}
                >
                  <option value="1">Account</option>
                  <option value="2">Supplier</option>
                </select>
              </div>
              {formData.contractSubmissionChargeOn === '1' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Account <span className="text-danger">*</span></label>
                  <select
                    name="contractSubmissionChargeAccount"
                    className={`form-select ${errors.contractSubmissionChargeAccount ? 'is-invalid' : ''}`}
                    value={formData.contractSubmissionChargeAccount}
                    onChange={(e) => { setFormData(prev => ({ ...prev, contractSubmissionChargeAccount: e.target.value })); setErrors(prev => ({ ...prev, contractSubmissionChargeAccount: '' })); }}
                  >
                    <option value="">Select Account</option>
                    {accounts.map((a) => <option key={a.account_ID} value={a.account_ID}>{a.account_Name}</option>)}
                  </select>
                  {errors.contractSubmissionChargeAccount && <div className="invalid-feedback">{errors.contractSubmissionChargeAccount}</div>}
                </div>
              )}
              {formData.contractSubmissionChargeOn === '2' && (
                <div className="col-md-12 mb-3">
                  <label className="form-label">Charge Supplier <span className="text-danger">*</span></label>
                  <select
                    name="contractSubmissionChargeSupplier"
                    className={`form-select ${errors.contractSubmissionChargeSupplier ? 'is-invalid' : ''}`}
                    value={formData.contractSubmissionChargeSupplier}
                    onChange={(e) => { setFormData(prev => ({ ...prev, contractSubmissionChargeSupplier: e.target.value })); setErrors(prev => ({ ...prev, contractSubmissionChargeSupplier: '' })); }}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => <option key={s.supp_id} value={s.supp_id}>{s.supp_name}</option>)}
                  </select>
                  {errors.contractSubmissionChargeSupplier && <div className="invalid-feedback">{errors.contractSubmissionChargeSupplier}</div>}
                </div>
              )}
              <div className="col-md-12 mb-3">
                <label className="form-label">Contract Submission File</label>
                <input type="file" className="form-control" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <i className="fa fa-spinner fa-spin me-2"></i> : null}Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

