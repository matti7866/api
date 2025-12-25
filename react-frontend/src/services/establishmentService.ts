import axios from './api';

export interface Establishment {
  company_id: number;
  company_name: string;
  company_type: string;
  company_number: string;
  company_expiry: string;
  starting_quota: number;
  local_name: string;
  totalEmployees: number;
}

export interface EstablishmentStatistics {
  totalEstablishments: number;
  totalEmployees: number;
  totalQuota: number;
  availableQuota: number;
}

export interface EstablishmentFilters {
  companyName?: string;
  companyType?: string;
  localName?: string;
  page?: number;
  limit?: number;
}

export interface EstablishmentResponse {
  data: Establishment[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    recordsPerPage: number;
  };
  statistics: EstablishmentStatistics;
  localNames: Array<{ local_name: string }>;
}

export const establishmentService = {
  async getEstablishments(filters: EstablishmentFilters = {}): Promise<EstablishmentResponse> {
    const formData = new FormData();
    
    if (filters.companyName) {
      formData.append('companyName', filters.companyName);
    }
    if (filters.companyType) {
      formData.append('companyType', filters.companyType);
    }
    if (filters.localName) {
      formData.append('localName', filters.localName);
    }
    formData.append('page', (filters.page || 1).toString());
    formData.append('limit', (filters.limit || 10).toString());
    
    const response = await axios.post('/establishments/get-establishments.php', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    console.log('Raw API Response:', response.data);
    
    // Handle JWTHelper response format: 
    // The API returns: { success: true, message: "...", data: [...], pagination: {...}, statistics: {...}, localNames: [...] }
    // So response.data.data is the array, and response.data.pagination/statistics/localNames are at the same level
    
    if (response.data.success) {
      // Check if data is an array (direct structure at response.data level)
      if (Array.isArray(response.data.data)) {
        // Structure: { success: true, data: [...], pagination: {...}, statistics: {...}, localNames: [...] }
        return {
          data: response.data.data,
          pagination: response.data.pagination || { 
            currentPage: 1, 
            totalPages: 1, 
            totalRecords: response.data.data.length, 
            recordsPerPage: 10 
          },
          statistics: response.data.statistics || { 
            totalEstablishments: 0, 
            totalEmployees: 0, 
            totalQuota: 0, 
            availableQuota: 0 
          },
          localNames: response.data.localNames || []
        };
      } else if (response.data.data && typeof response.data.data === 'object' && !Array.isArray(response.data.data)) {
        // Nested structure: { success: true, data: { data: [...], pagination: {...}, statistics: {...}, localNames: [...] } }
        return response.data.data;
      }
    }
    
    throw new Error(response.data.message || 'Failed to fetch establishments');
  }
};

export default establishmentService;

