import { describe, expect, it } from 'vitest';
import {
  extractItems,
  normalizeArgumentsResource,
  normalizeCaseDetail,
  normalizeCaseSummary,
  normalizeHearingAnalysis,
  normalizeEvidenceResource,
  normalizeKnowledgeBaseStatus,
  normalizeStatutesResource,
  normalizeTimelineResource,
  normalizeWitnessResource,
} from '../lib/caseWorkspace';

describe('caseWorkspace normalizers', () => {
  it('normalizes story-aligned case summaries and detail payloads', () => {
    const payload = {
      id: 'case-1',
      title: 'Defective furniture claim',
      description: 'Claimant seeks damages for defective dining table.',
      domain: 'small_claims',
      status: 'ready_for_review',
      status_group: 'completed',
      filed_date: '2026-04-20',
      claimant_name: 'Lim',
      respondent_name: 'FurniturePlus',
      pipeline_progress: { pipeline_progress_percent: 78, current_agent: 'deliberation' },
      documents: [{ id: 'doc-1', filename: 'invoice.pdf' }],
    };

    const summary = normalizeCaseSummary(payload);
    const detail = normalizeCaseDetail(payload, 'case-1');

    expect(summary.case_id).toBe('case-1');
    expect(summary.status).toBe('completed');
    expect(summary.party_1).toBe('Lim');
    expect(summary.pipeline_progress).toBe(78);
    expect(detail.documents).toHaveLength(1);
  });

  it('normalizes evidence, facts, witnesses, statutes, and precedent arrays from raw backend payloads', () => {
    expect(
      normalizeEvidenceResource([
        {
          id: 'e-1',
          evidence_type: 'documentary',
          strength: 'weak',
          admissibility_flags: { hearsay: true },
        },
      ]).items[0],
    ).toMatchObject({
      id: 'e-1',
      type: 'documentary',
      strength: 'weak',
    });

    expect(
      normalizeTimelineResource([
        {
          id: 'f-1',
          description: 'Goods delivered.',
          event_date: '2026-01-12',
          status: 'disputed',
        },
      ]).events[0],
    ).toMatchObject({
      id: 'f-1',
      title: 'Goods delivered.',
      status: 'disputed',
    });

    expect(
      normalizeWitnessResource([
        {
          id: 'w-1',
          name: 'Tan',
          role: 'Independent witness',
          credibility_score: 72,
        },
      ]).items[0],
    ).toMatchObject({
      id: 'w-1',
      credibility: 72,
    });

    expect(
      normalizeStatutesResource([
        {
          id: 's-1',
          statute_name: 'Small Claims Tribunals Act',
          section: 's 5',
          application: 'Sets the jurisdiction threshold for the claim.',
          relevance_score: 0.82,
        },
      ]).items[0],
    ).toMatchObject({
      id: 's-1',
      title: 'Small Claims Tribunals Act',
      code: 's 5',
      relevance: '82%',
    });

    expect(
      extractItems({
        precedents: [
          {
            id: 'p-1',
            citation: 'ABC v XYZ [2024] SGDC 10',
          },
        ],
      }, ['precedents'])[0],
    ).toMatchObject({
      id: 'p-1',
      citation: 'ABC v XYZ [2024] SGDC 10',
    });
  });

  it('groups arguments and deliberation data into dossier-ready shapes', () => {
    const argumentsPayload = [
      {
        id: 'a-1',
        side: 'claimant',
        legal_basis: 'Goods were not of satisfactory quality.',
        weaknesses: 'Inspection occurred two weeks later.',
      },
      {
        id: 'a-2',
        side: 'respondent',
        legal_basis: 'Buyer accepted the goods.',
      },
    ];

    const groupedArguments = normalizeArgumentsResource(argumentsPayload);
    expect(groupedArguments.claimant.arguments).toHaveLength(1);
    expect(groupedArguments.respondent.arguments).toHaveLength(1);

    const hearingAnalysis = normalizeHearingAnalysis([
      {
        id: 'd-1',
        reasoning_chain: { key_points: ['Latent defect remains the pivot issue.'] },
        uncertainty_flags: ['Whether the defect was patent.'],
        preliminary_conclusion: 'Claim likely succeeds.',
      },
    ]);

    expect(hearingAnalysis.key_points[0]).toContain('Latent defect');
    expect(hearingAnalysis.risks[0]).toContain('patent');
  });

  it('normalizes knowledge-base status payloads', () => {
    const kbStatus = normalizeKnowledgeBaseStatus({
      initialized: true,
      documents_count: 342,
      vector_store: { status: 'healthy' },
      pair_api: { state: 'closed' },
    });

    expect(kbStatus.initialized).toBe(true);
    expect(kbStatus.documents_count).toBe(342);
    expect(kbStatus.status).toBe('healthy');
  });
});
