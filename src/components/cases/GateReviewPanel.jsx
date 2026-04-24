import { createElement, useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  FileText,
  Users,
  Scale,
  BookOpen,
  Brain,
  Shield,
  Loader2,
} from 'lucide-react';
import api, { getErrorMessage } from '../../lib/api';
import AgentRerunDialog from './AgentRerunDialog';
import {
  normalizeEvidenceResource,
  normalizeTimelineResource,
  normalizeWitnessResource,
  normalizeStatutesResource,
  normalizeArgumentsResource,
  normalizeHearingAnalysis,
} from '../../lib/caseWorkspace';

const GATE_AGENTS = {
  gate1: ['case-processing', 'complexity-routing'],
  gate2: ['evidence-analysis', 'fact-reconstruction', 'witness-analysis', 'legal-knowledge'],
  gate3: ['argument-construction', 'hearing-analysis'],
  gate4: ['hearing-governance'],
};

const GATE_LABELS = {
  gate1: 'Gate 1 — Intake Review',
  gate2: 'Gate 2 — Dossier Review',
  gate3: 'Gate 3 — Arguments Review',
  gate4: 'Gate 4 — Verdict Review',
};

const GATE_DESCRIPTIONS = {
  gate1: 'Review jurisdiction assessment and complexity routing before proceeding to full analysis.',
  gate2: 'Review the evidence analysis, facts, witnesses, and legal knowledge before argument construction.',
  gate3: 'Review argument construction and hearing analysis before final verdict preparation.',
  gate4: 'Review the hearing governance output and record your judicial decision.',
};

// ── tiny display helpers ────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      {createElement(Icon, { className: 'w-4 h-4 text-teal-600' })}
      <span className="font-semibold text-sm text-gray-800">{label}</span>
      {count != null && (
        <span className="ml-auto text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="text-xs text-gray-400 italic py-1">{text}</p>;
}

function StrengthBadge({ value }) {
  if (value == null) return null;
  const pct = typeof value === 'number' ? value : parseFloat(value);
  if (!Number.isFinite(pct)) return null;
  const color =
    pct >= 70 ? 'bg-emerald-100 text-emerald-700' :
    pct >= 40 ? 'bg-amber-100 text-amber-700' :
    'bg-rose-100 text-rose-700';
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${color}`}>
      {Math.round(pct)}%
    </span>
  );
}

// ── Gate 1 — case detail summary ───────────────────────────────────────────
function Gate1Data({ caseDetail }) {
  if (!caseDetail) return <EmptyState text="No case detail available yet." />;
  const domain = caseDetail.domain || caseDetail.case_metadata?.domain || null;
  const rawJurisdiction =
    caseDetail.jurisdiction || caseDetail.case_metadata?.jurisdiction || null;
  const jurisdictionIsObject =
    rawJurisdiction && typeof rawJurisdiction === 'object' && !Array.isArray(rawJurisdiction);
  const jurisdictionLabel = jurisdictionIsObject
    ? rawJurisdiction.status || (rawJurisdiction.valid === true ? 'pass' : rawJurisdiction.valid === false ? 'fail' : 'pending')
    : rawJurisdiction;
  const jurisdictionReasons = jurisdictionIsObject && Array.isArray(rawJurisdiction.reasons)
    ? rawJurisdiction.reasons.filter((r) => typeof r === 'string' && r.trim())
    : [];
  const complexity = caseDetail.complexity || caseDetail.case_metadata?.complexity || null;
  const parties = caseDetail.parties || caseDetail.party_names || [];

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        {domain && (
          <div className="bg-white rounded-lg p-3 border border-teal-100">
            <p className="text-xs text-gray-400 mb-0.5">Domain</p>
            <p className="font-semibold text-gray-800 capitalize">{domain}</p>
          </div>
        )}
        {jurisdictionLabel && (
          <div className="bg-white rounded-lg p-3 border border-teal-100">
            <p className="text-xs text-gray-400 mb-0.5">Jurisdiction</p>
            <p className="font-semibold text-gray-800 capitalize">{jurisdictionLabel}</p>
          </div>
        )}
        {complexity && (
          <div className="bg-white rounded-lg p-3 border border-teal-100">
            <p className="text-xs text-gray-400 mb-0.5">Complexity</p>
            <p className="font-semibold text-gray-800 capitalize">{complexity}</p>
          </div>
        )}
      </div>
      {jurisdictionReasons.length > 0 && (
        <div className="bg-white rounded-lg p-3 border border-teal-100">
          <p className="text-xs text-gray-400 mb-1">Jurisdiction reasons</p>
          <ul className="list-disc pl-5 space-y-0.5 text-gray-700">
            {jurisdictionReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      {parties.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Parties</p>
          <div className="flex flex-wrap gap-1.5">
            {parties.map((p, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs bg-white border border-teal-200 text-gray-700 rounded-full"
              >
                {typeof p === 'string' ? p : p.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {caseDetail.description && (
        <div className="bg-white rounded-lg p-3 border border-teal-100">
          <p className="text-xs text-gray-400 mb-1">Case summary</p>
          <p className="text-gray-700 text-sm leading-relaxed line-clamp-4">
            {caseDetail.description}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Gate 2 — evidence, facts, witnesses, statutes ─────────────────────────
function Gate2Data({ evidence, timeline, witnesses, statutes }) {
  const evItems = evidence?.items || [];
  const facts = timeline?.events || [];
  const wits = witnesses?.items || [];
  const laws = statutes?.items || [];

  return (
    <div className="space-y-4 text-sm">
      <div>
        <SectionHeader icon={FileText} label="Evidence" count={evItems.length} />
        {evItems.length === 0 ? (
          <EmptyState text="No evidence items processed yet." />
        ) : (
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {evItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-2 bg-white rounded-lg p-2 border border-gray-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{item.description}</p>
                  )}
                </div>
                <StrengthBadge value={item.strength} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader icon={BookOpen} label="Reconstructed Facts" count={facts.length} />
        {facts.length === 0 ? (
          <EmptyState text="No facts reconstructed yet." />
        ) : (
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {facts.map((fact) => (
              <div
                key={fact.id}
                className="flex items-start gap-2 py-1.5 border-b border-gray-100 last:border-0"
              >
                {fact.date && (
                  <span className="text-xs text-gray-400 whitespace-nowrap pt-0.5">{fact.date}</span>
                )}
                <p className="text-gray-700 text-xs leading-relaxed flex-1">{fact.title}</p>
                {fact.confidence != null && (
                  <StrengthBadge
                    value={
                      typeof fact.confidence === 'number' && fact.confidence <= 1
                        ? fact.confidence * 100
                        : fact.confidence
                    }
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader icon={Users} label="Witnesses" count={wits.length} />
        {wits.length === 0 ? (
          <EmptyState text="No witnesses analysed yet." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {wits.map((w) => (
              <div key={w.id} className="bg-white rounded-lg p-2 border border-gray-100 w-40 shrink-0">
                <p className="font-medium text-gray-800 text-xs truncate">{w.name}</p>
                <p className="text-gray-400 text-[11px] truncate">{w.role}</p>
                {w.credibility != null && (
                  <div className="mt-1">
                    <StrengthBadge
                      value={
                        typeof w.credibility === 'number' && w.credibility <= 1
                          ? w.credibility * 100
                          : w.credibility
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeader icon={Scale} label="Applicable Statutes" count={laws.length} />
        {laws.length === 0 ? (
          <EmptyState text="No statutes identified yet." />
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {laws.map((law) => (
              <div key={law.id} className="bg-white rounded-lg p-2 border border-gray-100">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-800 text-xs flex-1 truncate">{law.title}</p>
                  {law.relevance && (
                    <span className="text-[11px] text-gray-400">{law.relevance}</span>
                  )}
                </div>
                {law.summary && (
                  <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{law.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Gate 3 — arguments + hearing analysis ─────────────────────────────────
function Gate3Data({ arguments_, hearingAnalysis }) {
  const claimant = arguments_?.claimant?.arguments || [];
  const respondent = arguments_?.respondent?.arguments || [];

  return (
    <div className="space-y-4 text-sm">
      <div>
        <SectionHeader
          icon={Scale}
          label="Arguments"
          count={claimant.length + respondent.length}
        />
        {claimant.length === 0 && respondent.length === 0 ? (
          <EmptyState text="No arguments constructed yet." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {claimant.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-1">Claimant</p>
                <div className="space-y-1.5">
                  {claimant.map((arg) => (
                    <div key={arg.id} className="bg-white rounded-lg p-2 border border-blue-100">
                      <p className="text-xs text-gray-700 line-clamp-3">{arg.text}</p>
                      <StrengthBadge value={arg.strength} />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {respondent.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-rose-600 mb-1">Respondent</p>
                <div className="space-y-1.5">
                  {respondent.map((arg) => (
                    <div key={arg.id} className="bg-white rounded-lg p-2 border border-rose-100">
                      <p className="text-xs text-gray-700 line-clamp-3">{arg.text}</p>
                      <StrengthBadge value={arg.strength} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {hearingAnalysis && (
        <div>
          <SectionHeader icon={Brain} label="Hearing Analysis" />
          <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-2">
            {hearingAnalysis.preliminary_conclusion && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Preliminary conclusion</p>
                <p className="text-gray-700 text-xs leading-relaxed">
                  {hearingAnalysis.preliminary_conclusion}
                </p>
              </div>
            )}
            {hearingAnalysis.key_points?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Key points</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {hearingAnalysis.key_points.slice(0, 5).map((pt, i) => (
                    <li key={i} className="text-xs text-gray-700">{pt}</li>
                  ))}
                </ul>
              </div>
            )}
            {hearingAnalysis.confidence_score != null && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">Confidence</p>
                <StrengthBadge
                  value={
                    typeof hearingAnalysis.confidence_score === 'number' &&
                    hearingAnalysis.confidence_score <= 1
                      ? hearingAnalysis.confidence_score * 100
                      : hearingAnalysis.confidence_score
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Gate 4 — fairness audit + hearing governance ───────────────────────────
function Gate4Data({ fairnessAudit, hearingAnalysis }) {
  const root = fairnessAudit?.data || fairnessAudit || {};
  const checks = Array.isArray(root.checks)
    ? root.checks
    : Array.isArray(root.fairness_checks)
    ? root.fairness_checks
    : [];
  const score = root.overall_score ?? root.score ?? null;
  const verdict = root.verdict || root.recommendation || null;

  return (
    <div className="space-y-4 text-sm">
      <div>
        <SectionHeader icon={Shield} label="Fairness Audit" />
        {!fairnessAudit ? (
          <EmptyState text="Fairness audit not available yet." />
        ) : (
          <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-2">
            {score != null && (
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-400">Overall score</p>
                <StrengthBadge
                  value={
                    typeof score === 'number' && score <= 1 ? score * 100 : score
                  }
                />
              </div>
            )}
            {verdict && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Recommendation</p>
                <p className="text-gray-700 text-xs leading-relaxed">{verdict}</p>
              </div>
            )}
            {checks.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Fairness checks</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {checks.map((chk, i) => {
                    const passed = chk.passed ?? (chk.result === 'pass');
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-bold mt-0.5 ${
                            passed
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {passed ? 'PASS' : 'FAIL'}
                        </span>
                        <p className="text-xs text-gray-700">
                          {chk.label || chk.name || chk.check || chk.description || JSON.stringify(chk)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {hearingAnalysis && (
        <div>
          <SectionHeader icon={Brain} label="Hearing Governance" />
          <div className="bg-white rounded-lg p-3 border border-gray-100 space-y-2">
            {hearingAnalysis.preliminary_conclusion && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Preliminary conclusion</p>
                <p className="text-gray-700 text-xs leading-relaxed">
                  {hearingAnalysis.preliminary_conclusion}
                </p>
              </div>
            )}
            {hearingAnalysis.risks?.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Risk flags</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {hearingAnalysis.risks.slice(0, 5).map((r, i) => (
                    <li key={i} className="text-xs text-amber-700">{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function GateReviewPanel({ caseId, gateName, onAdvanced }) {
  const [advancing, setAdvancing] = useState(false);
  const [showRerun, setShowRerun] = useState(false);
  const [advanceError, setAdvanceError] = useState(null);

  // per-gate data
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [witnesses, setWitnesses] = useState(null);
  const [statutes, setStatutes] = useState(null);
  const [arguments_, setArguments] = useState(null);
  const [hearingAnalysis, setHearingAnalysis] = useState(null);
  const [fairnessAudit, setFairnessAudit] = useState(null);

  const fetchData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);
    try {
      if (gateName === 'gate1') {
        const res = await api.getCaseDetail(caseId);
        setCaseDetail(res);
      } else if (gateName === 'gate2') {
        const [ev, tl, wi, st] = await Promise.allSettled([
          api.getEvidence(caseId),
          api.getTimeline(caseId),
          api.getWitnesses(caseId),
          api.getStatutes(caseId),
        ]);
        if (ev.status === 'fulfilled') setEvidence(normalizeEvidenceResource(ev.value));
        if (tl.status === 'fulfilled') setTimeline(normalizeTimelineResource(tl.value));
        if (wi.status === 'fulfilled') setWitnesses(normalizeWitnessResource(wi.value));
        if (st.status === 'fulfilled') setStatutes(normalizeStatutesResource(st.value));
      } else if (gateName === 'gate3') {
        const [ar, ha] = await Promise.allSettled([
          api.getArguments(caseId),
          api.getHearingAnalysis(caseId),
        ]);
        if (ar.status === 'fulfilled') setArguments(normalizeArgumentsResource(ar.value));
        if (ha.status === 'fulfilled') setHearingAnalysis(normalizeHearingAnalysis(ha.value));
      } else if (gateName === 'gate4') {
        const [fa, ha] = await Promise.allSettled([
          api.getFairnessAudit(caseId),
          api.getHearingAnalysis(caseId),
        ]);
        if (fa.status === 'fulfilled') setFairnessAudit(fa.value);
        if (ha.status === 'fulfilled') setHearingAnalysis(normalizeHearingAnalysis(ha.value));
      }
    } catch (err) {
      setDataError(getErrorMessage(err, 'Failed to load gate review data'));
    } finally {
      setDataLoading(false);
    }
  }, [caseId, gateName]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAdvance() {
    setAdvancing(true);
    setAdvanceError(null);
    try {
      await api.advanceGate(caseId, gateName);
      onAdvanced();
    } catch (err) {
      setAdvanceError(getErrorMessage(err));
    } finally {
      setAdvancing(false);
    }
  }

  return (
    <div className="card-lg border-2 border-teal-400 bg-teal-50">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-5 h-5 text-teal-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-teal-700">
              Gate Ready for Review
            </span>
          </div>
          <h2 className="text-xl font-bold text-navy-900">{GATE_LABELS[gateName]}</h2>
          <p className="text-sm text-gray-600 mt-1">{GATE_DESCRIPTIONS[gateName]}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={fetchData}
            disabled={dataLoading}
            className="btn-secondary flex items-center gap-2"
            title="Refresh gate data"
          >
            <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setShowRerun(true)} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Re-run Agent
          </button>
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className="btn-primary flex items-center gap-2"
          >
            {advancing ? (
              <div className="spinner-white w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {gateName === 'gate4' ? 'Proceed to Decision' : 'Approve & Advance'}
          </button>
        </div>
      </div>

      {advanceError && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
          {advanceError}
        </div>
      )}

      {/* Agent chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(GATE_AGENTS[gateName] || []).map((agent) => (
          <span
            key={agent}
            className="px-2 py-0.5 text-xs bg-white border border-teal-300 text-teal-800 rounded-full"
          >
            {agent}
          </span>
        ))}
      </div>

      {/* Data pane */}
      <div className="border-t border-teal-200 pt-4">
        {dataLoading ? (
          <div className="flex items-center gap-2 text-sm text-teal-600 py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading agent output…
          </div>
        ) : dataError ? (
          <div className="flex items-center gap-2 text-sm text-rose-600 py-2">
            <AlertTriangle className="w-4 h-4" />
            {dataError}
          </div>
        ) : (
          <>
            {gateName === 'gate1' && <Gate1Data caseDetail={caseDetail} />}
            {gateName === 'gate2' && (
              <Gate2Data
                evidence={evidence}
                timeline={timeline}
                witnesses={witnesses}
                statutes={statutes}
              />
            )}
            {gateName === 'gate3' && (
              <Gate3Data arguments_={arguments_} hearingAnalysis={hearingAnalysis} />
            )}
            {gateName === 'gate4' && (
              <Gate4Data fairnessAudit={fairnessAudit} hearingAnalysis={hearingAnalysis} />
            )}
          </>
        )}
      </div>

      {showRerun && (
        <AgentRerunDialog
          caseId={caseId}
          gateName={gateName}
          agents={GATE_AGENTS[gateName] || []}
          onClose={() => setShowRerun(false)}
          onRerun={() => {
            setShowRerun(false);
            onAdvanced();
          }}
        />
      )}
    </div>
  );
}
