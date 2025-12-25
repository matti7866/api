import apiClient from './api';
import type { PendingCustomer, CustomerOption, CurrencyOption, TotalCharges, AddPaymentRequest, CustomerLedgerTransaction, CustomerInfo } from '../types/customerLedger';

export const customerLedgerService = {
  async getCustomers(): Promise<CustomerOption[]> {
    const response = await apiClient.post('/customer/pendingPayments.php', {
      action: 'getCustomers'
    });
    return response.data.success ? response.data.data : [];
  },

  async getPendingCustomers(customer_id: string, currency_id: number): Promise<PendingCustomer[]> {
    const response = await apiClient.post('/customer/pendingPayments.php', {
      action: 'getPendingCustomers',
      customer_id,
      currency_id
    });
    return response.data.success ? response.data.data : [];
  },

  async getCurrencies(customer_id: string, type: string = 'all'): Promise<CurrencyOption[]> {
    const response = await apiClient.post('/customer/pendingPayments.php', {
      action: 'getCurrencies',
      customer_id,
      type
    });
    return response.data.success ? response.data.data : [];
  },

  async getTotalCharges(customer_id: number, currency_id: number): Promise<TotalCharges> {
    const response = await apiClient.post('/customer/pendingPayments.php', {
      action: 'getTotalCharges',
      customer_id,
      currency_id
    });
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch total charges');
  },

  async addPayment(data: AddPaymentRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/customer/pendingPayments.php', {
      action: 'addPayment',
      ...data
    });
    return {
      success: response.data.success,
      message: response.data.message || 'Payment added successfully'
    };
  },

  async getCustomerInfo(customer_id: number): Promise<CustomerInfo> {
    const response = await apiClient.post('/customer/ledger.php', {
      action: 'getCustomerInfo',
      customer_id
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Customer not found');
  },

  async getCurrencyName(currency_id: number): Promise<{ currencyName: string }> {
    const response = await apiClient.post('/customer/ledger.php', {
      action: 'getCurrencyName',
      currency_id
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Currency not found');
  },

  async getLedger(customer_id: number, currency_id: number): Promise<CustomerLedgerTransaction[]> {
    const response = await apiClient.post('/customer/ledger.php', {
      action: 'getLedger',
      customer_id,
      currency_id
    });
    return response.data.success ? response.data.data : [];
  }
};

