import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsGateway } from './settings.gateway';

/**
 * NestJS module for settings management.
 *
 * Provides SettingsService for reading/writing review configuration
 * and SettingsGateway for WebSocket communication with clients.
 * Exports SettingsService so other modules can inject it.
 */
@Module({
  providers: [SettingsService, SettingsGateway],
  exports: [SettingsService],
})
export class SettingsModule {}
