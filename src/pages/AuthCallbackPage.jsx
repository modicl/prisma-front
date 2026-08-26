/**
 * AuthCallbackPage
 *
 * Aterrizaje del redirect de Cognito (/auth/callback?code=...).
 * Amplify canjea el `code` por tokens automáticamente; acá solo esperamos
 * a que termine, hidratamos el AuthContext y redirigimos según el rol.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hub } from 'aws-amplify/utils';
import { useAuth } from '../context/AuthContext';
import { getCognitoSession } from '../services/cognitoAuth';

const ROUTE_BY_ROLE = {
  SUPERADMIN: '/colegios',
  ADMIN: '/admin',
  TEACHER: '/dashboard',
};

const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { loginFromCognito } = useAuth();
  const [error, setError] = useState(null);
  const settled = useRef(false);

  useEffect(() => {
    document.title = 'P.R.I.S.M.A. - Ingresando...';
  }, []);

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      if (settled.current || cancelled) return;
      const session = await getCognitoSession();
      if (!session || cancelled) return;

      settled.current = true;
      loginFromCognito(session.user);
      navigate(ROUTE_BY_ROLE[session.user.role] ?? '/dashboard', { replace: true });
    };

    const fail = (message) => {
      if (settled.current || cancelled) return;
      settled.current = true;
      setError(message);
    };

    // Amplify emite estos eventos al terminar (o fallar) el canje del code.
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect' || payload.event === 'signedIn') {
        finish();
      }
      if (payload.event === 'signInWithRedirect_failure') {
        fail(payload.data?.error?.message ?? 'No se pudo completar el inicio de sesión.');
      }
    });

    // Fallback: si el evento ya pasó antes de montar este componente,
    // reintentamos leer la sesión durante unos segundos.
    let attempts = 0;
    const poll = setInterval(() => {
      attempts += 1;
      finish();
      if (settled.current || attempts >= 20) {
        clearInterval(poll);
        if (!settled.current) {
          fail('Se agotó el tiempo de espera al iniciar sesión. Volvé a intentarlo.');
        }
      }
    }, 400);

    finish();

    return () => {
      cancelled = true;
      clearInterval(poll);
      unsubscribe();
    };
  }, [loginFromCognito, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-8">
      <div className="text-center max-w-md">
        {error ? (
          <>
            <span className="material-symbols-outlined text-5xl text-error mb-4">error</span>
            <h1 className="font-headline font-bold text-2xl text-on-surface mb-2">
              No pudimos iniciar tu sesión
            </h1>
            <p className="font-body text-on-surface-variant mb-8">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="text-primary font-semibold underline underline-offset-4"
            >
              Volver al inicio de sesión
            </button>
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-6" />
            <p className="font-body text-on-surface-variant">Validando tu identidad...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
