import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ticketService from '../../services/ticketService';
import Swal from 'sweetalert2';
import FormField from '../../components/form/FormField';
import FormSection from '../../components/form/FormSection';
import type { Customer, Supplier, Airport, Currency, TicketPassenger } from '../../types/ticket';
import './CreateTicket.css';

export default function CreateTicket() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Dropdown data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    pnr: '',
    customer_id: 0,
    date_of_travel: '',
    return_date: '',
    from_id: 0,
    to_id: 0,
    supp_id: 0,
    flight_type: 'OW',
    flight_number: '',
    return_flight_number: '',
    departure_time: '',
    arrival_time: '',
    return_departure_time: '',
    return_arrival_time: '',
    remarks: '',
    customer_payment: 0,
    payment_currency_type: 0,
    account_id: 0
  });

  // Passengers array
  const [passengers, setPassengers] = useState<TicketPassenger[]>([
    {
      passenger_name: '',
      ticketNumber: '',
      net_price: 0,
      net_CurrencyID: 0,
      sale: 0,
      currencyID: 0
    }
  ]);

  useEffect(() => {
    loadDropdowns();
  }, []);

  const loadDropdowns = async () => {
    try {
      const data = await ticketService.getDropdowns();
      setCustomers(data.customers);
      setSuppliers(data.suppliers);
      setAirports(data.airports);
      setCurrencies(data.currencies);
      setAccounts(data.accounts);
    } catch (error) {
      console.error('Failed to load dropdowns:', error);
      Swal.fire('Error', 'Failed to load form data', 'error');
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePassengerChange = (index: number, field: keyof TicketPassenger, value: any) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
  };

  const addPassenger = () => {
    setPassengers([...passengers, {
      passenger_name: '',
      ticketNumber: '',
      net_price: 0,
      net_CurrencyID: 0,
      sale: 0,
      currencyID: 0
    }]);
  };

  const removePassenger = (index: number) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.pnr) {
      Swal.fire('Error', 'PNR is required', 'error');
      return;
    }
    if (!formData.customer_id) {
      Swal.fire('Error', 'Please select a customer', 'error');
      return;
    }
    if (passengers.some(p => !p.passenger_name)) {
      Swal.fire('Error', 'All passengers must have a name', 'error');
      return;
    }

    setLoading(true);
    try {
      await ticketService.createTicket({
        ...formData,
        passengers
      });
      
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Ticket created successfully',
        confirmButtonColor: '#dc2626'
      }).then(() => {
        navigate('/ticket/report');
      });
    } catch (error: any) {
      console.error('Failed to create ticket:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to create ticket', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isOneWay = formData.flight_type === 'OW';

  return (
    <div className="create-ticket-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">
            <i className="fa fa-plane-departure me-3"></i>
            Create New Ticket
          </h2>
          <p className="page-subtitle">Book a new flight ticket for your customer</p>
        </div>
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate('/ticket/report')}
        >
          <i className="fa fa-arrow-left me-2"></i>
          Back to Tickets
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Two Column Layout: Basic Info + Flight Details */}
        <div className="two-column-layout">
          {/* Basic Information */}
          <FormSection title="Basic Information" icon="fa fa-info-circle">
            <div className="form-grid basic-info-grid">
              <FormField
                label="PNR Number"
                name="pnr"
                value={formData.pnr}
                onChange={(value) => handleInputChange('pnr', value)}
                required
                icon="fa fa-ticket"
                placeholder="Enter PNR number"
              />
              
              <FormField
                label="Customer"
                name="customer_id"
                type="select"
                value={formData.customer_id}
                onChange={(value) => handleInputChange('customer_id', parseInt(value))}
                options={customers.map(c => ({
                  value: c.customer_id,
                  label: `${c.customer_name} - ${c.customer_phone}`
                }))}
                required
                icon="fa fa-user"
                searchable
              />
              
              <FormField
                label="Supplier"
                name="supp_id"
                type="select"
                value={formData.supp_id}
                onChange={(value) => handleInputChange('supp_id', parseInt(value))}
                options={suppliers.map(s => ({
                  value: s.supp_id,
                  label: s.supp_name
                }))}
                required
                icon="fa fa-building"
                searchable
              />
              
              <FormField
                label="Flight Type"
                name="flight_type"
                type="select"
                value={formData.flight_type}
                onChange={(value) => handleInputChange('flight_type', value)}
                options={[
                  { value: 'OW', label: 'One Way' },
                  { value: 'RT', label: 'Round Trip' }
                ]}
                required
                icon="fa fa-plane"
              />
            </div>
          </FormSection>

          {/* Flight Details */}
          <FormSection title="Flight Details" icon="fa fa-route">
            <div className="form-grid flight-details-grid">
            <FormField
              label="From Airport"
              name="from_id"
              type="select"
              value={formData.from_id}
              onChange={(value) => handleInputChange('from_id', parseInt(value))}
              options={airports.map(a => ({
                value: a.airport_id,
                label: `${a.airport_code} - ${a.name}`
              }))}
              required
              icon="fa fa-plane-departure"
              searchable
            />
            
            <FormField
              label="To Airport"
              name="to_id"
              type="select"
              value={formData.to_id}
              onChange={(value) => handleInputChange('to_id', parseInt(value))}
              options={airports.map(a => ({
                value: a.airport_id,
                label: `${a.airport_code} - ${a.name}`
              }))}
              required
              icon="fa fa-plane-arrival"
              searchable
            />
            
            <FormField
              label="Departure Date"
              name="date_of_travel"
              type="date"
              value={formData.date_of_travel}
              onChange={(value) => handleInputChange('date_of_travel', value)}
              required
              icon="fa fa-calendar"
            />
            
            <FormField
              label="Return Date"
              name="return_date"
              type="date"
              value={formData.return_date}
              onChange={(value) => handleInputChange('return_date', value)}
              disabled={isOneWay}
              icon="fa fa-calendar-check"
              helpText={isOneWay ? 'Only for Round Trip flights' : ''}
            />
            
            <FormField
              label="Flight Number"
              name="flight_number"
              value={formData.flight_number}
              onChange={(value) => handleInputChange('flight_number', value)}
              icon="fa fa-hashtag"
              placeholder="e.g. AA123"
            />
            
            <FormField
              label="Return Flight Number"
              name="return_flight_number"
              value={formData.return_flight_number}
              onChange={(value) => handleInputChange('return_flight_number', value)}
              disabled={isOneWay}
              icon="fa fa-hashtag"
              placeholder="e.g. AA456"
              helpText={isOneWay ? 'Only for Round Trip flights' : ''}
            />
            
            <FormField
              label="Departure Time"
              name="departure_time"
              type="time"
              value={formData.departure_time}
              onChange={(value) => handleInputChange('departure_time', value)}
              icon="fa fa-clock"
            />
            
            <FormField
              label="Arrival Time"
              name="arrival_time"
              type="time"
              value={formData.arrival_time}
              onChange={(value) => handleInputChange('arrival_time', value)}
              icon="fa fa-clock"
            />
            
            <FormField
              label="Return Departure Time"
              name="return_departure_time"
              type="time"
              value={formData.return_departure_time}
              onChange={(value) => handleInputChange('return_departure_time', value)}
              disabled={isOneWay}
              icon="fa fa-clock"
              helpText={isOneWay ? 'Only for Round Trip flights' : ''}
            />
            
            <FormField
              label="Return Arrival Time"
              name="return_arrival_time"
              type="time"
              value={formData.return_arrival_time}
              onChange={(value) => handleInputChange('return_arrival_time', value)}
              disabled={isOneWay}
              icon="fa fa-clock"
              helpText={isOneWay ? 'Only for Round Trip flights' : ''}
            />
          </div>
        </FormSection>
        </div>

        {/* Passengers */}
        <FormSection title="Passengers" icon="fa fa-users">
          <div className="passengers-header">
            <p className="passengers-count">Total Passengers: {passengers.length}</p>
            <button type="button" className="btn-add-passenger" onClick={addPassenger}>
              <i className="fa fa-plus-circle me-2"></i>
              Add Passenger
            </button>
          </div>
          
          {passengers.map((passenger, index) => (
            <div key={index} className="passenger-card">
              <div className="passenger-card-header">
                <h4 className="passenger-title">
                  <i className="fa fa-user me-2"></i>
                  Passenger {index + 1}
                </h4>
                {passengers.length > 1 && (
                  <button
                    type="button"
                    className="btn-remove-passenger"
                    onClick={() => removePassenger(index)}
                  >
                    <i className="fa fa-times"></i>
                  </button>
                )}
              </div>
              
              <div className="form-grid">
                <FormField
                  label="Passenger Name"
                  name={`passenger_name_${index}`}
                  value={passenger.passenger_name}
                  onChange={(value) => handlePassengerChange(index, 'passenger_name', value)}
                  required
                  icon="fa fa-id-card"
                  placeholder="Full name as per passport"
                />
                
                <FormField
                  label="Ticket Number"
                  name={`ticketNumber_${index}`}
                  value={passenger.ticketNumber}
                  onChange={(value) => handlePassengerChange(index, 'ticketNumber', value)}
                  icon="fa fa-ticket-alt"
                  placeholder="Optional"
                />
                
                <FormField
                  label="Net Price"
                  name={`net_price_${index}`}
                  type="number"
                  value={passenger.net_price}
                  onChange={(value) => handlePassengerChange(index, 'net_price', parseFloat(value) || 0)}
                  required
                  icon="fa fa-dollar-sign"
                  min="0"
                />
                
                <FormField
                  label="Net Currency"
                  name={`net_CurrencyID_${index}`}
                  type="select"
                  value={passenger.net_CurrencyID}
                  onChange={(value) => handlePassengerChange(index, 'net_CurrencyID', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                  icon="fa fa-money-bill"
                />
                
                <FormField
                  label="Sale Price"
                  name={`sale_${index}`}
                  type="number"
                  value={passenger.sale}
                  onChange={(value) => handlePassengerChange(index, 'sale', parseFloat(value) || 0)}
                  required
                  icon="fa fa-tag"
                  min="0"
                />
                
                <FormField
                  label="Sale Currency"
                  name={`currencyID_${index}`}
                  type="select"
                  value={passenger.currencyID}
                  onChange={(value) => handlePassengerChange(index, 'currencyID', parseInt(value))}
                  options={currencies.map(c => ({
                    value: c.currencyID,
                    label: c.currencyName
                  }))}
                  required
                  icon="fa fa-money-bill-wave"
                />
              </div>
            </div>
          ))}
        </FormSection>

        {/* Payment & Remarks */}
        <FormSection title="Payment & Additional Information" icon="fa fa-money-check">
          <div className="form-grid">
            <FormField
              label="Customer Payment"
              name="customer_payment"
              type="number"
              value={formData.customer_payment}
              onChange={(value) => handleInputChange('customer_payment', parseFloat(value) || 0)}
              icon="fa fa-hand-holding-usd"
              placeholder="Optional"
              min="0"
            />
            
            <FormField
              label="Payment Currency"
              name="payment_currency_type"
              type="select"
              value={formData.payment_currency_type}
              onChange={(value) => handleInputChange('payment_currency_type', parseInt(value))}
              options={currencies.map(c => ({
                value: c.currencyID,
                label: c.currencyName
              }))}
              icon="fa fa-coins"
            />
            
            <FormField
              label="Payment Account"
              name="account_id"
              type="select"
              value={formData.account_id}
              onChange={(value) => handleInputChange('account_id', parseInt(value))}
              options={accounts.map(a => ({
                value: a.accountID,
                label: a.accountName
              }))}
              icon="fa fa-university"
            />
          </div>
          
          <FormField
            label="Remarks / Notes"
            name="remarks"
            type="textarea"
            value={formData.remarks}
            onChange={(value) => handleInputChange('remarks', value)}
            icon="fa fa-sticky-note"
            placeholder="Any additional information..."
            rows={2}
          />
        </FormSection>

        {/* Submit Buttons */}
        <div className="form-actions">
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Creating Ticket...
              </>
            ) : (
              <>
                <i className="fa fa-save me-2"></i>
                Create Ticket
              </>
            )}
          </button>
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate('/ticket/report')}
            disabled={loading}
          >
            <i className="fa fa-times me-2"></i>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
