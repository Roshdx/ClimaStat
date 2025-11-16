-- create_schema.sql
CREATE TABLE IF NOT EXISTS cities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lon DOUBLE PRECISION NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS measurements_hourly (
  id BIGSERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL,
  temperature_c REAL,
  humidity REAL,
  wind_speed REAL,
  aqi INTEGER,
  pm2_5 REAL,
  pm10 REAL,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, ts)
);

CREATE TABLE IF NOT EXISTS measurements_daily (
  id BIGSERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  avg_temp REAL,
  avg_aqi REAL,
  max_aqi INTEGER,
  pm2_5_avg REAL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city_id, day)
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ DEFAULT now(),
  type TEXT,
  severity TEXT,
  message TEXT,
  payload JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_measurements_city_ts ON measurements_hourly (city_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_measurements_ts ON measurements_hourly (ts);
CREATE INDEX IF NOT EXISTS idx_alerts_city_ts ON alerts (city_id, ts DESC);

-- Optional unique index on cities.name to enable ON CONFLICT (name)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cities_name ON cities (name);
