import apiClient from './api';
import type {
  Hotel,
  HotelFilters,
  CreateHotelRequest,
  HotelDropdownData
} from '../types/hotel';

const hotelService = {
  // Get hotels with filters
  getHotels: async (filters?: HotelFilters): Promise<Hotel[]> => {
    const data: any = {
      action: 'searchHotels',
      search_by_date: filters?.search_by_date ? '1' : '0'
    };
    
    if (filters?.customer) data.customer = filters.customer.toString();
    if (filters?.start_date) data.start_date = filters.start_date;
    if (filters?.end_date) data.end_date = filters.end_date;
    
    const response = await apiClient.post('/hotel/hotels.php', data);
    console.log('Hotels response:', response.data);
    
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return Array.isArray(response.data.data) ? response.data.data : [];
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return [];
  },

  // Get single hotel
  getHotel: async (id: number): Promise<Hotel> => {
    const response = await apiClient.post('/hotel/hotels.php', { action: 'getHotel', id });
    return response.data.data;
  },

  // Create hotel
  createHotel: async (data: CreateHotelRequest): Promise<void> => {
    await apiClient.post('/hotel/hotels.php', { action: 'addHotel', ...data });
  },

  // Update hotel
  updateHotel: async (id: number, data: Partial<CreateHotelRequest>): Promise<void> => {
    await apiClient.post('/hotel/hotels.php', { action: 'updateHotel', id, ...data });
  },

  // Delete hotel
  deleteHotel: async (id: number): Promise<void> => {
    await apiClient.post('/hotel/hotels.php', { action: 'deleteHotel', id });
  },

  // Get dropdowns
  getDropdowns: async (): Promise<HotelDropdownData> => {
    const response = await apiClient.get('/hotel/dropdowns.php');
    console.log('Hotel dropdowns response:', response.data);
    
    // Handle different response formats
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return response.data;
  }
};

export default hotelService;

