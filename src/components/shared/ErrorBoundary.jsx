import React from 'react';
import { AlertTriangle, RefreshCw, Home, Scale } from 'lucide-react';

function Orb({ style }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{ filter: 'blur(80px)', opacity: 0.18, ...style }}
    />
  );
}

function ErrorFallback({ error, onRetry }) {
  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0d1520 0%, #1a2332 55%, #0e2a3a 100%)' }}
    >
      <Orb style={{ width: 450, height: 450, top: -80, left: -60, background: 'radial-gradient(circle, #ef4444, transparent)', animation: 'float-slow 11s ease-in-out infinite' }} />
      <Orb style={{ width: 350, height: 350, bottom: -60, right: -40, background: 'radial-gradient(circle, #8b5cf6, transparent)', animation: 'float-slow 9s ease-in-out infinite reverse' }} />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div
        className="relative z-10 w-full max-w-lg text-center"
        style={{
          background: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '28px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(239,68,68,0.08) inset',
          padding: '56px 48px',
        }}
      >
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.08) 100%)',
            border: '1.5px solid rgba(239,68,68,0.35)',
            boxShadow: '0 0 32px rgba(239,68,68,0.2)',
          }}
        >
          <AlertTriangle size={34} className="text-rose-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">Something went wrong</h1>
        <p className="text-white/40 text-sm leading-relaxed mb-4">
          An unexpected error occurred in the application.
          You can try refreshing this page or returning to the dashboard.
        </p>

        {/* Error detail (collapsed) */}
        {error?.message && (
          <details className="mb-6 text-left">
            <summary className="text-xs text-rose-400/70 cursor-pointer hover:text-rose-400 transition-colors select-none mb-2">
              Technical details
            </summary>
            <pre
              className="text-[11px] text-rose-300/60 bg-rose-500/5 border border-rose-500/15 rounded-xl p-3 overflow-auto max-h-32 whitespace-pre-wrap break-all"
            >
              {error.message}
            </pre>
          </details>
        )}

        <div className="h-px bg-white/10 mb-6" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-all duration-200"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <RefreshCw size={15} />
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
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

        <div className="flex items-center justify-center gap-2 mt-8 text-white/20 text-xs">
          <Scale size={12} />
          <span>VerdictCouncil AI Judicial Platform</span>
        </div>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
