import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainContainer from '../components/layout/MainContainer';
import { useActiveSession } from '../context/ActiveSessionContext';
import { Button, Alert } from '../components/ui';
import jobsService from '../services/jobsService';

const STEPS = [
  { id: 1, label: 'Perfil PACI', icon: 'description' },
  { id: 2, label: 'Material Base', icon: 'library_books' },
  { id: 3, label: 'Prompt', icon: 'edit_note' },
];

const PROMPT_MAX = 4000;

const FileZone = ({ file, onFileChange, accept, label, hint }) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFileChange(dropped);
  };

  return (
    <div
      onClick={() => inputRef.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`border-2 border-dashed rounded-3xl p-10 cursor-pointer transition-all duration-200 flex flex-col items-center gap-4 text-center select-none
        ${dragging
          ? 'border-lime-500 bg-lime-50 dark:bg-lime-950/20'
          : file
            ? 'border-lime-400 bg-lime-50/50 dark:bg-lime-950/10'
            : 'border-stone-300 dark:border-stone-700 hover:border-lime-400 hover:bg-stone-50 dark:hover:bg-stone-900'
        }`}
    >
      <span className={`material-symbols-outlined text-5xl ${file ? 'text-lime-600 dark:text-lime-400' : 'text-stone-400'}`}>
        {file ? 'check_circle' : 'upload_file'}
      </span>
      {file ? (
        <>
          <p className="font-semibold text-lime-700 dark:text-lime-400">{file.name}</p>
          <p className="text-xs text-stone-500">{(file.size / 1024 / 1024).toFixed(2)} MB · clic para cambiar</p>
        </>
      ) : (
        <>
          <p className="font-medium text-stone-700 dark:text-stone-300">{label}</p>
          <p className="text-sm text-stone-500">{hint}</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files[0] && onFileChange(e.target.files[0])}
      />
    </div>
  );
};

const StepIndicator = ({ currentStep }) => (
  <div className="flex items-center justify-center gap-2">
    {STEPS.map((s, i) => (
      <React.Fragment key={s.id}>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
          ${currentStep === s.id
            ? 'bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900'
            : currentStep > s.id
              ? 'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-400'
              : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {currentStep > s.id ? 'check' : s.icon}
          </span>
          <span className="hidden sm:inline">{s.label}</span>
        </div>
        {i < STEPS.length - 1 && (
          <div className={`h-0.5 w-6 rounded-full transition-all duration-300 ${currentStep > s.id ? 'bg-lime-400' : 'bg-stone-200 dark:bg-stone-700'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

const NuevaSesionPage = () => {
  const navigate = useNavigate();
  const { startTracking } = useActiveSession();
  const [step, setStep] = useState(1);
  const [paciFile, setPaciFile] = useState(null);
  const [planningFile, setPlanningFile] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'P.R.I.S.M.A. - Adaptar Contenido con IA';
  }, []);

  const canAdvance = () => {
    if (step === 1) return !!paciFile;
    if (step === 2) return !!planningFile;
    if (step === 3) return true;
    return false;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await jobsService.createJob(paciFile, planningFile, prompt.trim());
      startTracking(result.jobId);
      navigate(`/sesion/${result.jobId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPaciFile(null);
    setPlanningFile(null);
    setPrompt('');
    setError(null);
    setStep(1);
  };

  return (
    <MainContainer title="Nueva Sesión">
      <div className="max-w-xl mx-auto space-y-8">
        <StepIndicator currentStep={step} />

        <div className="bg-stone-50 dark:bg-stone-950 rounded-3xl p-8 shadow-sm space-y-5">
          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Perfil PACI</h2>
                <p className="text-stone-500 text-sm mt-1">
                  Sube el Plan de Adecuación Curricular Individual del alumno. El agente lo usará como base para generar el documento adaptado.
                </p>
              </div>
              <FileZone
                file={paciFile}
                onFileChange={setPaciFile}
                accept=".pdf,.docx"
                label="Arrastra aquí o haz clic para subir el Perfil PACI"
                hint="Formatos aceptados: PDF, DOCX · Máximo 25 MB"
              />
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Documento de Material Base</h2>
                <p className="text-stone-500 text-sm mt-1">
                  Sube la planificación curricular o el material de referencia del docente. El agente lo tomará como contexto para adaptar el PACI.
                </p>
              </div>
              <FileZone
                file={planningFile}
                onFileChange={setPlanningFile}
                accept=".pdf,.docx"
                label="Arrastra aquí o haz clic para subir el Material Base"
                hint="Formatos aceptados: PDF, DOCX · Máximo 25 MB"
              />
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h2 className="text-xl font-bold text-stone-900 dark:text-stone-100">Prompt del Docente</h2>
                <p className="text-stone-500 text-sm mt-1">
                  Escribe las instrucciones para refinar el flujo del agente. Indica el alumno, sus necesidades específicas y lo que esperas como resultado.
                </p>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
                placeholder="Ej: Genera un PACI adaptado para un alumno de 3° básico con TEA grado 2, enfocado en matemáticas y lenguaje. Considera que el alumno tiene dificultades en comprensión lectora..."
                className="w-full h-44 p-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 placeholder-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-lime-400 text-sm transition-all"
              />
              <div className="flex items-center justify-between">
                <span />
                <p className={`text-xs text-right ${prompt.length >= PROMPT_MAX ? 'text-red-400' : 'text-stone-400'}`}>
                  {prompt.length} / {PROMPT_MAX} caracteres
                </p>
              </div>
              {error && (
                <Alert variant="error">{error}</Alert>
              )}
            </>
          )}
        </div>

        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            icon="arrow_back"
            onClick={() => { setError(null); setStep(s => s - 1); }}
            disabled={step === 1}
          >
            Atrás
          </Button>

          {step < 3 ? (
            <Button
              variant="primary"
              disabled={!canAdvance()}
              onClick={() => setStep(s => s + 1)}
            >
              Siguiente
            </Button>
          ) : (
            <Button
              variant="primary"
              icon="send"
              disabled={!canAdvance() || loading}
              loading={loading}
              onClick={handleSubmit}
            >
              Crear Sesión
            </Button>
          )}
        </div>
      </div>
    </MainContainer>
  );
};

export default NuevaSesionPage;
