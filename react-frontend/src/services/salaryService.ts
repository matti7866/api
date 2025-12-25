import apiClient from './api';
import { config } from '../utils/config';
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
} from '../types/salary';

const salaryService = {
  async getSalaryReport(filters: SalaryFilters): Promise<Salary[]> {
    const formData = new FormData();
    formData.append('GetSalaryReport', 'getSalaryReport');
    
    if (filters.searchTerm) {
      formData.append('SearchTerm', filters.searchTerm);
    }
    if (filters.searchemployee_id !== undefined) {
      formData.append('Searchemployee_id', filters.searchemployee_id.toString());
    }
    if (filters.searchMonth) {
      formData.append('SearchMonth', filters.searchMonth);
    }
    if (filters.searchYear) {
      formData.append('SearchYear', filters.searchYear);
    }

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async getEmployees(): Promise<Employee[]> {
    const formData = new FormData();
    formData.append('Select_Employee', 'select_employee');

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async getEmployeesWithSalary(): Promise<Employee[]> {
    const formData = new FormData();
    formData.append('GetEmployeeWithSalary', 'true');

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async getEmployeeSalarySummary(month?: string, year?: string): Promise<EmployeeSalarySummary[]> {
    const formData = new FormData();
    formData.append('GetEmployeeSalarySummary', 'true');
    
    if (month) formData.append('SummaryMonth', month);
    if (year) formData.append('SummaryYear', year);

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async addSalary(data: CreateSalaryRequest): Promise<string> {
    const formData = new FormData();
    formData.append('AddSalary', 'addSalary');
    formData.append('Addemployee_ID', data.Addemployee_ID.toString());
    formData.append('Salary_Amount', data.Salary_Amount);
    formData.append('Addaccount_ID', data.Addaccount_ID.toString());

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async updateSalary(data: UpdateSalaryRequest): Promise<string> {
    const formData = new FormData();
    formData.append('UpdSalary', 'updSalary');
    formData.append('SalaryID', data.SalaryID.toString());
    formData.append('Updemployee_id', data.Updemployee_id.toString());
    formData.append('Updsalary_Amount', data.Updsalary_Amount);
    formData.append('Updaccount_ID', data.Updaccount_ID.toString());

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async deleteSalary(id: number): Promise<string> {
    const formData = new FormData();
    formData.append('Delete', 'Delete');
    formData.append('ID', id.toString());

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async getSalaryForUpdate(id: number): Promise<Salary[]> {
    const formData = new FormData();
    formData.append('GetDataForUpdate', 'GetDataForUpdate');
    formData.append('ID', id.toString());

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async saveSalaryAdjustment(data: SalaryAdjustmentRequest): Promise<string> {
    const formData = new FormData();
    formData.append('SalaryAdjustment', 'true');
    formData.append('EmployeeId', data.EmployeeId.toString());
    formData.append('EffectiveDate', data.EffectiveDate);
    formData.append('AdjustmentType', data.AdjustmentType);
    formData.append('CurrentSalary', data.CurrentSalary);
    formData.append('NewSalary', data.NewSalary);
    if (data.Reason) {
      formData.append('Reason', data.Reason);
    }

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async getPaymentSchedules(): Promise<PaymentSchedule[]> {
    const formData = new FormData();
    formData.append('GetPaymentSchedules', 'true');

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async updatePaymentSchedule(employeeId: number, paymentDay: number): Promise<string> {
    const formData = new FormData();
    formData.append('UpdatePaymentSchedule', 'true');
    formData.append('EmployeeId', employeeId.toString());
    formData.append('PaymentDay', paymentDay.toString());

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async getSalaryHistory(): Promise<SalaryHistory[]> {
    const formData = new FormData();
    formData.append('GetSalaryHistory', 'true');

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  },

  async getPrintReport(month: string, year: string): Promise<PrintReportData> {
    const formData = new FormData();
    formData.append('GetPrintReport', 'true');
    formData.append('ReportMonth', month);
    formData.append('ReportYear', year);

    const response = await apiClient.post(`${config.baseUrl}/salaryController.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });

    return response.data;
  }
};

export default salaryService;


