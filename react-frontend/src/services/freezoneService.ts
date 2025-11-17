import axios from './api';

interface FreezoneTask {
  id: number;
  residenceID: number;
  datetime: string;
  passenger_name: string;
  customer_name: string;
  company_name: string;
  company_number: string;
  passportNumber: string;
  passportExpiryDate: string;
  countryName: string;
  countryCode: string;
  uid: string;
  positionID: number;
  position_name: string;
  evisaStatus: string;
  insideOutside: string;
  salePrice: number;
  saleCurrency: number;
  completedSteps: number;
}

interface FreezoneTasksResponse {
  success: boolean;
  residences: FreezoneTask[];
  stepCounts: Record<string, number>;
}

const freezoneService = {
  /**
   * Get freezone tasks for a specific step
   */
  async getTasks(params: { step?: string; company_id?: string; search?: string }): Promise<FreezoneTasksResponse> {
    const response = await axios.get('/freezone/tasks.php', { params });
    console.log('Freezone tasks API response:', response.data);
    
    // Handle JWTHelper response format - data is merged directly into response
    if (response.data.success !== undefined) {
      return {
        success: response.data.success,
        residences: response.data.residences || [],
        stepCounts: response.data.stepCounts || {}
      };
    }
    
    // Fallback for nested data structure
    return {
      success: true,
      residences: response.data.data?.residences || response.data.residences || [],
      stepCounts: response.data.data?.stepCounts || response.data.stepCounts || {}
    };
  },

  /**
   * Set eVisa for a freezone residence
   */
  async setEVisa(id: number, data: { companyID: string; eVisaPositionID: string; eVisaCost?: string; eVisaAccountID?: string; eVisaCurrencyID?: string }): Promise<any> {
    const formData = new URLSearchParams();
    formData.append('action', 'seteVisa');
    formData.append('id', id.toString());
    formData.append('companyID', data.companyID);
    formData.append('eVisaPositionID', data.eVisaPositionID);
    formData.append('eVisaCost', data.eVisaCost || '4020');
    if (data.eVisaAccountID) formData.append('eVisaAccountID', data.eVisaAccountID);
    if (data.eVisaCurrencyID) formData.append('eVisaCurrencyID', data.eVisaCurrencyID);

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.data || response.data;
  },

  /**
   * Accept eVisa
   */
  async acceptEVisa(id: number, file?: File): Promise<any> {
    const formData = new FormData();
    formData.append('action', 'seteVisaAccept');
    formData.append('id', id.toString());
    if (file) {
      formData.append('eVisaFile', file);
    }

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data || response.data;
  },

  /**
   * Reject eVisa
   */
  async rejectEVisa(id: number): Promise<any> {
    const formData = new URLSearchParams();
    formData.append('action', 'rejectEVisa');
    formData.append('id', id.toString());

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.data || response.data;
  },

  /**
   * Set Change Status
   */
  async setChangeStatus(id: number, data: {
    changeStatusCost: string;
    changeStatusAccountType: string;
    changeStatusAccountID?: string;
    changeStatusSupplierID?: string;
    changeStatusCurrencyID?: string;
    changeStatusFile?: File;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('action', 'setChangeStatus');
    formData.append('id', id.toString());
    formData.append('changeStatusCost', data.changeStatusCost);
    formData.append('changeStatusAccountType', data.changeStatusAccountType);
    if (data.changeStatusAccountID) {
      formData.append('changeStatusAccountID', data.changeStatusAccountID);
    }
    if (data.changeStatusSupplierID) {
      formData.append('changeStatusSupplierID', data.changeStatusSupplierID);
    }
    if (data.changeStatusCurrencyID) {
      formData.append('changeStatusCurrencyID', data.changeStatusCurrencyID);
    }
    if (data.changeStatusFile) {
      formData.append('changeStatusFile', data.changeStatusFile);
    }

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data || response.data;
  },

  /**
   * Set Medical
   */
  async setMedical(id: number, data: { medicalCost: string; medicalAccountID?: string; medicalCurrencyID?: string; medicalFile?: File }): Promise<any> {
    const formData = new FormData();
    formData.append('action', 'setMedical');
    formData.append('id', id.toString());
    formData.append('medicalCost', data.medicalCost);
    if (data.medicalAccountID) {
      formData.append('medicalAccountID', data.medicalAccountID);
    }
    if (data.medicalCurrencyID) {
      formData.append('medicalCurrencyID', data.medicalCurrencyID);
    }
    if (data.medicalFile) {
      formData.append('medicalFile', data.medicalFile);
    }

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data || response.data;
  },

  /**
   * Set Emirates ID
   */
  async setEmiratesID(id: number, data: { emiratesIDCost: string; emiratesIDAccountID?: string; emiratesIDCurrencyID?: string; emiratesIDFile?: File }): Promise<any> {
    const formData = new FormData();
    formData.append('action', 'setEmiratesID');
    formData.append('id', id.toString());
    formData.append('emiratesIDCost', data.emiratesIDCost);
    if (data.emiratesIDAccountID) {
      formData.append('emiratesIDAccountID', data.emiratesIDAccountID);
    }
    if (data.emiratesIDCurrencyID) {
      formData.append('emiratesIDCurrencyID', data.emiratesIDCurrencyID);
    }
    if (data.emiratesIDFile) {
      formData.append('emiratesIDFile', data.emiratesIDFile);
    }

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data || response.data;
  },

  /**
   * Set Visa Stamping
   */
  async setVisaStamping(id: number, data: { emiratesIDNumber: string; visaExpiryDate: string }): Promise<any> {
    const formData = new URLSearchParams();
    formData.append('action', 'setVisaStamping');
    formData.append('id', id.toString());
    formData.append('emiratesIDNumber', data.emiratesIDNumber);
    formData.append('visaExpiryDate', data.visaExpiryDate);

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.data || response.data;
  },

  /**
   * Add new freezone residence
   */
  async addFreezoneResidence(data: {
    customerID: string;
    uid: string;
    passportNumber: string;
    passportExpiryDate: string;
    passangerName: string;
    nationality: string;
    gender: string;
    dob: string;
    insideOutside: string;
    positionID: string;
    salary: string;
    salePrice: string;
    saleCurrency: string;
    passportFile: File;
    photoFile: File;
    idFrontFile?: File;
    idBackFile?: File;
  }): Promise<any> {
    const formData = new FormData();
    formData.append('action', 'addFreezoneResidence');
    formData.append('customerID', data.customerID);
    formData.append('uid', data.uid);
    formData.append('passportNumber', data.passportNumber);
    formData.append('passportExpiryDate', data.passportExpiryDate);
    formData.append('passangerName', data.passangerName);
    formData.append('nationality', data.nationality);
    formData.append('gender', data.gender);
    formData.append('dob', data.dob);
    formData.append('insideOutside', data.insideOutside);
    formData.append('positionID', data.positionID);
    formData.append('salary', data.salary);
    formData.append('salePrice', data.salePrice);
    formData.append('saleCurrency', data.saleCurrency);
    formData.append('passportFile', data.passportFile);
    formData.append('photoFile', data.photoFile);
    if (data.idFrontFile) {
      formData.append('idFrontFile', data.idFrontFile);
    }
    if (data.idBackFile) {
      formData.append('idBackFile', data.idBackFile);
    }

    const response = await axios.post('/freezone/tasks-controller.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data || response.data;
  },

  /**
   * Get companies (Freezone only)
   */
  async getCompanies(): Promise<Array<{ company_id: number; company_name: string; company_number: string }>> {
    try {
      const response = await axios.get('/residence/get-companies.php', { params: { type: 'Freezone' } });
      console.log('getCompanies raw response:', response.data);
      console.log('Response keys:', Object.keys(response.data));
      console.log('response.data.companies:', response.data.companies);
      console.log('response.data.data:', response.data.data);
      
      // Handle JWTHelper response format
      // When data is ['companies' => [...]], JWTHelper merges it, so response.data.companies should exist
      if (response.data.success !== undefined) {
        // Check if companies are in a 'companies' key (new format)
        if (Array.isArray(response.data.companies)) {
          console.log('Found companies in response.data.companies:', response.data.companies.length);
          return response.data.companies;
        }
        // Check if data is in a 'data' key
        if (Array.isArray(response.data.data)) {
          console.log('Found companies in response.data.data:', response.data.data.length);
          return response.data.data;
        }
        // Check if data is merged directly (numeric keys) - old format
        const numericKeys = Object.keys(response.data).filter(key => !isNaN(Number(key)));
        if (numericKeys.length > 0) {
          const companies = numericKeys.map(key => response.data[key]).filter(item => item && item.company_id);
          console.log('Found companies in numeric keys:', companies.length);
          return companies;
        }
        console.warn('No companies found in response');
        return [];
      }
      
      // Fallback for non-JWTHelper format
      const result = Array.isArray(response.data) ? response.data : (response.data?.data || response.data?.companies || []);
      console.log('Using fallback, result:', result);
      return result;
    } catch (error: any) {
      console.error('Error in getCompanies:', error);
      console.error('Error response:', error.response);
      throw error;
    }
  },

  /**
   * Get lookups (same as residence)
   */
  async getLookups(): Promise<any> {
    const response = await axios.get('/residence/lookups.php');
    console.log('getLookups raw response:', response.data);
    // Handle JWTHelper response format
    if (response.data.success !== undefined) {
      return response.data.data || response.data;
    }
    return response.data.data || response.data;
  },

  /**
   * Get attachments for a freezone residence
   */
  async getAttachments(id: number): Promise<any[]> {
    const response = await axios.get('/freezone/attachments.php', { params: { action: 'get', id } });
    console.log('Freezone attachments API response:', response.data);
    // Handle JWTHelper response format
    if (response.data.success !== undefined) {
      return response.data.attachments || response.data.data || [];
    }
    return response.data.data || response.data || [];
  },

  /**
   * Upload attachment for a freezone residence
   */
  async uploadAttachment(id: number, fileType: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('id', id.toString());
    formData.append('fileType', fileType);
    formData.append('file', file);

    const response = await axios.post('/freezone/attachments.php', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data || response.data;
  },

  /**
   * Delete attachment
   */
  async deleteAttachment(attachmentId: number): Promise<any> {
    const formData = new URLSearchParams();
    formData.append('action', 'delete');
    formData.append('id', attachmentId.toString());

    const response = await axios.post('/freezone/attachments.php', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.data || response.data;
  }
};

export default freezoneService;

