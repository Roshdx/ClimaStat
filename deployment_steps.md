# ClimaStat - Docker Deployment Guide

This guide covers deploying ClimaStat using Docker and Docker Compose in both development and production environments.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Deployment](#development-deployment)
3. [Production Deployment (Future)](#production-deployment-future)
4. [Environment Configuration](#environment-configuration)
5. [Database Initialization](#database-initialization)
6. [Service Management](#service-management)
7. [Monitoring & Logs](#monitoring--logs)
8. [Backup & Restore](#backup--restore)
9. [Troubleshooting](#troubleshooting)
10. [Security Considerations](#security-considerations)

---

## Prerequisites

### Required Software

- **Docker Engine:** 20.10+ or Docker Desktop
- **Docker Compose:** 2.0+ (included with Docker Desktop)
- **Git:** For cloning the repository
- **Operating System:** Windows 10/11, macOS, or Linux

### Verify Installation

```bash
# Check Docker version
docker --version
# Expected: Docker version 20.10.x or higher

# Check Docker Compose version
docker-compose --version
# Expected: Docker Compose version 2.x or higher

# Verify Docker is running
docker ps
# Should show empty list or running containers (no error)
```

### System Requirements

**Minimum:**
- 2 CPU cores
- 2 GB RAM
- 5 GB free disk space

**Recommended:**
- 4 CPU cores
- 4 GB RAM
- 20 GB free disk space (for logs and data retention)

---

## Development Deployment

### Step 1: Clone Repository

```bash
# Clone the repository
git clone <repository-url> ClimaStat
cd ClimaStat

# Switch to development branch (if not already)
git checkout development
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env.dev

# Optional: Edit environment variables
# Use your preferred text editor
notepad .env.dev    # Windows
nano .env.dev       # Linux/Mac
code .env.dev       # VS Code
```

**Default .env.dev contents:**
```env
# PostgreSQL Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=postgres
POSTGRES_PORT=5432

# Backend API
BACKEND_PORT=4000
DB_SSL=false

# Adminer Database UI
ADMINER_PORT=8080

# Database Connection URL (auto-configured for Docker)
DATABASE_URL=postgres://postgres:postgres@db:5432/postgres
```

### Step 3: Start Services

```bash
# Start all services with build
docker-compose -f docker-compose.dev.yml up --build

# Or run in detached mode (background)
docker-compose -f docker-compose.dev.yml up -d --build
```

**What happens during startup:**

1. **Database Container (db):**
   - Pulls `postgres:15` image
   - Creates persistent volume `pgdata_dev`
   - Executes SQL files from `backend/sql/` directory in order:
     - `01_create_schema.sql` → Creates tables and indexes
     - `02_create_mat_view.sql` → Creates materialized view
     - `03_refresh_mat_view.sql` → Initial view refresh
     - `04_retention.sql` → (Not auto-executed, manual script)
   - Runs health check every 5 seconds

2. **Backend Container (backend):**
   - Builds custom image from `backend/Dockerfile.dev`
   - Installs Node.js dependencies
   - Waits for database health check to pass
   - Starts Express server on port 4000
   - Mounts local `backend/` folder for hot-reload
   - Runs `nodemon index.js` for auto-restart on file changes

3. **Scheduler Initialization:**
   - Syncs default city list (20 Indian cities)
   - Performs initial fetch for all cities (takes ~30 seconds)
   - Starts cron jobs:
     - Weather fetch every 20 minutes
     - Materialized view refresh every 5 minutes
     - Data retention daily at 03:10 UTC

4. **Adminer Container (adminer):**
   - Pulls `adminer:latest` image
   - Provides web-based database UI on port 8080

### Step 4: Verify Deployment

**Check container status:**
```bash
docker-compose -f docker-compose.dev.yml ps
```

Expected output:
```
NAME                  STATUS              PORTS
climastat-db-1        Up (healthy)        0.0.0.0:5432->5432/tcp
climastat-backend-1   Up (healthy)        0.0.0.0:4000->4000/tcp
climastat-adminer-1   Up                  0.0.0.0:8080->8080/tcp
```

**Test endpoints:**
```bash
# Health check
curl http://localhost:4000/health
# Expected: {"status":"ok","db":"ok","time":"2025-01-16T..."}

# List cities
curl http://localhost:4000/api/cities
# Expected: JSON array with 20 cities

# Get latest measurements (after initial fetch completes)
curl http://localhost:4000/api/cities/latest
# Expected: JSON array with latest weather data
```

**Access Adminer UI:**
1. Open browser: http://localhost:8080
2. Login with:
   - System: `PostgreSQL`
   - Server: `db`
   - Username: `postgres`
   - Password: `postgres`
   - Database: `postgres`
3. Navigate to tables to view data

### Step 5: Monitor Logs

```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View only backend logs
docker-compose -f docker-compose.dev.yml logs -f backend

# View only database logs
docker-compose -f docker-compose.dev.yml logs -f db

# Search logs for errors
docker-compose -f docker-compose.dev.yml logs | grep -i error
```

**Key log messages to look for:**

```
backend-1  | Backend running on 4000
backend-1  | syncCities result: { active_count: '20', total: '20' }
backend-1  | initialFetchAll: fetching 20 cities
backend-1  | Upserted 180 rows for Mumbai
backend-1  | Scheduler started
backend-1  | Maintenance scheduled: retention daily, materialized view refresh every 5 minutes
```

---

## Production Deployment (Future)

**Note:** Production deployment is not yet configured. The current setup is development-only.

### Planned Production Setup

**Required Files (Not Yet Created):**
- `docker-compose.prod.yml` - Production orchestration
- `backend/Dockerfile` - Production-optimized image
- `.env.prod` - Production environment variables

**Production Checklist:**

- [ ] Create production Dockerfile without dev dependencies
- [ ] Remove nodemon, use `node index.js` directly
- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Use managed PostgreSQL (AWS RDS, Azure Database, etc.)
- [ ] Set up SSL/TLS certificates
- [ ] Configure environment-specific secrets
- [ ] Implement health monitoring (Prometheus/Datadog)
- [ ] Set up log aggregation (ELK stack, CloudWatch)
- [ ] Configure automated backups
- [ ] Implement CI/CD pipeline (GitHub Actions)
- [ ] Set up staging environment

**Example Production Dockerfile (Future):**

```dockerfile
# backend/Dockerfile (production)
FROM node:18-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

CMD ["node", "index.js"]
```

**Example Production Docker Compose (Future):**

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: always
    environment:
      DATABASE_URL: ${DATABASE_URL}
      DB_SSL: "true"
      PORT: 4000
      NODE_ENV: production
    ports:
      - "4000:4000"
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:4000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

---

## Environment Configuration

### Development Environment Variables

**File:** `.env.dev`

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | postgres | Database superuser |
| `POSTGRES_PASSWORD` | postgres | Database password |
| `POSTGRES_DB` | postgres | Database name |
| `POSTGRES_PORT` | 5432 | Database port |
| `BACKEND_PORT` | 4000 | Express server port |
| `DB_SSL` | false | Enable SSL for DB connection |
| `ADMINER_PORT` | 8080 | Adminer web UI port |
| `DATABASE_URL` | postgres://... | Full connection string |

### Customizing Ports

If ports are already in use, modify `.env.dev`:

```env
# Change backend port
BACKEND_PORT=5000

# Change database port
POSTGRES_PORT=5433

# Change Adminer port
ADMINER_PORT=9090
```

Then restart services:
```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up
```

### SSL Configuration (Production)

For managed databases (AWS RDS, Azure, etc.):

```env
DB_SSL=true
DATABASE_URL=postgres://user:pass@managed-db-host:5432/dbname?sslmode=require
```

---

## Database Initialization

### Automatic Initialization (First Run)

On first startup, PostgreSQL automatically executes all `.sql` files in `backend/sql/` directory (mounted as `/docker-entrypoint-initdb.d/`):

1. **01_create_schema.sql** - Creates all tables and indexes
2. **02_create_mat_view.sql** - Creates materialized view for performance
3. **03_refresh_mat_view.sql** - Initial view refresh
4. **04_retention.sql** - Not auto-executed (manual cleanup script)

### Manual Re-initialization

**Warning:** This deletes all data!

```bash
# Stop and remove containers + volumes
docker-compose -f docker-compose.dev.yml down -v

# Start fresh (re-runs SQL initialization)
docker-compose -f docker-compose.dev.yml up --build
```

### Selective Schema Updates

To update schema without losing data:

```bash
# Connect to database
docker exec -it climastat-db-1 psql -U postgres

# Run SQL commands
ALTER TABLE cities ADD COLUMN IF NOT EXISTS region TEXT;
\q
```

Or create migration files:

```bash
# Create new migration
echo "ALTER TABLE cities ADD COLUMN region TEXT;" > backend/sql/05_add_region.sql

# Apply manually
docker exec -i climastat-db-1 psql -U postgres < backend/sql/05_add_region.sql
```

---

## Service Management

### Starting Services

```bash
# Start all services (foreground)
docker-compose -f docker-compose.dev.yml up

# Start in background (detached)
docker-compose -f docker-compose.dev.yml up -d

# Start with rebuild
docker-compose -f docker-compose.dev.yml up --build

# Start specific service
docker-compose -f docker-compose.dev.yml up backend
```

### Stopping Services

```bash
# Stop all services (keeps containers)
docker-compose -f docker-compose.dev.yml stop

# Stop and remove containers (keeps volumes)
docker-compose -f docker-compose.dev.yml down

# Stop and remove everything including volumes (DATA LOSS!)
docker-compose -f docker-compose.dev.yml down -v
```

### Restarting Services

```bash
# Restart all services
docker-compose -f docker-compose.dev.yml restart

# Restart specific service
docker-compose -f docker-compose.dev.yml restart backend

# Rebuild and restart
docker-compose -f docker-compose.dev.yml up -d --build --force-recreate
```

### Scaling (Future - Production)

```bash
# Run multiple backend instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

---

## Monitoring & Logs

### Viewing Logs

```bash
# View all logs (live)
docker-compose -f docker-compose.dev.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.dev.yml logs -f backend

# View last 100 lines
docker-compose -f docker-compose.dev.yml logs --tail=100 backend

# View logs since specific time
docker-compose -f docker-compose.dev.yml logs --since 2025-01-16T10:00:00 backend
```

### Container Status

```bash
# List running containers
docker-compose -f docker-compose.dev.yml ps

# View resource usage
docker stats

# Inspect specific container
docker inspect climastat-backend-1
```

### Health Checks

**Backend Health:**
```bash
curl http://localhost:4000/health
```

**Database Health:**
```bash
docker exec climastat-db-1 pg_isready -U postgres
# Expected: /var/run/postgresql:5432 - accepting connections
```

### Database Monitoring Queries

```bash
# Connect to database
docker exec -it climastat-db-1 psql -U postgres

# Check data counts
SELECT
  (SELECT COUNT(*) FROM cities) AS cities,
  (SELECT COUNT(*) FROM measurements_hourly) AS hourly_measurements,
  (SELECT COUNT(*) FROM measurements_daily) AS daily_measurements;

# Check latest data timestamp
SELECT MAX(ts) AS latest_measurement FROM measurements_hourly;

# View table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;

# Active connections
SELECT count(*) FROM pg_stat_activity;
```

---

## Backup & Restore

### Database Backup

**Full backup:**
```bash
# Backup to file
docker exec climastat-db-1 pg_dump -U postgres postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup with compression
docker exec climastat-db-1 pg_dump -U postgres postgres | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

**Table-specific backup:**
```bash
# Backup only measurements
docker exec climastat-db-1 pg_dump -U postgres -t measurements_hourly postgres > measurements_backup.sql
```

**Automated backup script:**
```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR
docker exec climastat-db-1 pg_dump -U postgres postgres | gzip > "$BACKUP_DIR/climastat_$(date +%Y%m%d_%H%M%S).sql.gz"
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete  # Keep 7 days
```

### Database Restore

**From SQL file:**
```bash
# Stop backend to prevent conflicts
docker-compose -f docker-compose.dev.yml stop backend

# Restore
docker exec -i climastat-db-1 psql -U postgres postgres < backup.sql

# Or from gzipped backup
gunzip -c backup.sql.gz | docker exec -i climastat-db-1 psql -U postgres postgres

# Restart backend
docker-compose -f docker-compose.dev.yml start backend
```

**Complete database reset with backup:**
```bash
# Backup first
docker exec climastat-db-1 pg_dump -U postgres postgres > backup.sql

# Reset
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d db

# Wait for DB to be ready
sleep 10

# Restore
docker exec -i climastat-db-1 psql -U postgres postgres < backup.sql

# Start backend
docker-compose -f docker-compose.dev.yml up -d backend
```

### Volume Backup

```bash
# Backup PostgreSQL data volume
docker run --rm -v climastat_pgdata_dev:/data -v $(pwd):/backup ubuntu tar czf /backup/pgdata_backup.tar.gz /data

# Restore volume
docker run --rm -v climastat_pgdata_dev:/data -v $(pwd):/backup ubuntu tar xzf /backup/pgdata_backup.tar.gz -C /
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:**
```
Error starting userland proxy: listen tcp4 0.0.0.0:4000: bind: address already in use
```

**Solution:**
```bash
# Find process using port (Windows)
netstat -ano | findstr :4000

# Find process using port (Linux/Mac)
lsof -i :4000

# Kill the process or change port in .env.dev
BACKEND_PORT=5000
```

#### 2. Database Connection Failed

**Error:**
```
error: connect ECONNREFUSED 172.18.0.2:5432
```

**Solution:**
```bash
# Check database health
docker-compose -f docker-compose.dev.yml ps

# View database logs
docker-compose -f docker-compose.dev.yml logs db

# Restart database
docker-compose -f docker-compose.dev.yml restart db

# Wait for health check
docker-compose -f docker-compose.dev.yml up -d
```

#### 3. No Data in Database

**Symptom:** API returns empty arrays

**Solution:**
```bash
# Check if initial fetch completed
docker-compose -f docker-compose.dev.yml logs backend | grep "initialFetchAll"

# Manually trigger fetch for city ID 1
curl -X POST http://localhost:4000/api/cities/1/fetch

# Check database
docker exec -it climastat-db-1 psql -U postgres -c "SELECT COUNT(*) FROM measurements_hourly;"
```

#### 4. Containers Keep Restarting

**Check logs:**
```bash
docker-compose -f docker-compose.dev.yml logs --tail=50
```

**Common causes:**
- Syntax error in code (check backend logs)
- Database not ready (increase healthcheck interval)
- Out of memory (check `docker stats`)
- Missing environment variables

**Solution:**
```bash
# Full restart with rebuild
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build
```

#### 5. Hot Reload Not Working

**Symptom:** Code changes not reflected

**Solution:**
```bash
# Check volume mount
docker inspect climastat-backend-1 | grep -A 10 Mounts

# Restart backend
docker-compose -f docker-compose.dev.yml restart backend

# If still not working, rebuild
docker-compose -f docker-compose.dev.yml up -d --build backend
```

#### 6. Disk Space Issues

**Check disk usage:**
```bash
# Docker disk usage
docker system df

# Clean up
docker system prune -a --volumes
```

**Warning:** This removes all unused containers, networks, images, and volumes!

#### 7. Materialized View Not Refreshing

**Check cron execution:**
```bash
docker-compose -f docker-compose.dev.yml logs backend | grep "Refreshing materialized view"
```

**Manual refresh:**
```bash
docker exec -it climastat-db-1 psql -U postgres -c "REFRESH MATERIALIZED VIEW CONCURRENTLY latest_measurement_per_city;"
```

---

## Security Considerations

### Development Environment

**Current Status:**
- ✅ Non-root user in containers
- ✅ SQL injection prevention (parameterized queries)
- ⚠️ Default credentials (fine for dev)
- ⚠️ Exposed ports on host
- ⚠️ No authentication
- ⚠️ CORS allows all origins

### Production Recommendations

1. **Change Default Credentials:**
```env
POSTGRES_PASSWORD=<strong-random-password>
```

2. **Use Secrets Management:**
- Docker secrets
- HashiCorp Vault
- AWS Secrets Manager
- Azure Key Vault

3. **Enable SSL/TLS:**
```env
DB_SSL=true
```

4. **Restrict CORS:**
```javascript
// backend/index.js
app.use(cors({
  origin: 'https://your-frontend-domain.com'
}));
```

5. **Add Rate Limiting:**
```bash
npm install express-rate-limit
```

6. **Implement Authentication:**
- JWT tokens
- OAuth 2.0
- API keys

7. **Network Isolation:**
```yaml
# docker-compose.prod.yml
networks:
  backend:
    internal: true  # No external access
  frontend:
    # External access only
```

8. **Read-only Filesystems:**
```yaml
services:
  backend:
    read_only: true
    tmpfs:
      - /tmp
```

9. **Resource Limits:**
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 512M
```

10. **Regular Updates:**
```bash
# Update base images
docker-compose pull
docker-compose up -d --build
```

---

## Performance Optimization

### Database Tuning

**Edit PostgreSQL settings (production):**
```yaml
services:
  db:
    command:
      - postgres
      - -c
      - shared_buffers=256MB
      - -c
      - max_connections=100
      - -c
      - work_mem=4MB
```

### Connection Pooling

Already configured in `backend/db.js` using `pg.Pool`.

**Tune pool size:**
```javascript
// backend/db.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Caching (Future)

Consider adding Redis:
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

---

## Next Steps

1. **Development:**
   - Follow this guide to deploy locally
   - Make code changes
   - Test with provided endpoints
   - Commit to Git

2. **Production Preparation:**
   - Create production Dockerfile
   - Set up managed database
   - Configure CI/CD pipeline
   - Implement monitoring

3. **Scaling:**
   - Add load balancer
   - Implement horizontal scaling
   - Set up auto-scaling policies

---

## Quick Reference

**Start development environment:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

**Stop environment:**
```bash
docker-compose -f docker-compose.dev.yml down
```

**View logs:**
```bash
docker-compose -f docker-compose.dev.yml logs -f backend
```

**Backup database:**
```bash
docker exec climastat-db-1 pg_dump -U postgres postgres > backup.sql
```

**Access database:**
```bash
docker exec -it climastat-db-1 psql -U postgres
```

**Test API:**
```bash
curl http://localhost:4000/health
```

---

## Additional Resources

- **Docker Documentation:** https://docs.docker.com/
- **Docker Compose Reference:** https://docs.docker.com/compose/compose-file/
- **PostgreSQL Docker Image:** https://hub.docker.com/_/postgres
- **Node.js Docker Best Practices:** https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md

---

*Last Updated: 2025-01-16*
