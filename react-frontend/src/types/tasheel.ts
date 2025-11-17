export interface TasheelTransaction {
  id: number;
  company_id: number | null;
  company_name: string | null;
  transaction_type_id: number;
  transaction_type_name: string;
  transaction_number: string;
  cost: number | null;
  mohrestatus: string | null;
  status: 'in_process' | 'completed';
  api_transaction_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  company_id: number;
  company_name: string;
}

export interface TransactionType {
  id: number;
  name: string;
}

export interface TasheelFilters {
  company?: string;
  type?: string;
  search?: string;
  mohrestatus?: string;
  status_filter: 'in_process' | 'completed';
  page?: number;
}

export interface TasheelResponse {
  status: string;
  html?: string;
  pagination?: string;
  info?: string;
  data?: TasheelTransaction[];
  message?: string;
  errors?: Record<string, string>;
  currentPage?: number;
  totalPages?: number;
  totalRecords?: number;
  recordsPerPage?: number;
}

export interface CreateTasheelRequest {
  company_id?: number;
  transaction_type_id: number;
  transaction_number: string;
  cost?: number;
  mohrestatus?: string;
  status?: 'in_process' | 'completed';
  attachment?: File;
}

export interface UpdateTasheelRequest extends CreateTasheelRequest {
  id: number;
}

export interface ChangeStatusRequest {
  id: number;
  mohrestatus: string;
}

export interface DropdownData {
  companies: Company[];
  types: TransactionType[];
}


