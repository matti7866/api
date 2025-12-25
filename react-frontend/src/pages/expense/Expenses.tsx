import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import expenseService, { expenseTypeService, expenseDashboardService } from '../../services/expenseService';
import supplierService from '../../services/supplierService';
import SearchableSelect from '../../components/form/SearchableSelect';
import type { CreateExpenseRequest, ExpenseType, Expense, ExpenseFilters } from '../../types/expense';
import type { SupplierDropdownData } from '../../types/supplier';
import './Expenses.css';

type TabType = 'dashboard' | 'expense-types' | 'add-expense' | 'view-expenses';

export default function Expenses() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [formData, setFormData] = useState<Partial<CreateExpenseRequest>>({
    expense_type_id: undefined,
    expense_amount: undefined,
    currency_id: undefined,
    account_id: undefined,
    expense_remark: '',
    amount_type: 'fixed'
  });
  
  const [expenseDocument, setExpenseDocument] = useState<File | null>(null);
  const [expenseTypeFormData, setExpenseTypeFormData] = useState({ expense_type: '' });
  const [editingExpenseType, setEditingExpenseType] = useState<ExpenseType | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showAddExpenseTypeModal, setShowAddExpenseTypeModal] = useState(false);
  const [showUpdateExpenseTypeModal, setShowUpdateExpenseTypeModal] = useState(false);
  const [showUpdateExpenseModal, setShowUpdateExpenseModal] = useState(false);
  const [searchFilters, setSearchFilters] = useState<ExpenseFilters>({
    search_term: 'DateWise',
    from_date: new Date().toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0],
    employee_id: undefined
  });
  const [dateSearchEnabled, setDateSearchEnabled] = useState(false);
  
  const queryClient = useQueryClient();
  const chartCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);
  
  // Load expense types
  const { data: expenseTypes = [], refetch: refetchExpenseTypes } = useQuery<ExpenseType[]>({
    queryKey: ['expense-types'],
    queryFn: () => expenseTypeService.getExpenseTypes(),
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load dropdowns (accounts and currencies)
  const { data: dropdowns } = useQuery<SupplierDropdownData>({
    queryKey: ['supplier-dropdowns'],
    queryFn: () => supplierService.getDropdowns(),
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => expenseService.getEmployees(),
    staleTime: 60000,
    refetchOnWindowFocus: false
  });
  
  // Load dashboard stats
  const { data: dashboardStats, refetch: refetchDashboardStats } = useQuery({
    queryKey: ['expense-dashboard-stats'],
    queryFn: () => expenseDashboardService.getDashboardStats(),
    enabled: activeTab === 'dashboard',
    staleTime: 30000,
    refetchOnWindowFocus: false
  });
  
  // Load chart data
  const { data: chartData } = useQuery({
    queryKey: ['expense-chart-data'],
    queryFn: () => expenseDashboardService.getChartData(),
    enabled: activeTab === 'dashboard',
    staleTime: 30000,
    refetchOnWindowFocus: false
  });
  
  // Load recent activities
  const { data: recentActivities = [] } = useQuery({
    queryKey: ['expense-recent-activities'],
    queryFn: () => expenseDashboardService.getRecentActivities(),
    enabled: activeTab === 'dashboard',
    staleTime: 30000,
    refetchOnWindowFocus: false
  });
  
  // Load expenses for view tab
  const { data: expenses = [], refetch: refetchExpenses } = useQuery<Expense[]>({
    queryKey: ['expenses', searchFilters],
    queryFn: () => expenseService.getExpenses(searchFilters),
    enabled: activeTab === 'view-expenses' && (dateSearchEnabled || searchFilters.employee_id),
    staleTime: 10000,
    refetchOnWindowFocus: false
  });
  
  // Auto-select first currency when currencies are loaded
  useEffect(() => {
    if (dropdowns?.currencies && dropdowns.currencies.length > 0 && !formData.currency_id) {
      setFormData(prev => ({ ...prev, currency_id: dropdowns.currencies[0].currencyID }));
    }
  }, [dropdowns?.currencies]);
  
  // Initialize chart when chart data is available
  useEffect(() => {
    if (activeTab === 'dashboard' && chartData && chartCanvasRef.current) {
      import('chart.js/auto').then(({ Chart }) => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.destroy();
        }
        
        const ctx = chartCanvasRef.current!.getContext('2d');
        if (ctx) {
          chartInstanceRef.current = new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartData.labels,
              datasets: [{
                label: 'Expenses',
                data: chartData.values,
                borderColor: 'rgb(23, 97, 135)',
                backgroundColor: 'rgba(23, 97, 135, 0.1)',
                tension: 0.4,
                fill: true
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false
                }
              },
              scales: {
                y: {
                  beginAtZero: true
                }
              }
            }
          });
        }
      });
    }
    
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [activeTab, chartData]);
  
  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: (data: CreateExpenseRequest) => expenseService.createExpense(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Expense created successfully',
        timer: 2000,
        showConfirmButton: false
      });
      
      // Reset form
      setFormData({
        expense_type_id: undefined,
        expense_amount: undefined,
        currency_id: undefined,
        account_id: undefined,
        expense_remark: '',
        amount_type: 'fixed'
      });
      setExpenseDocument(null);
      
      // Reset file input
      const fileInput = document.getElementById('expense_document') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      refetchDashboardStats();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || error.message || 'Failed to create expense',
        timer: 3000
      });
    }
  });
  
  // Create expense type mutation
  const createExpenseTypeMutation = useMutation({
    mutationFn: (expense_type: string) => expenseTypeService.createExpenseType(expense_type),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Expense type created successfully',
        timer: 2000,
        showConfirmButton: false
      });
      
      setExpenseTypeFormData({ expense_type: '' });
      setShowAddExpenseTypeModal(false);
      refetchExpenseTypes();
      refetchDashboardStats();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || error.message || 'Failed to create expense type',
        timer: 3000
      });
    }
  });
  
  // Update expense type mutation
  const updateExpenseTypeMutation = useMutation({
    mutationFn: ({ expense_type_id, expense_type }: { expense_type_id: number; expense_type: string }) =>
      expenseTypeService.updateExpenseType(expense_type_id, expense_type),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Expense type updated successfully',
        timer: 2000,
        showConfirmButton: false
      });
      
      setEditingExpenseType(null);
      setExpenseTypeFormData({ expense_type: '' });
      setShowUpdateExpenseTypeModal(false);
      refetchExpenseTypes();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || error.message || 'Failed to update expense type',
        timer: 3000
      });
    }
  });
  
  // Delete expense type mutation
  const deleteExpenseTypeMutation = useMutation({
    mutationFn: (expense_type_id: number) => expenseTypeService.deleteExpenseType(expense_type_id),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Expense type deleted successfully',
        timer: 2000,
        showConfirmButton: false
      });
      
      refetchExpenseTypes();
      refetchDashboardStats();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || error.message || 'Failed to delete expense type',
        timer: 3000
      });
    }
  });
  
  // Update expense mutation
  const updateExpenseMutation = useMutation({
    mutationFn: (data: {
      expense_id: number;
      expense_type_id: number;
      expense_amount: number;
      currency_id: number;
      account_id: number;
      expense_remark: string;
    }) => expenseService.updateExpense(data),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Expense updated successfully',
        timer: 2000,
        showConfirmButton: false
      });
      
      setEditingExpense(null);
      setShowUpdateExpenseModal(false);
      refetchExpenses();
      refetchDashboardStats();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || error.message || 'Failed to update expense',
        timer: 3000
      });
    }
  });
  
  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: (expense_id: number) => expenseService.deleteExpense(expense_id),
    onSuccess: () => {
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Expense deleted successfully',
        timer: 2000,
        showConfirmButton: false
      });
      
      refetchExpenses();
      refetchDashboardStats();
    },
    onError: (error: any) => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.response?.data?.message || error.message || 'Failed to delete expense',
        timer: 3000
      });
    }
  });
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.expense_type_id || formData.expense_type_id === -1) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Expense Type is required'
      });
      return;
    }
    
    if (!formData.expense_amount || formData.expense_amount <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Expense Amount is required'
      });
      return;
    }
    
    if (!formData.expense_remark || formData.expense_remark.trim() === '') {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Remarks is required'
      });
      return;
    }
    
    if (!formData.account_id || formData.account_id === -1) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Account is required'
      });
      return;
    }
    
    if (!formData.currency_id) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Currency is required'
      });
      return;
    }
    
    if (!expenseDocument) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Please upload file for expense'
      });
      return;
    }
    
    // Validate file size (max 3MB)
    if (expenseDocument.size > 3145728) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'File size is greater than 3 MB. Make sure it should be less than 3 MB'
      });
      return;
    }
    
    const expenseData: CreateExpenseRequest = {
      expense_type_id: formData.expense_type_id!,
      expense_amount: Number(formData.expense_amount),
      currency_id: formData.currency_id!,
      account_id: formData.account_id!,
      expense_remark: formData.expense_remark!,
      amount_type: formData.amount_type || 'fixed',
      expense_document: expenseDocument
    };
    
    createExpenseMutation.mutate(expenseData);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setExpenseDocument(e.target.files[0]);
    }
  };
  
  const handleSearchExpenses = () => {
    if (!dateSearchEnabled && !searchFilters.employee_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Warning!',
        text: 'Please enable date search or select an employee'
      });
      return;
    }
    
    const filters: ExpenseFilters = {};
    
    if (dateSearchEnabled && searchFilters.from_date && searchFilters.to_date) {
      if (searchFilters.employee_id) {
        filters.search_term = 'DateAndEmpWise';
        filters.from_date = searchFilters.from_date;
        filters.to_date = searchFilters.to_date;
        filters.employee_id = searchFilters.employee_id;
      } else {
        filters.search_term = 'DateWise';
        filters.from_date = searchFilters.from_date;
        filters.to_date = searchFilters.to_date;
      }
    } else if (searchFilters.employee_id) {
      filters.search_term = 'EmpWise';
      filters.employee_id = searchFilters.employee_id;
    }
    
    setSearchFilters(filters);
    refetchExpenses();
  };
  
  const handleEditExpenseType = async (expenseType: ExpenseType) => {
    setEditingExpenseType(expenseType);
    setExpenseTypeFormData({ expense_type: expenseType.expense_type });
    setShowUpdateExpenseTypeModal(true);
  };
  
  const handleEditExpense = async (expense: Expense) => {
    try {
      const expenseData = await expenseService.getExpense(expense.expense_id);
      setEditingExpense({
        ...expense,
        expense_type_id: expenseData.expense_type_id,
        CurrencyID: expenseData.CurrencyID,
        accountID: expenseData.accountID
      } as any);
      setShowUpdateExpenseModal(true);
    } catch (error: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: error.message || 'Failed to load expense data'
      });
    }
  };
  
  const handleDeleteExpenseType = (expense_type_id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteExpenseTypeMutation.mutate(expense_type_id);
      }
    });
  };
  
  const handleDeleteExpense = (expense_id: number) => {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteExpenseMutation.mutate(expense_id);
      }
    });
  };
  
  const handleUpdateExpenseType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpenseType || !expenseTypeFormData.expense_type.trim()) {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'Expense type name is required'
      });
      return;
    }
    
    updateExpenseTypeMutation.mutate({
      expense_type_id: editingExpenseType.expense_type_id,
      expense_type: expenseTypeFormData.expense_type
    });
  };
  
  const handleUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) {
      return;
    }
    
    const updateData = {
      expense_id: editingExpense.expense_id,
      expense_type_id: editingExpense.expense_type_id as any,
      expense_amount: parseFloat(editingExpense.expense_amount),
      currency_id: editingExpense.CurrencyID as any,
      account_id: editingExpense.accountID as any,
      expense_remark: editingExpense.expense_remark
    };
    
    updateExpenseMutation.mutate(updateData);
  };
  
  return (
    <div className="expenses-page">
      <div className="page-header">
        <h1><i className="fa fa-dollar me-2"></i>Expense Management Dashboard</h1>
      </div>
      
      {/* Statistics Cards */}
      {activeTab === 'dashboard' && dashboardStats && (
        <div className="stats-container">
          <div className="row">
            <div className="col-md-3 col-sm-6 mb-4">
              <div className="stat-card primary">
                <div className="card-body text-center">
                  <i className="fa fa-tags stat-icon text-primary"></i>
                  <div className="stat-number text-primary">{dashboardStats.totalExpenseTypes}</div>
                  <div className="stat-label">Expense Types</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 col-sm-6 mb-4">
              <div className="stat-card success">
                <div className="card-body text-center">
                  <i className="fa fa-money-bill stat-icon text-success"></i>
                  <div className="stat-number text-success">{dashboardStats.totalExpenses}</div>
                  <div className="stat-label">Total Expenses</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 col-sm-6 mb-4">
              <div className="stat-card warning">
                <div className="card-body text-center">
                  <i className="fa fa-calendar-check stat-icon text-warning"></i>
                  <div className="stat-number text-warning">{dashboardStats.thisMonthExpenses}</div>
                  <div className="stat-label">This Month</div>
                </div>
              </div>
            </div>
            <div className="col-md-3 col-sm-6 mb-4">
              <div className="stat-card danger">
                <div className="card-body text-center">
                  <i className="fa fa-exclamation-triangle stat-icon text-danger"></i>
                  <div className="stat-number text-danger">{dashboardStats.pendingDocuments}</div>
                  <div className="stat-label">Missing Documents</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="tabs-container">
        <ul className="nav nav-tabs tabs">
          <li className="nav-item">
            <button
              className={`nav-link tab ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <i className="fa fa-chart-bar me-2"></i>Dashboard
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link tab ${activeTab === 'expense-types' ? 'active' : ''}`}
              onClick={() => setActiveTab('expense-types')}
            >
              <i className="fa fa-tags me-2"></i>Expense Types
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link tab ${activeTab === 'add-expense' ? 'active' : ''}`}
              onClick={() => setActiveTab('add-expense')}
            >
              <i className="fa fa-plus me-2"></i>Add Expense
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link tab ${activeTab === 'view-expenses' ? 'active' : ''}`}
              onClick={() => setActiveTab('view-expenses')}
            >
              <i className="fa fa-list me-2"></i>View Expenses
            </button>
          </li>
        </ul>
      </div>
      
      {/* Tab Content */}
      <div className="tab-content">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="tab-pane active">
            <div className="panel">
              <div className="panel-header">
                <h3><i className="fa fa-chart-line me-2"></i>Expense Overview</h3>
              </div>
              <div className="panel-body">
                <div className="row">
                  <div className="col-md-8">
                    <canvas ref={chartCanvasRef} id="expenseChart" height="100"></canvas>
                  </div>
                  <div className="col-md-4">
                    <h6 className="mb-3">Recent Activities</h6>
                    <div className="recent-activities">
                      {recentActivities.length === 0 ? (
                        <p className="text-muted">No recent activities</p>
                      ) : (
                        recentActivities.map((activity) => (
                          <div key={activity.id} className="activity-item">
                            <div className="activity-amount">{activity.amount} {activity.currency}</div>
                            <div className="activity-type">{activity.type}</div>
                            <div className="activity-staff">{activity.staff} - {activity.time}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Expense Types Tab */}
        {activeTab === 'expense-types' && (
          <div className="tab-pane active">
            <div className="panel">
              <div className="panel-header">
                <div className="d-flex justify-content-between align-items-center">
                  <h3><i className="fa fa-tags me-2"></i>Expense Types Management</h3>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setEditingExpenseType(null);
                      setExpenseTypeFormData({ expense_type: '' });
                      setShowAddExpenseTypeModal(true);
                    }}
                  >
                    <i className="fa fa-plus me-2"></i>Add Expense Type
                  </button>
                </div>
              </div>
              <div className="panel-body">
                <div className="table-responsive">
                  <table className="table table-striped table-bordered">
                    <thead>
                      <tr>
                        <th>S#</th>
                        <th>Expense Type</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseTypes.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center">No expense types found</td>
                        </tr>
                      ) : (
                        expenseTypes.map((type, index) => (
                          <tr key={type.expense_type_id}>
                            <td>{index + 1}</td>
                            <td className="text-capitalize">{type.expense_type}</td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-warning me-2"
                                  onClick={() => handleEditExpenseType(type)}
                                >
                                  <i className="fa fa-edit"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteExpenseType(type.expense_type_id)}
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
          </div>
        )}
        
        {/* Add Expense Tab */}
        {activeTab === 'add-expense' && (
          <div className="tab-pane active">
            <div className="panel">
              <div className="panel-header">
                <h3><i className="fa fa-plus me-2"></i>Add New Expense</h3>
              </div>
              <div className="panel-body">
                <form onSubmit={handleSubmit} id="addExpenseForm">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="expense_type">
                        <i className="fa fa-user me-2"></i>Expense Type:
                      </label>
                      <SearchableSelect
                        options={[
                          { value: '-1', label: '--Expense Type--' },
                          ...(expenseTypes.map(et => ({
                            value: String(et.expense_type_id),
                            label: et.expense_type
                          })))
                        ]}
                        value={formData.expense_type_id ? String(formData.expense_type_id) : '-1'}
                        onChange={(value) => setFormData({ ...formData, expense_type_id: value === '-1' ? undefined : Number(value) })}
                        placeholder="Select Expense Type"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="amount">
                        <i className="fa fa-dollar me-2"></i>Expense Amount:
                      </label>
                      <input
                        type="number"
                        id="amount"
                        name="amount"
                        className="form-control"
                        placeholder="Expense Amount"
                        value={formData.expense_amount || ''}
                        onChange={(e) => setFormData({ ...formData, expense_amount: e.target.value ? Number(e.target.value) : undefined })}
                        step="0.01"
                        min="0"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="expCurrencyType">
                        <i className="fa fa-dollar me-2"></i>Currency:
                      </label>
                      <SearchableSelect
                        options={[
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
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="addaccount_id">
                        <i className="fa fa-paypal me-2"></i>Account:
                      </label>
                      <SearchableSelect
                        options={[
                          { value: '-1', label: '--Account--' },
                          ...(dropdowns?.accounts?.map(a => ({
                            value: String(a.account_ID),
                            label: a.account_Name
                          })) || [])
                        ]}
                        value={formData.account_id ? String(formData.account_id) : '-1'}
                        onChange={(value) => setFormData({ ...formData, account_id: value === '-1' ? undefined : Number(value) })}
                        placeholder="Select Account"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="remarks">
                        <i className="fa fa-info me-2"></i>Remarks:
                      </label>
                      <textarea
                        id="remarks"
                        name="remarks"
                        className="form-control"
                        placeholder="Enter Remarks (Optional)"
                        rows={3}
                        value={formData.expense_remark || ''}
                        onChange={(e) => setFormData({ ...formData, expense_remark: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="expense_document">
                        <i className="fa fa-file-o me-2"></i>Expense document:
                      </label>
                      <input
                        type="file"
                        id="expense_document"
                        name="expense_document"
                        className="form-control"
                        onChange={handleFileChange}
                        accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.ppt,.zip"
                        required
                      />
                      {expenseDocument && (
                        <small className="text-muted">
                          Selected: {expenseDocument.name} ({(expenseDocument.size / 1024).toFixed(2)} KB)
                        </small>
                      )}
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-success"
                      disabled={createExpenseMutation.isPending}
                    >
                      {createExpenseMutation.isPending ? (
                        <>
                          <i className="fa fa-spinner fa-spin me-2"></i>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="fa fa-fw fa-save me-2"></i>
                          Save Record
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        
        {/* View Expenses Tab */}
        {activeTab === 'view-expenses' && (
          <div className="tab-pane active">
            <div className="panel">
              <div className="panel-header">
                <h3><i className="fa fa-search me-2"></i>Search & Filter</h3>
              </div>
              <div className="panel-body">
                <form id="searchForm" onSubmit={(e) => { e.preventDefault(); handleSearchExpenses(); }}>
                  <div className="search-form-row">
                    <div className="search-form-group">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="dateSearch"
                          checked={dateSearchEnabled}
                          onChange={(e) => setDateSearchEnabled(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="dateSearch">
                          Search By Date
                        </label>
                      </div>
                    </div>
                    <div className="search-form-group">
                      <label htmlFor="fromdate" className="form-label">From Date</label>
                      <input
                        type="date"
                        className="form-control"
                        id="fromdate"
                        value={searchFilters.from_date || ''}
                        onChange={(e) => setSearchFilters({ ...searchFilters, from_date: e.target.value })}
                        disabled={!dateSearchEnabled}
                      />
                    </div>
                    <div className="search-form-group">
                      <label htmlFor="todate" className="form-label">To Date</label>
                      <input
                        type="date"
                        className="form-control"
                        id="todate"
                        value={searchFilters.to_date || ''}
                        onChange={(e) => setSearchFilters({ ...searchFilters, to_date: e.target.value })}
                        disabled={!dateSearchEnabled}
                      />
                    </div>
                    <div className="search-form-group">
                      <label htmlFor="employee_id" className="form-label">Employee</label>
                      <SearchableSelect
                        options={[
                          { value: '', label: '--All Employees--' },
                          ...(employees.map(e => ({
                            value: String(e.staff_id),
                            label: e.staff_name
                          })))
                        ]}
                        value={searchFilters.employee_id ? String(searchFilters.employee_id) : ''}
                        onChange={(value) => setSearchFilters({ ...searchFilters, employee_id: value ? Number(value) : undefined })}
                        placeholder="Select Employee"
                      />
                    </div>
                    <div className="search-form-group search-button-group">
                      <button type="submit" className="btn btn-primary w-100">
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
                <h3><i className="fa fa-list me-2"></i>Expense Records</h3>
              </div>
              <div className="panel-body">
                <div className="table-responsive">
                  <table className="table table-striped table-bordered">
                    <thead>
                      <tr>
                        <th>S#</th>
                        <th>Expense Type</th>
                        <th>Amount</th>
                        <th>Account</th>
                        <th>Date</th>
                        <th>Remarks</th>
                        <th>Employee</th>
                        <th>Document</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center">
                            Use the search filters above to view expense records
                          </td>
                        </tr>
                      ) : (
                        expenses.map((expense, index) => (
                          <tr key={expense.expense_id}>
                            <td>{index + 1}</td>
                            <td>{expense.expense_type}</td>
                            <td>{parseFloat(expense.expense_amount).toLocaleString()} {expense.currencyName}</td>
                            <td>{expense.account_Name}</td>
                            <td>{new Date(expense.time_creation).toLocaleDateString()}</td>
                            <td>{expense.expense_remark}</td>
                            <td>{expense.staff_name}</td>
                            <td>
                              {expense.expense_document ? (
                                <a
                                  href={`/${expense.expense_document}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-sm btn-info"
                                >
                                  <i className="fa fa-file"></i> View
                                </a>
                              ) : (
                                <span className="text-muted">No document</span>
                              )}
                            </td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-sm btn-warning me-2"
                                  onClick={() => handleEditExpense(expense)}
                                >
                                  <i className="fa fa-edit"></i>
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteExpense(expense.expense_id)}
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
          </div>
        )}
      </div>
      
      {/* Add Expense Type Modal */}
      {showAddExpenseTypeModal && (
        <div className="modal-overlay" onClick={() => setShowAddExpenseTypeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa fa-plus me-2"></i>Add Expense Type</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => {
                  setShowAddExpenseTypeModal(false);
                  setExpenseTypeFormData({ expense_type: '' });
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!expenseTypeFormData.expense_type.trim()) {
                  Swal.fire({
                    icon: 'error',
                    title: 'Error!',
                    text: 'Expense type name is required'
                  });
                  return;
                }
                createExpenseTypeMutation.mutate(expenseTypeFormData.expense_type);
              }}>
                <div className="form-group">
                  <label htmlFor="expense_type_name" className="form-label">Expense Type Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    id="expense_type_name"
                    value={expenseTypeFormData.expense_type}
                    onChange={(e) => setExpenseTypeFormData({ expense_type: e.target.value })}
                    placeholder="Enter expense type name"
                    required
                    autoFocus
                  />
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowAddExpenseTypeModal(false);
                      setExpenseTypeFormData({ expense_type: '' });
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={createExpenseTypeMutation.isPending}
                  >
                    {createExpenseTypeMutation.isPending ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-2"></i>
                        Saving...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-save me-2"></i>Save
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Update Expense Type Modal */}
      {showUpdateExpenseTypeModal && editingExpenseType && (
        <div className="modal-overlay" onClick={() => {
          setShowUpdateExpenseTypeModal(false);
          setEditingExpenseType(null);
          setExpenseTypeFormData({ expense_type: '' });
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa fa-edit me-2"></i>Update Expense Type</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => {
                  setShowUpdateExpenseTypeModal(false);
                  setEditingExpenseType(null);
                  setExpenseTypeFormData({ expense_type: '' });
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdateExpenseType}>
                <div className="form-group">
                  <label htmlFor="update_expense_type_name" className="form-label">Expense Type Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    id="update_expense_type_name"
                    value={expenseTypeFormData.expense_type}
                    onChange={(e) => setExpenseTypeFormData({ expense_type: e.target.value })}
                    placeholder="Enter expense type name"
                    required
                    autoFocus
                  />
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowUpdateExpenseTypeModal(false);
                      setEditingExpenseType(null);
                      setExpenseTypeFormData({ expense_type: '' });
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-success"
                    disabled={updateExpenseTypeMutation.isPending}
                  >
                    {updateExpenseTypeMutation.isPending ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-2"></i>
                        Updating...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-save me-2"></i>Update
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Update Expense Modal */}
      {showUpdateExpenseModal && editingExpense && (
        <div className="modal-overlay" onClick={() => {
          setShowUpdateExpenseModal(false);
          setEditingExpense(null);
        }}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title"><i className="fa fa-edit me-2"></i>Update Expense</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => {
                  setShowUpdateExpenseModal(false);
                  setEditingExpense(null);
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdateExpense}>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="update_expense_type" className="form-label">Expense Type *</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Expense Type--' },
                        ...(expenseTypes.map(et => ({
                          value: String(et.expense_type_id),
                          label: et.expense_type
                        })))
                      ]}
                      value={editingExpense.expense_type_id ? String(editingExpense.expense_type_id) : ''}
                      onChange={(value) => setEditingExpense({ ...editingExpense, expense_type_id: value ? Number(value) : undefined } as any)}
                      placeholder="Select Expense Type"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="update_amount" className="form-label">Amount *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      id="update_amount"
                      value={editingExpense.expense_amount}
                      onChange={(e) => setEditingExpense({ ...editingExpense, expense_amount: e.target.value } as any)}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="update_currency_type" className="form-label">Currency *</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Currency--' },
                        ...(dropdowns?.currencies?.map(c => ({
                          value: String(c.currencyID),
                          label: c.currencyName
                        })) || [])
                      ]}
                      value={editingExpense.CurrencyID ? String(editingExpense.CurrencyID) : ''}
                      onChange={(value) => setEditingExpense({ ...editingExpense, CurrencyID: value ? Number(value) : undefined } as any)}
                      placeholder="Select Currency"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="update_account_id" className="form-label">Account *</label>
                    <SearchableSelect
                      options={[
                        { value: '', label: '--Select Account--' },
                        ...(dropdowns?.accounts?.map(a => ({
                          value: String(a.account_ID),
                          label: a.account_Name
                        })) || [])
                      ]}
                      value={editingExpense.accountID ? String(editingExpense.accountID) : ''}
                      onChange={(value) => setEditingExpense({ ...editingExpense, accountID: value ? Number(value) : undefined } as any)}
                      placeholder="Select Account"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="update_remarks" className="form-label">Remarks *</label>
                  <textarea
                    className="form-control"
                    id="update_remarks"
                    rows={3}
                    value={editingExpense.expense_remark}
                    onChange={(e) => setEditingExpense({ ...editingExpense, expense_remark: e.target.value } as any)}
                    required
                  />
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setShowUpdateExpenseModal(false);
                      setEditingExpense(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-success"
                    disabled={updateExpenseMutation.isPending}
                  >
                    {updateExpenseMutation.isPending ? (
                      <>
                        <i className="fa fa-spinner fa-spin me-2"></i>
                        Updating...
                      </>
                    ) : (
                      <>
                        <i className="fa fa-save me-2"></i>Update
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
