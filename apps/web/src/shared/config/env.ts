const defaultApiBaseUrl = 'http://localhost:5254';

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl,
};
