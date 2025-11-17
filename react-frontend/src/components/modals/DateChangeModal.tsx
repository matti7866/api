import { useState, useEffect } from 'react';
import { FormField } from '../form';
import type { Supplier, Currency } from '../../types/ticket';
import './Modal.css';

interface DateChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DateChangeData) => Promise<void>;
  ticketId: number;
  passengerName: string;
  currentDate: string;
  supplierId: number;
  netPrice: number;
  netCurrencyId: number;
  salePrice: number;
  saleCurrencyId: number;
  suppliers: Supplier[];
  currencies: Currency[];
}

export interface DateChangeData {
  extended_date: string;
  supplier_id: number;
  net_amount: number;
  net_currency_id: number;
  sale_amount: number;
  sale_currency_id: number;
  remarks: string;
  changedTicket?: File;
}

export default function DateChangeModal({
  isOpen,
  onClose,
  onSubmit,
  ticketId,
  passengerName,
  currentDate,
  supplierId,
  netPrice,
  netCurrencyId,
  salePrice,
  saleCurrencyId,
  suppliers,
  currencies
}: DateChangeModalProps) {
  const [formData, setFormData] = useState<DateChangeData>({
    extended_date: currentDate,
    supplier_id: supplierId,
    net_amount: netPrice,
    net_currency_id: netCurrencyId,
    sale_amount: salePrice,
    sale_currency_id: saleCurrencyId,
    remarks: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        extended_date: currentDate,
        supplier_id: supplierId,
        net_amount: netPrice,
        net_currency_id: netCurrencyId,
        sale_amount: salePrice,
        sale_currency_id: saleCurrencyId,
        remarks: ''
      });
      setSelectedFile(null);
    }
  }, [isOpen, currentDate, supplierId, netPrice, netCurrencyId, salePrice, saleCurrencyId]);

  const handleChange = (field: keyof DateChangeData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const submitData = {
        ...formData,
        changedTicket: selectedFile || undefined
      };
      await onSubmit(submitData);
      onClose();
    } catch (error) {
      console.error('Failed to save date change:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><i className="fa fa-calendar-alt me-2"></i>Date Change / Reissue</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-2">Passenger: <strong>{passengerName}</strong> (Ticket #{ticketId})</p>

            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Supplier"
                  name="supplier_id"
                  type="select"
                  value={formData.supplier_id}
                  onChange={(value) => handleChange('supplier_id', parseInt(value))}
                  options={suppliers.map(s => ({
                    value: s.supp_id,
                    label: s.supp_name
                  }))}
                  required
                  searchable
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Extended Date"
                  name="extended_date"
                  type="date"
                  value={formData.extended_date}
                  onChange={(value) => handleChange('extended_date', value)}
                  required
                />
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Net Price"
                  name="net_amount"
                  type="number"
                  value={formData.net_amount}
                  onChange={(value) => handleChange('net_amount', parseFloat(value))}
                  required
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Currency"
                  name="net_currency_id"
                  type="select"
                  value={formData.net_currency_id}
                  onChange={(value) => handleChange('net_currency_id', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                />
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Sale Price"
                  name="sale_amount"
                  type="number"
                  value={formData.sale_amount}
                  onChange={(value) => handleChange('sale_amount', parseFloat(value))}
                  required
                />
              </div>
              <div className="col-md-6">
                <FormField
                  label="Currency"
                  name="sale_currency_id"
                  type="select"
                  value={formData.sale_currency_id}
                  onChange={(value) => handleChange('sale_currency_id', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                />
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-12">
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Enter remarks..."
                />
              </div>
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-12">
                <label className="form-label">Changed Ticket Copy (Optional)</label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <small className="text-muted">Selected: {selectedFile.name}</small>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Close
            </button>
            <button type="submit" className="btn btn-warning" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa fa-save me-2"></i>
                  Save Date Change
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

