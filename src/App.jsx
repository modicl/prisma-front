/**
 * App.jsx
 * Componente principal con routing
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ActiveSessionProvider } from './context/ActiveSessionContext';
import FloatingSessionIndicator from './components/ui/FloatingSessionIndicator';
import ActiveSessionSync from './components/ActiveSessionSync';
import SessionToast from './components/ui/SessionToast';

// Páginas
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import PACIPage from './pages/PACIPage';
import AjustadorPage from './pages/AjustadorPage';
import NuevaSesionPage from './pages/NuevaSesionPage';
import SesionPage from './pages/SesionPage';
import HistorialPage from './pages/HistorialPage';
import AyudaPage from './pages/AyudaPage';
import AdminPanelPage from './pages/AdminPanelPage';
import ColegiosPage from './pages/ColegiosPage';
import SoportePage from './pages/SoportePage';
import ForbiddenPage from './pages/ForbiddenPage';
import PendingPage from './pages/PendingPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

/**
 * ProtectedRoute
 * Componente para proteger rutas que requieren autenticación
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isPending } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Autenticado pero sin grupo en Cognito: no puede entrar a ninguna sección.
  if (isPending) {
    return <Navigate to="/pending" replace />;
  }

  return children;
};

/**
 * Ruta de la pantalla de espera. Requiere sesión, pero es la única que un
 * PENDING puede ver; a un usuario ya habilitado lo devuelve al dashboard para
 * que no quede varado acá.
 */
const PendingRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isPending } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isPending) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isAdmin, isPending } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isPending) {
    return <Navigate to="/pending" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};

const SuperAdminRoute = ({ children }) => {
  const { isAuthenticated, isLoading, isSuperAdmin, isPending } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isPending) {
    return <Navigate to="/pending" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
};

/**
 * AppContent
 * Contenedor de rutas (separado de App para poder usar useAuth hook)
 */
const AppContent = () => {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      <Route
        path="/pending"
        element={
          <PendingRoute>
            <PendingPage />
          </PendingRoute>
        }
      />

      {/* Rutas protegidas */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/paci"
        element={
          <ProtectedRoute>
            <PACIPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ajustador"
        element={
          <ProtectedRoute>
            <AjustadorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/nueva-sesion"
        element={
          <ProtectedRoute>
            <NuevaSesionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sesion/:sessionId"
        element={
          <ProtectedRoute>
            <SesionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/historial"
        element={
          <ProtectedRoute>
            <HistorialPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ayuda"
        element={
          <ProtectedRoute>
            <AyudaPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/soporte"
        element={
          <ProtectedRoute>
            <SoportePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPanelPage />
          </AdminRoute>
        }
      />
      <Route
        path="/colegios"
        element={
          <SuperAdminRoute>
            <ColegiosPage />
          </SuperAdminRoute>
        }
      />

      {/* Ruta por defecto - redirige a dashboard o login */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

/**
 * App
 * Componente principal con providers
 */
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ActiveSessionProvider>
          <ActiveSessionSync />
          <AppContent />
          <FloatingSessionIndicator />
          <SessionToast />
        </ActiveSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
