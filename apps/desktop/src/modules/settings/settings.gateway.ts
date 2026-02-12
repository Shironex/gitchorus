import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsThrottlerGuard } from '../shared/ws-throttler.guard';
import {
  SettingsEvents,
  createLogger,
  extractErrorMessage,
  type SettingsGetPayload,
  type SettingsGetResponse,
  type SettingsUpdatePayload,
  type SettingsUpdateResponse,
} from '@gitchorus/shared';
import { CORS_CONFIG } from '../shared/cors.config';
import { SettingsService } from './settings.service';

/**
 * WebSocket gateway for settings events.
 *
 * Handles get/update requests from clients and broadcasts
 * settings changes to all connected clients.
 */
@UseGuards(WsThrottlerGuard)
@WebSocketGateway({
  cors: CORS_CONFIG,
})
export class SettingsGateway implements OnGatewayInit {
  private readonly logger = createLogger('SettingsGateway');

  @WebSocketServer()
  server!: Server;

  constructor(private readonly settingsService: SettingsService) {}

  afterInit(): void {
    this.logger.log('Initialized');
  }

  /**
   * Handle settings get request.
   */
  @SubscribeMessage(SettingsEvents.GET)
  handleGet(
    @ConnectedSocket() _client: Socket,
    @MessageBody() _payload: SettingsGetPayload
  ): SettingsGetResponse {
    try {
      const config = this.settingsService.getConfig();
      return { config };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error getting settings: ${message}`);
      return { config: this.settingsService.getConfig(), error: message };
    }
  }

  /**
   * Handle settings update request.
   * Broadcasts the updated config to all clients.
   */
  @SubscribeMessage(SettingsEvents.UPDATE)
  handleUpdate(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: SettingsUpdatePayload
  ): SettingsUpdateResponse {
    try {
      if (!payload.config || typeof payload.config !== 'object') {
        return { config: this.settingsService.getConfig(), error: 'config object is required' };
      }

      const config = this.settingsService.updateConfig(payload.config);

      // Broadcast to all clients
      this.server.emit(SettingsEvents.CHANGED, { config });

      return { config };
    } catch (error) {
      const message = extractErrorMessage(error, 'Unknown error');
      this.logger.error(`Error updating settings: ${message}`);
      return { config: this.settingsService.getConfig(), error: message };
    }
  }
}
