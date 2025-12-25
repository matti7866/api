import apiClient from './api';
import type { Staff, Branch, Role, Currency, CreateStaffRequest, UpdateStaffRequest } from '../types/staff';

const staffService = {
  async getStaff(): Promise<Staff[]> {
    const response = await apiClient.post('/staff/staff.php', {
      action: 'getStaff'
    });
    return response.data.success ? response.data.data : [];
  },

  async getStaffById(staffId: number): Promise<Staff> {
    const response = await apiClient.post('/staff/staff.php', {
      action: 'getStaffById',
      staff_id: staffId
    });
    
    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.message || 'Failed to fetch staff');
  },

  async addStaff(data: CreateStaffRequest): Promise<void> {
    const formData = new FormData();
    formData.append('action', 'addStaff');
    formData.append('staff_name', data.staff_name);
    formData.append('staff_phone', data.staff_phone);
    formData.append('staff_email', data.staff_email);
    formData.append('staff_address', data.staff_address);
    formData.append('branch_id', String(data.branch_id));
    formData.append('role_id', String(data.role_id));
    formData.append('salary', String(data.salary));
    formData.append('currency_id', String(data.currency_id));
    formData.append('status', String(data.status));
    formData.append('password', data.password);
    
    if (data.photo) {
      formData.append('photo', data.photo);
    }
    
    const response = await apiClient.post('/staff/staff.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to add staff');
    }
  },

  async updateStaff(data: UpdateStaffRequest): Promise<void> {
    const formData = new FormData();
    formData.append('action', 'updateStaff');
    formData.append('staff_id', String(data.staff_id));
    formData.append('staff_name', data.staff_name);
    formData.append('staff_phone', data.staff_phone);
    formData.append('staff_email', data.staff_email);
    formData.append('staff_address', data.staff_address);
    formData.append('branch_id', String(data.branch_id));
    formData.append('role_id', String(data.role_id));
    formData.append('salary', String(data.salary));
    formData.append('currency_id', String(data.currency_id));
    formData.append('status', String(data.status));
    
    if (data.password) {
      formData.append('password', data.password);
    }
    
    if (data.photo) {
      formData.append('photo', data.photo);
    }
    
    const response = await apiClient.post('/staff/staff.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to update staff');
    }
  },

  async deleteStaff(staffId: number): Promise<void> {
    const response = await apiClient.post('/staff/staff.php', {
      action: 'deleteStaff',
      staff_id: staffId
    });
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to delete staff');
    }
  },

  async getBranches(): Promise<Branch[]> {
    const response = await apiClient.post('/staff/staff.php', {
      action: 'getBranches'
    });
    return response.data.success ? response.data.data : [];
  },

  async getRoles(): Promise<Role[]> {
    const response = await apiClient.post('/staff/staff.php', {
      action: 'getRoles'
    });
    return response.data.success ? response.data.data : [];
  },

  async getCurrencies(): Promise<Currency[]> {
    const response = await apiClient.post('/staff/staff.php', {
      action: 'getCurrencies'
    });
    return response.data.success ? response.data.data : [];
  }
};

export default staffService;



