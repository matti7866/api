import apiClient from './api';
import type { TodayStats, DailyEntry, Event, DashboardFilters } from '../types/dashboard';
import logger from '../utils/logger';

export const dashboardService = {
  // Get today's statistics
  getTodayStats: async (): Promise<TodayStats> => {
    const response = await apiClient.get('/dashboard/todayStats.php');
    logger.debug('Raw API response:', response.data);
    
    // Check for error
    if (response.data.success === false) {
      throw new Error(response.data.message || 'Failed to fetch statistics');
    }
    
    // The API merges data directly into response when it's an array
    // So we need to extract the stats fields from the response
    const { success, message, ...stats } = response.data;
    
    logger.debug('Extracted stats:', stats);
    return stats as TodayStats;
  },

  // Get daily entries report
  getDailyEntries: async (filters: DashboardFilters): Promise<DailyEntry[]> => {
    logger.debug('Fetching daily entries with filters:', filters);
    const response = await apiClient.get('/dashboard/dailyEntries.php', {
      params: filters
    });
    logger.debug('Daily entries API response:', response.data);
    
    // Check for error
    if (response.data.success === false) {
      throw new Error(response.data.message || 'Failed to fetch daily entries');
    }
    
    let entries: DailyEntry[] = [];
    
    // For arrays, JWTHelper doesn't merge them in - they're in data property
    if (response.data.data) {
      // Convert object with numeric keys to array
      if (Array.isArray(response.data.data)) {
        entries = response.data.data;
      } else if (typeof response.data.data === 'object') {
        // PHP might return {0: {...}, 1: {...}} instead of [{...}, {...}]
        entries = Object.values(response.data.data);
      }
    }
    // Check if response.data itself is an array or object with numeric keys
    else if (Array.isArray(response.data)) {
      entries = response.data;
    } else if (typeof response.data === 'object' && !response.data.success) {
      // If it's an object without success property, it might be {0: {...}, 1: {...}}
      entries = Object.values(response.data);
    }
    
    logger.debug(`Extracted ${entries.length} daily entries`);
    return entries;
  },

  // Get events
  getEvents: async (): Promise<Event[]> => {
    // This can be implemented when we add events API
    return [];
  }
};

export default dashboardService;

