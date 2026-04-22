import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Download,
  FileSearch,
  FileText,
  MessageSquare,
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
  normalizeDeliberationResource,
  normalizeEvidenceResource,
  normalizeKnowledgeBaseStatus,
  normalizeStatutesResource,
  normalizeTimelineResource,
  normalizeVerdict,
  normalizeWitnessResource,
} from '../../lib/caseWorkspace';

// New Components
import EvidenceGapsPanel from '../../components/analysis/EvidenceGapsPanel';
import PrecedentSearchPanel from '../../components/analysis/PrecedentSearchPanel';
import FairnessAuditPanel from '../../components/analysis/FairnessAuditPanel';
import KnowledgeBaseStatusChip from '../../components/analysis/KnowledgeBaseStatusChip';
import DisputedFactsPanel from '../../components/analysis/DisputedFactsPanel';
import DecisionForm from '../../components/cases/DecisionForm';
import ReopenRequestForm from '../../components/judge/ReopenRequestForm';

const TABS = [
  { id: 'evidence', label: 'Evidence', icon: FileText, activeClass: 'bg-blue-100 text-blue-700 border-2 border-blue-300' },
  { id: 'evidence-gaps', label: 'Evidence Gaps', icon: TriangleAlert, activeClass: 'bg-amber-100 text-amber-700 border-2 border-amber-300' },
  { id: 'timeline', label: 'Timeline', icon: Clock, activeClass: 'bg-purple-100 text-purple-700 border-2 border-purple-300' },
  { id: 'witnesses', label: 'Witnesses', icon: Users, activeClass: 'bg-green-100 text-green-700 border-2 border-green-300' },
  { id: 'law', label: 'Law & Statutes', icon: BookOpen, activeClass: 'bg-orange-100 text-orange-700 border-2 border-orange-300' },
  { id: 'precedents', label: 'Precedents', icon: FileSearch, activeClass: 'bg-cyan-100 text-cyan-700 border-2 border-cyan-300' },
  { id: 'arguments', label: 'Arguments', icon: MessageSquare, activeClass: 'bg-rose-100 text-rose-700 border-2 border-rose-300' },
  { id: 'deliberation', label: 'Deliberation', icon: Scale, activeClass: 'bg-sky-100 text-sky-700 border-2 border-sky-300' },
  { id: 'fairness', label: 'Fairness', icon: ShieldCheck, activeClass: 'bg-violet-100 text-violet-700 border-2 border-violet-300' },
  { id: 'verdict', label: 'Verdict', icon: CheckCircle, activeClass: 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' },
];
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
  const [expandedItems, setExpandedItems] = useState({});
  const [evidence, setEvidence] = useState(null);
  const [evidenceGaps, setEvidenceGaps] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [witnesses, setWitnesses] = useState(null);
  const [statutes, setStatutes] = useState(null);
  const [arguments_, setArguments] = useState(null);
  const [deliberation, setDeliberation] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [fairnessAudit, setFairnessAudit] = useState(null);
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState(null);
  const [decisionType, setDecisionType] = useState('accept');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionLocked, setDecisionLocked] = useState(false);
  const [disputeReason, setDisputeReason] = useState({});
  const [disputeSubmitting, setDisputeSubmitting] = useState({});
  const [precedentQuery, setPrecedentQuery] = useState('');
  const [precedentDomain, setPrecedentDomain] = useState('');
  const [precedentResults, setPrecedentResults] = useState([]);
  const [searchingPrecedents, setSearchingPrecedents] = useState(false);
  const [precedentSearched, setPrecedentSearched] = useState(false);
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const [reopenRequests, setReopenRequests] = useState([]);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);

        const [
          evidenceRes,
          evidenceGapsRes,
          timelineRes,
          witnessesRes,
          statutesRes,
          argumentsRes,
          deliberationRes,
          verdictRes,
          fairnessRes,
          kbRes,
          reopenRequestsRes,
        ] = await Promise.allSettled([
          api.getEvidence(caseId),
          api.getEvidenceGaps(caseId),
          api.getTimeline(caseId),
          api.getWitnesses(caseId),
          api.getStatutes(caseId),
          api.getArguments(caseId),
          api.getDeliberation(caseId),
          api.getVerdict(caseId),
          api.getFairnessAudit(caseId),
          api.getKnowledgeBaseStatus(),
          api.listReopenRequests(caseId),
        ]);

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
        setDeliberation(
          deliberationRes.status === 'fulfilled'
            ? normalizeDeliberationResource(deliberationRes.value)
            : null,
        );
        setVerdict(verdictRes.status === 'fulfilled' ? normalizeVerdict(verdictRes.value) : null);
        setFairnessAudit(fairnessRes.status === 'fulfilled' ? fairnessRes.value : null);
        setKnowledgeBaseStatus(
          kbRes.status === 'fulfilled' ? normalizeKnowledgeBaseStatus(kbRes.value) : null,
        );
        setReopenRequests(
          reopenRequestsRes.status === 'fulfilled'
            ? reopenRequestsRes.value?.items || reopenRequestsRes.value?.data?.items || []
            : [],
        );

        if (verdictRes.status === 'fulfilled') {
          const normalizedVerdict = normalizeVerdict(verdictRes.value);
          if (normalizedVerdict?.judge_decision || normalizedVerdict?.decision_recorded_at) {
            setDecisionLocked(true);
          }
        }
      } catch (err) {
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
      deliberation: deliberation || null,
      fairness_audit: fairnessAudit || null,
      knowledge_base_status: knowledgeBaseStatus || null,
      precedent_search_results: precedentResults || [],
      verdict: verdict || null,
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

  const handleDecisionSubmit = async () => {
    const requiresReason = decisionType === 'modify' || decisionType === 'reject';

    if (requiresReason && !decisionReason.trim()) {
      showError('Modify and Reject decisions require a written reason.');
      return;
    }

    try {
      setDecisionSubmitting(true);
      const payload = await api.recordDecision(caseId, {
        decision_type: decisionType,
        reason: decisionReason.trim() || undefined,
      });

      const nextVerdict = normalizeVerdict(payload);
      setVerdict({
        ...verdict,
        ...nextVerdict,
        judge_decision: decisionType,
        judge_reason: decisionReason.trim() || null,
        decision_recorded_at: new Date().toISOString(),
      });
      setDecisionLocked(true);
      showNotification('Decision recorded successfully.', 'success');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to record decision'));
    } finally {
      setDecisionSubmitting(false);
    }
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

          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
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
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
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
                            <p className="font-semibold text-gray-700 mb-2">Statement</p>
                            <p className="text-gray-700 whitespace-pre-wrap">{witness.statement}</p>
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

      {activeTab === 'deliberation' && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
            <Scale className="w-6 h-6" />
            Deliberation & Reasoning
          </h2>

          {deliberation ? (
            <div className="space-y-6">
              {deliberation.preliminary_conclusion && (
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-navy-900 mb-2">Preliminary Conclusion</h3>
                  <p className="text-sm text-gray-800">{deliberation.preliminary_conclusion}</p>
                </div>
              )}

              {deliberation.reasoning && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Reasoning Chain</h3>
                  <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 whitespace-pre-wrap text-sm text-gray-800 max-h-96 overflow-y-auto">
                    {deliberation.reasoning}
                  </div>
                </div>
              )}

              {deliberation.key_points && deliberation.key_points.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Key Points</h3>
                  <ul className="space-y-2">
                    {deliberation.key_points.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-cyan-600 font-bold text-lg mt-0.5">{idx + 1}.</span>
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {deliberation.risks && deliberation.risks.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Potential Risks</h3>
                  <div className="space-y-2">
                    {deliberation.risks.map((risk, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span className="text-amber-900">{risk}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No deliberation available yet</p>
          )}
        </div>
      )}

      {activeTab === 'fairness' && (
        <FairnessAuditPanel 
          summary={fairnessSummary}
          checks={fairnessChecks}
        />
      )}

      {activeTab === 'verdict' && (
        <div className="space-y-6">
          <DecisionForm 
            verdict={verdict}
            decisionType={decisionType}
            setDecisionType={setDecisionType}
            decisionReason={decisionReason}
            setDecisionReason={setDecisionReason}
            onSubmit={handleDecisionSubmit}
            submitting={decisionSubmitting}
            locked={decisionLocked}
            caseId={caseId}
          />

          {decisionLocked && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="card-lg">
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Amend Decision
                </h3>
                <p className="text-sm text-gray-600">
                  Amending a published decision is not yet available. This capability is tracked
                  in the backend backlog and will be enabled once the endpoint ships.
                </p>
              </div>
              <ReopenRequestForm onSubmit={handleReopenRequest} submitting={reopenSubmitting} />
            </div>
          )}

          {reopenRequests.length > 0 && (
            <div className="card-lg">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Reopen Requests</h3>
              <div className="space-y-3">
                {reopenRequests.map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-navy-900">{item.reason}</p>
                      <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1">{item.justification}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {verdict ? (
            <div className="space-y-6">
              {verdict.recommendation && (
                <div className="border-l-4 border-emerald-500 pl-6 py-4">
                  <p className="text-sm text-gray-600 uppercase tracking-wide font-semibold mb-2">Recommendation</p>
                  <p className="text-xl font-bold text-navy-900 mb-2">{verdict.recommendation}</p>
                  {verdict.recommendation_reason && <p className="text-gray-700">{verdict.recommendation_reason}</p>}
                </div>
              )}

              {verdict.confidence !== undefined && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                  <p className="text-sm text-gray-600 uppercase tracking-wide font-semibold mb-2">Confidence Score</p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="w-full bg-gray-300 rounded-full h-3">
                        <div className="bg-emerald-600 h-3 rounded-full transition-all" style={{ width: `${verdict.confidence}%` }} />
                      </div>
                    </div>
                    <span className="text-3xl font-bold text-emerald-600 min-w-max">{verdict.confidence}%</span>
                  </div>
                  {verdict.confidence_reason && <p className="text-sm text-gray-700 mt-3">{verdict.confidence_reason}</p>}
                </div>
              )}

              {verdict.remedy && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Remedy / Outcome</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-gray-800 whitespace-pre-wrap">
                    {verdict.remedy}
                  </div>
                </div>
              )}

              {verdict.fairness_assessment && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Fairness Assessment</h3>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-gray-800">
                    {verdict.fairness_assessment}
                  </div>
                </div>
              )}

              {verdict.conditions && verdict.conditions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Conditions & Notes</h3>
                  <ul className="space-y-2">
                    {verdict.conditions.map((condition, idx) => (
                      <li key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-400">
                        <span className="text-blue-600 font-semibold">&bull;</span>
                        <span className="text-gray-700">{condition}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-8">No verdict available yet</p>
          )}
        </div>
      )}

      {!knowledgeBaseStatus?.initialized && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <Database className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
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
