import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainContainer from '../components/layout/MainContainer';
import chatService from '../services/chatService';
import { useActiveSession } from '../context/ActiveSessionContext';
import FeedbackWidget from '../components/features/FeedbackWidget';
import HitlReviewModal from '../components/features/HitlReviewModal';
import ComplianceNotice from '../components/features/ComplianceNotice';

// ── MessageBubble ────────────────────────────────────────────────────────────

const MessageBubble = ({ role, content }) => {
  const isAgent = role === 'agent';
  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'} mb-3`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
        isAgent
          ? 'bg-stone-100 dark:bg-stone-900 text-stone-800 dark:text-stone-200 rounded-tl-sm'
          : 'bg-lime-50 dark:bg-lime-950/30 text-lime-900 dark:text-lime-100 rounded-tr-sm'
      }`}>
        {content}
      </div>
    </div>
  );
};

// ── Spinner ──────────────────────────────────────────────────────────────────

const Spinner = () => (
  <div className="w-4 h-4 border-2 border-lime-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
);

// ── Phase config ─────────────────────────────────────────────────────────────

const PHASE_CONFIG = {
  running:            { label: 'Procesando',               badge: 'text-lime-700 bg-lime-100 dark:text-lime-400 dark:bg-lime-950/40',    icon: 'autorenew' },
  awaiting_hitl:      { label: 'Esperando revisión',       badge: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40', icon: 'pending_actions' },
  completed:          { label: 'Completado',               badge: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-950/40', icon: 'check_circle' },
  completed_degraded: { label: 'Completado con advertencia', badge: 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-950/40', icon: 'warning' },
  cancelled:          { label: 'Cancelada',                badge: 'text-stone-700 bg-stone-100 dark:text-stone-300 dark:bg-stone-800',   icon: 'cancel' },
  error_hitl_rejected:{ label: 'Sin aprobación',           badge: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-950/40',    icon: 'cancel' },
  error:              { label: 'Error',                    badge: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/40',        icon: 'error' },
  compliance_blocked: { label: 'No conforme', badge: 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-950/40', icon: 'gavel' },
};

// ── SesionPage ───────────────────────────────────────────────────────────────

const SesionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { startTracking, stopTracking } = useActiveSession();

  const [phase, setPhase] = useState('running');
  const [workflowStatus, setWorkflowStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hitlData, setHitlData] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [currentStep, setCurrentStep] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const bottomRef = useRef(null);

  // Cuando la sesión termina mientras el usuario está en esta página,
  // limpiar el tracking global para que el indicador flotante no aparezca
  // al navegar a otra vista (el usuario ya vio el resultado aquí).
  useEffect(() => {
    if (phase === 'completed' || phase === 'error') {
      stopTracking();
    }
  }, [phase, stopTracking]);

  // ── Polling del estado de la sesión ───────────────────────────────────────
  // Reemplaza la conexión SSE: API Gateway corta cualquier respuesta a los 30s y
  // un flujo completo tarda entre 5 y 15 minutos. `GET /chat/:id/state` lee de
  // DynamoDB, así que además sobrevive a un reinicio del backend.
  useEffect(() => {
    let cancelled = false;
    let stopPolling = null;

    const applyState = (state) => {
      setMessages(state.messages || []);
      if (state.hitl_data) setHitlData(state.hitl_data);
      if (state.error) setError(state.error);
      setWorkflowStatus(state.workflow_status || null);
      setWarnings(state.warnings || []);
      // `current_step` todavía no viaja en GET /state (sale del evento `agent_start`,
      // que no se espeja a DynamoDB). Queda leído para cuando el backend lo agregue.
      setCurrentStep(state.current_step || '');
      setPhase(state.phase);
    };

    const hydrate = async () => {
      try {
        const state = await chatService.getSessionState(sessionId);
        if (cancelled) return;
        applyState(state);

        // No arrancar el polling si la sesión ya terminó
        if (state.phase === 'completed' || state.phase === 'error') return;

        // Registrar en contexto global (soporte para page refresh)
        startTracking(sessionId);

        stopPolling = chatService.subscribeToSessionState(
          sessionId,
          (next) => { if (!cancelled) applyState(next); },
          {
            onError: (err) => {
              if (cancelled) return;
              setError(err.message);
              setPhase('error');
            },
          },
        );
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        setPhase('error');
      }
    };

    hydrate();

    return () => {
      cancelled = true;
      if (stopPolling) stopPolling();
    };
  }, [sessionId, startTracking]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, hitlData, phase]);

  const handleCancel = async () => {
    if (!window.confirm('¿Seguro que deseas cancelar esta sesión? El proceso se detendrá y no podrá retomarse.')) return;
    setCancelling(true);
    try {
      await chatService.cancelSession(sessionId);
    } catch (err) {
      console.error('Cancel error:', err);
    } finally {
      setCancelling(false);
    }
  };

  const handleHitlRespond = async (response) => {
    await chatService.sendHitlDecision(
      sessionId,
      response.approved,
      response.reason,
    );
    setHitlData(null);
    setPhase('running');
  };

  const phaseKey =
    phase === 'error'     && workflowStatus === 'compliance_blocked' ? 'compliance_blocked' :
    phase === 'completed' && workflowStatus === 'degraded'      ? 'completed_degraded' :
    phase === 'error'     && workflowStatus === 'cancelled'      ? 'cancelled' :
    phase === 'error'     && workflowStatus === 'hitl_rejected'  ? 'error_hitl_rejected' :
    phase;
  const phaseConf = PHASE_CONFIG[phaseKey] || PHASE_CONFIG.running;

  return (
    <MainContainer title="Sesión en curso">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">

        {/* Session header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-stone-400 mb-0.5">ID de sesión</p>
            <p className="font-mono text-sm text-stone-600 dark:text-stone-300 break-all">{sessionId}</p>
          </div>
          <div className="flex items-center gap-3">
            {(phase === 'running' || phase === 'awaiting_hitl') && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-40 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">stop_circle</span>
                {cancelling ? 'Cancelando...' : 'Cancelar sesión'}
              </button>
            )}
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${phaseConf.badge}`}>
              <span className={`material-symbols-outlined text-sm ${phase === 'running' ? 'animate-spin' : ''}`}>
                {phaseConf.icon}
              </span>
              {phaseConf.label}
            </span>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Escritorio
            </button>
          </div>
        </div>

        {/* Chat card */}
        <div className="bg-stone-50 dark:bg-stone-950 rounded-3xl shadow-sm overflow-hidden">
          <div
            className="overflow-y-auto px-6 py-6"
            style={{ minHeight: '55vh', maxHeight: 'calc(100vh - 260px)' }}
          >
            {messages.length === 0 && phase === 'running' && (
              <p className="text-stone-400 text-sm text-center mt-12">Iniciando procesamiento...</p>
            )}

            {messages.map((msg, i) => (
              <MessageBubble key={i} role={msg.role} content={msg.content} />
            ))}

            {phase === 'awaiting_hitl' && hitlData && (
              <HitlReviewModal hitlData={hitlData} onRespond={handleHitlRespond} />
            )}

            {phase === 'running' && (
              <div className="flex items-center gap-2 text-stone-400 text-sm pt-2 pl-1">
                <Spinner />
                <span>{currentStep || 'El agente está procesando...'}</span>
              </div>
            )}

            {phase === 'completed' && workflowStatus === 'success' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <span className="material-symbols-outlined text-5xl text-lime-500">check_circle</span>
                <p className="text-green-700 dark:text-green-400 text-sm text-center font-medium">
                  Rúbrica generada y validada por el evaluador interno.
                </p>
                <button
                  onClick={async () => { setDownloading(true); try { await chatService.downloadResult(sessionId); } finally { setDownloading(false); } }}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 bg-lime-600 hover:bg-lime-700 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-2xl transition-colors text-sm shadow-sm mt-1"
                >
                  {downloading ? <Spinner /> : <span className="material-symbols-outlined text-base">download</span>}
                  Descargar PACI Adaptado (.docx)
                </button>
                {warnings.length > 0 && <ComplianceNotice warnings={warnings} />}
                <FeedbackWidget sessionId={sessionId} />
              </div>
            )}

            {phase === 'completed' && workflowStatus === 'degraded' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-300 w-full flex items-start gap-2">
                  <span className="material-symbols-outlined text-base flex-shrink-0">warning</span>
                  <span>
                    La rúbrica fue generada como mejor esfuerzo pero no superó todos los criterios
                    de calidad del evaluador.{' '}
                    <strong>Revise el documento antes de usarlo.</strong>
                  </span>
                </div>
                <button
                  onClick={async () => { setDownloading(true); try { await chatService.downloadResult(sessionId); } finally { setDownloading(false); } }}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-8 py-3 rounded-2xl transition-colors text-sm shadow-sm mt-1"
                >
                  {downloading ? <Spinner /> : <span className="material-symbols-outlined text-base">download</span>}
                  Descargar PACI Adaptado (.docx)
                </button>
                <FeedbackWidget sessionId={sessionId} />
              </div>
            )}

            {phase === 'error' && workflowStatus === 'cancelled' && (
              <div className="bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-600 rounded-2xl p-4 text-sm mt-2">
                <p className="font-semibold mb-1 flex items-center gap-1.5 text-stone-800 dark:text-stone-200">
                  <span className="material-symbols-outlined text-base">stop_circle</span>
                  Sesión cancelada
                </p>
                <p className="text-stone-700 dark:text-stone-300">
                  El docente canceló el proceso. Puede iniciar una nueva sesión cuando lo desee.
                </p>
                <button
                  onClick={() => navigate('/nueva-sesion')}
                  className="mt-3 text-xs font-semibold text-stone-700 dark:text-stone-300 underline hover:text-stone-900 dark:hover:text-stone-100"
                >
                  Iniciar nueva sesión
                </button>
              </div>
            )}

            {phase === 'error' && workflowStatus === 'hitl_rejected' && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-sm text-blue-800 dark:text-blue-300 mt-2">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">cancel</span>
                  Proceso cancelado
                </p>
                <p>
                  El análisis inicial no obtuvo aprobación del docente luego de 3 intentos.
                  Puede iniciar un nuevo proceso con los documentos corregidos.
                </p>
                <button
                  onClick={() => navigate('/nueva-sesion')}
                  className="mt-3 text-xs font-semibold text-blue-700 dark:text-blue-400 underline hover:text-blue-900 dark:hover:text-blue-200"
                >
                  Iniciar nuevo proceso
                </button>
              </div>
            )}

            {phase === 'error' && workflowStatus === 'compliance_blocked' && (
              <div className="mt-2">
                <ComplianceNotice blocked reason={error} />
                <button
                  onClick={() => navigate('/nueva-sesion')}
                  className="mt-3 text-xs font-semibold text-orange-700 dark:text-orange-400 underline hover:text-orange-900 dark:hover:text-orange-200"
                >
                  Iniciar nuevo proceso con un documento conforme
                </button>
              </div>
            )}

            {phase === 'error' && workflowStatus !== 'hitl_rejected' && workflowStatus !== 'compliance_blocked' && (
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 text-sm text-red-700 dark:text-red-400 mt-2">
                <p className="font-semibold mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">error</span>
                  Error durante el procesamiento
                </p>
                <p>{error || 'Ocurrió un error inesperado. Intente nuevamente.'}</p>
                <button
                  onClick={() => navigate('/nueva-sesion')}
                  className="mt-3 text-xs font-semibold text-red-700 dark:text-red-400 underline hover:text-red-900 dark:hover:text-red-200"
                >
                  Iniciar nuevo proceso
                </button>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

      </div>
    </MainContainer>
  );
};

export default SesionPage;
