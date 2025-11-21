# ClimaStat — Weather & Air Quality Intelligence Dashboard

ClimaStat is a full-stack weather monitoring application that ingests real-time weather and air quality data from **Open-Meteo** APIs and displays it through an interactive React dashboard. The entire stack is Dockerized for easy development and deployment.

---

## Features

### Backend
- Fetches **hourly weather data** from Open-Meteo Forecast API
- Fetches **air quality data** (AQI, PM2.5, PM10) from Open-Meteo Air Quality API
- Stores readings in PostgreSQL (`measurements_hourly`)
- Automatic **scheduled fetch every 20 minutes**
- Full **city master list sync** (20 Indian cities)
- Materialized view for **latest snapshot** per city
- Data retention policy (90 days)

### Frontend
- **React 19 + Vite** dashboard with Material UI
- **Real-time weather KPIs**: Temperature, feels-like, humidity, wind speed
- **AQI monitoring**: US AQI, EU AQI with severity indicators
- **Interactive charts**: 96-hour AQI trends with PM2.5/PM10 using ECharts
- **Multi-city support** with city selector dropdown
- **Dark/Light theme** toggle with persistence
- **Auto-refresh** with React Query caching
- **Responsive design** for mobile to desktop

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 19, Vite, Material UI 7, ECharts, React Query |
| **Backend** | Node.js 18, Express.js 5 |
| **Database** | PostgreSQL 15 |
| **Containerization** | Docker, Docker Compose |
| **APIs** | Open-Meteo Forecast & Air Quality APIs |

---

## Project Structure

```
ClimaStat/
│
├── backend/
│   ├── index.js              # Express server entry point
│   ├── db.js                 # PostgreSQL connection pool
│   ├── scheduler.js          # Cron jobs + city sync
│   ├── maintenance.js        # Data retention + mat view refresh
│   ├── routes/
│   │   ├── health.js         # Health check endpoint
│   │   └── cities.js         # All /api/cities/* endpoints
│   ├── services/
│   │   └── fetcher.js        # Open-Meteo API integration
│   ├── sql/
│   │   ├── 01_create_schema.sql
│   │   └── 02_create_mat_view.sql
│   └── Dockerfile.dev
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main dashboard component
│   │   ├── main.jsx          # React entry with React Query
│   │   ├── components/
│   │   │   └── charts/
│   │   │       └── AqiChart.jsx
│   │   ├── hooks/
│   │   │   └── useMeasurements.js
│   │   └── lib/
│   │       └── api.js        # Axios API client
│   ├── vite.config.js
│   └── Dockerfile.dev
│
├── docker-compose.dev.yml    # Development orchestration
├── .env.dev                  # Environment variables
└── README.md
```

---

## Quick Start

### Prerequisites
- Docker Desktop (or Docker Engine + Docker Compose)
- Git

### 1. Clone and Configure

```bash
git clone <repository-url> ClimaStat
cd ClimaStat

# Copy environment file (if not exists)
cp .env.example .env.dev
```

### 2. Start All Services

```bash
docker-compose -f docker-compose.dev.yml up --build
```

This launches:
- **PostgreSQL** (`db`) on port 5432
- **Backend API** (`backend`) on port 4000
- **Frontend** (`frontend-dev`) on port 5173
- **Adminer** (`adminer`) on port 8080

### 3. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **Dashboard** | http://localhost:5173 | React frontend |
| **API** | http://localhost:4000 | Express backend |
| **Adminer** | http://localhost:8080 | Database UI |

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check with DB status |
| GET | `/api/cities` | List all cities |
| GET | `/api/cities/latest` | Latest snapshot per city |
| GET | `/api/cities/:id/hourly` | Hourly data (supports `hours` param) |
| GET | `/api/cities/:id/summary` | Last measurement + 24h stats |
| POST | `/api/cities` | Add new city |
| POST | `/api/cities/:id/fetch` | Manual fetch trigger |

---

## Scheduler Overview

| Task | Frequency |
|------|-----------|
| Initial fetch for all cities | On startup |
| Periodic weather + AQI fetch | Every 20 minutes |
| Materialized view refresh | Every 5 minutes |
| Data retention cleanup | Daily at 03:10 UTC |

---

## Environment Variables

Configure in `.env.dev`:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Backend
BACKEND_PORT=4000
DB_SSL=false

# Frontend (set in docker-compose)
VITE_API_BASE=http://localhost:4000

# Adminer
ADMINER_PORT=8080
```

---

## Development

### Hot Reload
- **Frontend**: Vite HMR on file changes
- **Backend**: Nodemon auto-restart on file changes

### View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f frontend-dev
docker-compose -f docker-compose.dev.yml logs -f backend
```

### Stop Services

```bash
# Stop containers
docker-compose -f docker-compose.dev.yml down

# Stop and remove data (clean slate)
docker-compose -f docker-compose.dev.yml down -v
```

---

## Screenshots

The dashboard displays:
- **KPI Cards**: Current temperature, feels-like, humidity, wind, AQI
- **AQI Chart**: 96-hour trend with PM2.5 and PM10
- **City Selector**: Switch between 20 Indian cities
- **Theme Toggle**: Light/Dark mode

---

## TODO (Upcoming)

- [ ] Additional chart types (temperature trends, humidity)
- [ ] Daily aggregation logic
- [ ] Alert system for high AQI
- [ ] User authentication
- [ ] Production deployment setup
- [ ] CI/CD pipeline

---

## License

MIT License — free to use and modify.

---

## Author

Roshit Dahat
ClimaStat project – 2025
