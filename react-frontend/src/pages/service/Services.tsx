import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import serviceService from '../../services/serviceService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type {
  Service,
  ServiceFilters,
  CreateServiceRequest,
  ServiceDropdownData
} from '../../types/service';
import './Services.css';

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function Services() {
  const [activeTab, setActiveTab] = useState<'records' | 'other'>('records');
  const [filters, setFilters] = useState<ServiceFilters>({
    start_date: getTodayDate(),
    end_date: getTodayDate()
  });
  const [hasSearched, setHasSearched] = useState(false);
  const [serviceModal, setServiceModal] = useState<{
    isOpen: boolean;
    service: Service | null;
  }>({ isOpen: false, service: null });
  const [addServiceTypeModal, setAddServiceTypeModal] = useState(false);
  const [newServiceType, setNewServiceType] = useState('');
  const [managementFilters, setManagementFilters] = useState<ServiceFilters>({
    start_date: getTodayDate(),
    end_date: getTodayDate()
  });
  const [hasSearchedManagement, setHasSearchedManagement] = useState(false);
  const [chargeModal, setChargeModal] = useState<{
    isOpen: boolean;
    service: Service | null;
  }>({ isOpen: false, service: null });
  
  const queryClient = useQueryClient();
  
  // Load dropdowns
  const { data: dropdowns, error: dropdownsError } = useQuery<ServiceDropdownData>({
    queryKey: ['service-dropdowns'],
    queryFn: () => serviceService.getDropdowns(),
    retry: 2
  });
  
  useEffect(() => {
    if (dropdownsError) {
      console.error('Error loading dropdowns:', dropdownsError);
      Swal.fire('Error', 'Failed to load dropdown data. Please refresh the page.', 'error');
    }
  }, [dropdownsError]);
  
  // Load services - enable query when filters are set or after search
  const { data: services = [], isLoading: servicesLoading, refetch: refetchServices } = useQuery<Service[]>({
    queryKey: ['services', filters],
    queryFn: () => serviceService.getServices(filters),
    enabled: hasSearched || Object.keys(filters).length > 0
  });
  
  // Load services for management tab
  const { data: managementServices = [], isLoading: managementLoading, refetch: refetchManagement } = useQuery<Service[]>({
    queryKey: ['services-management', managementFilters],
    queryFn: () => serviceService.getServices(managementFilters),
    enabled: hasSearchedManagement || Object.keys(managementFilters).length > 0
  });
  
  // Mutations
  const createServiceMutation = useMutation({
    mutationFn: (data: CreateServiceRequest) => serviceService.createService(data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setServiceModal({ isOpen: false, service: null });
      
      // Auto-search by the customer and service that was just added
      const newFilters: ServiceFilters = {
        customer_id: variables.customer_id,
        service_id: variables.service_id
      };
      setFilters(newFilters);
      setHasSearched(true);
      
      Swal.fire('Success', 'Service added successfully', 'success');
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['services', newFilters] });
      }, 500);
      return data;
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to add service', 'error');
    }
  });
  
  const updateServiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateServiceRequest> }) =>
      serviceService.updateService(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setServiceModal({ isOpen: false, service: null });
      Swal.fire('Success', 'Service updated successfully', 'success');
      setTimeout(() => refetchServices(), 500);
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to update service', 'error');
    }
  });
  
  const deleteServiceMutation = useMutation({
    mutationFn: (id: number) => serviceService.deleteService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      Swal.fire('Success', 'Service deleted successfully', 'success');
      setTimeout(() => refetchServices(), 500);
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to delete service', 'error');
    }
  });
  
  const addServiceTypeMutation = useMutation({
    mutationFn: (serviceName: string) => serviceService.addServiceType(serviceName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-dropdowns'] });
      setAddServiceTypeModal(false);
      setNewServiceType('');
      Swal.fire('Success', 'Service type added successfully', 'success');
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to add service type', 'error');
    }
  });
  
  const updateChargeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { supplier_id?: number | null; account_id?: number | null; net_price: number; net_currency_id: number } }) =>
      serviceService.updateServiceCharge(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['services-management'] });
      setChargeModal({ isOpen: false, service: null });
      Swal.fire('Success', 'Service charge updated successfully', 'success');
      setTimeout(() => {
        refetchManagement();
        refetchServices();
      }, 500);
    },
    onError: (error) => {
      Swal.fire('Error', (error as any).response?.data?.message || 'Failed to update service charge', 'error');
    }
  });
  
  const handleSearch = () => {
    // Allow searching with empty filters to show all records
    setHasSearched(true);
    refetchServices();
  };
  
  const handleClearFilters = () => {
    setFilters({
      start_date: getTodayDate(),
      end_date: getTodayDate()
    });
    setHasSearched(false);
  };
  
  const handleAddService = () => {
    setServiceModal({ isOpen: true, service: null });
  };
  
  const handleEditService = async (service: Service) => {
    setServiceModal({ isOpen: true, service });
  };
  
  const handleDeleteService = (id: number) => {
    Swal.fire({
      title: 'Delete Service?',
      text: 'Are you sure you want to delete this service?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteServiceMutation.mutate(id);
      }
    });
  };
  
  const handleAddServiceType = () => {
    if (!newServiceType.trim()) {
      Swal.fire('Validation Error', 'Service name is required', 'error');
      return;
    }
    addServiceTypeMutation.mutate(newServiceType.trim());
  };
  
  const handleSearchManagement = () => {
    setHasSearchedManagement(true);
    refetchManagement();
  };
  
  const handleClearManagementFilters = () => {
    setManagementFilters({
      start_date: getTodayDate(),
      end_date: getTodayDate()
    });
    setHasSearchedManagement(false);
  };
  
  const handleAssignCharge = (service: Service) => {
    setChargeModal({ isOpen: true, service });
  };
  
  return (
    <div className="services-page">
      <div className="page-header">
        <h1><i className="fab fa-servicestack me-2"></i>Services</h1>
        {activeTab === 'records' && (
          <button className="btn btn-success" onClick={handleAddService}>
            <i className="fa fa-plus me-2"></i>
            Add Service
          </button>
        )}
      </div>
      
      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'records' ? 'active' : ''}`}
            onClick={() => setActiveTab('records')}
          >
            <i className="fa fa-list me-2"></i>
            Service Records
          </button>
          <button
            className={`tab ${activeTab === 'other' ? 'active' : ''}`}
            onClick={() => setActiveTab('other')}
          >
            <i className="fa fa-cog me-2"></i>
            Service Management
          </button>
        </div>
      </div>
      
      {activeTab === 'records' && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h3>Search Services</h3>
            </div>
            <div className="panel-body">
              <div className="search-filters">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={filters.start_date || ''}
                      onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="filter-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={filters.end_date || ''}
                      onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Service Type</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '-- Select Service --' },
                        ...(dropdowns?.services?.map(s => ({
                          value: s.serviceID,
                          label: s.serviceName
                        })) || [])
                      ]}
                      value={filters.service_id || ''}
                      onChange={(value) => {
                        setFilters({ ...filters, service_id: value ? Number(value) : undefined });
                      }}
                      placeholder="-- Select Service --"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Customer</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '-- Customer --' },
                        ...(dropdowns?.customers?.map(c => ({
                          value: c.customer_id,
                          label: c.customer_name
                        })) || [])
                      ]}
                      value={filters.customer_id || ''}
                      onChange={(value) => {
                        setFilters({ ...filters, customer_id: value ? Number(value) : undefined });
                      }}
                      placeholder="-- Customer --"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Passenger Name</label>
                    <input
                      type="text"
                      value={filters.passenger_name || ''}
                      onChange={(e) => setFilters({ ...filters, passenger_name: e.target.value })}
                      className="form-control"
                      placeholder="Enter passenger name"
                    />
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>&nbsp;</label>
                    <button className="btn btn-primary w-100" onClick={handleSearch}>
                      <i className="fa fa-search me-2"></i>
                      Search
                    </button>
                  </div>
                  <div className="filter-group">
                    <label>&nbsp;</label>
                    <button className="btn btn-secondary w-100" onClick={handleClearFilters}>
                      <i className="fa fa-times me-2"></i>
                      Clear
                    </button>
                  </div>
                </div>
                <div className="mt-2">
                  <small className="text-muted">
                    <i className="fa fa-info-circle me-1"></i>
                    Leave filters empty and click Search to view all records
                  </small>
                </div>
              </div>
            </div>
          </div>
          
          <div className="panel">
            <div className="panel-header">
              <h3>Service Report</h3>
            </div>
        <div className="panel-body">
          {servicesLoading ? (
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
                    <th>Service Type</th>
                    <th>Customer Name</th>
                    <th>Passenger Name</th>
                    <th>Service Date</th>
                    <th>Service Detail</th>
                    <th>Sale Price</th>
                    <th>Net Price</th>
                    <th>Charged On</th>
                    <th>Provider</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center">
                        {hasSearched ? 'No services found' : 'Please click Search to view records'}
                      </td>
                    </tr>
                  ) : (
                    services.map((service, index) => (
                      <tr key={service.serviceDetailsID}>
                        <td>{index + 1}</td>
                        <td className="text-capitalize">{service.serviceName}</td>
                        <td className="text-capitalize">{service.customer_name}</td>
                        <td className="text-capitalize">{service.passenger_name}</td>
                        <td>{new Date(service.service_date).toLocaleDateString()}</td>
                        <td className="text-capitalize">{service.service_details}</td>
                        <td>
                          {service.salePrice.toLocaleString()} {service.currencyName}
                        </td>
                        <td>
                          {service.netPrice > 0 ? (
                            <>
                              {service.netPrice.toLocaleString()} {service.currencyName}
                            </>
                          ) : (
                            <span className="text-muted">Not set</span>
                          )}
                        </td>
                        <td>
                          <button
                            className={`btn btn-sm btn-block ${
                              service.chargeFlag === 'bySupplier' 
                                ? 'bg-gradient-littleLeaf' 
                                : 'bg-graident-Lawrencium'
                            } text-white`}
                            style={{ width: '100%' }}
                          >
                            {service.ChargedEntity}
                          </button>
                        </td>
                        <td className="text-capitalize">{service.staff_name}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleEditService(service)}
                              title="Edit"
                            >
                              <i className="fa fa-edit"></i>
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteService(service.serviceDetailsID)}
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
        </>
      )}
      
      {activeTab === 'other' && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h3>Search Services for Management</h3>
            </div>
            <div className="panel-body">
              <div className="search-filters">
                <div className="filter-row">
                  <div className="filter-group">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={managementFilters.start_date || ''}
                      onChange={(e) => setManagementFilters({ ...managementFilters, start_date: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="filter-group">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={managementFilters.end_date || ''}
                      onChange={(e) => setManagementFilters({ ...managementFilters, end_date: e.target.value })}
                      className="form-control"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Service Type</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '-- Select Service --' },
                        ...(dropdowns?.services?.map(s => ({
                          value: s.serviceID,
                          label: s.serviceName
                        })) || [])
                      ]}
                      value={managementFilters.service_id || ''}
                      onChange={(value) => {
                        setManagementFilters({ ...managementFilters, service_id: value ? Number(value) : undefined });
                      }}
                      placeholder="-- Select Service --"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Customer</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '-- Customer --' },
                        ...(dropdowns?.customers?.map(c => ({
                          value: c.customer_id,
                          label: c.customer_name
                        })) || [])
                      ]}
                      value={managementFilters.customer_id || ''}
                      onChange={(value) => {
                        setManagementFilters({ ...managementFilters, customer_id: value ? Number(value) : undefined });
                      }}
                      placeholder="-- Customer --"
                    />
                  </div>
                  <div className="filter-group">
                    <label>Passenger Name</label>
                    <input
                      type="text"
                      value={managementFilters.passenger_name || ''}
                      onChange={(e) => setManagementFilters({ ...managementFilters, passenger_name: e.target.value })}
                      className="form-control"
                      placeholder="Enter passenger name"
                    />
                  </div>
                </div>
                <div className="filter-row">
                  <div className="filter-group">
                    <label>&nbsp;</label>
                    <button className="btn btn-primary w-100" onClick={handleSearchManagement}>
                      <i className="fa fa-search me-2"></i>
                      Search
                    </button>
                  </div>
                  <div className="filter-group">
                    <label>&nbsp;</label>
                    <button className="btn btn-secondary w-100" onClick={handleClearManagementFilters}>
                      <i className="fa fa-times me-2"></i>
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="panel">
            <div className="panel-header">
              <h3>Service Management</h3>
            </div>
            <div className="panel-body">
              {managementLoading ? (
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
                        <th>Service Type</th>
                        <th>Customer Name</th>
                        <th>Passenger Name</th>
                        <th>Service Date</th>
                        <th>Service Detail</th>
                        <th>Sale Price</th>
                        <th>Net Price</th>
                        <th>Charged On</th>
                        <th>Provider</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {managementServices.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="text-center">
                            {hasSearchedManagement ? 'No services found' : 'Please click Search to view records'}
                          </td>
                        </tr>
                      ) : (
                        managementServices.map((service, index) => (
                          <tr key={service.serviceDetailsID}>
                            <td>{index + 1}</td>
                            <td className="text-capitalize">{service.serviceName}</td>
                            <td className="text-capitalize">{service.customer_name}</td>
                            <td className="text-capitalize">{service.passenger_name}</td>
                            <td>{new Date(service.service_date).toLocaleDateString()}</td>
                            <td className="text-capitalize">{service.service_details}</td>
                            <td>
                              {service.salePrice.toLocaleString()} {service.currencyName}
                            </td>
                            <td>
                              {service.netPrice > 0 ? (
                                <>
                                  {service.netPrice.toLocaleString()} {service.currencyName}
                                </>
                              ) : (
                                <span className="text-muted">Not set</span>
                              )}
                            </td>
                            <td>
                              {service.ChargedEntity ? (
                                <button
                                  className={`btn btn-sm btn-block ${
                                    service.chargeFlag === 'bySupplier' 
                                      ? 'bg-gradient-littleLeaf' 
                                      : 'bg-graident-Lawrencium'
                                  } text-white`}
                                  style={{ width: '100%' }}
                                >
                                  {service.ChargedEntity}
                                </button>
                              ) : (
                                <span className="text-muted">Not assigned</span>
                              )}
                            </td>
                            <td className="text-capitalize">{service.staff_name}</td>
                            <td>
                              <button
                                className="btn btn-sm btn-warning"
                                onClick={() => handleAssignCharge(service)}
                                title="Assign Charge"
                              >
                                <i className="fa fa-credit-card"></i>
                              </button>
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
        </>
      )}
      
      {/* Service Modal */}
      {serviceModal.isOpen && (
        <ServiceModal
          service={serviceModal.service}
          dropdowns={dropdowns}
          onClose={() => setServiceModal({ isOpen: false, service: null })}
          onSubmit={(data) => {
            if (serviceModal.service) {
              updateServiceMutation.mutate({ id: serviceModal.service.serviceDetailsID, data });
            } else {
              createServiceMutation.mutate(data as CreateServiceRequest);
            }
          }}
          onAddServiceType={() => setAddServiceTypeModal(true)}
        />
      )}
      
      {/* Charge Assignment Modal */}
      {chargeModal.isOpen && chargeModal.service && (
        <ChargeAssignmentModal
          service={chargeModal.service}
          dropdowns={dropdowns}
          onClose={() => setChargeModal({ isOpen: false, service: null })}
          onSubmit={(data) => {
            updateChargeMutation.mutate({ id: chargeModal.service!.serviceDetailsID, data });
          }}
        />
      )}
      
      {/* Add Service Type Modal */}
      {addServiceTypeModal && (
        <div className="modal-overlay" onClick={() => setAddServiceTypeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Service Type</h3>
              <button className="btn-close" onClick={() => setAddServiceTypeModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Service Name <span className="text-danger">*</span></label>
                <input
                  type="text"
                  value={newServiceType}
                  onChange={(e) => setNewServiceType(e.target.value)}
                  className="form-control"
                  placeholder="Type service name here"
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAddServiceTypeModal(false)}>Close</button>
              <button type="button" className="btn btn-success" onClick={handleAddServiceType}>
                <i className="fa fa-save me-2"></i>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Service Modal Component
function ServiceModal({
  service,
  dropdowns,
  onClose,
  onSubmit,
  onAddServiceType
}: {
  service: Service | null;
  dropdowns?: ServiceDropdownData;
  onClose: () => void;
  onSubmit: (data: Partial<CreateServiceRequest>) => void;
  onAddServiceType: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CreateServiceRequest>>({
    service_id: service?.serviceID || undefined,
    customer_id: service?.customer_id || undefined,
    passenger_name: service?.passenger_name || '',
    service_details: service?.service_details || '',
    sale_price: service?.salePrice || 0,
    sale_currency_id: service?.saleCurrencyID || undefined
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (service) {
      setFormData({
        service_id: service.serviceID,
        customer_id: service.customer_id,
        passenger_name: service.passenger_name,
        service_details: service.service_details,
        sale_price: service.salePrice,
        sale_currency_id: service.saleCurrencyID
      });
    } else {
      // Reset form for new service
      const defaultCurrency = dropdowns?.currencies?.[0]?.currencyID;
      setFormData({
        service_id: undefined,
        customer_id: undefined,
        passenger_name: '',
        service_details: '',
        sale_price: 0,
        sale_currency_id: defaultCurrency
      });
    }
  }, [service, dropdowns]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    
    if (!formData.service_id) newErrors.service_id = 'Service type is required';
    if (!formData.customer_id) newErrors.customer_id = 'Customer is required';
    if (!formData.passenger_name) newErrors.passenger_name = 'Passenger name is required';
    if (!formData.service_details) newErrors.service_details = 'Service detail is required';
    if (!formData.sale_price || formData.sale_price <= 0) newErrors.sale_price = 'Sale price must be greater than 0';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
  };
  
  const handleServiceTypeChange = (value: string) => {
    if (value === '-1') {
      onClose();
      onAddServiceType();
    } else {
      setFormData({ ...formData, service_id: Number(value) });
      setErrors({ ...errors, service_id: '' });
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{service ? 'Edit Service' : 'Add Service'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label><i className="fab fa-servicestack me-2"></i>Service Type <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '-1', label: '+ Add Service' },
                    ...(dropdowns?.services?.map(s => ({
                      value: s.serviceID,
                      label: s.serviceName
                    })) || [])
                  ]}
                  value={formData.service_id || ''}
                  onChange={handleServiceTypeChange}
                  placeholder="Select Service Type"
                  required
                />
                {errors.service_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.service_id}</div>}
              </div>
              
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
                  placeholder="Enter passenger name"
                />
                {errors.passenger_name && <div className="invalid-feedback">{errors.passenger_name}</div>}
              </div>
            </div>
            
            <div className="form-group mb-3">
              <label><i className="fa fa-arrow-down me-2"></i>Service Detail <span className="text-danger">*</span></label>
              <textarea
                value={formData.service_details}
                onChange={(e) => {
                  setFormData({ ...formData, service_details: e.target.value });
                  setErrors({ ...errors, service_details: '' });
                }}
                className={`form-control ${errors.service_details ? 'is-invalid' : ''}`}
                rows={3}
                placeholder="Service detail is must"
              />
              {errors.service_details && <div className="invalid-feedback">{errors.service_details}</div>}
            </div>
            
            <div className="form-group mb-3">
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
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-success">
              <i className="fa fa-save me-2"></i>
              {service ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Charge Assignment Modal Component
function ChargeAssignmentModal({
  service,
  dropdowns,
  onClose,
  onSubmit
}: {
  service: Service;
  dropdowns?: ServiceDropdownData;
  onClose: () => void;
  onSubmit: (data: { supplier_id?: number | null; account_id?: number | null; net_price: number; net_currency_id: number }) => void;
}) {
  const [paymentType, setPaymentType] = useState<'supplier' | 'account'>('supplier');
  const [formData, setFormData] = useState<{
    supplier_id?: number | null;
    account_id?: number | null;
    net_price: number;
    net_currency_id?: number;
  }>({
    supplier_id: service.Supplier_id || null,
    account_id: service.accoundID || null,
    net_price: service.netPrice || 0,
    net_currency_id: service.netCurrencyID || dropdowns?.currencies?.[0]?.currencyID
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    // Determine payment type based on existing data
    if (service.Supplier_id) {
      setPaymentType('supplier');
      setFormData(prev => ({
        ...prev,
        supplier_id: service.Supplier_id,
        account_id: null
      }));
    } else if (service.accoundID) {
      setPaymentType('account');
      setFormData(prev => ({
        ...prev,
        supplier_id: null,
        account_id: service.accoundID
      }));
    }
    
    if (service.netPrice > 0) {
      setFormData(prev => ({
        ...prev,
        net_price: service.netPrice,
        net_currency_id: service.netCurrencyID
      }));
    }
  }, [service, dropdowns]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    
    if (paymentType === 'supplier' && (!formData.supplier_id || formData.supplier_id === -1)) {
      newErrors.supplier_id = 'Supplier is required';
    }
    if (paymentType === 'account' && (!formData.account_id || formData.account_id === -1)) {
      newErrors.account_id = 'Account is required';
    }
    if (!formData.net_price || formData.net_price <= 0) {
      newErrors.net_price = 'Net price must be greater than 0';
    }
    if (!formData.net_currency_id) {
      newErrors.net_currency_id = 'Currency is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    const submitData = {
      supplier_id: paymentType === 'supplier' ? formData.supplier_id : null,
      account_id: paymentType === 'account' ? formData.account_id : null,
      net_price: formData.net_price,
      net_currency_id: formData.net_currency_id!
    };
    
    onSubmit(submitData);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Assign Service Charge</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="panel mb-3">
              <div className="panel-body">
                <div className="row">
                  <div className="col-md-6">
                    <strong>Service:</strong> {service.serviceName}
                  </div>
                  <div className="col-md-6">
                    <strong>Customer:</strong> {service.customer_name}
                  </div>
                  <div className="col-md-6 mt-2">
                    <strong>Passenger:</strong> {service.passenger_name}
                  </div>
                  <div className="col-md-6 mt-2">
                    <strong>Sale Price:</strong> {service.salePrice.toLocaleString()} {service.currencyName}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="form-group mb-3">
              <label className="mb-2">Charge Payment Type <span className="text-danger">*</span></label>
              <div className="payment-type-selector">
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="paymentType"
                    id="paymentSupplier"
                    value="supplier"
                    checked={paymentType === 'supplier'}
                    onChange={(e) => {
                      setPaymentType('supplier');
                      setFormData({ ...formData, account_id: null });
                      setErrors({ ...errors, supplier_id: '', account_id: '' });
                    }}
                  />
                  <label className="form-check-label" htmlFor="paymentSupplier">
                    Through Supplier
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="paymentType"
                    id="paymentAccount"
                    value="account"
                    checked={paymentType === 'account'}
                    onChange={(e) => {
                      setPaymentType('account');
                      setFormData({ ...formData, supplier_id: null });
                      setErrors({ ...errors, supplier_id: '', account_id: '' });
                    }}
                  />
                  <label className="form-check-label" htmlFor="paymentAccount">
                    Direct Account Payment
                  </label>
                </div>
              </div>
            </div>
            
            {paymentType === 'supplier' && (
              <div className="form-group mb-3">
                <label><i className="fa fa-truck me-2"></i>Supplier <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '', label: '-- Select Supplier --' },
                    ...(dropdowns?.suppliers?.map(s => ({
                      value: s.supp_id,
                      label: s.supp_name
                    })) || [])
                  ]}
                  value={formData.supplier_id || ''}
                  onChange={(value) => {
                    setFormData({ ...formData, supplier_id: value ? Number(value) : null });
                    setErrors({ ...errors, supplier_id: '' });
                  }}
                  placeholder="Select Supplier"
                  required
                />
                {errors.supplier_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.supplier_id}</div>}
              </div>
            )}
            
            {paymentType === 'account' && (
              <div className="form-group mb-3">
                <label><i className="fa fa-university me-2"></i>Account <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={[
                    { value: '', label: '-- Select Account --' },
                    ...(dropdowns?.accounts?.map(a => ({
                      value: a.account_ID,
                      label: a.account_Name
                    })) || [])
                  ]}
                  value={formData.account_id || ''}
                  onChange={(value) => {
                    setFormData({ ...formData, account_id: value ? Number(value) : null });
                    setErrors({ ...errors, account_id: '' });
                  }}
                  placeholder="Select Account"
                  required
                />
                {errors.account_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.account_id}</div>}
              </div>
            )}
            
            <div className="form-group mb-3">
              <label><i className="fa fa-money-bill me-2"></i>Net Price <span className="text-danger">*</span></label>
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
                  onChange={(value) => {
                    setFormData({ ...formData, net_currency_id: Number(value) });
                    setErrors({ ...errors, net_currency_id: '' });
                  }}
                  placeholder="Currency"
                />
              </div>
              {errors.net_price && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.net_price}</div>}
              {errors.net_currency_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.net_currency_id}</div>}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-success">
              <i className="fa fa-save me-2"></i>
              Assign Charge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

