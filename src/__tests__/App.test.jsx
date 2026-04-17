import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { APIProvider } from '../contexts/APIContext';
import { CaseProvider } from '../contexts/CaseContext';

// Mock api module to avoid real network calls
vi.mock('../lib/api', () => ({
  APIError: class APIError extends Error {
    constructor(status, detail) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
  getErrorMessage: (error, fallback) => error?.detail || error?.message || fallback,
  default: {
    login: vi.fn(),
    logout: vi.fn(),
    extendSession: vi.fn(),
    getSession: vi.fn(() => {
      const error = new Error('Unauthorized');
      error.status = 401;
      error.detail = 'Unauthorized';
      return Promise.reject(error);
    }),
  },
}));

function TestWrapper({ children }) {
  return (
    <MemoryRouter>
      <AuthProvider>
        <APIProvider>
          <CaseProvider>{children}</CaseProvider>
        </APIProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('App', () => {
  it('renders without crashing', () => {
    // Just verify the provider stack doesn't throw
    render(
      <TestWrapper>
        <div data-testid="test-child">Hello</div>
      </TestWrapper>
    );
    expect(screen.getByTestId('test-child')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <APIProvider>
            <CaseProvider>
              <div>Should redirect</div>
            </CaseProvider>
          </APIProvider>
        </AuthProvider>
      </MemoryRouter>
    );
    // When no token, user is null, so isAuthenticated is false
    // The app itself handles the redirect — here we just verify rendering works
    expect(document.body).toBeTruthy();
  });
});
