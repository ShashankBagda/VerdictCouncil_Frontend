import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks';

function AccessDenied({ message = 'You do not have permission to view this page.' }) {
  return (
    <div className="card-lg max-w-2xl mx-auto text-center py-16">
      <h2 className="text-2xl font-bold text-navy-900 mb-3">Access denied</h2>
      <p className="text-gray-600">{message}</p>
    </div>
  );
}

export default function ProtectedRoute({
  element,
  allowedRoles = null,
  unauthorizedElement = null,
}) {
  const location = useLocation();
  const { isAuthenticated, isAuthResolved, hasAnyRole } = useAuth();

  if (!isAuthResolved) {
    return (
      <div className="card-lg flex items-center justify-center h-64">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Checking session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !hasAnyRole(allowedRoles)) {
    return unauthorizedElement || <AccessDenied />;
  }

  return element;
}
