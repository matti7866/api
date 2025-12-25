import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import accountManagementService from '../../services/accountManagementService';
import type {
  AccountManagement,
  Currency,
  CreateAccountRequest,
  UpdateAccountRequest
} from '../../types/accountManagement';
import './AccountManagement.css';

export default function AccountManagement() {
  const queryClient = useQueryClient();

  // State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Form states
  const [formData, setFormData] = useState<CreateAccountRequest>({
    account_name: '',
    account_number: '',
    accountType: 1,
    currency_type: 0
  });

  const [editFormData, setEditFormData] = useState<UpdateAccountRequest>({
    accountID: 0,
    updaccount_name: '',
    updaccount_number: '',
    updaccountType: 1,
    updcurrency_type: 0
  });

  // Fetch accounts
  const { data: accounts = [], isLoading, refetch } = useQuery<AccountManagement[]>({
    queryKey: ['account-management'],
    queryFn: () => accountManagementService.getAccounts()
  });

  // Fetch currencies
  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['account-currencies'],
    queryFn: () => accountManagementService.getCurrencies(),
    staleTime: 300000
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data: CreateAccountRequest) => accountManagementService.addAccount(data),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Account added successfully', 'success');
        setShowAddModal(false);
        resetAddForm();
        refetch();
      } else {
        Swal.fire('Error', response, 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add account', 'error');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateAccountRequest) => accountManagementService.updateAccount(data),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Account updated successfully', 'success');
        setShowEditModal(false);
        resetEditForm();
        refetch();
      } else {
        Swal.fire('Error', response, 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update account', 'error');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => accountManagementService.deleteAccount(id),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Account deleted successfully', 'success');
        refetch();
      } else {
        Swal.fire('Error', response, 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to delete account', 'error');
    }
  });

  const resetAddForm = () => {
    setFormData({
      account_name: '',
      account_number: '',
      accountType: 1,
      currency_type: currencies.length > 0 ? currencies[0].currencyID : 0
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      accountID: 0,
      updaccount_name: '',
      updaccount_number: '',
      updaccountType: 1,
      updcurrency_type: 0
    });
  };

  const handleAddNew = () => {
    resetAddForm();
    setShowAddModal(true);
  };

  const handleEdit = async (id: number) => {
    try {
      const account = await accountManagementService.getAccount(id);
      setEditFormData({
        accountID: account.account_ID,
        updaccount_name: account.account_Name,
        updaccount_number: account.accountNum || '',
        updaccountType: account.accountType,
        updcurrency_type: account.curID
      });
      setSelectedId(id);
      setShowEditModal(true);
    } catch (error: any) {
      Swal.fire('Error', error.message || 'Failed to fetch account', 'error');
    }
  };

  const handleDelete = (id: number, accountName: string) => {
    Swal.fire({
      title: 'Delete Account?',
      text: `Do you want to delete account: ${accountName}`,
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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.account_name) {
      Swal.fire('Validation Error', 'Account name is required', 'error');
      return;
    }
    if (formData.accountType === -1 || formData.accountType === 0) {
      Swal.fire('Validation Error', 'Account type is required', 'error');
      return;
    }
    if (formData.currency_type === -1 || formData.currency_type === 0) {
      Swal.fire('Validation Error', 'Currency is required', 'error');
      return;
    }

    addMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editFormData.updaccount_name) {
      Swal.fire('Validation Error', 'Account name is required', 'error');
      return;
    }
    if (editFormData.updaccountType === -1 || editFormData.updaccountType === 0) {
      Swal.fire('Validation Error', 'Account type is required', 'error');
      return;
    }
    if (editFormData.updcurrency_type === -1 || editFormData.updcurrency_type === 0) {
      Swal.fire('Validation Error', 'Currency is required', 'error');
      return;
    }

    updateMutation.mutate(editFormData);
  };

  const getAccountTypeName = (type: number): string => {
    switch (type) {
      case 1: return 'Personal';
      case 2: return 'Business';
      case 3: return 'Cash';
      default: return 'Unknown';
    }
  };

  return (
    <div className="account-management-container">
      <div className="card">
        <div className="card-header-custom">
          <h2>
            <i className="fa fa-fw fa-paypal"></i> Account Management
          </h2>
        </div>

        <div className="card-body">
          <div className="actions-row">
            <button className="btn btn-primary" onClick={handleAddNew}>
              <i className="fa fa-plus"></i> Add Account
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>S#</th>
                  <th>Account Name</th>
                  <th>Account Number</th>
                  <th>Account Type</th>
                  <th>Currency</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center">Loading...</td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center">No accounts found</td>
                  </tr>
                ) : (
                  accounts.map((account, index) => (
                    <tr key={account.account_ID}>
                      <td className="text-center">{index + 1}</td>
                      <td className="text-capitalize">{account.account_Name}</td>
                      <td className="text-center">{account.accountNum || '-'}</td>
                      <td className="text-capitalize text-center">
                        {account.accountTypeName && account.accountTypeName !== 'Unknown' 
                          ? account.accountTypeName 
                          : getAccountTypeName(account.accountType)}
                      </td>
                      <td className="text-capitalize text-center">{account.currencyName || '-'}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleEdit(account.account_ID)}
                          title="Edit"
                        >
                          <i className="fa fa-edit"></i>
                        </button>
                        &nbsp;
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(account.account_ID, account.account_Name)}
                          title="Delete"
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
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>Add Account</h5>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Account Name:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.account_name}
                    onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                    placeholder="Account Name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Account Number:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    placeholder="Account Number"
                  />
                </div>

                <div className="form-group">
                  <label>Account Type:</label>
                  <select
                    className="form-control"
                    value={formData.accountType}
                    onChange={(e) => setFormData({ ...formData, accountType: Number(e.target.value) })}
                    required
                  >
                    <option value="-1">--Select Account Type--</option>
                    <option value="1">Personal</option>
                    <option value="2">Business</option>
                    <option value="3">Cash</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Currency:</label>
                  <select
                    className="form-control"
                    value={formData.currency_type}
                    onChange={(e) => setFormData({ ...formData, currency_type: Number(e.target.value) })}
                    required
                  >
                    <option value="-1">--Select Currency--</option>
                    {currencies.map((currency) => (
                      <option key={currency.currencyID} value={currency.currencyID}>
                        {currency.currencyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Account Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header bg-dark">
              <h5>Update Account</h5>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Account Name:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.updaccount_name}
                    onChange={(e) => setEditFormData({ ...editFormData, updaccount_name: e.target.value })}
                    placeholder="Account Name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Account Number:</label>
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.updaccount_number}
                    onChange={(e) => setEditFormData({ ...editFormData, updaccount_number: e.target.value })}
                    placeholder="Account Number"
                  />
                </div>

                <div className="form-group">
                  <label>Account Type:</label>
                  <select
                    className="form-control"
                    value={editFormData.updaccountType}
                    onChange={(e) => setEditFormData({ ...editFormData, updaccountType: Number(e.target.value) })}
                    required
                  >
                    <option value="-1">--Select Account Type--</option>
                    <option value="1">Personal</option>
                    <option value="2">Business</option>
                    <option value="3">Cash</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Currency:</label>
                  <select
                    className="form-control"
                    value={editFormData.updcurrency_type}
                    onChange={(e) => setEditFormData({ ...editFormData, updcurrency_type: Number(e.target.value) })}
                    required
                  >
                    <option value="-1">--Select Currency--</option>
                    {currencies.map((currency) => (
                      <option key={currency.currencyID} value={currency.currencyID}>
                        {currency.currencyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-danger">
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

