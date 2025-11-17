export interface Salary {
  salary_id: number;
  paidToEmployee: string;
  salary_amount: number;
  datetime: string;
  paidbyEmployee: string;
  account_Name: string;
  employee_id?: number;
  paymentType?: number;
}

export interface Employee {
  staff_id: number;
  staff_name: string;
  salary?: number;
  current_salary?: number;
  salary_date?: number;
  payment_day?: number;
}

export interface EmployeeSalarySummary {
  staff_id: number;
  staff_name: string;
  monthly_salary_due: number;
  current_month_paid: number;
  current_month_balance: number;
  total_paid_all_time: number;
  last_salary_date: string | null;
  last_salary_amount: number | null;
  days_since_last_salary: number | null;
  current_month_payments: number;
  total_payments_all_time: number;
  salary_date: number;
  payment_day: number;
  payment_status: 'paid' | 'pending';
}

export interface SalaryFilters {
  searchTerm?: 'MonthYearAndEmpWise' | 'MonthYearWise' | 'EmpWise';
  searchemployee_id?: number | string;
  searchMonth?: string;
  searchYear?: string;
  monthYearSearch?: boolean;
}

export interface CreateSalaryRequest {
  Addemployee_ID: number;
  Salary_Amount: string;
  Addaccount_ID: number;
}


export interface UpdateSalaryRequest {
  SalaryID: number;
  Updemployee_id: number;
  Updsalary_Amount: string;
  Updaccount_ID: number;
}

export interface SalaryAdjustmentRequest {
  EmployeeId: number;
  EffectiveDate: string;
  AdjustmentType: 'increase' | 'decrease';
  CurrentSalary: string;
  NewSalary: string;
  Reason?: string;
}

export interface PaymentSchedule {
  staff_id: number;
  staff_name: string;
  payment_day: number;
}

export interface SalaryHistory {
  adjustment_id: number;
  employee_id: number;
  employee_name: string;
  previous_salary: number;
  new_salary: number;
  adjustment_type: string;
  adjustment_amount: number;
  adjustment_percentage: number;
  effective_date: string;
  reason: string | null;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface PrintReportData {
  employees: Array<{
    staff_id: number;
    staff_name: string;
    monthly_salary: number;
    amount_paid: number;
    payment_date: string | null;
    status: string;
    payment_day: number;
  }>;
  summary: {
    paid_count: number;
    pending_count: number;
    total_employees: number;
  };
}
