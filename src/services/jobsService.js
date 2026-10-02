import axios from 'axios';
import storageUtils from '../utils/localStorage';
import { getAuthToken } from './cognitoAuth';
import { JOBS_ENDPOINTS } from '../constants/api';

const docsApi = axios.create({
  baseURL: import.meta.env.VITE_BFF_URL ?? 'http://localhost:3010',
});

docsApi.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// El docente ya tiene un flujo activo (ms-docs responde 409 con este cuerpo; el BFF puede entregarlo con estado 200).
const esFlujoEnAccion = (data) => data?.code === 'flow_in_progress';
const conflictoFlujo = (data) => {
  const err = new Error(data.message || 'Ya tienes un flujo en acción');
  err.activeSessionId = data.session_id ?? null;
  return err;
};

const jobsService = {
  createJob: async (paciFile, planningFile, prompt) => {
    try {
      const formData = new FormData();
      formData.append('paciFile', paciFile);
      formData.append('planningFile', planningFile);
      formData.append('prompt', prompt);

      const response = await docsApi.post(JOBS_ENDPOINTS.UPLOAD, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (esFlujoEnAccion(response.data)) throw conflictoFlujo(response.data);
      return response.data;
    } catch (error) {
      if (error.activeSessionId !== undefined) throw error;
      if (esFlujoEnAccion(error.response?.data)) throw conflictoFlujo(error.response.data);
      throw new Error(error.response?.data?.message || 'Error al crear la sesión');
    }
  },

  getHistory: async () => {
    try {
      const response = await docsApi.get(JOBS_ENDPOINTS.HISTORY);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al obtener historial');
    }
  },

  listJobs: async (page = 1, limit = 10) => {
    try {
      const response = await docsApi.get(JOBS_ENDPOINTS.LIST, {
        params: { page, limit },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al obtener sesiones');
    }
  },

  getJobStatus: async (jobId) => {
    try {
      const response = await docsApi.get(JOBS_ENDPOINTS.STATUS(jobId));
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al obtener estado del job');
    }
  },

  getDownloadUrl: async (jobId) => {
    try {
      const response = await docsApi.get(JOBS_ENDPOINTS.DOWNLOAD(jobId));
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al obtener URL de descarga');
    }
  },
};

export default jobsService;
