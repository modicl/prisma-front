/**
 * PendingPage
 *
 * Pantalla para usuarios autenticados que todavía no tienen un grupo asignado
 * en Cognito (rol PENDING). Muestra la identidad que trae el token y nada más.
 *
 * No hace NINGUNA llamada a la API a propósito: los guards del backend
 * rechazan a un PENDING con 403, así que cualquier fetch acá se vería como un
 * error roto en vez de este mensaje. Todo lo que muestra sale del ID token.
 */

import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const PendingPage = () => {
  const { user, logout } = useAuth();

  useEffect(() => {
    document.title = 'P.R.I.S.M.A. - Cuenta pendiente';
  }, []);

  const nombre = user?.nombreCompleto || user?.nombre || user?.email || 'Usuario';
  const inicial = nombre.trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-8 text-center shadow-xl">
        <span className="material-symbols-outlined text-5xl text-tertiary" aria-hidden="true">
          hourglass_top
        </span>

        <h1 className="mt-4 text-2xl font-bold text-on-surface">
          Tu cuenta está pendiente de autorización
        </h1>
        <p className="mt-3 text-on-surface-variant">
          Ingresaste correctamente, pero todavía no tienes acceso a P.R.I.S.M.A. Un administrador
          debe habilitar tu cuenta antes de que puedas usar el sistema.
        </p>

        {/* Identidad, tal como la ve el sistema */}
        <div className="mt-8 flex items-center gap-4 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 text-left">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-on-primary"
            aria-hidden="true"
          >
            {inicial}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-on-surface">{nombre}</p>
            {user?.email && (
              <p className="truncate text-sm text-on-surface-variant">{user.email}</p>
            )}
          </div>
        </div>

        <p className="mt-6 text-sm text-on-surface-variant">
          Comparte este correo con el administrador para que habilite tu acceso.
        </p>

        <button
          type="button"
          onClick={logout}
          className="mt-6 inline-flex items-center justify-center rounded-full border border-outline-variant/40 px-5 py-3 font-medium text-on-surface transition-colors hover:bg-surface-container-low"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};

export default PendingPage;
