import axios from './api';
import type {
  Residence,
  ResidenceFilters,
  ResidenceLookups,
  ResidencePayment,
  TawjeehData,
  ILOEData,
  PaymentHistory,
  ResidenceStats,
  FinancialBreakdown
} from '../types/residence';

const residenceService = {
  /**
   * Get residence lookups (dropdowns data)
   */
  async getLookups(): Promise<ResidenceLookups> {
    const response = await axios.get('/residence/lookups.php');
    return response.data.data || response.data;
  },

  /**
   * Get list of residences with filters
   */
  async getResidences(filters: ResidenceFilters = {}) {
    const response = await axios.get('/residence/list.php', { params: filters });
    return {
      data: response.data.data || [],
      total: response.data.total || 0,
      page: response.data.page || 1,
      limit: response.data.limit || 50,
      totalPages: response.data.totalPages || 1
    };
  },

  /**
   * Get single residence by ID
   */
  async getResidence(id: number): Promise<Residence> {
    const response = await axios.get('/residence/get.php', { params: { id } });
    return response.data.data || response.data;
  },

  /**
   * Create new residence (supports file uploads via FormData)
   */
  async createResidence(data: Partial<Residence> & { 
    passportFile?: File;
    photoFile?: File;
    emiratesIdFrontFile?: File;
    emiratesIdBackFile?: File;
  }) {
    const formData = new FormData();
    
    // Add all text fields
    Object.keys(data).forEach(key => {
      if (key !== 'passportFile' && key !== 'photoFile' && key !== 'emiratesIdFrontFile' && key !== 'emiratesIdBackFile') {
        const value = (data as any)[key];
        if (value !== null && value !== undefined) {
          // Map field names to match API expectations
          if (key === 'passenger_name') {
            formData.append('passengerName', value);
          } else if (key === 'sale_price') {
            formData.append('sale_amount', value.toString());
          } else if (key === 'saleCurID') {
            formData.append('sale_currency_type', value.toString());
          } else if (key === 'InsideOutside') {
            formData.append('insideOutside', value);
          } else if (key === 'positionID') {
            formData.append('position', value.toString());
          } else if (key === 'res_type') {
            formData.append('res_type', value);
          } else if (key === 'tawjeehIncluded') {
            formData.append('tawjeeh_included', value ? '1' : '0');
          } else if (key === 'insuranceIncluded') {
            formData.append('insurance_included', value ? '1' : '0');
          } else {
            formData.append(key, value.toString());
          }
        }
      }
    });
    
    // Add files
    if (data.passportFile) {
      formData.append('basicInfoFile', data.passportFile);
    }
    if (data.photoFile) {
      formData.append('basicInfoFilePhoto', data.photoFile);
    }
    if (data.emiratesIdFrontFile) {
      formData.append('basicInfoFileIDFront', data.emiratesIdFrontFile);
    }
    if (data.emiratesIdBackFile) {
      formData.append('basicInfoFileIDBack', data.emiratesIdBackFile);
    }
    
    const response = await axios.post('/residence/create.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Update residence step
   */
  async updateStep(residenceID: number, stepData: any) {
    const formData = new FormData();
    
    // Add residenceID and step
    formData.append('residenceID', residenceID.toString());
    formData.append('step', stepData.step.toString());
    
    if (stepData.markComplete) {
      formData.append('markComplete', 'true');
      formData.append('Type', 'active');
    }
    
    // Add all step-specific fields
    Object.keys(stepData).forEach(key => {
      if (key !== 'step' && key !== 'markComplete' && key !== 'files') {
        const value = stepData[key];
        if (value !== null && value !== undefined && value !== '') {
          formData.append(key, value.toString());
        }
      }
    });
    
    // Add file uploads
    if (stepData.files) {
      Object.keys(stepData.files).forEach(fileKey => {
        if (stepData.files[fileKey]) {
          formData.append(fileKey, stepData.files[fileKey]);
        }
      });
    }
    
    const response = await axios.post('/residence/update-step.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Get step data for editing
   */
  async getStepData(residenceID: number, action: string) {
    const response = await axios.post('/residence/get-step-data.php', {
      residenceID,
      action
    });
    return response.data.data || response.data;
  },

  /**
   * Get charged entity (accounts/suppliers) for a step
   */
  async getChargedEntity(residenceID: number, type: string, handler: string = 'load', chargedON?: number) {
    const response = await axios.post('/residence/get-charged-entity.php', {
      residenceID,
      type,
      handler,
      chargedON
    });
    return response.data.data || response.data;
  },

  /**
   * Get currencies with selected values for a step
   */
  async getCurrencies(type?: string, residenceID?: number) {
    const params: any = {};
    if (type) params.type = type;
    if (residenceID) params.residenceID = residenceID;
    
    const response = await axios.get('/residence/get-currencies.php', { params });
    return response.data.data || response.data;
  },

  /**
   * Cancel residence
   */
  async cancelResidence(residenceID: number, reason: string) {
    const response = await axios.post('/residence/cancel.php', {
      residenceID,
      reason
    });
    return response.data;
  },

  /**
   * Get residence statistics
   */
  async getStats(): Promise<ResidenceStats> {
    const response = await axios.get('/residence/stats.php');
    return response.data.data || response.data;
  },

  /**
   * Update TAWJEEH settings
   */
  async updateTawjeeh(data: TawjeehData) {
    const response = await axios.post('/residence/update-tawjeeh.php', data);
    return response.data;
  },

  /**
   * Update ILOE Insurance settings
   */
  async updateILOE(data: ILOEData) {
    const response = await axios.post('/residence/update-iloe.php', data);
    return response.data;
  },

  /**
   * Make a payment
   */
  async makePayment(payment: ResidencePayment) {
    const response = await axios.post('/residence/payment.php', payment);
    return response.data;
  },

  /**
   * Get payment history for a residence
   */
  async getPaymentHistory(residenceID: number): Promise<PaymentHistory[]> {
    const response = await axios.get('/residence/payment-history.php', {
      params: { residenceID }
    });
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  },

  /**
   * Get family residences list
   */
  async getFamilyResidences(filters: { step?: string; page?: number; limit?: number; search?: string; getAll?: boolean } = {}) {
    const params: any = {};
    // Always pass step parameter, including 'all'
    if (filters.step) {
      params.step = filters.step;
    } else {
      params.step = 'all'; // Default to 'all' if not specified
    }
    if (filters.search) {
      params.search = filters.search;
    }
    
    const response = await axios.get('/residence/family-tasks.php', { params });
    
    console.log('Family residences API response:', response.data);
    
    let families = response.data.families || response.data.data || [];
    
    console.log('Parsed families array:', families.length, 'records');
    
    // If getAll is true, return all records without pagination
    if (filters.getAll) {
      return {
        data: families,
        total: families.length,
        page: 1,
        limit: families.length,
        totalPages: 1
      };
    }
    
    // Apply pagination if needed
    if (filters.page && filters.limit) {
      const startIndex = (filters.page - 1) * filters.limit;
      const endIndex = startIndex + filters.limit;
      const paginatedFamilies = families.slice(startIndex, endIndex);
      const totalPages = Math.ceil(families.length / filters.limit);
      
      return {
        data: paginatedFamilies,
        total: families.length,
        page: filters.page,
        limit: filters.limit,
        totalPages: totalPages
      };
    }
    
    return {
      data: families,
      total: families.length,
      page: 1,
      limit: families.length,
      totalPages: 1
    };
  },

  /**
   * Get payment history for a family residence
   */
  async getFamilyPaymentHistory(familyResidenceID: number): Promise<PaymentHistory[]> {
    const response = await axios.get('/residence/payment-history.php', {
      params: { residenceID: familyResidenceID, type: 'family' }
    });
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  },

  /**
   * Process payment for family residence
   */
  async processFamilyPayment(data: {
    familyResidenceID: number;
    paymentAmount: number;
    accountID: number;
    remarks: string;
  }) {
    const response = await axios.post('/residence/family-payment.php', data);
    return response.data;
  },

  /**
   * Get attachments for a family residence
   */
  async getFamilyAttachments(familyResidenceID: number) {
    const response = await axios.get('/residence/family-attachments.php', {
      params: { residence_id: familyResidenceID }
    });
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  },

  /**
   * Upload attachment for a family residence
   */
  async uploadFamilyAttachment(familyResidenceID: number, documentType: string, file: File) {
    const formData = new FormData();
    formData.append('residence_id', familyResidenceID.toString());
    // Map document_type back to file_type for API compatibility
    const docTypeToFileType: Record<string, string> = {
      'passport': '1',
      'photo': '11',
      'id_front': '12',
      'id_back': '13',
      'other': '14'
    };
    const fileType = docTypeToFileType[documentType] || '14';
    formData.append('file_type', fileType);
    formData.append('file', file);
    
    const response = await axios.post('/residence/upload-family-attachment.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Delete attachment for a family residence
   */
  async deleteFamilyAttachment(attachmentId: number) {
    const response = await axios.delete('/residence/family-attachments.php', {
      params: { id: attachmentId }
    });
    return response.data;
  },

  /**
   * Get dependents (family residences) by main residence ID
   */
  async getDependentsByResidence(residenceID: number) {
    const response = await axios.get('/residence/family-tasks.php', {
      params: { step: 'all', main_residence_id: residenceID }
    });
    return response.data.families || response.data.data || [];
  },

  /**
   * Get financial breakdown for a residence
   */
  async getFinancialBreakdown(residenceID: number): Promise<FinancialBreakdown> {
    const response = await axios.get('/residence/financial-breakdown.php', {
      params: { residenceID }
    });
    return response.data.data || response.data;
  },

  /**
   * Get unified outstanding breakdown for unified payment
   */
  async getUnifiedOutstanding(residenceID: number) {
    const response = await axios.get('/residence/unified-payment.php', {
      params: { residenceID }
    });
    return response.data.data || response.data;
  },

  /**
   * Process unified payment
   */
  async processUnifiedPayment(data: {
    residenceID: number;
    paymentAmount: number;
    accountID: number;
    remarks: string;
  }) {
    const response = await axios.post('/residence/unified-payment.php', data);
    return response.data;
  },

  /**
   * Get attachments for a residence
   */
  async getAttachments(residenceID: number) {
    const response = await axios.get('/residence/attachments.php', {
      params: { residenceID }
    });
    console.log('getAttachments response:', response.data);
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    console.warn('Unexpected response format:', response.data);
    return [];
  },

  /**
   * Upload attachment
   */
  async uploadAttachment(residenceID: number, stepNumber: number, file: File, fileType?: number) {
    const formData = new FormData();
    formData.append('residenceID', residenceID.toString());
    formData.append('stepNumber', stepNumber.toString());
    formData.append('file', file);
    
    // For step 0 (Initial Documents), include fileType if provided
    if (stepNumber === 0 && fileType) {
      formData.append('fileType', fileType.toString());
    }

    try {
      console.log('Uploading file:', {
        residenceID,
        stepNumber,
        fileType,
        fileName: file.name,
        fileSize: file.size,
        fileType_mime: file.type
      });

      const response = await axios.post('/residence/upload-attachment.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000, // 60 second timeout for large files
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${percentCompleted}%`);
          }
        }
      });
      
      console.log('Upload API response status:', response.status);
      console.log('Upload API response data:', response.data);
      console.log('Upload API response headers:', response.headers);
      
      // Handle different response formats
      // JWTHelper::sendResponse returns: { success: true, message: '...', data: {...} }
      // But sendResponse merges arrays, so data might be at root level
      const responseData = response.data;
      
      if (!responseData) {
        throw new Error('No response data from server');
      }
      
      // Check if success property exists
      console.log('Checking response data:', {
        hasSuccess: 'success' in responseData,
        successValue: responseData.success,
        successType: typeof responseData.success,
        successStrictEqual: responseData.success === true,
        status: response.status
      });
      
      if (responseData.success === true || responseData.success === 'true' || (response.status === 200 && responseData.success !== false)) {
        console.log('Upload successful, returning response data');
        // Ensure we return an object with success: true
        return {
          success: true,
          message: responseData.message || 'Upload successful',
          ...responseData
        };
      } else if (responseData.success === false || responseData.success === 'false') {
        throw new Error(responseData.message || 'Upload failed');
      } else {
        // Response exists but success property is missing or unexpected
        // If we got a 200 status, assume success
        console.warn('Response format unexpected, but status is 200. Assuming success.');
        if (response.status === 200) {
          return { success: true, message: 'Upload successful', ...responseData };
        } else {
          throw new Error('Unexpected response format: ' + JSON.stringify(responseData));
        }
      }
    } catch (error: any) {
      console.error('Upload service error:', error);
      console.error('Upload error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        config: error.config
      });
      
      // Re-throw with better error message
      if (error.response) {
        // Server responded with error
        const errorMsg = error.response.data?.message || 
                        error.response.data?.error || 
                        `Server error: ${error.response.status} ${error.response.statusText}`;
        throw new Error(errorMsg);
      } else if (error.request) {
        // Request made but no response
        throw new Error('No response from server. Check network connection.');
      } else {
        // Error setting up request
        throw new Error(error.message || 'Failed to upload file');
      }
    }
  },

  /**
   * Delete attachment
   */
  async deleteAttachment(attachmentId: number) {
    const response = await axios.post('/residence/delete-attachment.php', {
      attachmentId
    });
    return response.data;
  },

  /**
   * Get banks list
   */
  async getBanks() {
    const response = await axios.get('/residence/get-banks.php');
    return response.data.data || [];
  },

  /**
   * Generate letter (NOC or Salary Certificate)
   */
  async generateLetter(residenceID: number, type: 'noc' | 'salary_certificate', bankId?: number, extraParams?: string) {
    const params: any = { id: residenceID, type };
    if (type === 'salary_certificate' && bankId) {
      params.bank_id = bankId;
    }
    
    // Build URL with extra params if provided
    let url = '/residence/generate-letter.php';
    if (extraParams) {
      const queryParams = new URLSearchParams(params as any);
      const extraQueryParams = new URLSearchParams(extraParams);
      extraQueryParams.forEach((value, key) => {
        queryParams.append(key, value);
      });
      url += '?' + queryParams.toString();
      const response = await axios.get(url);
      return response.data;
    }
    
    const response = await axios.get(url, { params });
    // Response structure: {success: true, message: '...', title: '...', content: '...', html: '...'}
    // Data is merged directly into response, not nested under 'data'
    return response.data;
  },

  /**
   * Generate NOC document
   */
  async generateNOC(residenceID: number) {
    const response = await axios.post('/residence/generate-noc.php', {
      residenceID
    });
    return response.data;
  },

  /**
   * Generate Salary Certificate
   */
  async generateSalaryCertificate(residenceID: number) {
    const response = await axios.post('/residence/generate-salary-certificate.php', {
      residenceID
    });
    return response.data;
  },

  /**
   * Add/Update ILOE Fine
   */
  async updateILOEFine(residenceID: number, fineAmount: number, remarks: string) {
    const response = await axios.post('/residence/update-iloe-fine.php', {
      residenceID,
      fineAmount,
      remarks
    });
    return response.data;
  },

  /**
   * Delete ILOE Fine
   */
  async deleteILOEFine(residenceID: number) {
    const response = await axios.post('/residence/delete-iloe-fine.php', {
      residenceID
    });
    return response.data;
  },

  /**
   * Process cancellation fee payment
   */
  async payCancellationFee(residenceID: number, paymentData: any) {
    const response = await axios.post('/residence/pay-cancellation-fee.php', {
      residenceID,
      ...paymentData
    });
    return response.data;
  },

  /**
   * Process credit adjustment
   */
  async processCreditAdjustment(residenceID: number, adjustmentData: any) {
    const response = await axios.post('/residence/credit-adjustment.php', {
      residenceID,
      ...adjustmentData
    });
    return response.data;
  },

  /**
   * Get residence fines
   */
  async getFines(residenceID: number) {
    const response = await axios.get('/residence/get-fines.php', {
      params: { residenceID }
    });
    // Handle both wrapped and unwrapped responses
    const data = response.data.data || response.data;
    return {
      fines: data.fines || data,
      outstandingBalance: data.outstandingBalance || 0,
      totalFine: data.totalFine || 0,
      totalFinePaid: data.totalFinePaid || 0
    };
  },

  /**
   * Add residence fine
   */
  async addFine(data: { residenceID: number; fineAmount: number; accountID: number; currencyID?: number }) {
    const response = await axios.post('/residence/add-fine.php', data);
    return response.data;
  },

  /**
   * Update residence fine
   */
  async updateFine(data: { residenceFineID: number; fineAmount: number; accountID: number; currencyID?: number }) {
    const response = await axios.post('/residence/update-fine.php', data);
    return response.data;
  },

  /**
   * Delete residence fine
   */
  async deleteFine(residenceFineID: number) {
    const response = await axios.post('/residence/delete-fine.php', { residenceFineID });
    return response.data;
  },

  /**
   * Get custom charges
   */
  async getCustomCharges(residenceID: number) {
    const response = await axios.get('/residence/get-custom-charges.php', {
      params: { residenceID }
    });
    return response.data.data || response.data;
  },

  /**
   * Add custom charge
   */
  async addCustomCharge(data: { residenceID: number; chargeTitle: string; netCost: number; salePrice: number; accountID: number; remarks?: string }) {
    const response = await axios.post('/residence/add-custom-charge.php', data);
    return response.data;
  },

  /**
   * Delete custom charge
   */
  async deleteCustomCharge(chargeID: number) {
    const response = await axios.post('/residence/delete-custom-charge.php', {
      chargeID
    });
    return response.data;
  },

  /**
   * Perform Tawjeeh operation
   */
  async performTawjeeh(data: { residenceID: number; cost: number; accountID: number; notes?: string; uid?: string; labourCard?: string }) {
    const response = await axios.post('/residence/perform-tawjeeh.php', data);
    return response.data;
  },

  /**
   * Issue Insurance operation
   */
  async issueInsurance(data: { residenceID: number; cost: number; accountID: number; notes?: string; uid?: string; labourCard?: string; passport?: string; attachment?: File }) {
    const formData = new FormData();
    formData.append('residenceID', data.residenceID.toString());
    formData.append('cost', data.cost.toString());
    formData.append('accountID', data.accountID.toString());
    if (data.notes) formData.append('notes', data.notes);
    if (data.uid) formData.append('uid', data.uid);
    if (data.labourCard) formData.append('labourCard', data.labourCard);
    if (data.passport) formData.append('passport', data.passport);
    if (data.attachment) formData.append('attachment', data.attachment);

    const response = await axios.post('/residence/issue-insurance.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Get residence tasks (filtered by step)
   */
  async getTasks(params: { step: string; company_id?: string; search?: string }) {
    try {
      const response = await axios.get('/residence/tasks.php', { params });
      console.log('getTasks response:', response);
      console.log('getTasks response.data:', response.data);
      console.log('getTasks response.data.success:', response.data?.success);
      console.log('getTasks response.data.residences:', response.data?.residences);
      console.log('getTasks response.data.stepCounts:', response.data?.stepCounts);
      
      // JWTHelper merges data directly: { success: true, message: '...', residences: [], stepCounts: {} }
      if (response.data) {
        // Check if success is false - this means an error
        if (response.data.success === false) {
          console.error('API returned error:', response.data.message);
          throw new Error(response.data.message || 'Failed to load tasks');
        }
        
        // Data is merged directly into response.data
        const result = {
          residences: Array.isArray(response.data.residences) ? response.data.residences : [],
          stepCounts: response.data.stepCounts || {}
        };
        console.log('getTasks returning:', result);
        return result;
      }
      
      // Default empty response
      console.log('No data in response, returning empty');
      return { residences: [], stepCounts: {} };
    } catch (error: any) {
      console.error('getTasks error:', error);
      console.error('getTasks error.response:', error.response);
      throw error;
    }
  },

  /**
   * Get companies for tasks
   */
  async getCompanies() {
    console.log('residenceService.getCompanies - Making request to /residence/get-companies.php');
    const response = await axios.get('/residence/get-companies.php');
    console.log('residenceService.getCompanies - Response:', response);
    console.log('residenceService.getCompanies - Response.data:', response.data);
    console.log('residenceService.getCompanies - Response.data.data:', response.data.data);
    let result = response.data.data || response.data;
    
    // Convert object with numeric keys to array if needed
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      result = Object.values(result);
    }
    
    console.log('residenceService.getCompanies - Returning:', result);
    return result;
  },

  /**
   * Set offer letter status (accept/reject)
   */
  async setOfferLetterStatus(residenceID: number, status: string) {
    console.log('setOfferLetterStatus called:', { residenceID, status });
    try {
      const formData = new URLSearchParams();
      formData.append('action', 'setOfferLetterStatus');
      formData.append('id', residenceID.toString());
      formData.append('value', status);
      
      const response = await axios.post('/residence/tasks-controller.php', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      console.log('setOfferLetterStatus response:', response);
      console.log('setOfferLetterStatus response.data:', response.data);
      
      // Check if API returned an error
      if (response.data && response.data.success === false) {
        throw new Error(response.data.message || 'Failed to update offer letter status');
      }
      
      return response.data;
    } catch (error: any) {
      console.error('setOfferLetterStatus error:', error);
      if (error.response) {
        console.error('Error response data:', error.response.data);
      }
      throw error;
    }
  },

  /**
   * Set eVisa status (accept/reject)
   */
  async setEVisaStatus(residenceID: number, status: string) {
    const formData = new URLSearchParams();
    formData.append('action', 'seteVisaStatus');
    formData.append('id', residenceID.toString());
    formData.append('value', status);
    
    const response = await axios.post('/residence/tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  },

  /**
   * Set hold status
   */
  async setHold(residenceID: number, hold: boolean) {
    const formData = new URLSearchParams();
    formData.append('action', 'setHold');
    formData.append('id', residenceID.toString());
    formData.append('value', hold ? '1' : '0');
    
    const response = await axios.post('/residence/tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  },

  /**
   * Check document verification with MOHRE
   */
  async checkDocument(residenceID: number, documentNumber: string, passportNumber: string, nationality: string) {
    const response = await axios.post('/residence/tasks-controller.php', {
      action: 'checkDocument',
      id: residenceID,
      documentNumber,
      passportNumber,
      nationality
    });
    return response.data.data || response.data;
  },

  /**
   * Move residence to specific step
   */
  async moveResidenceToStep(residenceID: number, targetStep: string) {
    const formData = new URLSearchParams();
    formData.append('action', 'moveResidenceToStep');
    formData.append('residenceId', residenceID.toString());
    formData.append('targetStep', targetStep);
    
    const response = await axios.post('/residence/tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  },

  /**
   * Get remarks history for residence
   */
  async getRemarksHistory(residenceID: number) {
    const response = await axios.post('/residence/tasks-controller.php', {
      action: 'getRemarksHistory',
      residence_id: residenceID
    });
    return response.data.history || [];
  },

  /**
   * Add or update remarks
   */
  async addRemarks(residenceID: number, remarks: string, step: string) {
    const response = await axios.post('/residence/tasks-controller.php', {
      action: 'addRemarks',
      residence_id: residenceID,
      remarks,
      step
    });
    return response.data;
  },

  /**
   * Process eVisa rejection with refund
   */
  async processEVisaRejection(residenceID: number, refundAmount: number, refundAccount: number) {
    const response = await axios.post('/residence/tasks-controller.php', {
      action: 'seteVisaRejected',
      id: residenceID,
      refundAmount,
      refundAccount
    });
    return response.data;
  },

  /**
   * Get residence payment report (customers with pending amounts)
   */
  async getResidencePaymentReport(customerId: number | null, currencyId: number) {
    const params: any = { currency_id: currencyId };
    if (customerId) {
      params.customer_id = customerId;
    }
    const response = await axios.get('/residence/residence-payment-report.php', { params });
    return response.data.data || [];
  },

  /**
   * Get currencies for a customer (or all currencies)
   */
  async getCustomerCurrencies(customerId: number | null) {
    const params: any = {};
    if (customerId) {
      params.customer_id = customerId;
    }
    const response = await axios.get('/residence/customer-currencies.php', { params });
    return response.data.data || [];
  },

  /**
   * Get family residence tasks (filtered by step)
   */
  async getFamilyTasks(params: { step: string; company_id?: string; search?: string }) {
    try {
      const queryParams: any = { step: params.step };
      if (params.company_id) queryParams.company_id = params.company_id;
      if (params.search) queryParams.search = params.search;
      
      const response = await axios.get('/residence/family-tasks.php', { params: queryParams });
      
      // Handle response format
      if (response.data) {
        if (response.data.success === false) {
          throw new Error(response.data.message || 'Failed to load family tasks');
        }
        
        return {
          families: Array.isArray(response.data.families) ? response.data.families : [],
          stepCounts: response.data.stepCounts || {}
        };
      }
      
      return { families: [], stepCounts: {} };
    } catch (error: any) {
      console.error('getFamilyTasks error:', error);
      throw error;
    }
  },

  /**
   * Move family residence to specific step
   */
  async moveFamilyToStep(familyResidenceID: number, targetStep: string) {
    const formData = new URLSearchParams();
    formData.append('action', 'moveFamilyToStep');
    formData.append('familyResidenceId', familyResidenceID.toString());
    formData.append('targetStep', targetStep);
    
    const response = await axios.post('/residence/family-tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    return response.data;
  },

  /**
   * Get family residence attachments
   */
  async getFamilyAttachments(familyResidenceID: number) {
    const response = await axios.get('/residence/family-attachments.php', {
      params: { residence_id: familyResidenceID }
    });
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (response.data.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  },

  /**
   * Upload family residence attachment
   */
  async uploadFamilyAttachment(familyResidenceID: number, stepNumber: number, file: File, fileType?: number) {
    const formData = new FormData();
    formData.append('residence_id', familyResidenceID.toString());
    formData.append('stepNumber', stepNumber.toString());
    formData.append('file', file);
    
    if (fileType) {
      formData.append('fileType', fileType.toString());
    }

    const response = await axios.post('/residence/upload-family-attachment.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 60000
    });
    
    if (response.data.success === false) {
      throw new Error(response.data.message || 'Upload failed');
    }
    
    return response.data;
  },

  /**
   * Delete family residence attachment
   */
  async deleteFamilyAttachment(attachmentId: number) {
    const response = await axios.delete('/residence/family-attachments.php', {
      params: { id: attachmentId }
    });
    return response.data;
  },

  /**
   * Add new family residence
   */
  async addFamilyResidence(data: {
    customer_id: number;
    residence_id?: number;
    passenger_name: string;
    passport_number: string;
    passport_expiry?: string;
    date_of_birth?: string;
    gender?: string;
    nationality: number;
    relation_type: string;
    inside_outside: string;
    sale_price: number;
    sale_currency: string;
    remarks?: string;
    documents?: {
      passport_doc?: File | null;
      photo_doc?: File | null;
      id_front_doc?: File | null;
      id_back_doc?: File | null;
      birth_certificate_doc?: File | null;
      marriage_certificate_doc?: File | null;
      other_doc?: File | null;
    };
  }) {
    const formData = new FormData();
    formData.append('action', 'addFamilyResidence');
    formData.append('customer_id', data.customer_id.toString());
    if (data.residence_id) formData.append('residence_id', data.residence_id.toString());
    formData.append('passenger_name', data.passenger_name);
    formData.append('passport_number', data.passport_number);
    if (data.passport_expiry) formData.append('passport_expiry', data.passport_expiry);
    if (data.date_of_birth) formData.append('date_of_birth', data.date_of_birth);
    if (data.gender) formData.append('gender', data.gender);
    formData.append('nationality', data.nationality.toString());
    formData.append('relation_type', data.relation_type);
    formData.append('inside_outside', data.inside_outside);
    formData.append('sale_price', data.sale_price.toString());
    formData.append('sale_currency', data.sale_currency);
    if (data.remarks) formData.append('remarks', data.remarks);
    
    // Add document files
    if (data.documents) {
      if (data.documents.passport_doc) formData.append('passport_doc', data.documents.passport_doc);
      if (data.documents.photo_doc) formData.append('photo_doc', data.documents.photo_doc);
      if (data.documents.id_front_doc) formData.append('id_front_doc', data.documents.id_front_doc);
      if (data.documents.id_back_doc) formData.append('id_back_doc', data.documents.id_back_doc);
      if (data.documents.birth_certificate_doc) formData.append('birth_certificate_doc', data.documents.birth_certificate_doc);
      if (data.documents.marriage_certificate_doc) formData.append('marriage_certificate_doc', data.documents.marriage_certificate_doc);
      if (data.documents.other_doc) formData.append('other_doc', data.documents.other_doc);
    }

    const response = await axios.post('/residence/family-tasks-controller.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  }
};

export default residenceService;
