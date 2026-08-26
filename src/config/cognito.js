/**
 * Configuración de Amazon Cognito (Amplify Auth v6)
 *
 * Se llama una sola vez, al arrancar la app (src/index.jsx).
 *
 * Si las variables VITE_COGNITO_* no están definidas, la configuración se
 * omite y la app sigue funcionando con el login legacy contra el BFF.
 * Esto es lo que permite la convivencia de los dos sistemas de auth
 * mientras dura la migración.
 */

import { Amplify } from 'aws-amplify';

const env = import.meta.env;

const USER_POOL_ID = env.VITE_COGNITO_USER_POOL_ID ?? '';
const CLIENT_ID = env.VITE_COGNITO_CLIENT_ID ?? '';
// OJO: sin "https://" — Amplify lo agrega solo. Con protocolo, falla.
const DOMAIN = (env.VITE_COGNITO_DOMAIN ?? '').replace(/^https?:\/\//, '');

/** ¿Está Cognito configurado en este build? */
export const isCognitoEnabled = Boolean(USER_POOL_ID && CLIENT_ID && DOMAIN);

export const configureCognito = () => {
  if (!isCognitoEnabled) {
    return false;
  }

  // Las callback URLs se derivan del origen actual para que el mismo build
  // funcione en localhost:3002 y en el dominio de Amplify. Ambos orígenes
  // tienen que estar registrados en el App Client de Cognito.
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: CLIENT_ID,
        loginWith: {
          oauth: {
            domain: DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [`${origin}/auth/callback`],
            redirectSignOut: [`${origin}/login`],
            responseType: 'code', // Authorization Code + PKCE
          },
        },
      },
    },
  });

  return true;
};

export default configureCognito;
