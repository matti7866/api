import { useState, useEffect } from 'react';
import { config } from '../../utils/config';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import chequeService from '../../services/chequeService';
import type {
  Cheque,
  ChequeFilters,
  CreateChequeRequest,
  UpdateChequeRequest,
  Account
} from '../../types/cheque';
import './Cheques.css';

export default function Cheques() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  // State
  const [filters, setFilters] = useState<ChequeFilters>({
    startDate: firstDayOfMonth,
    endDate: today,
    search: '',
    type: '',
    account: ''
  });
  
  const [cheques, setCheques] = useState<Cheque[]>([]);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Form states
  const [formData, setFormData] = useState<Partial<CreateChequeRequest>>({
    date: today,
    number: '',
    type: 'payable',
    payee: '',
    amount: 0,
    amountConfirm: 0,
    account_id: undefined,
    bank: ''
  });
  
  const [editFormData, setEditFormData] = useState<Partial<UpdateChequeRequest>>({
    id: 0,
    date: today,
    number: '',
    type: 'payable',
    payee: '',
    amount: 0,
    amountConfirm: 0,
    account_id: undefined,
    bank: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editFile, setEditFile] = useState<File | null>(null);

  // Fetch accounts for dropdown
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['cheque-accounts'],
    queryFn: () => chequeService.getAccounts(),
    staleTime: 300000
  });

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: (filters: ChequeFilters) => chequeService.searchCheques(filters),
    onSuccess: (data) => {
      setCheques(data);
    },
    onError: (error: any) => {
      console.error('Search error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to fetch cheques', 'error');
    }
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data: CreateChequeRequest) => chequeService.addCheque(data),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        setShowAddModal(false);
        resetAddForm();
        searchMutation.mutate(filters);
      } else {
        if (data.message === 'form_errors' && data.errors) {
          let errorMsg = '';
          Object.values(data.errors).forEach(err => {
            errorMsg += err + '\n';
          });
          Swal.fire('Validation Error', errorMsg, 'error');
        } else {
          Swal.fire('Error', data.message, 'error');
        }
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add cheque', 'error');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateChequeRequest) => chequeService.updateCheque(data),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        setShowEditModal(false);
        resetEditForm();
        searchMutation.mutate(filters);
      } else {
        if (data.message === 'form_errors' && data.errors) {
          let errorMsg = '';
          Object.values(data.errors).forEach(err => {
            errorMsg += err + '\n';
          });
          Swal.fire('Validation Error', errorMsg, 'error');
        } else {
          Swal.fire('Error', data.message, 'error');
        }
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update cheque', 'error');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => chequeService.deleteCheque(id),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        searchMutation.mutate(filters);
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    }
  });

  // Pay mutation
  const payMutation = useMutation({
    mutationFn: (id: number) => chequeService.payCheque(id),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        searchMutation.mutate(filters);
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    }
  });

  // Load cheques on mount
  useEffect(() => {
    searchMutation.mutate(filters);
  }, []);

  const resetAddForm = () => {
    setFormData({
      date: today,
      number: '',
      type: 'payable',
      payee: '',
      amount: 0,
      amountConfirm: 0,
      account_id: undefined,
      bank: ''
    });
    setSelectedFile(null);
  };

  const resetEditForm = () => {
    setEditFormData({
      id: 0,
      date: today,
      number: '',
      type: 'payable',
      payee: '',
      amount: 0,
      amountConfirm: 0,
      account_id: undefined,
      bank: ''
    });
    setEditFile(null);
  };

  const handleAddNew = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const cheque = await chequeService.getCheque(id);
      setEditFormData({
        id: cheque.id,
        date: cheque.date,
        number: cheque.number,
        type: cheque.type,
        payee: cheque.payee,
        amount: cheque.amount,
        amountConfirm: cheque.amount,
        account_id: cheque.account_id || undefined,
        bank: cheque.bank || ''
      });
      setShowEditModal(true);
    } catch (error: any) {
      Swal.fire('Error', error.message || 'Failed to fetch cheque', 'error');
    }
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You want to delete this cheque record?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const handlePay = (id: number, amount: number, payee: string) => {
    Swal.fire({
      title: 'Mark this cheque as PAID?',
      html: `
        <div style="text-align: left; margin: 20px;">
          <p><strong>Payee:</strong> ${payee}</p>
          <p><strong>Amount:</strong> ${amount} AED</p>
          <p class="text-danger mt-3">This action cannot be undone.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, mark as paid'
    }).then((result) => {
      if (result.isConfirmed) {
        payMutation.mutate(id);
      }
    });
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      Swal.fire('Error', 'Please upload a cheque photo', 'error');
      return;
    }
    
    if (formData.amount !== formData.amountConfirm) {
      Swal.fire('Error', 'Amount and Confirm Amount must match', 'error');
      return;
    }
    
    if (formData.type === 'payable' && !formData.account_id) {
      Swal.fire('Error', 'Please select an account for payable cheque', 'error');
      return;
    }
    
    if (formData.type === 'receivable' && !formData.bank) {
      Swal.fire('Error', 'Please enter bank name for receivable cheque', 'error');
      return;
    }

    addMutation.mutate({
      ...formData,
      file: selectedFile
    } as CreateChequeRequest);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editFormData.amount !== editFormData.amountConfirm) {
      Swal.fire('Error', 'Amount and Confirm Amount must match', 'error');
      return;
    }
    
    if (editFormData.type === 'payable' && !editFormData.account_id) {
      Swal.fire('Error', 'Please select an account for payable cheque', 'error');
      return;
    }
    
    if (editFormData.type === 'receivable' && !editFormData.bank) {
      Swal.fire('Error', 'Please enter bank name for receivable cheque', 'error');
      return;
    }

    updateMutation.mutate({
      ...editFormData,
      file: editFile || undefined
    } as UpdateChequeRequest);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchMutation.mutate(filters);
  };

  return (
    <div className="cheques-container">
      <div className="page-header">
        <h3>Cheques</h3>
        <button className="btn btn-success" onClick={handleAddNew}>
          <i className="fa fa-plus"></i> Add Cheque
        </button>
      </div>

      {/* Search Panel */}
      <div className="panel">
        <div className="panel-heading">
          <h4>Search Cheques</h4>
        </div>
        <div className="panel-body">
          <form onSubmit={handleSearch}>
            <div className="search-filters">
              <div className="form-group">
                <label>From Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>To Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Search</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select
                  className="form-control"
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value as any })}
                >
                  <option value="">Select</option>
                  <option value="payable">Payable</option>
                  <option value="receivable">Receivable</option>
                </select>
              </div>
              <div className="form-group">
                <label>Account</label>
                <select
                  className="form-control"
                  value={filters.account}
                  onChange={(e) => setFilters({ ...filters, account: e.target.value })}
                >
                  <option value="">Select</option>
                  {accounts.map((account) => (
                    <option key={account.account_ID} value={account.account_ID}>
                      {account.account_Name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>&nbsp;</label>
                <button type="submit" className="btn btn-primary w-100">
                  <i className="fa fa-filter"></i> Filter
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Cheques Table */}
      <div className="panel">
        <div className="panel-heading">
          <h4>Cheques</h4>
        </div>
        <div className="panel-body">
          <div className="table-responsive">
            <table className="table table-striped table-bordered">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Date</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Payee</th>
                  <th>Account / Bank</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {searchMutation.isPending ? (
                  <tr>
                    <td colSpan={9} className="text-center">Loading...</td>
                  </tr>
                ) : cheques.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center">No cheques found</td>
                  </tr>
                ) : (
                  cheques.map((cheque) => (
                    <tr key={cheque.id}>
                      <td>{cheque.id}</td>
                      <td>{new Date(cheque.date).toLocaleDateString()}</td>
                      <td>{cheque.number}</td>
                      <td>
                        <span className={`badge ${cheque.type === 'payable' ? 'badge-danger' : 'badge-success'}`}>
                          {cheque.type === 'payable' ? 'Payable' : 'Receivable'}
                        </span>
                      </td>
                      <td>{cheque.payee}</td>
                      <td>{cheque.type === 'payable' ? cheque.account : cheque.bank}</td>
                      <td>{cheque.amount} AED</td>
                      <td>
                        {cheque.cheque_status === 'paid' ? (
                          <div>
                            <span className="badge badge-success">Paid</span>
                            {cheque.paid_date && (
                              <><br /><small className="text-muted">Paid: {new Date(cheque.paid_date).toLocaleString()}</small></>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-warning">Pending</span>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          {cheque.type === 'payable' && cheque.cheque_status !== 'paid' && (
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handlePay(cheque.id, cheque.amount, cheque.payee)}
                              title="Mark as Paid"
                            >
                              <i className="fa fa-credit-card"></i>
                            </button>
                          )}
                          {cheque.filename && (
                            <a
                              href={`${config.baseUrl}/attachment/cheques/${cheque.filename}`}
                              className="btn btn-sm btn-info"
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View Photo"
                            >
                              <i className="fa fa-photo"></i>
                            </a>
                          )}
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleEdit(cheque.id)}
                            title="Edit"
                          >
                            <i className="fa fa-edit"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(cheque.id)}
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
        </div>
      </div>

      {/* Add Cheque Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>New Cheque</h5>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label>Date <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-8">
                    <label>Number <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.number}
                      onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label>Type <span className="text-danger">*</span></label>
                    <select
                      className="form-control"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as 'payable' | 'receivable' })}
                      required
                    >
                      <option value="">Choose type</option>
                      <option value="payable">Payable</option>
                      <option value="receivable">Receivable</option>
                    </select>
                  </div>
                  
                  {formData.type === 'payable' && (
                    <div className="form-group col-md-8">
                      <label>From Account <span className="text-danger">*</span></label>
                      <select
                        className="form-control"
                        value={formData.account_id || ''}
                        onChange={(e) => setFormData({ ...formData, account_id: Number(e.target.value) })}
                        required
                      >
                        <option value="">Select Account</option>
                        {accounts.map((account) => (
                          <option key={account.account_ID} value={account.account_ID}>
                            {account.account_Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {formData.type === 'receivable' && (
                    <div className="form-group col-md-8">
                      <label>Bank Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={formData.bank}
                        onChange={(e) => setFormData({ ...formData, bank: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Payee</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.payee}
                    onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label>Amount <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-6">
                    <label>Confirm Amount <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formData.amountConfirm || ''}
                      onChange={(e) => setFormData({ ...formData, amountConfirm: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Cheque Photo <span className="text-danger">*</span></label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-success">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Cheque Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>Edit Cheque</h5>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label>Date <span className="text-danger">*</span></label>
                    <input
                      type="date"
                      className="form-control"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-8">
                    <label>Number <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      value={editFormData.number}
                      onChange={(e) => setEditFormData({ ...editFormData, number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label>Type <span className="text-danger">*</span></label>
                    <select
                      className="form-control"
                      value={editFormData.type}
                      onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value as 'payable' | 'receivable' })}
                      required
                    >
                      <option value="payable">Payable</option>
                      <option value="receivable">Receivable</option>
                    </select>
                  </div>
                  
                  {editFormData.type === 'payable' && (
                    <div className="form-group col-md-8">
                      <label>From Account <span className="text-danger">*</span></label>
                      <select
                        className="form-control"
                        value={editFormData.account_id || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, account_id: Number(e.target.value) })}
                        required
                      >
                        <option value="">Select Account</option>
                        {accounts.map((account) => (
                          <option key={account.account_ID} value={account.account_ID}>
                            {account.account_Name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {editFormData.type === 'receivable' && (
                    <div className="form-group col-md-8">
                      <label>Bank Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={editFormData.bank}
                        onChange={(e) => setEditFormData({ ...editFormData, bank: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Payee</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.payee}
                    onChange={(e) => setEditFormData({ ...editFormData, payee: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group col-md-6">
                    <label>Amount <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editFormData.amount || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group col-md-6">
                    <label>Confirm Amount <span className="text-danger">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={editFormData.amountConfirm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, amountConfirm: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Cheque Photo <span className="text-danger">(if you wish to update)</span></label>
                  <input
                    type="file"
                    className="form-control"
                    accept="image/*"
                    onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-success">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


