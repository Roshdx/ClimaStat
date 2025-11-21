# ClimaStat - Project Summary

## Project Overview
ClimaStat is a full-stack weather and air quality intelligence dashboard that ingests real-time data from Open-Meteo APIs and displays it through an interactive React dashboard. The project includes a fully functional backend with automated data collection and a complete frontend with weather KPIs, AQI monitoring, and trend charts.

**Author:** Roshit Dahat
**License:** MIT
**Current Status:** Full-stack application (Backend + Frontend operational)

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
- **Framework:** React 19.2.0
- **Build Tool:** Vite 7.2.2
- **UI Library:** Material UI 7.3.5
- **Charts:** ECharts 6.0.0 with echarts-for-react
- **State Management:** @tanstack/react-query 5.90.9
- **HTTP Client:** axios 1.13.2
- **Styling:** Emotion (CSS-in-JS)
- **Icons:** @mui/icons-material
- **Animations:** react-countup

---

## Core Features & Code Locations

### Backend Features

#### 1. Weather & Air Quality Data Fetching
**Description:** Fetches hourly weather and AQI data from Open-Meteo APIs

**Code Location:** `backend/services/fetcher.js`

**Key Functions:**
- `fetchForCity(city)` - Main fetch function
- `httpGetWithRetry(url, opts, retries)` - HTTP retry logic

**API Parameters:**
- Temperature (2m above ground)
- Relative humidity (2m)
- Wind speed (10m)
- Weather code and description
- US AQI, EU AQI
- PM2.5, PM10

**Default Cities:** 20 major Indian cities (Mumbai, Delhi, Bengaluru, etc.)
- Configured in: `backend/scheduler.js`

---

#### 2. Database Schema
**Code Location:** `backend/sql/01_create_schema.sql`

**Tables:**

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `cities` | City master list | id, name, lat, lon, active |
| `measurements_hourly` | Hourly weather readings | city_id, ts, temperature_c, humidity, wind_speed, us_aqi, european_aqi, pm2_5, pm10, weather_description |
| `measurements_daily` | Daily aggregated stats | city_id, day, avg_temp, avg_aqi |
| `alerts` | Future alert system | city_id, type, severity, message |

**Unique Constraints:**
- `cities.name` - Prevents duplicate cities
- `measurements_hourly(city_id, ts)` - Prevents duplicate hourly records

**Indexes:**
- `idx_measurements_city_ts` - Query optimization for city+time lookups
- `idx_measurements_ts` - Time-based queries

---

#### 3. Materialized View
**Code Location:** `backend/sql/02_create_mat_view.sql`

**View Name:** `latest_measurement_per_city`

**Purpose:** Pre-computed snapshot of latest measurement for each city

**Refresh Strategy:**
- Concurrent refresh every 5 minutes (non-blocking)
- Configured in: `backend/maintenance.js`

---

#### 4. REST API Endpoints
**Code Location:** `backend/routes/cities.js` & `backend/routes/health.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + DB connectivity |
| GET | `/api/cities` | List all cities |
| POST | `/api/cities` | Add new city |
| GET | `/api/cities/latest` | Latest snapshot per city (uses materialized view) |
| GET | `/api/cities/:id/hourly` | Hourly data (supports `hours`, `from`, `to` params) |
| GET | `/api/cities/:id/summary` | Last measurement + 24h stats |
| POST | `/api/cities/:id/fetch` | Manual fetch trigger |

---

#### 5. Automated Scheduling
**Code Location:** `backend/scheduler.js`

| Task | Frequency | Description |
|------|-----------|-------------|
| Initial city sync | On startup | Seeds cities table |
| Initial data fetch | On startup | Fetches all cities once |
| Periodic fetch | Every 20 minutes | Weather + AQI for all cities |
| Mat view refresh | Every 5 minutes | Updates latest snapshot |
| Data retention | Daily at 03:10 UTC | Deletes data older than 90 days |

---

### Frontend Features

#### 1. Dashboard Layout
**Code Location:** `frontend/src/App.jsx`

**Components:**
- **AppBar**: Navigation with theme toggle, city selector, refresh button
- **Drawer**: Side navigation (expandable)
- **Main Content**: KPI cards and charts
- **JSON Inspector**: Debug dialog for API responses

---

#### 2. KPI Cards (Left Column)

**Today's Weather Card:**
- Date display
- Time-of-day icon (Morning/Afternoon/Evening/Night)
- Weather description with temperature
- Tonight's and tomorrow's low temperatures

**Current Weather Card:**
- Large current temperature
- Feels-like temperature (computed from temp, humidity, wind)
- Weather description
- Chips: Humidity %, Wind speed, AQI

**AQI Details Card:**
- Emoji indicator (based on AQI level)
- US AQI value and category
- EU AQI value and category
- Severity chips with icons

---

#### 3. AQI Chart (Right Column)
**Code Location:** `frontend/src/components/charts/AqiChart.jsx`

**Features:**
- 96-hour time series display
- Multi-series visualization:
  - AQI (US) - Line chart with gradient fill
  - PM2.5 - Bar chart (µg/m³)
  - PM10 - Bar chart (µg/m³)
- Dual Y-axes: AQI (0-500) and particulates
- Interactive tooltips and data zoom
- Color coding based on AQI levels

---

#### 4. API Integration
**Code Location:** `frontend/src/lib/api.js`

**Base Configuration:**
- Base URL: `VITE_API_BASE` environment variable
- Timeout: 15 seconds

**Endpoints Consumed:**

| Endpoint | Hook | Caching Strategy |
|----------|------|------------------|
| `/api/cities` | `useCities()` | 5-min stale time |
| `/api/cities/latest` | `useLatestAll()` | 1-min stale, auto-refetch 60s |
| `/api/cities/:id/hourly` | `useHourly()` | 30s stale, auto-refetch 2min |
| `/api/cities/:id/fetch` | `useTriggerFetch()` | Mutation |

---

#### 5. State Management
**Code Location:** `frontend/src/hooks/useMeasurements.js`

**React Query Features:**
- Automatic caching and background refetching
- Query invalidation on manual refresh
- Loading and error states

**Local State:**
- `mode`: Theme (light/dark) - persisted in localStorage
- `selectedCity`: Current city - persisted in localStorage
- `open`: Drawer visibility
- `hiLo`: Computed daily high/low
- `nightTemps`: Tonight and next day lows

---

#### 6. Computed Metrics

**Feels-Like Temperature:**
```javascript
AT = T + 0.33*e - 0.7*wind - 4.0
// where e is vapor pressure from humidity
```

**AQI Categories:**
- Good (0-50)
- Moderate (51-100)
- Unhealthy for Sensitive Groups (101-150)
- Unhealthy (151-200)
- Very Unhealthy (201-300)
- Hazardous (301+)

**Time of Day Detection:**
- Morning (6-11): Light icon
- Afternoon (12-16): Sun icon
- Evening (17-19): Twilight icon
- Night (20-5): Moon icon

---

#### 7. Theming
**Code Location:** `frontend/src/App.jsx`

**Material UI Theme:**
- Primary: #1976d2 (blue)
- Secondary: #00acc1 (cyan)
- Light background: #f7fbff
- Dark background: #0f1720
- Responsive font sizes
- Custom component overrides

---

## Docker Configuration

### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `db` | postgres:15 | 5432 | PostgreSQL database |
| `backend` | Custom (Node 18 Alpine) | 4000 | Express API + Scheduler |
| `frontend-dev` | Custom (Node 22 Alpine) | 5173 | Vite dev server |
| `adminer` | adminer:latest | 8080 | Database UI |

### Key Features
- Health checks for all services
- Volume mounting for hot-reload
- Network isolation with `climastat-net`
- Auto-initialization of SQL schema

---

## File Structure Reference

```
ClimaStat/
│
├── backend/
│   ├── index.js                 # Main Express server
│   ├── db.js                    # PostgreSQL connection pool
│   ├── scheduler.js             # Cron jobs + city sync
│   ├── maintenance.js           # Data retention + mat view
│   ├── routes/
│   │   ├── health.js           # Health check endpoint
│   │   └── cities.js           # /api/cities/* endpoints
│   ├── services/
│   │   └── fetcher.js          # Open-Meteo API integration
│   ├── sql/
│   │   ├── 01_create_schema.sql
│   │   └── 02_create_mat_view.sql
│   ├── Dockerfile.dev
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main dashboard (694 lines)
│   │   ├── main.jsx             # React entry + Query setup
│   │   ├── components/
│   │   │   └── charts/
│   │   │       └── AqiChart.jsx # ECharts visualization
│   │   ├── hooks/
│   │   │   └── useMeasurements.js # React Query hooks
│   │   └── lib/
│   │       └── api.js           # Axios client
│   ├── vite.config.js
│   ├── Dockerfile.dev
│   └── package.json
│
├── docker-compose.dev.yml       # Development orchestration
├── .env.dev                     # Environment variables
├── README.md                    # Project overview
├── summary.md                   # This file
├── current_process.md           # Development workflow
└── deployment_steps.md          # Docker guide
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ClimaStat System                        │
└─────────────────────────────────────────────────────────────┘

1. Backend Startup:
   scheduler.js:start()
   → syncCities() → seeds cities table
   → initialFetchAll() → fetches all cities
   → schedulePeriodicFetch() → cron job

2. Periodic Fetch (Every 20 min):
   Cron trigger
   → fetcher.fetchForCity() for each city
   → Open-Meteo Weather API
   → Open-Meteo Air Quality API
   → Upsert into measurements_hourly

3. Materialized View Refresh (Every 5 min):
   Cron trigger
   → REFRESH MATERIALIZED VIEW latest_measurement_per_city

4. Frontend Data Flow:
   React Query hooks
   → Axios API calls to backend
   → Cache responses (1-5 min stale time)
   → Auto-refetch in background
   → Update UI components

5. User Interaction:
   City selector → invalidate queries → fetch new data
   Refresh button → trigger manual fetch → refetch all
   Theme toggle → update localStorage → re-render
```

---

## Key Design Decisions

### Backend

**1. Upsert Strategy**
Uses `ON CONFLICT DO UPDATE` for idempotent data insertion.

**2. Transaction Safety**
All hourly inserts wrapped in BEGIN/COMMIT for atomicity.

**3. Retry Logic**
3 attempts with exponential backoff for HTTP requests.

**4. Soft Delete Pattern**
Cities marked `active=false` instead of deletion.

### Frontend

**1. React Query for Server State**
- Automatic caching reduces API calls
- Background refetching keeps data fresh
- Optimistic updates for better UX

**2. Material UI for Consistency**
- Pre-built accessible components
- Theme system for dark/light mode
- Responsive design out of the box

**3. ECharts for Visualization**
- High-performance rendering
- Rich interactive features
- Custom theming support

**4. Local Storage Persistence**
- Theme and city selection survive page refresh
- Better user experience

---

## Missing Features (Not Yet Implemented)

1. **Additional Charts**
   - Temperature trend chart
   - Humidity/Wind charts
   - Comparison views

2. **Daily Aggregations**
   - `measurements_daily` table exists
   - No aggregation logic implemented

3. **Alerts System**
   - `alerts` table exists
   - No alert triggering logic
   - No notification system

4. **Authentication**
   - No user management
   - API fully open

5. **Production Deployment**
   - Only dev Docker Compose exists
   - No CI/CD pipeline
   - No monitoring/logging setup

---

## Performance Considerations

### Backend
- Database indexes on critical queries
- Connection pooling with `pg.Pool`
- Materialized view for fast dashboard queries
- Batch inserts with transactions
- Data retention prevents unbounded growth

### Frontend
- React Query caching reduces network requests
- Stale-while-revalidate pattern
- Lazy loading for charts
- Responsive images and icons
- Emotion CSS-in-JS for optimized styles

---

## Security Notes

### Current Implementation
- Non-root Docker users
- SQL injection prevention (parameterized queries)
- CORS enabled
- Environment variable configuration

### Production Concerns
- No authentication/authorization
- No rate limiting on API endpoints
- No input validation middleware
- No secrets management
- No HTTPS enforcement

---

## Future Development

### High Priority
- [ ] Additional chart types
- [ ] Production Docker setup
- [ ] CI/CD pipeline
- [ ] Rate limiting

### Medium Priority
- [ ] Daily aggregation logic
- [ ] Alert system
- [ ] User authentication

### Low Priority
- [ ] Mobile app
- [ ] Historical data export
- [ ] Multi-language support

---

## Git Information

**Current Branch:** development
**Main Branch:** main

**Recent Commits:**
- `d935259` - AQI kpi card added
- `3ce222d` - KPI card changes + usual fixes
- `c9619ec` - latest changes
- `e8dbd35` - general fixes and frontend docker files
- `cff28cc` - frontend uploaded with basic layout and dummy data

---

## Contact & License

**Project:** ClimaStat
**Author:** Roshit Dahat
**Year:** 2025
**License:** MIT (free to use and modify)

---

*Last Updated: 2025-11-21*
