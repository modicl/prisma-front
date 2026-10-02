/**
 * LoginPage.test.jsx
 * Pruebas de autenticación: validación de formulario, redirección por rol y
 * manejo de errores del servicio.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import authService from '../services/authService';
import {
  signInWithGoogle,
  signInWithMicrosoft,
  getCognitoSession,
  signOutCognito,
} from '../services/cognitoAuth';

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
const mockLoginFromCognito = vi.fn();
let cognitoEnabled = false;
let authState = {};

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    loginFromCognito: mockLoginFromCognito,
    isCognitoEnabled: cognitoEnabled,
    ...authState,
  }),
}));

vi.mock('../services/authService', () => ({
  default: { login: vi.fn() },
}));

vi.mock('../services/cognitoAuth', () => ({
  signInWithGoogle: vi.fn(),
  signInWithMicrosoft: vi.fn(),
  getCognitoSession: vi.fn(async () => null),
  signOutCognito: vi.fn(async () => undefined),
}));

vi.mock('../components', () => ({
  Input: ({ label, error, icon, iconPosition, ...props }) => (
    <div>
      <input aria-label={label || props.placeholder} {...props} />
      {error ? <span role="alert">{error}</span> : null}
    </div>
  ),
  Button: ({ children, loading, fullWidth, size, variant, ...props }) => (
    <button {...props}>{children}</button>
  ),
  Alert: ({ children }) => <div role="status">{children}</div>,
  Spinner: () => <div data-testid="spinner" />,
}));

const fill = (email, password) => {
  fireEvent.change(screen.getByLabelText('Correo Electrónico'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('••••••••'), {
    target: { value: password },
  });
};

const submit = () =>
  fireEvent.submit(screen.getByRole('button', { name: /Ingresar/i }).closest('form'));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cognitoEnabled = false;
    authState = {};
  });

  it('muestra errores de validación con campos vacíos', async () => {
    render(<LoginPage />);
    submit();
    await waitFor(() =>
      expect(screen.getByText('El correo es requerido')).toBeInTheDocument(),
    );
    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('valida formato de correo y largo de contraseña', async () => {
    render(<LoginPage />);
    fill('correo-malo', '123');
    submit();
    await waitFor(() => expect(screen.getByText('Correo inválido')).toBeInTheDocument());
    expect(screen.getByText(/al menos 6 caracteres/i)).toBeInTheDocument();
  });

  it('inicia sesión y redirige a /dashboard para un docente', async () => {
    authService.login.mockResolvedValue({
      user: { role: 'TEACHER' },
      tokens: { access_token: 't' },
    });
    render(<LoginPage />);
    fill('docente@test.cl', 'secret123');
    submit();

    await waitFor(() => expect(authService.login).toHaveBeenCalledWith('docente@test.cl', 'secret123'));
    expect(mockLogin).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('redirige a /colegios para SUPERADMIN y a /admin para ADMIN', async () => {
    authService.login.mockResolvedValue({ user: { role: 'SUPERADMIN' }, tokens: {} });
    const { unmount } = render(<LoginPage />);
    fill('super@test.cl', 'secret123');
    submit();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/colegios'));
    unmount();

    vi.clearAllMocks();
    authService.login.mockResolvedValue({ user: { role: 'ADMIN' }, tokens: {} });
    render(<LoginPage />);
    fill('admin@test.cl', 'secret123');
    submit();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });

  it('muestra el error del servicio al fallar el login', async () => {
    authService.login.mockRejectedValue(new Error('Credenciales inválidas'));
    render(<LoginPage />);
    fill('docente@test.cl', 'secret123');
    submit();

    await waitFor(() =>
      expect(screen.getByText('Credenciales inválidas')).toBeInTheDocument(),
    );
  });

  it('redirige a /dashboard si ya hay sesión al montar', () => {
    authState = { isAuthenticated: true, isLoading: false };
    render(<LoginPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('no redirige mientras la sesión todavía se está cargando', () => {
    authState = { isAuthenticated: true, isLoading: true };
    render(<LoginPage />);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  describe('login federado (Cognito)', () => {
    beforeEach(() => {
      cognitoEnabled = true;
    });

    it('no muestra los botones federados si Cognito no está habilitado', () => {
      cognitoEnabled = false;
      render(<LoginPage />);
      expect(screen.queryByText('Continuar con Google')).not.toBeInTheDocument();
      expect(screen.queryByText('Continuar con Microsoft')).not.toBeInTheDocument();
    });

    it('redirige a Google al hacer clic en su botón', async () => {
      signInWithGoogle.mockResolvedValue();
      render(<LoginPage />);
      fireEvent.click(screen.getByText('Continuar con Google'));

      await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
      expect(signInWithMicrosoft).not.toHaveBeenCalled();
      // Ambos botones quedan deshabilitados mientras redirige.
      expect(screen.getAllByText('Redirigiendo...')).toHaveLength(2);
    });

    it('redirige a Microsoft al hacer clic en su botón', async () => {
      signInWithMicrosoft.mockResolvedValue();
      render(<LoginPage />);
      fireEvent.click(screen.getByText('Continuar con Microsoft'));

      await waitFor(() => expect(signInWithMicrosoft).toHaveBeenCalled());
      expect(signInWithGoogle).not.toHaveBeenCalled();
    });

    it('muestra el error si la redirección a Microsoft falla', async () => {
      signInWithMicrosoft.mockRejectedValue(new Error('boom'));
      render(<LoginPage />);
      fireEvent.click(screen.getByText('Continuar con Microsoft'));

      await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
      // Al fallar, vuelve a mostrar los botones habilitados.
      expect(screen.getByText('Continuar con Microsoft')).toBeInTheDocument();
    });

    // Amplify lanza UserAlreadyAuthenticatedException si quedaron tokens en el
    // navegador (típico tras un 401 que limpió solo el storage legacy).
    const yaAutenticado = () =>
      Object.assign(new Error('There is already a signed in user.'), {
        name: 'UserAlreadyAuthenticatedException',
      });

    it('si Amplify ya tiene sesión válida, entra con ella en vez de fallar', async () => {
      signInWithGoogle.mockRejectedValue(yaAutenticado());
      const user = { id: 'u1', role: 'TEACHER' };
      getCognitoSession.mockResolvedValue({ user });
      render(<LoginPage />);
      fireEvent.click(screen.getByText('Continuar con Google'));

      await waitFor(() => expect(mockLoginFromCognito).toHaveBeenCalledWith(user));
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      expect(signOutCognito).not.toHaveBeenCalled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('si los tokens guardados están muertos, los limpia y reintenta', async () => {
      signInWithGoogle.mockRejectedValueOnce(yaAutenticado()).mockResolvedValueOnce();
      getCognitoSession.mockResolvedValue(null);
      render(<LoginPage />);
      fireEvent.click(screen.getByText('Continuar con Google'));

      await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(2));
      expect(signOutCognito).toHaveBeenCalledTimes(1);
      expect(mockLoginFromCognito).not.toHaveBeenCalled();
    });

    it('muestra el error si el reintento también falla', async () => {
      signInWithGoogle
        .mockRejectedValueOnce(yaAutenticado())
        .mockRejectedValueOnce(new Error('sigue fallando'));
      getCognitoSession.mockResolvedValue(null);
      render(<LoginPage />);
      fireEvent.click(screen.getByText('Continuar con Google'));

      await waitFor(() => expect(screen.getByText('sigue fallando')).toBeInTheDocument());
      expect(screen.getByText('Continuar con Google')).toBeInTheDocument();
    });

    it('usa el mensaje genérico si el error no trae message', async () => {
      signInWithMicrosoft.mockRejectedValue({});
      render(<LoginPage />);
      fireEvent.click(screen.getByText('Continuar con Microsoft'));

      await waitFor(() =>
        expect(
          screen.getByText('No se pudo conectar con Microsoft. Intenta nuevamente.'),
        ).toBeInTheDocument(),
      );
    });
  });
});
