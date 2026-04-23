import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks';
import { useAPI } from '../../hooks';
import { Lock, Mail, Gavel, Scale, Shield, Eye, EyeOff } from 'lucide-react';
import { getErrorMessage } from '../../lib/api';
import { isBypassAuthEnabled } from '../../lib/authSession';

/* Animated floating orb */
function Orb({ style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{ filter: 'blur(80px)', opacity: 0.25, ...style }}
    />
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, error: authError, isAuthenticated, isAuthResolved } = useAuth();
  const { showError } = useAPI();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  if (bypassAuth || (isAuthResolved && isAuthenticated)) return null;

  if (!isAuthResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d1520 0%, #1a2332 50%, #0e2a3a 100%)' }}>
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-teal-500/30 animate-ping-slow" />
            <div className="w-16 h-16 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
          </div>
          <p className="text-white/60 font-medium">Restoring session…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative"
      style={{ background: 'linear-gradient(135deg, #0d1520 0%, #1a2332 50%, #0e2a3a 100%)' }}
    >
      {/* Animated background orbs */}
      <Orb style={{ width: 500, height: 500, top: -120, left: -100, background: 'radial-gradient(circle, #06b6d4, transparent)', animation: 'float-slow 12s ease-in-out infinite' }} />
      <Orb style={{ width: 400, height: 400, bottom: -80, right: -60, background: 'radial-gradient(circle, #8b5cf6, transparent)', animation: 'float-slow 9s ease-in-out infinite reverse' }} />
      <Orb style={{ width: 300, height: 300, top: '40%', right: '5%', background: 'radial-gradient(circle, #f59e0b, transparent)', animation: 'float-slow 14s ease-in-out infinite', animationDelay: '3s' }} />

      {/* Dot grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Main login card */}
      <div
        className="relative w-full max-w-md animate-scale-in"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '28px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset',
        }}
      >
        {/* Top branding section */}
        <div className="px-8 pt-10 pb-8 text-center border-b border-white/10">
          {/* Logo mark */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 mx-auto"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', boxShadow: '0 0 32px rgba(6,182,212,0.4), 0 8px 24px rgba(0,0,0,0.3)' }}>
            <div className="absolute inset-0 rounded-2xl animate-pulse-glow" />
            <Gavel size={28} className="text-white" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">VerdictCouncil</h1>
          <p className="text-white/40 text-sm mt-1.5">Judicial AI Decision Support System</p>

          {/* Feature pills */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {['9-Agent Pipeline', 'JWT Secured', 'Real-time AI'].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full text-[10px] font-semibold text-teal-300"
                style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.25)' }}
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Form section */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          {(localError || authError) && (
            <div className="flex items-start gap-3 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Shield size={15} className="text-rose-400 flex-shrink-0 mt-0.5" />
              <span className="text-rose-300">{localError || authError}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="judge@verdictcouncil.sg"
                required
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm font-medium text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="login-password" className="block text-xs font-bold text-white/50 uppercase tracking-widest">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-12 py-3.5 rounded-xl text-sm font-medium text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || submitting}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all duration-200 relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              boxShadow: '0 4px 20px rgba(6,182,212,0.4)',
            }}
          >
            {loading || submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Authenticating…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Scale size={16} />
                Sign In to VerdictCouncil
              </span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-8 pb-8 text-center">
          <p className="text-white/20 text-xs">
            Secured by 256-bit AES encryption • Session-bound JWT tokens
          </p>
        </div>
      </div>
    </div>
  );
}
