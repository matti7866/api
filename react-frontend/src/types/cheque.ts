export interface Cheque {
  id: number;
  type: 'payable' | 'receivable';
  number: string;
  date: string;
  payee: string;
  amount: number;
  bank: string | null;
  account_id: number | null;
  account?: string; // Account name from JOIN
  filename: string | null;
  cheque_status: 'pending' | 'paid';
  paid_date: string | null;
  created_by: number;
  created_at?: string;
}

export interface ChequeFilters {
  startDate?: string;
  endDate?: string;
  search?: string;
  type?: 'payable' | 'receivable' | '';
  account?: string;
}

export interface CreateChequeRequest {
  date: string;
  number: string;
  type: 'payable' | 'receivable';
  payee: string;
  amount: number;
  amountConfirm: number;
  account_id?: number;
  bank?: string;
  file: File;
}

export interface UpdateChequeRequest {
  id: number;
  date: string;
  number: string;
  type: 'payable' | 'receivable';
  payee: string;
  amount: number;
  amountConfirm: number;
  account_id?: number;
  bank?: string;
  file?: File;
}

export interface ChequeResponse {
  status: string;
  success?: boolean;
  message?: string;
  html?: string;
  data?: Cheque | Cheque[];
  errors?: Record<string, string>;
}

export interface Account {
  account_ID: number;
  account_Name: string;
}


