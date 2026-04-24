import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, Lock, ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    try {
      setLoading(true);
      const payload = await api.verifyPasswordReset(token, newPassword);
      setMessage(payload?.message || 'Password reset successful. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-navy-900 via-navy-800 to-teal-700 p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full">
        <div className="bg-linear-to-r from-navy-900 to-teal-600 px-6 py-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Set New Password</h1>
          <p className="text-teal-100">Use your reset token to finish account recovery</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {message}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="reset-token" className="block text-sm font-medium text-gray-700 mb-2">
              Reset Token
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                id="reset-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="one-time-code"
                placeholder="Paste the token"
                className="input-field pl-10"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className="input-field pl-10"
                minLength={8}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 font-semibold">
            {loading ? 'Updating...' : 'Update Password'}
          </button>

          <Link to="/forgot-password" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} />
            Back to reset request
          </Link>
        </form>
      </div>
    </div>
  );
}
