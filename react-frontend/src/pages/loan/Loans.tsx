import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import loanService from '../../services/loanService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type {
  Loan,
  LoanFilters,
  CreateLoanRequest,
  LoanTotal,
  LoanDropdownData
} from '../../types/loan';
import './Loans.css';

const getTodayDate = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

export default function Loans() {
  const [filters, setFilters] = useState<LoanFilters>({
    start_date: getTodayDate(),
    end_date: getTodayDate(),
    search_by_date: false
  });
  
  const [loanModal, setLoanModal] = useState<{
    isOpen: boolean;
    loan: Loan | null;
  }>({ isOpen: false, loan: null });
  
  const queryClient = useQueryClient();
  
  // Load dropdowns
  const { data: dropdowns, error: dropdownsError } = useQuery<LoanDropdownData>({
    queryKey: ['loan-dropdowns'],
    queryFn: () => loanService.getDropdowns(),
    retry: 2
  });
  
  useEffect(() => {
    if (dropdownsError) {
      console.error('Error loading dropdowns:', dropdownsError);
      Swal.fire('Error', 'Failed to load dropdown data. Please refresh the page.', 'error');
    }
  }, [dropdownsError]);
  
  // Load loans
  const { data: loans = [], isLoading: loansLoading, refetch: refetchLoans } = useQuery<Loan[]>({
    queryKey: ['loans', filters],
    queryFn: () => loanService.getLoans(filters),
    enabled: !!(filters.search_by_date || filters.customer) // Only search when at least one filter is selected
  });
  
  // Load totals
  const { data: totals = [] } = useQuery<LoanTotal[]>({
    queryKey: ['loan-totals', filters],
    queryFn: () => loanService.getTotal(filters),
    enabled: !!(filters.search_by_date || filters.customer) && loans.length > 0
  });
  
  // Mutations
  const createLoanMutation = useMutation({
    mutationFn: (data: CreateLoanRequest) => loanService.createLoan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-totals'] });
      setLoanModal({ isOpen: false, loan: null });
      Swal.fire('Success', 'Loan added successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add loan', 'error');
    }
  });
  
  const updateLoanMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<CreateLoanRequest> }) =>
      loanService.updateLoan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-totals'] });
      setLoanModal({ isOpen: false, loan: null });
      Swal.fire('Success', 'Loan updated successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update loan', 'error');
    }
  });
  
  const deleteLoanMutation = useMutation({
    mutationFn: (id: number) => loanService.deleteLoan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['loan-totals'] });
      Swal.fire('Success', 'Loan deleted successfully', 'success');
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to delete loan', 'error');
    }
  });
  
  const handleSearch = () => {
    if (!filters.search_by_date && !filters.customer) {
      Swal.fire('Validation Error', 'Please select at least one search option', 'error');
      return;
    }
    refetchLoans();
  };
  
  const handleAddLoan = () => {
    setLoanModal({ isOpen: true, loan: null });
  };
  
  const handleEditLoan = async (loan: Loan) => {
    setLoanModal({ isOpen: true, loan });
  };
  
  const handleDeleteLoan = (id: number) => {
    Swal.fire({
      title: 'Delete Loan?',
      text: 'Are you sure you want to delete this loan?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteLoanMutation.mutate(id);
      }
    });
  };
  
  return (
    <div className="loans-page">
      <div className="page-header">
        <h1><i className="fa fa-money-bill me-2"></i>Loan Management</h1>
        <button className="btn btn-success" onClick={handleAddLoan}>
          <i className="fa fa-plus me-2"></i>
          Add Loan
        </button>
      </div>
      
      <div className="panel">
        <div className="panel-header">
          <h3>Search Loans</h3>
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
                  onChange={(value) => setFilters({ ...filters, customer: value ? Number(value) : undefined })}
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
          <h3>Loan Report</h3>
        </div>
        <div className="panel-body">
          {loansLoading ? (
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
                    <th>Amount</th>
                    <th>Account</th>
                    <th>Date Time</th>
                    <th>Remarks</th>
                    <th>Lend By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loans.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center">
                        {filters.search_by_date || filters.customer ? 'No loans found' : 'Please select search criteria and click Search'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {loans.map((loan, index) => (
                        <tr key={loan.loan_id}>
                          <td>{index + 1}</td>
                          <td className="text-capitalize">{loan.customer_name}</td>
                          <td className="text-capitalize">
                            {loan.amount.toLocaleString()} {loan.currencyName}
                          </td>
                          <td>{loan.account_Name}</td>
                          <td>{new Date(loan.datetime).toLocaleString()}</td>
                          <td>{loan.remarks || '-'}</td>
                          <td className="text-capitalize">{loan.staff_name}</td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleEditLoan(loan)}
                                title="Edit"
                              >
                                <i className="fa fa-edit"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteLoan(loan.loan_id)}
                                title="Delete"
                              >
                                <i className="fa fa-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {totals.length > 0 && (
                        <tr className="table-info fw-bold">
                          <td>Total</td>
                          <td></td>
                          <td>
                            {totals.map((total, idx) => (
                              <div key={idx}>
                                {total.amount.toLocaleString()} {total.currencyName}
                              </div>
                            ))}
                          </td>
                          <td colSpan={5}></td>
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
      
      {/* Loan Modal */}
      {loanModal.isOpen && (
        <LoanModal
          loan={loanModal.loan}
          dropdowns={dropdowns}
          onClose={() => setLoanModal({ isOpen: false, loan: null })}
          onSubmit={(data) => {
            if (loanModal.loan) {
              updateLoanMutation.mutate({ id: loanModal.loan.loan_id, data });
            } else {
              createLoanMutation.mutate(data as CreateLoanRequest);
            }
          }}
        />
      )}
    </div>
  );
}

// Loan Modal Component
function LoanModal({
  loan,
  dropdowns,
  onClose,
  onSubmit
}: {
  loan: Loan | null;
  dropdowns?: LoanDropdownData;
  onClose: () => void;
  onSubmit: (data: Partial<CreateLoanRequest>) => void;
}) {
  const [formData, setFormData] = useState<Partial<CreateLoanRequest>>({
    customer_id: loan?.customer_id || undefined,
    amount: loan?.amount || 0,
    currency_id: loan?.currencyID || undefined,
    account_id: loan?.accountID || undefined,
    remarks: loan?.remarks || ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  useEffect(() => {
    if (loan) {
      setFormData({
        customer_id: loan.customer_id,
        amount: loan.amount,
        currency_id: loan.currencyID,
        account_id: loan.accountID,
        remarks: loan.remarks || ''
      });
    } else {
      // Reset form for new loan
      setFormData({
        customer_id: undefined,
        amount: 0,
        currency_id: dropdowns?.currencies?.[0]?.currencyID || undefined,
        account_id: undefined,
        remarks: ''
      });
    }
  }, [loan, dropdowns]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    
    if (!formData.customer_id) newErrors.customer_id = 'Customer is required';
    if (!formData.amount || formData.amount <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!formData.currency_id) newErrors.currency_id = 'Currency is required';
    if (!formData.account_id) newErrors.account_id = 'Account is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{loan ? 'Edit Loan' : 'Add New Loan'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group mb-3">
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
            
            <div className="form-row">
              <div className="form-group">
                <label><i className="fa fa-dollar-sign me-2"></i>Amount <span className="text-danger">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => {
                    setFormData({ ...formData, amount: Number(e.target.value) });
                    setErrors({ ...errors, amount: '' });
                  }}
                  className={`form-control ${errors.amount ? 'is-invalid' : ''}`}
                  placeholder="Amount"
                />
                {errors.amount && <div className="invalid-feedback">{errors.amount}</div>}
              </div>
              
              <div className="form-group">
                <label><i className="fa fa-money-bill me-2"></i>Currency <span className="text-danger">*</span></label>
                <SearchableSelect
                  options={
                    dropdowns?.currencies?.map(c => ({
                      value: c.currencyID,
                      label: c.currencyName
                    })) || []
                  }
                  value={formData.currency_id || ''}
                  onChange={(value) => {
                    setFormData({ ...formData, currency_id: Number(value) });
                    setErrors({ ...errors, currency_id: '' });
                  }}
                  placeholder="Select Currency"
                  required
                />
                {errors.currency_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.currency_id}</div>}
              </div>
            </div>
            
            <div className="form-group mb-3">
              <label><i className="fa fa-wallet me-2"></i>Account <span className="text-danger">*</span></label>
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
                  setFormData({ ...formData, account_id: Number(value) });
                  setErrors({ ...errors, account_id: '' });
                }}
                placeholder="Select Account"
                required
              />
              {errors.account_id && <div className="invalid-feedback" style={{ display: 'block' }}>{errors.account_id}</div>}
            </div>
            
            <div className="form-group mb-3">
              <label><i className="fa fa-info-circle me-2"></i>Remarks (Optional)</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                className="form-control"
                rows={3}
                placeholder="Enter remarks (optional)"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
            <button type="submit" className="btn btn-success">
              <i className="fa fa-save me-2"></i>
              {loan ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


