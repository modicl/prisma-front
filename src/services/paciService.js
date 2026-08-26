/**
 * PACI Service
 * Servicio para comunicación con el BFF para perfiles PACI
 */

import axios from 'axios';
import storageUtils from '../utils/localStorage';
import { getAuthToken } from './cognitoAuth';

const PACI_BASE_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3010';

const paciApi = axios.create({
  baseURL: PACI_BASE_URL,
});

// Interceptor para agregar token Bearer
paciApi.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Obtener todos los perfiles PACI
 */
export const getAllPACIs = async (filters = {}) => {
  const params = new URLSearchParams();

  if (filters.studentId) params.append('studentId', filters.studentId);
  if (filters.isActive !== undefined) params.append('isActive', filters.isActive);
  if (filters.curso) params.append('curso', filters.curso);
  if (filters.fromDate) params.append('fromDate', filters.fromDate);
  if (filters.toDate) params.append('toDate', filters.toDate);

  const response = await paciApi.get(`/api/students/paci-profiles/all?${params.toString()}`);
  return response.data;
};

/**
 * Obtener solo perfiles PACI activos
 */
export const getActivePACIs = async () => {
  const response = await paciApi.get('/api/students/paci-profiles/all?isActive=true');
  return response.data;
};

/**
 * Obtener solo perfiles PACI históricos
 */
export const getHistoricalPACIs = async () => {
  const response = await paciApi.get('/api/students/paci-profiles/all?isActive=false');
  return response.data;
};

/**
 * Obtener perfiles PACI recientes
 */
export const getRecentPACIs = async (limit = 10) => {
  const response = await paciApi.get(`/api/students/paci-profiles/all?limit=${limit}`);
  return response.data;
};

/**
 * Crear un nuevo perfil PACI (crea también el estudiante)
 */
export const createPACI = async (data) => {
  const response = await paciApi.post('/api/students/paci-profiles/create', data);
  return response.data;
};

/**
 * Crear un nuevo estudiante
 */
export const createStudent = async (data) => {
  const response = await paciApi.post('/api/students', data);
  return response.data;
};

/**
 * Actualizar un perfil PACI
 */
export const updatePACI = async (id, data) => {
  const response = await paciApi.patch(`/api/students/paci-profiles/${id}`, data);
  return response.data;
};

/**
 * Obtener un perfil PACI por ID
 */
export const getPACIById = async (id) => {
  const response = await paciApi.get(`/api/students/paci-profiles/${id}`);
  return response.data;
};

/**
 * Obtener perfiles PACI por ID de estudiante
 */
export const getPACIsByStudentId = async (studentId) => {
  const response = await paciApi.get(`/api/students/${studentId}/paci-profiles`);
  return response.data;
};

/**
 * Eliminar un perfil PACI
 */
export const deletePACI = async (id) => {
  const response = await paciApi.delete(`/api/students/paci-profiles/${id}`);
  return response.data;
};

export default {
  getAllPACIs,
  getActivePACIs,
  getHistoricalPACIs,
  getRecentPACIs,
  createPACI,
  createStudent,
  updatePACI,
  getPACIById,
  getPACIsByStudentId,
  deletePACI,
};
