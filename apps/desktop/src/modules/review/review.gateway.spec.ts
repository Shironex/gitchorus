import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { Server, Socket } from 'socket.io';
import { ReviewGateway } from './review.gateway';
import { ReviewService } from './review.service';
import { ReviewHistoryService } from './review-history.service';
import { ReviewLogService } from './review-log.service';

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function createMockSocket(id = 'client-1'): Socket {
  return {
    id,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    broadcast: { emit: jest.fn() },
  } as unknown as Socket;
}

function createMockServer(): Server {
  const toEmit = jest.fn();
  const server = {
    emit: jest.fn(),
    to: jest.fn().mockReturnValue({ emit: toEmit }),
  } as unknown as Server;
  return server;
}

// ---------------------------------------------------------------------------
// Service mocks
// ---------------------------------------------------------------------------

const mockReviewService = {
  queueReview: jest.fn(),
  queueReReview: jest.fn(),
  cancelReview: jest.fn(),
  getQueue: jest.fn(),
};

const mockHistoryService = {
  list: jest.fn(),
  getLatestForPR: jest.fn(),
  getById: jest.fn(),
  getReviewChain: jest.fn(),
  delete: jest.fn(),
  save: jest.fn(),
  clear: jest.fn(),
};

const mockLogService = {
  getLogEntries: jest.fn(),
  getLogTransport: jest.fn().mockReturnValue(() => {}),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewGateway', () => {
  let gateway: ReviewGateway;
  let server: Server;
  let client: Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([])],
      providers: [
        ReviewGateway,
        { provide: ReviewService, useValue: mockReviewService },
        { provide: ReviewHistoryService, useValue: mockHistoryService },
        { provide: ReviewLogService, useValue: mockLogService },
      ],
    }).compile();

    gateway = module.get<ReviewGateway>(ReviewGateway);
    server = createMockServer();
    gateway.server = server;
    client = createMockSocket();
  });

  // ========================================================================
  // review:start
  // ========================================================================

  describe('handleStart', () => {
    it('should queue a review and return success', () => {
      const result = gateway.handleStart(client, {
        projectPath: '/repo',
        prNumber: 42,
      });

      expect(mockReviewService.queueReview).toHaveBeenCalledWith(42, '/repo');
      expect(result).toEqual({ success: true });
    });

    it('should return error when projectPath is missing', () => {
      const result = gateway.handleStart(client, {
        projectPath: '',
        prNumber: 42,
      });

      expect(result).toEqual({
        success: false,
        error: 'projectPath and prNumber are required',
      });
      expect(mockReviewService.queueReview).not.toHaveBeenCalled();
    });

    it('should return error when prNumber is missing', () => {
      const result = gateway.handleStart(client, {
        projectPath: '/repo',
        prNumber: 0,
      });

      expect(result).toEqual({
        success: false,
        error: 'projectPath and prNumber are required',
      });
    });

    it('should return error when service throws', () => {
      mockReviewService.queueReview.mockImplementationOnce(() => {
        throw new Error('queue full');
      });

      const result = gateway.handleStart(client, {
        projectPath: '/repo',
        prNumber: 42,
      });

      expect(result).toEqual({ success: false, error: 'queue full' });
    });
  });

  // ========================================================================
  // review:re-review-start
  // ========================================================================

  describe('handleReReviewStart', () => {
    it('should queue a re-review and return success', () => {
      const result = gateway.handleReReviewStart(client, {
        projectPath: '/repo',
        prNumber: 42,
        previousReviewId: 'rh-42-abc',
      });

      expect(mockReviewService.queueReReview).toHaveBeenCalledWith(42, '/repo', 'rh-42-abc');
      expect(result).toEqual({ success: true });
    });

    it('should return error when projectPath is missing', () => {
      const result = gateway.handleReReviewStart(client, {
        projectPath: '',
        prNumber: 42,
        previousReviewId: 'rh-42-abc',
      });

      expect(result).toEqual({
        success: false,
        error: 'projectPath, prNumber, and previousReviewId are required',
      });
      expect(mockReviewService.queueReReview).not.toHaveBeenCalled();
    });

    it('should return error when prNumber is missing', () => {
      const result = gateway.handleReReviewStart(client, {
        projectPath: '/repo',
        prNumber: 0,
        previousReviewId: 'rh-42-abc',
      });

      expect(result).toEqual({
        success: false,
        error: 'projectPath, prNumber, and previousReviewId are required',
      });
    });

    it('should return error when previousReviewId is missing', () => {
      const result = gateway.handleReReviewStart(client, {
        projectPath: '/repo',
        prNumber: 42,
        previousReviewId: '',
      });

      expect(result).toEqual({
        success: false,
        error: 'projectPath, prNumber, and previousReviewId are required',
      });
    });

    it('should return error when service throws', () => {
      mockReviewService.queueReReview.mockImplementationOnce(() => {
        throw new Error('previous review not found');
      });

      const result = gateway.handleReReviewStart(client, {
        projectPath: '/repo',
        prNumber: 42,
        previousReviewId: 'rh-42-abc',
      });

      expect(result).toEqual({ success: false, error: 'previous review not found' });
    });
  });

  // ========================================================================
  // review:cancel
  // ========================================================================

  describe('handleCancel', () => {
    it('should cancel review and return success', () => {
      const result = gateway.handleCancel(client, { prNumber: 42 });

      expect(mockReviewService.cancelReview).toHaveBeenCalledWith(42);
      expect(result).toEqual({ success: true });
    });

    it('should return error when prNumber is missing', () => {
      const result = gateway.handleCancel(client, { prNumber: 0 });

      expect(result).toEqual({
        success: false,
        error: 'prNumber is required',
      });
    });

    it('should return error when service throws', () => {
      mockReviewService.cancelReview.mockImplementationOnce(() => {
        throw new Error('cancel failed');
      });

      const result = gateway.handleCancel(client, { prNumber: 42 });

      expect(result).toEqual({ success: false, error: 'cancel failed' });
    });
  });

  // ========================================================================
  // review:history-list
  // ========================================================================

  describe('handleHistoryList', () => {
    it('should return history entries on success', () => {
      const entries = [{ id: 'rh-1', prNumber: 1 }];
      mockHistoryService.list.mockReturnValue(entries);

      const result = gateway.handleHistoryList(client, {
        repositoryFullName: 'user/repo',
        limit: 10,
      });

      expect(mockHistoryService.list).toHaveBeenCalledWith({
        repositoryFullName: 'user/repo',
        limit: 10,
      });
      expect(result).toEqual({ entries });
    });

    it('should return error when repositoryFullName is missing', () => {
      const result = gateway.handleHistoryList(client, {
        repositoryFullName: '',
      });

      expect(result).toEqual({
        entries: [],
        error: 'repositoryFullName is required',
      });
    });

    it('should return error when service throws', () => {
      mockHistoryService.list.mockImplementationOnce(() => {
        throw new Error('store corrupt');
      });

      const result = gateway.handleHistoryList(client, {
        repositoryFullName: 'user/repo',
      });

      expect(result).toEqual({ entries: [], error: 'store corrupt' });
    });
  });

  // ========================================================================
  // review:history-get
  // ========================================================================

  describe('handleHistoryGet', () => {
    it('should return the latest entry for a PR', () => {
      const entry = { id: 'rh-1', prNumber: 5 };
      mockHistoryService.getLatestForPR.mockReturnValue(entry);

      const result = gateway.handleHistoryGet(client, {
        repositoryFullName: 'user/repo',
        prNumber: 5,
      });

      expect(mockHistoryService.getLatestForPR).toHaveBeenCalledWith('user/repo', 5);
      expect(result).toEqual({ entry });
    });

    it('should return error when repositoryFullName is missing', () => {
      const result = gateway.handleHistoryGet(client, {
        repositoryFullName: '',
        prNumber: 5,
      });

      expect(result).toEqual({
        entry: null,
        error: 'repositoryFullName and prNumber are required',
      });
    });

    it('should return error when prNumber is missing', () => {
      const result = gateway.handleHistoryGet(client, {
        repositoryFullName: 'user/repo',
        prNumber: 0,
      });

      expect(result).toEqual({
        entry: null,
        error: 'repositoryFullName and prNumber are required',
      });
    });

    it('should return error when service throws', () => {
      mockHistoryService.getLatestForPR.mockImplementationOnce(() => {
        throw new Error('lookup failed');
      });

      const result = gateway.handleHistoryGet(client, {
        repositoryFullName: 'user/repo',
        prNumber: 5,
      });

      expect(result).toEqual({ entry: null, error: 'lookup failed' });
    });
  });

  // ========================================================================
  // review:history-delete
  // ========================================================================

  describe('handleHistoryDelete', () => {
    it('should delete entry and return success', () => {
      mockHistoryService.delete.mockReturnValue(true);

      const result = gateway.handleHistoryDelete(client, { id: 'rh-1' });

      expect(mockHistoryService.delete).toHaveBeenCalledWith('rh-1');
      expect(result).toEqual({ success: true, error: undefined });
    });

    it('should return not found when entry does not exist', () => {
      mockHistoryService.delete.mockReturnValue(false);

      const result = gateway.handleHistoryDelete(client, { id: 'nonexistent' });

      expect(result).toEqual({ success: false, error: 'Entry not found' });
    });

    it('should return error when id is missing', () => {
      const result = gateway.handleHistoryDelete(client, { id: '' });

      expect(result).toEqual({ success: false, error: 'id is required' });
    });

    it('should return error when service throws', () => {
      mockHistoryService.delete.mockImplementationOnce(() => {
        throw new Error('delete failed');
      });

      const result = gateway.handleHistoryDelete(client, { id: 'rh-1' });

      expect(result).toEqual({ success: false, error: 'delete failed' });
    });
  });

  // ========================================================================
  // review:chain
  // ========================================================================

  describe('handleChain', () => {
    it('should return review chain for a PR', () => {
      const chain = [
        { id: 'rh-1', prNumber: 10, reviewedAt: '2024-01-01' },
        { id: 'rh-2', prNumber: 10, reviewedAt: '2024-01-02' },
      ];
      mockHistoryService.getReviewChain.mockReturnValue(chain);

      const result = gateway.handleChain(client, {
        repositoryFullName: 'user/repo',
        prNumber: 10,
      });

      expect(mockHistoryService.getReviewChain).toHaveBeenCalledWith('user/repo', 10);
      expect(result).toEqual({ chain });
    });

    it('should return error when repositoryFullName is missing', () => {
      const result = gateway.handleChain(client, {
        repositoryFullName: '',
        prNumber: 10,
      });

      expect(result).toEqual({
        chain: [],
        error: 'repositoryFullName and prNumber are required',
      });
    });

    it('should return error when prNumber is missing', () => {
      const result = gateway.handleChain(client, {
        repositoryFullName: 'user/repo',
        prNumber: 0,
      });

      expect(result).toEqual({
        chain: [],
        error: 'repositoryFullName and prNumber are required',
      });
    });

    it('should return error when service throws', () => {
      mockHistoryService.getReviewChain.mockImplementationOnce(() => {
        throw new Error('chain failed');
      });

      const result = gateway.handleChain(client, {
        repositoryFullName: 'user/repo',
        prNumber: 10,
      });

      expect(result).toEqual({ chain: [], error: 'chain failed' });
    });
  });

  // ========================================================================
  // review:log-entries
  // ========================================================================

  describe('handleLogEntries', () => {
    it('should return log entries on success', async () => {
      const entries = [{ timestamp: '2024-01-01', message: 'Started review' }];
      mockLogService.getLogEntries.mockResolvedValue(entries);

      const result = await gateway.handleLogEntries(client, { limit: 50 });

      expect(mockLogService.getLogEntries).toHaveBeenCalledWith(50);
      expect(result).toEqual({ entries });
    });

    it('should return empty entries on error', async () => {
      mockLogService.getLogEntries.mockRejectedValue(new Error('read failed'));

      const result = await gateway.handleLogEntries(client, {});

      expect(result).toEqual({ entries: [], error: 'read failed' });
    });
  });

  // ========================================================================
  // EventEmitter2 -> WebSocket broadcasts
  // ========================================================================

  describe('event broadcasts', () => {
    it('should broadcast progress events', () => {
      const data = { prNumber: 42, step: { step: '1', message: 'Analyzing...' } };

      gateway.onProgress(data);

      expect(server.emit).toHaveBeenCalledWith('review:progress', data);
    });

    it('should broadcast complete events', () => {
      const data = { prNumber: 42, result: { verdict: 'Looks good' } };

      gateway.onComplete(data);

      expect(server.emit).toHaveBeenCalledWith('review:complete', data);
    });

    it('should broadcast error events', () => {
      const data = { prNumber: 42, error: 'Provider failed' };

      gateway.onError(data);

      expect(server.emit).toHaveBeenCalledWith('review:error', data);
    });

    it('should broadcast queue update events', () => {
      const data = { queue: [{ prNumber: 42, status: 'running' }] };

      gateway.onQueueUpdate(data);

      expect(server.emit).toHaveBeenCalledWith('review:queue-update', data);
    });
  });
});
