import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';

const mockRequestPasswordReset = vi.fn();

vi.mock('../lib/api', () => ({
  default: {
    requestPasswordReset: (...args) => mockRequestPasswordReset(...args),
  },
  getErrorMessage: (error, fallback) => error?.message || fallback,
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the email and shows the backend message', async () => {
    mockRequestPasswordReset.mockResolvedValueOnce({
      message: 'If the email exists, a reset token has been issued.',
    });

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'judge@verdictcouncil.sg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reset Token' }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('judge@verdictcouncil.sg');
    });

    expect(
      screen.getByText('If the email exists, a reset token has been issued.'),
    ).toBeInTheDocument();
  });

  it('shows an error message when the request fails', async () => {
    mockRequestPasswordReset.mockRejectedValueOnce(new Error('Reset request failed'));

    render(
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'judge@verdictcouncil.sg' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Request Reset Token' }));

    await waitFor(() => {
      expect(screen.getByText('Reset request failed')).toBeInTheDocument();
    });
  });
});