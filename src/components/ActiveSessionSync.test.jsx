/**
 * ActiveSessionSync.test.jsx
 * Al iniciar sesión, consulta al servidor si el docente tiene un flujo activo (para retomarlo).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import ActiveSessionSync from './ActiveSessionSync';

const syncFromServer = vi.fn();
let auth = { isAuthenticated: true, isPending: false };

vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../context/ActiveSessionContext', () => ({ useActiveSession: () => ({ syncFromServer }) }));

describe('ActiveSessionSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth = { isAuthenticated: true, isPending: false };
  });

  it('consulta al servidor cuando el docente está autenticado', () => {
    render(<ActiveSessionSync />);
    expect(syncFromServer).toHaveBeenCalledTimes(1);
  });

  it('no consulta si no hay sesión iniciada', () => {
    auth = { isAuthenticated: false, isPending: false };
    render(<ActiveSessionSync />);
    expect(syncFromServer).not.toHaveBeenCalled();
  });

  it('no consulta si la cuenta está pendiente de aprobación (no puede usar el flujo)', () => {
    auth = { isAuthenticated: true, isPending: true };
    render(<ActiveSessionSync />);
    expect(syncFromServer).not.toHaveBeenCalled();
  });

  it('no renderiza nada', () => {
    const { container } = render(<ActiveSessionSync />);
    expect(container).toBeEmptyDOMElement();
  });
});
