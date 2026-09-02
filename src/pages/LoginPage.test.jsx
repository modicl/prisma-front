/**
 * LoginPage.test.jsx
 * Pruebas de autenticación: validación de formulario, redirección por rol y
 * manejo de errores del servicio.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import authService from '../services/authService';
import { signInWithGoogle, signInWithMicrosoft } from '../services/cognitoAuth';

const mockNavigate = vi.fn();
const mockLogin = vi.fn();
let cognitoEnabled = false;

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, isCognitoEnabled: cognitoEnabled }),
}));

vi.mock('../services/authService', () => ({
  default: { login: vi.fn() },
}));

vi.mock('../services/cognitoAuth', () => ({
  signInWithGoogle: vi.fn(),
  signInWithMicrosoft: vi.fn(),
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
