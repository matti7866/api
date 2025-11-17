import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import tasheelService from '../../services/tasheelService';
import type {
  TasheelTransaction,
  Company,
  TransactionType,
  CreateTasheelRequest,
  UpdateTasheelRequest,
  ChangeStatusRequest
} from '../../types/tasheel';
import './TasheelTransactions.css';

export default function TasheelTransactions() {
  const queryClient = useQueryClient();

  // State
  const [activeTab, setActiveTab] = useState<'in_process' | 'completed'>('in_process');
  const [filters, setFilters] = useState({
    company: '',
    type: '',
    search: '',
    mohrestatus: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [transactions, setTransactions] = useState<TasheelTransaction[]>([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalRecords: 0,
    recordsPerPage: 10
  });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [showMarkCompleteModal, setShowMarkCompleteModal] = useState(false);
  const [showAddTypeModal, setShowAddTypeModal] = useState(false);

  // Form states
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Partial<CreateTasheelRequest>>({
    company_id: undefined,
    transaction_type_id: 0,
    transaction_number: '',
    cost: undefined,
    mohrestatus: '',
    status: 'in_process'
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [changeStatusData, setChangeStatusData] = useState({ id: 0, mohrestatus: '' });
  const [completeTransactionId, setCompleteTransactionId] = useState(0);
  const [newTypeName, setNewTypeName] = useState('');

  // Fetch dropdowns
  const { data: dropdowns } = useQuery({
    queryKey: ['tasheel-dropdowns'],
    queryFn: () => tasheelService.getDropdowns(),
    staleTime: 300000
  });

  const companies: Company[] = dropdowns?.companies || [];
  const types: TransactionType[] = dropdowns?.types || [];

  // Search transactions mutation
  const searchMutation = useMutation({
    mutationFn: () => tasheelService.searchTransactions({
      ...filters,
      status_filter: activeTab,
      page: currentPage
    }),
    onSuccess: (data) => {
      console.log('Search response:', data);
      
      // Handle both direct data and nested data structures
      const transactionsData = data.data || data;
      
      if (Array.isArray(transactionsData)) {
        setTransactions(transactionsData);
        setPagination({
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 1,
          totalRecords: data.totalRecords || 0,
          recordsPerPage: data.recordsPerPage || 10
        });
      } else if (data.status === 'success') {
        // Success with empty results
        setTransactions([]);
        setPagination({
          currentPage: data.currentPage || 1,
          totalPages: data.totalPages || 0,
          totalRecords: data.totalRecords || 0,
          recordsPerPage: data.recordsPerPage || 10
        });
      }
    },
    onError: (error: any) => {
      console.error('Search error:', error);
      // Don't show error for successful empty results
      if (error?.status !== 'success') {
        Swal.fire('Error', error.response?.data?.message || 'Failed to fetch transactions', 'error');
      }
    }
  });

  // Add transaction mutation
  const addMutation = useMutation({
    mutationFn: (data: CreateTasheelRequest) => tasheelService.addTransaction(data),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        setShowAddModal(false);
        resetForm();
        searchMutation.mutate();
        queryClient.invalidateQueries({ queryKey: ['tasheel-dropdowns'] });
      } else {
        if (data.message === 'form_errors' && data.errors) {
          let errorMsg = 'Validation errors:\n';
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
      Swal.fire('Error', error.response?.data?.message || 'Failed to add transaction', 'error');
    }
  });

  // Update transaction mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateTasheelRequest) => tasheelService.updateTransaction(data),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        setShowAddModal(false);
        resetForm();
        searchMutation.mutate();
      } else {
        if (data.message === 'form_errors' && data.errors) {
          let errorMsg = 'Validation errors:\n';
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
      Swal.fire('Error', error.response?.data?.message || 'Failed to update transaction', 'error');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => tasheelService.deleteTransaction(id),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        searchMutation.mutate();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    }
  });

  // Change status mutation
  const changeStatusMutation = useMutation({
    mutationFn: (data: ChangeStatusRequest) => tasheelService.changeStatus(data),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        setShowChangeStatusModal(false);
        searchMutation.mutate();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    }
  });

  // Mark complete mutation
  const markCompleteMutation = useMutation({
    mutationFn: (id: number) => tasheelService.markAsCompleted(id),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        setShowMarkCompleteModal(false);
        setActiveTab('completed');
        searchMutation.mutate();
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    }
  });

  // Add type mutation
  const addTypeMutation = useMutation({
    mutationFn: (name: string) => tasheelService.addTransactionType(name),
    onSuccess: (data) => {
      if (data.status === 'success') {
        Swal.fire('Success', data.message, 'success');
        setShowAddTypeModal(false);
        setNewTypeName('');
        queryClient.invalidateQueries({ queryKey: ['tasheel-dropdowns'] });
      } else {
        Swal.fire('Error', data.message, 'error');
      }
    }
  });

  // Load transactions on mount and when filters/tab change
  useEffect(() => {
    searchMutation.mutate();
  }, [activeTab, currentPage]);

  const resetForm = () => {
    setFormData({
      company_id: undefined,
      transaction_type_id: 0,
      transaction_number: '',
      cost: undefined,
      mohrestatus: '',
      status: 'in_process'
    });
    setSelectedFile(null);
    setExtractionStatus('');
    setIsEditMode(false);
    setSelectedId(null);
  };

  const handleAddNew = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const transaction = await tasheelService.getTransaction(id);
      setFormData({
        company_id: transaction.company_id || undefined,
        transaction_type_id: transaction.transaction_type_id,
        transaction_number: transaction.transaction_number,
        cost: transaction.cost || undefined,
        mohrestatus: transaction.mohrestatus || '',
        status: transaction.status
      });
      setSelectedId(id);
      setIsEditMode(true);
      setShowAddModal(true);
    } catch (error: any) {
      Swal.fire('Error', error.message || 'Failed to fetch transaction', 'error');
    }
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You want to delete this transaction?',
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

  const handleChangeStatus = (id: number, currentStatus: string) => {
    setChangeStatusData({ id, mohrestatus: currentStatus || '' });
    setShowChangeStatusModal(true);
  };

  const handleMarkComplete = (id: number) => {
    setCompleteTransactionId(id);
    setShowMarkCompleteModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.transaction_type_id || !formData.transaction_number) {
      Swal.fire('Validation Error', 'Transaction Type and Transaction Number are required', 'error');
      return;
    }

    if (isEditMode && selectedId) {
      updateMutation.mutate({
        id: selectedId,
        ...formData
      } as UpdateTasheelRequest);
    } else {
      addMutation.mutate({
        ...formData,
        attachment: selectedFile || undefined
      } as CreateTasheelRequest);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    searchMutation.mutate();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setExtractionStatus('Processing file...');
    
    // For now, we'll just store the file. 
    // The extraction logic would need a server-side endpoint or PDF.js integration
    setExtractionStatus('File selected. Please enter the application number manually for now.');
  };

  const getStatusBadgeClass = (status: string | null): string => {
    if (!status) return 'badge-secondary';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('complete') || statusLower.includes('approved') || statusLower.includes('success')) {
      return 'badge-success';
    }
    if (statusLower.includes('reject') || statusLower.includes('fail') || statusLower.includes('error')) {
      return 'badge-danger';
    }
    if (statusLower.includes('process') || statusLower.includes('under') || statusLower.includes('pending')) {
      return 'badge-warning';
    }
    return 'badge-info';
  };

  return (
    <div className="tasheel-container">
      <div className="page-header">
        <h3>Tasheel Transactions</h3>
        <button className="btn btn-success" onClick={handleAddNew}>
          <i className="fa fa-plus"></i> Add Transaction
        </button>
      </div>

      {/* Search Panel */}
      <div className="panel">
        <div className="panel-heading">
          <h4>Search Transactions</h4>
        </div>
        <div className="panel-body">
          <form onSubmit={handleSearch}>
            <div className="search-filters">
              <div className="form-group">
                <label>Company</label>
                <select
                  className="form-control"
                  value={filters.company}
                  onChange={(e) => setFilters({ ...filters, company: e.target.value })}
                >
                  <option value="">Select</option>
                  {companies.map((company) => (
                    <option key={company.company_id} value={company.company_id}>
                      {company.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Transaction Type</label>
                <div className="input-group">
                  <select
                    className="form-control"
                    value={filters.type}
                    onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  >
                    <option value="">All</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => setShowAddTypeModal(true)}
                  >
                    <i className="fa fa-plus"></i>
                  </button>
                </div>
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
                <label>Moher Status</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Moher Status"
                  value={filters.mohrestatus}
                  onChange={(e) => setFilters({ ...filters, mohrestatus: e.target.value })}
                />
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

      {/* Transactions Panel */}
      <div className="panel">
        <div className="panel-heading">
          <h4>Transactions</h4>
        </div>
        <div className="tabs-container">
          <ul className="nav nav-tabs">
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'in_process' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('in_process');
                  setCurrentPage(1);
                }}
              >
                In Process
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === 'completed' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('completed');
                  setCurrentPage(1);
                }}
              >
                Completed
              </button>
            </li>
          </ul>
          <div className="tab-content">
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Company</th>
                    <th>Transaction</th>
                    <th>Moher Status</th>
                    <th>Cost</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searchMutation.isPending ? (
                    <tr>
                      <td colSpan={6} className="text-center">Loading...</td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center">No transactions found</td>
                    </tr>
                  ) : (
                    transactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.id}</td>
                        <td>{transaction.company_name || '-'}</td>
                        <td>
                          <strong>{transaction.transaction_number}</strong>
                          <br />
                          <small className="text-muted">{transaction.transaction_type_name}</small>
                          {transaction.api_transaction_type && (
                            <>
                              <br />
                              <small className="text-muted">API Type: {transaction.api_transaction_type}</small>
                            </>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${getStatusBadgeClass(transaction.mohrestatus)}`}>
                            {transaction.mohrestatus || 'No Status'}
                          </span>
                        </td>
                        <td>{transaction.cost ? `${transaction.cost} AED` : '-'}</td>
                        <td>
                          <div className="btn-group">
                            <button
                              className="btn btn-sm btn-info"
                              onClick={() => handleChangeStatus(transaction.id, transaction.mohrestatus || '')}
                              title="Change Status"
                            >
                              <i className="fa fa-edit"></i>
                            </button>
                            {activeTab === 'in_process' && (
                              <>
                                <button
                                  className="btn btn-sm btn-warning"
                                  onClick={() => handleEdit(transaction.id)}
                                  title="Edit"
                                >
                                  <i className="fa fa-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-success"
                                  onClick={() => handleMarkComplete(transaction.id)}
                                  title="Mark as Completed"
                                >
                                  <i className="fa fa-check"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDelete(transaction.id)}
                                  title="Delete"
                                >
                                  <i className="fa fa-trash"></i>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  Showing {((pagination.currentPage - 1) * pagination.recordsPerPage) + 1} to{' '}
                  {Math.min(pagination.currentPage * pagination.recordsPerPage, pagination.totalRecords)} of{' '}
                  {pagination.totalRecords} entries
                </div>
                <ul className="pagination">
                  <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1}>
                      Previous
                    </button>
                  </li>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                    <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                      <button className="page-link" onClick={() => setCurrentPage(page)}>
                        {page}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${currentPage === pagination.totalPages ? 'disabled' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === pagination.totalPages}
                    >
                      Next
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Transaction Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>{isEditMode ? 'Edit Transaction' : 'New Transaction'}</h5>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Company Name</label>
                  <select
                    className="form-control"
                    value={formData.company_id || ''}
                    onChange={(e) => setFormData({ ...formData, company_id: Number(e.target.value) || undefined })}
                  >
                    <option value="">Select</option>
                    {companies.map((company) => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>
                    Transaction Type <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <select
                      className="form-control"
                      value={formData.transaction_type_id || ''}
                      onChange={(e) => setFormData({ ...formData, transaction_type_id: Number(e.target.value) })}
                      required
                    >
                      <option value="">Select</option>
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={() => setShowAddTypeModal(true)}
                    >
                      <i className="fa fa-plus"></i>
                    </button>
                  </div>
                </div>

                {!isEditMode && (
                  <div className="form-group">
                    <label>Upload PDF/Image (to extract application number)</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileChange}
                    />
                    {extractionStatus && (
                      <div className="alert alert-info mt-2">{extractionStatus}</div>
                    )}
                  </div>
                )}

                <div className="form-group">
                  <label>
                    Transaction Number <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.transaction_number}
                    onChange={(e) => setFormData({ ...formData, transaction_number: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={formData.cost || ''}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) || undefined })}
                    placeholder="Cost"
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

      {/* Change Status Modal */}
      {showChangeStatusModal && (
        <div className="modal-overlay" onClick={() => setShowChangeStatusModal(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>Change Moher Status</h5>
              <button className="close-btn" onClick={() => setShowChangeStatusModal(false)}>&times;</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                changeStatusMutation.mutate(changeStatusData);
              }}
            >
              <div className="modal-body">
                <div className="form-group">
                  <label>Moher Status</label>
                  <input
                    type="text"
                    className="form-control"
                    value={changeStatusData.mohrestatus}
                    onChange={(e) => setChangeStatusData({ ...changeStatusData, mohrestatus: e.target.value })}
                    placeholder="Moher Status"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowChangeStatusModal(false)}>
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

      {/* Mark Complete Modal */}
      {showMarkCompleteModal && (
        <div className="modal-overlay" onClick={() => setShowMarkCompleteModal(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>Mark Transaction as Completed</h5>
              <button className="close-btn" onClick={() => setShowMarkCompleteModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to mark this transaction as completed?</p>
              <p>Once marked as completed, this transaction will not be updated by automatic processes.</p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowMarkCompleteModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => {
                  markCompleteMutation.mutate(completeTransactionId);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Type Modal */}
      {showAddTypeModal && (
        <div className="modal-overlay" onClick={() => setShowAddTypeModal(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>Add Transaction Type</h5>
              <button className="close-btn" onClick={() => setShowAddTypeModal(false)}>&times;</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newTypeName.trim()) {
                  Swal.fire('Error', 'Type name is required', 'error');
                  return;
                }
                addTypeMutation.mutate(newTypeName);
              }}
            >
              <div className="modal-body">
                <div className="form-group">
                  <label>
                    Type Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTypeModal(false)}>
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
    </div>
  );
}

