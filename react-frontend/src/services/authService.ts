import { api } from './api';
import type { LoginCredentials, LoginResponse, User } from '../types';
import storage from '../utils/storage';
import config from '../utils/config';

class AuthService {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      // Check if it's OTP login (password is actually OTP)
      if (credentials.password && credentials.password.length === 6 && /^\d+$/.test(credentials.password)) {
        // OTP login
        const response = await api.post<LoginResponse>('/auth/verify-otp.php', {
          email: credentials.username,
          otp: credentials.password
        });
        
        if (response.success && response.token && response.user) {
          storage.set(config.tokenKey, response.token);
          storage.set(config.userKey, response.user);
        }
        
        return response;
      } else {
        // Regular password login (fallback)
        const response = await api.post<LoginResponse>('/auth/login.php', credentials);
        
        if (response.success && response.token && response.user) {
          storage.set(config.tokenKey, response.token);
          storage.set(config.userKey, response.user);
        }
        
        return response;
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed',
      };
    }
  }
  
  async sendOTP(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post<{ success: boolean; message: string }>('/auth/send-otp.php', {
        email
      });
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send OTP',
      };
    }
  }
  
  async verifyOTP(email: string, otp: string): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/auth/verify-otp.php', {
        email,
        otp
      });
      
      if (response.success && response.token && response.user) {
        storage.set(config.tokenKey, response.token);
        storage.set(config.userKey, response.user);
      }
      
      return response;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'OTP verification failed',
      };
    }
  }

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout.php');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API response
      storage.remove(config.tokenKey);
      storage.remove(config.userKey);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    try {
      const user = storage.get<User>(config.userKey);
      if (!user) return null;

      // Optionally verify token with backend
      const response = await api.get<{ success: boolean; user: User }>('/auth/me.php');
      if (response.success && response.user) {
        storage.set(config.userKey, response.user);
        return response.user;
      }
      
      return user;
    } catch (error) {
      console.error('Get current user error:', error);
      this.clearAuth();
      return null;
    }
  }

  async verifyToken(): Promise<boolean> {
    try {
      const token = storage.get<string>(config.tokenKey);
      if (!token) return false;

      const response = await api.get<{ success: boolean }>('/auth/verify.php');
      return response.success;
    } catch (error) {
      return false;
    }
  }

  getToken(): string | null {
    return storage.get<string>(config.tokenKey);
  }

  getStoredUser(): User | null {
    return storage.get<User>(config.userKey);
  }

  clearAuth(): void {
    storage.remove(config.tokenKey);
    storage.remove(config.userKey);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();
export default authService;

