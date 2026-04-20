import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import KnowledgeBase from '../pages/judge/KnowledgeBase';

const mockGetKnowledgeBaseStatus = vi.fn();
const mockShowError = vi.fn();

vi.mock('../lib/api', () => ({
  default: {
    getKnowledgeBaseStatus: (...args) => mockGetKnowledgeBaseStatus(...args),
  },
}));

vi.mock('../hooks', () => ({
  useAPI: () => ({ showError: mockShowError }),
}));

describe('KnowledgeBase (read-only status page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the ready state with document count', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({
      initialized: true,
      status: 'ready',
      documents_count: 42,
    });

    render(<KnowledgeBase />);

    expect(screen.getByText(/Checking vector store/)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('renders the not-initialized state when backend reports no index', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({
      initialized: false,
      documents_count: 0,
    });

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByText('No')).toBeInTheDocument();
    });
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('surfaces errors through the shared showError hook', async () => {
    mockGetKnowledgeBaseStatus.mockRejectedValueOnce(new Error('vector store unreachable'));

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('vector store unreachable');
    });
    expect(screen.getByText('Status unavailable.')).toBeInTheDocument();
  });

  it('communicates that upload/search/delete flows are deferred', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({
      initialized: true,
      documents_count: 1,
    });

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(
        screen.getByText(/Upload, search, and delete flows are deferred/i),
      ).toBeInTheDocument();
    });
  });
});
