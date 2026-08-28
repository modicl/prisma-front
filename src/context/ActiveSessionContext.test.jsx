/**
 * ActiveSessionContext.test.jsx
 * Pruebas unitarias del contexto de sesión activa (tracking por polling).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ActiveSessionProvider, useActiveSession } from './ActiveSessionContext';
import chatService from '../services/chatService';

vi.mock('../services/chatService', () => ({
  default: { subscribeToSessionState: vi.fn() },
}));

// localStorage controlado (la jsdom de esta versión no expone clear utilizable).
const makeStorage = () => {
  const store = new Map();
  return {
    getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
    setItem: vi.fn((k, v) => store.set(k, String(v))),
    removeItem: vi.fn((k) => store.delete(k)),
    clear: vi.fn(() => store.clear()),
  };
};

// Cada suscripción queda capturada para poder empujar estados desde el test,
// igual que antes se empujaban eventos por `onmessage`.
let lastSubscription;
beforeEach(() => {
  vi.clearAllMocks();
  global.localStorage = makeStorage();
  lastSubscription = null;
  chatService.subscribeToSessionState.mockImplementation((sessionId, onState, options) => {
    const stop = vi.fn();
    lastSubscription = { sessionId, onState, options, stop };
    return stop;
  });
});

const Consumer = () => {
  const { activeSession, startTracking, stopTracking } = useActiveSession();
  return (
    <div>
      <button onClick={() => startTracking('session_123')}>start</button>
      <button onClick={stopTracking}>stop</button>
      <div data-testid="session">{activeSession ? 'has-session' : 'no-session'}</div>
      <div data-testid="id">{activeSession?.sessionId || 'none'}</div>
      <div data-testid="phase">{activeSession?.phase || 'none'}</div>
      <div data-testid="step">{activeSession?.currentStep || 'none'}</div>
    </div>
  );
};

const renderProvider = () =>
  render(
    <ActiveSessionProvider>
      <Consumer />
    </ActiveSessionProvider>,
  );

describe('ActiveSessionContext', () => {
  it('renderiza los children', () => {
    render(
      <ActiveSessionProvider>
        <div data-testid="child">hijo</div>
      </ActiveSessionProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('inicializa con activeSession en null', () => {
    renderProvider();
    expect(screen.getByTestId('session')).toHaveTextContent('no-session');
  });

  it('restaura la sesión desde localStorage al montar', () => {
    global.localStorage.getItem.mockReturnValueOnce(
      JSON.stringify({ sessionId: 'session_999', phase: 'completed' }),
    );
    renderProvider();
    expect(screen.getByTestId('id')).toHaveTextContent('session_999');
    // Sesión ya terminada: no debe retomar el polling.
    expect(chatService.subscribeToSessionState).not.toHaveBeenCalled();
  });

  it('retoma el polling al montar si la sesión restaurada seguía en running', () => {
    global.localStorage.getItem.mockReturnValueOnce(
      JSON.stringify({ sessionId: 'session_888', phase: 'running' }),
    );
    renderProvider();
    expect(chatService.subscribeToSessionState).toHaveBeenCalledTimes(1);
    expect(lastSubscription.sessionId).toBe('session_888');
  });

  it('maneja localStorage corrupto sin lanzar', () => {
    global.localStorage.getItem.mockReturnValueOnce('json roto {');
    expect(() => renderProvider()).not.toThrow();
    expect(screen.getByTestId('session')).toHaveTextContent('no-session');
  });

  it('useActiveSession lanza error fuera del provider', () => {
    const Bad = () => {
      useActiveSession();
      return null;
    };
    expect(() => render(<Bad />)).toThrow('useActiveSession must be used inside ActiveSessionProvider');
  });

  it('startTracking crea la sesión en running y arranca el polling', () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    expect(screen.getByTestId('id')).toHaveTextContent('session_123');
    expect(screen.getByTestId('phase')).toHaveTextContent('running');
    expect(chatService.subscribeToSessionState).toHaveBeenCalledTimes(1);
    expect(lastSubscription.sessionId).toBe('session_123');
  });

  it('stopTracking limpia la sesión y corta el polling', () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    const { stop } = lastSubscription;
    fireEvent.click(screen.getByRole('button', { name: 'stop' }));
    expect(screen.getByTestId('session')).toHaveTextContent('no-session');
    expect(stop).toHaveBeenCalled();
  });

  it('refleja el paso actual que llega en el estado', () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    act(() => {
      lastSubscription.onState({ phase: 'running', current_step: 'Procesando PACI' });
    });
    expect(screen.getByTestId('step')).toHaveTextContent('Procesando PACI');
  });

  it('refleja awaiting_hitl sin depender de qué conexión recibió el evento', () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    act(() => {
      lastSubscription.onState({ phase: 'awaiting_hitl', hitl_data: { plan: 'x' } });
    });
    expect(screen.getByTestId('phase')).toHaveTextContent('awaiting_hitl');
  });

  it('marca la sesión como completed cuando llega esa fase', () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    act(() => {
      lastSubscription.onState({ phase: 'completed', workflow_status: 'success' });
    });
    expect(screen.getByTestId('phase')).toHaveTextContent('completed');
  });

  it('propaga la fase de error', () => {
    renderProvider();
    fireEvent.click(screen.getByRole('button', { name: 'start' }));
    act(() => {
      lastSubscription.onState({ phase: 'error', error: 'boom' });
    });
    expect(screen.getByTestId('phase')).toHaveTextContent('error');
  });

  it('no reabre el polling si ya está rastreando la misma sesión', () => {
    renderProvider();
    const start = screen.getByRole('button', { name: 'start' });
    fireEvent.click(start);
    fireEvent.click(start);
    expect(chatService.subscribeToSessionState).toHaveBeenCalledTimes(1);
  });
});
