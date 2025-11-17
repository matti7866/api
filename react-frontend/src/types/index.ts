// Core Types for the Application

export interface User {
  staff_id: number;
  staff_name: string;
  staff_email: string;
  staff_pic?: string;
  role_id: number;
  role_name?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

// Customer Types
export interface Customer {
  customer_id: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  customer_passport?: string;
  customer_nationality?: string;
  created_at?: string;
  updated_at?: string;
}

// Residence Types
export interface Residence {
  residence_id: number;
  customer_id: number;
  customer_name?: string;
  residence_type: string;
  residence_status: string;
  residence_fee: number;
  residence_date: string;
  expiry_date?: string;
  passport_no?: string;
  created_at?: string;
  updated_at?: string;
}

// Visa Types
export interface Visa {
  visa_id: number;
  customer_id: number;
  customer_name?: string;
  visa_type: string;
  visa_status: string;
  visa_fee: number;
  visa_date: string;
  expiry_date?: string;
  passport_no?: string;
  created_at?: string;
  updated_at?: string;
}

// Payment Types
export interface Payment {
  payment_id: number;
  customer_id: number;
  customer_name?: string;
  payment_amount: number;
  payment_type: string;
  payment_method: string;
  payment_date: string;
  payment_reference?: string;
  description?: string;
  created_by?: number;
  created_at?: string;
}

// Receipt Types
export interface Receipt {
  receipt_id: number;
  receipt_no: string;
  customer_id: number;
  customer_name?: string;
  amount: number;
  payment_type: string;
  receipt_date: string;
  created_by?: number;
  created_at?: string;
}

// Staff Types
export interface Staff {
  staff_id: number;
  staff_name: string;
  staff_email: string;
  staff_phone?: string;
  staff_pic?: string;
  role_id: number;
  role_name?: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

// Dashboard Stats
export interface DashboardStats {
  total_customers: number;
  total_payments: number;
  total_residence: number;
  total_visa: number;
  pending_payments: number;
  monthly_revenue: number;
  recent_activities: Activity[];
}

export interface Activity {
  id: number;
  type: string;
  description: string;
  user: string;
  timestamp: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Table Types
export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => React.ReactNode;
}

export interface TableProps {
  columns: TableColumn[];
  data: any[];
  loading?: boolean;
  onRowClick?: (row: any) => void;
  pagination?: boolean;
  searchable?: boolean;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  placeholder?: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  validation?: any;
}

// Notification Types
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
}

// Accounts Types
export * from './accounts';












