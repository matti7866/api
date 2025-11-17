import { useState, useEffect } from 'react';
import { FormField } from '../form';
import type { Visa, Supplier, Country, Nationality, Currency } from '../../types/visa';
import './Modal.css';

interface EditVisaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (visaId: number, data: Partial<Visa>) => Promise<void>;
  visa: Visa;
  suppliers: Supplier[];
  countries: Country[];
  nationalities: Nationality[];
  currencies: Currency[];
}

export default function EditVisaModal({
  isOpen,
  onClose,
  onSubmit,
  visa,
  suppliers,
  countries,
  nationalities,
  currencies
}: EditVisaModalProps) {
  const [formData, setFormData] = useState<Partial<Visa>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && visa) {
      setFormData({
        passenger_name: visa.passenger_name,
        PassportNum: visa.PassportNum || '',
        nationalityID: visa.nationalityID,
        address: visa.address,
        gaurantee: visa.gaurantee,
        country_id: visa.country_id,
        supp_id: visa.supp_id,
        net_price: visa.net_price,
        netCurrencyID: visa.netCurrencyID,
        sale: visa.sale,
        saleCurrencyID: visa.saleCurrencyID,
        pendingvisa: visa.pendingvisa || 1
      });
    }
  }, [isOpen, visa]);

  const handleChange = (field: keyof Visa, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(visa.visa_id, formData);
      onClose();
    } catch (error) {
      console.error('Failed to update visa:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header edit-header">
          <h3><i className="fa fa-edit me-2"></i>Edit Visa</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-2">Editing visa for: <strong>{visa.passenger_name}</strong> (Visa #{visa.visa_id})</p>

            {/* Passenger Info */}
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Passenger Name"
                  name="passenger_name"
                  value={formData.passenger_name || ''}
                  onChange={(value) => handleChange('passenger_name', value)}
                  required
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Passport Number"
                  name="PassportNum"
                  value={formData.PassportNum || ''}
                  onChange={(value) => handleChange('PassportNum', value)}
                />
              </div>
            </div>

            {/* Nationality & Address */}
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Nationality"
                  name="nationalityID"
                  type="select"
                  value={formData.nationalityID || 0}
                  onChange={(value) => handleChange('nationalityID', parseInt(value))}
                  options={nationalities.map(n => ({
                    value: n.nationalityID,
                    label: n.nationality
                  }))}
                  required
                  searchable
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Address"
                  name="address"
                  value={formData.address || ''}
                  onChange={(value) => handleChange('address', value)}
                  required
                />
              </div>
            </div>

            {/* Guarantee Person */}
            <div className="row g-2 mb-2">
              <div className="col-md-12">
                <FormField
                  label="Guarantee Person"
                  name="gaurantee"
                  value={formData.gaurantee || ''}
                  onChange={(value) => handleChange('gaurantee', value)}
                  required
                />
              </div>
            </div>

            {/* Country & Supplier */}
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Country & Visa Type"
                  name="country_id"
                  type="select"
                  value={formData.country_id || 0}
                  onChange={(value) => handleChange('country_id', parseInt(value))}
                  options={countries.map(c => ({
                    value: c.country_id,
                    label: c.country_names
                  }))}
                  required
                  searchable
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Supplier"
                  name="supp_id"
                  type="select"
                  value={formData.supp_id || 0}
                  onChange={(value) => handleChange('supp_id', parseInt(value))}
                  options={suppliers.map(s => ({
                    value: s.supp_id,
                    label: s.supp_name
                  }))}
                  required
                  searchable
                />
              </div>
            </div>

            {/* Pricing - Net */}
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Net Price"
                  name="net_price"
                  type="number"
                  value={formData.net_price || 0}
                  onChange={(value) => handleChange('net_price', parseFloat(value))}
                  required
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Net Currency"
                  name="netCurrencyID"
                  type="select"
                  value={formData.netCurrencyID || 1}
                  onChange={(value) => handleChange('netCurrencyID', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                />
              </div>
            </div>

            {/* Pricing - Sale */}
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Sale Price"
                  name="sale"
                  type="number"
                  value={formData.sale || 0}
                  onChange={(value) => handleChange('sale', parseFloat(value))}
                  required
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Sale Currency"
                  name="saleCurrencyID"
                  type="select"
                  value={formData.saleCurrencyID || 1}
                  onChange={(value) => handleChange('saleCurrencyID', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Updating...
                </>
              ) : (
                <>
                  <i className="fa fa-save me-2"></i>
                  Update Visa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}














