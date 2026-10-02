/**
 * jobsService.test.js
 * Pruebas unitarias del servicio de trabajos/sesiones (axios → BFF).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// El servicio crea su instancia de axios en import-time, por eso el mock se
// define con vi.hoisted (se evalúa antes de importar el módulo).
const { mockDocsApi } = vi.hoisted(() => ({
  mockDocsApi: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}));

vi.mock('axios', () => ({
  default: { create: vi.fn(() => mockDocsApi) },
}));

import jobsService from './jobsService';

describe('jobsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createJob', () => {
    const cuerpo409 = { statusCode: 409, code: 'flow_in_progress', message: 'Ya tienes un flujo en acción', session_id: 's-1' };

    it('detecta "ya tienes un flujo" aunque el BFF lo devuelva con estado 200', async () => {
      // El BFF colapsa los 4xx de los microservicios a 200 con el error en el cuerpo (gotcha 9b).
      mockDocsApi.post.mockResolvedValueOnce({ data: cuerpo409 });
      const err = await jobsService.createJob({}, {}, 'x').catch((e) => e);
      expect(err.message).toBe('Ya tienes un flujo en acción');
      expect(err.activeSessionId).toBe('s-1');
    });

    it('detecta "ya tienes un flujo" con un 409 real', async () => {
      mockDocsApi.post.mockRejectedValueOnce({ response: { status: 409, data: cuerpo409 } });
      const err = await jobsService.createJob({}, {}, 'x').catch((e) => e);
      expect(err.message).toBe('Ya tienes un flujo en acción');
      expect(err.activeSessionId).toBe('s-1');
    });

    it('crea un job con archivos y prompt (multipart)', async () => {
      const mockJob = { jobId: 'job_123', status: 'processing' };
      mockDocsApi.post.mockResolvedValueOnce({ data: mockJob });

      const paciFile = new File(['c'], 'paci.pdf');
      const planningFile = new File(['c'], 'planning.pdf');

      const result = await jobsService.createJob(paciFile, planningFile, 'Generar');

      expect(result).toEqual(mockJob);
      const [, body, config] = mockDocsApi.post.mock.calls[0];
      expect(body).toBeInstanceOf(FormData);
      expect(config.headers['Content-Type']).toBe('multipart/form-data');
    });

    it('lanza error con el mensaje del servidor', async () => {
      mockDocsApi.post.mockRejectedValueOnce({ response: { data: { message: 'Archivo inválido' } } });
      await expect(jobsService.createJob({}, {}, 'x')).rejects.toThrow('Archivo inválido');
    });

    it('usa mensaje por defecto si no hay respuesta', async () => {
      mockDocsApi.post.mockRejectedValueOnce(new Error('network'));
      await expect(jobsService.createJob({}, {}, 'x')).rejects.toThrow('Error al crear la sesión');
    });
  });

  describe('getHistory', () => {
    it('devuelve el historial', async () => {
      mockDocsApi.get.mockResolvedValueOnce({ data: [{ id: 'j1' }] });
      await expect(jobsService.getHistory()).resolves.toEqual([{ id: 'j1' }]);
    });

    it('lanza error al fallar', async () => {
      mockDocsApi.get.mockRejectedValueOnce(new Error('x'));
      await expect(jobsService.getHistory()).rejects.toThrow('Error al obtener historial');
    });
  });

  describe('listJobs', () => {
    it('lista jobs con paginación', async () => {
      mockDocsApi.get.mockResolvedValueOnce({ data: { items: [], total: 0 } });
      const result = await jobsService.listJobs(2, 5);
      expect(result).toEqual({ items: [], total: 0 });
      expect(mockDocsApi.get).toHaveBeenCalledWith(expect.any(String), { params: { page: 2, limit: 5 } });
    });

    it('usa valores por defecto de paginación', async () => {
      mockDocsApi.get.mockResolvedValueOnce({ data: {} });
      await jobsService.listJobs();
      expect(mockDocsApi.get).toHaveBeenCalledWith(expect.any(String), { params: { page: 1, limit: 10 } });
    });

    it('lanza error al fallar', async () => {
      mockDocsApi.get.mockRejectedValueOnce(new Error('x'));
      await expect(jobsService.listJobs()).rejects.toThrow('Error al obtener sesiones');
    });
  });

  describe('getJobStatus', () => {
    it('devuelve el estado del job', async () => {
      mockDocsApi.get.mockResolvedValueOnce({ data: { status: 'done' } });
      await expect(jobsService.getJobStatus('job_1')).resolves.toEqual({ status: 'done' });
    });

    it('lanza error al fallar', async () => {
      mockDocsApi.get.mockRejectedValueOnce(new Error('x'));
      await expect(jobsService.getJobStatus('job_1')).rejects.toThrow('Error al obtener estado del job');
    });
  });

  describe('getDownloadUrl', () => {
    it('devuelve la URL de descarga', async () => {
      mockDocsApi.get.mockResolvedValueOnce({ data: { url: 'https://s3/file' } });
      await expect(jobsService.getDownloadUrl('job_1')).resolves.toEqual({ url: 'https://s3/file' });
    });

    it('lanza error al fallar', async () => {
      mockDocsApi.get.mockRejectedValueOnce(new Error('x'));
      await expect(jobsService.getDownloadUrl('job_1')).rejects.toThrow('Error al obtener URL de descarga');
    });
  });
});
