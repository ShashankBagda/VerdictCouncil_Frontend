import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useAPI } from '../../hooks';
import { Lock, Mail } from 'lucide-react';

const isTruthyEnv = (value) => {
  if (value === true) return true;
  if (!value) return false;
  const normalized = String(value).toLowerCase();
  return normalized === 'true' || normalized === '1';
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error: authError } = useAuth();
  const { showError } = useAPI();
  const [email, setEmail] = useState('judge@verdictcouncil.sg');
  const [password, setPassword] = useState('password');
  const [localError, setLocalError] = useState('');

  const bypassAuth = import.meta.env.DEV && isTruthyEnv(import.meta.env.VITE_BYPASS_AUTH);

  useEffect(() => {
    if (bypassAuth) {
      navigate('/', { replace: true });
    }
  }, [bypassAuth, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      const errorMsg = err.detail || 'Login failed. Please try again.';
      setLocalError(errorMsg);
      showError(errorMsg);
    }
  };

  if (bypassAuth) {
    return null;
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="judge@verdictcouncil.sg"
                className="input-field pl-10"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-field pl-10"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 font-semibold"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="spinner"></div>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer note */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Demo credentials: judge@verdictcouncil.sg / password
          </p>
        </div>
      </div>
    </div>
  );
}
