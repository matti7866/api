import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import salaryService from '../../services/salaryService';
import { accountsService } from '../../services/accountsService';
import type {
  Salary,
  Employee,
  EmployeeSalarySummary,
  SalaryFilters,
  CreateSalaryRequest,
  UpdateSalaryRequest,
  SalaryAdjustmentRequest,
  PaymentSchedule,
  SalaryHistory,
  PrintReportData
} from '../../types/salary';
import type { Account } from '../../types/accounts';
import './Salary.css';

export default function Salary() {
  const queryClient = useQueryClient();

  // State
  const [monthYearSearch, setMonthYearSearch] = useState(false);
  const [searchMonth, setSearchMonth] = useState('');
  const [searchYear, setSearchYear] = useState('');
  const [searchemployeeId, setSearchemployeeId] = useState<string>('-1');
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [employeeSummary, setEmployeeSummary] = useState<EmployeeSalarySummary[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalSalary: 0,
    employeesPaid: 0,
    pendingPayments: 0,
    averageSalary: 0
  });

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Form states
  const [addFormData, setAddFormData] = useState<CreateSalaryRequest>({
    Addemployee_ID: 0,
    Salary_Amount: '',
    Addaccount_ID: 0
  });

  const [editFormData, setEditFormData] = useState<UpdateSalaryRequest>({
    SalaryID: 0,
    Updemployee_id: 0,
    Updsalary_Amount: '',
    Updaccount_ID: 0
  });

  const [adjustmentFormData, setAdjustmentFormData] = useState<SalaryAdjustmentRequest>({
    EmployeeId: 0,
    EffectiveDate: new Date().toISOString().split('T')[0],
    AdjustmentType: 'increase',
    CurrentSalary: '',
    NewSalary: '',
    Reason: ''
  });

  const [adjustmentMethod, setAdjustmentMethod] = useState<'amount' | 'percentage'>('amount');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentPercentage, setAdjustmentPercentage] = useState('');
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [scheduleUpdates, setScheduleUpdates] = useState<Record<number, number>>({});

  // Fetch employees
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['salary-employees'],
    queryFn: () => salaryService.getEmployees(),
    staleTime: 300000
  });

  // Fetch employees with salary for adjustment modal
  const { data: employeesWithSalary = [] } = useQuery<Employee[]>({
    queryKey: ['salary-employees-with-salary'],
    queryFn: () => salaryService.getEmployeesWithSalary(),
    staleTime: 300000
  });

  // Fetch accounts
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ['salary-accounts'],
    queryFn: () => accountsService.getAccounts(),
    staleTime: 300000
  });

  // Initialize current month/year
  useEffect(() => {
    const now = new Date();
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear = now.getFullYear().toString();
    setSearchMonth(currentMonth);
    setSearchYear(currentYear);
    
    // Load initial summary
    loadEmployeeSalarySummary(currentMonth, currentYear);
  }, []);

  // Load employee salary summary
  const loadEmployeeSalarySummary = async (month?: string, year?: string) => {
    try {
      const monthToUse = month || searchMonth;
      const yearToUse = year || searchYear;
      
      if (!monthToUse || !yearToUse) return;
      
      const summary = await salaryService.getEmployeeSalarySummary(monthToUse, yearToUse);
      setEmployeeSummary(summary);
      
      // Calculate stats
      const total = summary.reduce((sum, emp) => sum + parseFloat(emp.monthly_salary_due.toString()), 0);
      const paid = summary.filter(emp => emp.payment_status === 'paid').length;
      const pending = summary.filter(emp => emp.payment_status === 'pending').length;
      const average = summary.length > 0 ? total / summary.length : 0;
      
      setSummaryStats({
        totalSalary: total,
        employeesPaid: paid,
        pendingPayments: pending,
        averageSalary: average
      });
    } catch (error) {
      console.error('Error loading salary summary:', error);
    }
  };

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: (filters: SalaryFilters) => salaryService.getSalaryReport(filters),
    onSuccess: (data) => {
      setSalaries(Array.isArray(data) ? data : []);
      if (monthYearSearch && searchMonth && searchYear) {
        loadEmployeeSalarySummary(searchMonth, searchYear);
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to fetch salary report', 'error');
    }
  });

  // Add mutation
  const addMutation = useMutation({
    mutationFn: (data: CreateSalaryRequest) => salaryService.addSalary(data),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Salary added successfully', 'success');
        setShowAddModal(false);
        resetAddForm();
        handleSearch();
        loadEmployeeSalarySummary();
      } else {
        Swal.fire('Error', response, 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to add salary', 'error');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateSalaryRequest) => salaryService.updateSalary(data),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Salary updated successfully', 'success');
        setShowEditModal(false);
        resetEditForm();
        handleSearch();
        loadEmployeeSalarySummary();
      } else {
        Swal.fire('Error', response, 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to update salary', 'error');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => salaryService.deleteSalary(id),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Salary deleted successfully', 'success');
        handleSearch();
        loadEmployeeSalarySummary();
      } else {
        Swal.fire('Error', response, 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to delete salary', 'error');
    }
  });

  // Adjustment mutation
  const adjustmentMutation = useMutation({
    mutationFn: (data: SalaryAdjustmentRequest) => salaryService.saveSalaryAdjustment(data),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Salary adjustment saved successfully', 'success');
        setShowAdjustmentModal(false);
        resetAdjustmentForm();
        queryClient.invalidateQueries({ queryKey: ['salary-employees-with-salary'] });
        loadEmployeeSalarySummary();
      } else {
        Swal.fire('Error', response, 'error');
      }
    },
    onError: (error: any) => {
      Swal.fire('Error', error.response?.data?.message || 'Failed to save adjustment', 'error');
    }
  });

  // Schedule mutations
  const scheduleLoadMutation = useMutation({
    mutationFn: () => salaryService.getPaymentSchedules(),
    onSuccess: (data) => {
      setSchedules(data);
    }
  });

  const scheduleUpdateMutation = useMutation({
    mutationFn: ({ employeeId, paymentDay }: { employeeId: number; paymentDay: number }) =>
      salaryService.updatePaymentSchedule(employeeId, paymentDay),
    onSuccess: (response) => {
      if (response === 'Success' || response.trim() === 'Success') {
        Swal.fire('Success', 'Payment schedule updated successfully', 'success');
        scheduleLoadMutation.mutate();
        loadEmployeeSalarySummary();
      } else {
        Swal.fire('Error', response, 'error');
      }
    }
  });

  // History mutation
  const historyMutation = useMutation({
    mutationFn: () => salaryService.getSalaryHistory(),
    onSuccess: (data) => {
      // History will be displayed in modal
    }
  });

  // Print mutation
  const printMutation = useMutation({
    mutationFn: ({ month, year }: { month: string; year: string }) =>
      salaryService.getPrintReport(month, year),
    onSuccess: (data) => {
      generatePrintReport(data);
    }
  });

  // Handlers
  const handleSearch = () => {
    let searchTerm: SalaryFilters['searchTerm'];
    
    if (monthYearSearch && searchemployeeId !== '-1') {
      searchTerm = 'MonthYearAndEmpWise';
    } else if (monthYearSearch && searchemployeeId === '-1') {
      searchTerm = 'MonthYearWise';
    } else if (!monthYearSearch && searchemployeeId !== '-1') {
      searchTerm = 'EmpWise';
    } else {
      Swal.fire('Validation Error', 'You have to select one option at least to perform search', 'error');
      return;
    }

    if (monthYearSearch && (!searchMonth || !searchYear)) {
      Swal.fire('Validation Error', 'Please select both month and year when searching by month', 'error');
      return;
    }

    searchMutation.mutate({
      searchTerm,
      searchemployee_id: searchemployeeId,
      searchMonth: monthYearSearch ? searchMonth : undefined,
      searchYear: monthYearSearch ? searchYear : undefined
    });
  };

  const handleAdd = () => {
    if (!addFormData.Addemployee_ID || addFormData.Addemployee_ID === 0) {
      Swal.fire('Validation Error', 'Employee name is required', 'error');
      return;
    }
    if (!addFormData.Salary_Amount) {
      Swal.fire('Validation Error', 'Salary amount is required', 'error');
      return;
    }
    if (!addFormData.Addaccount_ID || addFormData.Addaccount_ID === 0) {
      Swal.fire('Validation Error', 'Account is required', 'error');
      return;
    }
    addMutation.mutate(addFormData);
  };

  const handleUpdate = () => {
    if (!editFormData.Updemployee_id || editFormData.Updemployee_id === 0) {
      Swal.fire('Validation Error', 'Employee name is required', 'error');
      return;
    }
    if (!editFormData.Updsalary_Amount) {
      Swal.fire('Validation Error', 'Salary amount is required', 'error');
      return;
    }
    if (!editFormData.Updaccount_ID || editFormData.Updaccount_ID === 0) {
      Swal.fire('Validation Error', 'Account is required', 'error');
      return;
    }
    updateMutation.mutate(editFormData);
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: 'Delete!',
      text: 'Do you want to delete this salary?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteMutation.mutate(id);
      }
    });
  };

  const handleEdit = async (id: number) => {
    try {
      const data = await salaryService.getSalaryForUpdate(id);
      if (data && data.length > 0) {
        setEditFormData({
          SalaryID: id,
          Updemployee_id: data[0].employee_id || 0,
          Updsalary_Amount: data[0].salary_amount.toString(),
          Updaccount_ID: data[0].paymentType || 0
        });
        setShowEditModal(true);
      }
    } catch (error) {
      Swal.fire('Error', 'Failed to load salary data', 'error');
    }
  };

  const handleAdjustmentEmployeeChange = (employeeId: string) => {
    const employee = employeesWithSalary.find(emp => emp.staff_id.toString() === employeeId);
    if (employee) {
      const currentSalary = employee.current_salary || employee.salary || 0;
      setAdjustmentFormData(prev => ({
        ...prev,
        EmployeeId: parseInt(employeeId),
        CurrentSalary: currentSalary.toString()
      }));
      calculateNewSalary(currentSalary.toString());
    }
  };

  const calculateNewSalary = (currentSalaryStr?: string) => {
    const currentSalary = parseFloat(currentSalaryStr || adjustmentFormData.CurrentSalary) || 0;
    const type = adjustmentFormData.AdjustmentType;
    let newSalary = currentSalary;

    if (adjustmentMethod === 'amount') {
      const amount = parseFloat(adjustmentAmount) || 0;
      if (type === 'increase') {
        newSalary = currentSalary + amount;
      } else {
        newSalary = currentSalary - amount;
      }
    } else {
      const percentage = parseFloat(adjustmentPercentage) || 0;
      const changeAmount = (currentSalary * percentage) / 100;
      if (type === 'increase') {
        newSalary = currentSalary + changeAmount;
      } else {
        newSalary = currentSalary - changeAmount;
      }
    }

    setAdjustmentFormData(prev => ({
      ...prev,
      NewSalary: newSalary.toFixed(2)
    }));
  };

  const handleSaveAdjustment = () => {
    if (!adjustmentFormData.EmployeeId) {
      Swal.fire('Validation Error', 'Please select an employee', 'error');
      return;
    }
    if (!adjustmentFormData.EffectiveDate) {
      Swal.fire('Validation Error', 'Please select effective date', 'error');
      return;
    }
    if (parseFloat(adjustmentFormData.NewSalary) < 0) {
      Swal.fire('Validation Error', 'New salary cannot be negative', 'error');
      return;
    }
    adjustmentMutation.mutate(adjustmentFormData);
  };

  const handleOpenScheduleModal = () => {
    setShowScheduleModal(true);
    scheduleLoadMutation.mutate();
  };

  const handleUpdateSchedule = (employeeId: number, newDay: number) => {
    scheduleUpdateMutation.mutate({ employeeId, paymentDay: newDay });
  };

  const handleShowHistory = () => {
    setShowHistoryModal(true);
    historyMutation.mutate();
  };

  const handlePrintReport = () => {
    if (!searchMonth || !searchYear) {
      Swal.fire('Info', 'Please select month and year first', 'info');
      return;
    }
    printMutation.mutate({ month: searchMonth, year: searchYear });
  };

  const generatePrintReport = (data: PrintReportData) => {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(searchMonth) - 1];

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Salary Report - ${monthName} ${searchYear}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
          .report-title { font-size: 18px; margin-bottom: 5px; }
          .report-period { font-size: 14px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .summary { margin-top: 30px; }
          .summary-item { margin-bottom: 10px; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">SN Travels</div>
          <div class="report-title">Monthly Salary Report</div>
          <div class="report-period">${monthName} ${searchYear}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>S#</th>
              <th>Employee Name</th>
              <th>Monthly Salary</th>
              <th>Amount Paid</th>
              <th>Payment Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    let totalSalary = 0;
    let totalPaid = 0;

    data.employees.forEach((emp, index) => {
      totalSalary += parseFloat(emp.monthly_salary.toString());
      totalPaid += parseFloat(emp.amount_paid.toString());
      reportHtml += `
        <tr>
          <td>${index + 1}</td>
          <td>${emp.staff_name}</td>
          <td class="text-right">${formatNumber(emp.monthly_salary)}</td>
          <td class="text-right">${formatNumber(emp.amount_paid)}</td>
          <td>${emp.payment_date || 'Not Paid'}</td>
          <td>${emp.status}</td>
        </tr>
      `;
    });

    reportHtml += `
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="2">TOTAL</td>
              <td class="text-right">${formatNumber(totalSalary)}</td>
              <td class="text-right">${formatNumber(totalPaid)}</td>
              <td colspan="2">Remaining: ${formatNumber(totalSalary - totalPaid)}</td>
            </tr>
          </tfoot>
        </table>
        <div class="summary">
          <h3>Summary</h3>
          <div class="summary-item">Total Employees: ${data.summary.total_employees}</div>
          <div class="summary-item">Employees Paid: ${data.summary.paid_count}</div>
          <div class="summary-item">Employees Pending: ${data.summary.pending_count}</div>
          <div class="summary-item">Total Salary Obligation: ${formatNumber(totalSalary)} AED</div>
          <div class="summary-item">Total Amount Paid: ${formatNumber(totalPaid)} AED</div>
          <div class="summary-item">Remaining to Pay: ${formatNumber(totalSalary - totalPaid)} AED</div>
        </div>
        <button onclick="window.print()" class="no-print" style="margin-top: 20px; padding: 10px 20px;">Print Report</button>
      </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getOrdinalSuffix = (day: number): string => {
    if (day >= 11 && day <= 13) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  const isPaymentOverdue = (salaryDay: number, lastSalaryDate: string | null): boolean => {
    if (!lastSalaryDate) return true;
    const today = new Date();
    const currentDay = today.getDate();
    if (currentDay > salaryDay) {
      const lastPayment = new Date(lastSalaryDate);
      const isThisMonth = lastPayment.getMonth() === today.getMonth() &&
        lastPayment.getFullYear() === today.getFullYear();
      return !isThisMonth;
    }
    return false;
  };

  const viewEmployeeSalaryHistory = (staffId: number) => {
    setSearchemployeeId(staffId.toString());
    setMonthYearSearch(false);
    setTimeout(() => {
      handleSearch();
    }, 500);
  };

  const addSalaryForEmployee = (staffId: number) => {
    setAddFormData(prev => ({ ...prev, Addemployee_ID: staffId }));
    setShowAddModal(true);
  };

  // Reset forms
  const resetAddForm = () => {
    setAddFormData({
      Addemployee_ID: 0,
      Salary_Amount: '',
      Addaccount_ID: 0
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      SalaryID: 0,
      Updemployee_id: 0,
      Updsalary_Amount: '',
      Updaccount_ID: 0
    });
  };

  const resetAdjustmentForm = () => {
    setAdjustmentFormData({
      EmployeeId: 0,
      EffectiveDate: new Date().toISOString().split('T')[0],
      AdjustmentType: 'increase',
      CurrentSalary: '',
      NewSalary: '',
      Reason: ''
    });
    setAdjustmentAmount('');
    setAdjustmentPercentage('');
    setAdjustmentMethod('amount');
  };

  // Generate year options
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const years = [];
  for (let year = 2020; year <= currentYear + 2; year++) {
    years.push(year);
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const currentMonthIndex = parseInt(searchMonth) - 1;
  const currentMonthName = currentMonthIndex >= 0 ? monthNames[currentMonthIndex] : '';
  const currentShortMonth = currentMonthIndex >= 0 ? shortMonths[currentMonthIndex] : '';

  // Calculate total from salaries
  const totalSalaryAmount = salaries.reduce((sum, salary) => sum + parseFloat(salary.salary_amount.toString()), 0);

  return (
    <div className="salary-container">
      <div className="card">
        <div className="card-header-custom">
          <h2>
            <i className="fa fa-fw fa-dollar"></i> Add Salary Report
          </h2>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-1" style={{ marginTop: '40px' }}>
              <input
                className="form-check-input"
                type="checkbox"
                id="monthYearSearch"
                checked={monthYearSearch}
                onChange={(e) => setMonthYearSearch(e.target.checked)}
              />
              <label className="form-check-label" htmlFor="monthYearSearch">Search By Month</label>
            </div>

            <div className="col-md-2">
              <label className="col-form-label">Month:</label>
              <select
                className="form-control"
                value={searchMonth}
                onChange={(e) => {
                  setSearchMonth(e.target.value);
                  if (e.target.value && searchYear) {
                    loadEmployeeSalarySummary(e.target.value, searchYear);
                  }
                }}
              >
                <option value="">Select Month</option>
                {monthNames.map((month, index) => (
                  <option key={index} value={(index + 1).toString().padStart(2, '0')}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="col-form-label">Year:</label>
              <select
                className="form-control"
                value={searchYear}
                onChange={(e) => {
                  setSearchYear(e.target.value);
                  if (searchMonth && e.target.value) {
                    loadEmployeeSalarySummary(searchMonth, e.target.value);
                  }
                }}
              >
                <option value="">Select Year</option>
                {years.map(year => (
                  <option key={year} value={year.toString()}>{year}</option>
                ))}
              </select>
            </div>

            <div className="col-md-3">
              <label className="col-form-label">Employee Name:</label>
              <select
                className="form-control"
                value={searchemployeeId}
                onChange={(e) => setSearchemployeeId(e.target.value)}
              >
                <option value="-1">-- Select Employee --</option>
                {employees.map(emp => (
                  <option key={emp.staff_id} value={emp.staff_id.toString()}>
                    {emp.staff_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-2">
              <label className="col-form-label">Action:</label>
              <button
                type="button"
                onClick={handleSearch}
                className="btn btn-dark btn-block text-white"
                style={{ width: '100%' }}
              >
                <i className="fa fa-fw fa-search"></i> Search
              </button>
            </div>

            <div className="col-md-1" style={{ marginTop: '35px' }}>
              <button
                type="button"
                className="btn custom-btn"
                style={{ width: '100%' }}
                onClick={() => setShowAddModal(true)}
              >
                <i className="fa fa-plus"></i> Add salary
              </button>
            </div>

            <div className="col-md-1" style={{ marginTop: '35px' }}>
              <button
                type="button"
                className="btn btn-warning"
                style={{ width: '100%' }}
                onClick={() => setShowAdjustmentModal(true)}
              >
                <i className="fa fa-edit"></i> Adjust Salary
              </button>
            </div>
          </div>
        </div>

        <br />

        {/* Salary Management Actions */}
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-light">
                <h5 className="mb-0"><i className="fa fa-cogs me-2"></i>Salary Management Actions</h5>
              </div>
              <div className="card-body">
                <div className="row">
                  <div className="col-md-3">
                    <button
                      className="btn btn-success btn-lg w-100"
                      onClick={() => setShowAdjustmentModal(true)}
                    >
                      <i className="fa fa-trending-up"></i><br />
                      <span>Adjust Salaries</span><br />
                      <small>Increase/Decrease</small>
                    </button>
                  </div>
                  <div className="col-md-3">
                    <button
                      className="btn btn-info btn-lg w-100"
                      onClick={handleOpenScheduleModal}
                    >
                      <i className="fa fa-calendar"></i><br />
                      <span>Payment Schedule</span><br />
                      <small>Set Pay Dates</small>
                    </button>
                  </div>
                  <div className="col-md-3">
                    <button
                      className="btn btn-purple btn-lg w-100"
                      onClick={handleShowHistory}
                    >
                      <i className="fa fa-history"></i><br />
                      <span>Salary History</span><br />
                      <small>View Changes</small>
                    </button>
                  </div>
                  <div className="col-md-3">
                    <button
                      className="btn btn-primary btn-lg w-100"
                      onClick={handlePrintReport}
                    >
                      <i className="fa fa-print"></i><br />
                      <span>Print Report</span><br />
                      <small>Monthly Report</small>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="row mb-4">
          <div className="col-md-6">
            <div className="card border-0 shadow-lg bg-gradient-primary text-white">
              <div className="card-body text-center py-4">
                <div className="mb-3">
                  <i className="fa fa-money fa-3x opacity-75"></i>
                </div>
                <h2 className="mb-2">{formatNumber(summaryStats.totalSalary)}</h2>
                <h5 className="mb-1">Total Salary Expenses</h5>
                <p className="mb-0 opacity-75">All employees for {currentMonthName} {searchYear}</p>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="row">
              <div className="col-md-6 mb-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <div className="text-success mb-2">
                      <i className="fa fa-users fa-2x"></i>
                    </div>
                    <h4 className="mb-1">{summaryStats.employeesPaid}</h4>
                    <p className="text-muted mb-0">Employees Paid</p>
                    <small className="text-muted">in {currentMonthName} {searchYear}</small>
                  </div>
                </div>
              </div>
              <div className="col-md-6 mb-3">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <div className="text-warning mb-2">
                      <i className="fa fa-exclamation-triangle fa-2x"></i>
                    </div>
                    <h4 className="mb-1">{summaryStats.pendingPayments}</h4>
                    <p className="text-muted mb-0">Not Paid</p>
                    <small className="text-muted">in {currentMonthName} {searchYear}</small>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <div className="text-info mb-2">
                      <i className="fa fa-calendar fa-2x"></i>
                    </div>
                    <h4 className="mb-1">{currentShortMonth}</h4>
                    <p className="text-muted mb-0">Selected Period</p>
                    <small className="text-muted">{searchYear}</small>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center">
                    <div className="text-secondary mb-2">
                      <i className="fa fa-calculator fa-2x"></i>
                    </div>
                    <h4 className="mb-1">{formatNumber(summaryStats.averageSalary)}</h4>
                    <p className="text-muted mb-0">Average</p>
                    <small className="text-muted">per employee</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Salary Table */}
        <div className="row mb-4">
          <div className="col-md-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-bottom">
                <div className="row align-items-center">
                  <div className="col">
                    <h5 className="mb-0 text-dark"><i className="fa fa-table me-2"></i>Employee Salary Overview</h5>
                    <small className="text-muted">{currentMonthName} {searchYear} salary status with individual payment dates</small>
                  </div>
                  <div className="col-auto">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => loadEmployeeSalarySummary()}
                    >
                      <i className="fa fa-refresh"></i> Refresh
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead className="bg-light">
                      <tr>
                        <th className="border-0 ps-4">Employee</th>
                        <th className="border-0 text-center">Monthly Salary</th>
                        <th className="border-0 text-center">Paid in {currentMonthName} {searchYear}</th>
                        <th className="border-0 text-center">Salary Date</th>
                        <th className="border-0 text-center">Last Paid Date</th>
                        <th className="border-0 text-center">Status</th>
                        <th className="border-0 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employeeSummary.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-4 text-muted">No employee records found</td>
                        </tr>
                      ) : (
                        employeeSummary.map((emp) => {
                          const lastSalaryDate = emp.last_salary_date
                            ? new Date(emp.last_salary_date).toLocaleDateString('en-GB')
                            : 'Never';
                          const isOverdue = isPaymentOverdue(emp.payment_day, emp.last_salary_date);
                          const statusBadge =
                            emp.payment_status === 'paid' ? (
                              <span className="badge bg-success">Fully Paid</span>
                            ) : parseFloat(emp.current_month_paid.toString()) > 0 ? (
                              <span className="badge bg-warning">Partially Paid</span>
                            ) : (
                              <span className="badge bg-danger">Not Paid</span>
                            );

                          return (
                            <tr
                              key={emp.staff_id}
                              className={
                                emp.payment_status === 'paid'
                                  ? ''
                                  : parseFloat(emp.current_month_paid.toString()) > 0
                                  ? 'table-warning'
                                  : 'table-danger'
                              }
                            >
                              <td className="ps-4">
                                <div className="d-flex align-items-center">
                                  <div className="avatar-sm bg-light rounded-circle d-flex align-items-center justify-content-center me-3">
                                    <i className="fa fa-user text-muted"></i>
                                  </div>
                                  <div>
                                    <h6 className="mb-0">{emp.staff_name}</h6>
                                    <small className="text-muted">ID: {emp.staff_id}</small>
                                  </div>
                                </div>
                              </td>
                              <td className="text-center">
                                <div className="fw-bold">{formatNumber(parseFloat(emp.monthly_salary_due.toString()))}</div>
                                <small className="text-muted">AED due</small>
                              </td>
                              <td className="text-center">
                                <div className="fw-bold text-success">
                                  {formatNumber(parseFloat(emp.current_month_paid.toString()))}
                                </div>
                                <small className="text-muted">AED paid</small>
                              </td>
                              <td className="text-center">
                                <div className={`fw-bold ${isOverdue ? 'text-danger' : 'text-info'}`}>
                                  {emp.payment_day}
                                  {getOrdinalSuffix(emp.payment_day)}
                                </div>
                                <small className={`text-muted ${isOverdue ? 'text-danger' : ''}`}>
                                  {isOverdue ? 'Payment Due!' : 'of each month'}
                                </small>
                              </td>
                              <td className="text-center">
                                <div>{lastSalaryDate}</div>
                                {emp.days_since_last_salary !== null ? (
                                  <small className="text-muted">{emp.days_since_last_salary} days ago</small>
                                ) : (
                                  <small className="text-muted">-</small>
                                )}
                              </td>
                              <td className="text-center">{statusBadge}</td>
                              <td className="text-center">
                                <div className="btn-group btn-group-sm">
                                  <button
                                    className="btn btn-outline-primary"
                                    onClick={() => viewEmployeeSalaryHistory(emp.staff_id)}
                                    title="View History"
                                  >
                                    <i className="fa fa-history"></i>
                                  </button>
                                  <button
                                    className="btn btn-outline-success"
                                    onClick={() => addSalaryForEmployee(emp.staff_id)}
                                    title="Add Salary"
                                  >
                                    <i className="fa fa-plus"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Salary Records */}
        <div className="row">
          <div className="col-md-12">
            <div className="card">
              <div className="card-header bg-graident-lightcrimson text-white">
                <h4><i className="fa fa-list"></i> Detailed Salary Records</h4>
              </div>
              <div className="card-body">
                <div className="table-responsive">
                  <table className="table table-striped table-hover">
                    <thead className="text-white bg-graident-lightcrimson">
                      <tr className="text-center" style={{ fontSize: '14px' }}>
                        <th>S#</th>
                        <th>Employee Name</th>
                        <th>Date Time</th>
                        <th>Salary Paid</th>
                        <th>Account</th>
                        <th>Paid By</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center">Record Not Found</td>
                        </tr>
                      ) : (
                        <>
                          {salaries.map((salary, index) => (
                            <tr key={salary.salary_id}>
                              <th scope="row" className="text-center">{index + 1}</th>
                              <td className="text-capitalize text-center">{salary.paidToEmployee}</td>
                              <td className="text-center">{new Date(salary.datetime).toLocaleString()}</td>
                              <td className="text-center">{formatNumber(parseFloat(salary.salary_amount.toString()))}</td>
                              <td className="text-center">{salary.account_Name}</td>
                              <td className="text-capitalize text-center">{salary.paidbyEmployee}</td>
                              <td className="text-center">
                                <button
                                  type="button"
                                  onClick={() => handleEdit(salary.salary_id)}
                                  className="btn"
                                  title="Edit"
                                >
                                  <i className="fa fa-edit text-dark fa-2x"></i>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(salary.salary_id)}
                                  className="btn"
                                  title="Delete"
                                >
                                  <i className="fa fa-trash text-graident-lightcrimson fa-2x"></i>
                                </button>
                              </td>
                            </tr>
                          ))}
                          {totalSalaryAmount > 0 && (
                            <tr>
                              <td className="text-center"><b>Total</b></td>
                              <td></td>
                              <td></td>
                              <td className="text-center"><b>{formatNumber(totalSalaryAmount)}</b></td>
                              <td></td>
                              <td></td>
                              <td></td>
                            </tr>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <div className={`modal fade ${showAddModal ? 'show' : ''}`} style={{ display: showAddModal ? 'block' : 'none' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-dark">
              <h3 className="modal-title text-white"><b><i>Add Salary</i></b></h3>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="form-group row mb-2">
                <label className="col-sm-3 col-form-label">Employee Name:</label>
                <div className="col-sm-9">
                  <select
                    className="form-control"
                    value={addFormData.Addemployee_ID}
                    onChange={(e) => setAddFormData({ ...addFormData, Addemployee_ID: parseInt(e.target.value) })}
                  >
                    <option value="0">-- Select Employee --</option>
                    {employees.map(emp => (
                      <option key={emp.staff_id} value={emp.staff_id}>{emp.staff_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group row mb-2">
                <label className="col-sm-3 col-form-label">Salary Amount:</label>
                <div className="col-sm-9">
                  <input
                    type="text"
                    className="form-control"
                    value={addFormData.Salary_Amount}
                    onChange={(e) => setAddFormData({ ...addFormData, Salary_Amount: e.target.value })}
                    placeholder="Salary Amount"
                  />
                </div>
              </div>
              <div className="form-group row mb-2">
                <label className="col-sm-3 col-form-label">Account:</label>
                <div className="col-sm-9">
                  <select
                    className="form-control"
                    value={addFormData.Addaccount_ID}
                    onChange={(e) => setAddFormData({ ...addFormData, Addaccount_ID: parseInt(e.target.value) })}
                  >
                    <option value="0">-- Select Account --</option>
                    {accounts.map(acc => (
                      <option key={acc.account_ID} value={acc.account_ID}>{acc.account_Name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Close</button>
              <button type="button" onClick={handleAdd} className="btn text-white bg-graident-lightcrimson">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAddModal && <div className="modal-backdrop fade show" onClick={() => setShowAddModal(false)}></div>}

      {/* Edit Modal */}
      <div className={`modal fade ${showEditModal ? 'show' : ''}`} style={{ display: showEditModal ? 'block' : 'none' }}>
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header bg-dark">
              <h3 className="modal-title text-white"><b><i>Update Salary</i></b></h3>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="form-group row mb-2">
                <label className="col-sm-3 col-form-label">Employee Name:</label>
                <div className="col-sm-9">
                  <select
                    className="form-control"
                    value={editFormData.Updemployee_id}
                    onChange={(e) => setEditFormData({ ...editFormData, Updemployee_id: parseInt(e.target.value) })}
                  >
                    <option value="0">-- Select Employee --</option>
                    {employees.map(emp => (
                      <option key={emp.staff_id} value={emp.staff_id}>{emp.staff_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group row mb-2">
                <label className="col-sm-3 col-form-label">Salary Amount:</label>
                <div className="col-sm-9">
                  <input
                    type="text"
                    className="form-control"
                    value={editFormData.Updsalary_Amount}
                    onChange={(e) => setEditFormData({ ...editFormData, Updsalary_Amount: e.target.value })}
                    placeholder="Salary Amount"
                  />
                </div>
              </div>
              <div className="form-group row mb-2">
                <label className="col-sm-3 col-form-label">Account:</label>
                <div className="col-sm-9">
                  <select
                    className="form-control"
                    value={editFormData.Updaccount_ID}
                    onChange={(e) => setEditFormData({ ...editFormData, Updaccount_ID: parseInt(e.target.value) })}
                  >
                    <option value="0">-- Select Account --</option>
                    {accounts.map(acc => (
                      <option key={acc.account_ID} value={acc.account_ID}>{acc.account_Name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Close</button>
              <button type="button" onClick={handleUpdate} className="btn text-white bg-danger">
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      {showEditModal && <div className="modal-backdrop fade show" onClick={() => setShowEditModal(false)}></div>}

      {/* Salary Adjustment Modal */}
      <div className={`modal fade ${showAdjustmentModal ? 'show' : ''}`} style={{ display: showAdjustmentModal ? 'block' : 'none' }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-success text-white">
              <h3 className="modal-title"><b><i className="fa fa-trending-up"></i> Salary Adjustment</b></h3>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowAdjustmentModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Employee:</label>
                    <select
                      className="form-control"
                      value={adjustmentFormData.EmployeeId}
                      onChange={(e) => handleAdjustmentEmployeeChange(e.target.value)}
                      required
                    >
                      <option value="0">-- Select Employee --</option>
                      {employeesWithSalary.map(emp => (
                        <option key={emp.staff_id} value={emp.staff_id.toString()}>
                          {emp.staff_name} (Current: {formatNumber(emp.current_salary || emp.salary || 0)} AED)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="form-group mb-3">
                    <label className="form-label">Effective Date:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={adjustmentFormData.EffectiveDate}
                      onChange={(e) => setAdjustmentFormData({ ...adjustmentFormData, EffectiveDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-md-4">
                  <div className="form-group mb-3">
                    <label className="form-label">Current Salary:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={adjustmentFormData.CurrentSalary}
                      readOnly
                    />
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group mb-3">
                    <label className="form-label">Adjustment Type:</label>
                    <select
                      className="form-control"
                      value={adjustmentFormData.AdjustmentType}
                      onChange={(e) => {
                        setAdjustmentFormData({
                          ...adjustmentFormData,
                          AdjustmentType: e.target.value as 'increase' | 'decrease'
                        });
                        calculateNewSalary();
                      }}
                      required
                    >
                      <option value="increase">Increase</option>
                      <option value="decrease">Decrease</option>
                    </select>
                  </div>
                </div>
                <div className="col-md-4">
                  <div className="form-group mb-3">
                    <label className="form-label">Method:</label>
                    <select
                      className="form-control"
                      value={adjustmentMethod}
                      onChange={(e) => {
                        setAdjustmentMethod(e.target.value as 'amount' | 'percentage');
                        calculateNewSalary();
                      }}
                    >
                      <option value="amount">Fixed Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="row">
                {adjustmentMethod === 'amount' ? (
                  <div className="col-md-4">
                    <div className="form-group mb-3">
                      <label className="form-label">Amount:</label>
                      <input
                        type="number"
                        className="form-control"
                        value={adjustmentAmount}
                        onChange={(e) => {
                          setAdjustmentAmount(e.target.value);
                          calculateNewSalary();
                        }}
                        step="0.01"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="col-md-4">
                    <div className="form-group mb-3">
                      <label className="form-label">Percentage (%):</label>
                      <input
                        type="number"
                        className="form-control"
                        value={adjustmentPercentage}
                        onChange={(e) => {
                          setAdjustmentPercentage(e.target.value);
                          calculateNewSalary();
                        }}
                        step="0.01"
                      />
                    </div>
                  </div>
                )}
                <div className="col-md-4">
                  <div className="form-group mb-3">
                    <label className="form-label">New Salary:</label>
                    <input
                      type="text"
                      className="form-control"
                      value={adjustmentFormData.NewSalary}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              <div className="form-group mb-3">
                <label className="form-label">Reason for Adjustment:</label>
                <textarea
                  className="form-control"
                  value={adjustmentFormData.Reason}
                  onChange={(e) => setAdjustmentFormData({ ...adjustmentFormData, Reason: e.target.value })}
                  rows={3}
                  placeholder="Enter reason for salary adjustment..."
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustmentModal(false)}>Cancel</button>
              <button type="button" onClick={handleSaveAdjustment} className="btn btn-success">
                <i className="fa fa-save"></i> Save Adjustment
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAdjustmentModal && <div className="modal-backdrop fade show" onClick={() => setShowAdjustmentModal(false)}></div>}

      {/* Payment Schedule Modal */}
      <div className={`modal fade ${showScheduleModal ? 'show' : ''}`} style={{ display: showScheduleModal ? 'block' : 'none' }}>
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header bg-info text-white">
              <h3 className="modal-title"><b><i className="fa fa-calendar"></i> Payment Schedule Management</b></h3>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowScheduleModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead className="bg-light">
                    <tr>
                      <th>Employee Name</th>
                      <th>Current Payment Day</th>
                      <th>New Payment Day</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(schedule => (
                      <tr key={schedule.staff_id}>
                        <td>{schedule.staff_name}</td>
                        <td>{schedule.payment_day}</td>
                        <td>
                          <select
                            className="form-control"
                            value={scheduleUpdates[schedule.staff_id] || schedule.payment_day}
                            onChange={(e) => setScheduleUpdates({
                              ...scheduleUpdates,
                              [schedule.staff_id]: parseInt(e.target.value)
                            })}
                          >
                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                              <option key={day} value={day}>{day}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleUpdateSchedule(
                              schedule.staff_id,
                              scheduleUpdates[schedule.staff_id] || schedule.payment_day
                            )}
                          >
                            <i className="fa fa-save"></i> Update
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>Close</button>
            </div>
          </div>
        </div>
      </div>
      {showScheduleModal && <div className="modal-backdrop fade show" onClick={() => setShowScheduleModal(false)}></div>}

      {/* Salary History Modal */}
      <div className={`modal fade ${showHistoryModal ? 'show' : ''}`} style={{ display: showHistoryModal ? 'block' : 'none' }}>
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header bg-purple text-white">
              <h3 className="modal-title"><b><i className="fa fa-history"></i> Salary Adjustment History</b></h3>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowHistoryModal(false)}></button>
            </div>
            <div className="modal-body">
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead className="bg-light">
                    <tr>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Previous Salary</th>
                      <th>New Salary</th>
                      <th>Change</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Created By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyMutation.data && historyMutation.data.length > 0 ? (
                      historyMutation.data.map((record) => {
                        const changeAmount = parseFloat(record.new_salary.toString()) - parseFloat(record.previous_salary.toString());
                        const changeClass = changeAmount > 0 ? 'text-success' : 'text-danger';
                        const changeIcon = changeAmount > 0 ? 'fa-arrow-up' : 'fa-arrow-down';

                        return (
                          <tr key={record.adjustment_id}>
                            <td>{new Date(record.effective_date).toLocaleDateString()}</td>
                            <td>{record.employee_name}</td>
                            <td>{formatNumber(parseFloat(record.previous_salary.toString()))}</td>
                            <td>{formatNumber(parseFloat(record.new_salary.toString()))}</td>
                            <td className={changeClass}>
                              <i className={`fa ${changeIcon}`}></i> {formatNumber(Math.abs(changeAmount))}
                            </td>
                            <td>
                              <span className={`badge ${changeAmount > 0 ? 'bg-success' : 'bg-danger'}`}>
                                {record.adjustment_type}
                              </span>
                            </td>
                            <td>{record.reason || 'N/A'}</td>
                            <td>{record.created_by_name}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center">No history records found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      </div>
      {showHistoryModal && <div className="modal-backdrop fade show" onClick={() => setShowHistoryModal(false)}></div>}
    </div>
  );
}


