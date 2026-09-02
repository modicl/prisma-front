/**
 * cognitoAuth.test.js
 *
 * Cubre la resolución de rol, que es el control de acceso del front.
 * El caso crítico es el default: sin grupo asignado el usuario debe quedar
 * PENDING (sin acceso), nunca TEACHER.
 */

import { describe, it, expect, vi } from 'vitest';
import { ROLES, PENDING_ROLE, DEFAULT_ROLE, resolveRole, mapClaimsToUser } from './cognitoAuth';

vi.mock('aws-amplify/auth', () => ({
  signInWithRedirect: vi.fn(),
  signOut: vi.fn(),
  fetchAuthSession: vi.fn(),
}));

vi.mock('../config/cognito', () => ({ isCognitoEnabled: true }));

describe('resolveRole', () => {
  it('el default es PENDING, no TEACHER', () => {
    expect(DEFAULT_ROLE).toBe(PENDING_ROLE);
    expect(resolveRole([])).toBe('PENDING');
    expect(resolveRole(undefined)).toBe('PENDING');
    expect(resolveRole(null)).toBe('PENDING');
  });

  it('PENDING no es un grupo de Cognito: no está en la lista blanca', () => {
    expect(ROLES).not.toContain('PENDING');
  });

  it('ignora los grupos autogenerados de los IdP federados', () => {
    expect(resolveRole(['us-east-1_h1uG5pYAS_Google'])).toBe('PENDING');
    expect(resolveRole(['us-east-1_h1uG5pYAS_MicrosoftEntraID'])).toBe('PENDING');
  });

  it('resuelve cada rol de la lista blanca', () => {
    expect(resolveRole(['us-east-1_h1uG5pYAS_Google', 'TEACHER'])).toBe('TEACHER');
    expect(resolveRole(['ADMIN'])).toBe('ADMIN');
    expect(resolveRole(['us-east-1_h1uG5pYAS_Google', 'SUPERADMIN'])).toBe('SUPERADMIN');
  });

  it('gana el rol de mayor precedencia, no la posición en el array', () => {
    expect(resolveRole(['TEACHER', 'SUPERADMIN'])).toBe('SUPERADMIN');
    expect(resolveRole(['TEACHER', 'ADMIN'])).toBe('ADMIN');
  });
});

describe('mapClaimsToUser', () => {
  it('un token sin grupos produce un usuario PENDING', () => {
    const user = mapClaimsToUser({ sub: 'abc', email: 'nuevo@gmail.com' });

    expect(user.role).toBe('PENDING');
    expect(user.email).toBe('nuevo@gmail.com');
  });

  it('toma el proveedor federado de las identities', () => {
    const user = mapClaimsToUser({
      sub: 'abc',
      email: 'a@b.cl',
      name: 'Ana',
      email_verified: true,
      'cognito:groups': ['TEACHER'],
      identities: [{ providerName: 'MicrosoftEntraID' }],
    });

    expect(user.role).toBe('TEACHER');
    expect(user.authProvider).toBe('MicrosoftEntraID');
    expect(user.emailVerified).toBe(true);
    expect(user.nombreCompleto).toBe('Ana');
  });
});
