import apiClient from './api';
import type {
  Loan,
  LoanFilters,
  CreateLoanRequest,
  LoanTotal,
  LoanDropdownData
} from '../types/loan';

const loanService = {
  // Get loans with filters
  getLoans: async (filters?: LoanFilters): Promise<Loan[]> => {
    const data: any = {
      action: 'searchLoans',
      search_by_date: filters?.search_by_date ? '1' : '0'
    };
    
    if (filters?.start_date) data.start_date = filters.start_date;
    if (filters?.end_date) data.end_date = filters.end_date;
    if (filters?.customer) data.customer = filters.customer.toString();
    
    const response = await apiClient.post('/loan/loans.php', data);
    console.log('Loans response:', response.data);
    
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  },

  // Get loan totals
  getTotal: async (filters?: LoanFilters): Promise<LoanTotal[]> => {
    const data: any = {
      action: 'getTotal',
      search_by_date: filters?.search_by_date ? '1' : '0'
    };
    
    if (filters?.start_date) data.start_date = filters.start_date;
    if (filters?.end_date) data.end_date = filters.end_date;
    if (filters?.customer) data.customer = filters.customer.toString();
    
    const response = await apiClient.post('/loan/loans.php', data);
    return response.data.data || [];
  },

  // Get single loan
  getLoan: async (id: number): Promise<Loan> => {
    const response = await apiClient.post('/loan/loans.php', { action: 'getLoan', id });
    return response.data.data;
  },

  // Create loan
  createLoan: async (data: CreateLoanRequest): Promise<void> => {
    await apiClient.post('/loan/loans.php', { action: 'addLoan', ...data });
  },

  // Update loan
  updateLoan: async (id: number, data: Partial<CreateLoanRequest>): Promise<void> => {
    await apiClient.post('/loan/loans.php', { action: 'updateLoan', id, ...data });
  },

  // Delete loan
  deleteLoan: async (id: number): Promise<void> => {
    await apiClient.post('/loan/loans.php', { action: 'deleteLoan', id });
  },

  // Get dropdowns
  getDropdowns: async (): Promise<LoanDropdownData> => {
    const response = await apiClient.get('/loan/dropdowns.php');
    console.log('Loan dropdowns response:', response.data);
    
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return response.data;
  }
};

export default loanService;


