import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import hotelService from '../../services/hotelService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type {
  Hotel,
  HotelFilters,
  CreateHotelRequest,
  HotelDropdownData
} from '../../types/hotel';
import './Hotels.css';

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function Hotels() {
  const [filters, setFilters] = useState<HotelFilters>({
    start_date: getTodayDate(),
    end_date: getTodayDate(),
    search_by_date: false
  });
  const [hotelModal, setHotelModal] = useState<{
    isOpen: boolean;
    hotel: Hotel | null;
  }>({ isOpen: false, hotel: null });
  
  const queryClient = useQueryClient();
  
  // Load dropdowns
  const { data: dropdowns, error: dropdownsError } = useQuery<HotelDropdownData>({
    queryKey: ['hotel-dropdowns'],
    queryFn: () => hotelService.getDropdowns(),
    retry: 2
  });
  
  useEffect(() => {
    if (dropdownsError) {
      console.error('Error loading dropdowns:', dropdownsError);
      Swal.fire('Error', 'Failed to load dropdown data. Please refresh the page.', 'error');
    }
  }, [dropdownsError]);
  
  // Load hotels
  const { data: hotels = [], isLoading: hotelsLoading, refetch: refetchHotels } = useQuery<Hotel[]>({
    queryKey: ['hotels', filters],
    queryFn: () => hotelService.getHotels(filters),
    enabled: !!(filters.customer || (filters.search_by_date && filters.start_date && filters.end_date))
  });
  
  // Mutations
  const createHotelMutation = useMutation({
    mutationFn: (data: CreateHotelRequest) => hotelService.createHotel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      setHotelModal({ isOpen: false, hotel: null });
      Swal.fire('Success', 'Hotel booking added successfully', 'success');
      // Refresh the list
      setTimeout(() => refetchHotels(), 500);
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to add hotel booking', 'error');
    }
  });
  
  const updateHotelMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateHotelRequest> }) =>
      hotelService.updateHotel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      setHotelModal({ isOpen: false, hotel: null });
      Swal.fire('Success', 'Hotel booking updated successfully', 'success');
      // Refresh the list
      setTimeout(() => refetchHotels(), 500);
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to update hotel booking', 'error');
    }
  });
  
  const deleteHotelMutation = useMutation({
    mutationFn: (id: number) => hotelService.deleteHotel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      Swal.fire('Success', 'Hotel booking deleted successfully', 'success');
      // Refresh the list
      setTimeout(() => refetchHotels(), 500);
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to delete hotel booking', 'error');
    }
  });
  
  const handleSearch = () => {
    if (!filters.customer && !filters.search_by_date) {
      Swal.fire('Validation Error', 'Please select at least one search option (Customer or Date Range)', 'error');
      return;
    }
    if (filters.search_by_date && (!filters.start_date || !filters.end_date)) {
      Swal.fire('Validation Error', 'Please select both start and end dates', 'error');
      return;
    }
    refetchHotels();
  };
  
  const handleAddHotel = () => {
    setHotelModal({ isOpen: true, hotel: null });
  };
  
  const handleEditHotel = async (hotel: Hotel) => {
    setHotelModal({ isOpen: true, hotel });
  };
  
  const handleDeleteHotel = (id: number) => {
    Swal.fire({
      title: 'Delete Hotel Booking?',
      text: 'Are you sure you want to delete this hotel reservation?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteHotelMutation.mutate(id);
      }
    });
  };
  
  return (
    <div className="hotels-page">
      <div className="page-header">
        <h1><i className="fa fa-hotel me-2"></i>Hotel Reservations</h1>
        <button className="btn btn-success" onClick={handleAddHotel}>
          <i className="fa fa-plus me-2"></i>
          Add Hotel Booking
        </button>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h3>Search Hotel Bookings</h3>
        </div>
        <div className="panel-body">
          <div className="search-filters">
            <div className="filter-row">
              <div className="filter-group">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="dateSearch"
                    checked={filters.search_by_date || false}
                    onChange={(e) => setFilters({ ...filters, search_by_date: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="dateSearch">
                    Search By Date
                  </label>
                </div>
              </div>
              <div className="filter-group">
                <label>From Date</label>
                <input
                  type="date"
                  value={filters.start_date || ''}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                  className="form-control"
                  disabled={!filters.search_by_date}
                />
              </div>
              <div className="filter-group">
                <label>To Date</label>
                <input
                  type="date"
                  value={filters.end_date || ''}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                  className="form-control"
                  disabled={!filters.search_by_date}
                />
              </div>
              <div className="filter-group">
                <label>Customer</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'All Customers' },
                    ...(dropdowns?.customers?.map(c => ({
                      value: c.customer_id,
                      label: c.customer_name
                    })) || [])
                  ]}
                  value={filters.customer || ''}
                  onChange={(value) => {
                    setFilters({ ...filters, customer: value ? Number(value) : undefined });
                  }}
                  placeholder="All Customers"
                />
              </div>
              <div className="filter-group">
                <label>&nbsp;</label>
                <button className="btn btn-primary w-100" onClick={handleSearch}>
                  <i className="fa fa-search me-2"></i>
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h3>Hotel Report</h3>
        </div>
        <div className="panel-body">
          {hotelsLoading ? (
            <div className="text-center p-4">
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p className="mt-2">Loading...</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>S#</th>
                    <th>Customer Name</th>
                    <th>Passenger Name</th>
                    <th>Hotel Name</th>
                    <th>Supplier</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Country</th>
                    <th>Date Time</th>
                    <th>Net Price</th>
                    <th>Sale Price</th>
                    <th>Reserved By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hotels.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center">
                        {filters.customer || filters.search_by_date ? 'No hotel bookings found' : 'Please select search criteria and click Search'}
                      </td>
                    </tr>
                  ) : (
                    hotels.map((hotel, index) => (
                      <tr key={hotel.hotel_id}>
                        <td>{index + 1}</td>
                        <td className="text-capitalize">{hotel.customer_name}</td>
                        <td className="text-capitalize">{hotel.passenger_name}</td>
                        <td className="text-capitalize">{hotel.hotel_name}</td>
                        <td>{hotel.account_name || hotel.supp_name || '-'}</td>
                        <td>{new Date(hotel.checkin_date).toLocaleDateString()}</td>
                        <td>{new Date(hotel.checkout_date).toLocaleDateString()}</td>
                        <td className="text-capitalize">{hotel.country_names}</td>
                        <td>{new Date(hotel.datetime).toLocaleString()}</td>
                        <td className="text-capitalize">
                          {hotel.net_price.toLocaleString()} {hotel.netCurrency}
                        </td>
                        <td className="text-capitalize">
                          {hotel.sale_price.toLocaleString()} {hotel.saleCurrency}
                        </td>
                        <td className="text-capitalize">{hotel.staff_name}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleEditHotel(hotel)}
                              title="Edit"
                            >
                              <i className="fa fa-edit"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteHotel(hotel.hotel_id)}
                              title="Delete"
                            >
                              <i className="fa fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Hotel Modal */}
      {hotelModal.isOpen && (
        <HotelModal
          hotel={hotelModal.hotel}
          dropdowns={dropdowns}
          onClose={() => setHotelModal({ isOpen: false, hotel: null })}
          onSubmit={(data) => {
            if (hotelModal.hotel) {
              updateHotelMutation.mutate({ id: hotelModal.hotel.hotel_id, data });
            } else {
              createHotelMutation.mutate(data as CreateHotelRequest);
            }
          }}
        />
      )}
    </div>
  );
}

// Hotel Modal Component
function HotelModal({
  hotel,
  dropdowns,
  onClose,
  onSubmit
}: {
  hotel: Hotel | null;
  dropdowns?: HotelDropdownData;
  onClose: () => void;
  onSubmit: (data: Partial<CreateHotelRequest>) => void;
}) {
  const [formData, setFormData] = useState<Partial<CreateHotelRequest>>({
    customer_id: hotel?.customer_id || undefined,
    passenger_name: hotel?.passenger_name || '',
    hotel_name: hotel?.hotel_name || '',
    supplier_id: hotel?.supplier_id || undefined,
    checkin_date: hotel?.checkin_date || getTodayDate(),
    checkout_date: hotel?.checkout_date || getTodayDate(),
    net_price: hotel?.net_price || 0,
    net_currency_id: hotel?.netCurrencyID || undefined,
    sale_price: hotel?.sale_price || 0,
    sale_currency_id: hotel?.saleCurrencyID || undefined,
    country_id: hotel?.country_id || undefined,
    cus_payment: 0,
    cus_payment_currency: undefined,
    account_id: undefined
  });
  
  const [paymentType, setPaymentType] = useState<'supplier' | 'account'>('supplier');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (hotel) {
      // Determine payment type based on existing data
      const hasSupplier = hotel.supplier_id && hotel.supplier_id > 0;
      setPaymentType(hasSupplier ? 'supplier' : 'account');
      
      setFormData({
        customer_id: hotel.customer_id,
        passenger_name: hotel.passenger_name,
        hotel_name: hotel.hotel_name,
        supplier_id: hotel.supplier_id,
        checkin_date: hotel.checkin_date,
        checkout_date: hotel.checkout_date,
        net_price: hotel.net_price,
        net_currency_id: hotel.netCurrencyID,
        sale_price: hotel.sale_price,
        sale_currency_id: hotel.saleCurrencyID,
        country_id: hotel.country_id,
        cus_payment: 0,
        cus_payment_currency: dropdowns?.currencies?.[0]?.currencyID,
        account_id: undefined
      });
    } else {
      // Reset form for new hotel
      setPaymentType('supplier');
      const defaultCurrency = dropdowns?.currencies?.[0]?.currencyID;
      setFormData({
        customer_id: undefined,
        passenger_name: '',
        hotel_name: '',
        supplier_id: undefined,
        checkin_date: getTodayDate(),
        checkout_date: getTodayDate(),
        net_price: 0,
        net_currency_id: defaultCurrency,
        sale_price: 0,
        sale_currency_id: defaultCurrency,
        country_id: undefined,
        cus_payment: 0,
        cus_payment_currency: defaultCurrency,
        account_id: undefined
      });
    }
  }, [hotel, dropdowns]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    
    if (!formData.customer_id) newErrors.customer_id = 'Customer is required';
    if (!formData.passenger_name) newErrors.passenger_name = 'Passenger name is required';
    if (!formData.hotel_name) newErrors.hotel_name = 'Hotel name is required';
    
    // Validate based on payment type
    if (paymentType === 'supplier' && !formData.supplier_id) {
      newErrors.supplier_id = 'Supplier is required when paying through supplier';
    }
    
    // For account payment: account_id is only needed if customer makes a payment
    if (paymentType === 'account' && formData.cus_payment && formData.cus_payment > 0 && !formData.account_id) {
      newErrors.account_id = 'Account is required when customer payment is provided';
    }
    
    if (!formData.checkin_date) newErrors.checkin_date = 'Check-in date is required';
    if (!formData.checkout_date) newErrors.checkout_date = 'Check-out date is required';
    if (!formData.net_price || formData.net_price <= 0) newErrors.net_price = 'Net price must be greater than 0';
    if (!formData.sale_price || formData.sale_price <= 0) newErrors.sale_price = 'Sale price must be greater than 0';
    if (!formData.country_id) newErrors.country_id = 'Country is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{hotel ? 'Edit Hotel Booking' : 'Add Hotel Booking'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label><i className="fa fa-user me-2"></i>Customer Name <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'Select Customer' },
                    ...(dropdowns?.customers?.map(c => ({
                      value: c.customer_id,
                      label: c.customer_name
                    })) || [])
                  ]}
                  value={formData.customer_id || ''}
                  onChange={(value) => {
                    setFormData({ ...formData, customer_id: Number(value) });
                    setErrors({ ...errors, customer_id: '' });
                  }}
                  placeholder="Select Customer"
                  required
                />
                {errors.customer_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.customer_id}</div>}
              </div>
              
              <div className="form-group">
                <label><i className="fa fa-user-alt me-2"></i>Passenger Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={formData.passenger_name}
                  onChange={(e) => {
                    setFormData({ ...formData, passenger_name: e.target.value });
                    setErrors({ ...errors, passenger_name: '' });
                  }}
                  className={`form-control ${errors.passenger_name ? 'is-invalid' : ''}`}
                  placeholder="Passenger Name"
                />
                {errors.passenger_name && <div className="invalid-feedback">{errors.passenger_name}</div>}
              </div>
            </div>
            
            <div className="form-group mb-3">
              <label><i className="fa fa-hotel me-2"></i>Hotel Name <span className="text-danger">*</span></label>
              <input
                type="text"
                value={formData.hotel_name}
                onChange={(e) => {
                  setFormData({ ...formData, hotel_name: e.target.value });
                  setErrors({ ...errors, hotel_name: '' });
                }}
                className={`form-control ${errors.hotel_name ? 'is-invalid' : ''}`}
                placeholder="Hotel Name"
              />
              {errors.hotel_name && <div className="invalid-feedback">{errors.hotel_name}</div>}
            </div>
            
            <div className="form-group mb-3">
              <label className="mb-2"><i className="fa fa-credit-card me-2"></i>Payment Through <span className="text-danger">*</span></label>
              <div className="payment-type-selector mb-3">
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    id="paymentTypeSupplier"
                    checked={paymentType === 'supplier'}
                    onChange={() => {
                      setPaymentType('supplier');
                      setFormData({ ...formData, account_id: undefined });
                      setErrors({ ...errors, account_id: '', supplier_id: '' });
                    }}
                  />
                  <label className="form-check-label" htmlFor="paymentTypeSupplier">
                    Through Supplier
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    id="paymentTypeAccount"
                    checked={paymentType === 'account'}
                    onChange={() => {
                      setPaymentType('account');
                      setFormData({ ...formData, supplier_id: undefined });
                      setErrors({ ...errors, account_id: '', supplier_id: '' });
                    }}
                  />
                  <label className="form-check-label" htmlFor="paymentTypeAccount">
                    Direct Account Payment
                  </label>
                </div>
              </div>
              
              {paymentType === 'supplier' ? (
                <>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Select Supplier' },
                      ...(dropdowns?.suppliers?.map(s => ({
                        value: s.supp_id,
                        label: s.supp_name
                      })) || [])
                    ]}
                    value={formData.supplier_id || ''}
                    onChange={(value) => {
                      setFormData({ ...formData, supplier_id: Number(value) });
                      setErrors({ ...errors, supplier_id: '' });
                    }}
                    placeholder="Select Supplier"
                    required
                  />
                  {errors.supplier_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.supplier_id}</div>}
                </>
              ) : (
                <>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Select Account' },
                      ...(dropdowns?.accounts?.map(a => ({
                        value: a.account_ID,
                        label: a.account_Name
                      })) || [])
                    ]}
                    value={formData.account_id || ''}
                    onChange={(value) => {
                      setFormData({ ...formData, account_id: value ? Number(value) : undefined });
                      setErrors({ ...errors, account_id: '' });
                    }}
                    placeholder="Select Account"
                  />
                  {errors.account_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.account_id}</div>}
                </>
              )}
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label><i className="fa fa-calendar-check me-2"></i>Check-In Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  value={formData.checkin_date}
                  onChange={(e) => {
                    setFormData({ ...formData, checkin_date: e.target.value });
                    setErrors({ ...errors, checkin_date: '' });
                  }}
                  className={`form-control ${errors.checkin_date ? 'is-invalid' : ''}`}
                />
                {errors.checkin_date && <div className="invalid-feedback">{errors.checkin_date}</div>}
              </div>
              
              <div className="form-group">
                <label><i className="fa fa-calendar-times me-2"></i>Check-Out Date <span className="text-danger">*</span></label>
                <input
                  type="date"
                  value={formData.checkout_date}
                  onChange={(e) => {
                    setFormData({ ...formData, checkout_date: e.target.value });
                    setErrors({ ...errors, checkout_date: '' });
                  }}
                  className={`form-control ${errors.checkout_date ? 'is-invalid' : ''}`}
                />
                {errors.checkout_date && <div className="invalid-feedback">{errors.checkout_date}</div>}
              </div>
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label><i className="fa fa-dollar-sign me-2"></i>Net Price <span className="text-danger">*</span></label>
                <div className="price-currency-group">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.net_price}
                    onChange={(e) => {
                      setFormData({ ...formData, net_price: Number(e.target.value) });
                      setErrors({ ...errors, net_price: '' });
                    }}
                    className={`form-control ${errors.net_price ? 'is-invalid' : ''}`}
                    placeholder="Net Price"
                  />
                  <SearchableSelect
                    options={
                      dropdowns?.currencies?.map(c => ({
                        value: c.currencyID,
                        label: c.currencyName
                      })) || []
                    }
                    value={formData.net_currency_id || ''}
                    onChange={(value) => setFormData({ ...formData, net_currency_id: Number(value) })}
                    placeholder="Currency"
                  />
                </div>
                {errors.net_price && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.net_price}</div>}
              </div>
              
              <div className="form-group">
                <label><i className="fa fa-money-bill me-2"></i>Sale Price <span className="text-danger">*</span></label>
                <div className="price-currency-group">
                  <input
                    type="number"
                    step="0.01"
                    value={formData.sale_price}
                    onChange={(e) => {
                      setFormData({ ...formData, sale_price: Number(e.target.value) });
                      setErrors({ ...errors, sale_price: '' });
                    }}
                    className={`form-control ${errors.sale_price ? 'is-invalid' : ''}`}
                    placeholder="Sale Price"
                  />
                  <SearchableSelect
                    options={
                      dropdowns?.currencies?.map(c => ({
                        value: c.currencyID,
                        label: c.currencyName
                      })) || []
                    }
                    value={formData.sale_currency_id || ''}
                    onChange={(value) => setFormData({ ...formData, sale_currency_id: Number(value) })}
                    placeholder="Currency"
                  />
                </div>
                {errors.sale_price && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.sale_price}</div>}
              </div>
            </div>
            
            <div className="form-group mb-3">
              <label><i className="fa fa-globe me-2"></i>Country <span className="text-danger">*</span></label>
              <SearchableSelect
                options={[
                  { value: '', label: 'Select Country' },
                  ...(dropdowns?.countries?.map(c => ({
                    value: c.country_id,
                    label: c.country_names
                  })) || [])
                ]}
                value={formData.country_id || ''}
                onChange={(value) => {
                  setFormData({ ...formData, country_id: Number(value) });
                  setErrors({ ...errors, country_id: '' });
                }}
                placeholder="Select Country"
                required
              />
              {errors.country_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.country_id}</div>}
            </div>
            
            {!hotel && paymentType === 'account' && (
              <>
                <hr className="my-4" />
                <h5 className="mb-3"><i className="fa fa-money-check-alt me-2"></i>Customer Payment (Optional)</h5>
                
                <div className="form-group">
                  <label>Payment Amount</label>
                  <div className="price-currency-group">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cus_payment}
                      onChange={(e) => setFormData({ ...formData, cus_payment: Number(e.target.value) })}
                      className="form-control"
                      placeholder="Customer Payment (Optional)"
                    />
                    <SearchableSelect
                      options={
                        dropdowns?.currencies?.map(c => ({
                          value: c.currencyID,
                          label: c.currencyName
                        })) || []
                      }
                      value={formData.cus_payment_currency || ''}
                      onChange={(value) => setFormData({ ...formData, cus_payment_currency: Number(value) })}
                      placeholder="Currency"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-success">
              <i className="fa fa-save me-2"></i>
              {hotel ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

