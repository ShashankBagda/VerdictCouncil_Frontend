import React, { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { APIContext } from '../contexts/APIContext';
import { CaseContext } from '../contexts/CaseContext';
export { default as usePipelineStatus } from './usePipelineStatus';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function useAPI() {
  const context = useContext(APIContext);
  if (!context) {
    throw new Error('useAPI must be used within APIProvider');
  }
  return context;
}

export function useCase() {
  const context = useContext(CaseContext);
  if (!context) {
    throw new Error('useCase must be used within CaseProvider');
  }
  return context;
}

export function useOnline() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
