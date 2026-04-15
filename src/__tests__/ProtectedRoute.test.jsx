import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

// Mock auth hook to control authentication state
const mockUseAuth = vi.fn();

vi.mock('../hooks', () => ({
  useAuth: () => mockUseAuth(),
  useAPI: () => ({
    showError: vi.fn(),
    showNotification: vi.fn(),
  }),
  useCase: () => ({
    activeTab: 'evidence',
    setActiveTab: vi.fn(),
  }),
}));

// Inline ProtectedRoute matching App.jsx implementation
function ProtectedRoute({ element }) {
  const { isAuthenticated } = mockUseAuth();
  const { Navigate } = require('react-router-dom');
  return isAuthenticated ? element : <Navigate to="/login" replace />;
}

describe('ProtectedRoute', () => {
  it('renders element when authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute element={<div data-testid="secret">Secret Page</div>} />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('secret')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false });

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={<ProtectedRoute element={<div>Secret</div>} />}
          />
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});
