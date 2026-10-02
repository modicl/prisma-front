import { useState, useEffect } from 'react';
import MarkdownView from './MarkdownView';

/**
 * HitlReviewModal
 * Modal bloqueante para el checkpoint HITL: el profesor revisa el Análisis PACI y la
 * Planificación Adaptada (Markdown renderizado) y decide aprobar o rechazar con un motivo.
 *
 * Bloqueante: no expone botón de cerrar, el clic en el overlay y la tecla Escape no resuelven
 * el checkpoint. Solo se sale al Aprobar o Confirmar rechazo.
 *
 * @param {{
 *   hitlData: { perfil_paci: string, planificacion_adaptada: string, attempt: number, max_attempts: number },
 *   onRespond: (decision: { approved: boolean, reason?: string }) => void,
 *   onCancel?: () => void   // si se entrega, aparece «Cancelar proceso» (detiene todo el flujo)
 * }} props
 */
const TABS = [
  { id: 'analisis', label: 'Análisis PACI (Agente 1)', key: 'perfil_paci' },
  { id: 'planificacion', label: 'Planificación Adaptada (Agente 2)', key: 'planificacion_adaptada' },
];

const HitlReviewModal = ({ hitlData, onRespond, onCancel }) => {
  const [activeTab, setActiveTab] = useState('analisis');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  // Bloqueante: neutraliza Escape para que ningún listener global cierre el modal.
  useEffect(() => {
    const blockEscape = (e) => {
      if (e.key === 'Escape') e.stopPropagation();
    };
    document.addEventListener('keydown', blockEscape, true);
    return () => document.removeEventListener('keydown', blockEscape, true);
  }, []);

  const activeContent = hitlData[TABS.find((t) => t.id === activeTab).key] || '';
  const canConfirmReject = reason.trim().length > 0;

  const handleApprove = () => onRespond({ approved: true });
  const handleConfirmReject = () => {
    if (!canConfirmReject) return;
    onRespond({ approved: false, reason: reason.trim() });
  };

  return (
    <div
      data-testid="hitl-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Revisión requerida"
        className="bg-white dark:bg-stone-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header fijo */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-200 dark:border-stone-700 flex-shrink-0">
          <span className="material-symbols-outlined text-amber-500 text-xl">pending_actions</span>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            Revisión requerida — intento {hitlData.attempt} de {hitlData.max_attempts}
          </h2>
        </div>

        {/* Pestañas */}
        <div className="flex gap-1 px-4 pt-3 border-b border-stone-200 dark:border-stone-700 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-lime-500 text-stone-900 dark:text-stone-100'
                  : 'border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Cuerpo con scroll */}
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <MarkdownView>{activeContent}</MarkdownView>
        </div>

        {/* Footer fijo: decisión */}
        <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-700 flex-shrink-0">
          {!rejecting ? (
            <div className="space-y-2">
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-lime-600 text-white hover:bg-lime-700 transition-colors"
              >
                Aprobar
              </button>
              <button
                onClick={() => setRejecting(true)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                Rechazar
              </button>
            </div>
            {onCancel && (
              <button
                onClick={onCancel}
                className="w-full py-2 rounded-xl text-sm font-medium text-stone-500 dark:text-stone-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Cancelar proceso
              </button>
            )}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                ¿Qué debería corregirse?
              </label>
              <textarea
                className="w-full border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-lime-400 resize-none"
                rows={3}
                placeholder="Describe el problema encontrado (requerido)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => { setRejecting(false); setReason(''); }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                >
                  Volver
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={!canConfirmReject}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Confirmar rechazo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HitlReviewModal;
