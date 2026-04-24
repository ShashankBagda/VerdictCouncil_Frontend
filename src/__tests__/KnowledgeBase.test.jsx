import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import KnowledgeBase from '../pages/judge/KnowledgeBase';

const mockGetKnowledgeBaseStatus = vi.fn();
const mockInitializeKnowledgeBase = vi.fn();
const mockListKnowledgeBaseDocuments = vi.fn();
const mockUploadKnowledgeBaseDocument = vi.fn();
const mockDeleteKnowledgeBaseDocument = vi.fn();
const mockListDomains = vi.fn();
const mockShowError = vi.fn();

vi.mock('../lib/api', () => ({
  default: {
    getKnowledgeBaseStatus: (...args) => mockGetKnowledgeBaseStatus(...args),
    initializeKnowledgeBase: (...args) => mockInitializeKnowledgeBase(...args),
    listKnowledgeBaseDocuments: (...args) => mockListKnowledgeBaseDocuments(...args),
    uploadKnowledgeBaseDocument: (...args) => mockUploadKnowledgeBaseDocument(...args),
    deleteKnowledgeBaseDocument: (...args) => mockDeleteKnowledgeBaseDocument(...args),
    listDomains: (...args) => mockListDomains(...args),
  },
}));

vi.mock('../hooks', () => ({
  useAPI: () => ({ showError: mockShowError }),
}));

describe('KnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListKnowledgeBaseDocuments.mockResolvedValue({ items: [] });
    mockListDomains.mockResolvedValue([]);
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

  it('renders the not-initialized state and shows Initialize button', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({
      initialized: false,
      documents_count: 0,
    });

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByText('No')).toBeInTheDocument();
    });
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Initialize Knowledge Base/i })).toBeInTheDocument();
  });

  it('initialize button provisions the store and refreshes status', async () => {
    mockGetKnowledgeBaseStatus
      .mockResolvedValueOnce({ initialized: false, documents_count: 0 })
      .mockResolvedValueOnce({ initialized: true, documents_count: 0 });
    mockInitializeKnowledgeBase.mockResolvedValueOnce({});

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Initialize Knowledge Base/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Initialize Knowledge Base/i }));

    await waitFor(() => {
      expect(mockInitializeKnowledgeBase).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Initialize Knowledge Base/i })).not.toBeInTheDocument();
  });

  it('surfaces errors through the shared showError hook', async () => {
    mockGetKnowledgeBaseStatus.mockRejectedValueOnce(new Error('vector store unreachable'));

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith('vector store unreachable');
    });
    expect(screen.getByText('Status unavailable.')).toBeInTheDocument();
  });

  it('shows documents list when initialized', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({ initialized: true, documents_count: 2 });
    mockListKnowledgeBaseDocuments.mockResolvedValueOnce({
      items: [
        { id: 'f1', filename: 'precedents.pdf', status: 'completed', bytes: 51200 },
        { id: 'f2', filename: 'statutes.txt', status: 'completed', bytes: 2048 },
      ],
    });

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByText('precedents.pdf')).toBeInTheDocument();
      expect(screen.getByText('statutes.txt')).toBeInTheDocument();
    });
  });

  it('shows empty state when initialized but no documents', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({ initialized: true, documents_count: 0 });
    mockListKnowledgeBaseDocuments.mockResolvedValueOnce({ items: [] });

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByText(/No documents yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Upload Document/i })).toBeInTheDocument();
  });

  it('deletes a document and removes it from the list', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValue({ initialized: true, documents_count: 1 });
    mockListKnowledgeBaseDocuments.mockResolvedValueOnce({
      items: [{ id: 'f1', filename: 'precedents.pdf', status: 'completed', bytes: 1024 }],
    });
    mockDeleteKnowledgeBaseDocument.mockResolvedValueOnce({ id: 'f1', deleted: true });

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByText('precedents.pdf')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Delete document'));

    await waitFor(() => {
      expect(mockDeleteKnowledgeBaseDocument).toHaveBeenCalledWith('f1');
      expect(screen.queryByText('precedents.pdf')).not.toBeInTheDocument();
    });
  });

  it('shows system domain stores with active badge when has_vector_store is true', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({ initialized: false, documents_count: 0 });
    mockListDomains.mockResolvedValueOnce([
      { id: 'd1', code: 'traffic_violation', name: 'Traffic Violation', has_vector_store: true },
      { id: 'd2', code: 'small_claims', name: 'Small Claims', has_vector_store: true },
      { id: 'd3', code: 'inactive', name: 'Inactive Domain', has_vector_store: false },
    ]);

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByText('Traffic Violation')).toBeInTheDocument();
      expect(screen.getByText('Small Claims')).toBeInTheDocument();
    });
    expect(screen.queryByText('Inactive Domain')).not.toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(screen.getByText(/curated by administrators/i)).toBeInTheDocument();
  });

  it('hides system domain section when no domains have vector stores', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({ initialized: true, documents_count: 0 });
    mockListDomains.mockResolvedValueOnce([
      { id: 'd1', code: 'traffic_violation', name: 'Traffic Violation', has_vector_store: false },
    ]);

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeInTheDocument();
    });
    expect(screen.queryByText(/curated by administrators/i)).not.toBeInTheDocument();
  });

  it('shows private store hint about supplementing system stores', async () => {
    mockGetKnowledgeBaseStatus.mockResolvedValueOnce({ initialized: true, documents_count: 1 });

    render(<KnowledgeBase />);

    await waitFor(() => {
      expect(
        screen.getByText(/supplements system domain stores/i),
      ).toBeInTheDocument();
    });
  });
});
