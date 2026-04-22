import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  normalizeCaseDetail,
  normalizeKnowledgeBaseStatus,
} from '../lib/caseWorkspace';
import { normalizeWorkflowItem } from '../lib/escalationWorkflow';

const testDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(testDir, '..', '..');
const backendOpenApiPath = resolve(frontendRoot, '../VerdictCouncil_Backend/docs/openapi.json');
const openApi = JSON.parse(readFileSync(backendOpenApiPath, 'utf-8'));

const getSchema = (name) => {
  const schema = openApi?.components?.schemas?.[name];
  expect(schema).toBeTruthy();
  return schema;
};

const expectProperties = (schemaName, expectedFields) => {
  const schema = getSchema(schemaName);
  const properties = Object.keys(schema.properties || {});
  expect(properties).toEqual(expect.arrayContaining(expectedFields));
};

describe('backend OpenAPI schema contract', () => {
  it('declares the story-aligned case summary and detail fields used in the dossier', () => {
    expectProperties('CaseResponse', [
      'id',
      'case_id',
      'title',
      'description',
      'status',
      'status_group',
      'jurisdiction',
      'pipeline_progress',
      'filed_date',
      'parties',
      'outcome_summary',
      'escalation_reason',
      'reopen_state',
      'amendment_state',
      'latest_decision',
    ]);

    expectProperties('CaseDetailResponse', [
      'documents',
      'evidence',
      'facts',
      'witnesses',
      'legal_rules',
      'precedents',
      'arguments',
      'deliberations',
      'verdicts',
      'decision_history',
      'audit_logs',
    ]);
  });

  it('declares the workflow, hearing-pack, and knowledge-base fields needed by story-driven surfaces', () => {
    expectProperties('EscalatedCaseResponse', [
      'case_id',
      'item_type',
      'case_title',
      'domain',
      'originating_judge',
      'reason',
      'priority',
      'submitted_at',
      'status',
      'preview',
      'history',
    ]);

    expectProperties('HearingPackResponse', [
      'case_title',
      'case_summary',
      'disputed_issues',
      'evidence',
      'suggested_questions',
      'weak_points',
      'evidence_gaps',
    ]);

    expectProperties('KnowledgeBaseStatusResponse', [
      'initialized',
      'documents_count',
      'last_updated_at',
      'vector_store',
      'pair_api',
    ]);
  });

  it('normalizes representative backend payloads that use the OpenAPI-declared field names', () => {
    const casePayload = {
      id: 'case-1',
      case_id: 'case-1',
      title: 'Defective furniture claim',
      description: 'Claimant says the delivered table was warped.',
      domain: 'small_claims',
      status: 'ready_for_review',
      status_group: 'completed',
      filed_date: '2026-04-20',
      claimant_name: 'Ms Lim',
      respondent_name: 'FurniturePlus',
      jurisdiction: {
        status: 'pass',
        valid: true,
        reasons: ['Claim amount: $8,500.00 against $20,000 limit.'],
      },
      pipeline_progress: {
        pipeline_progress_percent: 100,
        current_agent: null,
      },
      outcome_summary: 'Recommend partial refund and replacement costs.',
      escalation_reason: null,
      reopen_state: null,
      amendment_state: null,
      latest_decision: {
        decision_type: 'modify',
        reason: 'Reduce the recommended quantum.',
        recorded_at: '2026-04-22T10:00:00Z',
        recorded_by: 'judge-1',
      },
      decision_history: [
        {
          decision_type: 'modify',
          reason: 'Reduce the recommended quantum.',
          final_order: 'Partial refund ordered.',
          recorded_at: '2026-04-22T10:00:00Z',
          recorded_by: 'judge-1',
        },
      ],
      documents: [
        {
          id: 'doc-1',
          filename: 'invoice.pdf',
          file_type: 'application/pdf',
          openai_file_id: 'file-123',
          uploaded_at: '2026-04-20T09:30:00Z',
        },
      ],
    };

    const workflowPayload = {
      id: 'reopen:1',
      case_id: 'case-1',
      item_type: 'reopen',
      case_title: 'Defective furniture claim',
      domain: 'small_claims',
      originating_judge: 'judge-1',
      reason: 'clerical_error',
      priority: 'urgent',
      submitted_at: '2026-04-22T11:00:00Z',
      status: 'pending',
      preview: 'New invoice page changes the damages calculation.',
      history: [
        {
          action: 'reopen_request_create',
          reason: 'Incorrect total used in recorded order.',
          actor: 'judge-1',
          created_at: '2026-04-22T11:00:00Z',
        },
      ],
    };

    const kbPayload = {
      initialized: true,
      documents_count: 354,
      last_updated_at: '2026-04-22T08:00:00Z',
      vector_store: { status: 'healthy' },
      pair_api: { state: 'closed' },
    };

    const caseDetail = normalizeCaseDetail(casePayload, 'case-1');
    const workflowItem = normalizeWorkflowItem(workflowPayload);
    const kbStatus = normalizeKnowledgeBaseStatus(kbPayload);

    expect(caseDetail.case_id).toBe('case-1');
    expect(caseDetail.party_1).toBe('Ms Lim');
    expect(caseDetail.pipeline_progress).toBe(100);
    expect(caseDetail.documents[0].openai_file_id).toBe('file-123');
    expect(caseDetail.decision_history[0].decision_type).toBe('modify');

    expect(workflowItem.item_type).toBe('reopen');
    expect(workflowItem.originating_judge).toBe('judge-1');
    expect(workflowItem.preview).toContain('invoice page');

    expect(kbStatus.documents_count).toBe(354);
    expect(kbStatus.status).toBe('healthy');
  });
});
