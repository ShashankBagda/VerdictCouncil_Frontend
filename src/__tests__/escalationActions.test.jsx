import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import EscalatedCases from '../pages/escalation/EscalatedCases';
import SeniorJudgeInbox from '../pages/senior/SeniorJudgeInbox';
import { storage } from '../lib/storage';

const { mockApi, mockShowError, mockShowNotification } = vi.hoisted(() => ({
  mockApi: {
    getEscalatedCases: vi.fn(),
    getSeniorInbox: vi.fn(),
    actionOnEscalatedCase: vi.fn(),
    getCase: vi.fn(),
    getCaseDetail: vi.fn(),
    reviewReopenRequest: vi.fn(),
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
    hasAnyRole: (roles) => roles.some((role) => mockUser.roles.includes(role)),
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
    title: 'Amendment review',
    description: 'Judge requests amendment to reasoning section.',
    submitter: 'judge@verdictcouncil.sg',
    submitted_at: '2026-04-11T14:00:00Z',
    priority: 'medium',
    source: 'remote',
    domain: 'small_claims',
    history: [],
    ...overrides,
  };
}

function remoteReopen(overrides = {}) {
  return {
    id: 'reopen:req-1',
    case_id: 'CASE-300',
    item_type: 'reopen',
    status: 'pending',
    title: 'Reopen request',
    description: 'Claimant submitted new evidence after closure.',
    submitter: 'judge.one@verdictcouncil.sg',
    submitted_at: '2026-04-12T09:00:00Z',
    priority: 'urgent',
    source: 'remote',
    domain: 'small_claims',
    history: [],
    ...overrides,
  };
}

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

describe('EscalatedCases — backend workflow queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.remove('workflow_items');
    mockApi.getCase.mockResolvedValue({});
    mockApi.getCaseDetail.mockResolvedValue({});
  });

  afterEach(() => {
    storage.remove('workflow_items');
  });

  it('loads and displays backend escalation items from the API', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation(), remoteAmendment()],
    });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText('Complexity threshold exceeded')).toBeInTheDocument();
    });

    expect(screen.getByText('Amendment review')).toBeInTheDocument();
    expect(mockApi.getEscalatedCases).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when the backend queue is empty', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({ items: [] });

    renderEscalatedCases();

    await waitFor(() => {
      expect(
        screen.getByText('No escalation items match the current filters.'),
      ).toBeInTheDocument();
    });
  });

  it('ignores local demo workflow storage on the escalation page', async () => {
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
      },
    ]);

    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [remoteEscalation()],
    });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText('Complexity threshold exceeded')).toBeInTheDocument();
    });

    expect(screen.queryByText('Local amendment')).not.toBeInTheDocument();
    expect(screen.queryByText('Local Only')).not.toBeInTheDocument();
  });

  it('filters items by type and status', async () => {
    mockApi.getEscalatedCases.mockResolvedValueOnce({
      items: [
        remoteEscalation(),
        remoteAmendment({ status: 'approved', id: 'amend-approved' }),
        remoteReopen({ item_type: 'reopen', title: 'Reopen for review' }),
      ],
    });

    renderEscalatedCases();

    await waitFor(() => {
      expect(screen.getByText('Complexity threshold exceeded')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Amendments/i }));

    await waitFor(() => {
      expect(screen.queryByText('Complexity threshold exceeded')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Amendment review')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'approved' }));

    await waitFor(() => {
      expect(screen.getByText('Amendment review')).toBeInTheDocument();
    });
    expect(screen.queryByText('Reopen for review')).not.toBeInTheDocument();
  });

  it('shows an error toast when loading the queue fails', async () => {
    mockApi.getEscalatedCases.mockRejectedValueOnce(new Error('Network failure'));

    renderEscalatedCases();

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('Network failure'));
    });
  });
});

describe('SeniorJudgeInbox — backend review workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.remove('workflow_items');
    mockApi.getCase.mockResolvedValue({});
    mockApi.getCaseDetail.mockResolvedValue({});
    mockApi.reviewReopenRequest.mockResolvedValue({ message: 'ok' });
  });

  afterEach(() => {
    storage.remove('workflow_items');
  });

  it('loads inbox items and renders the sidebar list', async () => {
    mockApi.getSeniorInbox.mockResolvedValueOnce({
      items: [
        remoteEscalation({
          id: 'escalation:esc-1',
          title: 'Escalation review',
          domain: 'traffic_violation',
        }),
        remoteReopen(),
      ],
    });

    renderSeniorInbox();

    await waitFor(() => {
      expect(screen.getByText('Senior Judge Inbox')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Escalation review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Reopen request').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Originating judge:/i).length).toBeGreaterThan(0);
  });

  it('displays the detail view for the selected item', async () => {
    mockApi.getSeniorInbox.mockResolvedValueOnce({
      items: [
        remoteEscalation({
          id: 'escalation:esc-1',
          title: 'Escalation review',
          description: 'Case exceeds automated complexity threshold.',
        }),
      ],
    });

    renderSeniorInbox();

    await waitFor(() => {
      expect(
        screen.getAllByText('Case exceeds automated complexity threshold.').length,
      ).toBeGreaterThanOrEqual(1);
    });
  });

  it('filters inbox by status, type, search, domain, and originating judge', async () => {
    mockApi.getSeniorInbox.mockResolvedValueOnce({
      items: [
        remoteEscalation({
          id: 'escalation:esc-1',
          title: 'Escalation review',
          domain: 'traffic_violation',
          submitter: 'judge.two@verdictcouncil.sg',
        }),
        remoteAmendment({
          id: 'amendment:amd-1',
          status: 'approved',
          submitter: 'judge.two@verdictcouncil.sg',
        }),
        remoteReopen(),
      ],
    });

    renderSeniorInbox();

    await waitFor(() => {
      expect(screen.getByText('Escalation review')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'approved' }));

    await waitFor(() => {
      expect(screen.queryByText('Escalation review')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('Amendment review').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getAllByRole('button', { name: 'all' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'reopen' }));

    await waitFor(() => {
      expect(screen.getAllByText('Reopen request').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('Amendment review')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'all' })[1]);
    fireEvent.change(screen.getByPlaceholderText('Search case or request'), {
      target: { value: 'new evidence' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('Reopen request').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('Escalation review')).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('All originating judges'), {
      target: { value: 'judge.one@verdictcouncil.sg' },
    });
    fireEvent.change(screen.getByDisplayValue('All domains'), {
      target: { value: 'small_claims' },
    });

    await waitFor(() => {
      expect(screen.getAllByText('Reopen request').length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText('Escalation review')).not.toBeInTheDocument();
  });

  it('shows backend item count badge', async () => {
    mockApi.getSeniorInbox.mockResolvedValueOnce({
      items: [
        remoteEscalation({ id: 'escalation:esc-1', title: 'Escalation review' }),
        remoteAmendment({ id: 'amendment:amd-1' }),
      ],
    });

    renderSeniorInbox();

    await waitFor(() => {
      expect(screen.getByText('2 backend items')).toBeInTheDocument();
    });
  });

  it('approves reopen requests through the backend review endpoint', async () => {
    mockApi.getSeniorInbox.mockResolvedValueOnce({
      items: [remoteReopen()],
    });

    renderSeniorInbox();

    await waitFor(() => {
      expect(screen.getByText('Approve Reopen')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Approve Reopen'));

    await waitFor(() => {
      expect(mockApi.reviewReopenRequest).toHaveBeenCalledWith('CASE-300', 'req-1', {
        approve: true,
        review_notes: undefined,
      });
    });
    expect(mockShowNotification).toHaveBeenCalledWith('Reopen request approved.', 'success');
  });

  it('shows an error toast when loading inbox fails', async () => {
    mockApi.getSeniorInbox.mockRejectedValueOnce(new Error('Server error'));

    renderSeniorInbox();

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(expect.stringContaining('Server error'));
    });
  });
});
