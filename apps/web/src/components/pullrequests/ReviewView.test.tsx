import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('ReviewView - error message position', () => {
  beforeEach(() => {
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

    const { container } = render(<ReviewView pr={basePr} />);

    // The scrollable content area
    const contentArea = container.querySelector('.overflow-y-auto');
    expect(contentArea).not.toBeNull();

    // Error alert should be the first rendered child element
    const firstChild = contentArea!.children[0];
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

    const { container } = render(<ReviewView pr={basePr} />);

    const contentArea = container.querySelector('.overflow-y-auto');
    expect(contentArea).not.toBeNull();

    // Error should still be the first child
    const firstChild = contentArea!.children[0];
    expect(firstChild.textContent).toContain('Review failed');
    expect(firstChild.textContent).toContain('API rate limit exceeded');
  });

  it('should show the error message text', () => {
    mockStoreState.reviewStatus = 'failed';
    mockStoreState.reviewErrors = 'Something went wrong';

    render(<ReviewView pr={basePr} />);

    expect(screen.getByText('Review failed')).toBeDefined();
    expect(screen.getByText('Something went wrong')).toBeDefined();
  });

  it('should show retry button in error state', () => {
    mockStoreState.reviewStatus = 'failed';
    mockStoreState.reviewErrors = 'Connection timeout';

    render(<ReviewView pr={basePr} />);

    expect(screen.getByText('Retry')).toBeDefined();
  });

  it('should not render error alert when there is no error', () => {
    mockStoreState.reviewStatus = 'idle';

    const { container } = render(<ReviewView pr={basePr} />);

    const contentArea = container.querySelector('.overflow-y-auto');
    expect(contentArea!.textContent).not.toContain('Review failed');
  });

  it('should not render error alert while running even if error exists from previous run', () => {
    mockStoreState.reviewStatus = 'running';
    mockStoreState.reviewErrors = 'Previous error';

    const { container } = render(<ReviewView pr={basePr} />);

    const contentArea = container.querySelector('.overflow-y-auto');
    expect(contentArea!.textContent).not.toContain('Review failed');
  });
});
