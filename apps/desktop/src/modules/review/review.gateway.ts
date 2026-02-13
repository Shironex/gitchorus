import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import { WsThrottlerGuard } from '../shared/ws-throttler.guard';
import {
  ReviewEvents,
  createLogger,
  extractErrorMessage,
  type ReviewStartPayload,
  type ReviewCancelPayload,
  type ReviewProgressResponse,
  type ReviewCompleteResponse,
  type ReviewErrorResponse,
  type ReviewQueueUpdateResponse,
  type ReviewHistoryListPayload,
  type ReviewHistoryListResponse,
  type ReviewHistoryGetPayload,
  type ReviewHistoryGetResponse,
  type ReviewHistoryDeletePayload,
  type ReviewLogEntriesPayload,
  type ReviewLogEntriesResponse,
} from '@gitchorus/shared';
import { CORS_CONFIG } from '../shared/cors.config';
import { ReviewService, InternalReviewEvents } from './review.service';
import { ReviewHistoryService } from './review-history.service';
import { ReviewLogService } from './review-log.service';

/**
 * WebSocket gateway for review events.
 *
 * Handles start/cancel requests from clients and broadcasts
 * progress, completion, error, and queue updates to all connected clients.
 */
@UseGuards(WsThrottlerGuard)
@WebSocketGateway({
  cors: CORS_CONFIG,
})
export class ReviewGateway implements OnGatewayInit {
  private readonly logger = createLogger('ReviewGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly reviewService: ReviewService,
    private readonly historyService: ReviewHistoryService,
    private readonly logService: ReviewLogService
  ) {}

  afterInit(): void {
    this.logger.log('Initialized');
  }

  /**
   * Handle review start request.
   */
  @SubscribeMessage(ReviewEvents.START)
  handleStart(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ReviewStartPayload
  ): { success: boolean; error?: string } {
    try {
      const { projectPath, prNumber } = payload;

      if (!projectPath || !prNumber) {
        return { success: false, error: 'projectPath and prNumber are required' };
      }

      this.reviewService.queueReview(prNumber, projectPath);

      return { success: true };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error starting review: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Handle review cancel request.
   */
  @SubscribeMessage(ReviewEvents.CANCEL)
  handleCancel(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ReviewCancelPayload
  ): { success: boolean; error?: string } {
    try {
      const { prNumber } = payload;

      if (!prNumber) {
        return { success: false, error: 'prNumber is required' };
      }

      this.reviewService.cancelReview(prNumber);

      return { success: true };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error cancelling review: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================================
  // History handlers
  // ============================================

  /**
   * Handle request to list review history for a repository.
   */
  @SubscribeMessage(ReviewEvents.HISTORY_LIST)
  handleHistoryList(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ReviewHistoryListPayload
  ): ReviewHistoryListResponse {
    try {
      const { repositoryFullName, limit } = payload;

      if (!repositoryFullName) {
        return { entries: [], error: 'repositoryFullName is required' };
      }

      const entries = this.historyService.list({ repositoryFullName, limit });
      return { entries };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error listing review history: ${message}`);
      return { entries: [], error: message };
    }
  }

  /**
   * Handle request to get the latest review for a specific PR.
   */
  @SubscribeMessage(ReviewEvents.HISTORY_GET)
  handleHistoryGet(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ReviewHistoryGetPayload
  ): ReviewHistoryGetResponse {
    try {
      const { repositoryFullName, prNumber } = payload;

      if (!repositoryFullName || !prNumber) {
        return { entry: null, error: 'repositoryFullName and prNumber are required' };
      }

      const entry = this.historyService.getLatestForPR(repositoryFullName, prNumber);
      return { entry };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error getting review history entry: ${message}`);
      return { entry: null, error: message };
    }
  }

  /**
   * Handle request to delete a review history entry.
   */
  @SubscribeMessage(ReviewEvents.HISTORY_DELETE)
  handleHistoryDelete(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ReviewHistoryDeletePayload
  ): { success: boolean; error?: string } {
    try {
      const { id } = payload;

      if (!id) {
        return { success: false, error: 'id is required' };
      }

      const deleted = this.historyService.delete(id);
      return { success: deleted, error: deleted ? undefined : 'Entry not found' };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error deleting review history entry: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================================
  // Log handlers
  // ============================================

  /**
   * Handle request to get recent review log entries.
   */
  @SubscribeMessage(ReviewEvents.LOG_ENTRIES)
  async handleLogEntries(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ReviewLogEntriesPayload
  ): Promise<ReviewLogEntriesResponse> {
    try {
      const entries = await this.logService.getLogEntries(payload?.limit);
      return { entries };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error fetching log entries: ${message}`);
      return { entries: [], error: message };
    }
  }

  // ============================================
  // EventEmitter2 listeners -> WebSocket broadcasts
  // ============================================

  @OnEvent(InternalReviewEvents.PROGRESS)
  onProgress(data: ReviewProgressResponse): void {
    this.server.emit(ReviewEvents.PROGRESS, data);
  }

  @OnEvent(InternalReviewEvents.COMPLETE)
  onComplete(data: ReviewCompleteResponse): void {
    this.server.emit(ReviewEvents.COMPLETE, data);
  }

  @OnEvent(InternalReviewEvents.ERROR)
  onError(data: ReviewErrorResponse): void {
    this.server.emit(ReviewEvents.ERROR, data);
  }

  @OnEvent(InternalReviewEvents.QUEUE_UPDATE)
  onQueueUpdate(data: ReviewQueueUpdateResponse): void {
    this.server.emit(ReviewEvents.QUEUE_UPDATE, data);
  }
}
