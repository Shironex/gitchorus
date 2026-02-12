import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ValidationPanel } from './ValidationPanel';
import type { ValidationStep } from '@gitchorus/shared';

// Mock hooks
const mockStartValidation = vi.fn();
const mockCancelValidation = vi.fn();
const mockPushToGithub = vi.fn();
const mockUpdateGithubComment = vi.fn();
const mockListComments = vi.fn();

vi.mock('@/hooks/useValidation', () => ({
  useValidation: () => ({
    startValidation: mockStartValidation,
    cancelValidation: mockCancelValidation,
    pushToGithub: mockPushToGithub,
    updateGithubComment: mockUpdateGithubComment,
    listComments: mockListComments,
  }),
}));

// Store state that tests can manipulate
let mockIssueState: {
  selectedIssueNumber: number | null;
  issues: Array<{ number: number; title: string; updatedAt: string }>;
};

let mockValidationState: {
  queue: Array<{ issueNumber: number; status: string }>;
  steps: ValidationStep[] | undefined;
  results: unknown;
  errors: string | undefined;
  history: unknown[];
  pushStatus: string;
  postedCommentUrls: string | undefined;
};

vi.mock('@/stores/useIssueStore', () => ({
  useIssueStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      selectedIssueNumber: mockIssueState.selectedIssueNumber,
      issues: mockIssueState.issues,
    };
    return selector(state);
  },
}));

vi.mock('@/stores/useValidationStore', () => ({
  useValidationStore: (selector: (state: Record<string, unknown>) => unknown) => {
    const state = {
      queue: mockValidationState.queue,
      steps: { get: () => mockValidationState.steps },
      results: { get: () => mockValidationState.results },
      errors: { get: () => mockValidationState.errors },
      history: mockValidationState.history,
      pushStatus: { get: () => mockValidationState.pushStatus },
      postedCommentUrls: { get: () => mockValidationState.postedCommentUrls },
    };
    return selector(state);
  },
}));

describe('ValidationPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIssueState = {
      selectedIssueNumber: 7,
      issues: [{ number: 7, title: 'Test issue', updatedAt: '2025-01-01T00:00:00Z' }],
    };
    mockValidationState = {
      queue: [],
      steps: undefined,
      results: undefined,
      errors: undefined,
      history: [],
      pushStatus: 'idle',
      postedCommentUrls: undefined,
    };
  });

  it('should render error alert as the first child in the content area when failed', () => {
    mockValidationState.queue = [{ issueNumber: 7, status: 'failed' }];
    mockValidationState.errors = 'Invalid model ID';

    render(<ValidationPanel />);

    const contentArea = screen.getByTestId('validation-content');

    // Error alert should be the first rendered child element
    const firstChild = contentArea.children[0];
    expect(firstChild.textContent).toContain('Validation failed');
    expect(firstChild.textContent).toContain('Invalid model ID');
  });

  it('should render error alert before step log when failed with steps', () => {
    mockValidationState.queue = [{ issueNumber: 7, status: 'failed' }];
    mockValidationState.errors = 'API rate limit exceeded';
    mockValidationState.steps = [
      { step: '1', message: 'Reading files...', timestamp: '2025-01-01T00:00:00Z' },
      { step: '2', message: 'Analyzing code...', timestamp: '2025-01-01T00:00:01Z' },
    ];

    render(<ValidationPanel />);

    const contentArea = screen.getByTestId('validation-content');

    // Error should still be the first child
    const firstChild = contentArea.children[0];
    expect(firstChild.textContent).toContain('Validation failed');
    expect(firstChild.textContent).toContain('API rate limit exceeded');
  });

  it('should show the error message text', () => {
    mockValidationState.queue = [{ issueNumber: 7, status: 'failed' }];
    mockValidationState.errors = 'Something went wrong';

    render(<ValidationPanel />);

    expect(screen.queryByText('Validation failed')).not.toBeNull();
    expect(screen.queryByText('Something went wrong')).not.toBeNull();
  });

  it('should show retry button in error state', () => {
    mockValidationState.queue = [{ issueNumber: 7, status: 'failed' }];
    mockValidationState.errors = 'Connection timeout';

    render(<ValidationPanel />);

    expect(screen.queryByText('Retry')).not.toBeNull();
  });

  it('should not render error alert when there is no error', () => {
    mockValidationState.queue = [{ issueNumber: 7, status: 'idle' }];

    render(<ValidationPanel />);

    const contentArea = screen.getByTestId('validation-content');
    expect(contentArea.textContent).not.toContain('Validation failed');
  });

  it('should not render error alert while running even if error exists', () => {
    mockValidationState.queue = [{ issueNumber: 7, status: 'running' }];
    mockValidationState.errors = 'Previous error';

    render(<ValidationPanel />);

    const contentArea = screen.getByTestId('validation-content');
    expect(contentArea.textContent).not.toContain('Validation failed');
  });

  it('should show placeholder when no issue is selected', () => {
    mockIssueState.selectedIssueNumber = null;

    render(<ValidationPanel />);

    expect(screen.queryByText('Select an issue to validate')).not.toBeNull();
  });

  describe('re-validate confirmation dialog', () => {
    const mockResult = {
      issueType: 'bug',
      verdict: 'confirmed',
      confidence: 90,
      affectedFiles: [],
      complexity: 'medium',
      suggestedApproach: 'Fix the bug',
      reasoning: 'Test reasoning',
      issueNumber: 7,
      issueTitle: 'Test issue',
      repositoryFullName: 'test/repo',
      validatedAt: '2025-01-01T00:00:00Z',
      providerType: 'claude-code',
      model: 'claude-sonnet-4-5-20250929',
      costUsd: 0.01,
      durationMs: 1000,
    };

    it('should show confirmation dialog when clicking Re-validate with existing results', () => {
      mockValidationState.queue = [{ issueNumber: 7, status: 'completed' }];
      mockValidationState.results = mockResult;

      render(<ValidationPanel />);

      fireEvent.click(screen.getByRole('button', { name: /Re-validate/ }));

      expect(screen.queryByText('Discard current validation?')).not.toBeNull();
      expect(mockStartValidation).not.toHaveBeenCalled();
    });

    it('should start validation directly when clicking Validate with no results', () => {
      render(<ValidationPanel />);

      fireEvent.click(screen.getByRole('button', { name: /Validate/ }));

      expect(screen.queryByText('Discard current validation?')).toBeNull();
      expect(mockStartValidation).toHaveBeenCalledWith(7);
    });

    it('should start validation when confirming the dialog', () => {
      mockValidationState.queue = [{ issueNumber: 7, status: 'completed' }];
      mockValidationState.results = mockResult;

      render(<ValidationPanel />);

      fireEvent.click(screen.getByRole('button', { name: /Re-validate/ }));
      fireEvent.click(screen.getByText('Discard & Re-validate'));

      expect(mockStartValidation).toHaveBeenCalledWith(7);
    });

    it('should not start validation when cancelling the dialog', () => {
      mockValidationState.queue = [{ issueNumber: 7, status: 'completed' }];
      mockValidationState.results = mockResult;

      render(<ValidationPanel />);

      fireEvent.click(screen.getByRole('button', { name: /Re-validate/ }));
      fireEvent.click(screen.getByText('Cancel'));

      expect(mockStartValidation).not.toHaveBeenCalled();
    });

    it('should not show confirmation for Retry button in error state', () => {
      mockValidationState.queue = [{ issueNumber: 7, status: 'failed' }];
      mockValidationState.errors = 'Something went wrong';

      render(<ValidationPanel />);

      fireEvent.click(screen.getByText('Retry'));

      expect(screen.queryByText('Discard current validation?')).toBeNull();
      expect(mockStartValidation).toHaveBeenCalledWith(7);
    });
  });
});
