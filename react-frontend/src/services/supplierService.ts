import apiClient from './api';
import type {
  Supplier,
  PendingSupplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierPaymentRequest,
  SupplierDropdownData,
  SupplierPaymentDetails,
  SupplierLedgerTransaction,
  SupplierInfo
} from '../types/supplier';

const supplierService = {
  async getSuppliers(): Promise<Supplier[]> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'getSuppliers'
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch suppliers');
  },

  async getSupplier(supplierId: number): Promise<Supplier> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'getSupplier',
      supplier_id: supplierId
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch supplier');
  },

  async createSupplier(data: CreateSupplierRequest): Promise<void> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'createSupplier',
      ...data
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to create supplier');
    }
  },

  async updateSupplier(data: UpdateSupplierRequest): Promise<void> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'updateSupplier',
      ...data
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to update supplier');
    }
  },

  async deleteSupplier(supplierId: number): Promise<void> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'deleteSupplier',
      supplier_id: supplierId
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to delete supplier');
    }
  },

  async getPendingSuppliers(supplierId?: number, currencyId?: number): Promise<PendingSupplier[]> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'getPendingSuppliers',
      supplier_id: supplierId || '',
      currency_id: currencyId
    });
    
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.message || 'Failed to fetch pending suppliers');
  },

  async getSupplierPaymentDetails(supplierId: number, currencyId: number): Promise<SupplierPaymentDetails> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'getSupplierPaymentDetails',
      supplier_id: supplierId,
      currency_id: currencyId
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch payment details');
  },

  async makePayment(data: SupplierPaymentRequest): Promise<void> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'makePayment',
      ...data
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to record payment');
    }
  },

  async getCurrencies(supplierId?: number): Promise<{ currencyID: number; currencyName: string }[]> {
    const response = await apiClient.post('/supplier/suppliers.php', {
      action: 'getCurrencies',
      supplier_id: supplierId || ''
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch currencies');
  },

  async getDropdowns(): Promise<SupplierDropdownData> {
    const response = await apiClient.get('/supplier/dropdowns.php');
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch dropdowns');
  },

  async getSupplierInfo(supplierId: number): Promise<SupplierInfo> {
    const response = await apiClient.post('/supplier/ledger.php', {
      action: 'getSupplierInfo',
      supplier_id: supplierId
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch supplier info');
  },

  async getCurrencyName(currencyId: number): Promise<{ currencyName: string }> {
    const response = await apiClient.post('/supplier/ledger.php', {
      action: 'getCurrencyName',
      currency_id: currencyId
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch currency name');
  },

  async getLedger(supplierId: number, currencyId: number): Promise<SupplierLedgerTransaction[]> {
    const response = await apiClient.post('/supplier/ledger.php', {
      action: 'getLedger',
      supplier_id: supplierId,
      currency_id: currencyId
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch ledger');
  }
};

export default supplierService;

