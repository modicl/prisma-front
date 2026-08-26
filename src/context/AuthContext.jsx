/**
 * AuthContext
 * Contexto para manejar estado de autenticación a nivel global.
 *
 * Soporta dos orígenes de sesión mientras dura la migración a Cognito:
 *   1. Cognito (Amplify Auth) — preferido. Amplify refresca el token solo.
 *   2. Legacy: JWT emitido por el BFF y guardado en localStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import storageUtils from '../utils/localStorage';
import { resetAuthRedirectLock } from '../services/authSession';
import { getCognitoSession, signOutCognito } from '../services/cognitoAuth';
import { isCognitoEnabled } from '../config/cognito';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authSource, setAuthSource] = useState(null); // 'cognito' | 'legacy' | null
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const isSuperAdmin = user?.role === 'SUPERADMIN';

  // Recuperar sesión al montar: primero Cognito, después el token legacy.
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const session = await getCognitoSession();

      if (cancelled) return;

      if (session) {
        setUser(session.user);
        setIsAuthenticated(true);
        setAuthSource('cognito');
        resetAuthRedirectLock();
        setIsLoading(false);
        return;
      }

      const storedUser = storageUtils.getUser();
      if (storedUser && storageUtils.getToken()) {
        setUser(storedUser);
        setIsAuthenticated(true);
        setAuthSource('legacy');
        resetAuthRedirectLock();
      }

      setIsLoading(false);
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Chequeo de expiración cada 60s. Solo aplica al token legacy:
  // los tokens de Cognito los refresca Amplify automáticamente.
  useEffect(() => {
    if (authSource !== 'legacy') return undefined;

    const isTokenExpired = (token) => {
      if (!token) return true;
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        return payload.exp * 1000 < Date.now();
      } catch {
        return true;
      }
    };

    const checkToken = () => {
      const token = storageUtils.getToken();
      if (token && isTokenExpired(token)) {
        storageUtils.clearSession();
        setUser(null);
        setIsAuthenticated(false);
        setAuthSource(null);
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 60000);
    return () => clearInterval(interval);
  }, [authSource]);

  /** Login legacy contra el BFF (email + password). */
  const login = (userData, tokens) => {
    storageUtils.saveUser(userData);
    storageUtils.saveToken(tokens.access_token);
    storageUtils.saveRefreshToken(tokens.refresh_token);
    setUser(userData);
    setIsAuthenticated(true);
    setAuthSource('legacy');
    resetAuthRedirectLock();
  };

  /**
   * Login vía Cognito. No guarda tokens en localStorage a propósito:
   * de eso se encarga Amplify, y al recargar la página el efecto de
   * hidratación vuelve a leer la sesión.
   */
  const loginFromCognito = useCallback((userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setAuthSource('cognito');
    resetAuthRedirectLock();
  }, []);

  const logout = async () => {
    const wasCognito = authSource === 'cognito';

    storageUtils.clearSession();
    setUser(null);
    setIsAuthenticated(false);
    setAuthSource(null);
    resetAuthRedirectLock();

    if (wasCognito) {
      // Redirige al sign-out URL configurado en Cognito.
      await signOutCognito();
    }
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    if (authSource === 'legacy') {
      storageUtils.saveUser(newUser);
    }
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoading,
      isAdmin,
      isSuperAdmin,
      authSource,
      isCognitoEnabled,
      login,
      loginFromCognito,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};
