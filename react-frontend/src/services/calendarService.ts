import apiClient from './api';
import type { Cheque, Flight, CustomEvent } from '../types/calendar';
import logger from '../utils/logger';

export const calendarService = {
  // Get upcoming cheques
  getCheques: async (): Promise<Cheque[]> => {
    const response = await apiClient.get('/calendar/cheques.php');
    logger.debug('Cheques API response:', response.data);
    
    if (response.data.success === false) {
      throw new Error(response.data.message || 'Failed to fetch cheques');
    }
    
    if (response.data.cheques && Array.isArray(response.data.cheques)) {
      return response.data.cheques;
    }
    
    return [];
  },

  // Get upcoming flights
  getFlights: async (): Promise<Flight[]> => {
    const response = await apiClient.get('/calendar/flights.php');
    logger.debug('Flights API response:', response.data);
    
    if (response.data.success === false) {
      throw new Error(response.data.message || 'Failed to fetch flights');
    }
    
    if (response.data.flights && Array.isArray(response.data.flights)) {
      return response.data.flights;
    }
    
    return [];
  },

  // Get custom calendar events
  getCustomEvents: async (): Promise<CustomEvent[]> => {
    const response = await apiClient.get('/calendar/events.php');
    logger.debug('Custom events API response:', response.data);
    
    if (response.data.success === false) {
      throw new Error(response.data.message || 'Failed to fetch custom events');
    }
    
    if (response.data.events && Array.isArray(response.data.events)) {
      return response.data.events;
    }
    
    return [];
  },
};














