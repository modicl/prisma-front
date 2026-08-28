/**
 * SesionPage.test.jsx
 * Pruebas de la sesión en vivo: hidratación de estado, render según fase
 * (running/completed/error/awaiting_hitl), descarga, cancelación y respuesta HITL.
 *
 * El polling de estado y los componentes hijos se mockean para aislar la página.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SesionPage from './SesionPage';
import chatService from '../services/chatService';

const mockNavigate = vi.fn();
const mockStartTracking = vi.fn();
const mockStopTracking = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ sessionId: 's1' }),
  useNavigate: () => mockNavigate,
}));

vi.mock('../context/ActiveSessionContext', () => ({
  useActiveSession: () => ({
    activeSession: null,
    startTracking: mockStartTracking,
    stopTracking: mockStopTracking,
  }),
}));

vi.mock('../components/layout/MainContainer', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/features/FeedbackWidget', () => ({
  default: () => <div data-testid="feedback" />,
}));
vi.mock('../components/features/HitlReviewModal', () => ({
  default: ({ onRespond }) => (
    <button onClick={() => onRespond({ approved: true })}>hitl-approve</button>
  ),
}));
vi.mock('../components/features/ComplianceNotice', () => ({
  default: ({ reason }) => <div data-testid="compliance">{reason}</div>,
}));

vi.mock('../services/chatService', () => ({
  default: {
    getSessionState: vi.fn(),
    subscribeToSessionState: vi.fn(),
    downloadResult: vi.fn(),
    cancelSession: vi.fn(),
    sendHitlDecision: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom no implementa scrollIntoView (usado por el auto-scroll del chat)
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  // La suscripción por polling devuelve su función de corte; el default es inerte
  // y los tests que necesitan empujar estados la re-implementan.
  chatService.subscribeToSessionState.mockImplementation(() => vi.fn());
});

describe('SesionPage', () => {
  it('muestra el resultado exitoso y permite descargar', async () => {
    chatService.getSessionState.mockResolvedValue({
      phase: 'completed',
      workflow_status: 'success',
      messages: [],
    });
    chatService.downloadResult.mockResolvedValue({});
    render(<SesionPage />);

    await waitFor(() =>
      expect(screen.getByText(/Rúbrica generada y validada/i)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /Descargar PACI Adaptado/i }));
    await waitFor(() => expect(chatService.downloadResult).toHaveBeenCalledWith('s1'));
    expect(mockStopTracking).toHaveBeenCalled();
  });

  it('renderiza los mensajes recibidos en el estado', async () => {
    chatService.getSessionState.mockResolvedValue({
      phase: 'running',
      messages: [
        { role: 'agent', content: 'Analizando PACI' },
        { role: 'user', content: 'Gracias' },
      ],
    });
    render(<SesionPage />);

    await waitFor(() => expect(screen.getByText('Analizando PACI')).toBeInTheDocument());
    expect(screen.getByText('Gracias')).toBeInTheDocument();
  });

  it('muestra el error de procesamiento cuando la fase es error', async () => {
    chatService.getSessionState.mockResolvedValue({
      phase: 'error',
      error: 'Algo falló',
      messages: [],
    });
    render(<SesionPage />);

    await waitFor(() =>
      expect(screen.getByText(/Error durante el procesamiento/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('Algo falló')).toBeInTheDocument();
  });

  it('marca la fase como error si la hidratación falla', async () => {
    chatService.getSessionState.mockRejectedValue(new Error('Red caída'));
    render(<SesionPage />);
    await waitFor(() => expect(screen.getByText('Red caída')).toBeInTheDocument());
  });

  it('permite cancelar una sesión en curso', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    chatService.getSessionState.mockResolvedValue({ phase: 'running', messages: [] });
    chatService.cancelSession.mockResolvedValue({});
    render(<SesionPage />);

    await waitFor(() => expect(mockStartTracking).toHaveBeenCalledWith('s1'));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar sesión/i }));
    await waitFor(() => expect(chatService.cancelSession).toHaveBeenCalledWith('s1'));
  });

  it('responde el checkpoint HITL', async () => {
    chatService.getSessionState.mockResolvedValue({
      phase: 'awaiting_hitl',
      hitl_data: { perfil_paci: 'x', planificacion_adaptada: 'y', attempt: 1, max_attempts: 3 },
      messages: [],
    });
    chatService.sendHitlDecision.mockResolvedValue({});
    render(<SesionPage />);

    const approve = await screen.findByRole('button', { name: 'hitl-approve' });
    fireEvent.click(approve);
    await waitFor(() =>
      expect(chatService.sendHitlDecision).toHaveBeenCalledWith('s1', true, undefined),
    );
  });
});
