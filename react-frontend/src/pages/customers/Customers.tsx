import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { customerService } from '../../services/customerService';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { Customer, CustomerFilters, CreateCustomerRequest, UpdateCustomerRequest } from '../../types/customer';
import './Customers.css';

interface Supplier {
  supp_id: number;
  supp_name: string;
}

export default function Customers() {
  const [filters, setFilters] = useState<CustomerFilters>({
    page: 1,
    per_page: 10
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<CreateCustomerRequest>>({
    customer_name: '',
    customer_phone: '',
    customer_whatsapp: '',
    customer_address: '',
    customer_email: '',
    customer_password: '',
    customer_status: 1,
    supplier_id: -1
  });
  
  const queryClient = useQueryClient();
  
  // Load suppliers for dropdown
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers-dropdown'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/payment/dropdowns.php?type=suppliers');
        return response.data.success ? response.data.data.suppliers || [] : [];
      } catch (error) {
        return [];
      }
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load customers
  const { data: customersResult, refetch: refetchCustomers } = useQuery({
    queryKey: ['customers', filters],
    queryFn: () => customerService.getCustomers(filters),
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  const customers = customersResult?.data || [];
  const pagination = customersResult?.pagination;
  
  // Add customer mutation
  const addCustomerMutation = useMutation({
    mutationFn: (data: CreateCustomerRequest) => customerService.addCustomer(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Customer added successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowAddModal(false);
      resetForm();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to add customer'
      });
    }
  });
  
  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: (data: UpdateCustomerRequest) => customerService.updateCustomer(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Customer updated successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
      resetForm();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to update customer'
      });
    }
  });
  
  // Delete customer mutation
  const deleteCustomerMutation = useMutation({
    mutationFn: (customer_id: number) => customerService.deleteCustomer(customer_id),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Customer deleted successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to delete customer'
      });
    }
  });
  
  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_phone: '',
      customer_whatsapp: '',
      customer_address: '',
      customer_email: '',
      customer_password: '',
      customer_status: 1,
      supplier_id: -1
    });
  };
  
  const handleAddCustomer = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const handleEditCustomer = async (customer: Customer) => {
    try {
      const fullCustomer = await customerService.getCustomer(customer.customer_id);
      setFormData({
        customer_name: fullCustomer.customer_name || '',
        customer_phone: fullCustomer.customer_phone || '',
        customer_whatsapp: fullCustomer.customer_whatsapp || '',
        customer_address: fullCustomer.customer_address || '',
        customer_email: fullCustomer.customer_email || '',
        customer_password: '',
        customer_status: typeof fullCustomer.status === 'string' 
          ? (fullCustomer.status === 'Active' ? 1 : 2)
          : fullCustomer.status,
        supplier_id: fullCustomer.affliate_supp_id || -1
      });
      setEditingCustomer(customer);
    } catch (error) {
      console.error('Error fetching customer:', error);
      // Fallback to using customer data from table
      setFormData({
        customer_name: customer.customer_name || '',
        customer_phone: customer.customer_phone || '',
        customer_whatsapp: customer.customer_whatsapp || '',
        customer_address: customer.customer_address || '',
        customer_email: customer.customer_email || '',
        customer_password: '',
        customer_status: typeof customer.status === 'string' 
          ? (customer.status === 'Active' ? 1 : 2)
          : customer.status,
        supplier_id: customer.affliate_supp_id || -1
      });
      setEditingCustomer(customer);
    }
  };
  
  const handleDeleteCustomer = (customer_id: number) => {
    Swal.fire({
      title: 'Delete!',
      text: 'Do you want to delete this customer?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteCustomerMutation.mutate(customer_id);
      }
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_name) {
      Swal.fire({
        icon: 'error',
        title: 'Validation Error!',
        text: 'Customer name is required'
      });
      return;
    }
    
    // Prepare data for submission
    const submitData: CreateCustomerRequest = {
      customer_name: formData.customer_name || '',
      customer_phone: formData.customer_phone || '',
      customer_whatsapp: formData.customer_whatsapp || '',
      customer_address: formData.customer_address || '',
      customer_email: formData.customer_email || '',
      customer_password: formData.customer_password || '',
      customer_status: formData.customer_status || 1,
      supplier_id: formData.supplier_id === -1 ? null : (formData.supplier_id || null)
    };
    
    if (editingCustomer) {
      updateCustomerMutation.mutate({
        ...submitData,
        customer_id: editingCustomer.customer_id
      });
    } else {
      addCustomerMutation.mutate(submitData);
    }
  };
  
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
  };
  
  const handleResetFilters = () => {
    setFilters({
      page: 1,
      per_page: filters.per_page || 10
    });
  };
  
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };
  
  const handlePerPageChange = (newPerPage: number) => {
    setFilters(prev => ({ ...prev, per_page: newPerPage, page: 1 }));
  };
  
  useEffect(() => {
    refetchCustomers();
  }, [filters]);
  
  return (
    <div className="customers-page">
      <div className="page-header">
        <h1><i className="fa fa-user me-2"></i>Customers Report</h1>
        <button className="btn btn-success" onClick={handleAddCustomer}>
          <i className="fa fa-plus me-2"></i>Add Customer
        </button>
      </div>
      
      {/* Filter Card */}
      <div className="panel filter-card">
        <div className="panel-header">
          <h3><i className="fa fa-filter me-2"></i>Filter Customers</h3>
        </div>
        <div className="panel-body">
          <div className="filter-form-row">
            <div className="filter-form-group">
              <label htmlFor="filter_name" className="form-label">Customer Name</label>
              <input
                type="text"
                className="form-control"
                id="filter_name"
                placeholder="Search by name"
                value={filters.filter_name || ''}
                onChange={(e) => setFilters({ ...filters, filter_name: e.target.value, page: 1 })}
              />
            </div>
            <div className="filter-form-group">
              <label htmlFor="filter_phone" className="form-label">Phone Number</label>
              <input
                type="text"
                className="form-control"
                id="filter_phone"
                placeholder="Search by phone"
                value={filters.filter_phone || ''}
                onChange={(e) => setFilters({ ...filters, filter_phone: e.target.value, page: 1 })}
              />
            </div>
            <div className="filter-form-group">
              <label htmlFor="filter_email" className="form-label">Email</label>
              <input
                type="text"
                className="form-control"
                id="filter_email"
                placeholder="Search by email"
                value={filters.filter_email || ''}
                onChange={(e) => setFilters({ ...filters, filter_email: e.target.value, page: 1 })}
              />
            </div>
            <div className="filter-form-group">
              <label htmlFor="filter_status" className="form-label">Status</label>
              <select
                className="form-control"
                id="filter_status"
                value={filters.filter_status || ''}
                onChange={(e) => setFilters({ ...filters, filter_status: e.target.value, page: 1 })}
              >
                <option value="">All</option>
                <option value="1">Active</option>
                <option value="2">Inactive</option>
              </select>
            </div>
            <div className="filter-form-group">
              <label htmlFor="filter_supplier" className="form-label">Supplier</label>
              <SearchableSelect
                options={[
                  { value: '', label: 'All Suppliers' },
                  ...(suppliers?.map(s => ({
                    value: String(s.supp_id),
                    label: s.supp_name
                  })) || [])
                ]}
                value={filters.filter_supplier ? String(filters.filter_supplier) : ''}
                onChange={(value) => setFilters({ ...filters, filter_supplier: value ? Number(value) : undefined, page: 1 })}
                placeholder="Select Supplier"
              />
            </div>
            <div className="filter-button-group">
              <button type="button" onClick={handleSearch} className="btn btn-primary">
                <i className="fa fa-search me-2"></i>Search
              </button>
              <button type="button" onClick={handleResetFilters} className="btn btn-secondary">
                <i className="fa fa-refresh me-2"></i>Reset
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Customers Table */}
      <div className="panel">
        <div className="panel-header">
          <h3><i className="fa fa-list me-2"></i>Customers</h3>
        </div>
        <div className="panel-body">
          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr className="text-center">
                  <th>S#</th>
                  <th>Customer Name</th>
                  <th>Customer Phone</th>
                  <th>Customer Whatsapp</th>
                  <th>Customer Address</th>
                  <th>Customer Email</th>
                  <th>Password</th>
                  <th>Status</th>
                  <th>Affiliate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center">No records found</td>
                  </tr>
                ) : (
                  customers.map((customer, index) => (
                    <tr key={customer.customer_id}>
                      <td className="text-center">{((pagination?.page || 1) - 1) * (pagination?.per_page || 10) + index + 1}</td>
                      <td className="text-capitalize text-center">{customer.customer_name}</td>
                      <td className="text-center">{customer.customer_phone || '-'}</td>
                      <td className="text-center">{customer.customer_whatsapp || '-'}</td>
                      <td className="text-capitalize text-center">{customer.customer_address || '-'}</td>
                      <td className="text-center">{customer.customer_email || '-'}</td>
                      <td className="text-center">{customer.cust_password || '-'}</td>
                      <td className="text-center">
                        <span className={`badge ${customer.status === 'Active' || customer.status === 1 ? 'badge-active' : 'badge-inactive'} rounded-pill`}>
                          {customer.status === 'Active' || customer.status === 1 ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="text-center">
                        {customer.affliate_supp_id && customer.affliate_supp_id > 0 ? (
                          <span className="badge badge-info">
                            <i className="fas fa-medal me-1"></i>
                            {customer.affiliate_supplier_name || `Supplier #${customer.affliate_supp_id}`}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="text-center" style={{ width: '150px' }}>
                        <button
                          type="button"
                          onClick={() => handleEditCustomer(customer)}
                          className="btn btn-sm btn-info me-2"
                        >
                          <i className="fa fa-edit"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(customer.customer_id)}
                          className="btn btn-sm btn-danger"
                        >
                          <i className="fa fa-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {pagination && pagination.total > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} entries
              </div>
              <div className="pagination-controls">
                <select
                  className="form-control per-page-select"
                  value={filters.per_page || 10}
                  onChange={(e) => handlePerPageChange(Number(e.target.value))}
                >
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
                <div className="pagination-buttons">
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                  >
                    <i className="fa fa-chevron-left"></i> Previous
                  </button>
                  <span className="page-info">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.total_pages}
                  >
                    Next <i className="fa fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Add/Edit Modal */}
      {(showAddModal || editingCustomer) && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          setEditingCustomer(null);
          resetForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                <i className="fa fa-user me-2"></i>
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </h3>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingCustomer(null);
                  resetForm();
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-user me-2"></i>Customer Name:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="customer_name"
                      value={formData.customer_name || ''}
                      onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                      placeholder="Customer Name"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-phone me-2"></i>Customer Phone:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="customer_phone"
                      value={formData.customer_phone || ''}
                      onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                      placeholder="Customer Phone"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-whatsapp me-2"></i>Customer Whatsapp:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="customer_whatsapp"
                      value={formData.customer_whatsapp || ''}
                      onChange={(e) => setFormData({ ...formData, customer_whatsapp: e.target.value })}
                      placeholder="Customer Whatsapp"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-envelope me-2"></i>Customer Email:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="customer_email"
                      value={formData.customer_email || ''}
                      onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                      placeholder="Customer Email"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-address-card me-2"></i>Customer Address:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="customer_address"
                      value={formData.customer_address || ''}
                      onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                      placeholder="Customer Address"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-key me-2"></i>Customer Password:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      name="customer_password"
                      value={formData.customer_password || ''}
                      onChange={(e) => setFormData({ ...formData, customer_password: e.target.value })}
                      placeholder="Customer Password (leave empty for default)"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-key me-2"></i>Customer Status:
                    </label>
                    <select
                      className="form-control"
                      name="customer_status"
                      value={formData.customer_status || 1}
                      onChange={(e) => setFormData({ ...formData, customer_status: Number(e.target.value) })}
                    >
                      <option value="1">Active</option>
                      <option value="2">Deactive</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <i className="fa fa-user me-2"></i>Affiliate Supplier:
                    </label>
                    <SearchableSelect
                      options={[
                        { value: '-1', label: '--Supplier--' },
                        ...(suppliers?.map(s => ({
                          value: String(s.supp_id),
                          label: s.supp_name
                        })) || [])
                      ]}
                      value={formData.supplier_id ? String(formData.supplier_id) : '-1'}
                      onChange={(value) => setFormData({ ...formData, supplier_id: value ? Number(value) : -1 })}
                      placeholder="Select Supplier"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingCustomer(null);
                      resetForm();
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={addCustomerMutation.isPending || updateCustomerMutation.isPending}
                  >
                    {(addCustomerMutation.isPending || updateCustomerMutation.isPending) ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-2"></i>
                        {editingCustomer ? 'Updating...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <i className="fa fa-save me-2"></i>
                        Save
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
