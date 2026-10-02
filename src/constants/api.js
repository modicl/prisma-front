/**
 * API Endpoints & URLs
 * Configuración centralizada para todos los endpoints de la aplicación
 * Todas las llamadas pasan por el BFF (prisma-bff) en :3010
 */

const BFF_BASE_URL = import.meta.env.VITE_BFF_URL ?? 'http://localhost:3010';
const DOCS_API_URL = import.meta.env.VITE_DOCS_API_URL || 'http://localhost:3000';
const CHAT_API_URL = import.meta.env.VITE_CHAT_API_URL ?? '';

export const AUTH_ENDPOINTS = {
  REGISTER: `${BFF_BASE_URL}/api/auth/register`,
  LOGIN: `${BFF_BASE_URL}/api/auth/login`,
  LOGOUT: `${BFF_BASE_URL}/api/auth/logout`,
  REFRESH: `${BFF_BASE_URL}/api/auth/refresh`,
  ME: `${BFF_BASE_URL}/api/auth/me`,
};

export const CHAT_ENDPOINTS = {
  STATE: (sessionId) => `${CHAT_API_URL}/chat/${sessionId}/state`,
  STREAM: (sessionId) => `${CHAT_API_URL}/chat/${sessionId}/stream`,
  HITL: (sessionId) => `${CHAT_API_URL}/chat/${sessionId}/hitl`,
  CANCEL: (sessionId) => `${CHAT_API_URL}/chat/${sessionId}/cancel`,
  DOWNLOAD: (sessionId) => `${CHAT_API_URL}/chat/${sessionId}/download`,
  HEALTH: `${CHAT_API_URL}/health`,
  FEEDBACK: `${CHAT_API_URL}/feedback/approval`,
};

export const JOBS_ENDPOINTS = {
  UPLOAD: `${BFF_BASE_URL}/api/jobs/upload`,
  LIST: `${BFF_BASE_URL}/api/jobs`,
  HISTORY: `${BFF_BASE_URL}/api/jobs/history`,
  ACTIVE: `${BFF_BASE_URL}/api/jobs/active`,
  STATUS: (id) => `${BFF_BASE_URL}/api/jobs/${id}`,
  DOWNLOAD: (id) => `${BFF_BASE_URL}/api/jobs/${id}/download`,
};

export const ADMIN_ENDPOINTS = {
  SUMMARY: `${BFF_BASE_URL}/api/admin/dashboard/summary`,
  ME: `${BFF_BASE_URL}/api/admin/me`,
  USERS: `${BFF_BASE_URL}/api/admin/users`,
  USER_ACTIVE: (id) => `${BFF_BASE_URL}/api/admin/users/${id}/active`,
  USER_RESET_PASSWORD: (id) => `${BFF_BASE_URL}/api/admin/users/${id}/reset-password`,
  USER_ROLE: (id) => `${BFF_BASE_URL}/api/admin/users/${id}/role`,
  TICKETS: `${BFF_BASE_URL}/api/admin/tickets`,
  TICKET: (id) => `${BFF_BASE_URL}/api/admin/tickets/${id}`,
  TICKETS_BY_REQUESTER: (requesterId) => `${BFF_BASE_URL}/api/admin/tickets/by-requester/${requesterId}`,
  RESOURCES: `${BFF_BASE_URL}/api/admin/resources`,
  RESOURCE: (id) => `${BFF_BASE_URL}/api/admin/resources/${id}`,
  ANNOUNCEMENTS: `${BFF_BASE_URL}/api/admin/announcements`,
  ANNOUNCEMENT: (id) => `${BFF_BASE_URL}/api/admin/announcements/${id}`,
  ANNOUNCEMENTS_ACTIVE: `${BFF_BASE_URL}/api/admin/announcements/active`,
  AUDIT_LOGS: `${BFF_BASE_URL}/api/admin/audit-logs`,
  PROFESSORS: `${BFF_BASE_URL}/api/professors`,
  PROFESSOR: (id) => `${BFF_BASE_URL}/api/professors/${id}`,
  SESSIONS_ACTIVE: `${BFF_BASE_URL}/api/admin/sessions/active`,
  SESSIONS_HISTORICAL: `${BFF_BASE_URL}/api/admin/sessions/historical`,
  SESSIONS_BLOCKED: `${BFF_BASE_URL}/api/admin/sessions/blocked`,
  SESSIONS_BY_USER: (userId) => `${BFF_BASE_URL}/api/admin/sessions/user/${userId}`,
  SESSION: (id) => `${BFF_BASE_URL}/api/admin/sessions`,
  SESSION_BLOCK: (id) => `${BFF_BASE_URL}/api/admin/sessions/${id}/block`,
  SESSION_UNBLOCK: (id) => `${BFF_BASE_URL}/api/admin/sessions/${id}/unblock`,
  SESSION_TERMINATE: (id) => `${BFF_BASE_URL}/api/admin/sessions/${id}/terminate`,
  NOTIFICATIONS: `${BFF_BASE_URL}/api/notifications`,
  NOTIFICATION_READ: (id) => `${BFF_BASE_URL}/api/notifications/${id}/read`,
};

export const SUPERADMIN_ENDPOINTS = {
  COLEGIOS: `${BFF_BASE_URL}/api/colegios`,
  COLEGIO: (id) => `${BFF_BASE_URL}/api/colegios/${id}`,
  COLEGIO_STATS: (id) => `${BFF_BASE_URL}/api/colegios/${id}/stats`,
  COLEGIO_PROFESSORS: (id) => `${BFF_BASE_URL}/api/colegios/${id}/professors`,
  COLEGIO_ADMINS: (id) => `${BFF_BASE_URL}/api/colegios/${id}/admins`,
};

export const API_URLS = {
  AUTH: AUTH_ENDPOINTS,
  CHAT: CHAT_ENDPOINTS,
  JOBS: JOBS_ENDPOINTS,
  ADMIN: ADMIN_ENDPOINTS,
  SUPERADMIN: SUPERADMIN_ENDPOINTS,
};
