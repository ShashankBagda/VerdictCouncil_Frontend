import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  FileText,
  FolderOpen,
  Plus,
  Search,
  TriangleAlert,
} from 'lucide-react';

import AuthContentGate from '@/components/auth/AuthContentGate';
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
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAPI, useCase } from '@/hooks';
import api, { getErrorMessage } from '@/lib/api';
import { normalizeCaseSummary } from '@/lib/caseWorkspace';

const STATUS_CONFIG = {
  processing: { label: 'Processing', icon: Clock, variant: 'outline' },
  completed: { label: 'Completed', icon: CheckCircle, variant: 'secondary' },
  escalated: { label: 'Escalated', icon: TriangleAlert, variant: 'outline' },
  rejected: { label: 'Rejected', icon: AlertCircle, variant: 'destructive' },
  closed: { label: 'Closed', icon: AlertCircle, variant: 'secondary' },
  failed: { label: 'Failed', icon: AlertCircle, variant: 'destructive' },
};

function domainLabel(domain) {
  if (domain === 'small_claims') return 'Small Claims Tribunal';
  if (domain === 'traffic_violation') return 'Traffic Court';
  return 'Unassigned domain';
}

function CaseRow({ caseItem, selected, onClick }) {
  const cfg = STATUS_CONFIG[caseItem.status] || STATUS_CONFIG.processing;
  const Icon = cfg.icon;
  const date = caseItem.filed_date || caseItem.created_at;
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'No filing date';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-current={selected ? 'true' : undefined}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={cfg.variant}>
              <Icon data-icon="inline-start" />
              {cfg.label}
            </Badge>
            <Badge variant="outline">{domainLabel(caseItem.domain)}</Badge>
            {caseItem.escalation_reason && <Badge variant="outline">Escalated</Badge>}
          </div>
          <h3 className="mt-3 truncate text-base font-semibold">
            {caseItem.title || `Case ${String(caseItem.case_id).slice(0, 8)}`}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {caseItem.case_description || 'No description available.'}
          </p>
          {(caseItem.party_1 || caseItem.party_2) && (
            <p className="mt-2 truncate text-xs text-muted-foreground">
              {caseItem.party_1 || 'Party A'} vs {caseItem.party_2 || 'Party B'}
            </p>
          )}
        </div>

        <div className="flex min-w-56 flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{formattedDate}</span>
            <span>{caseItem.pipeline_progress}%</span>
          </div>
          <Progress value={caseItem.pipeline_progress || 0} />
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">
              {caseItem.current_agent ? `Agent: ${caseItem.current_agent}` : 'Pipeline not started'}
            </span>
            <ArrowRight />
          </div>
        </div>
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
  const [domainFilter, setDomainFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchCases = async () => {
      try {
        setLoading(true);
        const res = await api.listCases({
          domain_filter: domainFilter === 'all' ? undefined : domainFilter,
          status_filter: statusFilter === 'all' ? undefined : statusFilter,
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
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FolderOpen className="text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight">Case Docket</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading ? 'Loading cases...' : `${orderedCases.length} case${orderedCases.length === 1 ? '' : 's'} found`}
            </p>
          </div>
          <Button type="button" onClick={() => navigate('/cases/intake')}>
            <Plus data-icon="inline-start" />
            New Case
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Search and narrow the docket.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
              <Field>
                <FieldLabel htmlFor="case-search">Search</FieldLabel>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="case-search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Case title, party, or description"
                    className="pl-8"
                  />
                </div>
              </Field>
              <Field>
                <FieldLabel>Domain</FieldLabel>
                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All domains</SelectItem>
                      <SelectItem value="small_claims">Small Claims Tribunal</SelectItem>
                      <SelectItem value="traffic_violation">Traffic Court</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Status</FieldLabel>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="escalated">Escalated</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Cases</CardTitle>
              <CardDescription>Newest matters first</CardDescription>
            </div>
            <Badge variant="outline">
              <Activity data-icon="inline-start" />
              Live status
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-28" />
                ))}
              </div>
            ) : orderedCases.length > 0 ? (
              <div className="flex flex-col gap-3">
                {orderedCases.map((item) => (
                  <CaseRow
                    key={item.case_id}
                    caseItem={item}
                    selected={selectedCaseId === item.case_id}
                    onClick={() => handleCaseClick(item.case_id)}
                  />
                ))}
              </div>
            ) : (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileText />
                  </EmptyMedia>
                  <EmptyTitle>No matching cases</EmptyTitle>
                  <EmptyDescription>Adjust filters or create a new case.</EmptyDescription>
                </EmptyHeader>
                <Button type="button" size="sm" onClick={() => navigate('/cases/intake')}>
                  <Plus data-icon="inline-start" />
                  New Case
                </Button>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthContentGate>
  );
}
