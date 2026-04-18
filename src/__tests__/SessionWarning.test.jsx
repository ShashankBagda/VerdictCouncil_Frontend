import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SessionWarning from '../components/shared/SessionWarning';

const mockUseAuth = vi.fn();
const mockUseAPI = vi.fn();
const mockNavigate = vi.fn();

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

describe('SessionWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAPI.mockReturnValue({
      showError: vi.fn(),
      showNotification: vi.fn(),
    });
  });

  it('does not render when the user is no longer authenticated', () => {
    mockUseAuth.mockReturnValue({
      sessionWarning: true,
      extendSession: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: false,
    });

    render(
      <MemoryRouter>
        <SessionWarning />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/Your session expires in 5 minutes/i)).not.toBeInTheDocument();
  });

  it('logs out and redirects to login from the banner action', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);

    mockUseAuth.mockReturnValue({
      sessionWarning: true,
      extendSession: vi.fn(),
      logout,
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={['/cases']}>
        <Routes>
          <Route path="/cases" element={<SessionWarning />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });

  it('redirects to login when session extension returns unauthorized', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const showError = vi.fn();

    mockUseAuth.mockReturnValue({
      sessionWarning: true,
      extendSession: vi.fn().mockRejectedValue({ status: 401, detail: 'Unauthorized' }),
      logout,
      isAuthenticated: true,
    });
    mockUseAPI.mockReturnValue({
      showError,
      showNotification: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/cases']}>
        <Routes>
          <Route path="/cases" element={<SessionWarning />} />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText('Extend'));

    await waitFor(() => expect(logout).toHaveBeenCalled());
    expect(showError).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
  });
});
