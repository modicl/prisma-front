/**
 * bffApi.test.js
 * Pruebas de la capa HTTP hacia el BFF. Mockeamos axios para que cada llamada
 * use una instancia controlada y verificamos rutas, payloads, retornos y el
 * mapeo de errores a mensajes amigables.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInstance = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
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
import bffApi from './bffApi';

const ok = (data) => ({ data });

describe('bffApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auth', () => {
    it('login devuelve los datos y llama al endpoint correcto', async () => {
      mockInstance.post.mockResolvedValue(ok({ access_token: 't' }));
      const result = await bffApi.login('a@a.com', 'pw');
      expect(result).toEqual({ access_token: 't' });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'a@a.com',
        password: 'pw',
      });
    });

    it('login mapea el error al mensaje del servidor', async () => {
      mockInstance.post.mockRejectedValue({
        response: { data: { message: 'Credenciales inválidas' } },
      });
      await expect(bffApi.login('a', 'b')).rejects.toThrow('Credenciales inválidas');
    });

    it('login usa el mensaje por defecto cuando no hay detalle', async () => {
      mockInstance.post.mockRejectedValue({});
      await expect(bffApi.login('a', 'b')).rejects.toThrow('Error al iniciar sesión');
    });

    it('register envía los datos', async () => {
      mockInstance.post.mockResolvedValue(ok({ id: '1' }));
      const data = { email: 'e', password: 'p' };
      const result = await bffApi.register(data);
      expect(result).toEqual({ id: '1' });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/auth/register', data);
    });

    it('register mapea error por defecto', async () => {
      mockInstance.post.mockRejectedValue({});
      await expect(bffApi.register({})).rejects.toThrow('Error al registrar usuario');
    });

    it('logout no lanza aunque el servidor falle', async () => {
      mockInstance.post.mockRejectedValue(new Error('network'));
      await expect(bffApi.logout()).resolves.toBeUndefined();
      expect(mockInstance.post).toHaveBeenCalledWith('/api/auth/logout');
    });

    it('getCurrentUser obtiene el usuario actual', async () => {
      mockInstance.get.mockResolvedValue(ok({ id: '1' }));
      await expect(bffApi.getCurrentUser()).resolves.toEqual({ id: '1' });
      expect(mockInstance.get).toHaveBeenCalledWith('/api/auth/me');
    });

    it('getCurrentUser mapea error por defecto', async () => {
      mockInstance.get.mockRejectedValue({});
      await expect(bffApi.getCurrentUser()).rejects.toThrow('Error al obtener usuario');
    });

    it('updateProfile hace PATCH sobre /api/auth/me', async () => {
      mockInstance.patch.mockResolvedValue(ok({ nombre: 'Nuevo' }));
      const result = await bffApi.updateProfile({ nombre: 'Nuevo' });
      expect(result).toEqual({ nombre: 'Nuevo' });
      expect(mockInstance.patch).toHaveBeenCalledWith('/api/auth/me', { nombre: 'Nuevo' });
    });
  });

  describe('Colegios', () => {
    it('getColegios arma los query params', async () => {
      mockInstance.get.mockResolvedValue(ok({ data: [] }));
      await bffApi.getColegios({ page: 2, limit: 10, activo: true, plan: 'basic' });
      const calledWith = mockInstance.get.mock.calls[0][0];
      expect(calledWith).toContain('/api/colegios');
      expect(calledWith).toContain('page=2');
      expect(calledWith).toContain('limit=10');
      expect(calledWith).toContain('activo=true');
      expect(calledWith).toContain('plan=basic');
    });

    it('getColegios funciona sin params', async () => {
      mockInstance.get.mockResolvedValue(ok({ data: [] }));
      await expect(bffApi.getColegios()).resolves.toEqual({ data: [] });
    });

    it('getColegios mapea error por defecto', async () => {
      mockInstance.get.mockRejectedValue({});
      await expect(bffApi.getColegios()).rejects.toThrow('Error al obtener colegios');
    });

    it('getColegioById', async () => {
      mockInstance.get.mockResolvedValue(ok({ id: 'c1' }));
      await expect(bffApi.getColegioById('c1')).resolves.toEqual({ id: 'c1' });
      expect(mockInstance.get).toHaveBeenCalledWith('/api/colegios/c1');
    });

    it('createColegio', async () => {
      mockInstance.post.mockResolvedValue(ok({ id: 'c1' }));
      await bffApi.createColegio({ nombre: 'X' });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/colegios', { nombre: 'X' });
    });

    it('updateColegio', async () => {
      mockInstance.patch.mockResolvedValue(ok({ id: 'c1' }));
      await bffApi.updateColegio('c1', { nombre: 'Y' });
      expect(mockInstance.patch).toHaveBeenCalledWith('/api/colegios/c1', { nombre: 'Y' });
    });

    it('deactivateColegio', async () => {
      mockInstance.delete.mockResolvedValue(ok({ activo: false }));
      await expect(bffApi.deactivateColegio('c1')).resolves.toEqual({ activo: false });
      expect(mockInstance.delete).toHaveBeenCalledWith('/api/colegios/c1');
    });

    it('getColegioStats', async () => {
      mockInstance.get.mockResolvedValue(ok({ totalUsers: 5 }));
      await expect(bffApi.getColegioStats('c1')).resolves.toEqual({ totalUsers: 5 });
      expect(mockInstance.get).toHaveBeenCalledWith('/api/colegios/c1/stats');
    });

    it('getColegioProfessors pasa params', async () => {
      mockInstance.get.mockResolvedValue(ok({ data: [] }));
      await bffApi.getColegioProfessors('c1', { page: 1 });
      expect(mockInstance.get).toHaveBeenCalledWith('/api/colegios/c1/professors', {
        params: { page: 1 },
      });
    });

    it('getColegioAdmins', async () => {
      mockInstance.get.mockResolvedValue(ok({ data: [] }));
      await bffApi.getColegioAdmins('c1');
      expect(mockInstance.get).toHaveBeenCalledWith('/api/colegios/c1/admins');
    });
  });

  describe('Admin users', () => {
    it('setUserActive(true) usa el mensaje de activación en error', async () => {
      mockInstance.patch.mockResolvedValue(ok({ active: true }));
      await bffApi.setUserActive('u1', true);
      expect(mockInstance.patch).toHaveBeenCalledWith('/api/admin/users/u1/active', {
        active: true,
      });

      mockInstance.patch.mockRejectedValue({});
      await expect(bffApi.setUserActive('u1', true)).rejects.toThrow(
        'Error al activar usuario',
      );
    });

    it('setUserActive(false) usa el mensaje de desactivación en error', async () => {
      mockInstance.patch.mockRejectedValue({});
      await expect(bffApi.setUserActive('u1', false)).rejects.toThrow(
        'Error al desactivar usuario',
      );
    });

    it('resetUserPassword envía el nuevo password', async () => {
      mockInstance.post.mockResolvedValue(ok({ temporaryPassword: 'tmp' }));
      const result = await bffApi.resetUserPassword('u1', 'nueva');
      expect(result).toEqual({ temporaryPassword: 'tmp' });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/admin/users/u1/reset-password', {
        newPassword: 'nueva',
      });
    });
  });

  describe('Professors', () => {
    it('getProfessors pasa params', async () => {
      mockInstance.get.mockResolvedValue(ok({ data: [] }));
      await bffApi.getProfessors({ page: 1 });
      expect(mockInstance.get).toHaveBeenCalledWith('/api/professors', { params: { page: 1 } });
    });

    it('createProfessor', async () => {
      mockInstance.post.mockResolvedValue(ok({ id: 'p1' }));
      await bffApi.createProfessor({ nombre: 'P' });
      expect(mockInstance.post).toHaveBeenCalledWith('/api/professors', { nombre: 'P' });
    });

    it('updateProfessor', async () => {
      mockInstance.patch.mockResolvedValue(ok({ id: 'p1' }));
      await bffApi.updateProfessor('p1', { nombre: 'Q' });
      expect(mockInstance.patch).toHaveBeenCalledWith('/api/professors/p1', { nombre: 'Q' });
    });

    it('deleteProfessor', async () => {
      mockInstance.delete.mockResolvedValue(ok({ ok: true }));
      await bffApi.deleteProfessor('p1');
      expect(mockInstance.delete).toHaveBeenCalledWith('/api/professors/p1');
    });

    it('deleteProfessor mapea error por defecto', async () => {
      mockInstance.delete.mockRejectedValue({});
      await expect(bffApi.deleteProfessor('p1')).rejects.toThrow('Error al eliminar profesor');
    });
  });

  describe('Dashboard', () => {
    it('getUserDashboard', async () => {
      mockInstance.get.mockResolvedValue(ok({ stats: {} }));
      await expect(bffApi.getUserDashboard()).resolves.toEqual({ stats: {} });
      expect(mockInstance.get).toHaveBeenCalledWith('/api/dashboard/me');
    });

    it('getColegioDashboard', async () => {
      mockInstance.get.mockResolvedValue(ok({ stats: {} }));
      await bffApi.getColegioDashboard('c1');
      expect(mockInstance.get).toHaveBeenCalledWith('/api/dashboard/colegio/c1');
    });

    it('getColegioDashboard mapea error por defecto', async () => {
      mockInstance.get.mockRejectedValue({});
      await expect(bffApi.getColegioDashboard('c1')).rejects.toThrow(
        'Error al obtener dashboard del colegio',
      );
    });
  });

  describe('interceptores', () => {
    it('el interceptor de request agrega el token cuando existe', async () => {
      mockInstance.post.mockResolvedValue(ok({}));
      await bffApi.login('a', 'b'); // dispara createBffApi -> registra interceptores
      const reqInterceptor = mockInstance.interceptors.request.use.mock.calls[0][0];

      storageUtils.getToken.mockReturnValue('tok');
      const config = await reqInterceptor({ headers: {} });
      expect(config.headers.Authorization).toBe('Bearer tok');

      storageUtils.getToken.mockReturnValue(null);
      const config2 = await reqInterceptor({ headers: {} });
      expect(config2.headers.Authorization).toBeUndefined();
    });

    it('el interceptor de response maneja 401 y rechaza', async () => {
      mockInstance.post.mockResolvedValue(ok({}));
      await bffApi.login('a', 'b');
      const onRejected = mockInstance.interceptors.response.use.mock.calls[0][1];

      const err = {
        response: { status: 401, data: { code: 'X' } },
        config: { url: '/api/y' },
      };
      await expect(onRejected(err)).rejects.toBe(err);
      expect(handleAuthFailure).toHaveBeenCalledWith({ code: 'X' }, '/api/y');
    });
  });
});
