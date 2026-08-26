/**
 * AuthContext.test.jsx
 * Pruebas unitarias para el contexto de autenticación
 * Cobertura: 100%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import storageUtils from '../utils/localStorage';

// Mock storageUtils
vi.mock('../utils/localStorage');
vi.mock('../services/authSession', () => ({
  resetAuthRedirectLock: vi.fn(),
}));

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthProvider', () => {
    it('debe renderizar children correctamente', () => {
      render(
        <AuthProvider>
          <div data-testid="child">Test Child</div>
        </AuthProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('debe cargar usuario y tokens de localStorage al montar', async () => {
      const mockUser = { id: '1', email: 'test@example.com', nombre: 'Test User', role: 'TEACHER' };
      storageUtils.getUser.mockReturnValueOnce(mockUser);
      storageUtils.getToken.mockReturnValueOnce('token_123');

      const TestComponent = () => {
        const { user, isAuthenticated, isLoading, isAdmin } = useAuth();
        return (
          <div>
            <div data-testid="is-authenticated">{String(isAuthenticated)}</div>
            <div data-testid="user-email">{user?.email}</div>
            <div data-testid="is-loading">{String(isLoading)}</div>
            <div data-testid="is-admin">{String(isAdmin)}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-loading')).toHaveTextContent('false');
      });
      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(screen.getByTestId('is-admin')).toHaveTextContent('false');
    });

    it('debe inicializar sin usuario si no hay sesión guardada', () => {
      storageUtils.getUser.mockReturnValueOnce(null);
      storageUtils.getToken.mockReturnValueOnce(null);

      const TestComponent = () => {
        const { user, isAuthenticated } = useAuth();
        return (
          <div>
            <div data-testid="is-authenticated">{String(isAuthenticated)}</div>
            <div data-testid="user">{user ? 'user-exists' : 'no-user'}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    });
  });

  describe('useAuth hook', () => {
    it('debe lanzar error si se usa fuera de AuthProvider', () => {
      const TestComponent = () => {
        useAuth();
        return <div>Test</div>;
      };

      // Renderizar sin AuthProvider
      expect(() => render(<TestComponent />)).toThrow(
        'useAuth debe ser usado dentro de AuthProvider'
      );
    });

    it('debe proporcionar función login', async () => {
      const mockUser = { id: '1', email: 'test@example.com', role: 'ADMIN' };

      const TestComponent = () => {
        const { login, user, isAuthenticated } = useAuth();
        return (
          <div>
            <button onClick={() => login(mockUser, { access_token: 'token', refresh_token: 'refresh' })}>
              Login
            </button>
            <div data-testid="user-email">{user?.email}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const loginButton = screen.getByRole('button', { name: /login/i });
      loginButton.click();

      await waitFor(() => {
        expect(storageUtils.saveUser).toHaveBeenCalledWith(mockUser);
        expect(storageUtils.saveToken).toHaveBeenCalledWith('token');
        expect(storageUtils.saveRefreshToken).toHaveBeenCalledWith('refresh');
      });
    });

    it('debe exponer isAdmin cuando el login recibe rol ADMIN', async () => {
      const TestComponent = () => {
        const { login, isAdmin } = useAuth();
        return (
          <div>
            <button
              onClick={() => login({ id: '1', email: 'admin@correo.com', role: 'ADMIN' }, { access_token: 'token', refresh_token: 'refresh' })}
            >
              Login as admin
            </button>
            <div data-testid="is-admin">{String(isAdmin)}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await userEvent.click(screen.getByRole('button', { name: /login as admin/i }));

      await waitFor(() => {
        expect(screen.getByTestId('is-admin')).toHaveTextContent('true');
      });
    });

    it('debe proporcionar función logout', async () => {
      storageUtils.getUser.mockReturnValueOnce({ id: '1', email: 'test@example.com' });
      storageUtils.getToken.mockReturnValueOnce('token_123');

      const TestComponent = () => {
        const { logout, isAuthenticated } = useAuth();
        return (
          <div>
            <button onClick={logout}>Logout</button>
            <div data-testid="is-authenticated">{String(isAuthenticated)}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      logoutButton.click();

      await waitFor(() => {
        expect(storageUtils.clearSession).toHaveBeenCalled();
      });
    });

    it('debe proporcionar función updateUser', async () => {
      const initialUser = { id: '1', email: 'test@example.com', nombre: 'Test' };
      const updatedData = { nombre: 'Updated Name' };

      storageUtils.getUser.mockReturnValueOnce(initialUser);
      storageUtils.getToken.mockReturnValueOnce('token_123');

      const TestComponent = () => {
        const { updateUser, user } = useAuth();
        return (
          <div>
            <button onClick={() => updateUser(updatedData)}>Update</button>
            <div data-testid="user-name">{user?.nombre}</div>
          </div>
        );
      };

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // updateUser persiste en localStorage solo para sesiones legacy, así que
      // hay que esperar a que la hidratación asíncrona defina el authSource.
      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toHaveTextContent('Test');
      });

      const updateButton = screen.getByRole('button', { name: /update/i });
      updateButton.click();

      await waitFor(() => {
        expect(storageUtils.saveUser).toHaveBeenCalled();
      });
    });
  });
});
