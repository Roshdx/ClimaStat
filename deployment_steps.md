# ClimaStat - Docker Deployment Guide

This guide covers deploying the full ClimaStat stack (Backend + Frontend + Database) using Docker and Docker Compose.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Development Deployment](#development-deployment)
3. [Service Architecture](#service-architecture)
4. [Environment Configuration](#environment-configuration)
5. [Database Initialization](#database-initialization)
6. [Service Management](#service-management)
7. [Monitoring & Logs](#monitoring--logs)
8. [Backup & Restore](#backup--restore)
9. [Troubleshooting](#troubleshooting)
10. [Production Deployment (Future)](#production-deployment-future)

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
- 4 GB RAM
- 10 GB free disk space

**Recommended:**
- 4 CPU cores
- 8 GB RAM
- 20 GB free disk space

---

## Development Deployment

### Step 1: Clone Repository

```bash
git clone <repository-url> ClimaStat
cd ClimaStat

# Switch to development branch
git checkout development
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env.dev

# Optional: Edit environment variables
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

# Database Connection URL
DATABASE_URL=postgres://postgres:postgres@db:5432/postgres
```

### Step 3: Start All Services

```bash
# Start all services with build
docker-compose -f docker-compose.dev.yml up --build

# Or run in detached mode (background)
docker-compose -f docker-compose.dev.yml up -d --build
```

### Step 4: Access the Application

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend Dashboard** | http://localhost:5173 | React application |
| **Backend API** | http://localhost:4000 | Express REST API |
| **Adminer** | http://localhost:8080 | Database management UI |
| **Health Check** | http://localhost:4000/health | API health status |

**Adminer Login:**
```
System: PostgreSQL
Server: db
Username: postgres
Password: postgres
Database: postgres
```

---

## Service Architecture

### Docker Compose Services

| Service | Image | Port | Dependencies | Purpose |
|---------|-------|------|--------------|---------|
| `db` | postgres:15 | 5432 | None | PostgreSQL database |
| `backend` | Custom (Node 18) | 4000 | db (healthy) | Express API + Scheduler |
| `frontend-dev` | Custom (Node 22) | 5173 | backend (healthy) | Vite dev server |
| `adminer` | adminer:latest | 8080 | db | Database UI |

### Service Startup Order

1. **db** - PostgreSQL starts first
2. **backend** - Waits for db health check
3. **frontend-dev** - Waits for backend health check
4. **adminer** - Starts after db

### Network Configuration

All services communicate on the `climastat-net` bridge network:
- Frontend calls backend at `http://localhost:4000` (via host)
- Backend calls database at `db:5432` (via Docker network)

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
| `DB_SSL` | false | Enable SSL for DB |
| `ADMINER_PORT` | 8080 | Adminer web UI port |
| `DATABASE_URL` | postgres://... | Full connection string |

### Frontend Environment (docker-compose.dev.yml)

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_BASE` | http://localhost:4000 | Backend API URL |
| `CHOKIDAR_USEPOLLING` | true | File watch for Docker |
| `CHOKIDAR_INTERVAL` | 1000 | Polling interval (ms) |

### Customizing Ports

If ports are already in use, modify `.env.dev`:

```env
BACKEND_PORT=5000
POSTGRES_PORT=5433
ADMINER_PORT=9090
```

For frontend port, edit `docker-compose.dev.yml`:
```yaml
frontend-dev:
  ports:
    - "3000:5173"  # Change 3000 to desired port
```

---

## Database Initialization

### Automatic Initialization

On first startup, PostgreSQL executes SQL files from `backend/sql/`:

1. **01_create_schema.sql** - Tables and indexes
2. **02_create_mat_view.sql** - Materialized view

### Backend Initialization

After database is healthy, backend:

1. Syncs default city list (20 Indian cities)
2. Performs initial fetch for all cities (~30 seconds)
3. Starts cron jobs:
   - Weather fetch: every 20 minutes
   - Mat view refresh: every 5 minutes
   - Data retention: daily at 03:10 UTC

### Manual Re-initialization

**Warning:** This deletes all data!

```bash
# Stop and remove containers + volumes
docker-compose -f docker-compose.dev.yml down -v

# Start fresh
docker-compose -f docker-compose.dev.yml up --build
```

### Schema Updates (Without Data Loss)

```bash
# Connect to database
docker exec -it climastat-db-1 psql -U postgres

# Run SQL commands
ALTER TABLE cities ADD COLUMN IF NOT EXISTS region TEXT;
\q
```

---

## Service Management

### Starting Services

```bash
# Start all (foreground)
docker-compose -f docker-compose.dev.yml up

# Start all (background)
docker-compose -f docker-compose.dev.yml up -d

# Start with rebuild
docker-compose -f docker-compose.dev.yml up --build

# Start specific service
docker-compose -f docker-compose.dev.yml up frontend-dev
```

### Stopping Services

```bash
# Stop (keeps containers)
docker-compose -f docker-compose.dev.yml stop

# Stop and remove containers (keeps volumes)
docker-compose -f docker-compose.dev.yml down

# Stop and remove everything (DATA LOSS!)
docker-compose -f docker-compose.dev.yml down -v
```

### Restarting Services

```bash
# Restart all
docker-compose -f docker-compose.dev.yml restart

# Restart specific service
docker-compose -f docker-compose.dev.yml restart frontend-dev
docker-compose -f docker-compose.dev.yml restart backend

# Rebuild and restart
docker-compose -f docker-compose.dev.yml up -d --build --force-recreate
```

### Rebuilding After Changes

```bash
# After package.json changes
docker-compose -f docker-compose.dev.yml up --build

# Force rebuild without cache
docker-compose -f docker-compose.dev.yml build --no-cache
docker-compose -f docker-compose.dev.yml up
```

---

## Monitoring & Logs

### Viewing Logs

```bash
# All services (live)
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f frontend-dev
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f db

# Last 100 lines
docker-compose -f docker-compose.dev.yml logs --tail=100 backend

# Filter for errors
docker-compose -f docker-compose.dev.yml logs | grep -i error
```

### Container Status

```bash
# List containers
docker-compose -f docker-compose.dev.yml ps

# Resource usage
docker stats

# Inspect container
docker inspect climastat-backend-1
```

### Health Checks

**Backend Health:**
```bash
curl http://localhost:4000/health
# Expected: {"status":"ok","db":"ok","time":"..."}
```

**Database Health:**
```bash
docker exec climastat-db-1 pg_isready -U postgres
# Expected: accepting connections
```

**Frontend Health:**
- Open http://localhost:5173
- Check browser console for errors

### Key Log Messages

**Backend startup (healthy):**
```
backend-1  | Backend running on 4000
backend-1  | syncCities result: { active_count: '20' }
backend-1  | initialFetchAll: fetching 20 cities
backend-1  | Upserted 180 rows for Mumbai
backend-1  | Scheduler started
```

**Frontend startup (healthy):**
```
frontend-dev-1  | VITE v7.2.2  ready in 500 ms
frontend-dev-1  |   Local:   http://localhost:5173/
```

---

## Backup & Restore

### Database Backup

```bash
# Full backup
docker exec climastat-db-1 pg_dump -U postgres postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
docker exec climastat-db-1 pg_dump -U postgres postgres | gzip > backup.sql.gz

# Table-specific
docker exec climastat-db-1 pg_dump -U postgres -t measurements_hourly postgres > measurements.sql
```

### Database Restore

```bash
# Stop backend
docker-compose -f docker-compose.dev.yml stop backend frontend-dev

# Restore
docker exec -i climastat-db-1 psql -U postgres postgres < backup.sql

# Or from compressed
gunzip -c backup.sql.gz | docker exec -i climastat-db-1 psql -U postgres postgres

# Restart services
docker-compose -f docker-compose.dev.yml start backend frontend-dev
```

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR
docker exec climastat-db-1 pg_dump -U postgres postgres | gzip > "$BACKUP_DIR/climastat_$(date +%Y%m%d_%H%M%S).sql.gz"
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete  # Keep 7 days
```

---

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

**Error:**
```
bind: address already in use
```

**Solution:**
```bash
# Find process (Windows)
netstat -ano | findstr :5173
netstat -ano | findstr :4000

# Find process (Linux/Mac)
lsof -i :5173
lsof -i :4000

# Kill or change port in .env.dev / docker-compose.dev.yml
```

#### 2. Database Connection Failed

**Error:**
```
connect ECONNREFUSED
```

**Solution:**
```bash
# Check db health
docker-compose -f docker-compose.dev.yml ps

# View db logs
docker-compose -f docker-compose.dev.yml logs db

# Restart db
docker-compose -f docker-compose.dev.yml restart db
```

#### 3. Frontend Can't Connect to Backend

**Symptom:** Network errors in browser console

**Solution:**
- Verify `VITE_API_BASE=http://localhost:4000` in docker-compose
- Check backend is running: `curl http://localhost:4000/health`
- Check CORS configuration in backend

#### 4. No Data in Dashboard

**Symptom:** Empty charts and KPIs

**Solution:**
```bash
# Check initial fetch completed
docker-compose -f docker-compose.dev.yml logs backend | grep "initialFetchAll"

# Manually trigger fetch
curl -X POST http://localhost:4000/api/cities/1/fetch

# Check database
docker exec -it climastat-db-1 psql -U postgres -c "SELECT COUNT(*) FROM measurements_hourly;"
```

#### 5. Hot Reload Not Working

**Frontend:**
```bash
docker-compose -f docker-compose.dev.yml restart frontend-dev
```

**Backend:**
```bash
docker-compose -f docker-compose.dev.yml restart backend
```

#### 6. Out of Disk Space

```bash
# Check Docker disk usage
docker system df

# Clean up (removes unused resources)
docker system prune -a --volumes
```

---

## Production Deployment (Future)

### Not Yet Implemented

The current setup is development-only. Production deployment requires:

### Production Checklist

- [ ] Create `docker-compose.prod.yml`
- [ ] Create production Dockerfiles (no dev dependencies)
- [ ] Use `node index.js` instead of nodemon
- [ ] Use `npm run build && npm run preview` for frontend
- [ ] Configure reverse proxy (Nginx/Caddy)
- [ ] Use managed PostgreSQL
- [ ] Set up SSL/TLS certificates
- [ ] Configure secrets management
- [ ] Implement health monitoring
- [ ] Set up log aggregation
- [ ] Configure automated backups
- [ ] Implement CI/CD pipeline

### Example Production Dockerfile (Backend)

```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS build

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "index.js"]
```

### Example Production Dockerfile (Frontend)

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Example Production Docker Compose

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
      NODE_ENV: production
    ports:
      - "4000:4000"
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:4000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: always
    ports:
      - "80:80"
    depends_on:
      - backend
```

---

## Security Considerations

### Development (Current)

- Non-root Docker users
- SQL injection prevention
- CORS enabled
- Environment variables for config

### Production Requirements

1. **Change default credentials**
2. **Use secrets management** (Docker secrets, Vault)
3. **Enable SSL/TLS**
4. **Restrict CORS origins**
5. **Add rate limiting**
6. **Implement authentication**
7. **Network isolation**
8. **Resource limits**
9. **Regular updates**

---

## Quick Reference

### Start Development

```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Access Points

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Adminer: http://localhost:8080

### View Logs

```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Stop Everything

```bash
docker-compose -f docker-compose.dev.yml down
```

### Clean Restart

```bash
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build
```

### Backup Database

```bash
docker exec climastat-db-1 pg_dump -U postgres postgres > backup.sql
```

### Test API

```bash
curl http://localhost:4000/health
curl http://localhost:4000/api/cities
curl http://localhost:4000/api/cities/latest
```

---

## Additional Resources

- **Docker Documentation:** https://docs.docker.com/
- **Docker Compose Reference:** https://docs.docker.com/compose/
- **PostgreSQL Docker Image:** https://hub.docker.com/_/postgres
- **Node.js Docker Practices:** https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
- **Vite Deployment:** https://vitejs.dev/guide/static-deploy.html

---

*Last Updated: 2025-11-21*
