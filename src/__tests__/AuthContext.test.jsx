import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../hooks';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    login: vi.fn(),
    logout: vi.fn(),
    extendSession: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock('../lib/api', () => ({
  APIError: class APIError extends Error {
    constructor(status, detail) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
  getErrorMessage: (error, fallback) => error?.detail || error?.message || fallback,
  default: mockApi,
}));

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="auth-resolved">{String(auth.isAuthResolved)}</div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="user-email">{auth.user?.email || 'none'}</div>
      <div data-testid="role-check">{String(auth.hasAnyRole(['judge']))}</div>
      <button onClick={() => auth.login('judge@verdictcouncil.sg', 'password')}>login</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_BYPASS_AUTH', '0');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('clears session cleanly when bootstrap receives 401', async () => {
    const unauthorized = new Error('Unauthorized');
    unauthorized.status = 401;
    unauthorized.detail = 'Unauthorized';
    mockApi.getSession.mockRejectedValueOnce(unauthorized);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-resolved')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user-email')).toHaveTextContent('none');
    expect(screen.getByTestId('role-check')).toHaveTextContent('false');
  });

  it('bootstraps authenticated user from current backend session shape', async () => {
    mockApi.getSession.mockResolvedValueOnce({
      user: {
        email: 'judge@verdictcouncil.sg',
        role: 'judge',
      },
      expiresAt: '2030-01-01T00:00:00.000Z',
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-resolved')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user-email')).toHaveTextContent('judge@verdictcouncil.sg');
    expect(screen.getByTestId('role-check')).toHaveTextContent('true');
  });

  it('refreshes session after login when login response only sets cookies', async () => {
    const unauthorized = new Error('Unauthorized');
    unauthorized.status = 401;
    unauthorized.detail = 'Unauthorized';

    mockApi.getSession
      .mockRejectedValueOnce(unauthorized)
      .mockResolvedValueOnce({
        user: {
          email: 'judge@verdictcouncil.sg',
          role: 'judge',
        },
        expiresAt: '2030-01-01T00:00:00.000Z',
      });
    mockApi.login.mockResolvedValueOnce({ message: 'logged in' });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-resolved')).toHaveTextContent('true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(mockApi.login).toHaveBeenCalledWith('judge@verdictcouncil.sg', 'password');
    expect(screen.getByTestId('user-email')).toHaveTextContent('judge@verdictcouncil.sg');
  });
});
