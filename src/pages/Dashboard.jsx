import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-navy-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Overview of your cases and system metrics</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => navigate('/cases/intake')}
          className="card-lg hover:shadow-lg transition-shadow cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
            <Plus className="text-teal-600" size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-navy-900">New Case</h3>
            <p className="text-sm text-gray-600">Create a new case intake</p>
          </div>
        </button>

        <button
          onClick={() => navigate('/cases')}
          className="card-lg hover:shadow-lg transition-shadow cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <FileText className="text-blue-600" size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-navy-900">View Cases</h3>
            <p className="text-sm text-gray-600">Browse your case list</p>
          </div>
        </button>

        <div className="card-lg flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-emerald-600" size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-navy-900">Analytics</h3>
            <p className="text-sm text-gray-600">View system metrics</p>
          </div>
        </div>
      </div>

      {/* Coming Soon Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-lg border-2 border-dashed border-gray-300">
          <h3 className="font-semibold text-navy-900 mb-4">Recent Cases</h3>
          <p className="text-gray-600">Coming soon...</p>
        </div>

        <div className="card-lg border-2 border-dashed border-gray-300">
          <h3 className="font-semibold text-navy-900 mb-4">System Health</h3>
          <p className="text-gray-600">Coming soon...</p>
        </div>
      </div>
    </div>
  );
}
