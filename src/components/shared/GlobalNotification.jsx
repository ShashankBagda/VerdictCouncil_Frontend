import React from 'react';
import { useAPI } from '../../hooks';

export function GlobalNotification() {
  const { notification, clearNotification } = useAPI();

  if (!notification) return null;

  const bgColor =
    notification.type === 'success'
      ? 'bg-emerald-50 border-emerald-200'
      : notification.type === 'error'
      ? 'bg-rose-50 border-rose-200'
      : notification.type === 'warning'
      ? 'bg-amber-50 border-amber-200'
      : 'bg-blue-50 border-blue-200';

  const textColor =
    notification.type === 'success'
      ? 'text-emerald-800'
      : notification.type === 'error'
      ? 'text-rose-800'
      : notification.type === 'warning'
      ? 'text-amber-800'
      : 'text-blue-800';

  return (
    <div className={`fixed bottom-4 right-4 max-w-md p-4 rounded-lg border ${bgColor} ${textColor} shadow-lg animate-slide-up`}>
      <div className="flex justify-between items-start gap-3">
        <p className="text-sm font-medium">{notification.message}</p>
        <button
          onClick={clearNotification}
          className="text-xl leading-none hover:opacity-70"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default GlobalNotification;
