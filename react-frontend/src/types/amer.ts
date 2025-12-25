export interface AmerTransaction {
  id: number;
  customer_id: number;
  customer_name?: string;
  passenger_name: string;
  type_id: number;
  type_name?: string;
  application_number: string;
  transaction_number: string;
  payment_date: string;
  cost_price: string;
  sale_price: string;
  iban?: string;
  account_id: number;
  account_Name?: string;
  created_by: number;
  status: 'pending' | 'completed' | 'rejected' | 'refunded' | 'visit_required';
  datetime: string;
}

export interface AmerType {
  id: number;
  name: string;
  cost_price: string;
  sale_price: string;
}

export interface AmerTransactionFilters {
  start_date?: string;
  end_date?: string;
  customer?: number;
  type?: number;
  account?: number;
  status?: string;
  search?: string;
}

export interface CreateAmerTransactionRequest {
  customer_id: number;
  passenger_name: string;
  type_id: number;
  application_number: string;
  transaction_number: string;
  payment_date: string;
  cost_price: string;
  sale_price: string;
  iban?: string;
  account_id: number;
  created_by: number;
  status?: 'pending' | 'completed' | 'rejected' | 'refunded' | 'visit_required';
}

export interface CreateAmerTypeRequest {
  name: string;
  cost_price: string;
  sale_price: string;
}

export interface DropdownData {
  customers: { customer_id: number; customer_name: string }[];
  types: AmerType[];
  accounts: { account_ID: number; account_Name: string }[];
  staff: { staff_id: number; staff_name: string }[];
}




