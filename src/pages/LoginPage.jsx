/**
 * LoginPage
 * Página de autenticación
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input, Button, Alert, Spinner } from '../components';
import authService from '../services/authService';
import {
  signInWithGoogle,
  signInWithMicrosoft,
  getCognitoSession,
  signOutCognito,
} from '../services/cognitoAuth';

const LoginPage = () => {
  const navigate = useNavigate();
  const {
    login,
    loginFromCognito,
    isCognitoEnabled,
    isAuthenticated,
    isLoading: isSessionLoading,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    document.title = 'P.R.I.S.M.A. - Iniciar Sesión';
  }, []);

  // Con sesión viva no hay nada que hacer acá. Sin esto, un 401 que limpió solo
  // el storage legacy dejaba al usuario en /login con la sesión de Cognito
  // intacta, y Amplify rechazaba el siguiente clic con "already a signed in user".
  useEffect(() => {
    if (!isSessionLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isSessionLoading, isAuthenticated, navigate]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!email.trim()) {
      newErrors.email = 'El correo es requerido';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Correo inválido';
    }
    
    if (!password.trim()) {
      newErrors.password = 'La contraseña es requerida';
    } else if (password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Amplify se niega a iniciar un login si ya tiene tokens guardados. Si esa
  // sesión sirve, entramos con ella; si no (tokens muertos), la limpiamos y
  // reintentamos una vez.
  const recoverFromExistingSession = async (signIn) => {
    const session = await getCognitoSession();
    if (session) {
      loginFromCognito(session.user);
      navigate('/dashboard', { replace: true });
      return;
    }
    await signOutCognito();
    await signIn();
  };

  // Redirige a Cognito -> IdP federado (Google o Microsoft). Vuelve a /auth/callback.
  const handleFederatedLogin = async (signIn, providerName) => {
    setApiError(null);
    setIsRedirecting(true);
    try {
      await signIn();
    } catch (error) {
      let finalError = error;
      if (error?.name === 'UserAlreadyAuthenticatedException') {
        try {
          await recoverFromExistingSession(signIn);
          return;
        } catch (retryError) {
          finalError = retryError;
        }
      }
      setIsRedirecting(false);
      setApiError(finalError?.message || `No se pudo conectar con ${providerName}. Intenta nuevamente.`);
    }
  };

  const handleGoogleLogin = () => handleFederatedLogin(signInWithGoogle, 'Google');
  const handleMicrosoftLogin = () => handleFederatedLogin(signInWithMicrosoft, 'Microsoft');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.login(email, password);
      login(response.user, response.tokens);
      const role = response.user?.role;
      if (role === 'SUPERADMIN') {
        navigate('/colegios');
      } else if (role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      setApiError(error.message || 'Error al iniciar sesión. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left Side: Editorial Canvas (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-surface-container-low to-primary-container p-16 flex-col justify-between overflow-hidden">
        {/* Abstract Shapes */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-primary opacity-5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 -right-20 w-[30rem] h-[30rem] bg-secondary-container opacity-10 rounded-full blur-3xl"></div>

        {/* Content */}
        <div className="relative z-10">
          <h2 className="font-headline font-bold text-3xl text-primary tracking-tight mb-2">P.R.I.S.M.A.</h2>
          <p className="text-on-surface-variant italic text-lg">Modelo Agéntico con 4 IAs</p>
        </div>

        <div className="relative z-10 max-w-lg mt-auto mb-32">
          <h1 className="font-headline font-extrabold text-6xl text-on-primary-fixed leading-tight mb-8">
            Cultivando el aprendizaje <br />
            <span className="text-primary">personalizado.</span>
          </h1>
          <p className="font-body text-xl text-on-surface-variant leading-relaxed mb-12">
            Simplificamos la administración para que puedas enfocarte en lo que realmente importa: inspirar en el aula.
          </p>
          <div className="flex items-center space-x-4 bg-surface-container-lowest/60 backdrop-blur-md p-6 rounded-xl border border-outline-variant/15 w-max">
            <span className="material-symbols-outlined text-primary text-3xl fill-icon">eco</span>
            <div>
              <p className="font-body font-medium text-on-surface">Compatible con Formulario PACI</p>
              <p className="font-body text-sm text-on-surface-variant">Alineado al Decreto 83 del Ministerio de Educación</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-on-surface-variant">
          © 2026 P.R.I.S.M.A Team. Diseño para educadores de Chile. Todos los derechos reservados
        </div>
      </div>

      {/* Right Side: Login Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src="/logos/prisma_gif_logo.gif" 
              alt="P.R.I.S.M.A. Logo" 
              className="w-20 h-20 mx-auto"
            />
          </div>

          {/* Mobile Brand Header */}
          <div className="lg:hidden text-center mb-12">
            <h2 className="font-headline font-bold text-3xl text-primary tracking-tight">P.R.I.S.M.A.</h2>
            <p className="text-on-surface-variant italic mt-2">Modelo Agéntico con 4 IAs</p>
          </div>

          {/* Login Card */}
          <div className="bg-surface-container-lowest p-10 rounded-xl shadow-[0_20px_60px_-15px_rgba(35,26,7,0.06)] border border-outline-variant/15">
            {/* Header */}
            <div className="mb-10 text-center">
              <h3 className="font-headline font-bold text-2xl text-on-surface mb-2">Bienvenido de vuelta</h3>
              <p className="font-body text-on-surface-variant">Ingresa tus credenciales para acceder a tu escritorio.</p>
            </div>

            {/* Error Alert */}
            {apiError && (
              <Alert variant="error" className="mb-6">
                {apiError}
              </Alert>
            )}

            {/* Google / Cognito */}
            {isCognitoEnabled && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isRedirecting || isLoading}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body font-medium transition-colors hover:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55Z"/>
                    <path fill="#34A853" d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.88c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.55-2.02-6.46-4.75H1.69v2.98A11.5 11.5 0 0 0 12 23.5Z"/>
                    <path fill="#FBBC05" d="M5.54 14.17a6.9 6.9 0 0 1 0-4.34V6.85H1.69a11.5 11.5 0 0 0 0 10.3l3.85-2.98Z"/>
                    <path fill="#EA4335" d="M12 4.98c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.5 15.1.5 12 .5 7.52.5 3.65 3.07 1.69 6.85l3.85 2.98C6.45 7.1 9 4.98 12 4.98Z"/>
                  </svg>
                  {isRedirecting ? 'Redirigiendo...' : 'Continuar con Google'}
                </button>

                <button
                  type="button"
                  onClick={handleMicrosoftLogin}
                  disabled={isRedirecting || isLoading}
                  className="mt-3 w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl border border-outline-variant/40 bg-surface-container-lowest text-on-surface font-body font-medium transition-colors hover:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="1" y="1" width="10.5" height="10.5" fill="#F25022"/>
                    <rect x="12.5" y="1" width="10.5" height="10.5" fill="#7FBA00"/>
                    <rect x="1" y="12.5" width="10.5" height="10.5" fill="#00A4EF"/>
                    <rect x="12.5" y="12.5" width="10.5" height="10.5" fill="#FFB900"/>
                  </svg>
                  {isRedirecting ? 'Redirigiendo...' : 'Continuar con Microsoft'}
                </button>

                <div className="flex items-center gap-4 my-6" role="separator">
                  <span className="h-px flex-1 bg-outline-variant/30" />
                  <span className="font-body text-sm text-on-surface-variant">
                    o ingresa con tu correo
                  </span>
                  <span className="h-px flex-1 bg-outline-variant/30" />
                </div>
              </>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <Input
                label="Correo Electrónico"
                type="email"
                placeholder="ejemplo@escuela.cl"
                icon="mail"
                iconPosition="left"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: null });
                }}
                error={errors.email}
              />

              {/* Password Field */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-on-surface">Contraseña</label>
                  <a href="#" className="text-sm text-primary hover:text-on-primary-container transition-colors">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <Input
                  type="password"
                  placeholder="••••••••"
                  icon="lock"
                  iconPosition="left"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: null });
                  }}
                  error={errors.password}
                />
              </div>

              {/* CTA Button */}
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="lg"
                loading={isLoading}
                className="mt-8"
              >
                {isLoading ? 'Ingresando...' : 'Ingresar a mi Aula'}
              </Button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-8 text-center">
              <p className="text-sm text-on-surface-variant">
                ¿No tienes una cuenta?{' '}
                <a href="#" className="text-primary font-semibold hover:text-on-primary-container transition-colors underline decoration-primary/30 hover:decoration-primary underline-offset-4">
                  Solicitar acceso institucional
                </a>
              </p>
            </div>
          </div>

          {/* Footer for Mobile */}
          <div className="lg:hidden mt-12 text-center text-sm text-on-surface-variant">
            <p>Sistema PACI Chileno</p>
            <p>Ministerio de Educación</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
