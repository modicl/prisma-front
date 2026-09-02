/**
 * PendingPage.test.jsx
 * La pantalla que ve un usuario autenticado sin grupo asignado en Cognito.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PendingPage from './PendingPage';

const mockLogout = vi.fn();
let mockUser = null;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, logout: mockLogout }),
}));

describe('PendingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      nombreCompleto: 'Ana Pérez',
      email: 'ana@colegio.cl',
      role: 'PENDING',
    };
  });

  it('muestra el mensaje de cuenta pendiente y la identidad del token', () => {
    render(<PendingPage />);

    expect(screen.getByText('Tu cuenta está pendiente de autorización')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('ana@colegio.cl')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('cierra sesión al hacer clic en el botón', () => {
    render(<PendingPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('cae al correo cuando el token no trae nombre', () => {
    mockUser = { email: 'sinnombre@colegio.cl', role: 'PENDING' };
    render(<PendingPage />);

    expect(screen.getAllByText('sinnombre@colegio.cl').length).toBeGreaterThan(0);
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('no rompe si no hay usuario en el contexto', () => {
    mockUser = null;
    render(<PendingPage />);

    expect(screen.getByText('Usuario')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
  });
});
