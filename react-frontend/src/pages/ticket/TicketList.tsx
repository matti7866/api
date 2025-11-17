import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ticketService from '../../services/ticketService';
import Swal from 'sweetalert2';
import { FormSection, FormField } from '../../components/form';
import { DateChangeModal, RefundModal, EditTicketModal, type DateChangeData, type RefundData } from '../../components/modals';
import type { Ticket, TicketFilters, Customer, Supplier, Airport, Currency } from '../../types/ticket';
import './TicketList.css';

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function TicketList() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TicketFilters>({
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    customerId: undefined,
    supplierId: undefined,
    pnr: '',
    passengerName: '',
    ticketNumber: '',
    flightType: '',
    fromAirport: undefined,
    toAirport: undefined
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [airports, setAirports] = useState<Airport[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  
  // Modal states
  const [dateChangeModal, setDateChangeModal] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  
  const [refundModal, setRefundModal] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });

  useEffect(() => {
    loadDropdowns();
    loadTickets();
  }, []);

  const loadDropdowns = async () => {
    try {
      const data = await ticketService.getDropdowns();
      setCustomers(data.customers);
      setSuppliers(data.suppliers);
      setAirports(data.airports);
      setCurrencies(data.currencies);
    } catch (error) {
      console.error('Failed to load dropdowns:', error);
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    try {
      const data = await ticketService.getTickets(filters);
      setTickets(data);
    } catch (error) {
      console.error('Failed to load tickets:', error);
      Swal.fire('Error', 'Failed to load tickets', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof TicketFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    loadTickets();
  };

  const handleReset = () => {
    setFilters({
      startDate: getTodayDate(),
      endDate: getTodayDate(),
      customerId: undefined,
      supplierId: undefined,
      pnr: '',
      passengerName: '',
      ticketNumber: '',
      flightType: '',
      fromAirport: undefined,
      toAirport: undefined
    });
    setTimeout(() => loadTickets(), 100);
  };

  const handleDelete = async (ticketId: number, passengerName: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Delete ticket for ${passengerName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await ticketService.deleteTicket(ticketId);
        Swal.fire('Deleted!', 'Ticket has been deleted.', 'success');
        loadTickets();
      } catch (error) {
        Swal.fire('Error', 'Failed to delete ticket', 'error');
      }
    }
  };

  const handleDateChange = (ticket: Ticket) => {
    setDateChangeModal({ isOpen: true, ticket });
  };

  const handleDateChangeSubmit = async (data: DateChangeData) => {
    try {
      if (!dateChangeModal.ticket) return;
      
      await ticketService.changeDate(dateChangeModal.ticket.ticket, data);
      Swal.fire('Success!', 'Date change saved successfully', 'success');
      setDateChangeModal({ isOpen: false, ticket: null });
      loadTickets();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to save date change', 'error');
      throw error;
    }
  };

  const handleUploadTicket = async (ticketId: number, passengerName: string) => {
    const result = await Swal.fire({
      title: 'Upload Ticket Copy',
      html: `
        <p class="mb-3">Upload ticket for: <strong>${passengerName}</strong></p>
        <input type="file" id="ticketFile" class="swal2-file" accept="image/*,.pdf" style="width: 80%;">
        <p class="text-muted mt-2" style="font-size: 0.875rem;">Accepted: JPG, PNG, GIF, PDF (Max 5MB)</p>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Upload',
      preConfirm: () => {
        const fileInput = document.getElementById('ticketFile') as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (!file) {
          Swal.showValidationMessage('Please select a file');
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          Swal.showValidationMessage('File size must be less than 5MB');
          return false;
        }
        return file;
      }
    });

    if (result.isConfirmed && result.value) {
      try {
        Swal.fire({
          title: 'Uploading...',
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading()
        });
        
        await ticketService.uploadTicketCopy(ticketId, result.value);
        Swal.fire('Success!', 'Ticket copy uploaded successfully', 'success');
        loadTickets();
      } catch (error) {
        Swal.fire('Error', 'Failed to upload ticket copy', 'error');
      }
    }
  };

  const handleRefund = (ticket: Ticket) => {
    setRefundModal({ isOpen: true, ticket });
  };

  const handleRefundSubmit = async (data: RefundData) => {
    try {
      if (!refundModal.ticket) return;
      
      await ticketService.refundTicket(refundModal.ticket.ticket, data);
      Swal.fire('Success!', 'Ticket refunded successfully', 'success');
      setRefundModal({ isOpen: false, ticket: null });
      loadTickets();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to process refund', 'error');
      throw error;
    }
  };

  const handleEdit = (ticket: Ticket) => {
    setEditModal({ isOpen: true, ticket });
  };

  const handleEditSubmit = async (ticketId: number, data: Partial<Ticket>) => {
    try {
      await ticketService.updateTicket(ticketId, data);
      Swal.fire('Success!', 'Ticket updated successfully', 'success');
      setEditModal({ isOpen: false, ticket: null });
      loadTickets();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update ticket', 'error');
      throw error;
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  const getStatusBadge = (status?: number) => {
    switch (status) {
      case 1:
        return <span className="badge bg-danger">Issued</span>;
      case 2:
        return <span className="badge bg-warning text-dark">Date Changed</span>;
      case 3:
        return <span className="badge bg-secondary">Refunded</span>;
      default:
        return <span className="badge bg-danger">Issued</span>;
    }
  };

  return (
    <div className="container-fluid">
      <div className="row mb-3">
        <div className="col-md-12">
          <div className="d-flex justify-content-between align-items-center">
            <h3><i className="fa fa-plane"></i> Ticket Management</h3>
            <Link to="/ticket/new" className="btn btn-primary">
              <i className="fa fa-plus"></i> New Ticket
            </Link>
          </div>
        </div>
      </div>

      {/* Search Filters */}
      <FormSection title="Search Filters" icon="fa fa-search">
        <div className="row g-3">
          <div className="col-md-3">
            <FormField
              label="Start Date"
              name="startDate"
              type="date"
              value={filters.startDate}
              onChange={(value) => handleFilterChange('startDate', value)}
              icon="fa fa-calendar"
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="End Date"
              name="endDate"
              type="date"
              value={filters.endDate}
              onChange={(value) => handleFilterChange('endDate', value)}
              icon="fa fa-calendar"
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="Customer"
              name="customerId"
              type="select"
              value={filters.customerId || 0}
              onChange={(value) => handleFilterChange('customerId', value ? parseInt(value) : undefined)}
              options={[
                { value: 0, label: 'All Customers' },
                ...customers.map(c => ({
                  value: c.customer_id,
                  label: `${c.customer_name} - ${c.customer_phone}`
                }))
              ]}
              icon="fa fa-user"
              searchable
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="Supplier"
              name="supplierId"
              type="select"
              value={filters.supplierId || 0}
              onChange={(value) => handleFilterChange('supplierId', value ? parseInt(value) : undefined)}
              options={[
                { value: 0, label: 'All Suppliers' },
                ...suppliers.map(s => ({
                  value: s.supp_id,
                  label: s.supp_name
                }))
              ]}
              icon="fa fa-building"
              searchable
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="PNR"
              name="pnr"
              value={filters.pnr}
              onChange={(value) => handleFilterChange('pnr', value)}
              placeholder="Enter PNR"
              icon="fa fa-ticket"
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="Passenger Name"
              name="passengerName"
              value={filters.passengerName}
              onChange={(value) => handleFilterChange('passengerName', value)}
              placeholder="Passenger name"
              icon="fa fa-user-tie"
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="Ticket Number"
              name="ticketNumber"
              value={filters.ticketNumber}
              onChange={(value) => handleFilterChange('ticketNumber', value)}
              placeholder="Ticket number"
              icon="fa fa-hashtag"
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="Flight Type"
              name="flightType"
              type="select"
              value={filters.flightType}
              onChange={(value) => handleFilterChange('flightType', value)}
              options={[
                { value: '', label: 'All Types' },
                { value: 'OW', label: 'One Way' },
                { value: 'RT', label: 'Round Trip' }
              ]}
              icon="fa fa-plane"
            />
          </div>
        </div>
        <div className="row mt-3">
          <div className="col-md-12">
            <button className="btn btn-primary me-2" onClick={handleSearch}>
              <i className="fa fa-search me-1"></i> Search
            </button>
            <button className="btn btn-secondary" onClick={handleReset}>
              <i className="fa fa-redo me-1"></i> Reset
            </button>
          </div>
        </div>
      </FormSection>

      {/* Tickets Table */}
      <FormSection title={`Tickets (${tickets.length})`} icon="fa fa-list">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="alert alert-info">No tickets found</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped table-bordered">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Issue Date</th>
                  <th>PNR</th>
                  <th>Passenger</th>
                  <th>Customer</th>
                  <th>Supplier</th>
                  <th>Route</th>
                  <th>Travel Date</th>
                  <th>Type</th>
                  <th>Sale</th>
                  <th>Net</th>
                  <th>Profit</th>
                  <th>Status</th>
                  <th>Branch</th>
                  <th style={{ width: '200px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.ticket}>
                    <td><strong>084 2317 {ticket.ticket}</strong></td>
                    <td>{new Date(ticket.datetime).toLocaleDateString()}</td>
                    <td><span className="badge bg-primary">{ticket.Pnr}</span></td>
                    <td>{ticket.passenger_name}</td>
                    <td>
                      <div className="fw-bold">{ticket.customer_name}</div>
                      <small className="text-muted">{ticket.customer_phone}</small>
                    </td>
                    <td>{ticket.supplier_name}</td>
                    <td>
                      <span className="badge bg-info">{ticket.from_code}</span>
                      {' → '}
                      <span className="badge bg-success">{ticket.to_code}</span>
                    </td>
                    <td>{new Date(ticket.date_of_travel).toLocaleDateString()}</td>
                    <td><span className="badge bg-danger">{ticket.flight_type === 'OW' ? 'One Way' : ticket.flight_type === 'RT' ? 'Round Trip' : ticket.flight_type}</span></td>
                    <td>{formatCurrency(ticket.sale, ticket.currency_name || '')}</td>
                    <td>{formatCurrency(ticket.net_price, ticket.net_currency_name || '')}</td>
                    <td className="text-success fw-bold">{formatCurrency(ticket.sale - ticket.net_price, ticket.currency_name || '')}</td>
                    <td>{getStatusBadge(ticket.status)}</td>
                    <td>Main Office</td>
                    <td>
                      <div className="btn-group-vertical d-flex flex-row gap-1" role="group">
                        <button
                          className="btn btn-sm btn-primary"
                          title="View"
                          onClick={() => Swal.fire('Coming Soon', 'View feature will be implemented soon', 'info')}
                        >
                          <i className="fa fa-eye"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-info"
                          title="Edit"
                          onClick={() => handleEdit(ticket)}
                        >
                          <i className="fa fa-edit"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          title="Upload Ticket"
                          onClick={() => handleUploadTicket(ticket.ticket, ticket.passenger_name)}
                        >
                          <i className="fa fa-upload"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-warning"
                          title="Date Change"
                          onClick={() => handleDateChange(ticket)}
                        >
                          <i className="fa fa-calendar-alt"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          title="Refund"
                          onClick={() => handleRefund(ticket)}
                        >
                          <i className="fa fa-undo"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          title="Delete"
                          onClick={() => handleDelete(ticket.ticket, ticket.passenger_name)}
                        >
                          <i className="fa fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FormSection>

      {/* Date Change Modal */}
      {dateChangeModal.ticket && (
        <DateChangeModal
          isOpen={dateChangeModal.isOpen}
          onClose={() => setDateChangeModal({ isOpen: false, ticket: null })}
          onSubmit={handleDateChangeSubmit}
          ticketId={dateChangeModal.ticket.ticket}
          passengerName={dateChangeModal.ticket.passenger_name}
          currentDate={dateChangeModal.ticket.date_of_travel}
          supplierId={dateChangeModal.ticket.supp_id}
          netPrice={dateChangeModal.ticket.net_price}
          netCurrencyId={dateChangeModal.ticket.net_CurrencyID}
          salePrice={dateChangeModal.ticket.sale}
          saleCurrencyId={dateChangeModal.ticket.currencyID}
          suppliers={suppliers}
          currencies={currencies}
        />
      )}

      {/* Refund Modal */}
      {refundModal.ticket && (
        <RefundModal
          isOpen={refundModal.isOpen}
          onClose={() => setRefundModal({ isOpen: false, ticket: null })}
          onSubmit={handleRefundSubmit}
          ticketId={refundModal.ticket.ticket}
          passengerName={refundModal.ticket.passenger_name}
          netPrice={refundModal.ticket.net_price}
          netCurrencyId={refundModal.ticket.net_CurrencyID}
          salePrice={refundModal.ticket.sale}
          saleCurrencyId={refundModal.ticket.currencyID}
          currencies={currencies}
        />
      )}

      {/* Edit Modal */}
      {editModal.ticket && (
        <EditTicketModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, ticket: null })}
          onSubmit={handleEditSubmit}
          ticket={editModal.ticket}
          suppliers={suppliers}
          airports={airports}
          currencies={currencies}
        />
      )}
    </div>
  );
}

