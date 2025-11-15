# 🌦️ ClimaStat — Public Data Intelligence Dashboard

ClimaStat is a backend-first project that ingests real-time weather data from **Open-Meteo** and stores it in **PostgreSQL** using a scheduled ETL pipeline.  
The backend is fully Dockerized and ready for production-style workflows.

🛑 **Note:** The **frontend is NOT ready yet** — only backend code exists right now.

---

## 📌 Features (Backend Only)

- Fetches **hourly weather data** from Open-Meteo API
- Stores readings in PostgreSQL (`measurements_hourly`)
- Automatic **scheduled fetch every 20 minutes**
- Full **city master list sync**
- Materialized view for **latest snapshot** per city
- Clean service-based architecture:
  - `/services/fetcher.js` — API fetch + DB insert
  - `/routes/*.js` — Express endpoints
  - `/scheduler.js` — cron jobs
  - `/maintenance.js` — retention + MV refresh
  - `/db.js` — pooled DB connection

---

## 📁 Project Structure

```
ClimaStat/
│
├── backend/
│   ├── index.js
│   ├── db.js
│   ├── scheduler.js
│   ├── maintenance.js
│   ├── routes/
│   ├── services/
│   ├── sql/
│   │   ├── create_schema.sql
│   │   ├── 04_create_mat_view.sql
│   │   └── ...
│   ├── Dockerfile.dev
│   └── nodemon.json
│
├── docker-compose.dev.yml
├── .gitignore
└── README.md
```

---

## 🚀 Running the Backend (Development)

### **1. Start Docker services**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

This launches:
- Postgres (`db`)
- Express backend (`backend`)
- Adminer UI (`adminer`)

---

## 🗄 Adminer (DB UI)

Open in browser:

```
http://localhost:8080
```

Login:

```
System: PostgreSQL
Server: db
Username: postgres
Password: <your password>
Database: postgres
```

---

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/cities` | List all cities |
| GET | `/api/city/:id/hourly` | Latest 72 hourly rows |
| GET | `/api/cities/latest` | Latest snapshot per city |
| POST | `/api/cities` | Add new city |
| POST | `/api/cities/:id/fetch` | Manually fetch data |

---

## ⏱️ Scheduler Overview

| Task | Frequency |
|------|-----------|
| Initial fetch for all cities | On startup |
| Periodic fetch | Every 20 minutes |
| Materialized view refresh | Every 5 minutes |
| Data retention (optional) | Daily |

---

## 🧪 Tech Stack

- **Node.js + Express.js**
- **PostgreSQL 15**
- **Docker / Docker Compose**
- **Open-Meteo API**
- **Adminer** for DB UI

---

## 📝 TODO (Upcoming)

- [ ] Build frontend (React + Vite)
- [ ] Charts (Recharts / Chart.js)
- [ ] City search UI
- [ ] Dashboard layout
- [ ] Deployment (Render + Vercel)

---

## 📄 License

MIT License — free to use and modify.

---

## 👤 Author

Roshit Dahat  
ClimaStat project – 2025