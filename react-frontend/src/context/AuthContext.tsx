import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { AuthState, LoginCredentials } from '../types';
import authService from '../services/authService';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = authService.getToken();
        const storedUser = authService.getStoredUser();

        if (token && storedUser) {
          // Trust the stored token initially
          // Token will be validated on first API call
          setAuthState({
            user: storedUser,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setAuthState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setAuthState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await authService.login(credentials);

      if (response.success && response.token && response.user) {
        setAuthState({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
          isLoading: false,
        });
      }

      return {
        success: response.success,
        message: response.message || (response.success ? 'Login successful' : 'Login failed'),
      };
    } catch (error) {
      return {
        success: false,
        message: 'An error occurred during login',
      };
    }
  };

  const logout = async (): Promise<void> => {
    await authService.logout();
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const user = await authService.getCurrentUser();
      if (user) {
        setAuthState(prev => ({
          ...prev,
          user,
        }));
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;

