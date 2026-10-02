import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useActiveSession } from '../context/ActiveSessionContext';

/**
 * Al iniciar sesión, pregunta al servidor si el docente tiene un flujo activo para poder retomarlo
 * (cerró el navegador, cambió de equipo o perdió la conexión). No renderiza nada.
 */
const ActiveSessionSync = () => {
  const { isAuthenticated, isPending } = useAuth();
  const { syncFromServer } = useActiveSession();

  useEffect(() => {
    if (isAuthenticated && !isPending) syncFromServer();
  }, [isAuthenticated, isPending, syncFromServer]);

  return null;
};

export default ActiveSessionSync;
