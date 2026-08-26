import axios from 'axios';
import { ADMIN_ENDPOINTS } from '../constants/api';
import storageUtils from '../utils/localStorage';
import { getAuthToken } from './cognitoAuth';
import { handleAuthFailure } from './authSession';

const createAdminApi = () => {
  const adminApi = axios.create({
    baseURL: import.meta.env.VITE_BFF_URL ?? 'http://localhost:3010',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  adminApi.interceptors?.request?.use?.(async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Add timestamp to prevent caching
    if (config.method === 'get' && config.params) {
      config.params._t = Date.now();
    } else if (config.method === 'get') {
      config.params = { _t: Date.now() };
    }
    return config;
  });

  adminApi.interceptors?.response?.use?.(
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

  return adminApi;
};

const getMessage = (error, fallback) => error.response?.data?.message || fallback;

const adminPanelService = {
  getSummary: async () => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.SUMMARY);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener métricas del panel'));
    }
  },

  getTickets: async (params) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.TICKETS, { params });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener tickets'));
    }
  },

  getTicketsByRequester: async (requesterId) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.TICKETS_BY_REQUESTER(requesterId));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener tus tickets'));
    }
  },

  createTicket: async (payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.post(ADMIN_ENDPOINTS.TICKETS, payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al crear ticket'));
    }
  },

  updateTicket: async (id, payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.patch(ADMIN_ENDPOINTS.TICKET(id), payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al actualizar ticket'));
    }
  },

  deleteTicket: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.delete(ADMIN_ENDPOINTS.TICKET(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al eliminar ticket'));
    }
  },

  getResources: async () => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.RESOURCES);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener recursos'));
    }
  },

  createResource: async (payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.post(ADMIN_ENDPOINTS.RESOURCES, payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al crear recurso'));
    }
  },

  updateResource: async (id, payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.patch(ADMIN_ENDPOINTS.RESOURCE(id), payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al actualizar recurso'));
    }
  },

  deleteResource: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.delete(ADMIN_ENDPOINTS.RESOURCE(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al eliminar recurso'));
    }
  },

  getAnnouncements: async () => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.ANNOUNCEMENTS);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener anuncios'));
    }
  },

  getActiveAnnouncements: async () => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.ANNOUNCEMENTS_ACTIVE);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener anuncios activos'));
    }
  },

  createAnnouncement: async (payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.post(ADMIN_ENDPOINTS.ANNOUNCEMENTS, payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al crear anuncio'));
    }
  },

  updateAnnouncement: async (id, payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.patch(ADMIN_ENDPOINTS.ANNOUNCEMENT(id), payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al actualizar anuncio'));
    }
  },

  deleteAnnouncement: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.delete(ADMIN_ENDPOINTS.ANNOUNCEMENT(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al eliminar anuncio'));
    }
  },

  getAuditLogs: async (params) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.AUDIT_LOGS, { params });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener logs de auditoría'));
    }
  },

  getProfessors: async (params) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.PROFESSORS, { params });
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener profesores'));
    }
  },

  createProfessor: async (payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.post(ADMIN_ENDPOINTS.PROFESSORS, payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al crear profesor'));
    }
  },

  updateProfessor: async (id, payload) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.patch(ADMIN_ENDPOINTS.PROFESSOR(id), payload);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al actualizar profesor'));
    }
  },

  deleteProfessor: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.delete(ADMIN_ENDPOINTS.PROFESSOR(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al eliminar profesor'));
    }
  },

  getActiveSessions: async () => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.SESSIONS_ACTIVE);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener sesiones activas'));
    }
  },

  getHistoricalSessions: async () => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.SESSIONS_HISTORICAL);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener sesiones históricas'));
    }
  },

  getBlockedSessions: async () => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(ADMIN_ENDPOINTS.SESSIONS_BLOCKED);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener sesiones bloqueadas'));
    }
  },

  blockSession: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.put(ADMIN_ENDPOINTS.SESSION_BLOCK(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al bloquear sesión'));
    }
  },

  unblockSession: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.put(ADMIN_ENDPOINTS.SESSION_UNBLOCK(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al desbloquear sesión'));
    }
  },

  terminateSession: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.put(ADMIN_ENDPOINTS.SESSION_TERMINATE(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al terminar sesión'));
    }
  },

  getNotifications: async (userId) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.get(`${ADMIN_ENDPOINTS.NOTIFICATIONS}?userId=${userId}`);
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al obtener notificaciones'));
    }
  },

  markNotificationRead: async (id) => {
    try {
      const adminApi = createAdminApi();
      const response = await adminApi.patch(ADMIN_ENDPOINTS.NOTIFICATION_READ(id));
      return response.data;
    } catch (error) {
      throw new Error(getMessage(error, 'Error al marcar notificación como leída'));
    }
  },
};

export default adminPanelService;
