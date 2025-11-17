import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import config from '../utils/config';
import storage from '../utils/storage';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 30000,
  withCredentials: true, // Send cookies for session-based auth
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  (requestConfig: InternalAxiosRequestConfig) => {
    const token = storage.get<string>(config.tokenKey);
    if (token && requestConfig.headers) {
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // Check if it's actually a success response with non-2xx status code
      // Some APIs return {status: 'success'} with 400 status code
      const isActuallySuccess = error.response.data?.status === 'success';
      
      if (isActuallySuccess) {
        // Don't treat it as an error, just log it
        console.log('API returned success with non-2xx status:', error.response.status);
        return Promise.resolve(error.response);
      }
      
      // Server responded with error status
      switch (error.response.status) {
        case 401:
          // Unauthorized - only redirect if not a token verification request
          const isVerifyRequest = error.config?.url?.includes('/auth/verify.php') || 
                                  error.config?.url?.includes('/auth/me.php');
          
          if (!isVerifyRequest) {
            // Clear auth data and redirect to login
            storage.remove(config.tokenKey);
            storage.remove(config.userKey);
            
            // Only redirect if not already on login page
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login';
            }
          }
          break;
        case 403:
          console.error('Access forbidden');
          break;
        case 404:
          console.error('Resource not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          // Only log if it's actually an error
          if (!isActuallySuccess) {
            console.error('An error occurred:', error.response.data);
          }
      }
    } else if (error.request) {
      // Request made but no response
      console.error('Network error - no response received');
    } else {
      // Error setting up request
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// API Service Class
class ApiService {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await apiClient.delete<T>(url, config);
    return response.data;
  }
}

export const api = new ApiService();
export default apiClient;

