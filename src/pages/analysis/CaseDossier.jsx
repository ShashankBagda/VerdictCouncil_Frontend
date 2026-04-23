import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Download,
  Edit2,
  FileQuestion,
  FileSearch,
  FileText,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Scale,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth, useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import {
  extractItems,
  normalizeArgumentsResource,
  normalizeHearingAnalysis,
  normalizeEvidenceResource,
  normalizeKnowledgeBaseStatus,
  normalizeStatutesResource,
  normalizeTimelineResource,
  normalizeWitnessResource,
} from '../../lib/caseWorkspace';

import EvidenceGapsPanel from '../../components/analysis/EvidenceGapsPanel';
import PrecedentSearchPanel from '../../components/analysis/PrecedentSearchPanel';
import SourceExcerptModal from '../../components/analysis/SourceExcerptModal';
import FairnessAuditPanel from '../../components/analysis/FairnessAuditPanel';
import KnowledgeBaseStatusChip from '../../components/analysis/KnowledgeBaseStatusChip';
import DisputedFactsPanel from '../../components/analysis/DisputedFactsPanel';
import ReopenRequestForm from '../../components/judge/ReopenRequestForm';
import DecisionEntryForm from '../../components/cases/DecisionEntryForm';

const TABS = [
  { id: 'documents', label: 'Documents', icon: Paperclip, activeClass: 'bg-teal-100 text-teal-700 border-2 border-teal-300' },
  { id: 'evidence', label: 'Evidence', icon: FileText, activeClass: 'bg-blue-100 text-blue-700 border-2 border-blue-300' },
  { id: 'evidence-gaps', label: 'Evidence Gaps', icon: TriangleAlert, activeClass: 'bg-amber-100 text-amber-700 border-2 border-amber-300' },
  { id: 'timeline', label: 'Timeline', icon: Clock, activeClass: 'bg-purple-100 text-purple-700 border-2 border-purple-300' },
  { id: 'witnesses', label: 'Witnesses', icon: Users, activeClass: 'bg-green-100 text-green-700 border-2 border-green-300' },
  { id: 'law', label: 'Law & Statutes', icon: BookOpen, activeClass: 'bg-orange-100 text-orange-700 border-2 border-orange-300' },
  { id: 'precedents', label: 'Precedents', icon: FileSearch, activeClass: 'bg-cyan-100 text-cyan-700 border-2 border-cyan-300' },
  { id: 'arguments', label: 'Arguments', icon: MessageSquare, activeClass: 'bg-rose-100 text-rose-700 border-2 border-rose-300' },
  { id: 'questions', label: 'Suggested Questions', icon: FileQuestion, activeClass: 'bg-indigo-100 text-indigo-700 border-2 border-indigo-300' },
  { id: 'hearing_analysis', label: 'Hearing Analysis', icon: Scale, activeClass: 'bg-sky-100 text-sky-700 border-2 border-sky-300' },
  { id: 'fairness', label: 'Fairness', icon: ShieldCheck, activeClass: 'bg-violet-100 text-violet-700 border-2 border-violet-300' },
];

const RESTARTABLE_STATUSES = new Set(['failed', 'failed_retryable', 'escalated']);

function fileTypeIcon(fileType) {
  if (!fileType) return '📄';
  const t = fileType.toLowerCase();
  if (t.includes('pdf')) return '📕';
  if (t.includes('image') || t.includes('jpg') || t.includes('jpeg') || t.includes('png')) return '🖼️';
  if (t.includes('word') || t.includes('doc')) return '📝';
  if (t.includes('excel') || t.includes('sheet') || t.includes('csv')) return '📊';
  if (t.includes('video')) return '🎬';
  if (t.includes('audio')) return '🎵';
  return '📄';
}
const extractEvidenceGapItems = (payload) => {
  const root = payload?.data || payload || {};
  const weakEvidence = extractItems(root, ['weak_evidence']).map((item, index) => ({
    id: item.id || `weak-evidence-${index}`,
    title: `Weak ${item.evidence_type || 'evidence'} item`,
    description:
      Object.keys(item.admissibility_flags || {}).length > 0
        ? `Admissibility flags: ${Object.keys(item.admissibility_flags).join(', ')}`
        : 'This evidence item needs corroboration or closer admissibility review.',
    severity: item.strength === 'weak' ? 'significant' : 'medium',
    status: item.strength || 'unrated',
    next_step: 'Probe authenticity, corroboration, and legal sufficiency at hearing.',
  }));
  const uncorroboratedFacts = extractItems(root, ['uncorroborated_facts']).map((item, index) => ({
    id: item.id || `uncorroborated-${index}`,
    title: 'Uncorroborated fact',
    description: item.description || 'A fact record lacks corroborating support.',
    severity: item.confidence === 'high' ? 'significant' : 'medium',
    status: item.status || 'uncorroborated',
    next_step: 'Seek corroborating testimony or source material.',
  }));
  return [...weakEvidence, ...uncorroboratedFacts];
};

const extractDisputedFacts = (payload) =>
  extractItems(payload, ['events', 'disputed_facts', 'facts', 'items']).filter(
    (fact) => String(fact?.status || '').toLowerCase() === 'disputed',
  );

const extractFairnessChecks = (payload) =>
  extractItems(payload, ['governance_checks', 'checks', 'items', 'audit_checks']).map(
    (check, index) => ({
      id: check.id || check.audit_log_id || `fairness-${index}`,
      title: check.title || check.action || `Governance Check ${index + 1}`,
      description:
        check.description ||
        check.summary ||
        JSON.stringify(check.fairness_data || {}, null, 2),
      status:
        check.status ||
        check.fairness_data?.status ||
        check.fairness_data?.result ||
        'review',
      recommendation:
        check.recommendation ||
        check.fairness_data?.recommendation ||
        check.fairness_data?.action ||
        null,
    }),
  );

const extractPrecedentItems = (payload) =>
  extractItems(payload, ['results', 'precedents', 'items']).map((item) => ({
    ...item,
    title: item.title || item.citation || item.case_name || item.name,
    summary:
      item.summary || item.reasoning_summary || item.snippet || item.holding || null,
    score: item.score ?? item.relevance_score ?? item.similarity_score ?? null,
    url: item.url || item.link || item.elitigation_url || null,
  }));

const getFairnessSummary = (payload, checks) => {
  const root = payload?.data || payload || {};
  const fairnessReport = root.verdict_fairness_report || {};
  return {
    score:
      fairnessReport.score ??
      fairnessReport.overall_score ??
      root.score ??
      root.fairness_score ??
      root.overall_score ??
      null,
    summary:
      fairnessReport.summary ||
      root.summary ||
      root.assessment ||
      root.notes ||
      null,
    flagged:
      fairnessReport.flagged_issues ??
      fairnessReport.issue_count ??
      root.flagged_issues ??
      root.issue_count ??
      checks.filter((check) => !isCheckPassing(check)).length,
  };
};

const isCheckPassing = (check) => {
  const value = String(
    check?.status ?? check?.result ?? check?.outcome ?? check?.state ?? '',
  ).toLowerCase();
  return ['pass', 'passed', 'ok', 'clear', 'compliant', 'complete'].includes(value);
};

const evidenceTypeLabel = (item, idx) => item.title || item.label || item.name || `Evidence ${idx + 1}`;

function MetaBadge({ children, tone = 'gray' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
    violet: 'bg-violet-100 text-violet-700',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tones[tone] || tones.gray}`}>
      {children}
    </span>
  );
}

export default function CaseDossier() {
  const { caseId } = useParams();
  useAuth();
  const { showError, showNotification } = useAPI();
  const { activeTab, setActiveTab } = useCase();

  const [loading, setLoading] = useState(true);
  const [caseDetail, setCaseDetail] = useState(null);
  const [restarting, setRestarting] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [evidence, setEvidence] = useState(null);
  const [evidenceGaps, setEvidenceGaps] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [witnesses, setWitnesses] = useState(null);
  const [statutes, setStatutes] = useState(null);
  const [arguments_, setArguments] = useState(null);
  const [hearingAnalysis, setHearingAnalysis] = useState(null);
  const [fairnessAudit, setFairnessAudit] = useState(null);
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState(null);
  const [disputeReason, setDisputeReason] = useState({});
  const [disputeSubmitting, setDisputeSubmitting] = useState({});
  const [precedentQuery, setPrecedentQuery] = useState('');
  const [precedentDomain, setPrecedentDomain] = useState('');
  const [precedentResults, setPrecedentResults] = useState([]);
  const [searchingPrecedents, setSearchingPrecedents] = useState(false);
  const [precedentSearched, setPrecedentSearched] = useState(false);
  const [precedentSearchedAt, setPrecedentSearchedAt] = useState(null);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [reopenRequests, setReopenRequests] = useState([]);
  const [showDecisionForm, setShowDecisionForm] = useState(false);
  const [excerptTarget, setExcerptTarget] = useState(null);
  const [editingQuestions, setEditingQuestions] = useState({});
  const [savingQuestions, setSavingQuestions] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        const [
          caseDetailRes,
          evidenceRes,
          evidenceGapsRes,
          timelineRes,
          witnessesRes,
          statutesRes,
          argumentsRes,
          deliberationRes,
          fairnessRes,
          kbRes,
          reopenRequestsRes,
        ] = await Promise.allSettled([
          api.getCaseDetail(caseId),
          api.getEvidence(caseId),
          api.getEvidenceGaps(caseId),
          api.getTimeline(caseId),
          api.getWitnesses(caseId),
          api.getStatutes(caseId),
          api.getArguments(caseId),
          api.getHearingAnalysis(caseId),
          api.getFairnessAudit(caseId),
          api.getKnowledgeBaseStatus(),
          api.listReopenRequests(caseId),
        ]);

        setCaseDetail(caseDetailRes.status === 'fulfilled' ? caseDetailRes.value : null);
        setEvidence(
          evidenceRes.status === 'fulfilled' ? normalizeEvidenceResource(evidenceRes.value) : null,
        );
        setEvidenceGaps(evidenceGapsRes.status === 'fulfilled' ? evidenceGapsRes.value : null);
        setTimeline(
          timelineRes.status === 'fulfilled' ? normalizeTimelineResource(timelineRes.value) : null,
        );
        setWitnesses(
          witnessesRes.status === 'fulfilled'
            ? normalizeWitnessResource(witnessesRes.value)
            : null,
        );
        setStatutes(
          statutesRes.status === 'fulfilled'
            ? normalizeStatutesResource(statutesRes.value)
            : null,
        );
        setArguments(
          argumentsRes.status === 'fulfilled'
            ? normalizeArgumentsResource(argumentsRes.value)
            : null,
        );
        setHearingAnalysis(
          deliberationRes.status === 'fulfilled'
            ? normalizeHearingAnalysis(deliberationRes.value)
            : null,
        );
        setFairnessAudit(fairnessRes.status === 'fulfilled' ? fairnessRes.value : null);
        setKnowledgeBaseStatus(
          kbRes.status === 'fulfilled' ? normalizeKnowledgeBaseStatus(kbRes.value) : null,
        );
        setReopenRequests(
          reopenRequestsRes.status === 'fulfilled'
            ? reopenRequestsRes.value?.items || reopenRequestsRes.value?.data?.items || []
            : [],
        );
      } catch (err) {
        // intentional fall-through — individual fetch failures are already
        // handled above; only truly unexpected errors reach here
        showError(getErrorMessage(err, 'Failed to fetch case analysis'));
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [caseId, showError]);

  const evidenceGapItems = useMemo(() => extractEvidenceGapItems(evidenceGaps), [evidenceGaps]);
  const disputedFacts = useMemo(() => extractDisputedFacts(timeline), [timeline]);
  const fairnessChecks = useMemo(() => extractFairnessChecks(fairnessAudit), [fairnessAudit]);
  const fairnessSummary = useMemo(
    () => getFairnessSummary(fairnessAudit, fairnessChecks),
    [fairnessAudit, fairnessChecks],
  );

  const toggleExpanded = (id) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExport = () => {
    const dossier = {
      case_id: caseId,
      exported_at: new Date().toISOString(),
      evidence: evidence || null,
      evidence_gaps: evidenceGaps || null,
      timeline: timeline || null,
      witnesses: witnesses || null,
      statutes: statutes || null,
      arguments: arguments_ || null,
      hearing_analysis: hearingAnalysis || null,
      fairness_audit: fairnessAudit || null,
      knowledge_base_status: knowledgeBaseStatus || null,
      precedent_search_results: precedentResults || [],
    };

    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `case-${caseId}-dossier.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDisputeFact = async (fact, idx) => {
    const factId = fact?.id || fact?.fact_id || fact?.uuid || idx;
    const reason = disputeReason[factId]?.trim();

    if (!reason) {
      showError('Enter a reason before marking a fact as disputed.');
      return;
    }

    try {
      setDisputeSubmitting((prev) => ({ ...prev, [factId]: true }));
      await api.disputeFact(caseId, factId, { reason });
      setTimeline((current) => {
        if (!current) return current;
        if (Array.isArray(current?.events)) {
          return {
            ...current,
            events: current.events.map((item, itemIdx) => {
              const itemKey = item?.id || item?.fact_id || item?.uuid || itemIdx;
              if (String(itemKey) !== String(factId)) return item;
              return {
                ...item,
                status: 'disputed',
                disputed: true,
                dispute_reason: reason,
              };
            }),
          };
        }
        return current;
      });
      showNotification('Fact marked as disputed.', 'success');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to dispute fact'));
    } finally {
      setDisputeSubmitting((prev) => ({ ...prev, [factId]: false }));
    }
  };

  const handlePrecedentSearch = async () => {
    if (!precedentQuery.trim()) {
      showError('Enter a search query to look up precedents.');
      return;
    }

    try {
      setSearchingPrecedents(true);
      setPrecedentSearched(true);
      const payload = await api.searchPrecedents(precedentQuery.trim(), precedentDomain.trim() || undefined);
      setPrecedentResults(extractPrecedentItems(payload));
      setPrecedentSearchedAt(payload?.searched_at || payload?.data?.searched_at || new Date().toISOString());
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to search precedents'));
      setPrecedentResults([]);
    } finally {
      setSearchingPrecedents(false);
    }
  };

  const handleReopenRequest = async (payload) => {
    try {
      setReopenSubmitting(true);
      const response = await api.requestCaseReopen(caseId, payload);
      const item = response?.data || response;
      setReopenRequests((prev) => [item, ...prev]);
      showNotification('Reopen request submitted for senior review.', 'success');
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to submit reopen request'));
    } finally {
      setReopenSubmitting(false);
    }
  };

  const handleRestartPipeline = async () => {
    try {
      setRestarting(true);
      await api.restartPipeline(caseId);
      showNotification('Pipeline restarted — processing will begin shortly.', 'success');
      // Refresh case detail so the status badge updates
      const updated = await api.getCaseDetail(caseId);
      setCaseDetail(updated);
    } catch (err) {
      showError(getErrorMessage(err, 'Failed to restart pipeline'));
    } finally {
      setRestarting(false);
    }
  };

  if (loading) {
    return (
      <div className="card-lg flex items-center justify-center h-96">
        <div className="text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-gray-600">Loading case analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                Analysis Workspace
              </p>
              <h1 className="text-2xl font-bold text-navy-900">Case dossier</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <KnowledgeBaseStatusChip status={knowledgeBaseStatus} />
              {fairnessSummary?.score !== null && fairnessSummary?.score !== undefined && (
                <MetaBadge tone="violet">Fairness score {fairnessSummary.score}%</MetaBadge>
              )}
              {evidenceGapItems.length > 0 && (
                <MetaBadge tone="amber">{evidenceGapItems.length} evidence gaps</MetaBadge>
              )}
              {disputedFacts.length > 0 && (
                <MetaBadge tone="rose">{disputedFacts.length} disputed facts</MetaBadge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {RESTARTABLE_STATUSES.has(caseDetail?.status) && (
              <button
                onClick={handleRestartPipeline}
                disabled={restarting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-60"
                title="Restart the pipeline for this case"
              >
                <RefreshCw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
                {restarting ? 'Restarting…' : 'Restart Pipeline'}
              </button>
            )}
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setExpandedItems({});
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all whitespace-nowrap ${
                  isActive ? tab.activeClass : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'documents' && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
            <Paperclip className="w-6 h-6" />
            Case Documents
          </h2>

          {RESTARTABLE_STATUSES.has(caseDetail?.status) && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-300 bg-rose-50 px-5 py-4">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-900">
                  Pipeline {caseDetail.status === 'escalated' ? 'escalated' : 'failed'}
                </p>
                <p className="text-sm text-rose-800 mt-1">
                  {caseDetail.status === 'failed_retryable'
                    ? 'The pipeline was interrupted before completing. You can restart it using the button above.'
                    : caseDetail.status === 'escalated'
                    ? 'This case was escalated for human review. You may restart the pipeline if the issue has been resolved.'
                    : 'The pipeline encountered an error and could not complete. Check the audit log for details, then restart the pipeline.'}
                </p>
              </div>
              <button
                onClick={handleRestartPipeline}
                disabled={restarting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-60 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 ${restarting ? 'animate-spin' : ''}`} />
                {restarting ? 'Restarting…' : 'Restart Pipeline'}
              </button>
            </div>
          )}

          {(() => {
            const docs = caseDetail?.documents || [];
            if (docs.length === 0) {
              return (
                <div className="text-center py-12">
                  <Paperclip className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No documents attached to this case</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Documents are uploaded during case intake and are listed here for reference.
                  </p>
                </div>
              );
            }
            return (
              <div className="divide-y divide-gray-100">
                {docs.map((doc, idx) => (
                  <div key={doc.id || idx} className="flex items-center gap-4 py-3">
                    <span className="text-2xl" aria-hidden="true">{fileTypeIcon(doc.file_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-navy-900 truncate">{doc.filename || `Document ${idx + 1}`}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {doc.file_type && <span className="capitalize mr-2">{doc.file_type}</span>}
                        {doc.uploaded_at && (
                          <span>
                            Uploaded{' '}
                            {new Date(doc.uploaded_at).toLocaleDateString('en-SG', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </p>
                    </div>
                    {doc.openai_file_id && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono truncate max-w-[120px]">
                        {doc.openai_file_id}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {activeTab === 'evidence' && (
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6" />
              Evidence
            </h2>

            {evidence?.items && evidence.items.length > 0 ? (
              <div className="space-y-3">
                {evidence.items.map((item, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpanded(`ev-${idx}`)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-navy-900">{evidenceTypeLabel(item, idx)}</h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description || ''}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-sm">
                          {item.type || 'Document'}
                        </span>
                        {expandedItems[`ev-${idx}`] ? (
                          <ChevronUp className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        )}
                      </div>
                    </button>

                    {expandedItems[`ev-${idx}`] && (
                      <div className="border-t p-4 bg-gray-50 space-y-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">Full Content</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {item.content || item.description}
                          </p>
                        </div>
                        {item.source && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600">Source: {item.source}</p>
                          </div>
                        )}
                        {item.relevance && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">
                              Relevance: {item.relevance}%
                            </p>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${item.relevance}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No evidence available yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'evidence-gaps' && (
        <div className="space-y-4">
          <EvidenceGapsPanel items={evidenceGapItems} />

          <DisputedFactsPanel 
            facts={disputedFacts}
            disputeReasons={disputeReason}
            onReasonChange={(id, val) => setDisputeReason(prev => ({ ...prev, [id]: val }))}
            onDispute={handleDisputeFact}
            submitting={disputeSubmitting}
          />
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Timeline
          </h2>

          {timeline?.events && timeline.events.length > 0 ? (
            <div className="space-y-4">
              {timeline.events.map((event, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-purple-500 mt-2" />
                    {idx < timeline.events.length - 1 && <div className="w-0.5 h-16 bg-gray-200 mt-2" />}
                  </div>
                  <div className="pb-8 flex-1">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-purple-700 mb-1">{event.date || 'Date not available'}</p>
                      <h3 className="font-semibold text-navy-900 mb-2">{event.title || `Event ${idx + 1}`}</h3>
                      <p className="text-sm text-gray-700">{event.description || ''}</p>
                      {event.participants && (
                        <p className="text-xs text-gray-600 mt-2">
                          <span className="font-semibold">Parties:</span> {event.participants.join(', ')}
                        </p>
                      )}
                      {event.source_document_id && event.page_number && (
                        <button
                          onClick={() => setExcerptTarget({ documentId: event.source_document_id, page: event.page_number })}
                          className="mt-2 text-xs text-purple-600 hover:text-purple-800 font-semibold underline"
                        >
                          View source (p.{event.page_number})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No timeline available yet</p>
          )}
        </div>
      )}

      {activeTab === 'witnesses' && (
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Witnesses
            </h2>

            {witnesses?.items && witnesses.items.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {witnesses.items.map((witness, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpanded(`wit-${idx}`)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-navy-900">{witness.name || `Witness ${idx + 1}`}</h3>
                        <p className="text-sm text-gray-600 mt-1">{witness.role || 'Role not specified'}</p>
                      </div>
                      {expandedItems[`wit-${idx}`] ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {expandedItems[`wit-${idx}`] && (
                      <div className="border-t p-4 bg-gray-50 space-y-3 text-sm">
                        {witness.statement && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-2">Written Statement</p>
                            <p className="text-gray-700 whitespace-pre-wrap">{witness.statement}</p>
                          </div>
                        )}
                        {witness.simulated_testimony && (
                          <div className="border border-amber-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleExpanded(`wit-sim-${idx}`)}
                              className="w-full flex items-center justify-between px-4 py-2 bg-amber-50 hover:bg-amber-100 transition-colors"
                            >
                              <span className="text-xs font-semibold text-amber-700">Anticipated Testimony</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">Simulated — For Judicial Preparation Only</span>
                                {expandedItems[`wit-sim-${idx}`] ? (
                                  <ChevronUp className="w-4 h-4 text-amber-600" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-amber-600" />
                                )}
                              </div>
                            </button>
                            {expandedItems[`wit-sim-${idx}`] && (
                              <div className="p-4 bg-amber-50/50">
                                <p className="text-gray-700 whitespace-pre-wrap">{witness.simulated_testimony}</p>
                              </div>
                            )}
                          </div>
                        )}
                        {witness.credibility && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-2">Credibility Assessment</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div className="bg-green-500 h-2 rounded-full" style={{ width: `${witness.credibility}%` }} />
                              </div>
                              <span className="text-xs font-semibold">{witness.credibility}%</span>
                            </div>
                          </div>
                        )}
                        {witness.affiliation && (
                          <div>
                            <p className="text-xs text-gray-600">
                              <span className="font-semibold">Affiliation:</span> {witness.affiliation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No witness information available yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'law' && (
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              Applicable Law & Statutes
            </h2>

            {statutes?.items && statutes.items.length > 0 ? (
              <div className="space-y-3">
                {statutes.items.map((statute, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleExpanded(`law-${idx}`)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-navy-900">{statute.title || statute.code || `Statute ${idx + 1}`}</h3>
                        <p className="text-sm text-gray-600 mt-1">{statute.code && `Code: ${statute.code}`}</p>
                      </div>
                      {expandedItems[`law-${idx}`] ? (
                        <ChevronUp className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      )}
                    </button>

                    {expandedItems[`law-${idx}`] && (
                      <div className="border-t p-4 bg-gray-50 space-y-3 text-sm">
                        {statute.summary && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Summary</p>
                            <p className="text-gray-700">{statute.summary}</p>
                          </div>
                        )}
                        {statute.relevance && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Relevance</p>
                            <p className="text-gray-700">{statute.relevance}</p>
                          </div>
                        )}
                        {statute.precedents && statute.precedents.length > 0 && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Related Precedents</p>
                            <ul className="list-disc list-inside text-gray-700">
                              {statute.precedents.map((prec, pIdx) => (
                                <li key={pIdx}>{prec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No applicable statutes available yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'precedents' && (
        <PrecedentSearchPanel
          query={precedentQuery}
          onQueryChange={setPrecedentQuery}
          domain={precedentDomain}
          onDomainChange={setPrecedentDomain}
          onSearch={handlePrecedentSearch}
          results={precedentResults}
          searching={searchingPrecedents}
          searched={precedentSearched}
          searchedAt={precedentSearchedAt}
        />
      )}

      {activeTab === 'arguments' && (
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Arguments
            </h2>

            {arguments_ ? (
              <div className="space-y-6">
                {arguments_.claimant && (
                  <div className="border-l-4 border-rose-500 pl-4">
                    <h3 className="text-lg font-bold text-navy-900 mb-4">Claimant / Prosecution</h3>
                    <div className="space-y-3">
                      {arguments_.claimant.arguments?.map((arg, idx) => (
                        <div key={idx} className="bg-rose-50 border border-rose-200 rounded-lg p-4">
                          <p className="font-semibold text-navy-900 mb-2">{arg.title || `Argument ${idx + 1}`}</p>
                          <p className="text-sm text-gray-700 mb-3">{arg.text}</p>
                          {arg.weaknesses && (
                            <p className="text-xs text-rose-800 mb-3">
                              <span className="font-semibold">Weakness:</span> {arg.weaknesses}
                            </p>
                          )}
                          {arg.strength && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-gray-600">Strength:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div className="bg-rose-500 h-2 rounded-full" style={{ width: `${arg.strength}%` }} />
                              </div>
                              <span>{arg.strength}%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {arguments_.claimant.summary && (
                      <div className="mt-4 p-4 bg-rose-100 border border-rose-300 rounded-lg">
                        <p className="text-sm text-rose-900">
                          <span className="font-semibold">Summary:</span> {arguments_.claimant.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {arguments_.respondent && (
                  <div className="border-l-4 border-emerald-500 pl-4">
                    <h3 className="text-lg font-bold text-navy-900 mb-4">Respondent / Defense</h3>
                    <div className="space-y-3">
                      {arguments_.respondent.arguments?.map((arg, idx) => (
                        <div key={idx} className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                          <p className="font-semibold text-navy-900 mb-2">{arg.title || `Argument ${idx + 1}`}</p>
                          <p className="text-sm text-gray-700 mb-3">{arg.text}</p>
                          {arg.weaknesses && (
                            <p className="text-xs text-emerald-800 mb-3">
                              <span className="font-semibold">Weakness:</span> {arg.weaknesses}
                            </p>
                          )}
                          {arg.strength && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-gray-600">Strength:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${arg.strength}%` }} />
                              </div>
                              <span>{arg.strength}%</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {arguments_.respondent.summary && (
                      <div className="mt-4 p-4 bg-emerald-100 border border-emerald-300 rounded-lg">
                        <p className="text-sm text-emerald-900">
                          <span className="font-semibold">Summary:</span> {arguments_.respondent.summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No arguments available yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'questions' && (
        <div className="space-y-4">
          {['claimant', 'respondent'].map((side) => {
            const sideArgs = arguments_?.[side]?.arguments || [];
            const allQuestions = sideArgs.flatMap((arg, argIdx) =>
              (arg.suggested_questions || []).map((q, qIdx) => ({
                ...q,
                _argIdx: argIdx,
                _qIdx: qIdx,
                _key: `${side}-${argIdx}-${qIdx}`,
              })),
            );

            const TAG_COLORS = {
              factual_clarification: 'bg-blue-100 text-blue-700',
              evidence_gap: 'bg-amber-100 text-amber-700',
              credibility_probe: 'bg-rose-100 text-rose-700',
              legal_interpretation: 'bg-violet-100 text-violet-700',
            };

            return (
              <div key={side} className="card-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-navy-900 capitalize">
                    {side === 'claimant' ? 'Claimant / Prosecution' : 'Respondent / Defense'}
                  </h3>
                  <button
                    onClick={() => {
                      const newQ = { question: '', rationale: '', question_type: 'factual_clarification', targets_weakness: '' };
                      setEditingQuestions((prev) => ({
                        ...prev,
                        [`${side}-new`]: [...(prev[`${side}-new`] || []), newQ],
                      }));
                    }}
                    className="flex items-center gap-1 text-sm font-semibold text-teal-600 hover:text-teal-700"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                </div>
                {allQuestions.length === 0 && !editingQuestions[`${side}-new`]?.length && (
                  <p className="text-gray-500 text-sm">No suggested questions for this side yet.</p>
                )}
                <div className="space-y-3">
                  {allQuestions.map((q) => (
                    <div key={q._key} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          {editingQuestions[q._key] !== undefined ? (
                            <input
                              value={editingQuestions[q._key]}
                              onChange={(e) => setEditingQuestions((prev) => ({ ...prev, [q._key]: e.target.value }))}
                              className="input-field w-full text-sm"
                            />
                          ) : (
                            <p className="text-sm text-gray-800">{q.question}</p>
                          )}
                          {q.question_type && (
                            <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-semibold ${TAG_COLORS[q.question_type] || 'bg-gray-100 text-gray-700'}`}>
                              {q.question_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingQuestions((prev) => ({
                            ...prev,
                            [q._key]: prev[q._key] !== undefined ? undefined : q.question,
                          }))}
                          className="p-1 hover:bg-gray-100 rounded-sm text-gray-400 hover:text-gray-600"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(editingQuestions).some((k) => k !== `${side}-new` && editingQuestions[k] !== undefined) && (
                  <button
                    disabled={savingQuestions}
                    onClick={async () => {
                      setSavingQuestions(true);
                      try {
                        const updatedArgs = sideArgs.map((arg, argIdx) => ({
                          ...arg,
                          suggested_questions: (arg.suggested_questions || []).map((q, qIdx) => {
                            const key = `${side}-${argIdx}-${qIdx}`;
                            return editingQuestions[key] !== undefined
                              ? { ...q, question: editingQuestions[key] }
                              : q;
                          }),
                        }));
                        const allUpdated = updatedArgs.flatMap((a) => a.suggested_questions || []);
                        await api.updateSuggestedQuestions(caseId, { side, questions: allUpdated });
                        setEditingQuestions({});
                        showNotification('Questions saved.', 'success');
                      } catch (err) {
                        showError(getErrorMessage(err, 'Failed to save questions'));
                      } finally {
                        setSavingQuestions(false);
                      }
                    }}
                    className="mt-3 btn-primary text-sm"
                  >
                    {savingQuestions ? 'Saving...' : 'Save Edits'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'hearing_analysis' && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
            <Scale className="w-6 h-6" />
            Hearing Analysis & Reasoning
          </h2>

          {hearingAnalysis ? (
            <div className="space-y-6">
              {hearingAnalysis.preliminary_conclusion && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-navy-900 mb-2">Preliminary Conclusion</h3>
                  <p className="text-sm text-gray-800">{hearingAnalysis.preliminary_conclusion}</p>
                </div>
              )}

              {hearingAnalysis.reasoning && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Reasoning Chain</h3>
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-800 max-h-96 overflow-y-auto">
                    {hearingAnalysis.reasoning}
                  </div>
                </div>
              )}

              {hearingAnalysis.key_points && hearingAnalysis.key_points.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Key Points</h3>
                  <ul className="space-y-2">
                    {hearingAnalysis.key_points.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-cyan-600 font-bold text-lg mt-0.5">{idx + 1}.</span>
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hearingAnalysis.risks && hearingAnalysis.risks.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Potential Risks</h3>
                  <div className="space-y-2">
                    {hearingAnalysis.risks.map((risk, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <span className="text-amber-900">{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-6">
                {showDecisionForm ? (
                  <DecisionEntryForm
                    caseId={caseId}
                    hearingAnalysis={hearingAnalysis}
                    onDecisionRecorded={() => {
                      setShowDecisionForm(false);
                      showNotification('Judicial decision recorded.', 'success');
                    }}
                    onCancel={() => setShowDecisionForm(false)}
                  />
                ) : (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowDecisionForm(true)}
                      className="btn-primary"
                    >
                      Record Decision
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-navy-900 mb-3">Request Re-analysis</h3>
                <p className="text-sm text-gray-600 mb-4">
                  If new evidence has been submitted or a procedural issue is identified, you can request the pipeline to re-run this case.
                </p>
                <ReopenRequestForm
                  onSubmit={handleReopenRequest}
                  submitting={reopenSubmitting}
                />
                {reopenRequests.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-gray-700">Submitted requests:</p>
                    {reopenRequests.map((req, idx) => (
                      <div key={idx} className="text-sm text-gray-600 bg-gray-50 rounded-sm px-3 py-2">
                        {req.reason} — <span className="capitalize">{req.status || 'pending'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No hearing analysis available yet</p>
          )}
        </div>
      )}

      {activeTab === 'fairness' && (
        <FairnessAuditPanel 
          summary={fairnessSummary}
          checks={fairnessChecks}
        />
      )}

      {excerptTarget && (
        <SourceExcerptModal
          documentId={excerptTarget.documentId}
          page={excerptTarget.page}
          onClose={() => setExcerptTarget(null)}
        />
      )}

      {!knowledgeBaseStatus?.initialized && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <Database className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">Knowledge base is not ready</p>
            <p className="text-sm text-amber-800 mt-1">
              Case analysis can continue, but precedent support from private legal materials will stay limited until the knowledge base is initialized and populated.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
