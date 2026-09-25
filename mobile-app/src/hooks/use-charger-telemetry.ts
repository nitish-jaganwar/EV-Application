import {
  CHARGER_POLL_INTERVAL_MS,
  fetchChargerTelemetry,
  POC_CHARGER_ID,
  USE_MOCK_CHARGER,
} from '@/services/chargerApi';
import {
  ChargerTelemetry,
  MOCK_CHARGER_TELEMETRY,
} from '@/services/citrineOsService';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

// EVerest currently publishes periodic transaction meter data about every 120 seconds.
// Allow one full publishing interval plus a safety margin before marking the snapshot stale.
const STALE_AFTER_MS = Math.max(CHARGER_POLL_INTERVAL_MS * 3, 180_000);

export function useChargerTelemetry(chargerId = POC_CHARGER_ID) {
  const [telemetry, setTelemetry] = useState<ChargerTelemetry | null>(
    USE_MOCK_CHARGER ? MOCK_CHARGER_TELEMETRY : null,
  );
  const [isLoading, setIsLoading] = useState(!USE_MOCK_CHARGER);
  const [error, setError] = useState<string | null>(null);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');
  const [freshnessClock, setFreshnessClock] = useState(Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const nextTelemetry = await fetchChargerTelemetry(chargerId, signal);
      setTelemetry(nextTelemetry);
      setError(null);
      setFreshnessClock(Date.now());
    } catch (requestError) {
      if (signal?.aborted) return;
      setError(requestError instanceof Error ? requestError.message : 'Unable to load charger data');
      setFreshnessClock(Date.now());
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [chargerId]);

  useEffect(() => {
    if (!isAppActive || USE_MOCK_CHARGER) return;

    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = setInterval(() => {
      void refresh(controller.signal);
    }, CHARGER_POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [isAppActive, refresh]);

  const lastSeen = telemetry?.lastSeenAt ? Date.parse(telemetry.lastSeenAt) : Number.NaN;
  const isStale = telemetry?.online === false
    || (Number.isFinite(lastSeen) && freshnessClock - lastSeen > STALE_AFTER_MS);

  return {
    telemetry,
    isLoading,
    error,
    isStale,
    isUsingMock: USE_MOCK_CHARGER,
    refresh: () => refresh(),
  };
}
