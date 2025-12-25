import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { customerPaymentService } from '../../services/paymentService';
import apiClient from '../../services/api';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { CustomerPayment, CustomerPaymentFilters, CreateCustomerPaymentRequest } from '../../types/payment';
import './CustomerPayments.css';

interface DropdownData {
  customers: Array<{ customer_id: number; customer_name: string }>;
  accounts: Array<{ account_ID: number; account_Name: string }>;
  currencies: Array<{ currencyID: number; currencyName: string }>;
  staff: Array<{ staff_id: number; staff_name: string }>;
}

export default function CustomerPayments() {
  const [filters, setFilters] = useState<CustomerPaymentFilters>({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    page: 1,
    per_page: 20
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPayment, setEditingPayment] = useState<CustomerPayment | null>(null);
  const [formData, setFormData] = useState<Partial<CreateCustomerPaymentRequest>>({
    customer_id: undefined,
    payment_amount: undefined,
    account_id: undefined,
    currency_id: undefined,
    remarks: '',
    staff_id: undefined
  });
  const [currencyDisabled, setCurrencyDisabled] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Load dropdowns
  const { data: dropdowns } = useQuery<DropdownData>({
    queryKey: ['payment-dropdowns'],
    queryFn: async () => {
      const response = await apiClient.get('/payment/dropdowns.php?type=all');
      return response.data.success ? response.data.data : { customers: [], accounts: [], currencies: [], staff: [] };
    },
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load payments
  const { data: paymentsResult, refetch: refetchPayments } = useQuery({
    queryKey: ['customer-payments', filters],
    queryFn: () => customerPaymentService.searchPayments(filters),
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  const payments = paymentsResult?.data || [];
  const pagination = paymentsResult?.pagination;
  
  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: (data: CreateCustomerPaymentRequest) => customerPaymentService.addPayment(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment added successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
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
    mutationFn: (data: CreateCustomerPaymentRequest & { pay_id: number }) => 
      customerPaymentService.updatePayment(data as any),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment updated successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
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
    mutationFn: (pay_id: number) => customerPaymentService.deletePayment(pay_id),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Payment deleted successfully',
        timer: 1500,
        showConfirmButton: false
      });
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] });
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to delete payment'
      });
    }
  });
  
  // Get account currency
  const getAccountCurrency = async (account_id: number) => {
    try {
      const result = await customerPaymentService.getAccountCurrency(account_id);
      if (result.currency_id) {
        setFormData(prev => ({ ...prev, currency_id: result.currency_id }));
        setCurrencyDisabled(true);
      } else {
        setCurrencyDisabled(false);
      }
    } catch (error) {
      setCurrencyDisabled(false);
    }
  };
  
  const resetForm = () => {
    setFormData({
      customer_id: undefined,
      payment_amount: undefined,
      account_id: undefined,
      currency_id: undefined,
      remarks: '',
      staff_id: undefined
    });
    setCurrencyDisabled(false);
  };
  
  const handleAddPayment = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const handleEditPayment = async (payment: CustomerPayment) => {
    setFormData({
      customer_id: payment.customer_id,
      payment_amount: payment.payment_amount,
      account_id: payment.accountID,
      currency_id: payment.currencyID,
      remarks: payment.remarks || '',
      staff_id: payment.staff_id
    });
    
    // Check if account has default currency
    if (payment.accountID) {
      await getAccountCurrency(payment.accountID);
    }
    
    setEditingPayment(payment);
  };
  
  const handleDeletePayment = (pay_id: number) => {
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
        deletePaymentMutation.mutate(pay_id);
      }
    });
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_id || !formData.payment_amount || !formData.account_id || 
        !formData.currency_id || !formData.staff_id) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Please fill all required fields'
      });
      return;
    }
    
    if (editingPayment) {
      updatePaymentMutation.mutate({
        ...formData as CreateCustomerPaymentRequest,
        pay_id: editingPayment.pay_id
      });
    } else {
      addPaymentMutation.mutate(formData as CreateCustomerPaymentRequest);
    }
  };
  
  const handleAccountChange = (account_id: number) => {
    setFormData(prev => ({ ...prev, account_id }));
    
    if (account_id) {
      const account = dropdowns?.accounts?.find(a => a.account_ID === account_id);
      if (account && account.account_Name.toLowerCase() === 'cash') {
        setCurrencyDisabled(false);
        setFormData(prev => ({ ...prev, currency_id: undefined }));
      } else {
        getAccountCurrency(account_id);
      }
    } else {
      setCurrencyDisabled(false);
      setFormData(prev => ({ ...prev, currency_id: undefined }));
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
    <div className="customer-payments-page">
      <div className="page-header">
        <h1><i className="fa fa-money me-2"></i>Customer Payments</h1>
        <button className="btn btn-success" onClick={handleAddPayment}>
          <i className="fa fa-plus me-2"></i>Add Payment
        </button>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h3><i className="fa fa-search me-2"></i>Search Payments</h3>
        </div>
        <div className="panel-body">
          <form onSubmit={(e) => { e.preventDefault(); refetchPayments(); }}>
            <div className="search-form-row">
              <div className="search-form-group">
                <label htmlFor="start_date" className="form-label">From Date</label>
                <input
                  type="date"
                  className="form-control"
                  id="start_date"
                  value={filters.start_date || ''}
                  onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                />
              </div>
              <div className="search-form-group">
                <label htmlFor="end_date" className="form-label">To Date</label>
                <input
                  type="date"
                  className="form-control"
                  id="end_date"
                  value={filters.end_date || ''}
                  onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                />
              </div>
              <div className="search-form-group">
                <label htmlFor="customer" className="form-label">Customer</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'All Customers' },
                    ...(dropdowns?.customers?.map(c => ({
                      value: String(c.customer_id),
                      label: c.customer_name
                    })) || [])
                  ]}
                  value={filters.customer ? String(filters.customer) : ''}
                  onChange={(value) => setFilters({ ...filters, customer: value ? Number(value) : undefined })}
                  placeholder="Select Customer"
                />
              </div>
              <div className="search-form-group">
                <label htmlFor="account" className="form-label">Account</label>
                <SearchableSelect
                  options={[
                    { value: '', label: 'All Accounts' },
                    ...(dropdowns?.accounts?.map(a => ({
                      value: String(a.account_ID),
                      label: a.account_Name
                    })) || [])
                  ]}
                  value={filters.account ? String(filters.account) : ''}
                  onChange={(value) => setFilters({ ...filters, account: value ? Number(value) : undefined })}
                  placeholder="Select Account"
                />
              </div>
              <div className="search-form-group">
                <label htmlFor="search" className="form-label">Search</label>
                <input
                  type="text"
                  className="form-control"
                  id="search"
                  placeholder="Search customer, remarks, staff, amount..."
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
          <h3><i className="fa fa-list me-2"></i>Customer Payments</h3>
        </div>
        <div className="panel-body">
          <div className="table-responsive">
            <table className="table table-striped table-bordered">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer Name</th>
                  <th>Date Time</th>
                  <th>Payment Amount</th>
                  <th>Currency</th>
                  <th>Account</th>
                  <th>Employee Name</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center">No payments found</td>
                  </tr>
                ) : (
                  payments.map((payment, index) => (
                    <tr key={payment.pay_id}>
                      <td>{((pagination?.page || 1) - 1) * (pagination?.per_page || 20) + index + 1}</td>
                      <td>{payment.customer_name || 'N/A'}</td>
                      <td>{new Date(payment.datetime).toLocaleString()}</td>
                      <td>{parseFloat(String(payment.payment_amount)).toLocaleString()}</td>
                      <td>{payment.currencyName || 'N/A'}</td>
                      <td>{payment.account_Name || 'N/A'}</td>
                      <td>{payment.staff_name || 'N/A'}</td>
                      <td>{payment.remarks || ''}</td>
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
                            onClick={() => handleDeletePayment(payment.pay_id)}
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
          
          {/* Pagination */}
          {pagination && pagination.total > 0 && (
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">
                <i className="fa fa-money me-2"></i>
                {editingPayment ? 'Update Payment' : 'Add Payment'}
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
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="customer_id" className="form-label">Customer Name *</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Select Customer' },
                        ...(dropdowns?.customers?.map(c => ({
                          value: String(c.customer_id),
                          label: c.customer_name
                        })) || [])
                      ]}
                      value={formData.customer_id ? String(formData.customer_id) : ''}
                      onChange={(value) => setFormData({ ...formData, customer_id: value ? Number(value) : undefined })}
                      placeholder="Select Customer"
                      required
                    />
                  </div>
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
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="account_id" className="form-label">Account *</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: 'Select Account' },
                        ...(dropdowns?.accounts?.map(a => ({
                          value: String(a.account_ID),
                          label: a.account_Name
                        })) || [])
                      ]}
                      value={formData.account_id ? String(formData.account_id) : ''}
                      onChange={(value) => handleAccountChange(value ? Number(value) : 0)}
                      placeholder="Select Account"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="currency_id" className="form-label">Currency *</label>
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
                      disabled={currencyDisabled}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="remarks" className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    id="remarks"
                    rows={3}
                    value={formData.remarks || ''}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="staff_id" className="form-label">Staff Member *</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: 'Select Staff Member' },
                      ...(dropdowns?.staff?.map(s => ({
                        value: String(s.staff_id),
                        label: s.staff_name
                      })) || [])
                    ]}
                    value={formData.staff_id ? String(formData.staff_id) : ''}
                    onChange={(value) => setFormData({ ...formData, staff_id: value ? Number(value) : undefined })}
                    placeholder="Select Staff Member"
                    required
                  />
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

