import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOnline } from '../../hooks';

export default function ConnectivityIndicator() {
  const isOnline = useOnline();
  const [showNotification, setShowNotification] = useState(false);
  const lastStatusRef = useRef(isOnline);

  // Show notification when connection changes
  useEffect(() => {
    let timer;

    if (isOnline !== lastStatusRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowNotification(true);
      timer = setTimeout(() => {
        setShowNotification(false);
      }, 3000);
    }

    lastStatusRef.current = isOnline;

    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isOnline]);

  if (!showNotification) {
    // Show small persistent indicator in corner when offline
    if (!isOnline) {
      return (
        <div
          className="fixed bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg border border-rose-200 shadow-lg z-40"
          role="status"
          aria-live="polite"
          aria-label="Offline status"
        >
          <WifiOff className="w-4 h-4" />
          <span className="text-sm font-semibold">Offline Mode</span>
        </div>
      );
    }
    return null;
  }

  // Show full notification when status changes
  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 fade-in z-50 ${
        isOnline
          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
          : 'bg-rose-100 text-rose-700 border border-rose-200'
      }`}
      role="status"
      aria-live="assertive"
      aria-label={isOnline ? 'Connection restored' : 'Connection lost'}
    >
      {isOnline ? (
        <>
          <Wifi className="w-5 h-5" />
          <span className="font-semibold">Connection Restored</span>
        </>
      ) : (
        <>
          <WifiOff className="w-5 h-5" />
          <span className="font-semibold">You are Offline</span>
        </>
      )}
    </div>
  );
}
