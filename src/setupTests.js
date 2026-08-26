// jest-dom adds custom matchers for asserting on DOM nodes.
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Amplify Auth se stubea globalmente: sin esto, los tests dependerían de si
// el .env local tiene las VITE_COGNITO_* definidas. Por defecto "no hay
// sesión de Cognito", que es el escenario del login legacy.
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(async () => ({ tokens: undefined })),
  signInWithRedirect: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
}));

// Polyfill de localStorage para el entorno de pruebas. La implementación de
// jsdom en esta versión no expone métodos utilizables de forma consistente
// (localStorage.getItem/clear "is not a function"), así que proveemos uno
// respaldado por un Map. Garantiza que servicios, contextos y componentes que
// usan localStorage funcionen igual que en el navegador durante los tests.
class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }
  clear() {
    this.store.clear();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  key(index) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new LocalStorageMock(),
  writable: true,
  configurable: true,
});
