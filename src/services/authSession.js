import storageUtils from '../utils/localStorage';
import { signOutCognito } from './cognitoAuth';

const LOGIN_PATH = '/login';

let redirectInProgress = false;

export const resetAuthRedirectLock = () => {
  redirectInProgress = false;
};

export const clearLocalAuthSession = () => {
  storageUtils.clearSession();
};

export const shouldRedirectToLogin = (errorResponse, requestUrl) => {
  if (typeof requestUrl === 'string' && requestUrl.includes('/api/auth/login')) {
    return false;
  }

  if (errorResponse?.code === 'AUTH_INVALID_CREDENTIALS') {
    return false;
  }

  return true;
};

export const redirectToLogin = () => {
  if (typeof window === 'undefined') {
    return;
  }

  clearLocalAuthSession();

  if (redirectInProgress) {
    return;
  }

  redirectInProgress = true;

  // Los tokens de Cognito viven en el storage de Amplify, no en el nuestro.
  // Si no se borran también, /login muestra el formulario con una sesión viva
  // y Amplify rechaza el siguiente signInWithRedirect.
  const volverAlLogin = () => {
    if (window.location.pathname !== LOGIN_PATH) {
      window.location.replace(LOGIN_PATH);
    }
  };
  signOutCognito().then(volverAlLogin, volverAlLogin);
};

export const handleAuthFailure = (errorResponse, requestUrl) => {
  if (!shouldRedirectToLogin(errorResponse, requestUrl)) {
    return false;
  }

  redirectToLogin();
  return false;
};