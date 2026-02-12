import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReviewView } from './ReviewView';
import type { PullRequest, ValidationStep } from '@gitchorus/shared';

// Mock stores and hooks
const mockStartReview = vi.fn();
const mockCancelReview = vi.fn();
const mockSetSelectedPr = vi.fn();

vi.mock('@/hooks/useReview', () => ({
  useReview: () => ({
    startReview: mockStartReview,
    cancelReview: mockCancelReview,
  }),
}));

// Store state that tests can manipulate
let mockStoreState: {
  reviewStatus: string;
  reviewSteps: ValidationStep[];
  reviewResults: unknown;
  reviewErrors: string | undefined;
};

vi.mock('@/stores/useReviewStore', () => ({
  useReviewStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      setSelectedPr: mockSetSelectedPr,
      reviewStatus: { get: () => mockStoreState.reviewStatus },
      reviewSteps: { get: () => mockStoreState.reviewSteps },
      reviewResults: { get: () => mockStoreState.reviewResults },
      reviewErrors: { get: () => mockStoreState.reviewErrors },
    };
    return selector(state);
  },
}));

const basePr: PullRequest = {
  number: 42,
  title: 'Test PR',
  state: 'open',
  author: { login: 'testuser' },
  headRefName: 'feature',
  baseRefName: 'main',
  additions: 10,
  deletions: 5,
  changedFiles: 3,
  isDraft: false,
  labels: [],
  url: 'https://github.com/test/repo/pull/42',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
};

describe('ReviewView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState = {
      reviewStatus: 'idle',
      reviewSteps: [],
      reviewResults: undefined,
      reviewErrors: undefined,
    };
  });

  it('should render error alert as the first child in the content area when failed', () => {
    mockStoreState.reviewStatus = 'failed';
    mockStoreState.reviewErrors = 'Invalid model ID';

    render(<ReviewView pr={basePr} />);

    const contentArea = screen.getByTestId('review-content');

    // Error alert should be the first rendered child element
    const firstChild = contentArea.children[0];
    expect(firstChild.textContent).toContain('Review failed');
    expect(firstChild.textContent).toContain('Invalid model ID');
  });

  it('should render error alert before progress steps when failed with steps', () => {
    mockStoreState.reviewStatus = 'failed';
    mockStoreState.reviewErrors = 'API rate limit exceeded';
    mockStoreState.reviewSteps = [
      { step: '1', message: 'Reading files...', timestamp: '2025-01-01T00:00:00Z' },
      { step: '2', message: 'Analyzing code...', timestamp: '2025-01-01T00:00:01Z' },
    ];

    render(<ReviewView pr={basePr} />);

    const contentArea = screen.getByTestId('review-content');

    // Error should still be the first child
    const firstChild = contentArea.children[0];
    expect(firstChild.textContent).toContain('Review failed');
    expect(firstChild.textContent).toContain('API rate limit exceeded');
  });

  it('should show the error message text', () => {
    mockStoreState.reviewStatus = 'failed';
    mockStoreState.reviewErrors = 'Something went wrong';

    render(<ReviewView pr={basePr} />);

    expect(screen.queryByText('Review failed')).not.toBeNull();
    expect(screen.queryByText('Something went wrong')).not.toBeNull();
  });

  it('should show retry button in error state', () => {
    mockStoreState.reviewStatus = 'failed';
    mockStoreState.reviewErrors = 'Connection timeout';

    render(<ReviewView pr={basePr} />);

    expect(screen.queryByText('Retry')).not.toBeNull();
  });

  it('should not render error alert when there is no error', () => {
    mockStoreState.reviewStatus = 'idle';

    render(<ReviewView pr={basePr} />);

    const contentArea = screen.getByTestId('review-content');
    expect(contentArea.textContent).not.toContain('Review failed');
  });

  it('should not render error alert while running even if error exists from previous run', () => {
    mockStoreState.reviewStatus = 'running';
    mockStoreState.reviewErrors = 'Previous error';

    render(<ReviewView pr={basePr} />);

    const contentArea = screen.getByTestId('review-content');
    expect(contentArea.textContent).not.toContain('Review failed');
  });

  describe('re-review confirmation dialog', () => {
    const mockResult = {
      prNumber: 42,
      prTitle: 'Test PR',
      repositoryFullName: 'test/repo',
      findings: [],
      verdict: 'Looks good',
      qualityScore: 8,
      reviewedAt: '2025-01-01T00:00:00Z',
      providerType: 'claude-code',
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.01,
      durationMs: 1000,
    };

    it('should show confirmation dialog when clicking Re-review with existing results', () => {
      mockStoreState.reviewStatus = 'completed';
      mockStoreState.reviewResults = mockResult;

      render(<ReviewView pr={basePr} />);

      fireEvent.click(screen.getByRole('button', { name: /Re-review/ }));

      expect(screen.queryByText('Discard current review?')).not.toBeNull();
      expect(mockStartReview).not.toHaveBeenCalled();
    });

    it('should start review directly when clicking Start Review with no results', () => {
      mockStoreState.reviewStatus = 'idle';

      render(<ReviewView pr={basePr} />);

      fireEvent.click(screen.getByRole('button', { name: /Start Review/ }));

      expect(screen.queryByText('Discard current review?')).toBeNull();
      expect(mockStartReview).toHaveBeenCalledWith(42);
    });

    it('should start review when confirming the dialog', () => {
      mockStoreState.reviewStatus = 'completed';
      mockStoreState.reviewResults = mockResult;

      render(<ReviewView pr={basePr} />);

      fireEvent.click(screen.getByRole('button', { name: /Re-review/ }));
      fireEvent.click(screen.getByText('Discard & Re-review'));

      expect(mockStartReview).toHaveBeenCalledWith(42);
    });

    it('should not start review when cancelling the dialog', () => {
      mockStoreState.reviewStatus = 'completed';
      mockStoreState.reviewResults = mockResult;

      render(<ReviewView pr={basePr} />);

      fireEvent.click(screen.getByRole('button', { name: /Re-review/ }));
      fireEvent.click(screen.getByText('Cancel'));

      expect(mockStartReview).not.toHaveBeenCalled();
    });

    it('should not show confirmation for Retry button in error state', () => {
      mockStoreState.reviewStatus = 'failed';
      mockStoreState.reviewErrors = 'Something went wrong';

      render(<ReviewView pr={basePr} />);

      fireEvent.click(screen.getByText('Retry'));

      expect(screen.queryByText('Discard current review?')).toBeNull();
      expect(mockStartReview).toHaveBeenCalledWith(42);
    });
  });
});
