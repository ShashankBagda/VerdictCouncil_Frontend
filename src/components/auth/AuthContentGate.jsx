import React from 'react';
import { useAuth } from '../../hooks';

export default function AuthContentGate({ children }) {
  const { isAuthenticated, isAuthResolved } = useAuth();

  if (!isAuthResolved) {
    return (
      <div className="card-lg flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div className="text-center text-gray-600 py-12">Please log in first.</div>;
  }

  return children;
}
