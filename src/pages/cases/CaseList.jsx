import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Clock, Filter, Plus, Search, TriangleAlert } from 'lucide-react';
import { useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import AuthContentGate from '../../components/auth/AuthContentGate';
import { normalizeCaseSummary } from '../../lib/caseWorkspace';

const statusConfig = {
  processing: {
    label: 'Processing',
    icon: Clock,
    badgeClass: 'bg-blue-50 text-blue-700',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle,
    badgeClass: 'bg-emerald-50 text-emerald-700',
  },
  escalated: {
    label: 'Escalated',
    icon: TriangleAlert,
    badgeClass: 'bg-amber-50 text-amber-700',
  },
  rejected: {
    label: 'Rejected',
    icon: AlertCircle,
    badgeClass: 'bg-rose-50 text-rose-700',
  },
  closed: {
    label: 'Closed',
    icon: AlertCircle,
    badgeClass: 'bg-gray-100 text-gray-700',
  },
  failed: {
    label: 'Failed',
    icon: AlertCircle,
    badgeClass: 'bg-rose-50 text-rose-700',
  },
};

export default function CaseList() {
  const navigate = useNavigate();
  const { showError } = useAPI();
  const { selectedCaseId, selectCase } = useCase();

  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const res = await api.listCases({
          domain_filter: domainFilter || undefined,
          status_filter: statusFilter || undefined,
          search: searchTerm.trim() || undefined,
        });
        const items = (res?.items || res?.data?.items || []).map((item) =>
          normalizeCaseSummary(item),
        );
        setCases(items);
      } catch (err) {
        showError(getErrorMessage(err, 'Failed to fetch cases'));
        setCases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [domainFilter, searchTerm, showError, statusFilter]);

  const orderedCases = useMemo(
    () =>
      [...cases].sort(
        (a, b) =>
          new Date(b.filed_date || b.created_at || 0).getTime() -
          new Date(a.filed_date || a.created_at || 0).getTime(),
      ),
    [cases],
  );

  const handleCaseClick = (caseId) => {
    selectCase(caseId);
    navigate(`/case/${caseId}`);
  };

  return (
    <AuthContentGate>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-navy-900 mb-2">My Cases</h1>
            <p className="text-gray-600">Search, filter, and review story-aligned case records.</p>
          </div>
          <button
            onClick={() => navigate('/cases/intake')}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Case
          </button>
        </div>

        <div className="card-lg mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-navy-900">Filters & Search</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Search Cases
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Title, description, party names, or key facts..."
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Domain
              </label>
              <select
                value={domainFilter}
                onChange={(e) => setDomainFilter(e.target.value)}
                className="input-field bg-white"
              >
                <option value="">All Domains</option>
                <option value="SCT">Small Claims Tribunal</option>
                <option value="Traffic">Traffic Court</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-navy-900 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field bg-white"
              >
                <option value="">All Statuses</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="escalated">Escalated</option>
                <option value="rejected">Rejected</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner w-8 h-8" />
          </div>
        ) : orderedCases.length === 0 ? (
          <div className="card-lg text-center py-12">
            <p className="text-gray-600 mb-4">
              No cases match the current intake and filter criteria.
            </p>
            <button onClick={() => navigate('/cases/intake')} className="btn-primary">
              Create New Case
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orderedCases.map((caseItem) => {
              const config = statusConfig[caseItem.status] || statusConfig.processing;
              const StatusIcon = config.icon;
              return (
                <button
                  key={caseItem.case_id}
                  onClick={() => handleCaseClick(caseItem.case_id)}
                  className={`card-lg text-left transition-all hover:shadow-lg hover:scale-[1.01] ${
                    selectedCaseId === caseItem.case_id ? 'ring-2 ring-teal-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-navy-900 text-lg mb-1">
                        {caseItem.title || `Case ${String(caseItem.case_id).slice(0, 8)}`}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {caseItem.filed_date
                          ? `Filed ${new Date(caseItem.filed_date).toLocaleDateString()}`
                          : new Date(caseItem.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${config.badgeClass}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {config.label}
                    </span>
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                      {caseItem.domain === 'small_claims' ? 'SCT' : 'Traffic'}
                    </span>
                    {caseItem.escalation_reason && (
                      <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 text-xs font-semibold rounded-full">
                        Escalation flag
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-700 mb-4 line-clamp-3">
                    {caseItem.case_description || 'No case summary available yet.'}
                  </p>

                  <div className="border-t pt-4 mb-4 space-y-1">
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold">Party 1:</span> {caseItem.party_1 || 'Pending'}
                    </p>
                    <p className="text-xs text-gray-600">
                      <span className="font-semibold">Party 2:</span> {caseItem.party_2 || 'Pending'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-semibold text-gray-700">Pipeline Progress</p>
                      <p className="text-xs text-gray-600">{caseItem.pipeline_progress}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${caseItem.pipeline_progress}%` }}
                      />
                    </div>
                    {caseItem.current_agent && (
                      <p className="text-xs text-gray-500">
                        Current agent: {caseItem.current_agent}
                      </p>
                    )}
                    {caseItem.outcome_summary && (
                      <p className="text-xs text-gray-600 line-clamp-2">
                        <span className="font-semibold">Outcome:</span> {caseItem.outcome_summary}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AuthContentGate>
  );
}
