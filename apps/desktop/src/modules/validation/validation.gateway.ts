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
} from '@gitchorus/shared';
import { CORS_CONFIG } from '../shared/cors.config';
import { ValidationService, InternalValidationEvents } from './validation.service';

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

  constructor(private readonly validationService: ValidationService) {}

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
