import apiClient from './api';
import { config } from '../utils/config';
import axios from 'axios';
import logger from '../utils/logger';
import type {
  Account,
  Currency,
  TransactionsResponse,
  AccountBalancesResponse,
  DepositRequest,
  WithdrawRequest,
  TransferRequest,
  AccountStatementData,
  ValidationReport,
  TransactionFilter
} from '../types/accounts';

class AccountsService {
  async getAccounts(): Promise<Account[]> {
    try {
      // Use absolute URL for API endpoint
      const response = await axios.get(`${config.baseUrl}/api/accounts.php`, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data && Array.isArray(response.data)) {
        logger.debug('Accounts fetched successfully:', response.data.length, 'accounts');
        return response.data;
      }
      
      // If response is an error object
      if (response.data && response.data.error) {
        logger.error('Accounts API error:', response.data.error);
        return [];
      }
      
      return [];
    } catch (error: any) {
      logger.error('Error fetching accounts:', error);
      logger.error('Error response:', error.response?.data);
      logger.error('Error status:', error.response?.status);
      
      // Fallback: try accountsReportController
      try {
        const fallbackResponse = await axios.post(`${config.baseUrl}/accountsReportController.php`, 
          new URLSearchParams({ action: 'getAccounts' }), 
          { 
            withCredentials: true,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
          }
        );
        const accounts = fallbackResponse.data?.accounts || fallbackResponse.data || [];
        logger.debug('Accounts fetched from fallback:', accounts.length, 'accounts');
        return Array.isArray(accounts) ? accounts : [];
      } catch (fallbackError) {
        logger.error('Fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  async getCurrencies(): Promise<Currency[]> {
    try {
      // Use absolute URL for API endpoint
      const response = await axios.get(`${config.baseUrl}/api/currencies.php`, {
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.data && Array.isArray(response.data)) {
        logger.debug('Currencies fetched successfully:', response.data.length, 'currencies');
        return response.data;
      }
      
      // If response is an error object
      if (response.data && response.data.error) {
        logger.error('Currencies API error:', response.data.error);
        return [];
      }
      
      return [];
    } catch (error: any) {
      logger.error('Error fetching currencies:', error);
      logger.error('Error response:', error.response?.data);
      logger.error('Error status:', error.response?.status);
      
      // Fallback: try accountsReportController
      try {
        const fallbackResponse = await axios.post(`${config.baseUrl}/accountsReportController.php`, 
          new URLSearchParams({ action: 'getCurrencies' }), 
          { 
            withCredentials: true,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
          }
        );
        const currencies = fallbackResponse.data?.currencies || fallbackResponse.data || [];
        logger.debug('Currencies fetched from fallback:', currencies.length, 'currencies');
        return Array.isArray(currencies) ? currencies : [];
      } catch (fallbackError) {
        logger.error('Fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  async getDetailedTransactions(filters: TransactionFilter): Promise<TransactionsResponse> {
    const formData = new FormData();
    formData.append('action', 'getDetailedTransactions');
    formData.append('fromDate', filters.fromDate);
    formData.append('toDate', filters.toDate);
    formData.append('accountFilter', filters.accountFilter);
    formData.append('typeFilter', filters.typeFilter);
    formData.append('resetDate', filters.resetDate);

    // Use absolute URL for root-level PHP files
    const response = await axios.post(`${config.baseUrl}/accountsReportController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getAccountBalances(resetDate: string): Promise<AccountBalancesResponse> {
    const formData = new FormData();
    formData.append('action', 'getAccountBalances');
    formData.append('resetDate', resetDate);

    // Use absolute URL for root-level PHP files
    const response = await axios.post(`${config.baseUrl}/accountsReportController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async addDeposit(data: DepositRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('AddSalary', 'addSalary');
    formData.append('Deposit_Amount', data.depositAmount.toString());
    formData.append('Addaccount_ID', data.depositAccount.toString());
    formData.append('Remarks', data.depositRemarks);
    formData.append('Currency_Type', data.depositCurrency.toString());

    const response = await axios.post(`${config.baseUrl}/depositController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (response.data === 'Success' || response.data.trim?.() === 'Success') {
      return { status: 'success', message: 'Deposit added successfully' };
    }
    throw new Error(response.data || 'Failed to add deposit');
  }

  async addWithdrawal(data: WithdrawRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('AddSalary', 'addSalary');
    formData.append('Withdrawal_Amount', data.withdrawAmount.toString());
    formData.append('Addaccount_ID', data.withdrawAccount.toString());
    formData.append('Remarks', data.withdrawRemarks);
    formData.append('Currency_Type', data.withdrawCurrency.toString());

    const response = await axios.post(`${config.baseUrl}/withdrawalController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    if (response.data === 'Success' || response.data.trim?.() === 'Success') {
      return { status: 'success', message: 'Withdrawal added successfully' };
    }
    throw new Error(response.data || 'Failed to add withdrawal');
  }

  async addTransfer(data: TransferRequest): Promise<{ status: string; message: string }> {
    const formData = new FormData();
    formData.append('action', 'addTransaction');
    formData.append('dateAdd', data.transferDate);
    formData.append('fromAccountAdd', data.transferFromAccount.toString());
    formData.append('toAccountAdd', data.transferToAccount.toString());
    formData.append('remarksAdd', data.transferRemarks || '');
    formData.append('trxNumberAdd', data.transferTrxNumber || '');
    formData.append('amountAdd', data.transferAmount.toString());
    formData.append('amountConfirmAdd', data.transferAmountConfirm.toString());
    formData.append('chargesAdd', data.transferCharges.toString());
    formData.append('exchangeRateAdd', data.transferExchangeRate.toString());

    const response = await axios.post(`${config.baseUrl}/transfersController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getAccountStatement(accountId: number, fromDate: string, toDate: string): Promise<AccountStatementData> {
    const formData = new FormData();
    formData.append('GetAccountStatement', 'detailed');
    formData.append('accountId', accountId.toString());
    formData.append('fromDate', fromDate);
    formData.append('toDate', toDate);

    const response = await axios.post(`${config.baseUrl}/accountsReportController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async validateTables(): Promise<ValidationReport> {
    const formData = new FormData();
    formData.append('action', 'validateTables');

    const response = await axios.post(`${config.baseUrl}/accountsReportController.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getAccountBalance(accountId: number): Promise<{ status: string; account: any }> {
    const formData = new FormData();
    formData.append('id', accountId.toString());

    const response = await axios.post(`${config.baseUrl}/getAccountBalance.php`, formData, {
      withCredentials: true,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  exportToExcel(filters: TransactionFilter): void {
    const url = `${config.baseUrl}/accountsReportController.php?action=exportExcel&fromDate=${filters.fromDate}&toDate=${filters.toDate}&accountFilter=${filters.accountFilter}&typeFilter=${filters.typeFilter}`;
    window.open(url, '_blank');
  }
}

export const accountsService = new AccountsService();

