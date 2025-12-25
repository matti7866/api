import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import supplierService from '../../services/supplierService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type {
  Supplier,
  PendingSupplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierPaymentRequest,
  SupplierDropdownData
} from '../../types/supplier';
import './Suppliers.css';

export default function Suppliers() {
  const [activeTab, setActiveTab] = useState<'add' | 'view' | 'pending'>('add');
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    supplier: PendingSupplier | null;
  }>({ isOpen: false, supplier: null });
  
  const [formData, setFormData] = useState<Partial<CreateSupplierRequest>>({
    supplier_name: '',
    supplier_email: '',
    supplier_address: '',
    supplier_phone: '',
    supplier_type_id: undefined
  });
  
  const [paymentFormData, setPaymentFormData] = useState<Partial<SupplierPaymentRequest>>({
    supplier_id: undefined,
    payment_amount: 0,
    currency_id: undefined,
    remarks: '',
    account_id: undefined
  });
  
  const [pendingFilters, setPendingFilters] = useState<{
    supplier_id?: number;
    currency_id?: number;
  }>({});
  
  const queryClient = useQueryClient();
  
  // Load dropdowns
  const { data: dropdowns } = useQuery<SupplierDropdownData>({
    queryKey: ['supplier-dropdowns'],
    queryFn: () => supplierService.getDropdowns(),
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false
  });
  
  // Auto-select AED currency when pending tab is opened and currencies are loaded
  useEffect(() => {
    if (activeTab === 'pending' && dropdowns?.currencies && !pendingFilters.currency_id) {
      // Find AED currency (usually currencyID = 3 for AED)
      const aedCurrency = dropdowns.currencies.find(c => c.currencyName.toUpperCase() === 'AED' || c.currencyID === 3);
      if (aedCurrency) {
        setPendingFilters(prev => ({ ...prev, currency_id: aedCurrency.currencyID }));
      } else if (dropdowns.currencies.length > 0) {
        // Fallback to first currency if AED not found
        setPendingFilters(prev => ({ ...prev, currency_id: dropdowns.currencies[0].currencyID }));
      }
    }
  }, [activeTab, dropdowns?.currencies, pendingFilters.currency_id]);
  
  // Load suppliers for view tab
  const { data: suppliers = [], isLoading: suppliersLoading, refetch: refetchSuppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => supplierService.getSuppliers(),
    enabled: activeTab === 'view',
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false
  });
  
  // Load currencies for pending tab - if supplier selected, get supplier-specific currencies, otherwise all currencies
  const { data: currencies = [], refetch: refetchCurrencies } = useQuery({
    queryKey: ['supplier-currencies', pendingFilters.supplier_id],
    queryFn: () => supplierService.getCurrencies(pendingFilters.supplier_id),
    enabled: activeTab === 'pending',
    initialData: dropdowns?.currencies || [],
    staleTime: 30000,
    refetchOnWindowFocus: false
  });
  
  // Load pending suppliers
  const { data: pendingSuppliers = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery<PendingSupplier[]>({
    queryKey: ['pending-suppliers', pendingFilters],
    queryFn: () => supplierService.getPendingSuppliers(
      pendingFilters.supplier_id,
      pendingFilters.currency_id
    ),
    enabled: activeTab === 'pending' && !!pendingFilters.currency_id,
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  // Mutations
  const createSupplierMutation = useMutation({
    mutationFn: (data: CreateSupplierRequest) => supplierService.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dropdowns'] });
      setFormData({
        supplier_name: '',
        supplier_email: '',
        supplier_address: '',
        supplier_phone: '',
        supplier_type_id: undefined
      });
      Swal.fire('Success', 'Supplier created successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to create supplier', 'error');
    }
  });
  
  const updateSupplierMutation = useMutation({
    mutationFn: (data: UpdateSupplierRequest) => supplierService.updateSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dropdowns'] });
      setEditSupplier(null);
      Swal.fire('Success', 'Supplier updated successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update supplier', 'error');
    }
  });
  
  const deleteSupplierMutation = useMutation({
    mutationFn: (supplierId: number) => supplierService.deleteSupplier(supplierId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dropdowns'] });
      Swal.fire('Success', 'Supplier deleted successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to delete supplier', 'error');
    }
  });
  
  const makePaymentMutation = useMutation({
    mutationFn: (data: SupplierPaymentRequest) => supplierService.makePayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-dropdowns'] });
      setPaymentModal({ isOpen: false, supplier: null });
      setPaymentFormData({
        supplier_id: undefined,
        payment_amount: 0,
        currency_id: undefined,
        remarks: '',
        account_id: undefined
      });
      Swal.fire('Success', 'Payment recorded successfully', 'success');
      setTimeout(() => refetchPending(), 500);
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to record payment', 'error');
    }
  });
  
  // Handlers
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_name || !formData.supplier_email || !formData.supplier_address || 
        !formData.supplier_phone || !formData.supplier_type_id) {
      Swal.fire('Validation Error', 'All fields are required', 'error');
      return;
    }
    
    if (editSupplier) {
      updateSupplierMutation.mutate({
        supplier_id: editSupplier.supp_id,
        ...formData as CreateSupplierRequest
      });
    } else {
      createSupplierMutation.mutate(formData as CreateSupplierRequest);
    }
  };
  
  const handleEdit = async (supplier: Supplier) => {
    setEditSupplier(supplier);
    setFormData({
      supplier_name: supplier.supp_name,
      supplier_email: supplier.supp_email,
      supplier_address: supplier.supp_add,
      supplier_phone: supplier.supp_phone,
      supplier_type_id: supplier.supp_type_id
    });
    setActiveTab('add');
  };
  
  const handleDelete = (supplier: Supplier) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Delete supplier "${supplier.supp_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteSupplierMutation.mutate(supplier.supp_id);
      }
    });
  };
  
  const handleOpenPayment = async (supplier: PendingSupplier) => {
    if (!pendingFilters.currency_id) {
      Swal.fire('Error', 'Please select a currency first', 'error');
      return;
    }
    
    try {
      const details = await supplierService.getSupplierPaymentDetails(
        supplier.main_supp,
        pendingFilters.currency_id
      );
      setPaymentFormData({
        supplier_id: supplier.main_supp,
        payment_amount: 0,
        currency_id: pendingFilters.currency_id,
        remarks: '',
        account_id: undefined
      });
      setPaymentModal({ isOpen: true, supplier: { ...supplier, Pending: details.total } });
    } catch (error: any) {
      Swal.fire('Error', error.message || 'Failed to load payment details', 'error');
    }
  };
  
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!paymentFormData.supplier_id || !paymentFormData.payment_amount || 
        paymentFormData.payment_amount <= 0 || !paymentFormData.currency_id || 
        !paymentFormData.account_id) {
      Swal.fire('Validation Error', 'All fields are required and payment amount must be greater than 0', 'error');
      return;
    }
    
    makePaymentMutation.mutate(paymentFormData as SupplierPaymentRequest);
  };
  
  const handleCurrencyChange = (currencyId: number) => {
    setPendingFilters({ ...pendingFilters, currency_id: currencyId });
  };
  
  const handleSupplierFilterChange = (supplierId: number) => {
    setPendingFilters({ ...pendingFilters, supplier_id: supplierId || undefined });
    // Reset currency when supplier changes
    if (supplierId) {
      setTimeout(() => refetchCurrencies(), 100);
    }
  };
  
  // Calculate total pending
  const totalPending = pendingSuppliers.reduce((sum, s) => sum + (parseFloat(String(s.Pending)) || 0), 0);
  
  return (
    <div className="suppliers-page">
      <div className="page-header">
        <h1><i className="fa fa-truck me-2"></i>Suppliers</h1>
      </div>
      
      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'add' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('add');
              setEditSupplier(null);
              setFormData({
                supplier_name: '',
                supplier_email: '',
                supplier_address: '',
                supplier_phone: '',
                supplier_type_id: undefined
              });
            }}
          >
            <i className="fa fa-plus me-2"></i>
            Add Supplier
          </button>
          <button
            className={`tab ${activeTab === 'view' ? 'active' : ''}`}
            onClick={() => setActiveTab('view')}
          >
            <i className="fa fa-list me-2"></i>
            View Suppliers
          </button>
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            <i className="fa fa-money me-2"></i>
            Pending Payments & Ledger
          </button>
        </div>
      </div>
      
      {/* Add/Edit Supplier Tab */}
      {activeTab === 'add' && (
        <div className="panel">
          <div className="panel-header">
            <h3>{editSupplier ? 'Edit Supplier' : 'Supplier Entry Form'}</h3>
          </div>
          <div className="panel-body">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label><i className="fa fa-user me-2"></i>Supplier Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={formData.supplier_name || ''}
                    onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                    className="form-control"
                    placeholder="Enter Supplier Name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label><i className="fa fa-envelope me-2"></i>Supplier Email <span className="text-danger">*</span></label>
                  <input
                    type="email"
                    value={formData.supplier_email || ''}
                    onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                    className="form-control"
                    placeholder="Enter Supplier Email"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label><i className="fa fa-map-marker-alt me-2"></i>Supplier Address <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={formData.supplier_address || ''}
                    onChange={(e) => setFormData({ ...formData, supplier_address: e.target.value })}
                    className="form-control"
                    placeholder="Enter Supplier Address"
                    required
                  />
                </div>
                <div className="form-group">
                  <label><i className="fa fa-phone me-2"></i>Supplier Phone <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    value={formData.supplier_phone || ''}
                    onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
                    className="form-control"
                    placeholder="Enter Supplier Phone"
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label><i className="fa fa-tag me-2"></i>Supplier Type <span className="text-danger">*</span></label>
                  <select
                    value={formData.supplier_type_id || ''}
                    onChange={(e) => setFormData({ ...formData, supplier_type_id: Number(e.target.value) })}
                    className="form-control"
                    required
                  >
                    <option value="">--Select Supplier Type--</option>
                    <option value="1">Travel</option>
                    <option value="2">Exchange</option>
                  </select>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-success">
                  <i className="fa fa-save me-2"></i>
                  {editSupplier ? 'Update' : 'Save'} Record
                </button>
                {editSupplier && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditSupplier(null);
                      setFormData({
                        supplier_name: '',
                        supplier_email: '',
                        supplier_address: '',
                        supplier_phone: '',
                        supplier_type_id: undefined
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}
                <a href="#view" onClick={(e) => { e.preventDefault(); setActiveTab('view'); }} className="btn btn-link">
                  <i className="fa fa-info me-2"></i>View Report
                </a>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* View Suppliers Tab */}
      {activeTab === 'view' && (
        <div className="panel">
          <div className="panel-header">
            <h3>Supplier Report</h3>
          </div>
          <div className="panel-body">
            {suppliersLoading ? (
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
                      <th>Supplier Name</th>
                      <th>Supplier Email</th>
                      <th>Supplier Address</th>
                      <th>Supplier Phone</th>
                      <th>Supplier Type</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center">No suppliers found</td>
                      </tr>
                    ) : (
                      suppliers.map((supplier, index) => (
                        <tr key={supplier.supp_id}>
                          <td>{index + 1}</td>
                          <td className="text-capitalize">{supplier.supp_name}</td>
                          <td>{supplier.supp_email}</td>
                          <td>{supplier.supp_add}</td>
                          <td>{supplier.supp_phone}</td>
                          <td className="text-capitalize">{supplier.supp_type}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleEdit(supplier)}
                                title="Edit"
                              >
                                <i className="fa fa-edit"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(supplier)}
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
      )}
      
      {/* Pending Payments Tab */}
      {activeTab === 'pending' && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h3>Supplier Payments & Ledger</h3>
            </div>
            <div className="panel-body">
              <div className="filter-row mb-3">
                <div className="filter-group">
                  <label>Supplier</label>
                  <SearchableSelect
                    options={[
                      { value: '', label: '--Select Supplier--' },
                      ...(dropdowns?.suppliers?.map(s => ({
                        value: s.supp_id,
                        label: s.supp_name
                      })) || [])
                    ]}
                    value={pendingFilters.supplier_id || ''}
                    onChange={(value) => handleSupplierFilterChange(Number(value))}
                    placeholder="Select Supplier (Optional)"
                  />
                </div>
                <div className="filter-group">
                  <label>Currency <span className="text-danger">*</span></label>
                  <SearchableSelect
                    options={[
                      { value: '', label: '--Select Currency--' },
                      ...(currencies.length > 0 ? currencies.map(c => ({
                        value: c.currencyID,
                        label: c.currencyName
                      })) : (dropdowns?.currencies?.map(c => ({
                        value: c.currencyID,
                        label: c.currencyName
                      })) || []))
                    ]}
                    value={pendingFilters.currency_id || ''}
                    onChange={(value) => handleCurrencyChange(Number(value))}
                    placeholder="Select Currency"
                    required
                  />
                </div>
              </div>
              
              {pendingLoading ? (
                <div className="text-center p-4">
                  <i className="fa fa-spinner fa-spin fa-2x"></i>
                  <p className="mt-2">Loading...</p>
                </div>
              ) : !pendingFilters.currency_id ? (
                <div className="alert alert-info">
                  <i className="fa fa-info-circle me-2"></i>
                  Please select a currency to view pending suppliers
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped table-bordered">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Supplier Name</th>
                        <th>Supplier Email</th>
                        <th>Supplier Phone</th>
                        <th>Pending Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingSuppliers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center">No pending suppliers found</td>
                        </tr>
                      ) : (
                        <>
                          {pendingSuppliers.map((supplier, index) => (
                            <tr key={supplier.main_supp}>
                              <td>{index + 1}</td>
                              <td className="text-capitalize">{supplier.supp_name}</td>
                              <td>{supplier.supp_email}</td>
                              <td>{supplier.supp_phone}</td>
                              <td>{parseFloat(String(supplier.Pending)).toLocaleString()}</td>
                              <td>
                                <a
                                  href={`/supplier/ledger?id=${supplier.main_supp}&curID=${pendingFilters.currency_id}`}
                                  className="btn btn-sm btn-primary me-2"
                                >
                                  <i className="fa fa-eye me-1"></i>View Ledger
                                </a>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleOpenPayment(supplier)}
                                >
                                  <i className="fa fa-cc-paypal me-1"></i>Make Payment
                                </button>
                              </td>
                            </tr>
                          ))}
                          {totalPending > 0 && (
                            <tr className="total-row">
                              <td colSpan={4}></td>
                              <td className="text-end"><strong>Total: {totalPending.toLocaleString()}</strong></td>
                              <td></td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* Payment Modal */}
      {paymentModal.isOpen && paymentModal.supplier && (
        <div className="modal-overlay" onClick={() => setPaymentModal({ isOpen: false, supplier: null })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Supplier Make Payment</h3>
              <button className="btn-close" onClick={() => setPaymentModal({ isOpen: false, supplier: null })}>×</button>
            </div>
            <form onSubmit={handlePaymentSubmit}>
              <div className="modal-body">
                <div className="form-group mb-3">
                  <label><i className="fa fa-user me-2"></i>Total Charges</label>
                  <input
                    type="text"
                    disabled
                    className="form-control"
                    value={paymentModal.supplier.Pending.toLocaleString()}
                  />
                </div>
                <div className="form-group mb-3">
                  <label><i className="fa fa-money-bill me-2"></i>Payment Amount <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    value={paymentFormData.payment_amount || ''}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, payment_amount: Number(e.target.value) })}
                    className="form-control"
                    placeholder="Enter payment amount"
                    required
                  />
                </div>
                <div className="form-group mb-3">
                  <label><i className="fa fa-comment me-2"></i>Remarks</label>
                  <textarea
                    value={paymentFormData.remarks || ''}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, remarks: e.target.value })}
                    className="form-control"
                    rows={5}
                    placeholder="Enter remarks"
                  />
                </div>
                <div className="form-group mb-3">
                  <label><i className="fa fa-university me-2"></i>Account <span className="text-danger">*</span></label>
                  <SearchableSelect
                    options={[
                      { value: '', label: '--Select Account--' },
                      ...(dropdowns?.accounts?.map(a => ({
                        value: a.account_ID,
                        label: a.account_Name
                      })) || [])
                    ]}
                    value={paymentFormData.account_id || ''}
                    onChange={(value) => setPaymentFormData({ ...paymentFormData, account_id: Number(value) })}
                    placeholder="Select Account"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal({ isOpen: false, supplier: null })}>Close</button>
                <button type="submit" className="btn btn-success">
                  <i className="fa fa-save me-2"></i>Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

