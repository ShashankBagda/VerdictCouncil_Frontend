import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AuthContentGate from '../components/auth/AuthContentGate';

const mockUseAuth = vi.fn();

vi.mock('../hooks', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('AuthContentGate', () => {
  it('shows a loading state while auth is unresolved', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isAuthResolved: false,
    });

    render(
      <AuthContentGate>
        <div>Secret content</div>
      </AuthContentGate>,
    );

    expect(screen.getByText('Checking session...')).toBeInTheDocument();
  });

  it('shows a login prompt when auth is resolved and user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isAuthResolved: true,
    });

    render(
      <AuthContentGate>
        <div>Secret content</div>
      </AuthContentGate>,
    );

    expect(screen.getByText('Please log in first.')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isAuthResolved: true,
    });

    render(
      <AuthContentGate>
        <div>Secret content</div>
      </AuthContentGate>,
    );

    expect(screen.getByText('Secret content')).toBeInTheDocument();
  });
});
