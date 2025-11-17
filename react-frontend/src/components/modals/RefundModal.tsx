import { useState, useEffect } from 'react';
import { FormField } from '../form';
import type { Currency } from '../../types/ticket';
import './Modal.css';

interface RefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RefundData) => Promise<void>;
  ticketId: number;
  passengerName: string;
  netPrice: number;
  netCurrencyId: number;
  salePrice: number;
  saleCurrencyId: number;
  currencies: Currency[];
}

export interface RefundData {
  refund_net_amount: number;
  net_currency_id: number;
  refund_sale_amount: number;
  sale_currency_id: number;
  remarks: string;
}

export default function RefundModal({
  isOpen,
  onClose,
  onSubmit,
  ticketId,
  passengerName,
  netPrice,
  netCurrencyId,
  salePrice,
  saleCurrencyId,
  currencies
}: RefundModalProps) {
  const [formData, setFormData] = useState<RefundData>({
    refund_net_amount: netPrice,
    net_currency_id: netCurrencyId,
    refund_sale_amount: salePrice,
    sale_currency_id: saleCurrencyId,
    remarks: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        refund_net_amount: netPrice,
        net_currency_id: netCurrencyId,
        refund_sale_amount: salePrice,
        sale_currency_id: saleCurrencyId,
        remarks: ''
      });
    }
  }, [isOpen, netPrice, netCurrencyId, salePrice, saleCurrencyId]);

  const handleChange = (field: keyof RefundData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Failed to process refund:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container refund-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header refund-header">
          <h3><i className="fa fa-undo me-2"></i>Refund Ticket</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="alert alert-warning d-flex align-items-center mb-2" style={{ padding: '0.5rem 0.75rem', fontSize: '0.8125rem' }}>
              <i className="fa fa-exclamation-triangle me-2"></i>
              <strong>Warning:</strong>&nbsp;This will mark the ticket as refunded.
            </div>

            <p className="mb-2">Refunding ticket for: <strong>{passengerName}</strong> (Ticket #{ticketId})</p>

            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <FormField
                  label="Refund Net Amount"
                  name="refund_net_amount"
                  type="number"
                  value={formData.refund_net_amount}
                  onChange={(value) => handleChange('refund_net_amount', parseFloat(value))}
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
                  label="Refund Sale Amount"
                  name="refund_sale_amount"
                  type="number"
                  value={formData.refund_sale_amount}
                  onChange={(value) => handleChange('refund_sale_amount', parseFloat(value))}
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
                <label className="form-label">Refund Remarks</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={formData.remarks}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Enter refund remarks..."
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Close
            </button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Processing...
                </>
              ) : (
                <>
                  <i className="fa fa-undo me-2"></i>
                  Process Refund
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

