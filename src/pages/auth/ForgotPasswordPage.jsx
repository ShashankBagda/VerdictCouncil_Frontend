import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    try {
      setLoading(true);
      const payload = await api.requestPasswordReset(email);
      setMessage(payload?.message || 'If the email exists, a reset token has been issued.');
    } catch (error) {
      setMessage(getErrorMessage(error, 'Failed to request password reset.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-teal-700 p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full">
        <div className="bg-gradient-to-r from-navy-900 to-teal-600 px-6 py-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Reset Password</h1>
          <p className="text-teal-100">Request a reset token for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {message && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              {message}
            </div>
          )}

          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="judge@verdictcouncil.sg"
                className="input-field pl-10"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 font-semibold">
            {loading ? 'Requesting...' : 'Request Reset Token'}
          </button>

          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} />
            Back to login
          </Link>
        </form>
      </div>
    </div>
  );
}
