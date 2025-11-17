import apiClient from './api';
import type { Customer, CustomerFilters, CreateCustomerRequest, UpdateCustomerRequest } from '../types/customer';

export const customerService = {
  async getCustomers(filters: CustomerFilters): Promise<{ data: Customer[]; pagination?: any }> {
    const response = await apiClient.post('/customer/customers.php', {
      action: 'getCustomers',
      ...filters
    });
    return {
      data: response.data.success ? response.data.data : [],
      pagination: response.data.pagination
    };
  },

  async addCustomer(data: CreateCustomerRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/customer/customers.php', {
      action: 'addCustomer',
      ...data
    });
    return {
      success: response.data.success,
      message: response.data.message || 'Customer added successfully'
    };
  },

  async updateCustomer(data: UpdateCustomerRequest): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/customer/customers.php', {
      action: 'updateCustomer',
      ...data
    });
    return {
      success: response.data.success,
      message: response.data.message || 'Customer updated successfully'
    };
  },

  async deleteCustomer(customer_id: number): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/customer/customers.php', {
      action: 'deleteCustomer',
      customer_id
    });
    return {
      success: response.data.success,
      message: response.data.message || 'Customer deleted successfully'
    };
  },

  async getCustomer(customer_id: number): Promise<Customer> {
    const response = await apiClient.post('/customer/customers.php', {
      action: 'getCustomer',
      customer_id
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Customer not found');
  }
};

