import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseAPI = vi.fn();
const mockIsBypassAuthEnabled = vi.fn(() => false);

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks', () => ({
  useAuth: () => mockUseAuth(),
  useAPI: () => mockUseAPI(),
}));

vi.mock('../lib/authSession', () => ({
  isBypassAuthEnabled: () => mockIsBypassAuthEnabled(),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_BYPASS_AUTH', '0');
    mockIsBypassAuthEnabled.mockReturnValue(false);
    mockUseAPI.mockReturnValue({
      showError: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders a restore-session state while auth is unresolved', () => {
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      loading: false,
      error: null,
      isAuthenticated: false,
      isAuthResolved: false,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Restoring session\u2026')).toBeInTheDocument();
  });

  it('submits credentials and redirects after successful login', async () => {
    const login = vi.fn().mockResolvedValue({});
    mockUseAuth.mockReturnValue({
      login,
      loading: false,
      error: null,
      isAuthenticated: false,
      isAuthResolved: true,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'judge@verdictcouncil.sg' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /Sign In/i }).closest('form'));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('judge@verdictcouncil.sg', 'password');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  it('redirects authenticated users to their original route', async () => {
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      loading: false,
      error: null,
      isAuthenticated: true,
      isAuthResolved: true,
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/login', state: { from: { pathname: '/dashboard' } } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    });
  });

  it('renders auth error and loading state from context', () => {
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
      loading: true,
      error: 'Session expired',
      isAuthenticated: false,
      isAuthResolved: true,
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Session expired')).toBeInTheDocument();
    expect(screen.getByText('Authenticating\u2026')).toBeInTheDocument();
  });

  it('shows the normalized API error when login fails', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    const showError = vi.fn();

    mockUseAuth.mockReturnValue({
      login,
      loading: false,
      error: null,
      isAuthenticated: false,
      isAuthResolved: true,
    });
    mockUseAPI.mockReturnValue({ showError });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'judge@verdictcouncil.sg' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      expect(showError).toHaveBeenCalledWith('Invalid credentials');
    });
  });
});
