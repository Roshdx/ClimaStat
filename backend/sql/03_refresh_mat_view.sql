-- 05_refresh_mat_view.sql
-- Refresh the materialized view concurrently (non-blocking)
-- Requires the unique index created in 04_create_mat_view.sql

REFRESH MATERIALIZED VIEW CONCURRENTLY latest_measurement_per_city;
