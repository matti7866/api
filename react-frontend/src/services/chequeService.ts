import axios from 'axios';
import { config } from '../utils/config';
import type {
  Cheque,
  ChequeFilters,
  CreateChequeRequest,
  UpdateChequeRequest,
  ChequeResponse,
  Account
} from '../types/cheque';

class ChequeService {
  private baseUrl = `${config.baseUrl}`;

  // Search cheques
  async searchCheques(filters: ChequeFilters): Promise<Cheque[]> {
    const formData = new FormData();
    formData.append('action', 'searchCheques');
    
    if (filters.startDate) formData.append('startDate', filters.startDate);
    if (filters.endDate) formData.append('endDate', filters.endDate);
    if (filters.search) formData.append('search', filters.search);
    if (filters.type) formData.append('type', filters.type);
    if (filters.account) formData.append('account_id', filters.account);
    
    const response = await axios.post<ChequeResponse>(`${this.baseUrl}/api/cheque/search.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (response.data.success || response.data.status === 'success') {
      return response.data.data as Cheque[] || [];
    }
    
    throw new Error(response.data.message || 'Failed to fetch cheques');
  }

  // Get single cheque
  async getCheque(id: number): Promise<Cheque> {
    const formData = new FormData();
    formData.append('action', 'getCheque');
    formData.append('id', id.toString());
    
    const response = await axios.post<ChequeResponse>(`${this.baseUrl}/api/cheque/manage.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (response.data.success || response.data.status === 'success') {
      return response.data.data as Cheque;
    }
    
    throw new Error(response.data.message || 'Failed to fetch cheque');
  }

  // Add new cheque
  async addCheque(data: CreateChequeRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'addCheque');
    formData.append('dateAdd', data.date);
    formData.append('numberAdd', data.number);
    formData.append('typeAdd', data.type);
    formData.append('payeeAdd', data.payee);
    formData.append('amountAdd', data.amount.toString());
    formData.append('amountConfirmAdd', data.amountConfirm.toString());
    
    if (data.type === 'payable' && data.account_id) {
      formData.append('accountIDAdd', data.account_id.toString());
    } else if (data.type === 'receivable' && data.bank) {
      formData.append('bankAdd', data.bank);
    }
    
    formData.append('filename', data.file);
    
    const response = await axios.post<ChequeResponse>(`${this.baseUrl}/api/cheque/manage.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Update cheque
  async updateCheque(data: UpdateChequeRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'updateCheque');
    formData.append('idEdit', data.id.toString());
    formData.append('dateEdit', data.date);
    formData.append('numberEdit', data.number);
    formData.append('typeEdit', data.type);
    formData.append('payeeEdit', data.payee);
    formData.append('amountEdit', data.amount.toString());
    formData.append('amountConfirmEdit', data.amountConfirm.toString());
    
    if (data.type === 'payable' && data.account_id) {
      formData.append('accountIDEdit', data.account_id.toString());
    } else if (data.type === 'receivable' && data.bank) {
      formData.append('bankEdit', data.bank);
    }
    
    if (data.file) {
      formData.append('filename', data.file);
    }
    
    const response = await axios.post<ChequeResponse>(`${this.baseUrl}/api/cheque/manage.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Delete cheque
  async deleteCheque(id: number): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'deleteCheque');
    formData.append('id', id.toString());
    
    const response = await axios.post<ChequeResponse>(`${this.baseUrl}/api/cheque/manage.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Pay cheque (mark as paid)
  async payCheque(id: number): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'payCheque');
    formData.append('id', id.toString());
    
    const response = await axios.post<ChequeResponse>(`${this.baseUrl}/api/cheque/manage.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Get accounts for dropdown
  async getAccounts(): Promise<Account[]> {
    const response = await axios.get<Account[]>(`${this.baseUrl}/api/accounts.php`, {
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }
}

export const chequeService = new ChequeService();
export default chequeService;


