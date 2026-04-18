import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  MessageSquare,
  Scale,
  Search,
  ShieldCheck,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAPI, useCase } from '../../hooks';
import api, { getErrorMessage } from '../../lib/api';
import { normalizeVerdict } from '../../lib/caseWorkspace';

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

const extractItems = (payload, keys = []) => {
  if (!payload) return [];

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload)) return payload;
  return [];
};

const extractEvidenceGapItems = (payload) =>
  extractItems(payload, ['gaps', 'items', 'evidence_gaps', 'missing_evidence']);

const extractDisputedFacts = (payload) =>
  extractItems(payload, ['disputed_facts', 'facts', 'items']);

const extractFairnessChecks = (payload) =>
  extractItems(payload, ['checks', 'items', 'audit_checks']);

const extractPrecedentItems = (payload) =>
  extractItems(payload, ['results', 'precedents', 'items']);

const normalizeKnowledgeBase = (payload) => {
  const root = payload?.data || payload || {};
  return {
    initialized: Boolean(root.initialized ?? root.ready ?? root.available),
    status: root.status || (root.initialized ? 'ready' : 'not_initialized'),
    documents: root.documents_count ?? root.document_count ?? root.documents ?? 0,
    chunks: root.chunks_count ?? root.chunk_count ?? null,
    lastUpdated: root.updated_at || root.last_updated_at || root.last_indexed_at || null,
  };
};

const getFairnessSummary = (payload, checks) => {
  if (!payload) return null;
  return {
    score: payload.score ?? payload.fairness_score ?? payload.overall_score ?? null,
    summary: payload.summary || payload.assessment || payload.notes || null,
    flagged: payload.flagged_issues ?? payload.issue_count ?? checks.filter((check) => !isCheckPassing(check)).length,
  };
};

const isCheckPassing = (check) => {
  const value = String(
    check?.status ?? check?.result ?? check?.outcome ?? check?.state ?? '',
  ).toLowerCase();
  return ['pass', 'passed', 'ok', 'clear', 'compliant', 'complete'].includes(value);
};

const evidenceTypeLabel = (item, idx) => item.title || item.label || item.name || `Evidence ${idx + 1}`;
const gapLabel = (item, idx) => item.title || item.label || item.category || `Gap ${idx + 1}`;
const factLabel = (fact, idx) => fact.statement || fact.text || fact.title || `Fact ${idx + 1}`;

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
        ]);

        setEvidence(evidenceRes.status === 'fulfilled' ? evidenceRes.value?.data : null);
        setEvidenceGaps(evidenceGapsRes.status === 'fulfilled' ? evidenceGapsRes.value : null);
        setTimeline(timelineRes.status === 'fulfilled' ? timelineRes.value?.data : null);
        setWitnesses(witnessesRes.status === 'fulfilled' ? witnessesRes.value?.data : null);
        setStatutes(statutesRes.status === 'fulfilled' ? statutesRes.value?.data : null);
        setArguments(argumentsRes.status === 'fulfilled' ? argumentsRes.value?.data : null);
        setDeliberation(deliberationRes.status === 'fulfilled' ? deliberationRes.value?.data : null);
        setVerdict(verdictRes.status === 'fulfilled' ? normalizeVerdict(verdictRes.value) : null);
        setFairnessAudit(fairnessRes.status === 'fulfilled' ? fairnessRes.value : null);
        setKnowledgeBaseStatus(
          kbRes.status === 'fulfilled' ? normalizeKnowledgeBase(kbRes.value) : null,
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
  const disputedFacts = useMemo(() => extractDisputedFacts(evidenceGaps), [evidenceGaps]);
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
      setEvidenceGaps((current) => {
        if (!current) return current;
        const nextFacts = extractDisputedFacts(current).map((item, itemIdx) => {
          const itemKey = item?.id || item?.fact_id || item?.uuid || itemIdx;
          if (String(itemKey) !== String(factId)) return item;
          return {
            ...item,
            status: 'disputed',
            disputed: true,
            dispute_reason: reason,
          };
        });

        if (Array.isArray(current)) return nextFacts;
        if (Array.isArray(current?.disputed_facts)) {
          return { ...current, disputed_facts: nextFacts };
        }
        if (Array.isArray(current?.facts)) {
          return { ...current, facts: nextFacts };
        }
        if (Array.isArray(current?.items)) {
          return { ...current, items: nextFacts };
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
              {knowledgeBaseStatus?.initialized ? (
                <MetaBadge tone="emerald">
                  KB ready{knowledgeBaseStatus.documents ? ` • ${knowledgeBaseStatus.documents} docs` : ''}
                </MetaBadge>
              ) : (
                <MetaBadge tone="amber">KB not initialized</MetaBadge>
              )}
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
            {knowledgeBaseStatus && (
              <p className="text-sm text-gray-600">
                Knowledge base status: {knowledgeBaseStatus.status}
                {knowledgeBaseStatus.lastUpdated && ` • Updated ${new Date(knowledgeBaseStatus.lastUpdated).toLocaleString()}`}
              </p>
            )}
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
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
              <TriangleAlert className="w-6 h-6 text-amber-600" />
              Evidence Gaps
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Missing proof, unresolved contradictions, and factual records that need judicial review.
            </p>

            {evidenceGapItems.length > 0 ? (
              <div className="space-y-3">
                {evidenceGapItems.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-navy-900">{gapLabel(item, idx)}</h3>
                        <p className="text-sm text-gray-700 mt-1">
                          {item.description || item.summary || item.reason || 'No description provided.'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.severity && <MetaBadge tone="amber">{item.severity}</MetaBadge>}
                        {item.status && <MetaBadge tone="gray">{item.status}</MetaBadge>}
                      </div>
                    </div>
                    {(item.recommended_action || item.next_step) && (
                      <p className="text-sm text-amber-900 mt-3">
                        <span className="font-semibold">Next step:</span> {item.recommended_action || item.next_step}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-6">No evidence gaps flagged yet</p>
            )}
          </div>

          <div className="card-lg">
            <h3 className="text-xl font-bold text-navy-900 mb-2">Disputed Facts</h3>
            <p className="text-sm text-gray-600 mb-6">
              Mark contested facts directly in the dossier so the backend can track judicial disputes.
            </p>

            {disputedFacts.length > 0 ? (
              <div className="space-y-4">
                {disputedFacts.map((fact, idx) => {
                  const factId = fact?.id || fact?.fact_id || fact?.uuid || idx;
                  const isDisputed = Boolean(fact?.disputed) || String(fact?.status || '').toLowerCase() === 'disputed';
                  return (
                    <div key={factId} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold text-navy-900">{factLabel(fact, idx)}</p>
                          {fact.source && <p className="text-xs text-gray-500 mt-1">Source: {fact.source}</p>}
                        </div>
                        {isDisputed ? <MetaBadge tone="rose">Disputed</MetaBadge> : <MetaBadge tone="blue">Open fact</MetaBadge>}
                      </div>

                      {(fact.explanation || fact.notes) && (
                        <p className="text-sm text-gray-700 mb-3">{fact.explanation || fact.notes}</p>
                      )}

                      <textarea
                        value={disputeReason[factId] ?? fact.dispute_reason ?? ''}
                        onChange={(event) =>
                          setDisputeReason((prev) => ({ ...prev, [factId]: event.target.value }))
                        }
                        disabled={isDisputed}
                        placeholder="State why this fact is contested"
                        className="input-field min-h-24"
                      />

                      <div className="mt-3 flex items-center justify-between gap-4">
                        <p className="text-xs text-gray-500">
                          This sends a dispute marker to the case record for downstream review.
                        </p>
                        <button
                          onClick={() => handleDisputeFact(fact, idx)}
                          disabled={isDisputed || disputeSubmitting[factId]}
                          className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
                        >
                          {disputeSubmitting[factId] ? 'Submitting...' : isDisputed ? 'Marked disputed' : 'Dispute fact'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-6">No disputed facts were returned for this case</p>
            )}
          </div>
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
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
              <FileSearch className="w-6 h-6 text-cyan-600" />
              Live Precedent Search
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Search precedents directly from the dossier to validate the current legal theory before issuing a decision.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_auto] gap-3">
              <input
                value={precedentQuery}
                onChange={(event) => setPrecedentQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handlePrecedentSearch()}
                placeholder="Search by issue, statute, holding, or legal principle"
                className="input-field"
              />
              <input
                value={precedentDomain}
                onChange={(event) => setPrecedentDomain(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && handlePrecedentSearch()}
                placeholder="Domain or court"
                className="input-field"
              />
              <button
                onClick={handlePrecedentSearch}
                disabled={searchingPrecedents}
                className="px-4 py-2.5 rounded-lg bg-cyan-600 text-white font-semibold hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4" />
                {searchingPrecedents ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          <div className="card-lg">
            {precedentResults.length > 0 ? (
              <div className="space-y-4">
                {precedentResults.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-navy-900">
                          {item.title || item.case_name || item.name || `Precedent ${idx + 1}`}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {[item.citation, item.court, item.jurisdiction].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(item.score || item.relevance) && (
                          <MetaBadge tone="blue">
                            Match {Math.round((item.score ?? item.relevance) * ((item.score ?? item.relevance) <= 1 ? 100 : 1))}%
                          </MetaBadge>
                        )}
                        {item.source && <MetaBadge tone="gray">{item.source}</MetaBadge>}
                      </div>
                    </div>

                    {(item.summary || item.holding || item.snippet || item.text) && (
                      <p className="text-sm text-gray-700 mt-3">
                        {item.summary || item.holding || item.snippet || item.text}
                      </p>
                    )}

                    {(item.url || item.link) && (
                      <a
                        href={item.url || item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-800 mt-3"
                      >
                        Open source
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : precedentSearched ? (
              <p className="text-gray-600 text-center py-8">No precedent matches returned for this search</p>
            ) : (
              <p className="text-gray-600 text-center py-8">Run a search to load precedent matches</p>
            )}
          </div>
        </div>
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
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-violet-600" />
              Fairness Audit Checklist
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Review parity, procedural fairness, and any automated concerns before the final judicial action.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 mb-2">Score</p>
                <p className="text-3xl font-bold text-violet-900">
                  {fairnessSummary?.score ?? '--'}
                  {fairnessSummary?.score !== null && fairnessSummary?.score !== undefined ? '%' : ''}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">Checks</p>
                <p className="text-3xl font-bold text-navy-900">{fairnessChecks.length}</p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 mb-2">Flagged</p>
                <p className="text-3xl font-bold text-rose-900">{fairnessSummary?.flagged ?? 0}</p>
              </div>
            </div>

            {fairnessSummary?.summary && (
              <div className="mt-4 rounded-lg border border-violet-200 bg-violet-50/50 p-4 text-sm text-gray-700">
                {fairnessSummary.summary}
              </div>
            )}
          </div>

          <div className="card-lg">
            {fairnessChecks.length > 0 ? (
              <div className="space-y-3">
                {fairnessChecks.map((check, idx) => {
                  const passing = isCheckPassing(check);
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border p-4 ${passing ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-navy-900">
                            {check.title || check.label || check.category || `Check ${idx + 1}`}
                          </h3>
                          <p className="text-sm text-gray-700 mt-1">
                            {check.description || check.summary || check.note || 'No additional context provided.'}
                          </p>
                        </div>
                        <MetaBadge tone={passing ? 'emerald' : 'amber'}>
                          {check.status || check.result || check.outcome || (passing ? 'pass' : 'review')}
                        </MetaBadge>
                      </div>

                      {(check.recommendation || check.mitigation || check.action) && (
                        <p className="text-sm mt-3 text-gray-700">
                          <span className="font-semibold">Action:</span> {check.recommendation || check.mitigation || check.action}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-8">No fairness checklist data available yet</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'verdict' && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            Verdict & Recommendation
          </h2>

          {verdict ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-gray-200 p-5 bg-gray-50">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-navy-900">Judge Decision</h3>
                    <p className="text-sm text-gray-600">
                      Record the final judicial action for this case workspace.
                    </p>
                  </div>
                  {decisionLocked && (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-semibold">
                      Decision recorded
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {[
                    { value: 'accept', label: 'Accept', activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
                    { value: 'modify', label: 'Modify', activeClass: 'border-amber-400 bg-amber-50 text-amber-700' },
                    { value: 'reject', label: 'Reject', activeClass: 'border-rose-400 bg-rose-50 text-rose-700' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setDecisionType(option.value)}
                      disabled={decisionLocked}
                      className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                        decisionType === option.value
                          ? option.activeClass
                          : 'border-gray-200 bg-white text-gray-700'
                      } disabled:opacity-60`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-navy-900">
                    Reason {decisionType === 'modify' || decisionType === 'reject' ? '(required)' : '(optional)'}
                  </label>
                  <textarea
                    value={decisionReason}
                    onChange={(event) => setDecisionReason(event.target.value)}
                    disabled={decisionLocked}
                    placeholder={
                      decisionType === 'accept'
                        ? 'Optional note for accepting the recommendation'
                        : `Explain why this case should be ${decisionType}ed`
                    }
                    className="input-field min-h-28"
                  />
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <p className="text-xs text-gray-500">
                    Once recorded, the decision form becomes read-only in this workspace.
                  </p>
                  <button
                    onClick={handleDecisionSubmit}
                    disabled={
                      decisionLocked ||
                      decisionSubmitting ||
                      ((decisionType === 'modify' || decisionType === 'reject') && !decisionReason.trim())
                    }
                    className="px-5 py-2.5 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 disabled:opacity-50"
                  >
                    {decisionSubmitting ? 'Recording...' : 'Record Decision'}
                  </button>
                </div>
              </div>

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
                        <span className="text-blue-600 font-semibold">•</span>
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
