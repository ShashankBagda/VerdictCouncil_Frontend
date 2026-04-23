import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RootLayout from '../components/layout/RootLayout';

const mockUseAuth = vi.fn();

vi.mock('../hooks', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('RootLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a restoring state while auth is unresolved', () => {
    mockUseAuth.mockReturnValue({
      logout: vi.fn(),
      user: null,
      isAuthenticated: false,
      isAuthResolved: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Restoring session...')).toBeInTheDocument();
  });

  it('redirects to login when auth is resolved but user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      logout: vi.fn(),
      user: null,
      isAuthenticated: false,
      isAuthResolved: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders the protected shell when auth is resolved and user is authenticated', () => {
    mockUseAuth.mockReturnValue({
      logout: vi.fn(),
      user: { email: 'judge@example.com', role: 'judge' },
      isAuthenticated: true,
      isAuthResolved: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    expect(screen.getByText('judge@example.com')).toBeInTheDocument();
  });
});
