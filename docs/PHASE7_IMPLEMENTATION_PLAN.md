# SitePulse — Phase 7: Production Hardening, Deployment Readiness & Final Polish Implementation Plan

**Date:** November 1, 2026  
**Status:** Approved & Ready for Execution  
**Phase:** 7 (Final Phase)  
**Workspace:** `SitePulse_AIML`  

---

## 1. Current Architecture & Deployment Dependencies

SitePulse is a full-stack, data-driven construction monitoring and decision-support platform designed for commercial retail fitouts.

### 1.1 Architecture Topology
- **Frontend:** Single-Page Application (HTML5, Vanilla CSS, Vanilla JavaScript) served statically via Express (`/app`).
  - Views: Executive Portfolio (`#view-dashboard`), Project Deep Dive (`#view-project`), Trade & Contractor Analytics (`#view-analytics`), AI Copilot (`#view-copilot`).
  - Client Modules: `js/auth.js` (Supabase Auth & Session), `js/api.js` (Centralized HTTP Client), `script.js` (State Store & View Controller), `config.js` (Environment Config).
- **Core Backend:** Node.js (v20+) & Express.js (`backend/src/`).
  - Entry Point: `server.js` (Port 3000).
  - Routes: `/health`, `/me`, `/portfolio`, `/projects`, `/copilot`.
  - Middleware: Bearer Token Auth (`auth.js`), RBAC (`authorization.js`), Central Error Handler (`errorHandler.js`).
  - Database Layer: `pg` Pool with SSL support + canonical in-memory repository fallback (`db/client.js`).
- **Machine Learning Inference Service:** Python 3.10+ & FastAPI (`backend/ml_service/`).
  - Microservice running on Port 8000.
  - Models: HistGradientBoosting Project Delay Classifier (`model/risk_classifier/`), Hybrid Anomaly Detector (Isolation Forest + Domain Rules in `model/anomaly/`).
- **AI Decision Support Copilot:** Provider-independent LLM orchestration layer (`backend/src/services/aiCopilotService.js`).
  - Adapters: OpenAI (`gpt-4o-mini`), Google Gemini (`gemini-1.5-flash`), Anthropic (`claude-3-5-sonnet`), and Deterministic Mock Engine.
  - Telemetry Grounding: `backend/src/services/copilotContextService.js`.
  - Defenses: Sliding-window rate limiter, regex prompt injection firewall, read-only operational guardrails.

### 1.2 Deployment Dependencies
- Node.js >= 20.0.0
- Python >= 3.10 with `fastapi`, `uvicorn`, `scikit-learn`, `joblib`, `pandas`, `numpy`
- PostgreSQL 15+ (or Supabase Postgres instance)
- Optional External LLM API credentials (`LLM_API_KEY` for OpenAI, Gemini, or Anthropic)

---

## 2. Audit Findings & Classification

| ID | Severity | Category | Description | Proposed Fix |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | **High** | Security / Info Leak | Centralized error handler (`errorHandler.js`) exposes raw `err.message` in production 500 errors, potentially leaking database driver internals, SQL syntax, or file paths. | Mask internal 500 errors in production (`NODE_ENV === 'production'`) with generic error messages while logging sanitized details. |
| **SEC-02** | **High** | Security Headers | `app.js` lacks standard enterprise HTTP security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `HSTS`, `X-XSS-Protection`) and exposes `X-Powered-By`. | Add enterprise security headers middleware and call `app.disable('x-powered-by')`. |
| **SEC-03** | **High** | Database Reliability | `backend/src/db/client.js` initializes `pg.Pool` without registering `pool.on('error')`. An idle client disconnection throws an unhandled exception and crashes the process. | Register `pool.on('error', ...)` handler to log connection loss and recover safely. |
| **AI-01** | **High** | AI Copilot Providers | `aiCopilotService.js` had provider definitions for Gemini and Anthropic, but lacked concrete REST calling adapters, falling back to mock. | Implement concrete `callGemini` and `callAnthropic` adapter functions with structured request formatting, response parsing, error handling, and timeout enforcement. |
| **AI-02** | **Medium** | AI Transparency | Mock provider was not explicitly badged as a test adapter in responses. | Add explicit `isTestProvider: true` badge in usage and documentation to guarantee zero deception. |
| **OPS-01** | **High** | Configuration | `.env.example` lacks ML service variables, LLM provider configurations, timeouts, and `NODE_ENV`. | Overhaul `.env.example` to document all operational, ML, and AI variables with clear examples. |
| **OPS-02** | **Medium** | Observability | `GET /health` only checks ML service; does not verify database connectivity, Copilot provider status, uptime, or memory metrics. | Enhance `GET /health` to report multi-subsystem status (`database`, `ml_service`, `copilot`, `uptime`, `memory`). |
| **OPS-03** | **Medium** | Process Reliability | `server.js` lacks `unhandledRejection` and `uncaughtException` process listeners. | Add graceful process event handlers in `server.js`. |
| **OPS-04** | **Medium** | Deployment Preparation | Repository lacks Docker containerization for multi-service deployment. | Create production-grade `Dockerfile` for Express backend, `backend/ml_service/Dockerfile` for FastAPI, and root `docker-compose.yml`. |
| **GIT-01** | **Low** | Repo Cleanliness | `.gitignore` does not ignore Python cache files (`__pycache__`, `*.pyc`). | Update `.gitignore` with Python and environment cache patterns. |
| **UI-01** | **Medium** | Accessibility & Quality | Frontend view switching requires full ARIA tabpanel roles and keyboard navigation polish. | Ensure all tabs and panels have semantic ARIA attributes (`role="tabpanel"`, `aria-labelledby`, visible focus rings). |

---

## 3. Proposed Fixes & Affected Files

### 3.1 Backend Security & Reliability
- **[backend/src/middleware/errorHandler.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/middleware/errorHandler.js):**
  - Sanitize production 500 error messages.
  - Avoid leaking stack traces, table names, or SQL parameters.
- **[backend/src/app.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/app.js):**
  - Disable `x-powered-by`.
  - Add security headers middleware: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` (in production).
  - Add JSON payload limit: `express.json({ limit: '1mb' })`.
- **[backend/src/db/client.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/db/client.js):**
  - Attach `pool.on('error', ...)` listener.
  - Implement `checkConnection()` helper for health checks.
- **[backend/src/server.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/server.js):**
  - Add `process.on('unhandledRejection')` and `process.on('uncaughtException')`.
  - Ensure pool and server close gracefully with a 10-second force-kill safeguard.
- **[backend/src/routes/health.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/routes/health.js):**
  - Upgrade health endpoint to check PostgreSQL / in-memory store, ML microservice, and Copilot configuration.

### 3.2 AI Copilot Adapter Completion
- **[backend/src/services/aiCopilotService.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/services/aiCopilotService.js):**
  - Implement `callGemini(config, systemPrompt, message, history, timeoutMs)`.
  - Implement `callAnthropic(config, systemPrompt, message, history, timeoutMs)`.
  - Explicitly identify mock provider as `isTestProvider: true`.

### 3.3 Deployment Preparation & Containerization
- **[.env.example](file:///c:/Users/piyus/Desktop/SitePulse_AIML/.env.example):**
  - Complete environment documentation covering Node, Postgres, Supabase, FastAPI ML, and AI Copilot.
- **[.gitignore](file:///c:/Users/piyus/Desktop/SitePulse_AIML/.gitignore):**
  - Add `__pycache__/`, `*.py[cod]`, `.pytest_cache/`, `*.egg-info/`, `.env*` safety.
- **[Dockerfile](file:///c:/Users/piyus/Desktop/SitePulse_AIML/Dockerfile):**
  - Multi-stage Node.js 20 production container.
- **[backend/ml_service/Dockerfile](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/ml_service/Dockerfile):**
  - Python 3.10 container serving Uvicorn FastAPI.
- **[docker-compose.yml](file:///c:/Users/piyus/Desktop/SitePulse_AIML/docker-compose.yml):**
  - Orchestrates `postgres`, `ml-service`, and `sitepulse-backend` with service health checks and network isolation.

### 3.4 Frontend Accessibility & Polish
- **[index.html](file:///c:/Users/piyus/Desktop/SitePulse_AIML/index.html) & [style.css](file:///c:/Users/piyus/Desktop/SitePulse_AIML/style.css):**
  - Add `role="tabpanel"` and `aria-labelledby` on all views (`#view-dashboard`, `#view-project`, `#view-analytics`, `#view-copilot`).
  - Add visible keyboard focus states (`:focus-visible`) across interactive buttons, tabs, and form controls.

---

## 4. Validation Strategy

1. **Automated Backend & Security Tests (`backend/tests/phase7_hardening.test.js`):**
   - Security headers verification (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).
   - Production error masking (500 internal error does not leak stack trace).
   - Upgraded `/health` endpoint verification (reports DB, ML service, Copilot, uptime).
   - Provider adapter request/response validation (OpenAI, Gemini, Anthropic, Mock).
   - Rate limiting and payload size limit rejection (`413 Payload Too Large`).
   - Graceful shutdown handlers.
2. **Regression Testing:**
   - Run complete Node.js test suite (`npm test`).
   - Run Python test suite (`npm run test:py`).
3. **Browser Smoke Testing:**
   - Verify all 4 suite views, theme toggles, date changes, and Copilot queries in live browser session.

---

## 5. Deployment Readiness Checklist

- [ ] Security headers active on all HTTP responses.
- [ ] Production 500 error messages sanitized (no stack traces or DB details).
- [ ] Database connection pool idle error listener attached.
- [ ] Multi-tenant isolation verified on all routes.
- [ ] AI Copilot provider adapters fully implemented with timeout handling.
- [ ] Comprehensive `/health` endpoint monitoring all subsystems.
- [ ] `.env.example` fully documented.
- [ ] `.gitignore` updated to exclude Python caches and credentials.
- [ ] `Dockerfile` and `docker-compose.yml` created and verified.
- [ ] Zero Git commits or pushes without user authorization.
- [ ] Complete documentation created (`PRODUCTION_DEPLOYMENT_GUIDE.md`, `SECURITY_CHECKLIST.md`, `FINAL_PROJECT_ARCHITECTURE.md`, `PHASE7_IMPLEMENTATION_REPORT.md`, `README.md`).
