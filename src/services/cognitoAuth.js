/**
 * Cognito Auth Service
 *
 * Capa fina sobre Amplify Auth v6. Es el único lugar del front que sabe
 * que Cognito existe; el resto de la app consume `getAuthToken()` y
 * `getCognitoUser()`.
 *
 * Convivencia (migración en curso): mientras haya usuarios legacy que se
 * loguean contra el BFF, `getAuthToken()` prefiere el token de Cognito y
 * cae al token guardado en localStorage si no hay sesión federada.
 */

import { signInWithRedirect, signOut, fetchAuthSession } from 'aws-amplify/auth';
import storageUtils from '../utils/localStorage';
import { isCognitoEnabled } from '../config/cognito';

/**
 * Roles válidos, en orden de precedencia.
 *
 * IMPORTANTE: `cognito:groups` incluye grupos autogenerados por cada IdP
 * federado (ej. "us-east-1_h1uG5pYAS_Google") que NO son roles. Por eso el
 * rol se resuelve por lista blanca y nunca por posición (`groups[0]`).
 */
export const ROLES = ['SUPERADMIN', 'ADMIN', 'TEACHER'];
export const DEFAULT_ROLE = 'TEACHER';

export const resolveRole = (groups) => {
  const list = Array.isArray(groups) ? groups : [];
  return ROLES.find((role) => list.includes(role)) ?? DEFAULT_ROLE;
};

/**
 * Mapea los claims del ID token al shape de usuario que usa la app.
 * Los campos que Cognito no conoce (rut, institucion, especialidad) los
 * completa el BFF vía /api/auth/me.
 */
export const mapClaimsToUser = (claims) => ({
  id: claims.sub,
  email: claims.email ?? null,
  nombre: claims.name ?? claims.email ?? '',
  nombreCompleto: claims.name ?? claims.email ?? '',
  role: resolveRole(claims['cognito:groups']),
  emailVerified: claims.email_verified === true,
  authProvider: claims.identities?.[0]?.providerName ?? 'COGNITO',
});

/**
 * Devuelve la sesión de Cognito, o null si no hay.
 * Amplify refresca el token solo cuando está por vencer.
 */
export const getCognitoSession = async () => {
  if (!isCognitoEnabled) return null;

  try {
    const session = await fetchAuthSession();
    const idToken = session?.tokens?.idToken;
    if (!idToken) return null;

    return {
      token: idToken.toString(),
      user: mapClaimsToUser(idToken.payload),
      expiresAt: idToken.payload.exp * 1000,
    };
  } catch {
    // Sin sesión activa: no es un error, es el caso normal antes del login.
    return null;
  }
};

/** El usuario de Cognito, o null. */
export const getCognitoUser = async () => (await getCognitoSession())?.user ?? null;

/**
 * Token a mandar en `Authorization: Bearer`.
 * Prioridad: Cognito > token legacy del BFF.
 *
 * Se manda el ID token (no el access token) porque lleva `email` y `name`,
 * que el BFF necesita para resolver/crear el usuario. Cuando se definan
 * scopes en un resource server, conviene migrar al access token.
 */
export const getAuthToken = async () => {
  const session = await getCognitoSession();
  if (session?.token) return session.token;
  return storageUtils.getToken();
};

/** Redirige a Google vía Cognito (Authorization Code + PKCE). */
export const signInWithGoogle = () => signInWithRedirect({ provider: 'Google' });

/** Redirige a la pantalla de login de Cognito (email/password del pool). */
export const signInWithCognito = () => signInWithRedirect();

/** Cierra la sesión de Cognito. Redirige al sign-out URL configurado. */
export const signOutCognito = async () => {
  if (!isCognitoEnabled) return;
  try {
    await signOut();
  } catch {
    // Si falla el sign-out remoto igual limpiamos lo local (lo hace AuthContext).
  }
};

export default {
  ROLES,
  DEFAULT_ROLE,
  resolveRole,
  mapClaimsToUser,
  getCognitoSession,
  getCognitoUser,
  getAuthToken,
  signInWithGoogle,
  signInWithCognito,
  signOutCognito,
};
