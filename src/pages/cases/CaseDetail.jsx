import React from 'react';
import { useParams, Outlet, NavLink } from 'react-router-dom';

export default function CaseDetail() {
  const { caseId } = useParams();

  return (
    <div>
      <h1 className="text-4xl font-bold text-navy-900 mb-6">Case {caseId}</h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 pb-0">
        <NavLink
          to={`/case/${caseId}/building`}
          className={({ isActive }) =>
            `px-4 py-3 border-b-2 transition-colors ${
              isActive
                ? 'border-teal-600 text-teal-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`
          }
        >
          Building
        </NavLink>
        <NavLink
          to={`/case/${caseId}/graph`}
          className={({ isActive }) =>
            `px-4 py-3 border-b-2 transition-colors ${
              isActive
                ? 'border-teal-600 text-teal-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`
          }
        >
          Graph Mesh
        </NavLink>
        <NavLink
          to={`/case/${caseId}/dossier`}
          className={({ isActive }) =>
            `px-4 py-3 border-b-2 transition-colors ${
              isActive
                ? 'border-teal-600 text-teal-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`
          }
        >
          Dossier
        </NavLink>
        <NavLink
          to={`/case/${caseId}/what-if`}
          className={({ isActive }) =>
            `px-4 py-3 border-b-2 transition-colors ${
              isActive
                ? 'border-teal-600 text-teal-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`
          }
        >
          What-If
        </NavLink>
        <NavLink
          to={`/case/${caseId}/hearing-pack`}
          className={({ isActive }) =>
            `px-4 py-3 border-b-2 transition-colors ${
              isActive
                ? 'border-teal-600 text-teal-600 font-semibold'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`
          }
        >
          Hearing Pack
        </NavLink>
      </div>

      {/* Content */}
      <Outlet />
    </div>
  );
}
