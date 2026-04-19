import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

const mockVerifyPasswordReset = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../lib/api', () => ({
  default: {
    verifyPasswordReset: (...args) => mockVerifyPasswordReset(...args),
  },
  getErrorMessage: (error, fallback) => error?.message || fallback,
}));

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits the reset token and navigates to login on success', async () => {
    mockVerifyPasswordReset.mockResolvedValueOnce({
      message: 'Password reset successful. Redirecting to login...',
    });

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Reset Token'), {
      target: { value: 'token-123' },
    });
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'new-password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(mockVerifyPasswordReset).toHaveBeenCalledWith('token-123', 'new-password-123');
    });

    expect(
      screen.getByText('Password reset successful. Redirecting to login...'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    }, { timeout: 2000 });
  });

  it('shows an error message when reset verification fails', async () => {
    mockVerifyPasswordReset.mockRejectedValueOnce(new Error('Invalid or expired reset token'));

    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Reset Token'), {
      target: { value: 'bad-token' },
    });
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'new-password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid or expired reset token')).toBeInTheDocument();
    });
  });
});