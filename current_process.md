# ClimaStat - Current Development Process

## Project Status Overview

**Current Phase:** Full-Stack Development (Backend + Frontend operational)
**Development Stage:** Alpha
**Active Branch:** `development`
**Main Branch:** `main`

---

## Development Workflow

### 1. Version Control

**Git Strategy:**
- Main branch: `main` (production-ready code)
- Development branch: `development` (active work)
- Feature branches: Create as needed

**Recent Activity:**
```
d935259 - AQI kpi card added
3ce222d - KPI card changes + usual fixes
c9619ec - latest changes
e8dbd35 - general fixes and frontend docker files
cff28cc - frontend uploaded with basic layout and dummy data
```

---

### 2. Local Development Setup

**Prerequisites:**
- Docker Desktop (or Docker Engine + Docker Compose)
- Git
- Optional: Node.js 18+ (for local development without Docker)

**First-time Setup:**

```bash
# 1. Clone repository
git clone <repository-url>
cd ClimaStat

# 2. Copy environment file
cp .env.example .env.dev

# 3. Start all services
docker-compose -f docker-compose.dev.yml up --build
```

**Daily Development:**

```bash
# Start services (without rebuild)
docker-compose -f docker-compose.dev.yml up

# Or run in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (clean slate)
docker-compose -f docker-compose.dev.yml down -v
```

---

### 3. Development Environment Services

When you run `docker-compose -f docker-compose.dev.yml up`, you get:

| Service | URL | Purpose | Notes |
|---------|-----|---------|-------|
| Frontend | http://localhost:5173 | React dashboard | Hot-reload with Vite |
| Backend API | http://localhost:4000 | Express server | Hot-reload with nodemon |
| Adminer DB UI | http://localhost:8080 | Database management | PostgreSQL client |
| PostgreSQL | localhost:5432 | Database | Not browser accessible |

**Adminer Login Credentials:**
```
System: PostgreSQL
Server: db
Username: postgres
Password: postgres
Database: postgres
```

---

### 4. Code Organization

**Backend Module Structure:**

```
backend/
├── index.js          → Main entry point (Express server setup)
├── db.js             → Database connection pool
├── scheduler.js      → Cron jobs + city synchronization
├── maintenance.js    → Data retention + mat view refresh
├── routes/           → API endpoint handlers
└── services/         → Business logic (API fetching)
```

**Frontend Module Structure:**

```
frontend/
├── src/
│   ├── App.jsx           → Main dashboard component
│   ├── main.jsx          → React entry with React Query
│   ├── components/       → Reusable UI components
│   │   └── charts/       → Chart components
│   ├── hooks/            → Custom React hooks
│   └── lib/              → Utilities and API client
├── vite.config.js        → Vite configuration
└── Dockerfile.dev        → Development container
```

**Development Pattern:**
1. Backend routes define HTTP endpoints
2. Backend services contain business logic
3. Frontend hooks fetch data via React Query
4. Frontend components render UI with Material UI

---

### 5. Making Changes

#### Adding a Backend API Endpoint

1. Define route in `backend/routes/cities.js`
2. Use async/await pattern
3. Add error handling (try/catch)
4. Test with curl or frontend

Example:
```javascript
router.get('/new-endpoint', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM cities');
    res.json(rows);
  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'db_error' });
  }
});
```

#### Adding a Frontend Component

1. Create component in `frontend/src/components/`
2. Use Material UI components
3. Connect to data via hooks from `useMeasurements.js`
4. Import and use in `App.jsx`

Example:
```jsx
// frontend/src/components/WeatherCard.jsx
import { Paper, Typography } from '@mui/material';

export default function WeatherCard({ data }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6">{data.temperature_c}°C</Typography>
    </Paper>
  );
}
```

#### Adding a React Query Hook

1. Add to `frontend/src/hooks/useMeasurements.js`
2. Configure caching strategy
3. Export and use in components

Example:
```javascript
export function useNewData(id) {
  return useQuery({
    queryKey: ['newData', id],
    queryFn: () => api.getNewData(id),
    staleTime: 60_000,
    enabled: !!id,
  });
}
```

#### Modifying Database Schema

1. Create new SQL file in `backend/sql/`
2. Stop containers: `docker-compose -f docker-compose.dev.yml down -v`
3. Restart to apply: `docker-compose -f docker-compose.dev.yml up --build`

**Alternative (without volume removal):**
```bash
docker exec -it climastat-db-1 psql -U postgres
ALTER TABLE cities ADD COLUMN IF NOT EXISTS region TEXT;
```

---

### 6. Testing Changes

#### Frontend Testing

1. Open http://localhost:5173
2. Use browser DevTools (F12)
3. Check Network tab for API calls
4. Use React DevTools extension
5. Check Console for errors

#### Backend API Testing

```bash
# Health check
curl http://localhost:4000/health

# Get all cities
curl http://localhost:4000/api/cities

# Get latest measurements
curl http://localhost:4000/api/cities/latest

# Get hourly data for city ID 1
curl "http://localhost:4000/api/cities/1/hourly?hours=96"

# Trigger manual fetch
curl -X POST http://localhost:4000/api/cities/1/fetch
```

#### Database Verification

1. Open Adminer: http://localhost:8080
2. Login with credentials above
3. Check `measurements_hourly` table
4. Verify recent timestamps

#### Log Monitoring

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Frontend only
docker-compose -f docker-compose.dev.yml logs -f frontend-dev

# Backend only
docker-compose -f docker-compose.dev.yml logs -f backend

# Check for errors
docker-compose -f docker-compose.dev.yml logs | grep -i error
```

---

### 7. Debugging Tips

#### Frontend Issues

**Component not updating:**
- Check React Query devtools
- Verify query key matches
- Check stale time settings
- Force refetch with invalidateQueries

**Styling issues:**
- Check MUI theme configuration
- Verify sx prop syntax
- Check responsive breakpoints

**API call failures:**
- Check Network tab in DevTools
- Verify VITE_API_BASE is correct
- Check CORS configuration

#### Backend Issues

**Database connection errors:**
```bash
docker-compose -f docker-compose.dev.yml ps
docker-compose -f docker-compose.dev.yml logs db
docker exec -it climastat-db-1 pg_isready -U postgres
```

**Scheduler not running:**
- Check backend logs for "Scheduler started"
- Look for cron execution messages

**API fetch failures:**
- Check internet connectivity
- Look for rate limit (429) errors
- Check retry logic in logs

#### Docker Issues

**Port already in use:**
```bash
# Windows
netstat -ano | findstr :5173
netstat -ano | findstr :4000

# Linux/Mac
lsof -i :5173
lsof -i :4000
```

**Hot-reload not working:**
```bash
# Restart specific service
docker-compose -f docker-compose.dev.yml restart frontend-dev
docker-compose -f docker-compose.dev.yml restart backend
```

---

### 8. Environment Variables

**Configuration (.env.dev):**

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Backend
BACKEND_PORT=4000
DB_SSL=false

# Adminer
ADMINER_PORT=8080

# Database URL (used by backend)
DATABASE_URL=postgres://postgres:postgres@db:5432/postgres
```

**Frontend Environment (set in docker-compose.dev.yml):**
```env
VITE_API_BASE=http://localhost:4000
```

---

### 9. Code Quality Practices

**Current Standards:**

- Use async/await (no raw promises)
- Wrap DB operations in try/catch
- Use parameterized queries (prevent SQL injection)
- Release DB clients in finally blocks
- Use React Query for server state
- Use Material UI components consistently
- Follow REST conventions for routes

**Implemented:**
- ESLint for frontend
- Nodemon for backend hot-reload
- Vite HMR for frontend

**Not Implemented Yet:**
- Unit tests
- Integration tests
- Pre-commit hooks
- TypeScript

---

### 10. Common Development Commands

**Docker:**
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yml up --build

# Stop all services
docker-compose -f docker-compose.dev.yml down

# Clean restart (removes data)
docker-compose -f docker-compose.dev.yml down -v && docker-compose -f docker-compose.dev.yml up --build

# Shell into frontend container
docker exec -it climastat-frontend-dev-1 sh

# Shell into backend container
docker exec -it climastat-backend-1 sh

# Shell into DB container
docker exec -it climastat-db-1 psql -U postgres
```

**NPM (if running locally):**
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

**Git:**
```bash
# Create feature branch
git checkout -b feature/new-feature

# Commit changes
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature

# Switch back to development
git checkout development
```

---

### 11. Frontend-Specific Development

**Adding a New Chart:**

1. Create component in `frontend/src/components/charts/`
2. Import ECharts and configure options
3. Add to dashboard in `App.jsx`

Example:
```jsx
// frontend/src/components/charts/TempChart.jsx
import ReactECharts from 'echarts-for-react';

export default function TempChart({ data }) {
  const option = {
    xAxis: { type: 'time' },
    yAxis: { type: 'value' },
    series: [{
      type: 'line',
      data: data.map(d => [d.ts, d.temperature_c])
    }]
  };
  return <ReactECharts option={option} />;
}
```

**Modifying Theme:**

Edit theme configuration in `frontend/src/App.jsx`:
```javascript
const theme = createTheme({
  palette: {
    mode: 'light', // or 'dark'
    primary: { main: '#1976d2' },
    secondary: { main: '#00acc1' },
  },
});
```

**Adding API Endpoint to Frontend:**

1. Add method to `frontend/src/lib/api.js`
2. Create hook in `frontend/src/hooks/useMeasurements.js`
3. Use hook in component

---

### 12. Troubleshooting Guide

| Problem | Solution |
|---------|----------|
| "Port 5173 already in use" | Kill process or change port in docker-compose |
| "Port 4000 already in use" | Kill process or change BACKEND_PORT |
| "Cannot connect to database" | Check DB container: `docker-compose ps` |
| "No data in dashboard" | Wait for initial fetch or trigger manually |
| "Vite not reloading" | Restart frontend-dev container |
| "Nodemon not reloading" | Restart backend container |
| "CORS errors" | Check backend CORS config and VITE_API_BASE |
| "Query not refetching" | Check stale time and query key |

---

### 13. Next Steps (Development Roadmap)

**Frontend Tasks:**
- [ ] Add temperature trend chart
- [ ] Add humidity/wind charts
- [ ] Implement city comparison view
- [ ] Add data export functionality
- [ ] Improve mobile responsiveness
- [ ] Add loading skeletons

**Backend Tasks:**
- [ ] Implement daily aggregation cron
- [ ] Create alert triggering logic
- [ ] Add input validation middleware
- [ ] Implement rate limiting
- [ ] Add authentication

**DevOps Tasks:**
- [ ] Create production Dockerfiles
- [ ] Set up GitHub Actions CI/CD
- [ ] Configure production environment
- [ ] Set up monitoring/alerts
- [ ] Implement automated backups

---

### 14. Resources

**Documentation:**
- Open-Meteo API: https://open-meteo.com/en/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/15/
- Express.js Guide: https://expressjs.com/
- React Query: https://tanstack.com/query/latest
- Material UI: https://mui.com/material-ui/
- ECharts: https://echarts.apache.org/
- Vite: https://vitejs.dev/

**Project Files:**
- `README.md` - Project overview and quick start
- `summary.md` - Detailed feature documentation
- `deployment_steps.md` - Docker deployment guide

---

*Last Updated: 2025-11-21*
