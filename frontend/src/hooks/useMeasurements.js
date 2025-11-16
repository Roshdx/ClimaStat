// src/hooks/useMeasurements.js
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLatestPerCity, getHourlyForCity, getCities, triggerFetchCity } from '../lib/api';

/**
 * NOTE: React Query v5 requires the object-style signature:
 * useQuery({ queryKey: [...], queryFn: fn, ... })
 */

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: getCities,
    staleTime: 1000 * 60 * 5,
    // keep previous data to avoid UI jank when refetching
    keepPreviousData: true,
    initialData: [],
  });
}

export function useLatestAll() {
  return useQuery({
    queryKey: ['latest'],
    queryFn: getLatestPerCity,
    staleTime: 1000 * 60 * 1,
    refetchInterval: 60 * 1000,
    initialData: [],
  });
}

/** hourly for a given city */
export function useHourly(cityId, hours = 72) {
  return useQuery({
    queryKey: ['hourly', cityId, hours],
    queryFn: () => getHourlyForCity(cityId, hours),
    enabled: !!cityId,
    staleTime: 1000 * 30,
    refetchInterval: 2 * 60 * 1000,
    initialData: [],
  });
}

export function useTriggerFetch() {
  const qc = useQueryClient();
  return async (cityId) => {
    if (!cityId) return;
    await triggerFetchCity(cityId);
    // invalidate to refresh data
    qc.invalidateQueries({ queryKey: ['latest'] });
    qc.invalidateQueries({ queryKey: ['hourly', cityId] });
  };
}
