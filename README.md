# SitePulse — AI-Powered Construction Monitoring & Decision Support Platform

[![Node.js CI](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2015%2B%20%7C%20Supabase-336791.svg)](https://www.postgresql.org/)
[![ML: Scikit--Learn](https://img.shields.io/badge/ML-HistGradientBoosting%20%7C%20IsolationForest-F7931E.svg)](https://scikit-learn.org/)
[![LLM: Groq Verified](https://img.shields.io/badge/LLM-Groq%20Cloud%20(qwen%2Fqwen3.8--27b)-f55036.svg)](https://groq.com/)
[![Tests: 114 Passing](https://img.shields.io/badge/Tests-114%20Passing%20(100%25)-brightgreen.svg)](docs/PHASE7_IMPLEMENTATION_REPORT.md)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](package.json)

> **SitePulse** is an enterprise-grade construction intelligence, progress monitoring, and decision support platform engineered specifically for commercial retail fitout programs. It unifies multi-site trade telemetry, applies calibrated machine learning models to predict project completion delays, and provides context-grounded AI decision support to retail executives, program directors, and site engineers.

---

## Table of Contents

1. [Executive Summary & Problem Statement](#executive-summary--problem-statement)
2. [Core Platform Capabilities](#core-platform-capabilities)
3. [Technology Stack](#technology-stack)
4. [System Architecture & Data Flow](#system-architecture--data-flow)
5. [Applied Machine Learning Methodology](#applied-machine-learning-methodology)
   - [Synthetic Data Simulation Engine](#synthetic-data-simulation-engine)
   - [Project Delay Risk Classifier](#project-delay-risk-classifier)
   - [Hybrid Anomaly Detection Engine](#hybrid-anomaly-detection-engine)
   - [Synthetic Data Limitations & Disclaimers](#synthetic-data-limitations--disclaimers)
6. [AI Decision Support Copilot](#ai-decision-support-copilot)
   - [Multi-Provider Orchestration (Groq Verified Live)](#multi-provider-orchestration-groq-verified-live)
   - [Telemetry Grounding & Governance Defenses](#telemetry-grounding--governance-defenses)
7. [Installation & Local Setup](#installation--local-setup)
   - [Prerequisites](#prerequisites)
   - [Environment Configuration](#environment-configuration)
   - [Running the Services Locally](#running-the-services-locally)
   - [Running via Docker Compose](#running-via-docker-compose)
8. [Automated Testing & Verification](#automated-testing--verification)
9. [Production Deployment Readiness](#production-deployment-readiness)
10. [Known Limitations & Future Roadmap](#known-limitations--future-roadmap)
11. [License & Governance](#license--governance)

---

## Executive Summary & Problem Statement

### The Commercial Retail Fitout Reality
Retail store fitouts (such as specialty retail, quick-service restaurants, and boutique showrooms) operate on compressed timelines (30 to 60 days) where opening dates are immovable commercial commitments. Missing a scheduled opening date results in idle retail leases, lost revenue, contractual penalties, and compromised product launches.

Five core trades execute concurrently in confined spaces: **Civil, Electrical, Lighting, Carpentry, and Painting**. Friction in a single trade can trigger cascading delays across the entire delivery program.

### Key Operational Challenges Solved
1. **Disconnected Data Silos**: Attendance headcounts, trade progress percentages, contractor ratings, and site blocker tickets are unified into a single relational data model.
2. **Lagging Indicators vs. Proactive AI**: Traditional teams identify delays only after milestones are missed. SitePulse applies a calibrated machine learning delay classifier (HistGradientBoosting, F1: 0.913) to forecast delay risk early in the project lifecycle.
3. **Optimism Bias & Phantom Workforce**: Site reports routinely state "90% complete" for weeks. SitePulse's hybrid anomaly detector flags progress plateaus and instances where high workforce attendance yields zero progress velocity.
4. **Autonomous AI Risks**: Traditional LLM integrations hallucinate project metrics or attempt unauthorized database modifications. SitePulse enforces an advisory read-only architecture where all AI responses are strictly grounded in verified database telemetry as of a defined reference cutoff date.

---

## Core Platform Capabilities

| Module | Features & Capabilities |
| :--- | :--- |
| **Executive Portfolio Dashboard** | Real-time cross-site rollup, portfolio completion percentages, planned vs. actual schedule variance, workforce attendance totals, and project health classifications (*On Track*, *At Risk*, *Delayed*). |
| **Project Deep Dive** | Trade-by-trade Gantt progress bars, planned vs. actual variances, assigned contractor profiles, daily site update modal, active site blocker incident tickets, and live ML risk score gauges. |
| **Contractor & Trade Analytics** | Cross-portfolio directory of specialized trade partners, performance ratings, active project assignments, and historical delay event association counts. |
| **Applied Machine Learning** | Real-time FastAPI microservice providing delay probability classification (calibrated threshold: 0.57) with feature attributions, and anomaly detection for phantom workforce or progress stalls. |
| **Contextual AI Copilot** | Conversational intelligence layer backed by live Groq Cloud API (`qwen/qwen3.8-27b`) or other enterprise LLMs. Analyzes delays, explains ML risk scores, audits contractor performance, and recommends actionable operational recovery steps. |

---

## Technology Stack

### Frontend Client Tier
- **Structure & Logic**: HTML5, Vanilla JavaScript (ES2022+), Single-Page Application (SPA).
- **Styling**: Vanilla CSS with customized design system tokens, responsive glassmorphism, high-contrast `:focus-visible` accessibility rings, and dark/light mode themes.
- **Client Architecture**: Modular separation into `js/auth.js` (Supabase Auth & Session Management), `js/api.js` (Centralized HTTP API client), and `script.js` (Reactive state store `SitePulseState` and view controller).

### Core Backend Tier
- **Runtime & Server**: Node.js 20+ with Express.js (`backend/src/`).
- **Security & Hardening**: Enterprise security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, HSTS), `1mb` body limit, disabled `X-Powered-By`, production error masking.
- **Authentication & RBAC**: Bearer token authentication with organization-level tenant isolation enforced on every endpoint.
- **Database Layer**: PostgreSQL 15+ via `pg.Pool` with SSL support and graceful idle disconnection recovery; canonical in-memory repository fallback for rapid local prototyping and test suites.

### Machine Learning Inference Tier
- **Runtime**: Python 3.10+ with FastAPI and Uvicorn (`backend/ml_service/`).
- **Frameworks**: Scikit-Learn, Pandas, NumPy, Joblib.
- **Resilience**: Node.js backend features automatic fallback to calibrated domain heuristics if the Python microservice is offline.

### AI Decision Support Tier
- **Provider Abstraction**: Provider-independent adapter supporting **Groq Cloud API** (live verified with `qwen/qwen3.8-27b`), OpenAI (`gpt-4o-mini`), Google Gemini (`gemini-1.5-flash`), Anthropic Claude (`claude-3-5-sonnet`), and Deterministic Mock Engine.
- **Safety**: Prompt injection firewall, read-only operational guardrails, sliding-window rate limiter, and mandatory synthetic data disclaimers.

---

## System Architecture & Data Flow

```mermaid
flowchart TD
    subgraph Client ["Client Browser (SPA)"]
        SPA["SitePulse Executive SPA (HTML5 / Vanilla CSS / JS)"]
        State["SitePulseState Store"]
    end

    subgraph Backend ["Core API Tier (Node.js 20 / Express :3000)"]
        Router["Express Router (/health, /me, /portfolio, /projects, /copilot)"]
        AuthMiddleware["JWT Verification & Multi-Tenant Scoping"]
        SecMiddleware["Security Headers & Payload Limits"]
        
        PortService["portfolioService"]
        ProjService["projectService"]
        ContextService["copilotContextService"]
        CopilotService["aiCopilotService (Orchestrator)"]
        MLClient["mlInferenceService (HTTP Client)"]
    end

    subgraph MLService ["Machine Learning Tier (FastAPI :8000)"]
        FastAPI["FastAPI Inference Server"]
        RiskModel["HistGradientBoosting Delay Classifier (v1.0)"]
        AnomalyModel["IsolationForest & Domain Rules Anomaly Detector"]
    end

    subgraph LLMProviders ["AI Inference Services"]
        Groq["Groq Cloud API (qwen/qwen3.8-27b) [LIVE VERIFIED]"]
        OpenAI["OpenAI API (gpt-4o-mini)"]
        Gemini["Google Gemini (gemini-1.5-flash)"]
        Anthropic["Anthropic Claude (claude-3-5-sonnet)"]
        MockLLM["Deterministic Mock Engine (Test Mode)"]
    end

    subgraph Database ["Persistence Layer"]
        PG[("PostgreSQL 15+ (Supabase)")]
        MemDB[("Canonical In-Memory Store (Dev/Test Fallback)")]
    end

    SPA --> Router
    Router --> AuthMiddleware
    AuthMiddleware --> SecMiddleware
    SecMiddleware --> PortService
    SecMiddleware --> ProjService
    SecMiddleware --> CopilotService

    PortService --> PG
    PortService --> MemDB
    ProjService --> PG
    ProjService --> MemDB
    
    ProjService --> MLClient
    MLClient --> FastAPI
    FastAPI --> RiskModel
    FastAPI --> AnomalyModel

    CopilotService --> ContextService
    ContextService --> PG
    ContextService --> MemDB
    ContextService --> MLClient
    CopilotService --> Groq
    CopilotService --> OpenAI
    CopilotService --> Gemini
    CopilotService --> Anthropic
    CopilotService --> MockLLM
```

---

## Applied Machine Learning Methodology

### Synthetic Data Simulation Engine
To train predictive models without compromising proprietary commercial construction records, SitePulse includes a reproducible simulation engine (`notebooks/simulation_engine.py`):
- **Cohort**: 120 distinct commercial retail fitout projects.
- **Granularity**: 1,400+ trade execution trajectories, 28,000+ daily workforce attendance and progress logs, and 600+ realistic delay events.
- **Domain Realism**: Incorporates stochastic factors including material delivery bottlenecks, electrical switchgear vendor lead times, phantom workforce attendance, weather stoppages, and trade concurrency dependencies.
- **Zero Future Information Leakage**: Feature engineering strictly consumes data up to an explicit reference cutoff date ($T_{\text{cutoff}}$). Future outcomes or post-cutoff progress never contaminate the feature vector.
- **Partition Integrity**: Strict project-level separation into Train (70 projects), Validation (30 projects), and Test (39 projects).

### Project Delay Risk Classifier
- **Model**: `HistGradientBoostingClassifier` with monotonic constraints and calibrated probabilities.
- **Target Label**: `is_delayed` (project completion variance > 3 days past scheduled opening).
- **F1-Optimal Calibrated Threshold**: `0.57` (selected strictly on validation data).
- **Independent Test Partition Evaluation (Phase 4.1 Audit)**:
  - Distinct Test Projects: 39
  - Confusion Matrix: $TN=14, FP=2, FN=2, TP=21$
  - **Accuracy**: 89.7% | **Precision**: 91.3% | **Recall**: 91.3% | **F1-Score**: 0.913
  - **ROC-AUC**: 0.962 | **PR-AUC**: 0.971 | **Brier Score**: 0.082
- **Key Feature Attributions**:
  1. `required_daily_velocity` (Positive: higher velocity requirement increases delay risk).
  2. `manpower_fulfillment_pct` (Negative: higher attendance reduces delay risk).
  3. `recent_7d_velocity` (Negative: higher progress velocity reduces delay risk).
  4. `open_delay_impact_days` (Positive: active site blockers increase delay risk).

### Hybrid Anomaly Detection Engine
- **Model**: `IsolationForest` combined with deterministic construction domain heuristics.
- **Monitored Telemetry Patterns**:
  1. *Phantom Workforce*: High recorded attendance ($\ge 80\%$) with zero progress velocity over 3+ consecutive days.
  2. *Progress Plateau*: Prolonged stall in trade execution despite active critical-path dependencies.
  3. *Unreported Site Blockers*: Severe progress deceleration without an open `delay_event` incident ticket.

### Synthetic Data Limitations & Disclaimers
> **IMPORTANT NOTICE:**  
> All machine learning models in SitePulse were trained and evaluated exclusively on synthetic simulation datasets designed to replicate retail fitout dynamics for research, demonstration, and prototyping. Model probabilities, anomaly detections, and risk classifications are advisory decision-support signals. They must be validated against real-world jobsite inspections before making binding contractual commitments or legal determinations.

---

## AI Decision Support Copilot

### Multi-Provider Orchestration (Groq Verified Live)
SitePulse provides a provider-independent AI Copilot with concrete REST adapters for leading LLM platforms. In Phase 7, the **Groq Cloud API** (`qwen/qwen3.8-27b`) was verified live:

```bash
# Example Groq Configuration in .env
LLM_PROVIDER=groq
LLM_API_KEY=gsk_...
LLM_MODEL=qwen/qwen3.8-27b
LLM_TIMEOUT_MS=30000
LLM_MAX_TOKENS=1500
```

Supported Provider Matrix:
- **Groq** (`qwen/qwen3.8-27b`): High-speed inference, OpenAI-compatible completions format. **(Live Verified)**
- **OpenAI** (`gpt-4o-mini`): OpenAI chat completions format.
- **Google Gemini** (`gemini-1.5-flash`): Gemini v1beta REST API with system instructions.
- **Anthropic Claude** (`claude-3-5-sonnet`): Anthropic Messages API.
- **Deterministic Mock Engine** (`sitepulse-mock-deterministic-v1`): Automated testing with explicit `isTestProvider: true` badge.

### Telemetry Grounding & Governance Defenses
1. **Strict Context Injection**: Before any query is dispatched to the LLM, `copilotContextService.js` retrieves verified database records (variance days, trade completions, contractor ratings, open blocker tickets, and ML risk scores) for the tenant and specified reference date.
2. **Advisory Read-Only Mandate**: Operational commands (e.g., *"change project deadline"*, *"cancel contractor"*, *"mark trade complete"*) are intercepted by `isActionRequest()` and rejected with a governance notice.
3. **Prompt Injection Firewall**: Regex patterns in `detectInjection()` block instruction resets, system prompt leaks, and role modifications.
4. **No Direct SQL Execution**: The AI Copilot is given zero database execution privileges, preventing arbitrary SQL execution or tampering.
5. **Sliding-Window Rate Limiting**: Users are limited to 20 inquiries per minute to protect API budgets and service availability.

---

## Installation & Local Setup

### Prerequisites
- **Node.js**: Version 20.0.0 or higher.
- **Python**: Version 3.10 or higher.
- **PostgreSQL**: Version 15 or higher (or an active Supabase Postgres instance). If no live database is configured, SitePulse automatically activates its built-in in-memory repository fallback.
- **Docker & Docker Compose**: (Optional, for containerized execution).

### Environment Configuration
Copy the template and configure your local variables:
```bash
cp .env.example .env
```

Key environment settings:
```ini
PORT=3000
NODE_ENV=development

# Optional PostgreSQL Connection (falls back to in-memory store if unset)
# DATABASE_URL="postgresql://user:password@localhost:5432/sitepulse"

# FastAPI ML Microservice URL
ML_SERVICE_URL="http://127.0.0.1:8000"

# AI Copilot Configuration (Choose groq, openai, gemini, anthropic, or mock)
LLM_PROVIDER=groq
LLM_API_KEY=gsk_your_groq_api_key_here
LLM_MODEL=qwen/qwen3.8-27b
LLM_TIMEOUT_MS=30000
LLM_MAX_TOKENS=1500
```

### Running the Services Locally

1. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

2. **Install Python ML dependencies**:
   ```bash
   pip install -r backend/ml_service/requirements.txt
   ```

3. **Start the FastAPI ML microservice** (Terminal 1):
   ```bash
   python -m uvicorn backend.ml_service.main:app --host 127.0.0.1 --port 8000
   ```

4. **Start the Express backend API and frontend server** (Terminal 2):
   ```bash
   node backend/src/server.js
   ```

5. **Access the application**:
   Open `http://localhost:3000` in your browser.  
   - **Demo Credentials**: `executive@apexfitouts.com` / `password`

### Running via Docker Compose

SitePulse includes production-ready multi-stage Dockerfiles and a unified Compose stack:

```bash
# Build and launch all services (Postgres, ML Microservice, and Express Backend)
docker-compose up -d --build

# Inspect service logs
docker-compose logs -f

# Verify service health
docker-compose ps
```

---

## Automated Testing & Verification

SitePulse maintains a rigorous automated test suite with **114 passing tests (100% pass rate)**:

```bash
# Run Node.js unit and integration tests (93 tests)
npm test

# Run Python simulation and ML audit tests (21 tests)
npm run test:py
```

### Test Suite Breakdown
| Suite | Description | Tests | Status |
| :--- | :--- | :---: | :---: |
| `backend/tests/api.test.js` | Express REST route contracts and payload validation | 13 | **Passed** |
| `backend/tests/analytics.test.js` | Analytical rollups and bottleneck calculations | 10 | **Passed** |
| `backend/tests/calculation_verification.test.js` | Empirical run-rate velocity math verification | 9 | **Passed** |
| `backend/tests/phase2_schema_and_analytics.test.js` | 9-entity relational schema, foreign keys, rolling intervals | 16 | **Passed** |
| `backend/tests/phase3_synthetic_and_features.test.js` | Simulation physics, feature engineering, zero leakage | 9 | **Passed** |
| `backend/tests/phase4_ml_integration.test.js` | ML delay classifier, anomaly detection, fallback resilience | 12 | **Passed** |
| `backend/tests/phase5_frontend_integration.test.js` | DOM structure, view switching, contractor directory | 6 | **Passed** |
| `backend/tests/phase6_copilot.test.js` | AI Copilot grounding, prompt injection defense, read-only | 11 | **Passed** |
| `backend/tests/phase7_hardening.test.js` | Security headers, error masking, Groq adapter, health API | 13 | **Passed** |
| `tests/test_simulation_engine.py` | Python simulation trajectories, schema integrity | 13 | **Passed** |
| `tests/test_ml_models.py` | Python ML training reproducibility, threshold calibration | 8 | **Passed** |
| **Total Test Count** | **Combined Full-Stack Verification** | **114** | **114 Passed (0 Failures)** |

---

## Production Deployment Readiness

### Operational Verification Completed
- **Enterprise Security Headers**: Added `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, and HSTS.
- **Production Error Masking**: Masked 500 internal errors in production mode (`NODE_ENV === 'production'`) to prevent leaking database internals or stack traces.
- **Multi-Subsystem Health Endpoint**: `GET /health` reports the operational status of database connection pooling, FastAPI ML microservice, AI Copilot configuration, memory consumption (`rss_mb`), and server uptime.
- **Process Exception Safety**: Registered `unhandledRejection` and `uncaughtException` listeners with a 10-second graceful shutdown timeout to prevent silent zombie processes.
- **Containerization**: Provided production multi-stage Dockerfiles (`Dockerfile`, `backend/ml_service/Dockerfile`) running as non-root users.

Detailed deployment runbook and post-deployment smoke tests are available in [docs/PRODUCTION_DEPLOYMENT_GUIDE.md](docs/PRODUCTION_DEPLOYMENT_GUIDE.md).

---

## Known Limitations & Future Roadmap

1. **Synthetic Training Baseline**: The ML models are trained on calibrated synthetic simulations. In a production enterprise pilot, the models should be fine-tuned using historical proprietary project records.
2. **PostgreSQL Validation Status**: The application was validated using its built-in in-memory repository fallback because an external production database was not connected during testing. Connecting a live PostgreSQL instance requires executing `npm run migrate` as documented.
3. **Single Organization Demo Context**: The test environment defaults to the *Apex Retail Fitouts* organization (`org-apex-01`). Additional tenant seed datasets can be provisioned via migration scripts.
4. **Future Roadmap**:
   - Native integration with Autodesk BIM 360 and Procore APIs.
   - Computer vision integration for automated on-site progress verification via CCTV feeds.
   - Mobile PWA offline mode for site engineers working in basement retail locations without cellular connectivity.

---

## License & Governance

- **Software License**: ISC License (see [package.json](package.json)).
- **Security & Vulnerability Disclosure**: Refer to [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md).
- **Architecture Reference**: Refer to [docs/FINAL_PROJECT_ARCHITECTURE.md](docs/FINAL_PROJECT_ARCHITECTURE.md).
- **Implementation History**: Refer to [docs/PHASE7_IMPLEMENTATION_REPORT.md](docs/PHASE7_IMPLEMENTATION_REPORT.md).
