import apiClient from './api';
import type {
  CustomerPayment,
  SupplierPayment,
  CustomerPaymentFilters,
  SupplierPaymentFilters,
  CreateCustomerPaymentRequest,
  UpdateCustomerPaymentRequest,
  CreateSupplierPaymentRequest,
  UpdateSupplierPaymentRequest,
  TotalCharge
} from '../types/payment';

export const customerPaymentService = {
  async searchPayments(filters: CustomerPaymentFilters): Promise<{ data: CustomerPayment[]; pagination?: any }> {
    const response = await apiClient.post('/payment/customerPayments.php', {
      action: 'searchPayments',
      ...filters
    });
    return {
      data: response.data.success ? response.data.data : [],
      pagination: response.data.pagination
    };
  },

  async addPayment(data: CreateCustomerPaymentRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/payment/customerPayments.php', {
      action: 'addPayment',
      customer_id: data.customer_id,
      payment_amount: data.payment_amount,
      account_id: data.account_id,
      currency_id: data.currency_id,
      remarks: data.remarks || '',
      staff_id: data.staff_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Payment added successfully'
    };
  },

  async updatePayment(data: UpdateCustomerPaymentRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/payment/customerPayments.php', {
      action: 'updatePayment',
      pay_id: data.pay_id,
      customer_id: data.customer_id,
      payment_amount: data.payment_amount,
      account_id: data.account_id,
      currency_id: data.currency_id,
      remarks: data.remarks || '',
      staff_id: data.staff_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Payment updated successfully'
    };
  },

  async getPayment(pay_id: number): Promise<CustomerPayment> {
    const response = await apiClient.post('/payment/customerPayments.php', {
      action: 'getPayment',
      pay_id
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch payment');
  },

  async deletePayment(pay_id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/payment/customerPayments.php', {
      action: 'deletePayment',
      pay_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Payment deleted successfully'
    };
  },

  async getAccountCurrency(account_id: number): Promise<{ currency_id: number }> {
    const response = await apiClient.post('/payment/customerPayments.php', {
      action: 'getAccountCurrency',
      account_id
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch account currency');
  }
};

export const supplierPaymentService = {
  async searchPayments(filters: SupplierPaymentFilters): Promise<{ data: SupplierPayment[]; pagination?: any }> {
    const response = await apiClient.post('/payment/supplierPayments.php', {
      action: 'searchPayments',
      ...filters
    });
    return {
      data: response.data.success ? response.data.data : [],
      pagination: response.data.pagination
    };
  },

  async addPayment(data: CreateSupplierPaymentRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/payment/supplierPayments.php', {
      action: 'addPayment',
      supplier_id: data.supplier_id,
      payment_amount: data.payment_amount,
      currency_id: data.currency_id,
      payment_detail: data.payment_detail || '',
      account_id: data.account_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Payment added successfully'
    };
  },

  async updatePayment(data: UpdateSupplierPaymentRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/payment/supplierPayments.php', {
      action: 'updatePayment',
      payment_id: data.payment_id,
      supplier_id: data.supplier_id,
      payment_amount: data.payment_amount,
      currency_id: data.currency_id,
      payment_detail: data.payment_detail || '',
      account_id: data.account_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Payment updated successfully'
    };
  },

  async getPayment(payment_id: number): Promise<SupplierPayment> {
    const response = await apiClient.post('/payment/supplierPayments.php', {
      action: 'getPayment',
      payment_id
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch payment');
  },

  async deletePayment(payment_id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/payment/supplierPayments.php', {
      action: 'deletePayment',
      payment_id
    });
    
    return {
      success: response.data.success,
      message: response.data.message || 'Payment deleted successfully'
    };
  },

  async getTotalCharges(supplier_id: number): Promise<TotalCharge[]> {
    const response = await apiClient.post('/payment/supplierPayments.php', {
      action: 'getTotalCharges',
      supplier_id
    });
    return response.data.success ? response.data.data : [];
  }
};

