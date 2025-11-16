# ClimaStat - Current Development Process

## Project Status Overview

**Current Phase:** Backend Complete, Frontend Not Started
**Development Stage:** Pre-Alpha (Backend-only)
**Active Branch:** `development`
**Main Branch:** `main`

---

## Development Workflow

### 1. Version Control

**Git Strategy:**
- Main branch: `main` (production-ready code)
- Development branch: `development` (active work)
- Feature branches: Not currently used

**Recent Activity:**
```
3e4ea9d - sql file arrangement for docker deployment
a62954e - mistake
4684c11 - faslk;fa (incomplete message)
e51eda3 - Initial backend commit - ClimaStat
```

**Current Status:** Clean working directory (no uncommitted changes)

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

# 3. Edit environment variables (optional - defaults work)
# Open .env.dev and modify if needed

# 4. Start all services
docker-compose -f docker-compose.dev.yml up --build
```

**Daily Development:**

```bash
# Start services (without rebuild)
docker-compose -f docker-compose.dev.yml up

# Or run in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend

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
| Backend API | http://localhost:4000 | Express server | Hot-reload with nodemon |
| Adminer DB UI | http://localhost:8080 | Database management | System: PostgreSQL, Server: db |
| PostgreSQL | localhost:5432 | Database | Not exposed in browser |

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

**Development Pattern:**
1. Routes define HTTP endpoints (`routes/cities.js`, `routes/health.js`)
2. Services contain business logic (`services/fetcher.js`)
3. Scheduler manages background tasks (`scheduler.js`)
4. Database operations use pooled connections (`db.js`)

---

### 5. Making Changes

**Adding a New API Endpoint:**

1. Define route in appropriate file (`routes/cities.js`)
2. Use async/await pattern
3. Add error handling (try/catch)
4. Test with curl or Postman
5. Commit changes

Example:
```javascript
// backend/routes/cities.js
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

**Modifying Database Schema:**

1. Create new SQL file in `backend/sql/` (e.g., `05_add_column.sql`)
2. Stop containers: `docker-compose -f docker-compose.dev.yml down -v`
3. Restart to apply: `docker-compose -f docker-compose.dev.yml up --build`
4. Note: Volume removal (`-v`) wipes existing data

**Alternative (without volume removal):**
```bash
# Connect to DB container
docker exec -it climastat-db-1 psql -U postgres

# Run SQL manually
ALTER TABLE cities ADD COLUMN IF NOT EXISTS region TEXT;
```

**Adding a New City:**

Option 1: Via API (POST request)
```bash
curl -X POST http://localhost:4000/api/cities \
  -H "Content-Type: application/json" \
  -d '{"name":"Goa","lat":15.2993,"lon":74.1240}'
```

Option 2: Via Adminer UI
1. Open http://localhost:8080
2. Navigate to `cities` table
3. Click "New item"
4. Fill form and save

Option 3: Add to default list (`backend/scheduler.js:6-27`)

**Modifying Fetch Schedule:**

Edit `backend/scheduler.js`:
```javascript
// Change from every 20 minutes to every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  // fetch logic
});
```

---

### 6. Testing Changes

**Manual API Testing:**

```bash
# Health check
curl http://localhost:4000/health

# Get all cities
curl http://localhost:4000/api/cities

# Get latest measurements
curl http://localhost:4000/api/cities/latest

# Get hourly data for city ID 1
curl http://localhost:4000/api/cities/1/hourly

# Trigger manual fetch for city ID 1
curl -X POST http://localhost:4000/api/cities/1/fetch
```

**Database Verification:**

1. Open Adminer: http://localhost:8080
2. Login with credentials above
3. Click `measurements_hourly` table
4. Click "Select data"
5. Verify recent timestamps

**Log Monitoring:**

```bash
# Follow backend logs in real-time
docker-compose -f docker-compose.dev.yml logs -f backend

# Check for errors
docker-compose -f docker-compose.dev.yml logs backend | grep -i error

# View scheduler activity
docker-compose -f docker-compose.dev.yml logs backend | grep -i cron
```

---

### 7. Debugging Tips

**Backend not starting:**
```bash
# Check if port 4000 is already in use
netstat -ano | findstr :4000   # Windows
lsof -i :4000                  # Mac/Linux

# Rebuild containers
docker-compose -f docker-compose.dev.yml up --build --force-recreate
```

**Database connection errors:**
```bash
# Check DB health
docker-compose -f docker-compose.dev.yml ps

# View DB logs
docker-compose -f docker-compose.dev.yml logs db

# Manually test connection
docker exec -it climastat-db-1 pg_isready -U postgres
```

**Scheduler not running:**
- Check backend logs for "Scheduler started" message
- Look for cron execution messages
- Verify no startup errors

**API fetch failures:**
- Check internet connectivity
- Verify Open-Meteo API is accessible
- Look for 429 (rate limit) or timeout errors
- Check retry logic in logs

**Hot-reload not working:**
- Verify volume mount in docker-compose.dev.yml
- Check nodemon.json configuration
- Restart backend service: `docker-compose -f docker-compose.dev.yml restart backend`

---

### 8. Database Maintenance

**View Current Data:**
```sql
-- Count measurements per city
SELECT c.name, COUNT(m.id) AS measurement_count
FROM cities c
LEFT JOIN measurements_hourly m ON m.city_id = c.id
GROUP BY c.name
ORDER BY measurement_count DESC;

-- Check data freshness
SELECT c.name, MAX(m.ts) AS latest_measurement
FROM cities c
LEFT JOIN measurements_hourly m ON m.city_id = c.id
GROUP BY c.name
ORDER BY latest_measurement DESC;

-- View materialized view
SELECT * FROM latest_measurement_per_city LIMIT 10;
```

**Manual Maintenance Tasks:**

```bash
# Enter DB container
docker exec -it climastat-db-1 psql -U postgres

# Refresh materialized view manually
REFRESH MATERIALIZED VIEW CONCURRENTLY latest_measurement_per_city;

# Run retention cleanup manually (30 days)
DELETE FROM measurements_hourly WHERE ts < now() - INTERVAL '30 days';

# Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

### 9. Environment Variables

**Current Configuration (.env.dev):**

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

**Changing Variables:**
1. Edit `.env.dev` file
2. Restart services: `docker-compose -f docker-compose.dev.yml down && docker-compose -f docker-compose.dev.yml up`
3. Note: Some variables require rebuild (`--build` flag)

---

### 10. Code Quality Practices

**Current Standards:**

- ✅ Use async/await (no raw promises)
- ✅ Wrap DB operations in try/catch
- ✅ Use parameterized queries (prevent SQL injection)
- ✅ Release DB clients in finally blocks
- ✅ Log errors with descriptive messages
- ✅ Use transactions for batch inserts
- ✅ Follow REST conventions for routes

**Not Implemented Yet:**
- ❌ ESLint configuration
- ❌ Prettier formatting
- ❌ Unit tests
- ❌ Integration tests
- ❌ Code coverage tools
- ❌ Pre-commit hooks

---

### 11. Branching Strategy (Proposed)

**Current:** Direct commits to `development`

**Recommended for Team Development:**
```
main (production)
  ↑
development (staging)
  ↑
feature/weather-alerts
feature/daily-aggregation
bugfix/timezone-issue
```

**Workflow:**
1. Create feature branch from `development`
2. Make changes and commit
3. Test locally
4. Merge back to `development`
5. Periodically merge `development` → `main`

---

### 12. Deployment Process (Future)

**Not Yet Implemented:**

The project currently only supports local Docker development. For production deployment, you'll need:

1. Production Dockerfile (without dev tools)
2. Environment-specific configs
3. Managed PostgreSQL (AWS RDS, Azure Database, etc.)
4. Hosting platform (Render, Railway, AWS ECS, etc.)
5. CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
6. Monitoring/logging (Datadog, Sentry, etc.)

See `deployment_steps.md` for detailed Docker deployment instructions.

---

### 13. Next Steps (Development Roadmap)

**Backend Tasks:**
- [ ] Implement AQI fetching (requires different API or endpoint)
- [ ] Add daily aggregation cron job
- [ ] Create alert triggering logic
- [ ] Add input validation middleware
- [ ] Implement rate limiting
- [ ] Add authentication (optional)
- [ ] Write unit tests

**Frontend Tasks (Not Started):**
- [ ] Initialize React + Vite project
- [ ] Create city dashboard component
- [ ] Implement weather charts (Recharts)
- [ ] Add city search/filter
- [ ] Build responsive layout
- [ ] Connect to backend API
- [ ] Deploy to Vercel/Netlify

**DevOps Tasks:**
- [ ] Create production Dockerfile
- [ ] Set up GitHub Actions CI/CD
- [ ] Configure production environment
- [ ] Set up monitoring/alerts
- [ ] Implement automated backups
- [ ] Add health checks and metrics

---

### 14. Common Development Commands

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

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Shell into backend container
docker exec -it climastat-backend-1 sh

# Shell into DB container
docker exec -it climastat-db-1 psql -U postgres
```

**NPM (if running locally without Docker):**
```bash
cd backend
npm install
npm run dev    # Uses nodemon
npm start      # Production mode
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

# Merge feature
git merge feature/new-feature
```

---

### 15. Troubleshooting Guide

| Problem | Solution |
|---------|----------|
| "Port 4000 already in use" | Kill process on port 4000 or change BACKEND_PORT in .env.dev |
| "Cannot connect to database" | Check DB container is healthy: `docker-compose ps` |
| "No data in database" | Trigger manual fetch: `curl -X POST http://localhost:4000/api/cities/1/fetch` |
| "Nodemon not reloading" | Check volume mount exists, restart backend container |
| "SQL syntax error on startup" | Check SQL files in `backend/sql/` for syntax |
| "Out of disk space" | Clean Docker: `docker system prune -a --volumes` |
| "Stale materialized view" | Wait for cron or refresh manually in Adminer |

---

## Development Best Practices

1. **Always use parameterized queries** - Prevents SQL injection
2. **Release DB clients** - Prevents connection leaks
3. **Use transactions for batch operations** - Ensures atomicity
4. **Log meaningful errors** - Aids debugging
5. **Test endpoints after changes** - Catch issues early
6. **Commit often with clear messages** - Enables easy rollback
7. **Check logs regularly** - Spot issues before they escalate
8. **Keep .env files out of git** - Security best practice

---

## Resources

**Documentation:**
- Open-Meteo API: https://open-meteo.com/en/docs
- PostgreSQL Docs: https://www.postgresql.org/docs/15/
- Express.js Guide: https://expressjs.com/
- Node.js Cron: https://www.npmjs.com/package/node-cron

**Project Files:**
- `README.md` - Project overview and quick start
- `summary.md` - Detailed feature documentation
- `deployment_steps.md` - Docker deployment guide

---

*Last Updated: 2025-01-16*
