import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { supplierPaymentService } from '../../services/paymentService';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { SupplierPayment, SupplierPaymentFilters, CreateSupplierPaymentRequest, TotalCharge } from '../../types/payment';
import './SupplierPayments.css';

interface DropdownData {
  suppliers: Array<{ supp_id: number; supp_name: string }>;
  accounts: Array<{ account_ID: number; account_Name: string }>;
  currencies: Array<{ currencyID: number; currencyName: string }>;
}

export default function SupplierPayments() {
  const [filters, setFilters] = useState<SupplierPaymentFilters>({
    date_search_enabled: false,
    page: 1,
    per_page: 20
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [formData, setFormData] = useState<Partial<CreateSupplierPaymentRequest>>({
    supplier_id: undefined,
    payment_amount: undefined,
    currency_id: undefined,
    payment_detail: '',
    account_id: undefined
  });
  const [totalCharges, setTotalCharges] = useState<TotalCharge[]>([]);
  
  const queryClient = useQueryClient();
  
  // Load dropdowns
  const { data: dropdowns, isLoading: dropdownsLoading, error: dropdownsError } = useQuery<DropdownData>({
    queryKey: ['supplier-payment-dropdowns'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/payment/dropdowns.php?type=suppliers,accounts,currencies');
        console.log('Dropdowns response:', response.data);
        if (response.data.success && response.data.data) {
          return response.data.data;
        }
        console.warn('Dropdowns API returned unsuccessful response:', response.data);
        return { suppliers: [], accounts: [], currencies: [] };
      } catch (error: any) {
        console.error('Error loading dropdowns:', error);
        console.error('Error details:', error.response?.data);
        return { suppliers: [], accounts: [], currencies: [] };
      }
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Debug: Log dropdowns data
  useEffect(() => {
    if (dropdowns) {
      console.log('Dropdowns loaded:', dropdowns);
      console.log('Suppliers count:', dropdowns.suppliers?.length || 0);
      console.log('Accounts count:', dropdowns.accounts?.length || 0);
      console.log('Currencies count:', dropdowns.currencies?.length || 0);
    }
    if (dropdownsError) {
      console.error('Dropdowns error:', dropdownsError);
    }
  }, [dropdowns, dropdownsError]);
  
  // Load payments - always enabled to load on mount
  const { data: paymentsResult, refetch: refetchPayments, error: paymentsError, isLoading: paymentsLoading } = useQuery({
    queryKey: ['supplier-payments', filters],
    queryFn: async () => {
      try {
        console.log('Fetching supplier payments with filters:', filters);
        const result = await supplierPaymentService.searchPayments(filters);
        console.log('Supplier Payments Result:', result);
        console.log('Payments data:', result.data);
        console.log('Pagination:', result.pagination);
        return result;
      } catch (error: any) {
        console.error('Error fetching supplier payments:', error);
        console.error('Error details:', error.response?.data);
        throw error;
      }
    },
    enabled: true, // Always enabled
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  const payments = paymentsResult?.data || [];
  const pagination = paymentsResult?.pagination;
  
  // Debug logging
  useEffect(() => {
    if (paymentsResult) {
      console.log('Supplier Payments Loaded:', payments);
      console.log('Pagination:', pagination);
    }
    if (paymentsError) {
      console.error('Supplier Payments Error:', paymentsError);
    }
  }, [paymentsResult, paymentsError, payments, pagination]);
  
  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: (data: CreateSupplierPaymentRequest) => supplierPaymentService.addPayment(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment added successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      setShowAddModal(false);
      resetForm();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to add payment'
      });
    }
  });
  
  // Update payment mutation
  const updatePaymentMutation = useMutation({
    mutationFn: (data: CreateSupplierPaymentRequest & { payment_id: number }) => 
      supplierPaymentService.updatePayment(data as any),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment updated successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
      setEditingPayment(null);
      resetForm();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to update payment'
      });
    }
  });
  
  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: (payment_id: number) => supplierPaymentService.deletePayment(payment_id),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment deleted successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['supplier-payments'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to delete payment'
      });
    }
  });
  
  // Load total charges for supplier
  const loadTotalCharges = async (supplier_id: number) => {
    try {
      const charges = await supplierPaymentService.getTotalCharges(supplier_id);
      setTotalCharges(charges);
    } catch (error) {
      setTotalCharges([]);
    }
  };
  
  const resetForm = () => {
    setFormData({
      supplier_id: undefined,
      payment_amount: undefined,
      currency_id: undefined,
      payment_detail: '',
      account_id: undefined
    });
    setTotalCharges([]);
  };
  
  const handleAddPayment = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const handleEditPayment = async (payment: SupplierPayment) => {
    try {
      // Fetch full payment details from API to ensure we have all fields
      const fullPayment = await supplierPaymentService.getPayment(payment.payment_id);
      
      setFormData({
        supplier_id: fullPayment.supp_id || payment.supp_id,
        payment_amount: fullPayment.payment_amount || payment.payment_amount,
        currency_id: fullPayment.currencyID || payment.currencyID,
        payment_detail: fullPayment.payment_detail || payment.payment_detail || '',
        account_id: fullPayment.accountID || payment.accountID
      });
      
      if (fullPayment.supp_id || payment.supp_id) {
        await loadTotalCharges(fullPayment.supp_id || payment.supp_id);
      }
      setEditingPayment(payment);
    } catch (error) {
      console.error('Error fetching payment details:', error);
      // Fallback to using payment data from table
      setFormData({
        supplier_id: payment.supp_id,
        payment_amount: payment.payment_amount,
        currency_id: payment.currencyID,
        payment_detail: payment.payment_detail || '',
        account_id: payment.accountID
      });
      
      if (payment.supp_id) {
        await loadTotalCharges(payment.supp_id);
      }
      setEditingPayment(payment);
    }
  };
  
  const handleDeletePayment = (payment_id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You want to delete this payment?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deletePaymentMutation.mutate(payment_id);
      }
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_id || !formData.payment_amount || !formData.currency_id || !formData.account_id) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Please fill all required fields'
      });
      return;
    }
    
    if (editingPayment) {
      updatePaymentMutation.mutate({
        ...formData as CreateSupplierPaymentRequest,
        payment_id: editingPayment.payment_id
      });
    } else {
      addPaymentMutation.mutate(formData as CreateSupplierPaymentRequest);
    }
  };
  
  const handleSupplierChange = async (supplier_id: number) => {
    setFormData(prev => ({ ...prev, supplier_id }));
    if (supplier_id) {
      await loadTotalCharges(supplier_id);
    } else {
      setTotalCharges([]);
    }
  };
  
  const handleSearch = () => {
    setFilters(prev => ({ ...prev, search: searchTerm || undefined, page: 1 }));
  };
  
  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };
  
  const handlePerPageChange = (newPerPage: number) => {
    setFilters(prev => ({ ...prev, per_page: newPerPage, page: 1 }));
  };
  
  useEffect(() => {
    refetchPayments();
  }, [filters]);
  
  return (
    <div className="supplier-payments-page">
      <div className="page-header">
        <h1><i className="fa fa-money me-2"></i>Supplier Payment Report</h1>
        <button className="btn btn-success" onClick={handleAddPayment}>
          <i className="fa fa-plus me-2"></i>Add Supplier Payment
        </button>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h3><i className="fa fa-search me-2"></i>Search & Filter</h3>
        </div>
        <div className="panel-body">
          <form onSubmit={(e) => { 
            e.preventDefault(); 
            setFilters(prev => ({ ...prev, page: 1 })); // Reset to page 1 on search
            refetchPayments(); 
          }}>
            <div className="search-form-row">
              <div className="search-form-group">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="dateSearch"
                    checked={filters.date_search_enabled || false}
                    onChange={(e) => setFilters({ ...filters, date_search_enabled: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="dateSearch">
                    Search By Date
                  </label>
                </div>
              </div>
              <div className="search-form-group">
                <label htmlFor="from_date" className="form-label">From Date</label>
                <input
                  type="date"
                  className="form-control"
                  id="from_date"
                  value={filters.from_date || ''}
                  onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                  disabled={!filters.date_search_enabled}
                />
              </div>
              <div className="search-form-group">
                <label htmlFor="to_date" className="form-label">To Date</label>
                <input
                  type="date"
                  className="form-control"
                  id="to_date"
                  value={filters.to_date || ''}
                  onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                  disabled={!filters.date_search_enabled}
                />
              </div>
              <div className="search-form-group">
                <label htmlFor="supplier_id" className="form-label">Supplier</label>
                <SearchableSelect
                  options={[
                    { value: '', label: '--All Suppliers--' },
                    ...(dropdowns?.suppliers?.map(s => ({
                      value: String(s.supp_id),
                      label: s.supp_name
                    })) || [])
                  ]}
                  value={filters.supplier_id ? String(filters.supplier_id) : ''}
                  onChange={(value) => setFilters({ ...filters, supplier_id: value ? Number(value) : undefined })}
                  placeholder="Select Supplier"
                />
              </div>
              <div className="search-form-group">
                <label htmlFor="search" className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control"
                  id="search"
                  placeholder="Search supplier, detail, staff, amount..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch();
                    }
                  }}
                />
              </div>
              <div className="search-form-group search-button-group">
                <button type="button" onClick={handleSearch} className="btn btn-primary w-100">
                  <i className="fa fa-search me-2"></i>
                  <span className="search-text">Search</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h3><i className="fa fa-list me-2"></i>Supplier Payments</h3>
        </div>
        <div className="panel-body">
          {paymentsLoading && (
            <div className="text-center p-4">
              <i className="fa fa-spinner fa-spin fa-2x"></i>
              <p className="mt-2">Loading payments...</p>
            </div>
          )}
          {paymentsError && (
            <div className="alert alert-danger">
              <strong>Error loading payments:</strong> {paymentsError instanceof Error ? paymentsError.message : 'Unknown error'}
            </div>
          )}
          {!paymentsLoading && !paymentsError && (
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>S#</th>
                    <th>Supplier Name</th>
                    <th>Payment Detail</th>
                    <th>Date Time</th>
                    <th>Payment Amount</th>
                    <th>Employee Name</th>
                    <th>Account/Cash</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center">No payments found</td>
                    </tr>
                  ) : (
                  payments.map((payment, index) => (
                    <tr key={payment.payment_id}>
                      <td>{((pagination?.page || 1) - 1) * (pagination?.per_page || 20) + index + 1}</td>
                      <td>{payment.supp_name || 'N/A'}</td>
                      <td>{payment.payment_detail || ''}</td>
                      <td>{new Date(payment.time_creation).toLocaleString()}</td>
                      <td>{parseFloat(String(payment.payment_amount)).toLocaleString()} {payment.currencyName || ''}</td>
                      <td>{payment.staff_name || 'N/A'}</td>
                      <td>{payment.account_Name || 'N/A'}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-warning me-2"
                            onClick={() => handleEditPayment(payment)}
                          >
                            <i className="fa fa-edit"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeletePayment(payment.payment_id)}
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
          
          {/* Pagination */}
          {!paymentsLoading && !paymentsError && pagination && pagination.total > 0 && (
            <div className="pagination-container">
              <div className="pagination-info">
                Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} entries
              </div>
              <div className="pagination-controls">
                <select
                  className="form-control per-page-select"
                  value={filters.per_page || 20}
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
      {(showAddModal || editingPayment) && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          setEditingPayment(null);
          resetForm();
        }}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="fa fa-money me-2"></i>
                {editingPayment ? 'Update Supplier Payment' : 'Add Supplier Payment'}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPayment(null);
                  resetForm();
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="supplier_id" className="form-label">Supplier Name *</label>
                  {dropdownsLoading ? (
                    <div className="form-control" style={{ padding: '10px' }}>
                      <i className="fa fa-spinner fa-spin me-2"></i>Loading suppliers...
                    </div>
                  ) : dropdownsError ? (
                    <div className="alert alert-danger">
                      Error loading suppliers. Please refresh the page.
                    </div>
                  ) : (
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Select Supplier' },
                        ...(dropdowns?.suppliers?.map(s => ({
                          value: String(s.supp_id),
                          label: s.supp_name
                        })) || [])
                      ]}
                      value={formData.supplier_id ? String(formData.supplier_id) : ''}
                      onChange={(value) => handleSupplierChange(value ? Number(value) : 0)}
                      placeholder="Select Supplier"
                      required
                    />
                  )}
                </div>
                
                {formData.supplier_id && totalCharges.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Total Charges</label>
                    <div className="total-charges-display">
                      {totalCharges.map((charge, idx) => (
                        <div key={idx} className="charge-item">
                          <strong>{parseFloat(String(charge.total)).toLocaleString()} {charge.curName}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="payment_amount" className="form-label">Payment Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="payment_amount"
                      value={formData.payment_amount || ''}
                      onChange={(e) => setFormData({ ...formData, payment_amount: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="currency_id" className="form-label">Currency *</label>
                    {dropdownsLoading ? (
                      <div className="form-control" style={{ padding: '10px' }}>
                        <i className="fa fa-spinner fa-spin me-2"></i>Loading currencies...
                      </div>
                    ) : (
                      <SearchableSelect
                        options={[
                          { value: '', label: 'Select Currency' },
                          ...(dropdowns?.currencies?.map(c => ({
                            value: String(c.currencyID),
                            label: c.currencyName
                          })) || [])
                        ]}
                        value={formData.currency_id ? String(formData.currency_id) : ''}
                        onChange={(value) => setFormData({ ...formData, currency_id: value ? Number(value) : undefined })}
                        placeholder="Select Currency"
                        required
                      />
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="payment_detail" className="form-label">Payment Detail</label>
                  <input
                    type="text"
                    className="form-control"
                    id="payment_detail"
                    value={formData.payment_detail || ''}
                    onChange={(e) => setFormData({ ...formData, payment_detail: e.target.value })}
                    placeholder="Payment Detail"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="account_id" className="form-label">Account *</label>
                  {dropdownsLoading ? (
                    <div className="form-control" style={{ padding: '10px' }}>
                      <i className="fa fa-spinner fa-spin me-2"></i>Loading accounts...
                    </div>
                  ) : (
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Select Account' },
                        ...(dropdowns?.accounts?.map(a => ({
                          value: String(a.account_ID),
                          label: a.account_Name
                        })) || [])
                      ]}
                      value={formData.account_id ? String(formData.account_id) : ''}
                      onChange={(value) => setFormData({ ...formData, account_id: value ? Number(value) : undefined })}
                      placeholder="Select Account"
                      required
                    />
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingPayment(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={addPaymentMutation.isPending || updatePaymentMutation.isPending}
                  >
                    {(addPaymentMutation.isPending || updatePaymentMutation.isPending) ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-2"></i>
                        {editingPayment ? 'Updating...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <i className="fa fa-save me-2"></i>
                        {editingPayment ? 'Update' : 'Save'} Payment
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

