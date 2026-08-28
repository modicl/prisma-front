import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import chatService from '../services/chatService';

const ActiveSessionContext = createContext(null);
const STORAGE_KEY = 'prisma_active_session';

const save = (session) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); } catch {}
};

export const ActiveSessionProvider = ({ children }) => {
  const [activeSession, setActiveSession] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        if (session?.sessionId && session?.phase) return session;
      }
    } catch {}
    return null;
  });

  const stopPollingRef = useRef(null);
  const cancelledRef = useRef(false);
  const trackedIdRef = useRef(activeSession?.sessionId ?? null);

  const stopTracking = useCallback(() => {
    cancelledRef.current = true;
    if (stopPollingRef.current) {
      stopPollingRef.current();
      stopPollingRef.current = null;
    }
    trackedIdRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setActiveSession(null);
  }, []);

  // Polling en lugar de SSE: API Gateway corta a los 30s y un flujo dura 5-15 min.
  // Leer el estado no lo consume, así que esta suscripción y la de SesionPage ven
  // exactamente lo mismo -desaparece la cola compartida que entregaba `hitl_required`
  // a una sola conexión.
  const connectPolling = useCallback((sessionId) => {
    if (stopPollingRef.current) {
      stopPollingRef.current();
      stopPollingRef.current = null;
    }
    cancelledRef.current = false;

    stopPollingRef.current = chatService.subscribeToSessionState(sessionId, (state) => {
      if (cancelledRef.current) return;

      setActiveSession(prev => {
        if (!prev) return prev;
        const next = {
          ...prev,
          phase: state.phase,
          // `current_step` todavía no viaja en GET /state (sale del evento
          // `agent_start`); queda listo para cuando el backend lo espeje a DynamoDB.
          currentStep: state.current_step || '',
          hitlData: state.hitl_data ?? prev.hitlData,
          workflowStatus: state.workflow_status ?? prev.workflowStatus,
          error: state.error ?? prev.error,
        };
        save(next);
        return next;
      });
    });
  }, []);

  const startTracking = useCallback((sessionId) => {
    if (trackedIdRef.current === sessionId && stopPollingRef.current) return;
    trackedIdRef.current = sessionId;
    const initial = { sessionId, phase: 'running', workflowStatus: null, currentStep: '', error: null };
    save(initial);
    setActiveSession(initial);
    connectPolling(sessionId);
  }, [connectPolling]);

  // Al restaurar desde localStorage: retomar el polling si estaba en running
  useEffect(() => {
    const restored = activeSession;
    if (restored?.phase === 'running' && restored?.sessionId && !stopPollingRef.current) {
      trackedIdRef.current = restored.sessionId;
      connectPolling(restored.sessionId);
    }
  }, []); // solo en mount

  return (
    <ActiveSessionContext.Provider value={{ activeSession, startTracking, stopTracking }}>
      {children}
    </ActiveSessionContext.Provider>
  );
};

export const useActiveSession = () => {
  const ctx = useContext(ActiveSessionContext);
  if (!ctx) throw new Error('useActiveSession must be used inside ActiveSessionProvider');
  return ctx;
};
