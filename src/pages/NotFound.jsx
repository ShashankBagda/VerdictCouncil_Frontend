import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search, Scale } from 'lucide-react';

/* Floating orb — mirrors LoginPage aesthetic */
function Orb({ style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{ filter: 'blur(80px)', opacity: 0.18, ...style }}
    />
  );
}

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0d1520 0%, #1a2332 55%, #0e2a3a 100%)' }}
    >
      {/* Background orbs */}
      <Orb style={{ width: 500, height: 500, top: -100, left: -80, background: 'radial-gradient(circle, #06b6d4, transparent)', animation: 'float-slow 12s ease-in-out infinite' }} />
      <Orb style={{ width: 350, height: 350, bottom: -60, right: -40, background: 'radial-gradient(circle, #8b5cf6, transparent)', animation: 'float-slow 9s ease-in-out infinite reverse' }} />

      {/* Dot-grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-lg text-center animate-scale-in"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '28px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          padding: '56px 48px',
        }}
      >
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(139,92,246,0.2) 100%)',
            border: '1.5px solid rgba(6,182,212,0.3)',
            boxShadow: '0 0 32px rgba(6,182,212,0.2)',
          }}
        >
          <Search size={34} className="text-teal-400" />
        </div>

        {/* 404 */}
        <div
          className="text-8xl font-black mb-3 leading-none"
          style={{
            background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Page not found</h1>
        <p className="text-white/40 text-sm leading-relaxed mb-8">
          The page you're looking for doesn't exist or may have been moved.
          Check the URL or head back to the dashboard.
        </p>

        {/* Divider */}
        <div className="h-px bg-white/10 mb-8" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <ArrowLeft size={15} />
            Go back
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
              boxShadow: '0 4px 20px rgba(6,182,212,0.35)',
            }}
          >
            <Home size={15} />
            Back to Dashboard
          </button>
        </div>

        {/* Footer brand */}
        <div className="flex items-center justify-center gap-2 mt-8 text-white/20 text-xs">
          <Scale size={12} />
          <span>VerdictCouncil AI Judicial Platform</span>
        </div>
      </div>
    </div>
  );
}
