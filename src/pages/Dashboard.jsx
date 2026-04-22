import { useEffect, useState } from 'react';
import { FileText, Plus, TrendingUp, TriangleAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../hooks';
import api, { getErrorMessage } from '../lib/api';

function MetricCard({ label, value, detail, tone = 'slate', icon: Icon }) {
  const toneClass = {
    slate: 'bg-slate-50 border-slate-200 text-slate-900',
    teal: 'bg-teal-50 border-teal-200 text-teal-900',
    amber: 'bg-amber-50 border-amber-200 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  }[tone];

  return (
    <div className={`card-lg border ${toneClass}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{label}</p>
          <p className="text-4xl font-extrabold mt-2">{value}</p>
          {detail && <p className="text-sm text-gray-600 mt-3">{detail}</p>}
        </div>
        {Icon ? <Icon className="w-8 h-8 text-current opacity-70" /> : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { showError } = useAPI();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        setLoading(true);
        const payload = await api.getDashboardStats();
        if (!cancelled) setStats(payload?.data || payload || null);
      } catch (error) {
        if (!cancelled) showError(getErrorMessage(error, 'Failed to load dashboard stats'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadStats();
    return () => {
      cancelled = true;
    };
  }, [showError]);

  const recentCases = stats?.recent_cases || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-navy-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">
          Story-aligned overview of case volume, escalation load, and current recommendation confidence.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate('/cases/intake')}
          className="card-lg hover:shadow-lg transition-shadow cursor-pointer flex items-center gap-4"
        >
          <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
            <Plus className="text-teal-600" size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-navy-900">New Case</h3>
            <p className="text-sm text-gray-600">Create a structured intake record</p>
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
            <p className="text-sm text-gray-600">Browse the active docket</p>
          </div>
        </button>

        <div className="card-lg flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-emerald-600" size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-navy-900">Backend Metrics</h3>
            <p className="text-sm text-gray-600">
              {loading ? 'Loading current aggregates...' : 'Live counts from the API.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          label="Cases Processed"
          value={loading ? '...' : stats?.total_cases ?? 0}
          detail={
            loading
              ? 'Loading totals...'
              : `SCT: ${stats?.by_domain?.small_claims ?? 0} • Traffic: ${stats?.by_domain?.traffic_violation ?? 0}`
          }
          tone="teal"
          icon={FileText}
        />
        <MetricCard
          label="Escalation Rate"
          value={loading ? '...' : `${stats?.escalation_rate_percent ?? 0}%`}
          detail="Current share of cases requiring special judicial review."
          tone="amber"
          icon={TriangleAlert}
        />
        <MetricCard
          label="Avg Confidence"
          value={
            loading
              ? '...'
              : stats?.average_verdict_confidence != null
                ? `${stats.average_verdict_confidence}`
                : 'n/a'
          }
          detail="Average governance-verdict confidence across stored recommendations."
          tone="emerald"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-lg">
          <h3 className="font-semibold text-navy-900 mb-4">Recent Cases</h3>
          {loading ? (
            <p className="text-gray-500">Loading recent case activity...</p>
          ) : recentCases.length > 0 ? (
            <div className="space-y-3">
              {recentCases.map((item) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/case/${item.id}`)}
                  className="w-full text-left rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
                >
                  <p className="font-semibold text-navy-900">
                    {item.title || `Case ${String(item.id).slice(0, 8)}`}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {item.domain === 'small_claims' ? 'SCT' : 'Traffic'} • {item.status}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {item.filed_date
                      ? `Filed ${new Date(item.filed_date).toLocaleDateString()}`
                      : new Date(item.created_at).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No recent cases available.</p>
          )}
        </div>

        <div className="card-lg">
          <h3 className="font-semibold text-navy-900 mb-4">System Health</h3>
          {loading ? (
            <p className="text-gray-500">Checking PAIR and backend health...</p>
          ) : (
            <div className="space-y-3 text-sm text-gray-700">
              <p>
                <span className="font-semibold">PAIR circuit breaker:</span>{' '}
                {stats?.pair_api_status?.state || 'unknown'}
              </p>
              <p>
                <span className="font-semibold">Average processing time:</span>{' '}
                {stats?.average_processing_time_seconds != null
                  ? `${stats.average_processing_time_seconds}s`
                  : 'Pending backend implementation'}
              </p>
              <p>
                <span className="font-semibold">Cost per case:</span> Pending backend implementation
              </p>
              <p className="text-xs text-gray-500">
                The dashboard reflects the metrics currently exposed by the backend and does not
                claim unavailable cost or latency analytics.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
