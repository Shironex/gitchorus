import { Test, TestingModule } from '@nestjs/testing';
import { ReviewHistoryService } from './review-history.service';
import type { ReviewResult, ReviewHistoryEntry } from '@gitchorus/shared';

// ---------------------------------------------------------------------------
// Mock electron-store
// ---------------------------------------------------------------------------

const storeData: Record<string, unknown> = {};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn((key: string) => storeData[key]),
    set: jest.fn((key: string, value: unknown) => {
      storeData[key] = value;
    }),
  }));
});

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockResult(overrides: Partial<ReviewResult> = {}): ReviewResult {
  return {
    prNumber: 1,
    prTitle: 'Test PR',
    repositoryFullName: 'user/repo',
    findings: [],
    verdict: 'Looks good',
    qualityScore: 8,
    reviewedAt: new Date().toISOString(),
    providerType: 'claude',
    model: 'claude-sonnet-4-5-20250929',
    costUsd: 0.01,
    durationMs: 5000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewHistoryService', () => {
  let service: ReviewHistoryService;

  beforeEach(async () => {
    // Clear store state before each test
    delete storeData['reviewHistory'];

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewHistoryService],
    }).compile();

    service = module.get<ReviewHistoryService>(ReviewHistoryService);
  });

  // ==================== save ====================

  describe('save', () => {
    it('should save a review result and return entry with generated ID', () => {
      const result = createMockResult({ prNumber: 42 });

      const entry = service.save(result);

      expect(entry.id).toMatch(/^rh-42-/);
      expect(entry.prNumber).toBe(42);
      expect(entry.qualityScore).toBe(8);
    });

    it('should prepend new entries (newest first)', () => {
      const result1 = createMockResult({
        prNumber: 1,
        reviewedAt: '2024-01-01T00:00:00Z',
      });
      const result2 = createMockResult({
        prNumber: 2,
        reviewedAt: '2024-01-02T00:00:00Z',
      });

      service.save(result1);
      service.save(result2);

      const entries = storeData['reviewHistory'] as ReviewHistoryEntry[];
      expect(entries).toHaveLength(2);
      // Newest first (result2 was saved second, so it's prepended)
      expect(entries[0].prNumber).toBe(2);
      expect(entries[1].prNumber).toBe(1);
    });

    it('should cap entries at 500', () => {
      // Pre-fill with 500 entries
      const existing: ReviewHistoryEntry[] = Array.from({ length: 500 }, (_, i) => ({
        ...createMockResult({ prNumber: i }),
        id: `rh-${i}-existing`,
      }));
      storeData['reviewHistory'] = existing;

      // Re-create service to pick up the pre-filled data
      const newResult = createMockResult({ prNumber: 999 });
      service.save(newResult);

      const entries = storeData['reviewHistory'] as ReviewHistoryEntry[];
      expect(entries).toHaveLength(500);
      expect(entries[0].prNumber).toBe(999); // Newest is first
    });
  });

  // ==================== list ====================

  describe('list', () => {
    beforeEach(() => {
      const entries: ReviewHistoryEntry[] = [
        {
          ...createMockResult({
            prNumber: 1,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-01T00:00:00Z',
          }),
          id: 'rh-1',
        },
        {
          ...createMockResult({
            prNumber: 2,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-03T00:00:00Z',
          }),
          id: 'rh-2',
        },
        {
          ...createMockResult({
            prNumber: 3,
            repositoryFullName: 'other/repo',
            reviewedAt: '2024-01-02T00:00:00Z',
          }),
          id: 'rh-3',
        },
      ];
      storeData['reviewHistory'] = entries;
    });

    it('should return all entries sorted by reviewedAt descending', () => {
      const entries = service.list();

      expect(entries).toHaveLength(3);
      expect(entries[0].id).toBe('rh-2'); // Jan 3
      expect(entries[1].id).toBe('rh-3'); // Jan 2
      expect(entries[2].id).toBe('rh-1'); // Jan 1
    });

    it('should filter by repositoryFullName', () => {
      const entries = service.list({ repositoryFullName: 'user/repo' });

      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.repositoryFullName === 'user/repo')).toBe(true);
    });

    it('should filter by prNumber', () => {
      const entries = service.list({ prNumber: 2 });

      expect(entries).toHaveLength(1);
      expect(entries[0].prNumber).toBe(2);
    });

    it('should apply limit', () => {
      const entries = service.list({ limit: 1 });

      expect(entries).toHaveLength(1);
    });

    it('should return empty array when no entries exist', () => {
      delete storeData['reviewHistory'];

      const entries = service.list();

      expect(entries).toEqual([]);
    });
  });

  // ==================== getLatestForPR ====================

  describe('getLatestForPR', () => {
    it('should return the most recent entry for a PR', () => {
      const entries: ReviewHistoryEntry[] = [
        {
          ...createMockResult({
            prNumber: 5,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-01T00:00:00Z',
          }),
          id: 'rh-old',
        },
        {
          ...createMockResult({
            prNumber: 5,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-03T00:00:00Z',
          }),
          id: 'rh-new',
        },
      ];
      storeData['reviewHistory'] = entries;

      const latest = service.getLatestForPR('user/repo', 5);

      expect(latest).not.toBeNull();
      expect(latest!.id).toBe('rh-new');
    });

    it('should return null when no entries match', () => {
      storeData['reviewHistory'] = [];

      const latest = service.getLatestForPR('user/repo', 999);

      expect(latest).toBeNull();
    });
  });

  // ==================== getById ====================

  describe('getById', () => {
    it('should return the entry with matching ID', () => {
      const entries: ReviewHistoryEntry[] = [
        { ...createMockResult({ prNumber: 1 }), id: 'rh-target' },
        { ...createMockResult({ prNumber: 2 }), id: 'rh-other' },
      ];
      storeData['reviewHistory'] = entries;

      const entry = service.getById('rh-target');

      expect(entry).not.toBeNull();
      expect(entry!.id).toBe('rh-target');
      expect(entry!.prNumber).toBe(1);
    });

    it('should return null when ID is not found', () => {
      storeData['reviewHistory'] = [];

      const entry = service.getById('nonexistent');

      expect(entry).toBeNull();
    });

    it('should return null when store is empty', () => {
      delete storeData['reviewHistory'];

      const entry = service.getById('any-id');

      expect(entry).toBeNull();
    });
  });

  // ==================== getReviewChain ====================

  describe('getReviewChain', () => {
    it('should return entries sorted chronologically (oldest first)', () => {
      const entries: ReviewHistoryEntry[] = [
        {
          ...createMockResult({
            prNumber: 10,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-01T00:00:00Z',
          }),
          id: 'rh-first',
        },
        {
          ...createMockResult({
            prNumber: 10,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-03T00:00:00Z',
          }),
          id: 'rh-third',
        },
        {
          ...createMockResult({
            prNumber: 10,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-02T00:00:00Z',
          }),
          id: 'rh-second',
        },
      ];
      storeData['reviewHistory'] = entries;

      const chain = service.getReviewChain('user/repo', 10);

      expect(chain).toHaveLength(3);
      expect(chain[0].id).toBe('rh-first'); // Jan 1 (oldest)
      expect(chain[1].id).toBe('rh-second'); // Jan 2
      expect(chain[2].id).toBe('rh-third'); // Jan 3 (newest)
    });

    it('should filter by repository and PR number', () => {
      const entries: ReviewHistoryEntry[] = [
        {
          ...createMockResult({
            prNumber: 10,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-01T00:00:00Z',
          }),
          id: 'rh-1',
        },
        {
          ...createMockResult({
            prNumber: 20,
            repositoryFullName: 'user/repo',
            reviewedAt: '2024-01-02T00:00:00Z',
          }),
          id: 'rh-2',
        },
        {
          ...createMockResult({
            prNumber: 10,
            repositoryFullName: 'other/repo',
            reviewedAt: '2024-01-03T00:00:00Z',
          }),
          id: 'rh-3',
        },
      ];
      storeData['reviewHistory'] = entries;

      const chain = service.getReviewChain('user/repo', 10);

      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe('rh-1');
    });

    it('should cap results at limit', () => {
      const entries: ReviewHistoryEntry[] = Array.from({ length: 15 }, (_, i) => ({
        ...createMockResult({
          prNumber: 10,
          repositoryFullName: 'user/repo',
          reviewedAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        }),
        id: `rh-${i}`,
      }));
      storeData['reviewHistory'] = entries;

      const chain = service.getReviewChain('user/repo', 10, 5);

      expect(chain).toHaveLength(5);
      // Should keep the most recent 5 from the chronological chain
      expect(chain[0].id).toBe('rh-10');
      expect(chain[4].id).toBe('rh-14');
    });

    it('should return empty array when no entries match', () => {
      storeData['reviewHistory'] = [];

      const chain = service.getReviewChain('user/repo', 99);

      expect(chain).toEqual([]);
    });
  });

  // ==================== delete ====================

  describe('delete', () => {
    it('should delete an entry by ID and return true', () => {
      storeData['reviewHistory'] = [
        { ...createMockResult({ prNumber: 1 }), id: 'rh-delete-me' },
        { ...createMockResult({ prNumber: 2 }), id: 'rh-keep' },
      ];

      const result = service.delete('rh-delete-me');

      expect(result).toBe(true);
      const remaining = storeData['reviewHistory'] as ReviewHistoryEntry[];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('rh-keep');
    });

    it('should return false when entry is not found', () => {
      storeData['reviewHistory'] = [];

      const result = service.delete('nonexistent');

      expect(result).toBe(false);
    });
  });

  // ==================== clear ====================

  describe('clear', () => {
    it('should clear all entries when no repository specified', () => {
      storeData['reviewHistory'] = [
        { ...createMockResult(), id: 'rh-1' },
        { ...createMockResult(), id: 'rh-2' },
      ];

      service.clear();

      const entries = storeData['reviewHistory'] as ReviewHistoryEntry[];
      expect(entries).toEqual([]);
    });

    it('should only clear entries for the specified repository', () => {
      storeData['reviewHistory'] = [
        { ...createMockResult({ repositoryFullName: 'user/repo' }), id: 'rh-1' },
        { ...createMockResult({ repositoryFullName: 'other/repo' }), id: 'rh-2' },
      ];

      service.clear('user/repo');

      const entries = storeData['reviewHistory'] as ReviewHistoryEntry[];
      expect(entries).toHaveLength(1);
      expect(entries[0].repositoryFullName).toBe('other/repo');
    });
  });
});
