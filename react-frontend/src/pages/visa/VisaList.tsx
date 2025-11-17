import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import visaService from '../../services/visaService';
import Swal from 'sweetalert2';
import { FormSection, FormField } from '../../components/form';
import { EditVisaModal } from '../../components/modals';
import type { Visa, VisaFilters, Customer, Country, VisaDropdowns } from '../../types/visa';
import '../ticket/TicketList.css';

// Get today's date in YYYY-MM-DD format
const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function VisaList() {
  const [visas, setVisas] = useState<Visa[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<VisaFilters>({
    startDate: getTodayDate(),
    endDate: getTodayDate()
  });

  const [dropdowns, setDropdowns] = useState<VisaDropdowns>({
    customers: [],
    suppliers: [],
    countries: [],
    nationalities: [],
    currencies: [],
    accounts: []
  });

  // Modal states
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    visa: Visa | null;
  }>({ isOpen: false, visa: null });

  useEffect(() => {
    loadDropdowns();
    loadVisas();
  }, []);

  const loadDropdowns = async () => {
    try {
      const data = await visaService.getDropdowns();
      setDropdowns(data);
    } catch (error) {
      console.error('Failed to load dropdowns:', error);
    }
  };

  const loadVisas = async () => {
    try {
      setLoading(true);
      const data = await visaService.getVisas(filters);
      setVisas(data);
    } catch (error) {
      console.error('Failed to load visas:', error);
      Swal.fire('Error', 'Failed to load visas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: keyof VisaFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    loadVisas();
  };

  const handleReset = () => {
    setFilters({
      startDate: getTodayDate(),
      endDate: getTodayDate()
    });
    setTimeout(() => loadVisas(), 100);
  };

  const handleDelete = async (visaId: number, passengerName: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `Delete visa for ${passengerName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await visaService.deleteVisa(visaId);
        Swal.fire('Deleted!', 'Visa has been deleted.', 'success');
        loadVisas();
      } catch (error) {
        Swal.fire('Error', 'Failed to delete visa', 'error');
      }
    }
  };

  const handleEdit = (visa: Visa) => {
    setEditModal({ isOpen: true, visa });
  };

  const handleEditSubmit = async (visaId: number, data: Partial<Visa>) => {
    try {
      await visaService.updateVisa(visaId, data);
      Swal.fire('Success!', 'Visa updated successfully', 'success');
      setEditModal({ isOpen: false, visa: null });
      loadVisas();
    } catch (error: any) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update visa', 'error');
      throw error;
    }
  };

  const handleUploadVisa = async (visaId: number, passengerName: string) => {
    const result = await Swal.fire({
      title: 'Upload Visa Copy',
      html: `
        <p class="mb-3">Upload visa for: <strong>${passengerName}</strong></p>
        <input type="file" id="visaFile" class="swal2-file" accept="image/*,.pdf" style="width: 80%;">
        <p class="text-muted mt-2" style="font-size: 0.875rem;">Accepted: JPG, PNG, GIF, PDF (Max 5MB)</p>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Upload',
      preConfirm: () => {
        const fileInput = document.getElementById('visaFile') as HTMLInputElement;
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
          didOpen: () => {
            Swal.showLoading();
          }
        });
        await visaService.uploadVisaCopy(visaId, result.value);
        Swal.fire('Success!', 'Visa copy uploaded successfully', 'success');
        loadVisas();
      } catch (error) {
        Swal.fire('Error', 'Failed to upload visa copy', 'error');
      }
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return `${amount.toLocaleString()} ${currency}`;
  };

  return (
    <div className="container-fluid">
      <div className="row mb-3">
        <div className="col-md-12">
          <div className="d-flex justify-content-between align-items-center">
            <h3><i className="fa fa-cc-visa"></i> Visa Management</h3>
            <Link to="/visa/new" className="btn btn-danger">
              <i className="fa fa-plus"></i> New Visa
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
                ...dropdowns.customers.map(c => ({
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
              label="Country/Visa Type"
              name="countryId"
              type="select"
              value={filters.countryId || 0}
              onChange={(value) => handleFilterChange('countryId', value ? parseInt(value) : undefined)}
              options={[
                { value: 0, label: 'All Countries' },
                ...dropdowns.countries.map(c => ({
                  value: c.country_id,
                  label: c.country_names
                }))
              ]}
              icon="fa fa-flag"
              searchable
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="Passport Number"
              name="passportNum"
              value={filters.passportNum}
              onChange={(value) => handleFilterChange('passportNum', value)}
              placeholder="Enter passport number"
              icon="fa fa-passport"
            />
          </div>
          <div className="col-md-3">
            <FormField
              label="Passenger Name"
              name="passengerName"
              value={filters.passengerName}
              onChange={(value) => handleFilterChange('passengerName', value)}
              placeholder="Passenger name"
              icon="fa fa-user"
            />
          </div>
          <div className="col-md-3">
            <button
              type="button"
              className="btn btn-dark w-100"
              onClick={handleSearch}
              style={{ marginTop: '28px' }}
            >
              <i className="fa fa-search"></i> Search
            </button>
          </div>
          <div className="col-md-3">
            <button
              type="button"
              className="btn btn-secondary w-100"
              onClick={handleReset}
              style={{ marginTop: '28px' }}
            >
              <i className="fa fa-redo"></i> Reset
            </button>
          </div>
        </div>
      </FormSection>

      {/* Results */}
      <FormSection title={`Visas (${visas.length})`} icon="fa fa-list">
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-danger" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : visas.length === 0 ? (
          <div className="alert alert-info">No visas found</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-striped table-bordered">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Passenger</th>
                  <th>Passport#</th>
                  <th>Country/Visa Type</th>
                  <th>Net</th>
                  <th>Sale</th>
                  <th>Profit</th>
                  <th>Supplier</th>
                  <th>Guarantee</th>
                  <th style={{ width: '150px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visas.map((visa) => (
                  <tr key={visa.visa_id}>
                    <td>{new Date(visa.datetime).toLocaleDateString()}</td>
                    <td>
                      <div className="fw-bold">{visa.customer_name}</div>
                      <small className="text-muted">{visa.customer_phone}</small>
                    </td>
                    <td>{visa.passenger_name}</td>
                    <td>{visa.PassportNum || '-'}</td>
                    <td><span className="badge bg-primary">{visa.country_name}</span></td>
                    <td>{formatCurrency(visa.net_price, visa.net_currency_name || '')}</td>
                    <td>{formatCurrency(visa.sale, visa.sale_currency_name || '')}</td>
                    <td className="text-success fw-bold">
                      {formatCurrency(visa.sale - visa.net_price, visa.sale_currency_name || '')}
                    </td>
                    <td>{visa.supplier_name}</td>
                    <td>{visa.gaurantee}</td>
                    <td>
                      <div className="btn-group-vertical d-flex flex-row gap-1" role="group">
                        <button
                          className="btn btn-sm btn-info"
                          title="Edit"
                          onClick={() => handleEdit(visa)}
                        >
                          <i className="fa fa-edit"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          title="Upload Visa"
                          onClick={() => handleUploadVisa(visa.visa_id, visa.passenger_name)}
                        >
                          <i className="fa fa-upload"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          title="Delete"
                          onClick={() => handleDelete(visa.visa_id, visa.passenger_name)}
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

      {/* Edit Modal */}
      {editModal.visa && (
        <EditVisaModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, visa: null })}
          onSubmit={handleEditSubmit}
          visa={editModal.visa}
          suppliers={dropdowns.suppliers}
          countries={dropdowns.countries}
          nationalities={dropdowns.nationalities}
          currencies={dropdowns.currencies}
        />
      )}
    </div>
  );
}

