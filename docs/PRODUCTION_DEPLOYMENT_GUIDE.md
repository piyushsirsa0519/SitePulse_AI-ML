# SitePulse — Production Deployment Guide

**Version:** 1.0.0  
**Phase:** 7 (Production Hardening & Deployment Readiness)  
**Workspace:** `SitePulse_AIML`  
**Target Audience:** DevOps Engineers, Cloud Architects, Site Reliability Engineers  

---

## 1. Production Architecture Overview

SitePulse is structured into three decoupled operational tiers:

```
[ Client Browsers ]
       │  (HTTPS / TLS 1.3)
       ▼
[ Reverse Proxy / Ingress Gateway (Nginx / Cloudflare / AWS ALB) ]
       │
       ├─────────────────────────────────┐
       ▼ (Port 3000)                     ▼ (Port 8000)
[ Express API & SPA Suite ]       [ FastAPI ML Microservice ]
  - Node.js 20+ Runtime             - Python 3.10+ Runtime
  - Static Asset Delivery           - Serialized ML Models (IsolationForest,
  - Auth & RBAC (Supabase JWT)        HistGradientBoosting Delay Classifier)
  - AI Copilot Orchestrator         - Scikit-learn Inference
       │                                 │
       └────────────────┬────────────────┘
                        │
                        ▼ (Port 5432)
       [ PostgreSQL 15+ Relational Database ]
         - Multi-tenant Construction Schema
         - Migration Pipeline (`node-pg-migrate`)
         - Stores, Contractors, Trades, Manpower, Delays
```

---

## 2. System Requirements & Prerequisites

### 2.1 Hardware Requirements
- **Production Minimal:** 2 vCPU, 4 GB RAM, 20 GB SSD storage.
- **Recommended for Enterprise (>100 active stores):** 4 vCPU, 8 GB RAM, 50 GB NVMe SSD.

### 2.2 Software Prerequisites
- **Operating System:** Ubuntu 22.04 LTS, Debian 12, or Alpine Linux (in container).
- **Node.js:** Runtime version >= 20.0.0 (`node -v`).
- **Python:** Version >= 3.10 (`python --version`).
- **Database:** PostgreSQL >= 15.0 or Supabase managed database instance.
- **Container Engine:** Docker Engine >= 24.0 and Docker Compose >= 2.20.

---

## 3. Environment Configuration & Secret Management

All runtime configuration is managed through environment variables. Never commit `.env` to Git.

Copy `.env.example` to create `.env`:
```bash
cp .env.example .env
chmod 600 .env
```

### 3.1 Core Configuration Variables

```ini
# ------------------------------------------------------------------------------
# 1. CORE BACKEND & HTTP SERVER CONFIGURATION
# ------------------------------------------------------------------------------
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://sitepulse.example.com

# ------------------------------------------------------------------------------
# 2. RELATIONAL DATABASE (POSTGRESQL / SUPABASE)
# ------------------------------------------------------------------------------
DATABASE_URL=postgresql://sitepulse_user:StrongPassword123@db.example.com:5432/sitepulse?sslmode=require

# ------------------------------------------------------------------------------
# 3. SUPABASE AUTHENTICATION
# ------------------------------------------------------------------------------
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ------------------------------------------------------------------------------
# 4. ML INFERENCE MICROSERVICE
# ------------------------------------------------------------------------------
ML_SERVICE_URL=http://127.0.0.1:8000
ML_PREDICTION_TIMEOUT_MS=1500

# ------------------------------------------------------------------------------
# 5. AI COPILOT PROVIDER CONFIGURATION
# ------------------------------------------------------------------------------
# Active Provider: 'openai' | 'gemini' | 'anthropic' | 'mock'
LLM_PROVIDER=openai
LLM_API_KEY=sk-proj-prodKeyABC123...
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=25000
```

---

## 4. Database Provisioning & Migration Pipeline

### 4.1 Running Migrations
SitePulse uses `node-pg-migrate` with raw SQL migrations in `migrations/`:

```bash
# Execute forward migrations to create canonical relational schema
DATABASE_URL="postgresql://user:pass@host:5432/sitepulse" npm run migrate
```

### 4.2 Seed Initial Production Metadata (Optional)
To initialize default organization roles and master trades:
```bash
node backend/db/seed.js
```

### 4.3 Database Rollback Procedure
If a migration rollback is required:
```bash
node node_modules/node-pg-migrate/bin/node-pg-migrate down -m migrations --migration-file-language sql
```

---

## 5. Containerized Deployment (Recommended)

SitePulse includes production-ready Dockerfiles and a root `docker-compose.yml`.

### 5.1 Build and Launch via Docker Compose
```bash
# 1. Build images and start all three services in background
docker compose up -d --build

# 2. Inspect container status and health
docker compose ps

# 3. Stream consolidated operational logs
docker compose logs -f --tail=100
```

### 5.2 Container Health Check Verification
All containers feature built-in Docker health checks:
```bash
docker inspect --format='{{json .State.Health.Status}}' sitepulse-backend
# Output: "healthy"

docker inspect --format='{{json .State.Health.Status}}' sitepulse-ml-service
# Output: "healthy"
```

---

## 6. Bare-Metal & Virtual Machine Deployment (Systemd / PM2)

If deploying directly onto Linux virtual machines without Docker:

### 6.1 Install Dependencies
```bash
# Install Node.js production dependencies
npm ci --omit=dev

# Install Python ML dependencies
pip install -r backend/ml_service/requirements.txt
```

### 6.2 Process Management via PM2
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'sitepulse-backend',
      script: 'backend/src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'sitepulse-ml',
      script: 'python -m uvicorn backend.ml_service.main:app --host 127.0.0.1 --port 8000 --workers 2',
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
```

Launch with PM2:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

---

## 7. Edge Gateway & Nginx Reverse Proxy Configuration

Configure Nginx as a TLS-terminating reverse proxy in front of Express:

```nginx
server {
    listen 80;
    server_name sitepulse.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name sitepulse.example.com;

    ssl_certificate /etc/letsencrypt/live/sitepulse.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sitepulse.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Client body limit (matches Express 1mb limit)
    client_max_body_size 1M;

    # Security Headers at Edge
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

---

## 8. Post-Deployment Smoke Test Runbook

Execute these verification checks immediately following deployment:

| Step | Endpoint / Action | Expected Result | Verification Command |
| :--- | :--- | :--- | :--- |
| **1** | System Health | HTTP 200 with `status: ok` and all subsystem flags | `curl -f https://sitepulse.example.com/health` |
| **2** | Security Headers | `X-Content-Type-Options: nosniff`, no `X-Powered-By` | `curl -I https://sitepulse.example.com/` |
| **3** | Unauthenticated Access | HTTP 401 Unauthorized on protected routes | `curl -s -o /dev/null -w "%{http_code}" https://sitepulse.example.com/portfolio` -> `401` |
| **4** | Authenticated Portfolio | HTTP 200 with active projects array | `curl -H "Authorization: Bearer <TOKEN>" https://sitepulse.example.com/portfolio` |
| **5** | ML Health & Prediction | HTTP 200 with model loaded flags | `curl -H "Authorization: Bearer <TOKEN>" https://sitepulse.example.com/projects/<ID>/risk-score` |
| **6** | Copilot Grounding | HTTP 200 with grounded telemetry response | `curl -X POST -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"message":"portfolio status"}' https://sitepulse.example.com/copilot/chat` |

---

## 9. Backup, Recovery & Disaster Planning

1. **Database Automated Backups:** Run daily automated snapshots via `pg_dump`:
   ```bash
   pg_dump -Fc -Z 9 sitepulse > /backups/sitepulse_$(date +%F).dump
   ```
2. **Disaster Recovery RTO & RPO:**
   - **Recovery Point Objective (RPO):** < 1 hour (using WAL archiving or Supabase PITR).
   - **Recovery Time Objective (RTO):** < 15 minutes (spin up container stack and restore snapshot).
