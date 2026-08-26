/**
 * adminPanelService.test.js
 * Pruebas de la capa HTTP del panel de administración. Cubre todos los métodos
 * (éxito + mapeo de error) y los interceptores (token, anti-caché, 401).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInstance = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  put: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
};

vi.mock('axios', () => ({
  default: { create: vi.fn(() => mockInstance) },
}));

vi.mock('../utils/localStorage', () => ({
  default: { getToken: vi.fn() },
}));

vi.mock('./authSession', () => ({ handleAuthFailure: vi.fn() }));

import storageUtils from '../utils/localStorage';
import { handleAuthFailure } from './authSession';
import adminPanelService from './adminPanelService';

// [nombre, args, verbo, mensajeErrorPorDefecto]
const CASES = [
  ['getSummary', [], 'get', 'Error al obtener métricas del panel'],
  ['getTickets', [{ page: 1 }], 'get', 'Error al obtener tickets'],
  ['getTicketsByRequester', ['u1'], 'get', 'Error al obtener tus tickets'],
  ['createTicket', [{ subject: 'x' }], 'post', 'Error al crear ticket'],
  ['updateTicket', ['t1', { status: 'open' }], 'patch', 'Error al actualizar ticket'],
  ['deleteTicket', ['t1'], 'delete', 'Error al eliminar ticket'],
  ['getResources', [], 'get', 'Error al obtener recursos'],
  ['createResource', [{ title: 'x' }], 'post', 'Error al crear recurso'],
  ['updateResource', ['r1', { title: 'y' }], 'patch', 'Error al actualizar recurso'],
  ['deleteResource', ['r1'], 'delete', 'Error al eliminar recurso'],
  ['getAnnouncements', [], 'get', 'Error al obtener anuncios'],
  ['getActiveAnnouncements', [], 'get', 'Error al obtener anuncios activos'],
  ['createAnnouncement', [{ title: 'x' }], 'post', 'Error al crear anuncio'],
  ['updateAnnouncement', ['a1', {}], 'patch', 'Error al actualizar anuncio'],
  ['deleteAnnouncement', ['a1'], 'delete', 'Error al eliminar anuncio'],
  ['getAuditLogs', [{ page: 1 }], 'get', 'Error al obtener logs de auditoría'],
  ['getProfessors', [{ page: 1 }], 'get', 'Error al obtener profesores'],
  ['createProfessor', [{ email: 'x' }], 'post', 'Error al crear profesor'],
  ['updateProfessor', ['p1', {}], 'patch', 'Error al actualizar profesor'],
  ['deleteProfessor', ['p1'], 'delete', 'Error al eliminar profesor'],
  ['getActiveSessions', [], 'get', 'Error al obtener sesiones activas'],
  ['getHistoricalSessions', [], 'get', 'Error al obtener sesiones históricas'],
  ['getBlockedSessions', [], 'get', 'Error al obtener sesiones bloqueadas'],
  ['blockSession', ['s1'], 'put', 'Error al bloquear sesión'],
  ['unblockSession', ['s1'], 'put', 'Error al desbloquear sesión'],
  ['terminateSession', ['s1'], 'put', 'Error al terminar sesión'],
  ['getNotifications', ['u1'], 'get', 'Error al obtener notificaciones'],
  ['markNotificationRead', ['n1'], 'patch', 'Error al marcar notificación como leída'],
];

describe('adminPanelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe.each(CASES)('%s', (name, args, verb, errMsg) => {
    it('devuelve response.data en caso de éxito', async () => {
      mockInstance[verb].mockResolvedValue({ data: { ok: true } });
      const result = await adminPanelService[name](...args);
      expect(result).toEqual({ ok: true });
      expect(mockInstance[verb]).toHaveBeenCalled();
    });

    it('mapea el error al mensaje por defecto', async () => {
      mockInstance[verb].mockRejectedValue({});
      await expect(adminPanelService[name](...args)).rejects.toThrow(errMsg);
    });

    it('usa el mensaje del servidor cuando está disponible', async () => {
      mockInstance[verb].mockRejectedValue({ response: { data: { message: 'Detalle servidor' } } });
      await expect(adminPanelService[name](...args)).rejects.toThrow('Detalle servidor');
    });
  });

  describe('interceptores', () => {
    const getRequestInterceptor = async () => {
      mockInstance.get.mockResolvedValue({ data: {} });
      await adminPanelService.getSummary();
      return mockInstance.interceptors.request.use.mock.calls[0][0];
    };

    it('agrega token y timestamp anti-caché en GET con params', async () => {
      const reqInterceptor = await getRequestInterceptor();
      storageUtils.getToken.mockReturnValue('tok');
      const config = await reqInterceptor({ method: 'get', params: { a: 1 }, headers: {} });
      expect(config.headers.Authorization).toBe('Bearer tok');
      expect(config.params._t).toBeTypeOf('number');
      expect(config.params.a).toBe(1);
    });

    it('crea params con timestamp en GET sin params', async () => {
      const reqInterceptor = await getRequestInterceptor();
      storageUtils.getToken.mockReturnValue(null);
      const config = await reqInterceptor({ method: 'get', headers: {} });
      expect(config.params._t).toBeTypeOf('number');
      expect(config.headers.Authorization).toBeUndefined();
    });

    it('no agrega params anti-caché en métodos distintos de GET', async () => {
      const reqInterceptor = await getRequestInterceptor();
      const config = reqInterceptor({ method: 'post', headers: {} });
      expect(config.params).toBeUndefined();
    });

    it('maneja 401 en el interceptor de response', async () => {
      mockInstance.get.mockResolvedValue({ data: {} });
      await adminPanelService.getSummary();
      const onRejected = mockInstance.interceptors.response.use.mock.calls[0][1];
      const err = { response: { status: 401, data: { code: 'X' } }, config: { url: '/api/admin' } };
      await expect(onRejected(err)).rejects.toBe(err);
      expect(handleAuthFailure).toHaveBeenCalledWith({ code: 'X' }, '/api/admin');
    });
  });
});
