-- 02_create_matview.sql
DROP MATERIALIZED VIEW IF EXISTS public.latest_measurement_per_city;

CREATE MATERIALIZED VIEW public.latest_measurement_per_city
AS
SELECT DISTINCT ON (m.city_id)
  m.city_id,
  m.ts,
  m.temperature_c,
  m.humidity,
  m.wind_speed,
  m.aqi,
  m.us_aqi,
  m.european_aqi,
  m.pm2_5,
  m.pm10,
  m.raw_json,
  m.created_at
FROM public.measurements_hourly m
ORDER BY m.city_id, m.ts ASC
WITH NO DATA;  -- create empty structure first (safer in init)

-- Populate it now (non-concurrent during init)
REFRESH MATERIALIZED VIEW public.latest_measurement_per_city;

-- create unique index required to use REFRESH MATERIALIZED VIEW CONCURRENTLY later
CREATE UNIQUE INDEX IF NOT EXISTS idx_latest_measurement_city
  ON public.latest_measurement_per_city (city_id);

-- supporting index for fast ordering queries
CREATE INDEX IF NOT EXISTS idx_measurements_hourly_city_ts_desc
  ON public.measurements_hourly (city_id, ts DESC);
