import type { ReviewFinding } from '@gitchorus/shared';

interface ReviewPushModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedFindings: ReviewFinding[];
  verdict: string;
  qualityScore: number;
  reviewAction: 'REQUEST_CHANGES' | 'COMMENT';
  prNumber: number;
}

/**
 * Preview modal showing what will be posted to GitHub as a PR review.
 * Placeholder -- will be implemented in Task 2.
 */
export function ReviewPushModal({ open }: ReviewPushModalProps) {
  if (!open) return null;
  return null;
}
