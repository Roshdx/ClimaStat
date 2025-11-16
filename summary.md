# ClimaStat - Project Summary

## Project Overview
ClimaStat is a weather data intelligence dashboard that ingests real-time weather data from the Open-Meteo API and stores it in PostgreSQL. The project currently has a fully functional backend with automated data collection, but **no frontend implementation yet**.

**Author:** Roshit Dahat
**License:** MIT
**Current Status:** Backend complete, Frontend pending

---

## Tech Stack

### Backend
- **Runtime:** Node.js 18
- **Framework:** Express.js 5.1.0
- **Database:** PostgreSQL 15
- **Scheduler:** node-cron 4.2.1
- **HTTP Client:** axios 1.13.2
- **Container:** Docker & Docker Compose
- **Dev Tools:** nodemon 3.1.11

### Frontend
- **Status:** Not implemented yet
- **Planned:** React + Vite, Recharts/Chart.js

---

## Core Features & Code Locations

### 1. Weather Data Fetching
**Description:** Fetches hourly weather data from Open-Meteo API for configured cities

**Code Location:** `backend/services/fetcher.js`

**Key Functions:**
- `fetchForCity(city)` - Main fetch function (lines 31-101)
- `httpGetWithRetry(url, opts, retries)` - HTTP retry logic (lines 19-29)

**API Parameters:**
- Temperature (2m above ground)
- Relative humidity (2m)
- Wind speed (10m)
- Timezone: UTC

**Default Cities:** 20 major Indian cities (Mumbai, Delhi, Bengaluru, etc.)
- Configured in: `backend/scheduler.js:6-27`

---

### 2. Database Schema
**Code Location:** `backend/sql/01_create_schema.sql`

**Tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `cities` | City master list | id, name, lat, lon, active |
| `measurements_hourly` | Hourly weather readings | city_id, ts, temperature_c, humidity, wind_speed, aqi, raw_json |
| `measurements_daily` | Daily aggregated stats | city_id, day, avg_temp, avg_aqi |
| `alerts` | Future alert system | city_id, type, severity, message |

**Unique Constraints:**
- `cities.name` - Prevents duplicate cities
- `measurements_hourly(city_id, ts)` - Prevents duplicate hourly records

**Indexes:**
- `idx_measurements_city_ts` - Query optimization for city+time lookups
- `idx_measurements_ts` - Time-based queries
- `idx_alerts_city_ts` - Alert lookups
- `idx_cities_name` - City name lookups

---

### 3. Materialized View (Performance Optimization)
**Code Location:** `backend/sql/02_create_mat_view.sql`

**View Name:** `latest_measurement_per_city`

**Purpose:** Pre-computed snapshot of latest measurement for each city

**Refresh Strategy:**
- Concurrent refresh every 5 minutes (non-blocking)
- Configured in: `backend/maintenance.js:39-41`

**Benefits:**
- Fast dashboard queries
- Reduces DB load for "current conditions" endpoint

---

### 4. REST API Endpoints
**Code Location:** `backend/routes/cities.js` & `backend/routes/health.js`

**Main Entry Point:** `backend/index.js:15-16`

| Method | Endpoint | Description | Handler Location |
|--------|----------|-------------|------------------|
| GET | `/health` | Health check + DB connectivity | `routes/health.js:7-14` |
| GET | `/api/cities` | List all cities | `routes/cities.js:25-33` |
| POST | `/api/cities` | Add new city | `routes/cities.js:9-22` |
| GET | `/api/cities/latest` | Latest snapshot per city (uses materialized view) | `routes/cities.js:36-53` |
| GET | `/api/cities/:id/hourly` | Hourly data for city (supports limit, from, to params) | `routes/cities.js:56-94` |
| GET | `/api/cities/:id/summary` | Last measurement + 24h stats | `routes/cities.js:97-126` |
| POST | `/api/cities/:id/fetch` | Manual fetch trigger (dev use) | `routes/cities.js:129-140` |

**Query Parameters:**
- `limit` - Number of hourly records (default: 168 = 7 days)
- `from` - ISO datetime for range queries
- `to` - ISO datetime for range queries

---

### 5. Automated Scheduling
**Code Location:** `backend/scheduler.js`

**Schedule Overview:**

| Task | Frequency | Function | Line Reference |
|------|-----------|----------|----------------|
| Initial city sync | On startup | `syncCities()` | Lines 31-74 |
| Initial data fetch | On startup | `initialFetchAll()` | Lines 77-89 |
| Periodic weather fetch | Every 20 minutes | Cron job | Lines 91-106 |
| Materialized view refresh | Every 5 minutes | Cron job | `maintenance.js:39-41` |
| Data retention cleanup | Daily at 03:10 UTC | Cron job | `maintenance.js:34-36` |

**City Synchronization:**
- Compares master list with database
- Inserts new cities
- Updates coordinates if changed
- Soft-deletes removed cities (sets `active=false`)

**Fetch Throttling:**
- 1.2 second delay between cities on initial fetch
- 0.8 second delay on periodic fetch
- Prevents API rate limiting

---

### 6. Data Maintenance
**Code Location:** `backend/maintenance.js`

**Retention Policy:**
- Default: 90 days of hourly data
- Configurable via `retentionDays` parameter
- Prevents unbounded DB growth

**Functions:**
- `runRetention(days)` - Deletes old hourly records (lines 5-12)
- `refreshMaterializedView()` - Updates latest snapshot (lines 14-30)
- `scheduleMaintenance(opts)` - Sets up cron jobs (lines 33-44)

**SQL Files:**
- `backend/sql/03_refresh_mat_view.sql` - Manual refresh script
- `backend/sql/04_retention.sql` - Manual retention script (30 days)

---

### 7. Database Connection
**Code Location:** `backend/db.js`

**Connection Pool:**
- Uses `pg` library connection pooling
- Environment-based configuration
- Optional SSL support for managed databases

**Exports:**
- `query(text, params)` - Simple query execution
- `getClient()` - For transactions
- `pool` - Direct pool access

**Configuration:**
- `DATABASE_URL` - PostgreSQL connection string
- `DB_SSL` - Enable SSL (set to 'true' for production)

---

### 8. Docker Deployment
**Code Locations:**
- `docker-compose.dev.yml` - Development environment
- `backend/Dockerfile.dev` - Backend container definition

**Services:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:15 | 5432 | PostgreSQL database |
| `backend` | Custom (Node 18 Alpine) | 4000 | Express API + Scheduler |
| `adminer` | adminer:latest | 8080 | Database UI tool |

**Key Features:**
- Health checks for DB and backend
- Volume mounting for live reload (nodemon)
- Auto-initialization of SQL schema on first run
- Non-root user for security (`appuser`)

**Environment Variables:** See `.env.example`

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ClimaStat System                        │
└─────────────────────────────────────────────────────────────┘

1. Startup:
   scheduler.js:start()
   → syncCities() → seeds cities table
   → initialFetchAll() → fetches all cities once
   → schedulePeriodicFetch() → sets up cron job

2. Periodic Fetch (Every 20 min):
   Cron trigger
   → fetcher.fetchForCity() for each city
   → axios.get(open-meteo API)
   → Upsert into measurements_hourly table
   → Stores raw JSON + parsed fields

3. Materialized View Refresh (Every 5 min):
   Cron trigger
   → REFRESH MATERIALIZED VIEW latest_measurement_per_city
   → Fast queries for dashboard

4. Data Retention (Daily 03:10 UTC):
   Cron trigger
   → DELETE old records (>90 days)

5. API Queries:
   Client → Express routes
   → DB queries (with materialized view optimization)
   → JSON response
```

---

## File Structure Reference

```
ClimaStat/
│
├── backend/
│   ├── index.js                 # Main Express server entry point
│   ├── db.js                    # PostgreSQL connection pool
│   ├── scheduler.js             # Cron jobs + city sync logic
│   ├── maintenance.js           # Data retention + mat view refresh
│   │
│   ├── routes/
│   │   ├── health.js           # Health check endpoint
│   │   └── cities.js           # All /api/cities/* endpoints
│   │
│   ├── services/
│   │   └── fetcher.js          # Open-Meteo API integration
│   │
│   ├── sql/
│   │   ├── 01_create_schema.sql       # Tables + indexes
│   │   ├── 02_create_mat_view.sql     # Materialized view
│   │   ├── 03_refresh_mat_view.sql    # Manual refresh script
│   │   └── 04_retention.sql           # Manual retention script
│   │
│   ├── Dockerfile.dev          # Development container
│   ├── nodemon.json            # Nodemon configuration
│   ├── package.json            # Dependencies
│   └── .dockerignore
│
├── docker-compose.dev.yml      # Development orchestration
├── .env.example                # Environment variable template
├── .env.dev                    # Development environment (gitignored)
├── .gitignore
└── README.md                   # Project documentation

Frontend: NOT IMPLEMENTED YET
```

---

## Key Design Decisions

### 1. Upsert Strategy
**Location:** `backend/services/fetcher.js:5-15`

Uses `ON CONFLICT (city_id, ts) DO UPDATE` to handle:
- Re-fetching same hourly data (idempotent)
- Updates if API data changes
- Prevents duplicates

### 2. Transaction Safety
**Location:** `backend/services/fetcher.js:56-97`

All hourly inserts wrapped in BEGIN/COMMIT:
- Atomic batch inserts
- Rollback on any error
- Connection pooling with proper release

### 3. Error Handling
**Retry Logic:** `backend/services/fetcher.js:19-29`
- 3 attempts for HTTP requests
- Exponential backoff (1s, 2s, 3s)
- Graceful degradation (logs warning, continues)

### 4. Soft Delete Pattern
**Location:** `backend/scheduler.js:61-69`

Cities marked `active=false` instead of deletion:
- Preserves historical data
- Allows reactivation
- Audit trail

### 5. Materialized View vs Real-time Query
**Trade-off:**
- Mat view: Fast but slightly stale (5 min lag)
- Live query: Always current but slower
- Fallback implemented in `routes/cities.js:43-48`

---

## Missing Features (Not Implemented)

1. **Frontend Application**
   - No UI components
   - No charts/visualizations
   - No user interaction

2. **Air Quality Index (AQI)**
   - Schema supports it (`aqi`, `pm2_5`, `pm10` columns)
   - Not fetched from API yet
   - Would need different API endpoint

3. **Daily Aggregations**
   - `measurements_daily` table exists
   - No aggregation logic implemented

4. **Alerts System**
   - `alerts` table exists
   - No alert triggering logic
   - No notification system

5. **Authentication**
   - No user management
   - API fully open

6. **Production Deployment**
   - Only dev Docker Compose exists
   - No CI/CD pipeline
   - No monitoring/logging setup

---

## Testing

**Status:** No tests implemented

**Commands in package.json:**
- `npm test` - Currently returns error
- `npm run dev` - Runs with nodemon
- `npm start` - Production start (node index.js)

---

## External Dependencies

### APIs
- **Open-Meteo Forecast API**
  - Endpoint: `https://api.open-meteo.com/v1/forecast`
  - Parameters: lat, lon, hourly weather variables
  - Rate limits: Unknown (uses retry logic)
  - Documentation: https://open-meteo.com/

### Database
- **PostgreSQL 15**
  - Features used: JSONB, materialized views, timestamps
  - Extensions: None required

---

## Performance Considerations

1. **Database Indexes**
   - All critical queries indexed
   - `(city_id, ts DESC)` compound index for time-series queries

2. **Connection Pooling**
   - Reuses DB connections via `pg.Pool`
   - Prevents connection exhaustion

3. **Materialized View Caching**
   - Trades freshness for speed on dashboard
   - Concurrent refresh prevents blocking

4. **Batch Inserts**
   - Transactions group ~168+ hourly records per city
   - Reduces DB round trips

5. **Data Retention**
   - Auto-cleanup prevents unbounded growth
   - 90-day default balances history vs storage

---

## Security Notes

### Current Implementation
- ✅ Non-root Docker user
- ✅ Environment variable configuration
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS enabled (needs tightening for production)

### Production Concerns
- ❌ No authentication/authorization
- ❌ No rate limiting on API endpoints
- ❌ No input validation middleware
- ❌ No secrets management (uses .env files)
- ❌ DB credentials in plain text
- ❌ No HTTPS enforcement

---

## Future Development (from README TODO)

- [ ] Build frontend (React + Vite)
- [ ] Charts (Recharts / Chart.js)
- [ ] City search UI
- [ ] Dashboard layout
- [ ] Deployment (Render + Vercel)

---

## Git Information

**Current Branch:** development
**Main Branch:** main
**Recent Commits:**
- `3e4ea9d` - SQL file arrangement for Docker deployment
- `a62954e` - Mistake fix
- `e51eda3` - Initial backend commit

**Git Status:** Clean (no uncommitted changes)

---

## Contact & License

**Project:** ClimaStat
**Author:** Roshit Dahat
**Year:** 2025
**License:** MIT (free to use and modify)

---

*Last Updated: 2025-01-16*
