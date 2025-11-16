-- 06_retention.sql
-- Delete old hourly measurements (keeps last 30 days)
DELETE FROM measurements_hourly
WHERE ts < now() - INTERVAL '30 days';

-- Optionally prune daily table older than 2 years
DELETE FROM measurements_daily
WHERE day < now()::date - INTERVAL '730 days';
