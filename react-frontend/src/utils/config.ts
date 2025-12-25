// Application Configuration
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://app.sntrips.com/api',
  baseUrl: import.meta.env.VITE_BASE_URL || 'https://app.sntrips.com',
  appName: import.meta.env.VITE_APP_NAME || 'Selab Nadiry',
  appVersion: import.meta.env.VITE_APP_VERSION || '2.0.0',
  tokenKey: 'snt_auth_token',
  userKey: 'snt_user_data',
};

export default config;














