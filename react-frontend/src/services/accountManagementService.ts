import axios from 'axios';
import { config } from '../utils/config';
import type {
  AccountManagement,
  Currency,
  CreateAccountRequest,
  UpdateAccountRequest,
  AccountManagementResponse
} from '../types/accountManagement';

class AccountManagementService {
  private baseUrl = `${config.baseUrl}`;

  // Get all accounts
  async getAccounts(): Promise<AccountManagement[]> {
    const formData = new FormData();
    formData.append('GetAccountsReport', 'getAccountsReport');
    
    const response = await axios.post<AccountManagement[]>(`${this.baseUrl}/accountsController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Get single account for editing
  async getAccount(id: number): Promise<AccountManagement> {
    const formData = new FormData();
    formData.append('GetDataForUpdate', 'GetDataForUpdate');
    formData.append('ID', id.toString());
    
    const response = await axios.post<AccountManagement[]>(`${this.baseUrl}/accountsController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      return response.data[0];
    }
    
    throw new Error('Account not found');
  }

  // Add new account
  async addAccount(data: CreateAccountRequest): Promise<string> {
    const formData = new FormData();
    formData.append('Insert_CountryName', 'Insert_CountryName');
    formData.append('account_name', data.account_name);
    formData.append('account_number', data.account_number || '');
    formData.append('accountType', data.accountType.toString());
    formData.append('currency_type', data.currency_type.toString());
    
    const response = await axios.post<string>(`${this.baseUrl}/accountsController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Update account
  async updateAccount(data: UpdateAccountRequest): Promise<string> {
    const formData = new FormData();
    formData.append('Update_CountryName', 'Update_CountryName');
    formData.append('accountID', data.accountID.toString());
    formData.append('updaccount_name', data.updaccount_name);
    formData.append('updaccount_number', data.updaccount_number || '');
    formData.append('updaccountType', data.updaccountType.toString());
    formData.append('updcurrency_type', data.updcurrency_type.toString());
    
    const response = await axios.post<string>(`${this.baseUrl}/accountsController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Delete account
  async deleteAccount(id: number): Promise<string> {
    const formData = new FormData();
    formData.append('Delete', 'Delete');
    formData.append('ID', id.toString());
    
    const response = await axios.post<string>(`${this.baseUrl}/accountsController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }

  // Get currencies for dropdown
  async getCurrencies(): Promise<Currency[]> {
    const formData = new FormData();
    formData.append('CurrencyTypes', 'currencyTypes');
    
    const response = await axios.post<Currency[]>(`${this.baseUrl}/accountsController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return response.data;
  }
}

export const accountManagementService = new AccountManagementService();
export default accountManagementService;

