/**
 * api.test.js
 * Pruebas de la instancia axios central: interceptores de request (token) y
 * de response (manejo de 401). Capturamos los handlers registrados sobre la
 * instancia mockeada para invocarlos directamente.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHandlers = vi.hoisted(() => ({
  reqF: null,
  reqR: null,
  resF: null,
  resR: null,
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: {
          use: vi.fn((f, r) => {
            mockHandlers.reqF = f;
            mockHandlers.reqR = r;
          }),
        },
        response: {
          use: vi.fn((f, r) => {
            mockHandlers.resF = f;
            mockHandlers.resR = r;
          }),
        },
      },
    })),
  },
}));

vi.mock('../utils/localStorage', () => ({
  default: { getToken: vi.fn() },
}));

vi.mock('./authSession', () => ({ handleAuthFailure: vi.fn() }));

import storageUtils from '../utils/localStorage';
import { handleAuthFailure } from './authSession';
import api from './api';

describe('api (instancia axios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exporta una instancia y registra los interceptores', () => {
    expect(api).toBeTruthy();
    expect(mockHandlers.reqF).toBeTypeOf('function');
    expect(mockHandlers.resF).toBeTypeOf('function');
  });

  describe('interceptor de request', () => {
    it('agrega el header Authorization cuando hay token', async () => {
      storageUtils.getToken.mockReturnValue('abc123');
      const config = await mockHandlers.reqF({ headers: {} });
      expect(config.headers.Authorization).toBe('Bearer abc123');
    });

    it('no agrega Authorization cuando no hay token', async () => {
      storageUtils.getToken.mockReturnValue(null);
      const config = await mockHandlers.reqF({ headers: {} });
      expect(config.headers.Authorization).toBeUndefined();
    });

    it('propaga el error en el handler de rechazo', async () => {
      const err = new Error('request error');
      await expect(mockHandlers.reqR(err)).rejects.toBe(err);
    });
  });

  describe('interceptor de response', () => {
    it('deja pasar la respuesta exitosa', () => {
      const response = { data: 'ok' };
      expect(mockHandlers.resF(response)).toBe(response);
    });

    it('invoca handleAuthFailure ante un 401 y rechaza', async () => {
      const err = {
        response: { status: 401, data: { code: 'AUTH_SESSION_EXPIRED' } },
        config: { url: '/api/chat' },
      };
      await expect(mockHandlers.resR(err)).rejects.toBe(err);
      expect(handleAuthFailure).toHaveBeenCalledWith(
        { code: 'AUTH_SESSION_EXPIRED' },
        '/api/chat',
      );
    });

    it('no invoca handleAuthFailure en errores distintos de 401', async () => {
      const err = { response: { status: 500 }, config: { url: '/api/x' } };
      await expect(mockHandlers.resR(err)).rejects.toBe(err);
      expect(handleAuthFailure).not.toHaveBeenCalled();
    });

    it('maneja errores sin config ni response (url vacía)', async () => {
      const err = {};
      await expect(mockHandlers.resR(err)).rejects.toBe(err);
      expect(handleAuthFailure).not.toHaveBeenCalled();
    });
  });
});
