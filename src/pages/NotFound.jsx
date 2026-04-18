import React from 'react';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-navy-900 mb-4">404</h1>
        <p className="text-2xl text-gray-600 mb-8">Page not found</p>
        <a href="/" className="btn-primary">
          Return to Home
        </a>
      </div>
    </div>
  );
}
