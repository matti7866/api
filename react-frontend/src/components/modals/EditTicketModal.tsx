import { useState, useEffect } from 'react';
import { FormField } from '../form';
import type { Ticket, Supplier, Airport, Currency } from '../../types/ticket';
import './Modal.css';

interface EditTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ticketId: number, data: Partial<Ticket>) => Promise<void>;
  ticket: Ticket;
  suppliers: Supplier[];
  airports: Airport[];
  currencies: Currency[];
}

export default function EditTicketModal({
  isOpen,
  onClose,
  onSubmit,
  ticket,
  suppliers,
  airports,
  currencies
}: EditTicketModalProps) {
  const [formData, setFormData] = useState<Partial<Ticket>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && ticket) {
      setFormData({
        ticketNumber: ticket.ticketNumber || '',
        Pnr: ticket.Pnr,
        passenger_name: ticket.passenger_name,
        date_of_travel: ticket.date_of_travel,
        return_date: ticket.return_date || '',
        from_id: ticket.from_id,
        to_id: ticket.to_id,
        supp_id: ticket.supp_id,
        flight_type: ticket.flight_type,
        flight_number: ticket.flight_number || '',
        return_flight_number: ticket.return_flight_number || '',
        departure_time: ticket.departure_time || '',
        arrival_time: ticket.arrival_time || '',
        return_departure_time: ticket.return_departure_time || '',
        return_arrival_time: ticket.return_arrival_time || '',
        sale: ticket.sale,
        currencyID: ticket.currencyID,
        net_price: ticket.net_price,
        net_CurrencyID: ticket.net_CurrencyID,
        remarks: ticket.remarks || ''
      });
    }
  }, [isOpen, ticket]);

  const handleChange = (field: keyof Ticket, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(ticket.ticket, formData);
      onClose();
    } catch (error) {
      console.error('Failed to update ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isOneWay = formData.flight_type === 'OW';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header edit-header">
          <h3><i className="fa fa-edit me-2"></i>Edit Ticket</h3>
          <button className="modal-close" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="mb-3">Editing ticket for: <strong>{ticket.passenger_name}</strong> (Ticket #{ticket.ticket})</p>

            {/* Basic Info */}
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <FormField
                  label="PNR"
                  name="Pnr"
                  value={formData.Pnr || ''}
                  onChange={(value) => handleChange('Pnr', value)}
                  required
                />
              </div>
              <div className="col-md-4">
                <FormField
                  label="Ticket Number"
                  name="ticketNumber"
                  value={formData.ticketNumber || ''}
                  onChange={(value) => handleChange('ticketNumber', value)}
                />
              </div>
              <div className="col-md-4">
                <FormField
                  label="Passenger Name"
                  name="passenger_name"
                  value={formData.passenger_name || ''}
                  onChange={(value) => handleChange('passenger_name', value)}
                  required
                />
              </div>
            </div>

            {/* Flight Details */}
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <FormField
                  label="From Airport"
                  name="from_id"
                  type="select"
                  value={formData.from_id || 0}
                  onChange={(value) => handleChange('from_id', parseInt(value))}
                  options={airports.map(a => ({
                    value: a.airport_id,
                    label: `${a.airport_code} - ${a.name}`
                  }))}
                  required
                  searchable
                />
              </div>
              <div className="col-md-4">
                <FormField
                  label="To Airport"
                  name="to_id"
                  type="select"
                  value={formData.to_id || 0}
                  onChange={(value) => handleChange('to_id', parseInt(value))}
                  options={airports.map(a => ({
                    value: a.airport_id,
                    label: `${a.airport_code} - ${a.name}`
                  }))}
                  required
                  searchable
                />
              </div>
              <div className="col-md-4">
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

            {/* Dates and Times */}
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <FormField
                  label="Flight Type"
                  name="flight_type"
                  type="select"
                  value={formData.flight_type || 'OW'}
                  onChange={(value) => handleChange('flight_type', value)}
                  options={[
                    { value: 'OW', label: 'One Way' },
                    { value: 'RT', label: 'Round Trip' }
                  ]}
                  required
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Travel Date"
                  name="date_of_travel"
                  type="date"
                  value={formData.date_of_travel || ''}
                  onChange={(value) => handleChange('date_of_travel', value)}
                  required
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Return Date"
                  name="return_date"
                  type="date"
                  value={formData.return_date || ''}
                  onChange={(value) => handleChange('return_date', value)}
                  disabled={isOneWay}
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Flight Number"
                  name="flight_number"
                  value={formData.flight_number || ''}
                  onChange={(value) => handleChange('flight_number', value)}
                />
              </div>
            </div>

            {/* Times */}
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <FormField
                  label="Departure Time"
                  name="departure_time"
                  type="time"
                  value={formData.departure_time || ''}
                  onChange={(value) => handleChange('departure_time', value)}
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Arrival Time"
                  name="arrival_time"
                  type="time"
                  value={formData.arrival_time || ''}
                  onChange={(value) => handleChange('arrival_time', value)}
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Return Flight #"
                  name="return_flight_number"
                  value={formData.return_flight_number || ''}
                  onChange={(value) => handleChange('return_flight_number', value)}
                  disabled={isOneWay}
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Return Dep. Time"
                  name="return_departure_time"
                  type="time"
                  value={formData.return_departure_time || ''}
                  onChange={(value) => handleChange('return_departure_time', value)}
                  disabled={isOneWay}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="row g-3 mb-3">
              <div className="col-md-3">
                <FormField
                  label="Sale Price"
                  name="sale"
                  type="number"
                  value={formData.sale || 0}
                  onChange={(value) => handleChange('sale', parseFloat(value))}
                  required
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Sale Currency"
                  name="currencyID"
                  type="select"
                  value={formData.currencyID || 1}
                  onChange={(value) => handleChange('currencyID', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Net Price"
                  name="net_price"
                  type="number"
                  value={formData.net_price || 0}
                  onChange={(value) => handleChange('net_price', parseFloat(value))}
                  required
                />
              </div>
              <div className="col-md-3">
                <FormField
                  label="Net Currency"
                  name="net_CurrencyID"
                  type="select"
                  value={formData.net_CurrencyID || 1}
                  onChange={(value) => handleChange('net_CurrencyID', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                />
              </div>
            </div>

            {/* Remarks */}
            <div className="row g-3">
              <div className="col-md-12">
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={formData.remarks || ''}
                  onChange={(e) => handleChange('remarks', e.target.value)}
                  placeholder="Enter remarks..."
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
                  Update Ticket
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}














