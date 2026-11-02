# SitePulse — Phase 5: UI Implementation Plan & Frontend Transformation

**Date:** 2026-11-01  
**Project:** SitePulse — AI-Powered Project Monitoring & Decision Support Platform  
**Target:** In-Place Upgrade of Existing Website (`index.html`, `script.js`, `style.css`, `js/api.js`)

---

## 1. Existing Page Inventory & Architecture Audit

### 1.1 Architecture & Entry Points
- **Single Page Application (SPA):** Static frontend delivered via standard HTML5, CSS3, and Vanilla JavaScript.
- **Entry Point:** [index.html](file:///c:/Users/piyus/Desktop/SitePulse_AIML/index.html)
- **Core Scripts:**
  - [config.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/config.js): Base API configuration (`http://localhost:3000` / production URL) and Supabase client keys.
  - [js/auth.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/js/auth.js): Authentication state manager supporting Supabase Auth and local development mock tokens (`mock-token-admin`, `mock-token-engineer`, `mock-token-viewer`).
  - [js/api.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/js/api.js): Centralized API client (`getMe`, `getPortfolio`, `getProjectDashboard`, `createDailyUpdate`).
  - [script.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/script.js): DOM manipulation, state management (`SitePulseState`), event handling, and view rendering.
- **Styling:** [style.css](file:///c:/Users/piyus/Desktop/SitePulse_AIML/style.css) containing CSS custom properties (tokens), Dark and Light themes, layout primitives, and component styles.

### 1.2 Existing Views & Sections Inventory
1. **Top Navigation Bar:** Brand identity, Live Tracker Mode status pill, real-time clock, user profile badge, sign-out button, theme toggle (Dark/Light).
2. **Project Selector Bar:** Tab pills and dropdown for project selection, "Post Daily Update" button (role-gated).
3. **Project Overview Section (`#project-overview-container`):** Executive card with project title, location, date range, health status pill, and 4 metric blocks (Overall Progress, Timeline, Active Trades, Workforce).
4. **Trades Breakdown Section (`#trades-breakdown-container`):** Bottleneck banner, trades table with actual vs planned progress tracks, on-site headcount, and status/reason tags.
5. **Bottleneck Analysis Section (`#bottleneck-analysis-container`):** Linear completion pace statement and smart action recommendations.
6. **Portfolio View Section (`#portfolio-view-container`):** Delay-severity sorted list of portfolio projects with bottleneck details and finish dates.
7. **Modals:**
   - Sign-In Modal (`#login-modal`): Email and password form with development demo credentials hint.
   - Daily Site Update Modal (`#daily-update-modal`): Multi-trade update modal with progress %, workers present/required, reason dropdown, notes, and batch submission.

### 1.3 Identified Limitations in Existing Implementation
- **Lack of High-Level Executive Portfolio Overview:** The portfolio is currently rendered only as a linear vertical list of items at the bottom of the page. It lacks portfolio-wide KPI rollups (total projects, projects at risk, average completion, total workforce).
- **Missing Phase 4 ML Integration in UI:** `GET /projects/:id/risk-score` and `GET /projects/:id/anomalies` are fully implemented in the Express backend, but are not consumed or rendered in the frontend.
- **No Dedicated View Navigation:** All views are currently stacked sequentially on a single long scrolling page without tabbed navigation between portfolio, project details, and trade/contractor analytics.
- **Missing Modernized Schema Entities in UI:** Modernized database tables (`stores`, `contractors`, `contractor_assignments`, `delay_events`, `manpower_log`) are populated in the backend, but are not visualized in the user interface.
- **Absence of Search and Filtering:** No search input to filter projects by name, city, or status.

---

## 2. Proposed Page Improvements & View Restructuring

Transform the layout into a tabbed enterprise suite with 3 dedicated views while preserving existing functionality and state persistence:

```
[ Top Navbar: Brand | Status | Real-Time Clock | User Profile | Theme | Logout ]
----------------------------------------------------------------------------------
[ Suite Navigation Tabs: 1. Executive Dashboard | 2. Project Deep Dive | 3. Trade & Contractor Analytics ]
----------------------------------------------------------------------------------
  View 1: Executive Dashboard (Portfolio Overview)
    - Executive Metric KPI Bar (7 key metrics: Total Projects, On Track, At Risk, Delayed, Overall %, Active Contractors, Workforce)
    - Search & Risk Filter Toolbar
    - Project Health Cards Grid (Visual cards with health pills, progress bars, ML delay risk tags, direct drill-down)
    - Portfolio Analytics Panels (Planned vs Actual comparison, workforce distribution, delay causes)

  View 2: Project Deep Dive (Upgraded Project Details)
    - Project Selector Bar (Tab pills, dropdown, search, "Post Daily Update" button)
    - Project Metadata & Executive Overview (4 metric blocks with enhanced visual hierarchy)
    - **Intelligent Project Insights Section (Phase 4 ML Integration):**
        * Delay Risk Intelligence Card (Score, threshold comparison, risk level, signed top contributing factors, explanation)
        * Anomaly Detection Card (Analyzed trades, detected anomalies, severity badges, supporting feature metrics, human explanations)
        * Model status & synthetic experimental disclaimer banner
        * Defensive empty state / insufficient history handling
    - Upgraded Trades Breakdown Table (Progress tracks, headcount ratio, assigned contractor, delay reason, quick update)
    - Bottleneck Projection & Resource Recommendation Card
    - Active Blockers & Delay Events Log (Real delay events from backend with root causes and mitigation actions)

  View 3: Trade & Contractor Analytics
    - Cross-project Trade Performance Matrix (Civil, Electrical, Lighting, Carpentry, Painting)
    - Manpower Utilization & Shortfall Analysis
    - Contractor Directory & Performance Cards (Specialty, rating, active assignments, delay incidents)
```

---

## 3. New Components Required

1. **`ViewSwitcherNav`**: Clean tabbed navigation control under the navbar with icons, active state indicators, and keyboard accessibility.
2. **`PortfolioSummaryKpiBar`**: 7-metric executive rollup bar showing portfolio health at a glance.
3. **`ProjectSearchAndFilterBar`**: Search input with instant filtering by project name/city, and status pill filter (`All`, `On Track`, `Attention Needed`, `Behind Schedule`).
4. **`ProjectHealthCard`**: Enhanced card component for portfolio grid with progress visualization, delay days, bottleneck indicator, and ML risk badge.
5. **`MlProjectInsightsPanel`**: Dedicated ML intelligence container hosting:
   - `RiskScoreCard`: Circular gauge/meter, calibrated probability, risk category badge, threshold indicator (0.57).
   - `FeatureAttributionsList`: Clean list of top factors with signed impact badges ($\pm$), standardized coefficients, and actionable explanations.
   - `AnomalyAlertsFeed`: Feed of detected anomalies with severity badges (`Critical`, `High`, `Medium`, `Low`), trigger categories, supporting numbers, and human explanations.
   - `MlStatusDisclaimerBanner`: Transparent notice explaining synthetic model scope and fallback/active status.
6. **`DelayEventsLogCard`**: Timeline / list component displaying real active delay events, severity, root causes, and mitigation progress.
7. **`ContractorDirectoryCard`**: Contractor profile cards showing trade specialty, rating stars, contact person, and assigned project count.
8. **`SkeletonLoader`**: CSS shimmer skeletons for cards, tables, and metric blocks during API fetch.

---

## 4. API Dependencies & Extensions

### 4.1 Existing Backend Endpoints Utilized
- `GET /me`: Authenticated user profile and organization scoping.
- `GET /portfolio`: Risk-sorted project portfolio.
- `GET /projects/:id/dashboard`: Core project metrics, trades, bottleneck, forecast, recommendation.
- `GET /projects/:id/risk-score`: Phase 4 Delay Risk Classification (calibrated score, category, threshold, top contributing factors, model status).
- `GET /projects/:id/anomalies`: Phase 4 Anomaly Detection (detected anomalies, severity, category, supporting metrics, explanation).
- `POST /projects/:id/updates`: Daily update submission for trades.

### 4.2 Minimal Backend Extensions (Preserving Compatibility)
- **Enrich `getPortfolioData`:** In [backend/src/services/portfolioService.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/services/portfolioService.js), include project summary metrics (`overallActual`, `overallPlanned`, `variance`, `healthStatus`, `totalWorkersPresent`, `totalWorkersRequired`, `activeContractorCount`) to eliminate redundant N+1 requests on the frontend while keeping the array shape and fields 100% backward compatible.
- **Enrich `getProjectDashboardData`:** In [backend/src/services/projectService.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/backend/src/services/projectService.js), include `delayEvents` and `contractors` from modernized schema tables for the active project.
- **Add Client API Functions:** In [js/api.js](file:///c:/Users/piyus/Desktop/SitePulse_AIML/js/api.js), add `getProjectRiskScore` and `getProjectAnomalies`.

---

## 5. Implementation Sequence

1. **Step 1: Backend Data Enrichment (Minimal & Safe)**
   - Update `portfolioService.js` to attach executive metrics to each portfolio project.
   - Update `projectService.js` to attach `delayEvents` and `contractors` to `dashboardData`.
   - Run `npm test` to verify 100% backward compatibility and test passing.
2. **Step 2: Frontend API Client Update**
   - Add `getProjectRiskScore` and `getProjectAnomalies` to `js/api.js`.
3. **Step 3: HTML Markup Structure Upgrade (`index.html`)**
   - Add navigation view switcher under navbar (`dashboard-view`, `project-view`, `analytics-view`).
   - Add container sections for Executive Overview KPIs, Search & Filter Bar, Project Health Grid, ML Insights Section, Delay Events Log, and Contractor Analytics.
4. **Step 4: Design System & Styling Enhancements (`style.css`)**
   - Add styles for View Switcher, KPI summary cards, ML Insights panel, factor attribution list, anomaly severity pills, delay events log, contractor cards, and skeleton loaders.
   - Ensure responsive layout across desktop, tablet, and mobile.
5. **Step 5: Frontend State & View Controller (`script.js`)**
   - Implement view switching logic (`activeView: 'dashboard' | 'project' | 'analytics'`).
   - Implement search and filtering for portfolio.
   - Implement rendering of Executive Portfolio Dashboard.
   - Implement rendering of ML Project Insights (calling `/risk-score` and `/anomalies` with fallback/insufficient history handling).
   - Implement rendering of Delay Events and Contractor Analytics.
   - Implement interactive navigation from portfolio cards to project details.
6. **Step 6: Validation, Testing & Verification**
   - Verify all existing tests pass (`npm test`, `npm run test:py`).
   - Add frontend unit/integration tests for new API methods and rendering logic.
   - Test responsive layout and authenticated workflows.
   - Capture screenshots and record video demo using browser subagent.
7. **Step 7: Final Documentation**
   - Produce `docs/PHASE5_IMPLEMENTATION_REPORT.md`.
