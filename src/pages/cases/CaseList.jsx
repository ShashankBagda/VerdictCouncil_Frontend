import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, CheckCircle, Clock, Filter, Plus, Search,
  TriangleAlert, FolderOpen, ArrowRight, Activity
} from 'lucide-react';
import { useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import AuthContentGate from '../../components/auth/AuthContentGate';
import { normalizeCaseSummary } from '../../lib/caseWorkspace';

const STATUS_CONFIG = {
  processing: {
    label: 'Processing', icon: Clock,
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    progress: 'from-blue-400 to-blue-500',
    cardBorder: 'border-blue-200/60',
    dot: 'bg-blue-400',
  },
  completed: {
    label: 'Completed', icon: CheckCircle,
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    progress: 'from-emerald-400 to-teal-500',
    cardBorder: 'border-emerald-200/60',
    dot: 'bg-emerald-400',
  },
  escalated: {
    label: 'Escalated', icon: TriangleAlert,
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    progress: 'from-amber-400 to-orange-400',
    cardBorder: 'border-amber-200/60',
    dot: 'bg-amber-400',
  },
  rejected: {
    label: 'Rejected', icon: AlertCircle,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    progress: 'from-rose-400 to-rose-500',
    cardBorder: 'border-rose-200/60',
    dot: 'bg-rose-400',
  },
  closed: {
    label: 'Closed', icon: AlertCircle,
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
    progress: 'from-gray-300 to-gray-400',
    cardBorder: 'border-gray-200',
    dot: 'bg-gray-400',
  },
  failed: {
    label: 'Failed', icon: AlertCircle,
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    progress: 'from-rose-400 to-rose-500',
    cardBorder: 'border-rose-200/60',
    dot: 'bg-rose-400',
  },
};

function CaseCard({ caseItem, selected, onClick }) {
  const cfg = STATUS_CONFIG[caseItem.status] || STATUS_CONFIG.processing;
  const Icon = cfg.icon;
  const date = caseItem.filed_date || caseItem.created_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl bg-white border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 flex flex-col ${cfg.cardBorder} ${selected ? 'ring-2 ring-teal-500 shadow-glow-teal' : 'shadow-card'}`}
      style={{ boxShadow: selected ? undefined : '0 4px 20px rgba(0,0,0,0.06)' }}
    >
      {/* Card header */}
      <div className="p-5 pb-3 flex-1">
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Status dot + date */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
            <span className="text-xs text-gray-400 font-medium">{formattedDate}</span>
          </div>
          {/* Status badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cfg.badge} flex-shrink-0`}>
            <Icon size={10} />
            {cfg.label}
          </span>
        </div>

        <h3 className="font-bold text-navy-900 text-sm leading-snug mb-2 line-clamp-2">
          {caseItem.title || `Case ${String(caseItem.case_id).slice(0, 8)}`}
        </h3>

        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
          {caseItem.case_description || 'No description available.'}
        </p>

        {/* Domain + escalation chips */}
        <div className="flex flex-wrap gap-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold border border-teal-200/60">
            {caseItem.domain === 'small_claims' ? 'SCT' : 'Traffic Court'}
          </span>
          {caseItem.escalation_reason && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200/60">
              Escalated
            </span>
          )}
        </div>
      </div>

      {/* Pipeline progress bar */}
      <div className="px-5 pb-4">
        <div className="border-t border-gray-100 pt-3 mb-3" />
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Activity size={10} className="text-gray-400" />
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Pipeline</span>
          </div>
          <span className="text-[10px] font-bold text-gray-700">{caseItem.pipeline_progress}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${cfg.progress} transition-all duration-700`}
            style={{ width: `${caseItem.pipeline_progress}%` }}
          />
        </div>
        {caseItem.current_agent && (
          <p className="text-[10px] text-gray-400 mt-1.5 truncate">
            Agent: {caseItem.current_agent}
          </p>
        )}
      </div>

      {/* Parties row */}
      {(caseItem.party_1 || caseItem.party_2) && (
        <div className="px-5 pb-4 grid grid-cols-2 gap-2 border-t border-gray-50 pt-3">
          {[['Party A', caseItem.party_1], ['Party B', caseItem.party_2]].map(([label, val]) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</p>
              <p className="text-xs text-gray-600 truncate font-medium">{val || '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* View link */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-teal-600">View case</span>
        <ArrowRight size={13} className="text-teal-400" />
      </div>
    </button>
  );
}

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
      <div className="space-y-6 animate-fade-in">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FolderOpen size={20} className="text-white" />
              </div>
              <h1 className="text-3xl font-black text-navy-900 tracking-tight">Case Docket</h1>
            </div>
            <p className="text-gray-500 text-sm">
              {loading ? 'Loading cases…' : `${orderedCases.length} case${orderedCases.length !== 1 ? 's' : ''} found`}
            </p>
          </div>
          <button
            onClick={() => navigate('/cases/intake')}
            className="btn-primary flex-shrink-0 hidden sm:flex"
          >
            <Plus size={17} />
            New Case
          </button>
        </div>

        {/* Filters card */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={15} className="text-gray-400" />
            <span className="text-sm font-bold text-gray-700">Filter Cases</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="lg:col-span-2 relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, parties, or facts…"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400 bg-gray-50"
              />
            </div>
            {/* Domain */}
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
            >
              <option value="">All Domains</option>
              <option value="small_claims">Small Claims Tribunal</option>
              <option value="traffic_violation">Traffic Court</option>
            </select>
            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50"
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

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl bg-gray-100 animate-pulse" style={{ height: 280 }} />
            ))}
          </div>
        ) : orderedCases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
              <FolderOpen size={30} className="text-gray-300" />
            </div>
            <p className="text-gray-600 font-semibold mb-1">No cases found</p>
            <p className="text-gray-400 text-sm mb-6">Try adjusting the filters or create a new case</p>
            <button onClick={() => navigate('/cases/intake')} className="btn-primary">
              <Plus size={16} /> Create New Case
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {orderedCases.map((caseItem) => (
              <CaseCard
                key={caseItem.case_id}
                caseItem={caseItem}
                selected={selectedCaseId === caseItem.case_id}
                onClick={() => handleCaseClick(caseItem.case_id)}
              />
            ))}
          </div>
        )}
      </div>
    </AuthContentGate>
  );
}
