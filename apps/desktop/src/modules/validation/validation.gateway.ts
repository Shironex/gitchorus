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
  ValidationEvents,
  createLogger,
  extractErrorMessage,
  type ValidationStartPayload,
  type ValidationCancelPayload,
  type ValidationProgressResponse,
  type ValidationCompleteResponse,
  type ValidationErrorResponse,
  type ValidationQueueUpdateResponse,
  type ValidationHistoryListPayload,
  type ValidationHistoryListResponse,
  type ValidationHistoryGetPayload,
  type ValidationHistoryGetResponse,
  type ValidationHistoryDeletePayload,
} from '@gitchorus/shared';
import { CORS_CONFIG } from '../shared/cors.config';
import { ValidationService, InternalValidationEvents } from './validation.service';
import { ValidationHistoryService } from './validation-history.service';

/**
 * WebSocket gateway for validation events.
 *
 * Handles start/cancel requests from clients and broadcasts
 * progress, completion, error, and queue updates to all connected clients.
 */
@UseGuards(WsThrottlerGuard)
@WebSocketGateway({
  cors: CORS_CONFIG,
})
export class ValidationGateway implements OnGatewayInit {
  private readonly logger = createLogger('ValidationGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly validationService: ValidationService,
    private readonly historyService: ValidationHistoryService
  ) {}

  afterInit(): void {
    this.logger.log('Initialized');
  }

  /**
   * Handle validation start request.
   */
  @SubscribeMessage(ValidationEvents.START)
  handleStart(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ValidationStartPayload
  ): { success: boolean; error?: string } {
    try {
      const { projectPath, issueNumber } = payload;

      if (!projectPath || !issueNumber) {
        return { success: false, error: 'projectPath and issueNumber are required' };
      }

      this.validationService.queueValidation(issueNumber, projectPath);

      return { success: true };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error starting validation: ${message}`);
      return { success: false, error: message };
    }
  }

  /**
   * Handle validation cancel request.
   */
  @SubscribeMessage(ValidationEvents.CANCEL)
  handleCancel(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ValidationCancelPayload
  ): { success: boolean; error?: string } {
    try {
      const { issueNumber } = payload;

      if (!issueNumber) {
        return { success: false, error: 'issueNumber is required' };
      }

      this.validationService.cancelValidation(issueNumber);

      return { success: true };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error cancelling validation: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================================
  // History handlers
  // ============================================

  /**
   * Handle request to list validation history for a repository.
   */
  @SubscribeMessage(ValidationEvents.HISTORY_LIST)
  handleHistoryList(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ValidationHistoryListPayload
  ): ValidationHistoryListResponse {
    try {
      const { repositoryFullName, limit } = payload;

      if (!repositoryFullName) {
        return { entries: [], error: 'repositoryFullName is required' };
      }

      const entries = this.historyService.list({ repositoryFullName, limit });
      return { entries };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error listing history: ${message}`);
      return { entries: [], error: message };
    }
  }

  /**
   * Handle request to get the latest validation for a specific issue.
   */
  @SubscribeMessage(ValidationEvents.HISTORY_GET)
  handleHistoryGet(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ValidationHistoryGetPayload
  ): ValidationHistoryGetResponse {
    try {
      const { repositoryFullName, issueNumber } = payload;

      if (!repositoryFullName || !issueNumber) {
        return { entry: null, error: 'repositoryFullName and issueNumber are required' };
      }

      const entry = this.historyService.getLatestForIssue(repositoryFullName, issueNumber);
      return { entry };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error getting history entry: ${message}`);
      return { entry: null, error: message };
    }
  }

  /**
   * Handle request to delete a validation history entry.
   */
  @SubscribeMessage(ValidationEvents.HISTORY_DELETE)
  handleHistoryDelete(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: ValidationHistoryDeletePayload
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
      this.logger.error(`Error deleting history entry: ${message}`);
      return { success: false, error: message };
    }
  }

  // ============================================
  // EventEmitter2 listeners -> WebSocket broadcasts
  // ============================================

  @OnEvent(InternalValidationEvents.PROGRESS)
  onProgress(data: ValidationProgressResponse): void {
    this.server.emit(ValidationEvents.PROGRESS, data);
  }

  @OnEvent(InternalValidationEvents.COMPLETE)
  onComplete(data: ValidationCompleteResponse): void {
    this.server.emit(ValidationEvents.COMPLETE, data);
  }

  @OnEvent(InternalValidationEvents.ERROR)
  onError(data: ValidationErrorResponse): void {
    this.server.emit(ValidationEvents.ERROR, data);
  }

  @OnEvent(InternalValidationEvents.QUEUE_UPDATE)
  onQueueUpdate(data: ValidationQueueUpdateResponse): void {
    this.server.emit(ValidationEvents.QUEUE_UPDATE, data);
  }
}
