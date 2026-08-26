import axios from 'axios';
import storageUtils from '../utils/localStorage';
import { getAuthToken } from './cognitoAuth';
import { handleAuthFailure } from './authSession';

const BFF_BASE_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3010';

const createBffApi = () => {
  const bffApi = axios.create({
    baseURL: BFF_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  bffApi.interceptors?.request?.use?.(async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  bffApi.interceptors?.response?.use?.(
    (response) => response,
    (error) => {
      const originalRequest = error.config;
      const errorResponse = error.response?.data;
      const requestUrl = originalRequest?.url || '';
      if (error.response?.status === 401) {
        handleAuthFailure(errorResponse, requestUrl);
      }
      return Promise.reject(error);
    }
  );

  return bffApi;
};

const getMessage = (error, fallback) => error.response?.data?.message || fallback;

const bffApi = {
  // Auth
  login: async (email, password) => {
    try {
      const api = createBffApi();
      const response = await api.post('/api/auth/login', { email, password });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al iniciar sesión'));
    }
  },

  register: async (data) => {
    try {
      const api = createBffApi();
      const response = await api.post('/api/auth/register', data);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al registrar usuario'));
    }
  },

  logout: async () => {
    try {
      const api = createBffApi();
      await api.post('/api/auth/logout');
    } catch (error) {
      // Logout errors are non-critical
    }
  },

  getCurrentUser: async () => {
    try {
      const api = createBffApi();
      const response = await api.get('/api/auth/me');
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener usuario'));
    }
  },

  updateProfile: async (data) => {
    try {
      const api = createBffApi();
      const response = await api.patch('/api/auth/me', data);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al actualizar perfil'));
    }
  },

  // Colegios
  getColegios: async (params) => {
    try {
      const api = createBffApi();
      const url = new URL(`${BFF_BASE_URL}/api/colegios`, window.location.origin);
      if (params?.page) url.searchParams.set('page', params.page);
      if (params?.limit) url.searchParams.set('limit', params.limit);
      if (params?.activo !== undefined) url.searchParams.set('activo', params.activo);
      if (params?.plan) url.searchParams.set('plan', params.plan);
      const response = await api.get(url.pathname + url.search);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener colegios'));
    }
  },

  getColegioById: async (id) => {
    try {
      const api = createBffApi();
      const response = await api.get(`/api/colegios/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener colegio'));
    }
  },

  createColegio: async (payload) => {
    try {
      const api = createBffApi();
      const response = await api.post('/api/colegios', payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al crear colegio'));
    }
  },

  updateColegio: async (id, payload) => {
    try {
      const api = createBffApi();
      const response = await api.patch(`/api/colegios/${id}`, payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al actualizar colegio'));
    }
  },

  deactivateColegio: async (id) => {
    try {
      const api = createBffApi();
      const response = await api.delete(`/api/colegios/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al desactivar colegio'));
    }
  },

  getColegioStats: async (id) => {
    try {
      const api = createBffApi();
      const response = await api.get(`/api/colegios/${id}/stats`);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener estadísticas'));
    }
  },

  getColegioProfessors: async (id, params) => {
    try {
      const api = createBffApi();
      const response = await api.get(`/api/colegios/${id}/professors`, { params });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener profesores'));
    }
  },

  getColegioAdmins: async (id) => {
    try {
      const api = createBffApi();
      const response = await api.get(`/api/colegios/${id}/admins`);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener admins del colegio'));
    }
  },

  setUserActive: async (userId, active) => {
    try {
      const api = createBffApi();
      const response = await api.patch(`/api/admin/users/${userId}/active`, { active });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, active ? 'Error al activar usuario' : 'Error al desactivar usuario'));
    }
  },

  resetUserPassword: async (userId, newPassword) => {
    try {
      const api = createBffApi();
      const response = await api.post(`/api/admin/users/${userId}/reset-password`, {
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al resetear password'));
    }
  },

  // Professors
  getProfessors: async (params) => {
    try {
      const api = createBffApi();
      const response = await api.get('/api/professors', { params });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener profesores'));
    }
  },

  createProfessor: async (data) => {
    try {
      const api = createBffApi();
      const response = await api.post('/api/professors', data);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al crear profesor'));
    }
  },

  updateProfessor: async (id, data) => {
    try {
      const api = createBffApi();
      const response = await api.patch(`/api/professors/${id}`, data);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al actualizar profesor'));
    }
  },

  deleteProfessor: async (id) => {
    try {
      const api = createBffApi();
      const response = await api.delete(`/api/professors/${id}`);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al eliminar profesor'));
    }
  },

  // Dashboard
  getUserDashboard: async () => {
    try {
      const api = createBffApi();
      const response = await api.get('/api/dashboard/me');
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener dashboard'));
    }
  },

  getColegioDashboard: async (colegioId) => {
    try {
      const api = createBffApi();
      const response = await api.get(`/api/dashboard/colegio/${colegioId}`);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener dashboard del colegio'));
    }
  },
};

export default bffApi;
