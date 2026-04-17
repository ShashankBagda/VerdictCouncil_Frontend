import React, { useState, useEffect } from 'react';
import {
  FileText,
  Clock,
  Users,
  BookOpen,
  MessageSquare,
  Scale,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAPI } from '../../hooks';
import { useCase } from '../../hooks';
import api from '../../lib/api';

const TABS = [
  { id: 'evidence', label: 'Evidence', icon: FileText, color: 'blue' },
  { id: 'timeline', label: 'Timeline', icon: Clock, color: 'purple' },
  { id: 'witnesses', label: 'Witnesses', icon: Users, color: 'green' },
  { id: 'law', label: 'Law & Statutes', icon: BookOpen, color: 'amber' },
  { id: 'arguments', label: 'Arguments', icon: MessageSquare, color: 'rose' },
  { id: 'deliberation', label: 'Deliberation', icon: Scale, color: 'cyan' },
  { id: 'verdict', label: 'Verdict', icon: CheckCircle, color: 'emerald' },
];

export default function CaseDossier() {
  const { caseId } = useParams();
  const { showError } = useAPI();
  const { activeTab, setActiveTab } = useCase();

  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState({});
  
  // Tab data
  const [evidence, setEvidence] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [witnesses, setWitnesses] = useState(null);
  const [statutes, setStatutes] = useState(null);
  const [arguments_, setArguments] = useState(null);
  const [deliberation, setDeliberation] = useState(null);
  const [verdict, setVerdict] = useState(null);

  // Fetch all analysis data on mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        
        const [
          evidenceRes,
          timelineRes,
          witnessesRes,
          statutesRes,
          argumentsRes,
          deliberationRes,
          verdictRes,
        ] = await Promise.allSettled([
          api.getEvidence(caseId),
          api.getTimeline(caseId),
          api.getWitnesses(caseId),
          api.getStatutes(caseId),
          api.getArguments(caseId),
          api.getDeliberation(caseId),
          api.getVerdict(caseId),
        ]);

        setEvidence(evidenceRes.status === 'fulfilled' ? evidenceRes.value.data : null);
        setTimeline(timelineRes.status === 'fulfilled' ? timelineRes.value.data : null);
        setWitnesses(witnessesRes.status === 'fulfilled' ? witnessesRes.value.data : null);
        setStatutes(statutesRes.status === 'fulfilled' ? statutesRes.value.data : null);
        setArguments(argumentsRes.status === 'fulfilled' ? argumentsRes.value.data : null);
        setDeliberation(deliberationRes.status === 'fulfilled' ? deliberationRes.value.data : null);
        setVerdict(verdictRes.status === 'fulfilled' ? verdictRes.value.data : null);
      } catch (err) {
        const msg = err.message || 'Failed to fetch case analysis';
        showError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [caseId, showError]);

  const toggleExpanded = (id) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const handleExport = () => {
    const dossier = {
      case_id: caseId,
      exported_at: new Date().toISOString(),
      evidence: evidence || null,
      timeline: timeline || null,
      witnesses: witnesses || null,
      statutes: statutes || null,
      arguments: arguments_ || null,
      deliberation: deliberation || null,
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

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="card-lg">
        <div className="flex items-center justify-between mb-2">
          <div />
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
                  isActive
                    ? `bg-${tab.color}-100 text-${tab.color}-700 border-2 border-${tab.color}-300`
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Evidence Tab */}
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
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpanded(`ev-${idx}`)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-navy-900">
                          {item.title || `Evidence ${idx + 1}`}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {item.description || ''}
                        </p>
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
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${item.relevance}%` }}
                              />
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

      {/* Timeline Tab */}
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
                    {idx < timeline.events.length - 1 && (
                      <div className="w-0.5 h-16 bg-gray-200 mt-2" />
                    )}
                  </div>
                  <div className="pb-8 flex-1">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-purple-700 mb-1">
                        {event.date || 'Date not available'}
                      </p>
                      <h3 className="font-semibold text-navy-900 mb-2">
                        {event.title || `Event ${idx + 1}`}
                      </h3>
                      <p className="text-sm text-gray-700">
                        {event.description || ''}
                      </p>
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

      {/* Witnesses Tab */}
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
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpanded(`wit-${idx}`)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-navy-900">
                          {witness.name || `Witness ${idx + 1}`}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {witness.role || 'Role not specified'}
                        </p>
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
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {witness.statement}
                            </p>
                          </div>
                        )}
                        {witness.credibility && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-2">Credibility Assessment</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ width: `${witness.credibility}%` }}
                                />
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

      {/* Law & Statutes Tab */}
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
                  <div
                    key={idx}
                    className="border border-gray-200 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpanded(`law-${idx}`)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-navy-900">
                          {statute.title || statute.code || `Statute ${idx + 1}`}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {statute.code && `Code: ${statute.code}`}
                        </p>
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
                            <p className="text-gray-700">
                              {statute.summary}
                            </p>
                          </div>
                        )}
                        {statute.relevance && (
                          <div>
                            <p className="font-semibold text-gray-700 mb-1">Relevance</p>
                            <p className="text-gray-700">
                              {statute.relevance}
                            </p>
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

      {/* Arguments Tab */}
      {activeTab === 'arguments' && (
        <div className="space-y-4">
          <div className="card-lg">
            <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              Arguments
            </h2>

            {arguments_ ? (
              <div className="space-y-6">
                {/* Claimant Arguments */}
                {arguments_.claimant && (
                  <div className="border-l-4 border-rose-500 pl-4">
                    <h3 className="text-lg font-bold text-navy-900 mb-4">
                      Claimant / Prosecution
                    </h3>
                    <div className="space-y-3">
                      {arguments_.claimant.arguments?.map((arg, idx) => (
                        <div
                          key={idx}
                          className="bg-rose-50 border border-rose-200 rounded-lg p-4"
                        >
                          <p className="font-semibold text-navy-900 mb-2">
                            {arg.title || `Argument ${idx + 1}`}
                          </p>
                          <p className="text-sm text-gray-700 mb-3">
                            {arg.text}
                          </p>
                          {arg.strength && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-gray-600">Strength:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-rose-500 h-2 rounded-full"
                                  style={{ width: `${arg.strength}%` }}
                                />
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

                {/* Respondent Arguments */}
                {arguments_.respondent && (
                  <div className="border-l-4 border-emerald-500 pl-4">
                    <h3 className="text-lg font-bold text-navy-900 mb-4">
                      Respondent / Defense
                    </h3>
                    <div className="space-y-3">
                      {arguments_.respondent.arguments?.map((arg, idx) => (
                        <div
                          key={idx}
                          className="bg-emerald-50 border border-emerald-200 rounded-lg p-4"
                        >
                          <p className="font-semibold text-navy-900 mb-2">
                            {arg.title || `Argument ${idx + 1}`}
                          </p>
                          <p className="text-sm text-gray-700 mb-3">
                            {arg.text}
                          </p>
                          {arg.strength && (
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-gray-600">Strength:</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-emerald-500 h-2 rounded-full"
                                  style={{ width: `${arg.strength}%` }}
                                />
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

      {/* Deliberation Tab */}
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
                      <li
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="text-cyan-600 font-bold text-lg mt-0.5">
                          {idx + 1}.
                        </span>
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
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                      >
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

      {/* Verdict Tab */}
      {activeTab === 'verdict' && (
        <div className="card-lg">
          <h2 className="text-2xl font-bold text-navy-900 mb-6 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
            Verdict & Recommendation
          </h2>

          {verdict ? (
            <div className="space-y-6">
              {/* Recommendation */}
              {verdict.recommendation && (
                <div className="border-l-4 border-emerald-500 pl-6 py-4">
                  <p className="text-sm text-gray-600 uppercase tracking-wide font-semibold mb-2">
                    Recommendation
                  </p>
                  <p className="text-xl font-bold text-navy-900 mb-2">
                    {verdict.recommendation}
                  </p>
                  {verdict.recommendation_reason && (
                    <p className="text-gray-700">
                      {verdict.recommendation_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Confidence Score */}
              {verdict.confidence !== undefined && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                  <p className="text-sm text-gray-600 uppercase tracking-wide font-semibold mb-2">
                    Confidence Score
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="w-full bg-gray-300 rounded-full h-3">
                        <div
                          className="bg-emerald-600 h-3 rounded-full transition-all"
                          style={{ width: `${verdict.confidence}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-3xl font-bold text-emerald-600 min-w-max">
                      {verdict.confidence}%
                    </span>
                  </div>
                  {verdict.confidence_reason && (
                    <p className="text-sm text-gray-700 mt-3">
                      {verdict.confidence_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Remedy/Outcome */}
              {verdict.remedy && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Remedy / Outcome</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-gray-800 whitespace-pre-wrap">
                    {verdict.remedy}
                  </div>
                </div>
              )}

              {/* Fairness Assessment */}
              {verdict.fairness_assessment && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Fairness Assessment</h3>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-gray-800">
                    {verdict.fairness_assessment}
                  </div>
                </div>
              )}

              {/* Conditions */}
              {verdict.conditions && verdict.conditions.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-navy-900 mb-3">Conditions & Notes</h3>
                  <ul className="space-y-2">
                    {verdict.conditions.map((condition, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border-l-4 border-blue-400"
                      >
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
    </div>
  );
}
