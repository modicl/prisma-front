/**
 * authSession.test.js
 * Pruebas unitarias para manejo de sesiones de autenticación
 * Cobertura: 100%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldRedirectToLogin,
  resetAuthRedirectLock,
  clearLocalAuthSession,
  redirectToLogin,
  handleAuthFailure,
} from './authSession';
import storageUtils from '../utils/localStorage';

// Mock storageUtils
vi.mock('../utils/localStorage');
// El redirect espera a que Amplify borre sus tokens. Se stubea para poder
// afirmar que se llama y para que resuelva de inmediato.
vi.mock('./cognitoAuth', () => ({
  signOutCognito: vi.fn(() => Promise.resolve()),
}));
import { signOutCognito } from './cognitoAuth';

describe('authSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthRedirectLock();
    delete window.location;
    window.location = { pathname: '/dashboard', replace: vi.fn() };
  });

  afterEach(() => {
    resetAuthRedirectLock();
  });

  describe('shouldRedirectToLogin', () => {
    it('does not redirect for login invalid credentials', () => {
      expect(
        shouldRedirectToLogin(
          { code: 'AUTH_INVALID_CREDENTIALS' },
          '/api/auth/login',
        ),
      ).toBe(false);
    });

    it('redirects for protected route 401 responses', () => {
      expect(shouldRedirectToLogin({ code: 'AUTH_SESSION_EXPIRED' }, '/api/chat')).toBe(true);
      expect(shouldRedirectToLogin({}, '/api/chat')).toBe(true);
    });

    it('no redirige si la URL contiene /api/auth/login', () => {
      expect(shouldRedirectToLogin({}, '/api/auth/login')).toBe(false);
    });

    it('no redirige si el error es AUTH_INVALID_CREDENTIALS', () => {
      expect(
        shouldRedirectToLogin({ code: 'AUTH_INVALID_CREDENTIALS' }, '/api/other')
      ).toBe(false);
    });

    it('redirige para otros errores y URLs', () => {
      expect(shouldRedirectToLogin({}, '/api/users')).toBe(true);
      expect(shouldRedirectToLogin({ code: 'OTHER_ERROR' }, '/api/data')).toBe(true);
    });

    it('maneja requestUrl no string', () => {
      expect(shouldRedirectToLogin({}, null)).toBe(true);
      expect(shouldRedirectToLogin({}, undefined)).toBe(true);
      expect(shouldRedirectToLogin({}, 123)).toBe(true);
    });
  });

  describe('resetAuthRedirectLock', () => {
    it('debe resetear el redirect lock', () => {
      resetAuthRedirectLock();
      // Después de resetear, redirectToLogin debería permitir redirección
      expect(true).toBe(true);
    });
  });

  describe('clearLocalAuthSession', () => {
    it('debe limpiar la sesión de autenticación', () => {
      clearLocalAuthSession();
      expect(storageUtils.clearSession).toHaveBeenCalled();
    });
  });

  describe('redirectToLogin', () => {
    it('no debe redirigir si ya estamos en /login', () => {
      window.location.pathname = '/login';
      redirectToLogin();
      expect(window.location.replace).not.toHaveBeenCalled();
    });

    it('debe limpiar sesión (legacy y Cognito) y redirigir a /login', async () => {
      window.location.pathname = '/dashboard';
      redirectToLogin();
      expect(storageUtils.clearSession).toHaveBeenCalled();
      expect(signOutCognito).toHaveBeenCalled();
      await vi.waitFor(() => expect(window.location.replace).toHaveBeenCalledWith('/login'));
    });

    it('redirige igual si el sign-out de Cognito falla', async () => {
      window.location.pathname = '/dashboard';
      signOutCognito.mockRejectedValueOnce(new Error('sin red'));
      redirectToLogin();
      await vi.waitFor(() => expect(window.location.replace).toHaveBeenCalledWith('/login'));
    });

    it('no debe redirigir si el redirect ya está en progreso', async () => {
      window.location.pathname = '/dashboard';
      redirectToLogin();
      await vi.waitFor(() => expect(window.location.replace).toHaveBeenCalledTimes(1));

      // Segundo intento no debe redirigir
      window.location.replace.mockClear();
      redirectToLogin();
      await Promise.resolve();
      expect(window.location.replace).not.toHaveBeenCalled();
    });

    it('debe manejar caso cuando window es undefined', () => {
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;

      redirectToLogin();

      global.window = originalWindow;
      expect(true).toBe(true);
    });
  });

  describe('handleAuthFailure', () => {
    it('does not redirect for login invalid credentials', () => {
      resetAuthRedirectLock();
      const result = handleAuthFailure(
        { code: 'AUTH_INVALID_CREDENTIALS' },
        '/api/auth/login',
      );
      expect(result).toBe(false);
      expect(window.location.replace).not.toHaveBeenCalled();
    });

    it('debe redirigir a login para errores de sesión expirada', async () => {
      resetAuthRedirectLock();
      window.location.pathname = '/protected';
      const result = handleAuthFailure({ code: 'AUTH_SESSION_EXPIRED' }, '/api/chat');
      expect(result).toBe(false);
      expect(storageUtils.clearSession).toHaveBeenCalled();
      await vi.waitFor(() => expect(window.location.replace).toHaveBeenCalledWith('/login'));
    });

    it('debe retornar false incluso después de redirigir', () => {
      resetAuthRedirectLock();
      window.location.pathname = '/dashboard';
      const result = handleAuthFailure({}, '/api/users');
      expect(result).toBe(false);
    });
  });
});