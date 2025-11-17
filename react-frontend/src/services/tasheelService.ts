import apiClient from './api';
import { config } from '../utils/config';
import type {
  TasheelTransaction,
  Company,
  TransactionType,
  TasheelFilters,
  TasheelResponse,
  CreateTasheelRequest,
  UpdateTasheelRequest,
  ChangeStatusRequest,
  DropdownData
} from '../types/tasheel';

const tasheelService = {
  // Get transactions with filters and pagination
  async searchTransactions(filters: TasheelFilters): Promise<TasheelResponse> {
    const formData = new FormData();
    formData.append('action', 'searchTransactions');
    formData.append('status_filter', filters.status_filter || 'in_process');
    
    if (filters.company) formData.append('company', filters.company);
    if (filters.type) formData.append('type', filters.type);
    if (filters.search) formData.append('search', filters.search);
    if (filters.mohrestatus) formData.append('mohrestatus', filters.mohrestatus);
    if (filters.page) formData.append('page', filters.page.toString());
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response.data;
  },

  // Get single transaction
  async getTransaction(id: number): Promise<TasheelTransaction> {
    const formData = new FormData();
    formData.append('action', 'getTransaction');
    formData.append('id', id.toString());
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    if (response.data.status === 'success' || response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch transaction');
  },

  // Add new transaction
  async addTransaction(data: CreateTasheelRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'addTransaction');
    
    if (data.company_id) formData.append('company_id', data.company_id.toString());
    formData.append('transaction_type_id', data.transaction_type_id.toString());
    formData.append('transaction_number', data.transaction_number);
    if (data.cost) formData.append('cost', data.cost.toString());
    if (data.mohrestatus) formData.append('mohrestatus', data.mohrestatus);
    if (data.status) formData.append('status', data.status);
    if (data.attachment) formData.append('attachment', data.attachment);
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response.data;
  },

  // Update transaction
  async updateTransaction(data: UpdateTasheelRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'updateTransaction');
    formData.append('id', data.id.toString());
    
    if (data.company_id) formData.append('company_id', data.company_id.toString());
    formData.append('transaction_type_id', data.transaction_type_id.toString());
    formData.append('transaction_number', data.transaction_number);
    if (data.cost) formData.append('cost', data.cost.toString());
    if (data.mohrestatus) formData.append('mohrestatus', data.mohrestatus);
    if (data.status) formData.append('status', data.status);
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response.data;
  },

  // Delete transaction
  async deleteTransaction(id: number): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'deleteTransaction');
    formData.append('id', id.toString());
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response.data;
  },

  // Change moher status
  async changeStatus(data: ChangeStatusRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'changeStatus');
    formData.append('id', data.id.toString());
    formData.append('mohrestatus', data.mohrestatus);
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response.data;
  },

  // Mark as completed
  async markAsCompleted(id: number): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'markAsCompleted');
    formData.append('id', id.toString());
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response.data;
  },

  // Add transaction type
  async addTransactionType(name: string): Promise<{ status: string; message: string; typeId?: number }> {
    const formData = new FormData();
    formData.append('action', 'addTransactionType');
    formData.append('name', name);
    
    const response = await apiClient.post(`${config.baseUrl}/api/tasheel/transactions.php`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response.data;
  },

  // Get dropdown data (companies and transaction types)
  async getDropdowns(): Promise<DropdownData> {
    const response = await apiClient.get(`${config.baseUrl}/api/tasheel/dropdowns.php`, {
      withCredentials: true
    });
    return response.data.data || response.data;
  }
};

export default tasheelService;

