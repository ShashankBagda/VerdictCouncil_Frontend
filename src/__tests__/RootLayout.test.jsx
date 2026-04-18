import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RootLayout from '../components/layout/RootLayout';

const mockUseAuth = vi.fn();
const mockGetEscalatedCases = vi.fn();
const mockBuildWorkflowCounts = vi.fn(() => ({ pending: 0 }));
const mockGetStoredWorkflowItems = vi.fn(() => []);
const mockNormalizeWorkflowItem = vi.fn((item) => item);

vi.mock('../hooks', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../lib/api', () => ({
  default: {
    getEscalatedCases: (...args) => mockGetEscalatedCases(...args),
  },
}));

vi.mock('../lib/escalationWorkflow', () => ({
  buildWorkflowCounts: (...args) => mockBuildWorkflowCounts(...args),
  getStoredWorkflowItems: (...args) => mockGetStoredWorkflowItems(...args),
  normalizeWorkflowItem: (...args) => mockNormalizeWorkflowItem(...args),
}));

describe('RootLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildWorkflowCounts.mockReturnValue({ pending: 0 });
    mockGetStoredWorkflowItems.mockReturnValue([]);
    mockNormalizeWorkflowItem.mockImplementation((item) => item);
  });

  it('renders a restoring state while auth is unresolved and skips inbox polling', () => {
    mockUseAuth.mockReturnValue({
      logout: vi.fn(),
      user: null,
      hasAnyRole: vi.fn(() => false),
      isAuthenticated: false,
      isAuthResolved: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Restoring session...')).toBeInTheDocument();
    expect(mockGetEscalatedCases).not.toHaveBeenCalled();
  });

  it('redirects to login when auth is resolved but the user is not authenticated', () => {
    mockUseAuth.mockReturnValue({
      logout: vi.fn(),
      user: null,
      hasAnyRole: vi.fn(() => false),
      isAuthenticated: false,
      isAuthResolved: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders the protected shell and loads inbox counts once auth is ready', async () => {
    mockUseAuth.mockReturnValue({
      logout: vi.fn(),
      user: { email: 'judge@example.com', role: 'judge' },
      hasAnyRole: vi.fn(() => false),
      isAuthenticated: true,
      isAuthResolved: true,
    });
    mockGetEscalatedCases.mockResolvedValue({ items: [{ id: '1' }] });
    mockBuildWorkflowCounts.mockReturnValue({ pending: 2 });

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<RootLayout />}>
            <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    await waitFor(() => expect(mockGetEscalatedCases).toHaveBeenCalled());
    expect(mockNormalizeWorkflowItem).toHaveBeenCalledWith(
      { id: '1' },
      0,
      [{ id: '1' }],
    );
    expect(mockBuildWorkflowCounts).toHaveBeenCalled();
  });
});
