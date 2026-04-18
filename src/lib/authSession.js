export const SESSION_WARNING_MS = 5 * 60 * 1000;

export const isTruthyEnv = (value) => {
  if (value === true) return true;
  if (!value) return false;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
};

export const isBypassAuthEnabled = () =>
  import.meta.env.DEV && isTruthyEnv(import.meta.env.VITE_BYPASS_AUTH);

export const normalizeRoles = (user) => {
  if (!user) return [];

  if (Array.isArray(user.roles)) {
    return user.roles.filter(Boolean);
  }

  if (user.role) {
    return [user.role];
  }

  return [];
};

export const normalizeUser = (userLike) => {
  if (!userLike) return null;

  const roles = normalizeRoles(userLike);

  return {
    ...userLike,
    roles,
    role: userLike.role || roles[0] || null,
    authenticated: true,
  };
};

export const deriveSessionExpiry = (sessionState) => {
  if (!sessionState?.expiresAt) {
    return null;
  }

  const parsed = new Date(sessionState.expiresAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
