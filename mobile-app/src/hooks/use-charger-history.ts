import { useEffect, useState } from 'react';
import { fetchChargerHistory, mergeMeterPoints, pointFromTelemetry, type MeterPoint } from '@/services/chargerHistory';
import { USE_MOCK_CHARGER } from '@/services/chargerApi';
import type { ChargerTelemetry } from '@/services/citrineOsService';

export function useChargerHistory(telemetry: ChargerTelemetry | null) {
  const chargerId = telemetry?.chargerId ?? 'cp001';
  const [points, setPoints] = useState<MeterPoint[]>([]);
  const [isLoading, setIsLoading] = useState(!USE_MOCK_CHARGER);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (USE_MOCK_CHARGER) return;
    const controller = new AbortController();
    setIsLoading(true);
    void fetchChargerHistory(chargerId, controller.signal)
      .then((history) => {
        setPoints((current) => mergeMeterPoints([...history, ...current]));
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'History unavailable');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [chargerId]);

  useEffect(() => {
    const point = pointFromTelemetry(telemetry);
    if (point) setPoints((current) => {
      const previous = current.find((item) => item.timestamp === point.timestamp);
      if (previous && (['powerKw', 'voltageV', 'currentA', 'energyKwh'] as const)
        .every((key) => point[key] === undefined || point[key] === previous[key])) return current;
      return mergeMeterPoints([...current, point]);
    });
  }, [telemetry]);

  return { points, isLoading, error };
}
