import React from 'react';
import { useAuth } from '../../hooks';

export function SessionWarning() {
  const { sessionWarning, extendSession, logout } = useAuth();

  if (!sessionWarning) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b-4 border-amber-400 p-4">
      <div className="max-w-container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
          <p className="text-sm font-medium text-amber-900">
            Your session expires in 5 minutes. <button onClick={extendSession} className="ml-2 underline hover:no-underline font-semibold">Extend</button>
          </p>
        </div>
        <button onClick={logout} className="text-sm text-amber-700 hover:text-amber-900 underline">
          Logout
        </button>
      </div>
    </div>
  );
}

export default SessionWarning;
