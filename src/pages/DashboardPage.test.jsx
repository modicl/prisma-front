/**
 * DashboardPage.test.jsx
 * Pruebas del escritorio del docente: carga, saludo, stats, estudiantes,
 * anuncios y acción rápida de navegación.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import adminPanelService from '../services/adminPanelService';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { nombre: 'Ada' } }),
}));

let mockActive = null;
vi.mock('../context/ActiveSessionContext', () => ({
  useActiveSession: () => ({ activeSession: mockActive }),
}));

vi.mock('../components/layout/MainContainer', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  Button: ({ children, variant, ...props }) => <button {...props}>{children}</button>,
  Alert: ({ children }) => <div role="alert">{children}</div>,
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock('../services/dashboardService', () => ({ default: {} }));
vi.mock('../services/adminPanelService', () => ({
  default: { getActiveAnnouncements: vi.fn() },
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActive = null;
  });

  it('muestra el spinner mientras carga', () => {
    adminPanelService.getActiveAnnouncements.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('renderiza saludo, estadísticas y estudiantes recientes', async () => {
    adminPanelService.getActiveAnnouncements.mockResolvedValue([]);
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText(/¡Hola, Ada!/)).toBeInTheDocument());
    expect(screen.getByText('12')).toBeInTheDocument(); // totalStudents
    expect(screen.getByText('Pablo Rodríguez')).toBeInTheDocument();
  });

  it('muestra los anuncios activos cuando existen', async () => {
    adminPanelService.getActiveAnnouncements.mockResolvedValue([
      { id: 'a1', title: 'Mantención', body: 'El sistema estará offline', audience: 'TODOS' },
    ]);
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('Mantención')).toBeInTheDocument());
    expect(screen.getByText('El sistema estará offline')).toBeInTheDocument();
  });

  it('navega a /paci con la acción rápida "Nuevo PACI"', async () => {
    adminPanelService.getActiveAnnouncements.mockResolvedValue([]);
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText(/¡Hola, Ada!/)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Nuevo PACI'));
    expect(mockNavigate).toHaveBeenCalledWith('/paci');
  });

  it('tolera el fallo al cargar anuncios sin romper la página', async () => {
    adminPanelService.getActiveAnnouncements.mockRejectedValue(new Error('sin anuncios'));
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText(/¡Hola, Ada!/)).toBeInTheDocument());
  });

  describe('proceso en curso', () => {
    beforeEach(() => {
      adminPanelService.getActiveAnnouncements.mockResolvedValue([]);
    });

    it('no muestra el aviso si el docente no tiene un flujo activo', async () => {
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText(/Hola, Ada/)).toBeInTheDocument());
      expect(screen.queryByText(/Tienes un proceso en curso/i)).not.toBeInTheDocument();
    });

    it('avisa y lleva a la sesión con "Continuar" cuando el flujo está procesando', async () => {
      mockActive = { sessionId: 's-9', phase: 'running' };
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText(/Tienes un proceso en curso/i)).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/sesion/s-9');
    });

    it('indica que falta la revisión del docente cuando está esperando su decisión', async () => {
      mockActive = { sessionId: 's-9', phase: 'awaiting_hitl' };
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText(/revisión pendiente/i)).toBeInTheDocument());
    });

    it.each(['completed', 'error'])('no avisa si la sesión ya terminó (%s)', async (phase) => {
      mockActive = { sessionId: 's-9', phase };
      render(<DashboardPage />);
      await waitFor(() => expect(screen.getByText(/Hola, Ada/)).toBeInTheDocument());
      expect(screen.queryByText(/Tienes un proceso en curso/i)).not.toBeInTheDocument();
    });
  });
});
