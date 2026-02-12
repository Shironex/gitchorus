import { Injectable } from '@nestjs/common';
import Store from 'electron-store';
import { createLogger } from '@gitchorus/shared';
import type { ReviewConfig } from '@gitchorus/shared';
import { DEFAULT_REVIEW_CONFIG, DEPRECATED_MODEL_MAP } from '@gitchorus/shared';

const logger = createLogger('SettingsService');

/** Store key for review configuration */
const STORE_KEY = 'reviewConfig';

/**
 * Service for persisting review settings using electron-store.
 *
 * Stores review configuration (model, depth, default action, auto-push)
 * that survives app restarts. Merges stored values with defaults to
 * handle config evolution across versions.
 */
@Injectable()
export class SettingsService {
  private readonly store: Store;

  constructor() {
    this.store = new Store();
    logger.info('Initialized with electron-store persistence');
  }

  /**
   * Get the current review configuration.
   * Merges stored values with defaults to handle missing fields from older versions.
   */
  getConfig(): ReviewConfig {
    try {
      const stored = this.store.get(STORE_KEY) as Partial<ReviewConfig> | undefined;
      if (stored && typeof stored === 'object') {
        const config = { ...DEFAULT_REVIEW_CONFIG, ...stored };

        // Migrate deprecated model IDs to current ones
        if (config.model && config.model in DEPRECATED_MODEL_MAP) {
          const oldModel = config.model;
          config.model = DEPRECATED_MODEL_MAP[config.model as string];
          logger.info(`Migrated model ID: ${oldModel} -> ${config.model}`);
          try {
            this.store.set(STORE_KEY, config);
          } catch (writeError) {
            logger.error('Failed to persist migrated config:', writeError);
          }
        }

        return config;
      }
      return { ...DEFAULT_REVIEW_CONFIG };
    } catch (error) {
      logger.error('Failed to read config from store:', error);
      return { ...DEFAULT_REVIEW_CONFIG };
    }
  }

  /**
   * Update review configuration with partial values.
   * Merges the update into the current config and persists.
   */
  updateConfig(partial: Partial<ReviewConfig>): ReviewConfig {
    const current = this.getConfig();
    const updated: ReviewConfig = { ...current, ...partial };
    this.store.set(STORE_KEY, updated);
    logger.info('Updated review config:', JSON.stringify(partial));
    return updated;
  }
}
