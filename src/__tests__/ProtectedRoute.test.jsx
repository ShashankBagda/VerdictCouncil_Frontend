import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import ProtectedRoute from '../components/auth/ProtectedRoute';

const mockUseAuth = vi.fn();

vi.mock('../hooks', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute', () => {
  it('renders a loading state while auth is unresolved', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isAuthResolved: false,
      hasAnyRole: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute element={<div>Secret</div>} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Checking session...')).toBeInTheDocument();
  });

  it('renders element when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isAuthResolved: true,
      hasAnyRole: vi.fn(() => true),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute element={<div data-testid="secret">Secret Page</div>} />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('secret')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isAuthResolved: true,
      hasAnyRole: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute element={<div>Secret</div>} />}
          />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders access denied when role is missing', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isAuthResolved: true,
      hasAnyRole: vi.fn(() => false),
    });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute
                element={<div>Secret</div>}
                allowedRoles={['admin']}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });
});
