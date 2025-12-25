export interface Supplier {
  supp_id: number;
  supp_name: string;
  supp_email: string;
  supp_add: string;
  supp_phone: string;
  supp_type: string;
  supp_type_id: number;
}

export interface PendingSupplier {
  main_supp: number;
  main_supplier?: number;
  supp_name: string;
  supp_email: string;
  supp_phone: string;
  Pending: number;
  total?: number;
}

export interface CreateSupplierRequest {
  supplier_name: string;
  supplier_email: string;
  supplier_address: string;
  supplier_phone: string;
  supplier_type_id: number;
}

export interface UpdateSupplierRequest {
  supplier_id: number;
  supplier_name: string;
  supplier_email: string;
  supplier_address: string;
  supplier_phone: string;
  supplier_type_id: number;
}

export interface SupplierPaymentRequest {
  supplier_id: number;
  payment_amount: number;
  currency_id: number;
  remarks?: string;
  account_id: number;
}

export interface SupplierDropdownData {
  suppliers: { supp_id: number; supp_name: string }[];
  currencies: { currencyID: number; currencyName: string }[];
  accounts: { account_ID: number; account_Name: string }[];
}

export interface SupplierPaymentDetails {
  total: number;
}

export interface SupplierLedgerTransaction {
  TRANSACTION_Type: string;
  passenger_name: string;
  datetime: string;
  date: string;
  Identification: string;
  Orgin: string;
  Destination: string;
  Debit: number;
  Credit: number;
  remarks: string;
}

export interface SupplierInfo {
  supp_name: string;
  supp_email: string;
  supp_phone: string;
}

