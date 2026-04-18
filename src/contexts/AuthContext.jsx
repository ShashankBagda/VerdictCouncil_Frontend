/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import api, { APIError, getErrorMessage } from '../lib/api';
import {
  SESSION_WARNING_MS,
  deriveSessionExpiry,
  isBypassAuthEnabled,
  normalizeRoles,
  normalizeUser,
} from '../lib/authSession';

export const AuthContext = createContext();

const hasUsableSessionPayload = (response) =>
  !!(
    response?.data?.user ||
    response?.user ||
    response?.data?.session ||
    response?.session
  );

export function AuthProvider({ children }) {
  const bypassAuth = isBypassAuthEnabled();

  const [user, setUser] = useState(() => {
    if (!bypassAuth) return null;

    return normalizeUser({
      email: import.meta.env.VITE_BYPASS_AUTH_EMAIL || 'judge@verdictcouncil.sg',
      role: import.meta.env.VITE_BYPASS_AUTH_ROLE || 'judge',
      devBypass: true,
    });
  });
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!bypassAuth);
  const [error, setError] = useState(null);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);

  const applySession = useCallback((sessionState, fallbackUser = null) => {
    const nextUser = normalizeUser(sessionState?.user || fallbackUser);
    setUser(nextUser);
    setSessionExpiresAt(deriveSessionExpiry(sessionState));
    setSessionWarning(false);
    return nextUser;
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setSessionExpiresAt(null);
    setSessionWarning(false);
  }, []);

  const refreshSession = useCallback(async () => {
    if (bypassAuth) {
      const bypassUser = normalizeUser({
        email: import.meta.env.VITE_BYPASS_AUTH_EMAIL || 'judge@verdictcouncil.sg',
        role: import.meta.env.VITE_BYPASS_AUTH_ROLE || 'judge',
        devBypass: true,
      });
      setUser(bypassUser);
      return bypassUser;
    }

    const sessionState = await api.getSession();
    return applySession(sessionState);
  }, [applySession, bypassAuth]);

  useEffect(() => {
    if (bypassAuth) {
      setBootstrapping(false);
      return undefined;
    }

    let isMounted = true;

    const bootstrap = async () => {
      setBootstrapping(true);
      setError(null);

      try {
        await refreshSession();
      } catch (err) {
        if (!isMounted) return;

        if (err instanceof APIError && (err.status === 401 || err.status === 404)) {
          clearSession();
        } else {
          clearSession();
          setError(getErrorMessage(err, 'Unable to restore your session'));
        }
      } finally {
        if (isMounted) {
          setBootstrapping(false);
        }
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, [bypassAuth, clearSession, refreshSession]);

  useEffect(() => {
    if (!sessionExpiresAt) {
      setSessionWarning(false);
      return undefined;
    }

    const tick = () => {
      const timeToExpiry = sessionExpiresAt.getTime() - Date.now();
      setSessionWarning(timeToExpiry > 0 && timeToExpiry <= SESSION_WARNING_MS);
    };

    tick();
    const intervalId = window.setInterval(tick, 30000);
    return () => window.clearInterval(intervalId);
  }, [sessionExpiresAt]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.login(email, password);
      const sessionState = hasUsableSessionPayload(response)
        ? {
            user: response?.data?.user || response?.user || null,
            session: response?.data?.session || response?.session || null,
            expiresAt:
              response?.data?.expires_at ||
              response?.expires_at ||
              response?.data?.session?.expires_at ||
              null,
          }
        : null;

      if (sessionState) {
        applySession(sessionState);
      } else {
        await refreshSession();
      }

      return response;
    } catch (err) {
      const message = getErrorMessage(err, 'Login failed');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applySession, refreshSession]);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!bypassAuth) {
        await api.logout();
      }
    } catch (err) {
      if (!(err instanceof APIError) || err.status !== 401) {
        setError(getErrorMessage(err, 'Logout failed'));
      }
    } finally {
      clearSession();
      setLoading(false);
    }
  }, [bypassAuth, clearSession]);

  const extendSession = useCallback(async () => {
    if (bypassAuth) {
      const nextExpiry = new Date(Date.now() + 30 * 60 * 1000);
      setSessionExpiresAt(nextExpiry);
      setSessionWarning(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const sessionState = await api.extendSession();
      const hasExpiry = sessionState?.expiresAt || sessionState?.session?.expires_at;

      if (hasExpiry) {
        applySession(
          {
            user: sessionState?.user || user,
            session: sessionState?.session || null,
            expiresAt: sessionState?.expiresAt || sessionState?.session?.expires_at,
          },
          user,
        );
        return;
      }

      await refreshSession();
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to extend session'));
      throw err;
    } finally {
      setLoading(false);
    }
  }, [applySession, bypassAuth, refreshSession, user]);

  const hasRole = useCallback(
    (role) => normalizeRoles(user).includes(role),
    [user],
  );

  const hasAnyRole = useCallback(
    (roles) => {
      if (!roles?.length) return true;
      const userRoles = normalizeRoles(user);
      return roles.some((role) => userRoles.includes(role));
    },
    [user],
  );

  const value = useMemo(() => ({
    user,
    loading,
    error,
    sessionWarning,
    sessionExpiresAt,
    login,
    logout,
    extendSession,
    refreshSession,
    isAuthenticated: !!user?.authenticated,
    isAuthResolved: !bootstrapping,
    hasRole,
    hasAnyRole,
  }), [
    bootstrapping,
    error,
    extendSession,
    hasAnyRole,
    hasRole,
    loading,
    login,
    logout,
    refreshSession,
    sessionExpiresAt,
    sessionWarning,
    user,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
