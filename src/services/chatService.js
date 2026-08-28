/**
 * Chat Service
 * Funciones para interactuar con la API de Chat (PRISMA Agents)
 */

import axios from 'axios';
import { CHAT_ENDPOINTS } from '../constants/api';
import storageUtils from '../utils/localStorage';
import { getAuthToken } from './cognitoAuth';
import { handleAuthFailure } from './authSession';

const chatApi = axios.create({
  baseURL: import.meta.env.VITE_CHAT_API_URL ?? '',
});

// Inyectar el JWT de Supabase en cada request al backend de agentes
chatApi.interceptors.request.use(
  async (config) => {
    const token = await getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Redirigir a login si el token expira
chatApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      handleAuthFailure(error.response?.data, error.config?.url || '');
    }
    return Promise.reject(error);
  },
);

const chatService = {
  /**
   * Start Chat Session - Inicia una sesión del flujo multi-agente
   */
  startSession: async (paciFile, materialFile, prompt = null, schoolId = 'colegio_demo') => {
    try {
      const formData = new FormData();
      formData.append('paci_file', paciFile);
      formData.append('material_file', materialFile);
      if (prompt) formData.append('prompt', prompt);
      formData.append('school_id', schoolId);

      const response = await chatApi.post(CHAT_ENDPOINTS.START, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.message || 'Error al iniciar sesión de chat');
    }
  },

  /**
   * Get Session State - Obtiene el estado actual de una sesión
   */
  getSessionState: async (sessionId) => {
    try {
      const response = await chatApi.get(CHAT_ENDPOINTS.STATE(sessionId));
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Sesión no encontrada');
      }
      throw new Error(error.response?.data?.message || 'Error al obtener estado de sesión');
    }
  },

  /**
   * Send HITL Decision - Envía la decisión del docente en checkpoint de revisión
   */
  sendHitlDecision: async (sessionId, approved, reason = null) => {
    try {
      // El agente a reintentar lo decide el workflow (siempre Agente 2 en un rechazo);
      // el front ya no lo envía. Ver spec 2026-06-09-hitl-review-modal-design.md.
      const response = await chatApi.post(CHAT_ENDPOINTS.HITL(sessionId), {
        approved,
        reason,
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Sesión no encontrada');
      }
      if (error.response?.status === 409) {
        throw new Error('La sesión no está esperando una decisión');
      }
      throw new Error(error.response?.data?.message || 'Error al enviar decisión');
    }
  },

  /**
   * Download Result - Descarga el archivo generado
   */
  downloadResult: async (sessionId) => {
    try {
      const response = await chatApi.get(CHAT_ENDPOINTS.DOWNLOAD(sessionId));
      const { url } = response.data;
      window.open(url, '_blank');
      return { success: true };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('Sesión o archivo no encontrado');
      }
      throw new Error(error.response?.data?.message || 'Error al descargar resultado');
    }
  },

  /**
   * Cancel Session - Cancela una sesión activa
   */
  cancelSession: async (sessionId) => {
    try {
      const response = await chatApi.post(CHAT_ENDPOINTS.CANCEL(sessionId));
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) throw new Error('Sesión no encontrada');
      if (error.response?.status === 409) throw new Error('La sesión ya ha terminado');
      throw new Error(error.response?.data?.message || 'Error al cancelar la sesión');
    }
  },

  /**
   * Submit Feedback - Registra el feedback del docente (👍/👎) sobre la rúbrica generada
   */
  submitFeedback: async (sessionId, { approved, comment }) => {
    try {
      const response = await chatApi.post(CHAT_ENDPOINTS.FEEDBACK, {
        session_id: sessionId,
        approved,
        ...(comment ? { comment } : {}),
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Error al enviar feedback');
    }
  },

  /**
   * Health Check - Verifica que el servidor de chat esté disponible
   */
  healthCheck: async () => {
    try {
      const response = await chatApi.get(CHAT_ENDPOINTS.HEALTH);
      return response.data;
    } catch (error) {
      throw new Error('Servidor de chat no disponible');
    }
  },

  /**
   * Subscribe To Session State - Suscripción por polling al estado de la sesión.
   *
   * Reemplaza la conexión SSE (`GET /chat/:id/stream`), que no puede pasar por API
   * Gateway: el HTTP API corta cualquier respuesta a los 30s y un flujo completo
   * tarda entre 5 y 15 minutos. `GET /chat/:id/state` lee de DynamoDB, así que
   * además sobrevive a un reinicio del backend.
   *
   * Llama a `onState` con CADA lectura -incluida `awaiting_hitl`, que es donde el
   * docente decide- y devuelve una función para cortar, equivalente a
   * `EventSource.close()`.
   *
   * A diferencia de `pollSession`, no se resuelve una sola vez al final ni muere
   * con un error de red aislado: tolera `maxFailures` fallos consecutivos.
   */
  subscribeToSessionState: (sessionId, onState, options = {}) => {
    const { interval = 3000, maxFailures = 5, onError } = options;
    let stopped = false;
    let timer = null;
    let failures = 0;

    const stop = () => {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const tick = async () => {
      if (stopped) return;
      try {
        const state = await chatService.getSessionState(sessionId);
        if (stopped) return;
        failures = 0;
        onState(state);
        // El workflow solo emite estas dos fases terminales; `cancelled` viaja en
        // workflow_status, no en phase (ver prisma_workflow/api/session_store.py).
        if (state.phase === 'completed' || state.phase === 'error') {
          stop();
          return;
        }
      } catch (error) {
        if (stopped) return;
        failures += 1;
        if (failures >= maxFailures) {
          stop();
          if (onError) onError(error);
          return;
        }
      }
      if (!stopped) timer = setTimeout(tick, interval);
    };

    tick();
    return stop;
  },

  /**
   * Poll Session - Hace polling continuo del estado de la sesión
   *
   * NOTA: no se usa en la app. Para seguir una sesión en vivo usá
   * `subscribeToSessionState`, que emite los estados intermedios.
   */
  pollSession: async (sessionId, interval = 2000, timeout = null) => {
    return new Promise((resolve, reject) => {
      let isComplete = false;
      let startTime = Date.now();

      const poll = async () => {
        try {
          if (timeout && Date.now() - startTime > timeout) {
            reject(new Error('Timeout esperando resultado de sesión'));
            return;
          }

          const state = await chatService.getSessionState(sessionId);

          if (state.phase === 'completed' || state.phase === 'error') {
            isComplete = true;
            resolve(state);
            return;
          }

          if (!isComplete) {
            setTimeout(poll, interval);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  },
};

export default chatService;
