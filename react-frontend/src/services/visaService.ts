import apiClient from './api';
import type { Visa, VisaFilters, VisaDropdowns } from '../types/visa';

const visaService = {
  // Get dropdowns data
  getDropdowns: async (): Promise<VisaDropdowns> => {
    const response = await apiClient.get('/visa/dropdowns.php');
    return response.data.data;
  },

  // Get visa list with filters
  getVisas: async (filters?: VisaFilters): Promise<Visa[]> => {
    const response = await apiClient.get('/visa/list.php', { params: filters });
    return response.data.data;
  },

  // Create new visa
  createVisa: async (data: FormData | Partial<Visa>): Promise<{ visa_id: number }> => {
    if (data instanceof FormData) {
      const response = await apiClient.post('/visa/create.php', data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } else {
      const response = await apiClient.post('/visa/create.php', data);
      return response.data;
    }
  },

  // Update visa
  updateVisa: async (visaId: number, data: Partial<Visa>): Promise<void> => {
    await apiClient.put('/visa/update.php', {
      visa_id: visaId,
      ...data
    });
  },

  // Delete visa
  deleteVisa: async (visaId: number): Promise<void> => {
    await apiClient.delete('/visa/delete.php', {
      data: { visa_id: visaId }
    });
  },

  // Upload visa copy
  uploadVisaCopy: async (visaId: number, file: File): Promise<{ file_path: string }> => {
    const formData = new FormData();
    formData.append('visa_id', visaId.toString());
    formData.append('visaCopy', file);
    
    const response = await apiClient.post('/visa/upload-copy.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get EID Tasks
  getEIDTasks: async (params: { step: string }): Promise<{
    tasks: any[];
    stepCounts: Record<string, number>;
    totalRemainingBalance: number;
  }> => {
    const response = await apiClient.get('/visa/eid-tasks.php', { params });
    return response.data.data || response.data;
  },

  // Get EID Residence data
  getEIDResidence: async (id: number, type: string): Promise<{ residence: any }> => {
    const formData = new URLSearchParams();
    formData.append('action', 'getResidence');
    formData.append('id', id.toString());
    formData.append('type', type);
    
    const response = await apiClient.post('/visa/eid-tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data.data || response.data;
  },

  // Get EID Positions
  getEIDPositions: async (): Promise<{ positions: Array<{ position_id: number; position_name: string }> }> => {
    const formData = new URLSearchParams();
    formData.append('action', 'getPositions');
    
    const response = await apiClient.post('/visa/eid-tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data.data || response.data;
  },

  // Get EID Companies
  getEIDCompanies: async (): Promise<{ companies: Array<{ company_id: number; company_name: string }> }> => {
    const formData = new URLSearchParams();
    formData.append('action', 'getCompanies');
    
    const response = await apiClient.post('/visa/eid-tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data.data || response.data;
  },

  // Mark EID as Received
  markEIDReceived: async (data: {
    id: number;
    type: string;
    eidNumber: string;
    eidExpiryDate: string;
    passenger_name: string;
    gender: string;
    dob: string;
    occupation?: number | null;
    establishmentName?: number | null;
    emiratesIDBackFile?: File | null;
    emiratesIDFrontFile?: File | null;
  }): Promise<void> => {
    const formData = new FormData();
    formData.append('action', 'setMarkReceived');
    formData.append('id', data.id.toString());
    formData.append('type', data.type);
    formData.append('eidNumber', data.eidNumber);
    formData.append('eidExpiryDate', data.eidExpiryDate);
    formData.append('passenger_name', data.passenger_name);
    formData.append('gender', data.gender);
    formData.append('dob', data.dob);
    if (data.occupation) {
      formData.append('occupation', data.occupation.toString());
    }
    if (data.establishmentName) {
      formData.append('establishmentName', data.establishmentName.toString());
    }
    if (data.emiratesIDBackFile) {
      formData.append('emiratesIDBack', data.emiratesIDBackFile);
    }
    if (data.emiratesIDFrontFile) {
      formData.append('emiratesIDFront', data.emiratesIDFrontFile);
    }
    
    await apiClient.post('/visa/eid-tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Mark EID as Delivered
  markEIDDelivered: async (data: { id: number; type: string }): Promise<void> => {
    const formData = new URLSearchParams();
    formData.append('action', 'setMarkDelivered');
    formData.append('id', data.id.toString());
    formData.append('type', data.type);
    
    await apiClient.post('/visa/eid-tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
  }
};

export default visaService;











