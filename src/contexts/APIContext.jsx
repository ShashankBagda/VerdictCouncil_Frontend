import React, { createContext, useState, useCallback } from 'react';

export const APIContext = createContext();

export function APIProvider({ children }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);

  const showError = useCallback((message, fieldErrors = {}) => {
    setError({ message, fieldErrors });
    // Auto-clear after 5 seconds
    setTimeout(() => setError(null), 5000);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const showNotification = useCallback((message, type = 'info') => {
    setNotification({ message, type });
    // Auto-clear after 4 seconds
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const clearNotification = useCallback(() => {
    setNotification(null);
  }, []);

  const value = {
    loading,
    setLoading,
    error,
    showError,
    clearError,
    notification,
    showNotification,
    clearNotification,
  };

  return (
    <APIContext.Provider value={value}>
      {children}
    </APIContext.Provider>
  );
}
