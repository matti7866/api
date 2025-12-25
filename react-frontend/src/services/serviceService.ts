import apiClient from './api';
import type {
  Service,
  ServiceFilters,
  CreateServiceRequest,
  ServiceDropdownData,
  ServiceDocument
} from '../types/service';

const serviceService = {
  async getServices(filters: ServiceFilters): Promise<Service[]> {
    const response = await apiClient.post('/service/services.php', {
      action: 'searchServices',
      ...filters
    });
    
    if (response.data.success) {
      return response.data.data || [];
    }
    throw new Error(response.data.message || 'Failed to fetch services');
  },

  async getService(id: number): Promise<Service> {
    const response = await apiClient.post('/service/services.php', {
      action: 'getService',
      id
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch service');
  },

  async createService(data: CreateServiceRequest): Promise<{ serviceDetailsID: number }> {
    const response = await apiClient.post('/service/services.php', {
      action: 'addService',
      ...data
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to create service');
  },

  async updateService(id: number, data: Partial<CreateServiceRequest>): Promise<void> {
    const response = await apiClient.post('/service/services.php', {
      action: 'updateService',
      id,
      ...data
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to update service');
    }
  },

  async deleteService(id: number): Promise<void> {
    const response = await apiClient.post('/service/services.php', {
      action: 'deleteService',
      id
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to delete service');
    }
  },

  async getDropdowns(): Promise<ServiceDropdownData> {
    const response = await apiClient.get('/service/dropdowns.php');
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch dropdowns');
  },

  async addServiceType(serviceName: string): Promise<void> {
    const response = await apiClient.post('/service/services.php', {
      action: 'addServiceType',
      service_name: serviceName
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to add service type');
    }
  },

  async updateServiceCharge(id: number, data: {
    supplier_id?: number | null;
    account_id?: number | null;
    net_price: number;
    net_currency_id: number;
  }): Promise<void> {
    const response = await apiClient.post('/service/services.php', {
      action: 'updateServiceCharge',
      id,
      ...data
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to update service charge');
    }
  }
};

export default serviceService;

