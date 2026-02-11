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
} from '@gitchorus/shared';
import { CORS_CONFIG } from '../shared/cors.config';
import { ReviewService, InternalReviewEvents } from './review.service';

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

  constructor(private readonly reviewService: ReviewService) {}

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
