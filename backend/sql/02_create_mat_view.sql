-- 04_create_mat_view.sql
-- Creates a materialized view with the latest hourly row per city

CREATE MATERIALIZED VIEW IF NOT EXISTS latest_measurement_per_city AS
SELECT DISTINCT ON (m.city_id)
  m.city_id,
  m.ts,
  m.temperature_c,
  m.humidity,
  m.wind_speed,
  m.aqi,
  m.pm2_5,
  m.pm10,
  m.raw_json,
  m.created_at
FROM measurements_hourly m
ORDER BY m.city_id, m.ts DESC;

-- A unique index is required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_latest_measurement_city ON latest_measurement_per_city (city_id);
