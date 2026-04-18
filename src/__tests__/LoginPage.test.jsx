import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../pages/auth/LoginPage';

const mockNavigate = vi.fn();
const mockUseAuth = vi.fn();
const mockUseAPI = vi.fn();

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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_BYPASS_AUTH', '0');
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

    expect(screen.getByText('Restoring your session')).toBeInTheDocument();
    expect(screen.getByText('Checking your existing session...')).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith('judge@verdictcouncil.sg', 'password');
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});
