import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useAPI } from '../../hooks';
import { Lock, Mail } from 'lucide-react';
import { getErrorMessage } from '../../lib/api';
import { isBypassAuthEnabled } from '../../lib/authSession';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, error: authError, isAuthenticated, isAuthResolved } = useAuth();
  const { showError } = useAPI();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const redirectTarget = location.state?.from?.pathname || '/';

  const bypassAuth = isBypassAuthEnabled();

  useEffect(() => {
    if (bypassAuth || (isAuthResolved && isAuthenticated)) {
      navigate(redirectTarget, { replace: true });
    }
  }, [bypassAuth, isAuthenticated, isAuthResolved, navigate, redirectTarget]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      setSubmitting(true);
      await login(email, password);
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Login failed. Please try again.');
      setLocalError(errorMsg);
      showError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (bypassAuth || (isAuthResolved && isAuthenticated)) {
    return null;
  }

  if (!isAuthResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-teal-700 p-4">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full">
          <div className="bg-gradient-to-r from-navy-900 to-teal-600 px-6 py-8 text-white">
            <h1 className="text-3xl font-bold mb-2">VerdictCouncil</h1>
            <p className="text-teal-100">Restoring your session</p>
          </div>
          <div className="p-8 text-center">
            <div className="spinner w-8 h-8 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking your existing session...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-teal-700 p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-navy-900 to-teal-600 px-6 py-8 text-white">
          <h1 className="text-3xl font-bold mb-2">VerdictCouncil</h1>
          <p className="text-teal-100">Judicial AI Decision Support</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8">
          {(localError || authError) && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
              {localError ||authError}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="judge@verdictcouncil.sg"
                className="input-field pl-10"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="input-field pl-10"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || submitting}
            className="btn-primary w-full py-3 font-semibold"
          >
            {loading || submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="spinner"></div>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-teal-700 hover:text-teal-900">
              Forgot your password?
            </Link>
          </div>
        </form>

      </div>
    </div>
  );
}
