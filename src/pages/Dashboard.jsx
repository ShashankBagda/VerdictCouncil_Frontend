import { createElement, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  Scale,
  Shield,
  TrendingUp,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import AgentPipelineVisualizer from '@/components/AgentPipelineVisualizer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAPI } from '@/hooks';
import api, { getErrorMessage } from '@/lib/api';

const STATUS_CONFIG = {
  processing: { label: 'Processing', icon: Clock, variant: 'outline' },
  completed: { label: 'Completed', icon: CheckCircle, variant: 'secondary' },
  escalated: { label: 'Escalated', icon: TriangleAlert, variant: 'outline' },
  failed: { label: 'Failed', icon: AlertCircle, variant: 'destructive' },
  closed: { label: 'Closed', icon: AlertCircle, variant: 'secondary' },
};

function StatCard({ label, value, description, icon: Icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardDescription>{label}</CardDescription>
          <CardTitle className="mt-2 text-2xl">{value}</CardTitle>
        </div>
        <div className="rounded-md border bg-muted p-2 text-muted-foreground">
          {createElement(Icon)}
        </div>
      </CardHeader>
      {description && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
      )}
    </Card>
  );
}

function QuickActionCard({ icon: Icon, title, description, onClick }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto justify-start p-4 text-left"
      onClick={onClick}
    >
        <span className="flex w-full items-start gap-3">
          <span className="rounded-md bg-muted p-2 text-muted-foreground">
            {createElement(Icon)}
          </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{description}</span>
        </span>
        <ArrowRight data-icon="inline-end" />
      </span>
    </Button>
  );
}

function RecentCaseRow({ item, onClick }) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.processing;
  const Icon = status.icon;
  const date = item.filed_date || item.created_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : 'No date';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="rounded-md border bg-background p-2 text-muted-foreground">
        <Icon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {item.title || `Case ${String(item.id).slice(0, 8)}`}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {item.domain === 'small_claims' ? 'Small Claims Tribunal' : 'Traffic Court'} · {formattedDate}
        </p>
      </div>
      <Badge variant={status.variant}>{status.label}</Badge>
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
    return () => {
      cancelled = true;
    };
  }, [showError]);

  const recentCases = stats?.recent_cases || [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Scale className="text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time view of case load, pipeline health, and judicial review queues.
          </p>
        </div>
        <Button type="button" onClick={() => navigate('/cases/intake')}>
          <Plus data-icon="inline-start" />
          New Case
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Total Cases"
          value={loading ? '...' : (stats?.total_cases ?? 0)}
          description={
            loading
              ? 'Loading docket totals'
              : `SCT: ${stats?.by_domain?.small_claims ?? 0} · Traffic: ${stats?.by_domain?.traffic_violation ?? 0}`
          }
          icon={FileText}
        />
        <StatCard
          label="Escalation Rate"
          value={loading ? '...' : `${stats?.escalation_rate_percent ?? 0}%`}
          description="Cases requiring special judicial review"
          icon={TriangleAlert}
        />
        <StatCard
          label="Average Confidence"
          value={
            loading
              ? '...'
              : stats?.average_verdict_confidence != null
                ? `${stats.average_verdict_confidence}`
                : 'n/a'
          }
          description="Governance verdict confidence score"
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionCard
          icon={Plus}
          title="New Case"
          description="Start document-led intake"
          onClick={() => navigate('/cases/intake')}
        />
        <QuickActionCard
          icon={FileText}
          title="View Docket"
          description="Browse and filter all cases"
          onClick={() => navigate('/cases')}
        />
        <QuickActionCard
          icon={Activity}
          title="Pipeline Status"
          description="Monitor active agent work"
          onClick={() => navigate('/cases')}
        />
        <QuickActionCard
          icon={Zap}
          title="What-If Analysis"
          description="Open contestable analysis"
          onClick={() => navigate('/cases')}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">AI Agent Pipeline</CardTitle>
            <CardDescription>9 specialized agents working in concert</CardDescription>
          </div>
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-primary" />
            Live
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-slate-950 p-4">
            <AgentPipelineVisualizer pipelineAgents={null} compact={false} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Recent Cases</CardTitle>
              <CardDescription>Latest matters in the docket</CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/cases')}>
              View all
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-2">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-12" />
                ))}
              </div>
            ) : recentCases.length > 0 ? (
              <div className="flex flex-col gap-1">
                {recentCases.slice(0, 6).map((item) => (
                  <RecentCaseRow key={item.id} item={item} onClick={() => navigate(`/case/${item.id}`)} />
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle>No cases yet</EmptyTitle>
                  <EmptyDescription>Create your first case to begin intake.</EmptyDescription>
                </EmptyHeader>
                <Button type="button" size="sm" onClick={() => navigate('/cases/intake')}>
                  <Plus data-icon="inline-start" />
                  New Case
                </Button>
              </Empty>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Health</CardTitle>
            <CardDescription>Operational signals</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[
              { label: 'API Gateway', value: 'Operational', ok: true },
              {
                label: 'PAIR Circuit Breaker',
                value: loading ? '...' : (stats?.pair_api_status?.state || 'closed'),
                ok: !loading && (stats?.pair_api_status?.state === 'closed' || !stats?.pair_api_status),
              },
              {
                label: 'Avg Processing Time',
                value:
                  loading
                    ? '...'
                    : stats?.average_processing_time_seconds != null
                      ? `${stats.average_processing_time_seconds}s`
                      : 'n/a',
                ok: true,
              },
              { label: 'Agent Pipeline', value: '9 agents ready', ok: true },
            ].map(({ label, value, ok }, index) => (
              <div key={label}>
                {index > 0 && <Separator className="mb-3" />}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={ok ? 'size-2 rounded-full bg-primary' : 'size-2 rounded-full bg-muted-foreground'} />
                    <span className="truncate text-sm">{label}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{value}</span>
                </div>
              </div>
            ))}
            <Separator />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield />
              Secured by VerdictCouncil AI
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
