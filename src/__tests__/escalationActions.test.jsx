import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EscalatedCases from '../pages/escalation/EscalatedCases';
import SeniorJudgeInbox from '../pages/senior/SeniorJudgeInbox';
import { storage } from '../lib/storage';

// ── Mocks ───────────────────────────────────────────────────────────────────

const { mockApi, mockShowError, mockShowNotification } = vi.hoisted(() => ({
  mockApi: {
    getEscalatedCases: vi.fn(),
    actionOnEscalatedCase: vi.fn(),
    getCase: vi.fn(),
    getCaseDetail: vi.fn(),
  },
  mockShowError: vi.fn(),
  mockShowNotification: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  default: mockApi,
  api: mockApi,
  APIError: class APIError extends Error {
    constructor(status, detail) {
      super(detail);
      this.status = status;
      this.detail = detail;
    }
  },
  getErrorMessage: (err, fallback) => err?.detail || err?.message || fallback,
}));

const mockUser = {
  email: 'senior@verdictcouncil.sg',
  role: 'senior_judge',
  roles: ['senior_judge'],
  authenticated: true,
};

vi.mock('../hooks', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isAuthResolved: true,
    hasAnyRole: (roles) => roles.some((r) => mockUser.roles.includes(r)),
    hasRole: (role) => mockUser.roles.includes(role),
  }),
  useAPI: () => ({
    showError: mockShowError,
    showNotification: mockShowNotification,
    loading: false,
    setLoading: vi.fn(),
  }),
  useCase: () => ({
    selectedCaseId: null,
    selectCase: vi.fn(),
    caseDetail: null,
    updateCaseDetail: vi.fn(),
  }),
  usePipelineStatus: () => ({
    loading: false,
    pipelineStatus: null,
    error: null,
    errorCount: 0,
    isStale: false,
    isGivenUp: false,
    retry: vi.fn(),
  }),
}));

// ── Fixtures ────────────────────────────────────────────────────────────────

function remoteEscalation(overrides = {}) {
  return {
    id: 'esc-remote-1',
    case_id: 'CASE-100',
    item_type: 'escalation',
    status: 'pending',
    title: 'Complexity threshold exceeded',
    description: 'Case exceeds automated complexity threshold.',
    submitter: 'system@verdictcouncil.sg',
    submitted_at: '2026-04-10T10:00:00Z',
    priority: 'high',
    source: 'remote',
    history: [],
    ...overrides,
  };
}

function remoteAmendment(overrides = {}) {
  return {
    id: 'amend-remote-1',
    case_id: 'CASE-200',
    item_type: 'amendment',
    status: 'pending',
    title: 'Amend verdict reasoning',
    description: 'Judge requests amendment to reasoning section.',
    submitter: 'judge@verdictcouncil.sg',
    submitted_at: '2026-04-11T14:00:00Z',
    priority: 'medium',
    source: 'remote',
    requested_change: 'Update paragraph 3 of the reasoning.',
    history: [],
    ...overrides,
  };
}

function remoteReopen(overrides = {}) {
  return {
    id: 'reopen-remote-1',
    case_id: 'CASE-300',
    item_type: 'reopen',
    status: 'pending',
    title: 'New evidence submitted',
    description: 'Claimant submitted new evidence after closure.',
    submitter: 'clerk@verdictcouncil.sg',
    submitted_at: '2026-04-12T09:00:00Z',
    priority: 'urgent',
    source: 'remote',
    history: [],
    ...overrides,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderEscalatedCases() {
  return render(
    <MemoryRouter>
      <EscalatedCases />
    </MemoryRouter>,
  );
}

function renderSeniorInbox() {
  return render(
    <MemoryRouter>
      <SeniorJudgeInbox />
    </MemoryRouter>,
  );
}

// ── EscalatedCases tests ────────────────────────────────────────────────────

describe('EscalatedCases — remote action UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.remove('workflow_items');
    mockApi.getCase.mockResolvedValue({});
    mockApi.getCaseDetail.mockResolvedValue({});
  });

  afterEach(() => {
    storage.remove('workflow_items');
  });

  it('loads and displays remote escalation items from the API', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation(), remoteAmendment()],
    });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText('Complexity threshold exceeded')).toBeInTheDocument();
    });

    expect(screen.getByText('Amend verdict reasoning')).toBeInTheDocument();
    expect(mockApi.getEscalatedCases).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when no items match filters', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({ items: [] });

    renderEscalatedCases();

    await waitFor(() => {
      expect(
        screen.getByText('No escalation items match the current filters.'),
      ).toBeInTheDocument();
    });
  });

  it('merges remote items with local-only workflow items', async () => {
    storage.set('workflow_items', [
      {
        id: 'local-amendment-CASE-50-1',
        case_id: 'CASE-50',
        item_type: 'amendment',
        status: 'pending',
        title: 'Local amendment',
        description: 'Created locally',
        source: 'local',
        submitted_at: '2026-04-13T00:00:00Z',
        history: [],
      },
    ]);

    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation()],
    });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText('Complexity threshold exceeded')).toBeInTheDocument();
    });

    expect(screen.getByText('Local amendment')).toBeInTheDocument();
    const localBadges = screen.getAllByText('Local Only');
    expect(localBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('filters items by type', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation(), remoteAmendment(), remoteReopen()],
    });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText('Complexity threshold exceeded')).toBeInTheDocument();
    });

    expect(screen.getByText('Amend verdict reasoning')).toBeInTheDocument();
    expect(screen.getByText('New evidence submitted')).toBeInTheDocument();

    const amendmentFilter = screen.getByRole('button', { name: /Amendments/i });
    fireEvent.click(amendmentFilter);

    await waitFor(() => {
      expect(screen.queryByText('Complexity threshold exceeded')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Amend verdict reasoning')).toBeInTheDocument();
    expect(screen.queryByText('New evidence submitted')).not.toBeInTheDocument();
  });

  it('filters items by status', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [
        remoteEscalation({ status: 'pending' }),
        remoteAmendment({ status: 'approved', id: 'amend-approved' }),
      ],
    });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText('Complexity threshold exceeded')).toBeInTheDocument();
    });

    const approvedFilter = screen.getByRole('button', { name: 'approved' });
    fireEvent.click(approvedFilter);

    await waitFor(() => {
      expect(screen.queryByText('Complexity threshold exceeded')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Amend verdict reasoning')).toBeInTheDocument();
  });

  it('shows error toast when loading escalated cases fails', async () => {
    mockApi.getEscalatedCases.mockRejectedValueOnce(new Error('Network failure'));

    renderEscalatedCases();

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('Network failure'),
      );
    });
  });

  it('shows local-only disclaimer when local items exist', async () => {
    storage.set('workflow_items', [
      {
        id: 'local-reopen-CASE-77-1',
        case_id: 'CASE-77',
        item_type: 'reopen',
        status: 'pending',
        title: 'Local reopen item',
        description: 'Demo',
        source: 'local',
        submitted_at: '2026-04-14T00:00:00Z',
        history: [],
      },
    ]);

    mockApi.getEscalatedCases.mockResolvedValueOnce({ items: [] });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText(/Local-only workflow items/i)).toBeInTheDocument();
    });
  });
});

// ── SeniorJudgeInbox tests ──────────────────────────────────────────────────

describe('SeniorJudgeInbox — remote action UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.remove('workflow_items');
    mockApi.getCase.mockResolvedValue({});
    mockApi.getCaseDetail.mockResolvedValue({});
  });

  afterEach(() => {
    storage.remove('workflow_items');
  });

  it('loads inbox items and renders the sidebar list', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation(), remoteReopen()],
    });

    renderSeniorInbox();

    await waitFor(() => {
      expect(screen.getByText('Senior Judge Inbox')).toBeInTheDocument();
    });

    // Items appear in sidebar (use getAllByText since title appears in both list and detail)
    const escalationTitles = screen.getAllByText('Complexity threshold exceeded');
    expect(escalationTitles.length).toBeGreaterThanOrEqual(1);

    const reopenTitles = screen.getAllByText('New evidence submitted');
    expect(reopenTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('displays the detail view for the selected item', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation()],
    });

    renderSeniorInbox();

    await waitFor(() => {
      // The description appears in both sidebar and detail panel
      const descriptions = screen.getAllByText(
        'Case exceeds automated complexity threshold.',
      );
      expect(descriptions.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('filters inbox by status', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [
        remoteEscalation({ status: 'pending' }),
        remoteAmendment({ status: 'approved', id: 'amend-approved-2' }),
      ],
    });

    renderSeniorInbox();

    await waitFor(() => {
      const titles = screen.getAllByText('Complexity threshold exceeded');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    // Click "approved" filter
    const approvedBtn = screen.getByRole('button', { name: 'approved' });
    fireEvent.click(approvedBtn);

    await waitFor(() => {
      expect(screen.queryByText('Complexity threshold exceeded')).not.toBeInTheDocument();
    });
    const amendTitles = screen.getAllByText('Amend verdict reasoning');
    expect(amendTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('filters inbox by item type', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation(), remoteReopen()],
    });

    renderSeniorInbox();

    await waitFor(() => {
      const titles = screen.getAllByText('Complexity threshold exceeded');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    const reopenBtn = screen.getByRole('button', { name: 'reopen' });
    fireEvent.click(reopenBtn);

    await waitFor(() => {
      expect(screen.queryByText('Complexity threshold exceeded')).not.toBeInTheDocument();
    });
    const reopenTitles = screen.getAllByText('New evidence submitted');
    expect(reopenTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('searches inbox items by text', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation(), remoteReopen()],
    });

    renderSeniorInbox();

    await waitFor(() => {
      const titles = screen.getAllByText('Complexity threshold exceeded');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText('Search case or request');
    fireEvent.change(searchInput, { target: { value: 'new evidence' } });

    await waitFor(() => {
      expect(screen.queryByText('Complexity threshold exceeded')).not.toBeInTheDocument();
    });
    const reopenTitles = screen.getAllByText('New evidence submitted');
    expect(reopenTitles.length).toBeGreaterThanOrEqual(1);
  });

  it('shows backend item count badge', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation(), remoteAmendment()],
    });

    renderSeniorInbox();

    await waitFor(() => {
      expect(screen.getByText('2 backend items')).toBeInTheDocument();
    });
  });

  it('shows local-only disclaimer when local items exist', async () => {
    storage.set('workflow_items', [
      {
        id: 'local-reopen-CASE-99-1',
        case_id: 'CASE-99',
        item_type: 'reopen',
        status: 'pending',
        title: 'Local reopen',
        description: 'Demo reopen',
        source: 'local',
        submitted_at: '2026-04-14T00:00:00Z',
        history: [],
      },
    ]);

    mockApi.getEscalatedCases.mockResolvedValueOnce({ items: [] });

    renderSeniorInbox();

    await waitFor(() => {
      expect(screen.getByText(/Local-only review items/i)).toBeInTheDocument();
    });
  });

  it('shows error toast when loading inbox fails', async () => {
    mockApi.getEscalatedCases.mockRejectedValueOnce(new Error('Server error'));

    renderSeniorInbox();

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(
        expect.stringContaining('Server error'),
      );
    });
  });
});
