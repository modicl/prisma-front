/**
 * NuevaSesionPage.test.jsx
 * Pruebas del asistente de nueva sesión: navegación por pasos condicionada a la
 * carga de archivos y envío que crea el job, inicia el tracking y navega.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NuevaSesionPage from './NuevaSesionPage';
import jobsService from '../services/jobsService';

const mockNavigate = vi.fn();
const mockStartTracking = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../context/ActiveSessionContext', () => ({
  useActiveSession: () => ({ startTracking: mockStartTracking }),
}));

vi.mock('../components/layout/MainContainer', () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock('../components/ui', () => ({
  Button: ({ children, icon, variant, loading, ...props }) => (
    <button {...props}>{children}</button>
  ),
  Alert: ({ children }) => <div role="alert">{children}</div>,
}));

vi.mock('../services/jobsService', () => ({
  default: { createJob: vi.fn() },
}));

const uploadFile = (container, name = 'file.pdf') => {
  const input = container.querySelector('input[type="file"]');
  const file = new File(['data'], name, { type: 'application/pdf' });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('NuevaSesionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicia en el paso 1 con "Siguiente" deshabilitado', () => {
    render(<NuevaSesionPage />);
    expect(screen.getByRole('heading', { name: 'Perfil PACI' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeDisabled();
  });

  it('habilita "Siguiente" al subir el PACI y avanza al paso 2', () => {
    const { container } = render(<NuevaSesionPage />);
    uploadFile(container, 'paci.pdf');

    expect(screen.getByRole('button', { name: /Siguiente/i })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    expect(screen.getByRole('heading', { name: /Material Base/i })).toBeInTheDocument();
  });

  it('completa el flujo y crea la sesión', async () => {
    jobsService.createJob.mockResolvedValue({ jobId: 'job-123' });
    const { container } = render(<NuevaSesionPage />);

    uploadFile(container, 'paci.pdf');
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

    uploadFile(container, 'material.pdf');
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));

    // Paso 3: prompt opcional + crear sesión
    fireEvent.change(screen.getByPlaceholderText(/Genera un PACI adaptado/i), {
      target: { value: 'Instrucciones' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Crear Sesión/i }));

    await waitFor(() => expect(jobsService.createJob).toHaveBeenCalled());
    expect(mockStartTracking).toHaveBeenCalledWith('job-123');
    expect(mockNavigate).toHaveBeenCalledWith('/sesion/job-123');
  });

  it('muestra un error si la creación de la sesión falla', async () => {
    jobsService.createJob.mockRejectedValue(new Error('No se pudo crear'));
    const { container } = render(<NuevaSesionPage />);

    uploadFile(container, 'paci.pdf');
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    uploadFile(container, 'material.pdf');
    fireEvent.click(screen.getByRole('button', { name: /Siguiente/i }));
    fireEvent.click(screen.getByRole('button', { name: /Crear Sesión/i }));

    await waitFor(() => expect(screen.getByText('No se pudo crear')).toBeInTheDocument());
  });
});
