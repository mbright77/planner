const defaultApiBaseUrl = 'http://localhost:5254';
const defaultAppBasePath = '/';

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl,
  appBasePath: import.meta.env.VITE_APP_BASE_PATH ?? defaultAppBasePath,
};
