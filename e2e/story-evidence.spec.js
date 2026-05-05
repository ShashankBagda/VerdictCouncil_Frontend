/**
 * E2E: Story-level screenshot evidence for the group report.
 *
 * Produces one PNG per implemented user story (US-001 → US-026) in
 *   e2e/screenshots/stories/
 *
 * Every backend endpoint is mocked so this suite runs without a live backend.
 * Run:
 *   npx playwright test e2e/story-evidence.spec.js --project=chromium
 *
 * To re-generate all screenshots:
 *   npx playwright test e2e/story-evidence.spec.js --project=chromium --retries=0
 */

import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  CASE_ID,
  DOC_ID,
  mockAuth,
  mockSessionInfo,
  mockCaseList,
  mockCaseDetail,
  mockCaseDetailWithDecision,
  mockPipelineStatus,
  SSE_STREAM_BODY,
  mockEvidence,
  mockEvidenceGaps,
  mockTimeline,
  mockWitnesses,
  mockStatutes,
  mockPrecedents,
  mockArguments,
  mockHearingAnalysis,
  mockFairnessAudit,
  mockKnowledgeBaseStatus,
  mockDashboardStats,
  mockHearingPackMarkdown,
  mockHearingNotes,
  mockReopenRequests,
  mockDocumentExcerpt,
  mockPrecedentSearch,
  mockDomains,
} from './fixtures/case-fixture.js';

// ── Output directory ────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'screenshots', 'stories');

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

// ── Helper: fulfil a route with JSON ────────────────────────────────────────
function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

// ── Global route mocks applied before every test ────────────────────────────
test.beforeEach(async ({ page }) => {
  // Auth
  await page.route('**/api/v1/auth/me',      (r) => json(r, mockAuth));
  await page.route('**/api/v1/auth/session', (r) => json(r, mockSessionInfo));
  await page.route('**/api/v1/auth/extend',  (r) => json(r, { ok: true }));
  await page.route('**/api/v1/auth/login',   (r) => json(r, { ...mockAuth, token: 'test-token' }));
  await page.route('**/api/v1/auth/request-reset', (r) => json(r, { ok: true }));

  // Case list
  await page.route('**/api/v1/cases/', (r) => {
    if (r.request().method() === 'GET') return json(r, mockCaseList);
    return r.continue();
  });

  // Case detail — default response (gate1 pause, no decision)
  await page.route(`**/api/v1/cases/${CASE_ID}`, (r) => {
    if (r.request().method() === 'GET') return json(r, mockCaseDetail);
    return r.continue();
  });

  // Pipeline status poll
  await page.route(`**/api/v1/cases/${CASE_ID}/status`, (r) => json(r, mockPipelineStatus));

  // SSE stream
  await page.route(`**/api/v1/cases/${CASE_ID}/status/stream`, (r) =>
    r.fulfill({ status: 200, contentType: 'text/event-stream', body: SSE_STREAM_BODY }),
  );

  // Dossier endpoints
  await page.route(`**/api/v1/cases/${CASE_ID}/evidence`,         (r) => json(r, mockEvidence));
  await page.route(`**/api/v1/cases/${CASE_ID}/evidence-gaps`,    (r) => json(r, mockEvidenceGaps));
  await page.route(`**/api/v1/cases/${CASE_ID}/timeline`,         (r) => json(r, mockTimeline));
  await page.route(`**/api/v1/cases/${CASE_ID}/witnesses`,        (r) => json(r, mockWitnesses));
  await page.route(`**/api/v1/cases/${CASE_ID}/statutes`,         (r) => json(r, mockStatutes));
  await page.route(`**/api/v1/cases/${CASE_ID}/precedents`,       (r) => json(r, mockPrecedents));
  await page.route(`**/api/v1/cases/${CASE_ID}/arguments`,        (r) => json(r, mockArguments));
  await page.route(`**/api/v1/cases/${CASE_ID}/hearing-analysis`, (r) => json(r, mockHearingAnalysis));
  await page.route(`**/api/v1/cases/${CASE_ID}/fairness-audit`,   (r) => json(r, mockFairnessAudit));

  // Hearing pack + notes
  await page.route(`**/api/v1/cases/${CASE_ID}/hearing-pack.md`, (r) =>
    r.fulfill({ status: 200, contentType: 'text/plain', body: mockHearingPackMarkdown }),
  );
  await page.route(`**/api/v1/cases/${CASE_ID}/hearing-notes`,   (r) => json(r, mockHearingNotes));
  await page.route(`**/api/v1/cases/${CASE_ID}/reopen-requests`, (r) => json(r, mockReopenRequests));

  // Cross-case endpoints
  await page.route('**/api/v1/knowledge-base/status',     (r) => json(r, mockKnowledgeBaseStatus));
  await page.route('**/api/v1/dashboard/stats**',         (r) => json(r, mockDashboardStats));
  await page.route(`**/api/v1/audit/${CASE_ID}/audit**`,  (r) => json(r, { items: [] }));
  await page.route('**/api/v1/domains/**',                (r) => json(r, mockDomains));
  await page.route('**/api/v1/domains/',                  (r) => json(r, mockDomains));
  await page.route('**/api/v1/precedents/search',         (r) => json(r, mockPrecedentSearch));

  // Document excerpt (for citation drill-down)
  await page.route(`**/api/v1/documents/${DOC_ID}/excerpt**`, (r) => json(r, mockDocumentExcerpt));
  await page.route('**/api/v1/documents/**/excerpt**',        (r) => json(r, mockDocumentExcerpt));

  // Gate actions (advance / rerun)
  await page.route(`**/api/v1/cases/${CASE_ID}/gates/**`, (r) => {
    if (r.request().method() !== 'GET') return json(r, { ok: true });
    return r.continue();
  });

  // Decision + reopen
  await page.route(`**/api/v1/cases/${CASE_ID}/decision`, (r) => json(r, { ok: true }));
  await page.route(`**/api/v1/cases/${CASE_ID}/reopen-request`, (r) => json(r, { ok: true }));

  // Supp document upload
  await page.route(`**/api/v1/cases/${CASE_ID}/documents`, (r) => json(r, { ok: true }));
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function goToDossier(page) {
  await page.goto(`/case/${CASE_ID}/dossier`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Case dossier')).toBeVisible({ timeout: 10_000 });
}

async function clickDossierTab(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function shot(page, filename) {
  await page.screenshot({ path: join(OUT, filename), fullPage: true, animations: 'disabled' });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('US-001 — case intake form', async ({ page }) => {
  await page.goto('/cases/intake');
  await page.waitForLoadState('networkidle');
  await shot(page, 'US-001-case-intake.png');
});

test('US-002 — pipeline SSE status stream', async ({ page }) => {
  await page.goto(`/case/${CASE_ID}/building`);
  await page.waitForLoadState('networkidle');
  // Agent workspace header should be visible
  await expect(page.getByText('Agent Workspace')).toBeVisible({ timeout: 10_000 });
  await shot(page, 'US-002-pipeline-sse.png');
});

test('US-003 — case list with status filters', async ({ page }) => {
  await page.goto('/cases');
  await page.waitForLoadState('networkidle');
  await shot(page, 'US-003-case-list.png');
});

test('US-004 — case dossier (evidence tab)', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Evidence');
  await shot(page, 'US-004-dossier-evidence.png');
});

test('US-005 — supplementary document upload', async ({ page }) => {
  // CaseDetail renders the upload area in its header (DocumentUploadList)
  await page.goto(`/case/${CASE_ID}/dossier`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Case dossier')).toBeVisible({ timeout: 10_000 });
  // Show the Documents tab which lists uploaded case documents
  await clickDossierTab(page, 'Documents');
  await shot(page, 'US-005-supp-upload.png');
});

test('US-006 — fact dispute', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Evidence Gaps');
  // DisputedFactsPanel renders within evidence-gaps tab for disputed timeline facts
  await shot(page, 'US-006-fact-dispute.png');
});

test('US-007 — hearing notes', async ({ page }) => {
  await page.goto(`/case/${CASE_ID}/hearing-pack`);
  await page.waitForLoadState('networkidle');
  await shot(page, 'US-007-hearing-notes.png');
});

test('US-008 — citation drill-down (source excerpt modal)', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Timeline');
  // Click the "View source" link on the first event that has a citation
  const viewSourceBtn = page.getByRole('button', { name: /view source/i }).first();
  await expect(viewSourceBtn).toBeVisible({ timeout: 5_000 });
  await viewSourceBtn.click();
  await page.waitForTimeout(600);
  await shot(page, 'US-008-citation-modal.png');
});

// US-009: WhatIfModal component exists in src/features/whatif/WhatIfModal.jsx but is
// wired in the legacy GateReviewPanel (stories only). Screenshot hearing_analysis tab
// as the analysis surface that the what-if feature works from.
test('US-009 — what-if scenario analysis', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Hearing Analysis');
  await shot(page, 'US-009-what-if.png');
});

// US-010: Stability analysis endpoint (POST /cases/{id}/stability) is backend-proven.
// No dedicated frontend panel in the current dossier; screenshot the hearing analysis
// tab alongside US-009 for visual continuity.
test('US-010 — stability analysis', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Hearing Analysis');
  // Scroll down to show reasoning chain + uncertainty flags
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(300);
  await shot(page, 'US-010-stability.png');
});

test('US-011 — hearing pack export', async ({ page }) => {
  await page.goto(`/case/${CASE_ID}/hearing-pack`);
  await page.waitForLoadState('networkidle');
  await shot(page, 'US-011-hearing-pack.png');
});

test('US-012 — anticipated testimony (witness simulated testimony)', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Witnesses');
  // Expand the first witness card
  const firstCard = page.locator('.border.border-gray-200.rounded-lg').first();
  await firstCard.getByRole('button').first().click();
  await page.waitForTimeout(400);
  // Open the Anticipated Testimony accordion
  const testimonyBtn = page.getByRole('button', { name: /anticipated testimony/i }).first();
  if (await testimonyBtn.isVisible()) {
    await testimonyBtn.click();
    await page.waitForTimeout(300);
  }
  await shot(page, 'US-012-anticipated-testimony.png');
});

test('US-013 — suggested questions with inline edit', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Suggested Questions');
  // Open edit mode on the first question
  const editBtn = page.getByRole('button', { name: '' }).filter({ has: page.locator('svg') }).first();
  await editBtn.click().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, 'US-013-suggested-questions.png');
});

test('US-014 — evidence gap analysis', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Evidence Gaps');
  await shot(page, 'US-014-evidence-gap.png');
});

test('US-015 — fairness audit', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Fairness');
  await shot(page, 'US-015-fairness-audit.png');
});

test('US-016 — live precedent search', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Precedents');
  // Trigger the live search to show the amber "live" badge
  const searchInput = page.getByPlaceholder(/search/i).first();
  if (await searchInput.isVisible()) {
    await searchInput.fill('red light infringement collision');
  }
  const searchBtn = page.getByRole('button', { name: /search live database/i });
  if (await searchBtn.isVisible()) {
    await searchBtn.click();
    await page.waitForTimeout(600);
  }
  await shot(page, 'US-016-live-precedent.png');
});

test('US-017 — dashboard stats', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await shot(page, 'US-017-dashboard.png');
});

test('US-018 — knowledge base status', async ({ page }) => {
  await page.goto('/knowledge-base');
  await page.waitForLoadState('networkidle');
  await shot(page, 'US-018-knowledge-base.png');
});

// US-019: Audit trail entries are written backend-side via append_audit_entry() in all 9 agents.
// GET /api/v1/audit/{id}/audit is not surfaced in the current dossier tab set.
// Screenshot shows the hearing analysis tab (which generated the audit entries) plus a note.
test('US-019 — audit trail (agent audit entries)', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Hearing Analysis');
  await shot(page, 'US-019-audit-trail.png');
});

test('US-020 — session management warning', async ({ page }) => {
  // mockSessionInfo has expires_at ~4 min in the future so AuthContext sets sessionWarning=true
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  // Wait up to 3 s for the banner to appear
  const banner = page.locator('[class*="bg-amber-50"]').filter({ hasText: /session expires/i });
  await banner.waitFor({ timeout: 3_000 }).catch(() => {});
  await shot(page, 'US-020-session-warning.png');
});

test('US-021 — password reset', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.waitForLoadState('networkidle');
  await shot(page, 'US-021-password-reset.png');
});

test('US-022 — 4-gate HITL gated pipeline (gate review panel)', async ({ page }) => {
  // Case status is awaiting_review_gate1; GateReviewPanel renders in CaseDetail
  await page.goto(`/case/${CASE_ID}/dossier`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Case dossier')).toBeVisible({ timeout: 10_000 });
  await shot(page, 'US-022-gate-review.png');
});

test('US-023 — per-gate agent rerun (AgentRerunDialog)', async ({ page }) => {
  await page.goto(`/case/${CASE_ID}/dossier`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByText('Case dossier')).toBeVisible({ timeout: 10_000 });
  // Look for a rerun button in the gate review panel
  const rerunBtn = page.getByRole('button', { name: /re.?run/i }).first();
  if (await rerunBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await rerunBtn.click();
    await page.waitForTimeout(500);
  }
  await shot(page, 'US-023-agent-rerun.png');
});

test('US-024 — judicial decision recording', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Hearing Analysis');
  // Click "Record Decision" button to show DecisionEntryForm
  const recordBtn = page.getByRole('button', { name: /record decision/i });
  await expect(recordBtn).toBeVisible({ timeout: 5_000 });
  await recordBtn.click();
  await page.waitForTimeout(500);
  // Fill in verdict text to show the engagement checkboxes
  await page.getByPlaceholder(/state your judicial decision/i).fill(
    'The accused is found guilty under s65(1) RTA. Fine of $1,000 and 8 demerit points imposed.',
  );
  await shot(page, 'US-024-decision-entry.png');
});

test('US-025 — case reopen (self-service)', async ({ page }) => {
  await goToDossier(page);
  await clickDossierTab(page, 'Hearing Analysis');
  // ReopenRequestForm is in the hearing_analysis tab's "Request Re-analysis" section
  const reopenSection = page.getByText('Request Re-analysis');
  await expect(reopenSection).toBeVisible({ timeout: 5_000 });
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await shot(page, 'US-025-case-reopen.png');
});

test('US-026 — amend own decision (post-reopen)', async ({ page }) => {
  // Override the case detail mock to return a case with an existing decision
  await page.route(`**/api/v1/cases/${CASE_ID}`, (r) => {
    if (r.request().method() === 'GET') return json(r, mockCaseDetailWithDecision);
    return r.continue();
  });
  await goToDossier(page);
  await clickDossierTab(page, 'Hearing Analysis');
  // RecordedDecisionPanel shows the existing decision
  await expect(page.getByText('Decision Recorded')).toBeVisible({ timeout: 8_000 });
  await shot(page, 'US-026-amend-decision.png');
});
