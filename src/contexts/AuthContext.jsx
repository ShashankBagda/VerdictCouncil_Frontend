/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import api, { APIError, getErrorMessage } from '../lib/api';

export const AuthContext = createContext();

const SESSION_WARNING_MS = 5 * 60 * 1000;

const isTruthyEnv = (value) => {
  if (value === true) return true;
  if (!value) return false;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
};

const normalizeRoles = (user) => {
  if (!user) return [];

  if (Array.isArray(user.roles)) {
    return user.roles.filter(Boolean);
  }

  if (user.role) {
    return [user.role];
  }

  return [];
};

const normalizeUser = (userLike) => {
  if (!userLike) return null;

  const roles = normalizeRoles(userLike);

  return {
    ...userLike,
    roles,
    role: userLike.role || roles[0] || null,
    authenticated: true,
  };
};

const deriveSessionExpiry = (sessionState) => {
  if (!sessionState?.expiresAt) {
    return null;
  }

  const parsed = new Date(sessionState.expiresAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function AuthProvider({ children }) {
  const bypassAuth = import.meta.env.DEV && isTruthyEnv(import.meta.env.VITE_BYPASS_AUTH);

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
      return normalizeUser({
        email: import.meta.env.VITE_BYPASS_AUTH_EMAIL || 'judge@verdictcouncil.sg',
        role: import.meta.env.VITE_BYPASS_AUTH_ROLE || 'judge',
        devBypass: true,
      });
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
      const fallbackUser = { email };
      const sessionState = response?.data?.user || response?.user || response?.data?.session
        ? {
            user: response?.data?.user || response?.user || fallbackUser,
            session: response?.data?.session || response?.session || null,
            expiresAt:
              response?.data?.expires_at ||
              response?.expires_at ||
              response?.data?.session?.expires_at ||
              null,
          }
        : null;

      if (sessionState) {
        applySession(sessionState, fallbackUser);
      } else {
        try {
          await refreshSession();
        } catch {
          applySession(null, fallbackUser);
        }
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
      const response = await api.extendSession();
      const sessionState = response?.data || response;

      if (sessionState?.expires_at || sessionState?.session?.expires_at) {
        applySession(
          {
            user,
            session: sessionState?.session || null,
            expiresAt: sessionState?.expires_at || sessionState?.session?.expires_at,
          },
          user,
        );
      } else {
        await refreshSession();
      }
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
