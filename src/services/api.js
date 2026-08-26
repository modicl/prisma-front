/**
 * API Service - Axios Instance
 * Configuración centralizada para todas las llamadas HTTP
 * Ahora apunta al BFF (prisma-bff) en :3010
 */

import axios from 'axios';
import storageUtils from '../utils/localStorage';
import { getAuthToken } from './cognitoAuth';
import { handleAuthFailure } from './authSession';

const api = axios.create({
  baseURL: import.meta.env.VITE_BFF_URL ?? 'http://localhost:3010',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token en cada request
api.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const errorResponse = error.response?.data;
    const requestUrl = originalRequest?.url || '';

    if (error.response?.status === 401) {
      handleAuthFailure(errorResponse, requestUrl);
    }

    return Promise.reject(error);
  }
);

export default api;
