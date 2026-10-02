/**
 * HitlReviewModal.test.jsx
 * Pruebas unitarias para el modal bloqueante de revisión del checkpoint HITL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HitlReviewModal from './HitlReviewModal';

const hitlData = {
  perfil_paci: '## Diagnóstico\nResultado: TEA nivel uno detectado.',
  planificacion_adaptada: '## Material\n- Actividad adaptada número siete.',
  attempt: 1,
  max_attempts: 3,
};

describe('HitlReviewModal', () => {
  let onRespond;
  beforeEach(() => {
    onRespond = vi.fn();
  });

  it('muestra el encabezado con el número de intento', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    expect(screen.getByText(/Revisión requerida/i)).toBeInTheDocument();
    expect(screen.getByText(/intento 1 de 3/i)).toBeInTheDocument();
  });

  it('muestra por defecto el Análisis PACI renderizado como Markdown', () => {
    const { container } = render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    expect(container.textContent).toContain('TEA nivel uno detectado.');
    expect(container.textContent).not.toContain('Actividad adaptada número siete.');
    expect(container.textContent).not.toContain('##');
  });

  it('cambia a la pestaña de Planificación al hacer clic', () => {
    const { container } = render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole('button', { name: /Planificación Adaptada/i }));
    expect(container.textContent).toContain('Actividad adaptada número siete.');
    expect(container.textContent).not.toContain('TEA nivel uno detectado.');
  });

  it('es bloqueante: no expone botón de cerrar', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    expect(screen.queryByLabelText(/cerrar/i)).not.toBeInTheDocument();
  });

  it('es bloqueante: Escape no responde el checkpoint', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onRespond).not.toHaveBeenCalled();
  });

  it('es bloqueante: clic en el overlay no responde el checkpoint', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    fireEvent.click(screen.getByTestId('hitl-overlay'));
    expect(onRespond).not.toHaveBeenCalled();
  });

  it('Aprobar responde { approved: true }', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole('button', { name: /Aprobar/i }));
    expect(onRespond).toHaveBeenCalledWith({ approved: true });
  });

  it('Rechazar exige un motivo antes de poder confirmar', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole('button', { name: /Rechazar/i }));

    const confirmar = screen.getByRole('button', { name: /Confirmar rechazo/i });
    expect(confirmar).toBeDisabled();
    expect(onRespond).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'El diagnóstico no considera el TDAH.' },
    });
    expect(confirmar).toBeEnabled();
  });

  it('Rechazar con motivo responde { approved: false, reason }', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole('button', { name: /Rechazar/i }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'El diagnóstico no considera el TDAH.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rechazo/i }));

    expect(onRespond).toHaveBeenCalledWith({
      approved: false,
      reason: 'El diagnóstico no considera el TDAH.',
    });
  });

  it('Volver regresa al estado inicial de decisión', () => {
    render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
    fireEvent.click(screen.getByRole('button', { name: /Rechazar/i }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Volver/i }));
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aprobar/i })).toBeInTheDocument();
  });

  describe('cancelar el proceso', () => {
    it('muestra "Cancelar proceso" solo cuando se entrega onCancel', () => {
      const { rerender } = render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} />);
      expect(screen.queryByRole('button', { name: /Cancelar proceso/i })).not.toBeInTheDocument();
      rerender(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} onCancel={() => {}} />);
      expect(screen.getByRole('button', { name: /Cancelar proceso/i })).toBeInTheDocument();
    });

    it('llama a onCancel sin enviar ninguna decisión', () => {
      const onCancel = vi.fn();
      render(<HitlReviewModal hitlData={hitlData} onRespond={onRespond} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /Cancelar proceso/i }));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onRespond).not.toHaveBeenCalled();
    });
  });
});
