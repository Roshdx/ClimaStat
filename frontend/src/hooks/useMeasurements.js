// src/hooks/useMeasurements.js
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLatestPerCity, getHourlyForCity, getCities, triggerFetchCity } from '../lib/api';

export function useCities() {
  return useQuery(['cities'], getCities, { staleTime: 1000 * 60 * 5 });
}

export function useLatestAll() {
  // latest per city: used for KPI cards and list
  return useQuery(['latest'], getLatestPerCity, { staleTime: 1000 * 60 * 1, refetchInterval: 60 * 1000 });
}

export function useHourly(cityId, hours = 72) {
  return useQuery(['hourly', cityId, hours], () => getHourlyForCity(cityId, hours), {
    enabled: !!cityId,
    staleTime: 1000 * 30,
    refetchInterval: 2 * 60 * 1000 // poll every 2 min (optional)
  });
}

export function useTriggerFetch() {
  const qc = useQueryClient();
  return async (cityId) => {
    await triggerFetchCity(cityId);
    // refresh latest + hourly after trigger
    qc.invalidateQueries(['latest']);
    qc.invalidateQueries(['hourly', cityId]);
  };
}
