import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { emitAsync } from '@/lib/socketHelpers';
import { useConnectionStore } from '@/stores/useConnectionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  DEFAULT_CODEX_MODEL_OPTIONS,
  SettingsEvents,
  createLogger,
  type CodexModelOption,
  type ReviewConfig,
  type SettingsGetPayload,
  type SettingsGetResponse,
  type SettingsModelsPayload,
  type SettingsModelsResponse,
  type SettingsUpdatePayload,
  type SettingsUpdateResponse,
} from '@gitchorus/shared';

const logger = createLogger('useSettings');

/**
 * Hook for fetching and updating review settings via WebSocket.
 *
 * Fetches config on first call, listens for external changes,
 * and provides updateConfig for auto-save behavior.
 */
export function useSettings() {
  const socketInitialized = useConnectionStore(state => state.socketInitialized);
  const config = useSettingsStore(state => state.reviewConfig);
  const loading = useSettingsStore(state => state.isReviewConfigLoading);
  const setReviewConfig = useSettingsStore(state => state.setReviewConfig);
  const setReviewConfigLoading = useSettingsStore(state => state.setReviewConfigLoading);
  const fetchedRef = useRef(false);
  const fetchedModelsRef = useRef(false);
  const [models, setModels] = useState<CodexModelOption[]>(DEFAULT_CODEX_MODEL_OPTIONS);
  const [modelsLoading, setModelsLoading] = useState(false);

  const fetchConfig = useCallback(async () => {
    setReviewConfigLoading(true);
    try {
      const response = await emitAsync<SettingsGetPayload, SettingsGetResponse>(
        SettingsEvents.GET,
        {}
      );
      if (response.error) {
        logger.error('Error fetching settings:', response.error);
      }
      setReviewConfig(response.config);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch settings';
      logger.error('Failed to fetch settings:', message);
      setReviewConfigLoading(false);
    }
  }, [setReviewConfig, setReviewConfigLoading]);

  const updateConfig = useCallback(
    async (partial: Partial<ReviewConfig>) => {
      try {
        const response = await emitAsync<SettingsUpdatePayload, SettingsUpdateResponse>(
          SettingsEvents.UPDATE,
          { config: partial }
        );
        if (response.error) {
          logger.error('Error updating settings:', response.error);
        }
        setReviewConfig(response.config);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update settings';
        logger.error('Failed to update settings:', message);
      }
    },
    [setReviewConfig]
  );

  const fetchModels = useCallback(async (refresh = false) => {
    setModelsLoading(true);
    try {
      const response = await emitAsync<SettingsModelsPayload, SettingsModelsResponse>(
        SettingsEvents.MODELS,
        { refresh }
      );
      if (response.error) {
        logger.error('Error fetching model list:', response.error);
      }
      if (Array.isArray(response.models) && response.models.length > 0) {
        setModels(response.models);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch model list';
      logger.error('Failed to fetch model list:', message);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  // Fetch config on first mount (after socket is ready)
  useEffect(() => {
    if (!socketInitialized) return;
    if (!fetchedRef.current && !config) {
      fetchedRef.current = true;
      fetchConfig();
    }
  }, [socketInitialized, config, fetchConfig]);

  // Fetch available models on first mount (after socket is ready)
  useEffect(() => {
    if (!socketInitialized) return;
    if (!fetchedModelsRef.current) {
      fetchedModelsRef.current = true;
      fetchModels();
    }
  }, [socketInitialized, fetchModels]);

  // Listen for external changes (after socket is ready)
  useEffect(() => {
    if (!socketInitialized) return;

    const socket = getSocket();
    const onChanged = (data: { config: ReviewConfig }) => {
      logger.debug('Settings changed externally');
      setReviewConfig(data.config);
    };

    socket.on(SettingsEvents.CHANGED, onChanged);
    return () => {
      socket.off(SettingsEvents.CHANGED, onChanged);
    };
  }, [socketInitialized, setReviewConfig]);

  return { config, loading, models, modelsLoading, fetchConfig, fetchModels, updateConfig };
}
