import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Filter, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAPI } from '../../hooks';
import { useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import AuthContentGate from '../../components/auth/AuthContentGate';

const statusConfig = {
  intake: { label: 'Intake', icon: Clock, color: 'blue' },
  analysis: { label: 'Analysis', icon: Clock, color: 'purple' },
  evidence_deliberation: { label: 'Deliberating', icon: Clock, color: 'amber' },
  verdict: { label: 'Verdict', icon: CheckCircle, color: 'emerald' },
  closed: { label: 'Closed', icon: AlertCircle, color: 'gray' },
};

export default function CaseList() {
  const navigate = useNavigate();
  const { showError } = useAPI();
  const { selectedCaseId, selectCase } = useCase();

  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Fetch cases on mount
  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const res = await api.listCases({
          domain_filter: domainFilter || undefined,
          status_filter: statusFilter || undefined,
          search_term: searchTerm || undefined,
        });
        setCases(res.data?.cases || []);
      } catch (err) {
        const msg = getErrorMessage(err, 'Failed to fetch cases');
        showError(msg);
        setCases([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [domainFilter, statusFilter, searchTerm, showError]);

  // Apply client-side search filtering
  useEffect(() => {
    let filtered = cases;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.case_id?.toLowerCase().includes(term) ||
        c.case_description?.toLowerCase().includes(term) ||
        c.party_1?.toLowerCase().includes(term) ||
        c.party_2?.toLowerCase().includes(term)
      );
    }

    setFilteredCases(filtered);
  }, [cases, searchTerm]);

  const handleCaseClick = (caseId) => {
    selectCase(caseId);
    navigate(`/case/${caseId}`);
  };

  return (
    <AuthContentGate>
      <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-navy-900 mb-2">My Cases</h1>
          <p className="text-gray-600">Manage and monitor your active cases</p>
        </div>
        <button
          onClick={() => navigate('/cases/intake')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Case
        </button>
      </div>

      {/* Filters */}
      <div className="card-lg mb-8">
        <div className="flex items-center gap-3 mb-6">
          <Filter className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-navy-900">Filters & Search</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
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
                placeholder="Case ID, description, party names..."
                className="input-field pl-10"
              />
            </div>
          </div>

          {/* Domain Filter */}
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
              <option value="SCT">SCT</option>
              <option value="Traffic">Traffic</option>
            </select>
          </div>

          {/* Status Filter */}
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
              <option value="intake">Intake</option>
              <option value="analysis">Analysis</option>
              <option value="evidence_deliberation">Deliberating</option>
              <option value="verdict">Verdict</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cases Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8" />
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="card-lg text-center py-12">
          <p className="text-gray-600 mb-4">
            {cases.length === 0 ? 'No cases yet. Create one to get started.' : 'No cases match your filters.'}
          </p>
          {cases.length === 0 && (
            <button
              onClick={() => navigate('/cases/intake')}
              className="btn-primary"
            >
              Create New Case
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCases.map((c) => {
            const statusConfig_ = statusConfig[c.status] || statusConfig.intake;
            const Icon = statusConfig_.icon;

            return (
              <button
                key={c.case_id}
                onClick={() => handleCaseClick(c.case_id)}
                className={`card-lg text-left transition-all hover:shadow-lg hover:scale-105 ${
                  selectedCaseId === c.case_id ? 'ring-2 ring-teal-500' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-navy-900 text-lg mb-1">
                      {c.case_id}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-${statusConfig_.color}-50 text-${statusConfig_.color}-700`}>
                    {statusConfig_.label}
                  </span>
                </div>

                {/* Domain */}
                <div className="mb-4">
                  <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                    {c.domain}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-700 mb-4 line-clamp-2">
                  {c.case_description}
                </p>

                {/* Parties */}
                <div className="border-t pt-4 mb-4">
                  <p className="text-xs text-gray-600 mb-2">
                    <span className="font-semibold">Claimant:</span> {c.party_1}
                  </p>
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">Respondent:</span> {c.party_2}
                  </p>
                </div>

                {/* Progress Bar */}
                {c.status !== 'closed' && c.pipeline_progress !== undefined && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs font-semibold text-gray-700">Progress</p>
                      <p className="text-xs text-gray-600">{c.pipeline_progress}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all"
                        style={{ width: `${c.pipeline_progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
      </div>
    </AuthContentGate>
  );
}
