import { useEffect, useState } from 'react';
import {
  FileText, Plus, TrendingUp, TriangleAlert, Scale, ArrowRight,
  CheckCircle, Clock, AlertCircle, Activity, Zap, Shield
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAPI } from '../hooks';
import api, { getErrorMessage } from '../lib/api';
import AgentPipelineVisualizer from '../components/AgentPipelineVisualizer';

const STATUS_COLORS = {
  processing:   { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200',   icon: Clock },
  completed:    { bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200', icon: CheckCircle },
  escalated:    { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200',   icon: TriangleAlert },
  failed:       { bg: 'bg-rose-50',    text: 'text-rose-700',   border: 'border-rose-200',    icon: AlertCircle },
  closed:       { bg: 'bg-gray-100',   text: 'text-gray-600',   border: 'border-gray-200',    icon: AlertCircle },
};

function StatCard({ label, value, sub, gradient, icon: Icon, delay = 0 }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6 text-white"
      style={{
        background: gradient,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Decorative circle */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full bg-white/5" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">{label}</p>
            <p className="text-4xl font-black tracking-tight">{value}</p>
            {sub && <p className="text-white/70 text-sm mt-2 leading-tight">{sub}</p>}
          </div>
          {Icon && (
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Icon size={22} className="text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, title, desc, onClick, color, gradient }) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-1 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
      style={{
        background: 'white',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
        border: '1.5px solid rgba(0,0,0,0.06)',
      }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: gradient }}
      />
      <div className="relative">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: gradient }}>
          <Icon size={20} style={{ color }} />
        </div>
        <h3 className="font-bold text-navy-900 text-sm mb-1">{title}</h3>
        <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
        <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-600 mt-3 transition-colors" />
      </div>
    </button>
  );
}

function RecentCaseRow({ item, onClick }) {
  const status = STATUS_COLORS[item.status] || STATUS_COLORS.processing;
  const Icon = status.icon;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3.5 rounded-xl hover:bg-gray-50 transition-all duration-150 group text-left"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${status.bg} ${status.border} border`}>
        <Icon size={15} className={status.text} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-navy-900 text-sm truncate">
          {item.title || `Case ${String(item.id).slice(0, 8)}`}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {item.domain === 'small_claims' ? 'Small Claims Tribunal' : 'Traffic Court'}
          {item.filed_date
            ? ` • ${new Date(item.filed_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
            : item.created_at
              ? ` • ${new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
              : ''}
        </p>
      </div>
      <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold ${status.bg} ${status.text} border ${status.border}`}>
        {item.status}
      </span>
      <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
    </button>
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
    return () => { cancelled = true; };
  }, [showError]);

  const recentCases = stats?.recent_cases || [];

  return (
    <div className="space-y-7 animate-fade-in">

      {/* ── Hero greeting ──────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-teal-500 to-cyan-400 flex items-center justify-center shadow-glow-teal">
              <Scale size={20} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-navy-900 tracking-tight">Dashboard</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Real-time overview of your judicial AI pipeline and case docket.
          </p>
        </div>
        <button
          onClick={() => navigate('/cases/intake')}
          className="btn-primary shrink-0 hidden sm:flex"
        >
          <Plus size={17} />
          New Case
        </button>
      </div>

      {/* ── Stats grid ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Cases"
          value={loading ? '—' : (stats?.total_cases ?? 0)}
          sub={loading ? null : `SCT: ${stats?.by_domain?.small_claims ?? 0}  •  Traffic: ${stats?.by_domain?.traffic_violation ?? 0}`}
          gradient="linear-gradient(135deg, #0891b2 0%, #06b6d4 60%, #22d3ee 100%)"
          icon={FileText}
          delay={0}
        />
        <StatCard
          label="Escalation Rate"
          value={loading ? '—' : `${stats?.escalation_rate_percent ?? 0}%`}
          sub="Cases requiring special judicial review"
          gradient="linear-gradient(135deg, #d97706 0%, #f59e0b 60%, #fbbf24 100%)"
          icon={TriangleAlert}
          delay={80}
        />
        <StatCard
          label="Avg Confidence"
          value={loading ? '—' : (stats?.average_verdict_confidence != null ? `${stats.average_verdict_confidence}` : 'n/a')}
          sub="Governance verdict confidence score"
          gradient="linear-gradient(135deg, #059669 0%, #10b981 60%, #34d399 100%)"
          icon={TrendingUp}
          delay={160}
        />
      </div>

      {/* ── Quick Actions ──────────────────────────────── */}
      <div>
        <h2 className="section-heading mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickActionCard
            icon={Plus}
            title="New Case"
            desc="Open a structured intake form"
            onClick={() => navigate('/cases/intake')}
            color="#06b6d4"
            gradient="linear-gradient(135deg, #cffafe 0%, #e0f2fe 100%)"
          />
          <QuickActionCard
            icon={FileText}
            title="View Docket"
            desc="Browse and filter all cases"
            onClick={() => navigate('/cases')}
            color="#8b5cf6"
            gradient="linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)"
          />
          <QuickActionCard
            icon={Activity}
            title="Pipeline Status"
            desc="Monitor the 9-agent pipeline"
            onClick={() => navigate('/cases')}
            color="#f59e0b"
            gradient="linear-gradient(135deg, #fef3c7 0%, #fffbeb 100%)"
          />
          <QuickActionCard
            icon={Zap}
            title="What-If Analysis"
            desc="Contestable judgment mode"
            onClick={() => navigate('/cases')}
            color="#10b981"
            gradient="linear-gradient(135deg, #d1fae5 0%, #ecfdf5 100%)"
          />
        </div>
      </div>

      {/* ── Agent Pipeline Visualizer ──────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #0d1520 0%, #1a2332 100%)', boxShadow: '0 8px 40px rgba(13,21,32,0.35)' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Zap size={15} className="text-teal-400" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">AI Agent Pipeline</h2>
                <p className="text-white/40 text-xs">9 specialized agents working in concert</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-teal-300 bg-teal-500/15 border border-teal-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Live
            </span>
          </div>
          <AgentPipelineVisualizer pipelineAgents={null} compact={false} />
        </div>
      </div>

      {/* ── Recent Cases + System Health ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Cases – 2/3 wide */}
        <div className="lg:col-span-2 card-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-navy-900 text-base">Recent Cases</h3>
            <button
              onClick={() => navigate('/cases')}
              className="text-teal-600 hover:text-teal-700 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight size={12} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : recentCases.length > 0 ? (
            <div className="space-y-1">
              {recentCases.slice(0, 6).map((item) => (
                <RecentCaseRow
                  key={item.id}
                  item={item}
                  onClick={() => navigate(`/case/${item.id}`)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                <FileText size={22} className="text-gray-300" />
              </div>
              <p className="text-gray-500 text-sm font-medium">No cases yet</p>
              <p className="text-gray-400 text-xs mt-1">Create your first case to get started</p>
              <button onClick={() => navigate('/cases/intake')} className="btn-primary btn-sm mt-4">
                <Plus size={14} /> New Case
              </button>
            </div>
          )}
        </div>

        {/* System Health – 1/3 wide */}
        <div className="card-lg flex flex-col gap-4">
          <h3 className="font-bold text-navy-900 text-base">System Health</h3>

          {/* Status items */}
          {[
            {
              label: 'API Gateway',
              value: 'Operational',
              ok: true,
            },
            {
              label: 'PAIR Circuit Breaker',
              value: loading ? '…' : (stats?.pair_api_status?.state || 'closed'),
              ok: !loading && (stats?.pair_api_status?.state === 'closed' || !stats?.pair_api_status),
            },
            {
              label: 'Avg Processing Time',
              value: loading ? '…' : (stats?.average_processing_time_seconds != null ? `${stats.average_processing_time_seconds}s` : 'n/a'),
              ok: true,
            },
            {
              label: 'Agent Pipeline',
              value: '9 agents ready',
              ok: true,
            },
          ].map(({ label, value, ok }) => (
            <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-sm text-gray-600 font-medium">{label}</span>
              </div>
              <span className="text-xs font-semibold text-gray-700">{value}</span>
            </div>
          ))}

          <div className="mt-auto pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Shield size={12} />
              <span>Secured by VerdictCouncil AI</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
