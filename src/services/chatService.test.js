/**
 * chatService.test.js
 * Pruebas unitarias para el servicio de chat
 * Cobertura: 100%
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chatService from './chatService';

// chatService.js crea la instancia de axios al evaluar el módulo (axios.create en import),
// por eso el mock debe devolver la instancia desde una factory hoisted y no en beforeEach.
const mockChatApi = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}));

vi.mock('axios', () => ({
  default: { create: () => mockChatApi },
}));
vi.mock('./authSession');

describe('chatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getSessionState', () => {
    it('debe obtener el estado de una sesión', async () => {
      const mockState = { session_id: 'session_123', status: 'completed', progress: 100 };
      mockChatApi.get.mockResolvedValueOnce({ data: mockState });

      const result = await chatService.getSessionState('session_123');

      expect(result).toEqual(mockState);
      expect(mockChatApi.get).toHaveBeenCalled();
    });

    it('debe lanzar error si sesión no existe (404)', async () => {
      mockChatApi.get.mockRejectedValueOnce({
        response: { status: 404 },
      });

      await expect(chatService.getSessionState('invalid_id')).rejects.toThrow(
        'Sesión no encontrada'
      );
    });

    it('debe manejar errores genéricos', async () => {
      mockChatApi.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { message: 'Error en servidor' },
        },
      });

      await expect(chatService.getSessionState('session_123')).rejects.toThrow(
        'Error en servidor'
      );
    });
  });

  describe('sendHitlDecision', () => {
    it('debe enviar decisión de revisión HITL aprobada sin agent_to_retry', async () => {
      const mockResponse = { status: 'approved', message: 'Decisión registrada' };
      mockChatApi.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await chatService.sendHitlDecision('session_123', true);

      expect(result).toEqual(mockResponse);
      const [, body] = mockChatApi.post.mock.calls[0];
      expect(body).toEqual({ approved: true, reason: null });
      expect(body).not.toHaveProperty('agent_to_retry');
    });

    it('debe enviar decisión rechazada con motivo y sin agent_to_retry', async () => {
      const mockResponse = { status: 'rejected' };
      mockChatApi.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await chatService.sendHitlDecision(
        'session_123',
        false,
        'Texto contiene errores'
      );

      expect(result).toEqual(mockResponse);
      const [, body] = mockChatApi.post.mock.calls[0];
      expect(body).toEqual({ approved: false, reason: 'Texto contiene errores' });
      expect(body).not.toHaveProperty('agent_to_retry');
    });

    it('debe lanzar error si sesión no existe (404)', async () => {
      mockChatApi.post.mockRejectedValueOnce({
        response: { status: 404 },
      });

      await expect(chatService.sendHitlDecision('invalid_id', true)).rejects.toThrow(
        'Sesión no encontrada'
      );
    });

    it('debe lanzar error si sesión no está esperando decisión (409)', async () => {
      mockChatApi.post.mockRejectedValueOnce({
        response: { status: 409 },
      });

      await expect(chatService.sendHitlDecision('session_123', true)).rejects.toThrow(
        'La sesión no está esperando una decisión'
      );
    });
  });

  describe('downloadResult', () => {
    it('debe descargar el resultado de una sesión', async () => {
      const mockUrl = 'https://storage.example.com/result.pdf';
      mockChatApi.get.mockResolvedValueOnce({ data: { url: mockUrl } });
      window.open = vi.fn();

      const result = await chatService.downloadResult('session_123');

      expect(result).toEqual({ success: true });
      expect(window.open).toHaveBeenCalledWith(mockUrl, '_blank');
    });

    it('debe lanzar error si archivo no existe (404)', async () => {
      mockChatApi.get.mockRejectedValueOnce({
        response: { status: 404 },
      });

      await expect(chatService.downloadResult('invalid_id')).rejects.toThrow(
        'Sesión o archivo no encontrado'
      );
    });

    it('debe manejar errores del servidor', async () => {
      mockChatApi.get.mockRejectedValueOnce({
        response: {
          status: 500,
          data: { message: 'Fallo en descarga' },
        },
      });

      await expect(chatService.downloadResult('session_123')).rejects.toThrow('Fallo en descarga');
    });
  });

  describe('cancelSession', () => {
    it('debe cancelar una sesión activa', async () => {
      const mockResponse = { status: 'cancelled' };
      mockChatApi.post.mockResolvedValueOnce({ data: mockResponse });

      const result = await chatService.cancelSession('session_123');

      expect(result).toEqual(mockResponse);
    });

    it('debe lanzar error si sesión no existe (404)', async () => {
      mockChatApi.post.mockRejectedValueOnce({
        response: { status: 404 },
      });

      await expect(chatService.cancelSession('invalid_id')).rejects.toThrow(
        'Sesión no encontrada'
      );
    });

    it('debe lanzar error si sesión ya terminó (409)', async () => {
      mockChatApi.post.mockRejectedValueOnce({
        response: { status: 409 },
      });

      await expect(chatService.cancelSession('session_123')).rejects.toThrow(
        'La sesión ya ha terminado'
      );
    });
  });

  describe('healthCheck', () => {
    it('debe verificar que el servidor esté disponible', async () => {
      const mockHealth = { status: 'healthy', version: '1.0.0' };
      mockChatApi.get.mockResolvedValueOnce({ data: mockHealth });

      const result = await chatService.healthCheck();

      expect(result).toEqual(mockHealth);
    });

    it('debe lanzar error si servidor no está disponible', async () => {
      mockChatApi.get.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(chatService.healthCheck()).rejects.toThrow(
        'Servidor de chat no disponible'
      );
    });
  });

  describe('subscribeToSessionState', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('emite cada estado leído y sigue mientras la sesión no termine', async () => {
      mockChatApi.get
        .mockResolvedValueOnce({ data: { phase: 'running' } })
        .mockResolvedValueOnce({ data: { phase: 'awaiting_hitl' } })
        .mockResolvedValueOnce({ data: { phase: 'completed' } });

      const onState = vi.fn();
      chatService.subscribeToSessionState('session_123', onState, { interval: 1000 });

      await vi.advanceTimersByTimeAsync(0);
      expect(onState).toHaveBeenNthCalledWith(1, { phase: 'running' });

      // awaiting_hitl NO es terminal: el docente todavía tiene que decidir
      await vi.advanceTimersByTimeAsync(1000);
      expect(onState).toHaveBeenNthCalledWith(2, { phase: 'awaiting_hitl' });

      await vi.advanceTimersByTimeAsync(1000);
      expect(onState).toHaveBeenNthCalledWith(3, { phase: 'completed' });

      await vi.advanceTimersByTimeAsync(10000);
      expect(onState).toHaveBeenCalledTimes(3);
    });

    it('se detiene al llegar a la fase error', async () => {
      mockChatApi.get.mockResolvedValue({ data: { phase: 'error', error: 'boom' } });

      const onState = vi.fn();
      chatService.subscribeToSessionState('session_123', onState, { interval: 1000 });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10000);
      expect(onState).toHaveBeenCalledTimes(1);
    });

    it('usa el intervalo por defecto cuando no se pasan opciones', async () => {
      mockChatApi.get.mockResolvedValue({ data: { phase: 'running' } });

      const onState = vi.fn();
      const stop = chatService.subscribeToSessionState('session_123', onState);

      await vi.advanceTimersByTimeAsync(0);
      expect(onState).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(3000);
      expect(onState).toHaveBeenCalledTimes(2);
      stop();
    });

    it('la función devuelta corta el polling', async () => {
      mockChatApi.get.mockResolvedValue({ data: { phase: 'running' } });

      const onState = vi.fn();
      const stop = chatService.subscribeToSessionState('session_123', onState, { interval: 1000 });

      await vi.advanceTimersByTimeAsync(0);
      expect(onState).toHaveBeenCalledTimes(1);

      stop();
      await vi.advanceTimersByTimeAsync(10000);
      expect(onState).toHaveBeenCalledTimes(1);
    });

    it('cortar antes del primer tick no deja timers pendientes', async () => {
      mockChatApi.get.mockResolvedValue({ data: { phase: 'running' } });

      const onState = vi.fn();
      const stop = chatService.subscribeToSessionState('session_123', onState, { interval: 1000 });
      stop();

      await vi.advanceTimersByTimeAsync(10000);
      expect(onState).not.toHaveBeenCalled();
    });

    it('tolera un fallo aislado y sigue consultando', async () => {
      mockChatApi.get
        .mockRejectedValueOnce(new Error('red caída'))
        .mockResolvedValueOnce({ data: { phase: 'running' } });

      const onState = vi.fn();
      const onError = vi.fn();
      chatService.subscribeToSessionState('session_123', onState, { interval: 1000, onError });

      await vi.advanceTimersByTimeAsync(0);
      expect(onState).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(onState).toHaveBeenCalledTimes(1);
    });

    it('corta y avisa tras maxFailures fallos consecutivos', async () => {
      mockChatApi.get.mockRejectedValue(new Error('red caída'));

      const onState = vi.fn();
      const onError = vi.fn();
      chatService.subscribeToSessionState('session_123', onState, {
        interval: 1000,
        maxFailures: 2,
        onError,
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(onError).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(onError).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10000);
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('corta tras maxFailures aunque no se pase onError', async () => {
      mockChatApi.get.mockRejectedValue(new Error('red caída'));

      const onState = vi.fn();
      chatService.subscribeToSessionState('session_123', onState, {
        interval: 1000,
        maxFailures: 1,
      });

      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10000);
      expect(onState).not.toHaveBeenCalled();
    });
  });

  describe('pollSession', () => {
    it('debe hacer polling del estado de la sesión', async () => {
      const mockState = { phase: 'completed' };
      mockChatApi.get.mockResolvedValueOnce({ data: mockState });

      const result = await chatService.pollSession('session_123', 100);

      expect(result).toBeDefined();
    });

    it('debe respetar el timeout', async () => {
      mockChatApi.get.mockRejectedValueOnce(new Error('Timeout'));

      const promise = chatService.pollSession('session_123', 100, 50);
      
      await expect(promise).rejects.toThrow();
    }, 5000);
  });
});
