import axios from 'axios';
import { sessionExpired, errorMessage } from './errors.js';

const api = axios.create({
  baseURL: '/api',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' }
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('ssh_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (sessionExpired(err)) {
      sessionStorage.removeItem('ssh_token');
      sessionStorage.removeItem('ssh_user');
      window.location.href = '/login';
    }
    if (!err.response || err.response.status >= 500) {
      err.response = { ...err.response, data: { message: errorMessage(err) }, status: err.response?.status };
    }
    return Promise.reject(err);
  }
);

export default api;
