/**
 * App.test.jsx
 * Smoke test de la app: monta los providers + router y, sin sesión activa,
 * redirige a la página de login.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renderiza la app y muestra el login cuando no hay sesión', async () => {
    render(<App />);
    // La hidratación de sesión es asíncrona (consulta primero a Cognito),
    // así que el login aparece después del estado de carga.
    expect(await screen.findByText('Bienvenido de vuelta')).toBeInTheDocument();
  });
});
