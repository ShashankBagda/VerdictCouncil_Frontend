import React, { createContext, useState, useCallback, useEffect } from 'react';
import api from '../lib/api';
import storage from '../lib/storage';

export const AuthContext = createContext();

const isTruthyEnv = (value) => {
  if (value === true) return true;
  if (!value) return false;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
};

export function AuthProvider({ children }) {
  const bypassAuth = import.meta.env.DEV && isTruthyEnv(import.meta.env.VITE_BYPASS_AUTH);

  const [user, setUser] = useState(() => {
    if (bypassAuth) {
      return {
        email: import.meta.env.VITE_BYPASS_AUTH_EMAIL || 'judge@verdictcouncil.sg',
        role: import.meta.env.VITE_BYPASS_AUTH_ROLE || 'judge',
        authenticated: true,
        devBypass: true,
      };
    }

    const token = storage.getAuthToken();
    if (token) {
      // In a real app, we'd call /api/v1/auth/me to verify
      // For now, assume valid token = logged in
      return { authenticated: true };
    }

    return null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);

  // Check if user is logged in (on mount)
  useEffect(() => {
    if (bypassAuth) {
      if (!storage.getAuthToken()) {
        storage.setAuthToken('dev-bypass');
      }
      return;
    }
  }, []);

  // Session expiry warning (5 minutes before expiry)
  useEffect(() => {
    if (!sessionExpiresAt) return;
    const interval = setInterval(() => {
      const now = new Date();
      const timeToExpiry = sessionExpiresAt - now;
      const fiveMinutes = 5 * 60 * 1000;
      if (timeToExpiry > 0 && timeToExpiry <= fiveMinutes) {
        setSessionWarning(true);
      }
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [sessionExpiresAt]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.login(email, password);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min session
      setUser({ email, authenticated: true });
      setSessionExpiresAt(expiresAt);
      storage.setAuthToken(response.token || 'authenticated');
      return response;
    } catch (err) {
      const message = err.detail || 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await api.logout();
      setUser(null);
      setSessionExpiresAt(null);
      setSessionWarning(false);
      storage.clearAuthToken();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const extendSession = useCallback(async () => {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    setSessionExpiresAt(expiresAt);
    setSessionWarning(false);
  }, []);

  const value = {
    user,
    loading,
    error,
    sessionWarning,
    sessionExpiresAt,
    login,
    logout,
    extendSession,
    isAuthenticated: !!user?.authenticated,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
