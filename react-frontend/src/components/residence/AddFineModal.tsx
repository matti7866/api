import { useState, useEffect } from 'react';
import type { Residence } from '../../types/residence';
import Swal from 'sweetalert2';
import '../modals/Modal.css';

interface FineRecord {
  residenceFineID: number;
  fineAmount: number;
  currencyName: string;
  account_Name: string;
  residenceFineDate: string;
  staff_name: string;
  docName: string | null;
  residenceID: number;
  accountID?: number;
  currencyID?: number;
}

interface AddFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { residenceFineID?: number; fineAmount: number; accountID: number; currencyID?: number }) => Promise<void>;
  residence: Residence;
  accounts: Array<{ accountID: number; accountName: string }>;
  currencies: Array<{ currencyID: number; currencyName: string }>;
  fineRecord?: FineRecord | null;
  mode?: 'add' | 'edit';
}

export default function AddFineModal({
  isOpen,
  onClose,
  onSubmit,
  residence,
  accounts,
  currencies,
  fineRecord,
  mode = 'add'
}: AddFineModalProps) {
  const [formData, setFormData] = useState({
    fineAmount: '',
    accountID: '',
    currencyID: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && fineRecord) {
        setFormData({
          fineAmount: fineRecord.fineAmount.toString(),
          accountID: fineRecord.accountID?.toString() || '',
          currencyID: fineRecord.currencyID?.toString() || ''
        });
      } else {
        setFormData({
          fineAmount: '',
          accountID: '',
          currencyID: ''
        });
      }
      setErrors({});
    }
  }, [isOpen, mode, fineRecord]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!formData.fineAmount || parseFloat(formData.fineAmount) <= 0) {
      newErrors.fineAmount = 'Fine amount is required and must be greater than 0';
    }
    if (!formData.accountID) {
      newErrors.accountID = 'Account is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const submitData: any = {
        fineAmount: parseFloat(formData.fineAmount),
        accountID: parseInt(formData.accountID)
      };

      if (formData.currencyID) {
        submitData.currencyID = parseInt(formData.currencyID);
      }

      if (mode === 'edit' && fineRecord) {
        submitData.residenceFineID = fineRecord.residenceFineID;
      } else {
        submitData.residenceID = residence.residenceID;
      }

      await onSubmit(submitData);
      onClose();
    } catch (error: any) {
      // Error is handled by parent component
      console.error('Error submitting fine:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h3>
            <i className="fa fa-money-bill me-2"></i>
            {mode === 'edit' ? 'Edit Fine' : 'Add New Fine'}
          </h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">
                Residence <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={`${residence.passenger_name} (${residence.passportNumber})`}
                disabled
              />
            </div>

            <div className="mb-3">
              <label className="form-label">
                Fine Amount <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={`form-control ${errors.fineAmount ? 'is-invalid' : ''}`}
                value={formData.fineAmount}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, fineAmount: e.target.value }));
                  setErrors(prev => ({ ...prev, fineAmount: '' }));
                }}
                required
              />
              {errors.fineAmount && <div className="invalid-feedback">{errors.fineAmount}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label">
                Account <span className="text-danger">*</span>
              </label>
              <select
                className={`form-select ${errors.accountID ? 'is-invalid' : ''}`}
                value={formData.accountID}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, accountID: e.target.value }));
                  setErrors(prev => ({ ...prev, accountID: '' }));
                }}
                required
              >
                <option value="">Select Account</option>
                {accounts.map((account) => (
                  <option key={account.accountID} value={account.accountID}>
                    {account.accountName}
                  </option>
                ))}
              </select>
              {errors.accountID && <div className="invalid-feedback">{errors.accountID}</div>}
            </div>

            <div className="mb-3">
              <label className="form-label">Currency (Optional)</label>
              <select
                className="form-select"
                value={formData.currencyID}
                onChange={(e) => setFormData(prev => ({ ...prev, currencyID: e.target.value }))}
              >
                <option value="">Select Currency</option>
                {currencies.map((currency) => (
                  <option key={currency.currencyID} value={currency.currencyID}>
                    {currency.currencyName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <i className="fa fa-spinner fa-spin me-2"></i>
                  {mode === 'edit' ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                <>
                  <i className="fa fa-check me-2"></i>
                  {mode === 'edit' ? 'Update Fine' : 'Add Fine'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




