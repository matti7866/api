export interface ExpenseType {
  expense_type_id: number;
  expense_type: string;
}

export interface Expense {
  expense_id: number;
  staff_name: string;
  expense_type: string;
  expense_amount: string;
  currencyName: string;
  expense_remark: string;
  time_creation: string;
  account_Name: string;
  expense_document: string | null;
  original_name: string | null;
}

export interface ExpenseTotal {
  amount: string;
  currencyName: string;
}

export interface CreateExpenseRequest {
  expense_type_id: number;
  expense_amount: number;
  currency_id: number;
  account_id: number;
  expense_remark: string;
  amount_type?: string;
  expense_document?: File;
}

export interface ExpenseFilters {
  search_term?: 'DateWise' | 'EmpWise' | 'DateAndEmpWise';
  from_date?: string;
  to_date?: string;
  employee_id?: number;
}

