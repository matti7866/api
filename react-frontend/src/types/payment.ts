export interface CustomerPayment {
  pay_id: number;
  customer_id: number;
  customer_name?: string;
  payment_amount: number;
  datetime: string;
  remarks?: string;
  accountID: number;
  account_Name?: string;
  currencyID: number;
  currencyName?: string;
  staff_id: number;
  staff_name?: string;
}

export interface SupplierPayment {
  payment_id: number;
  supp_id: number;
  supp_name?: string;
  payment_amount: number;
  currencyID: number;
  currencyName?: string;
  payment_detail?: string;
  staff_id: number;
  staff_name?: string;
  time_creation: string;
  accountID: number;
  account_Name?: string;
}

export interface CustomerPaymentFilters {
  start_date?: string;
  end_date?: string;
  customer?: number;
  account?: number;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface SupplierPaymentFilters {
  from_date?: string;
  to_date?: string;
  supplier_id?: number;
  date_search_enabled?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface CreateCustomerPaymentRequest {
  customer_id: number;
  payment_amount: number;
  account_id: number;
  currency_id: number;
  remarks?: string;
  staff_id: number;
}

export interface UpdateCustomerPaymentRequest extends CreateCustomerPaymentRequest {
  pay_id: number;
}

export interface CreateSupplierPaymentRequest {
  supplier_id: number;
  payment_amount: number;
  currency_id: number;
  payment_detail?: string;
  account_id: number;
}

export interface UpdateSupplierPaymentRequest extends CreateSupplierPaymentRequest {
  payment_id: number;
}

export interface TotalCharge {
  curID: number;
  curName: string;
  total: number;
}

