export interface Loan {
  loan_id: number;
  customer_id: number;
  customer_name: string;
  amount: number;
  currencyID: number;
  currencyName: string;
  accountID: number;
  account_Name: string;
  datetime: string;
  remarks?: string;
  staff_name: string;
}

export interface LoanFilters {
  start_date?: string;
  end_date?: string;
  customer?: number;
  search_by_date?: boolean;
}

export interface CreateLoanRequest {
  customer_id: number;
  amount: number;
  currency_id: number;
  account_id: number;
  remarks?: string;
}

export interface LoanTotal {
  amount: number;
  currencyName: string;
}

export interface LoanDropdownData {
  customers: { customer_id: number; customer_name: string }[];
  currencies: { currencyID: number; currencyName: string }[];
  accounts: { account_ID: number; account_Name: string }[];
}


