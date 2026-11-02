# SitePulse — Final Data Consistency, AI Copilot & UI Refinement Report

**Audit & Resolution Date:** November 2, 2026  
**Status:** All Issues Resolved, Verified in Browser & 114 Test Cases Passing (93 Node.js + 21 Python)  
**Target Entity Under Audit:** P.TAL Homeware – Hyderabad (`prj-ptal-homeware`) & Global Portfolio Views

---

## 1. Executive Summary & Root Cause Analysis

A systematic end-to-end investigation was conducted across backend calculation services, API responses, frontend state machines, Groq LLM context generation, and DOM rendering logic. Below are the root causes uncovered and corrected:

### Issue 1.1: "-16d Delayed" vs "16 days ahead of deadline" Contradiction
* **Root Cause:**
  In `backend/src/services/projectService.js`, the deterministic completion forecast uses the bottleneck trade (Civil, running at a daily progress rate of 2% from Day 21 at 42% progress), projecting physical completion on October 30, 2026. Because the target contractual deadline is November 15, 2026, the projected finish is 16 days before the deadline, resulting in `delayDays = -16`.
  However, in `script.js` (`renderPortfolioCardsGrid`), the condition checked:
  ```javascript
  if (p.delayDays > 3 || p.healthStatus === 'Behind Schedule') {
    statusLabel = `${p.delayDays}d Delayed`;
  }
  ```
  Because P.TAL Homeware had `healthStatus === 'Behind Schedule'` (Civil and Lighting trades were lagging behind target milestones), this branch evaluated to `true`, string-interpolating `"-16d Delayed"`. Meanwhile, the priority ranking list correctly evaluated negative numbers as `Math.abs(delayDays) + ' days ahead of deadline'`.
* **Correction:**
  Updated `renderPortfolioCardsGrid` to distinguish progress variance lag from schedule overrun. When `p.delayDays <= 0` but the project is flagged `Behind Schedule`, it renders `${Math.abs(variance)}% Behind` (e.g., `5% Behind`), eliminating the nonsensical negative delay label.

### Issue 1.2: Project Selector Tab Badge ("On Track") vs Project Header ("Behind Schedule")
* **Root Cause:**
  In `script.js` (`renderProjectSelector`), the tab badge was derived solely from `project.delayDays > 0 ? project.delayDays + 'd late' : 'On Track'`. Because `delayDays` was `-16`, `-16 > 0` was `false`, causing the selector tab to unconditionally label P.TAL Homeware as `On Track`.
  In contrast, the Project Overview header evaluated `metrics.healthStatus` (`Behind Schedule`, because 2 trades were lagging).
* **Correction:**
  Updated `renderProjectSelector` to inspect `project.healthStatus`:
  ```javascript
  const statusBadge = project.healthStatus === 'Behind Schedule'
    ? `<span class="project-pill-badge behind">Behind</span>`
    : project.healthStatus === 'Needs Attention'
    ? `<span class="project-pill-badge attention">Attention</span>`
    : `<span class="project-pill-badge on-track">On Track</span>`;
  ```
  Both the selector tab and the project header now consistently display `Behind` / `Behind Schedule`.

### Issue 1.3: AI Copilot Telemetry Confusion (52% actual vs 36%, 29/37 workers vs 25/35)
* **Root Causes:**
  1. **UI Scope Sync:** In `script.js`, switching projects in the Project Deep Dive view updated `activeProjectId`, but did not synchronize the Copilot scope dropdown (`SitePulseState.copilot.selectedProjectId`), leaving Copilot scoped to "Entire Active Portfolio".
  2. **Portfolio Context Ambiguity:** In `backend/src/services/copilotContextService.js` (`getPortfolioContext`), `p.variance` (-5% for P.TAL, -8% for Cafe Chai Point) was mislabeled under key `varianceDays: p.variance`. When asking Copilot a portfolio-level question about delayed projects, the LLM saw Chai Point as the primary delayed site and quoted Chai Point's metrics (52% actual, 60% planned, 29/37 workers) instead of P.TAL Homeware.
  3. **Groq OTPM Limit (429 Error):** When querying Groq's `qwen/qwen3.8-27b`, the default `maxTokens: 1200` exceeded Groq free-tier's 1000 output tokens per minute (OTPM) limit, causing intermittent 429 errors.
* **Corrections:**
  1. Synchronized `selectProject(projectId)` to update both `SitePulseState.copilot.selectedProjectId` and the `#copilot-project-select` DOM selector.
  2. In `copilotContextService.js`, added explicit fields: `variancePct`, `projectedDelayDays`, `projectedFinishDate`, `primaryBottleneck`, and fallback `deadline`.
  3. In `aiCopilotService.js`, added explicit prompt grounding rules distinguishing milestone variance percentage from timeline delay days.
  4. Reduced default `maxTokens` in `callGroq` from `1200` to `800`, completely avoiding Groq OTPM rate limits while preserving comprehensive responses.

### Issue 1.4: Carpentry Progress "+ Ahead" when Actual Equals Planned
* **Root Cause:**
  In `script.js` (`renderTradeMatrixView`), the condition was `const statusBadge = gap > 0 ? ... : ...`. When `gap === 0` (Carpentry: Avg 55%, Plan 55%), it fell into the `else` branch displaying `+ Ahead` with a green badge.
* **Correction:**
  Updated the condition to explicitly handle `gap === 0`:
  ```javascript
  const statusBadge = gap > 5
    ? `<span class="status-badge error"><i class="ph-bold ph-warning"></i> Bottleneck</span>`
    : gap > 0
    ? `<span class="status-badge warning"><i class="ph-bold ph-warning-circle"></i> Lagging</span>`
    : gap === 0
    ? `<span class="status-badge success"><i class="ph-bold ph-check-circle"></i> Healthy</span>`
    : `<span class="status-badge success"><i class="ph-bold ph-trend-up"></i> Ahead</span>`;
  ```
  The variance pill displays `On Plan` when `gap === 0`.

### Issue 1.5: Contractor Active-Site Counts & Pluralization
* **Root Cause:**
  In `portfolioService.js`, `getContractorsData` counted assignments without de-duplicating by `project_id`. In `script.js`, contractor cards displayed `1 Open Issues` instead of singular `1 Open Issue`.
* **Correction:**
  Updated `getContractorsData` to count unique project IDs: `new Set(assignments.map(ca => ca.project_id)).size`.
  Updated contractor card template to use proper singular/plural grammar: `${c.activeSites} ${c.activeSites === 1 ? 'Store' : 'Stores'}` and `${c.openIssues} ${c.openIssues === 1 ? 'Open Issue' : 'Open Issues'}`.

### Issue 1.6: Contractor Directory Grid Layout (Isolated 5th Card)
* **Root Cause:**
  `.contractors-grid` previously used an ad-hoc 4-column layout that wrapped the 5th card alone on a second row.
* **Correction:**
  Updated `.contractors-grid` in `style.css` to `grid-template-columns: repeat(3, 1fr)` with responsive breakpoints (`repeat(2, 1fr)` at 1024px, `1fr` at 640px). Desktop now neatly displays 3 cards on the top row and 2 cards on the bottom row.

### Issue 1.7: Raw Markdown Asterisks & Horizontal Scrollbar in Copilot
* **Root Causes:**
  1. `formatMarkdownText()` used simple regex replacements that didn't convert multi-line bullet lists (`* ` or `- `) into HTML `<ul><li>...</li></ul>` and didn't strip unparsed asterisks, resulting in visible `**` or `*` in the UI.
  2. `.copilot-suggestions-bar` and `.suggestion-chips-wrapper` had `flex-wrap: nowrap` and `overflow-x: auto`, producing an unsightly horizontal scrollbar.
* **Corrections:**
  1. Overhauled `formatMarkdownText()` to cleanly parse block elements (`#`, `##`, `###`, `####`, list items with `* `, `- `, `• `, and `1. `) and inline elements (`**bold**`, `*italic*`, `` `code` ``), eliminating raw unformatted asterisks.
  2. Set `.copilot-suggestions-bar` and `.suggestion-chips-wrapper` to `flex-wrap: wrap; overflow-x: visible;`, allowing chips to wrap naturally.

### Issue 1.8: Copilot Chatbox Sizing and Viewport Usage
* **Root Cause:**
  `.copilot-layout-container` had a fixed height of `calc(100vh - 210px)`, creating double scrollbars (outer container + inner chat stream). The initial welcome bubble also occupied over 320px with bulky text blocks.
* **Correction:**
  - Removed fixed `100vh` on `.copilot-layout-container`.
  - Set `.copilot-chat-stream` to `height: 420px; min-height: 380px; max-height: 450px; overflow-y: auto;`.
  - Streamlined the initial welcome bubble with compact capability tags, saving ~200px of vertical space.
  - Anchored `#copilot-input-container` neatly below the stream with single clear vertical scrolling.
  - Implemented `scrollCopilotStreamToBottom(force)`.

---

## 2. Metric Verification Across All Four Views

### P.TAL Homeware – Hyderabad (`prj-ptal-homeware`) Before vs After

| View | Metric | Before Audit | After Correction | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Executive Portfolio** | Progress Badge | `-16d Delayed` (Contradictory) | `5% Behind` | Verified (Consistent) |
| **Executive Portfolio** | Actual vs Plan | `36% vs 41%` (-5% variance) | `36% vs 41%` (-5% variance) | Verified (Consistent) |
| **Executive Portfolio** | Workforce | `25 / 35` (71% fulfillment) | `25 / 35` (71% fulfillment) | Verified (Consistent) |
| **Executive Portfolio** | Primary Bottleneck | `Civil` | `Civil` | Verified (Consistent) |
| **Project Deep Dive** | Selector Tab Badge | `On Track` (Contradictory) | `Behind` | Verified (Matches Header) |
| **Project Deep Dive** | Header Status Badge | `Behind Schedule` | `Behind Schedule` | Verified (Matches Selector) |
| **Project Deep Dive** | Overall Progress | `36%` (Target: 41%) | `36%` (Target: 41%) | Verified (Consistent) |
| **Project Deep Dive** | Workforce | `25 / 35 On Site` (10 deficit) | `25 / 35 On Site` (10 deficit) | Verified (Consistent) |
| **Trade Analytics** | Carpentry Variance | `+ Ahead` (Contradictory) | `On Plan` | Verified (Correct) |
| **Trade Analytics** | Carpentry Status | `Healthy` | `Healthy` | Verified (Correct) |
| **Trade Analytics** | Contractor Layout | 5 cards, 1 isolated on row 2 | Balanced 3-column layout | Verified (Aesthetic) |
| **AI Copilot** | Progress / Target | `52% vs 60%` (Chai Point leakage) | `36% vs 41%` | Verified (Ground Truth) |
| **AI Copilot** | Workforce | `29/37` (Chai Point leakage) | `25/35` (5 Civil, 9 short) | Verified (Ground Truth) |
| **AI Copilot** | Markdown Rendering | Raw asterisks `**`, clipped | Clean `<strong>`, `<ul><li>` | Verified (No Asterisks) |

---

## 3. Files Modified & Exact Changes

1. **`backend/src/services/portfolioService.js`**
   - In `getPortfolioMetrics`, ensured `p.deadline`, `p.startDate`, and `p.store_id` are passed to `portfolioItems`.
   - In `getContractorsData`, updated in-memory fallback to count distinct active projects: `new Set(assignments.map(ca => ca.project_id)).size`.

2. **`backend/src/services/copilotContextService.js`**
   - In `getPortfolioContext`, enriched items with explicit `variancePct`, `projectedDelayDays`, `projectedFinishDate`, `primaryBottleneck`, and `deadline` fields. Retained `varianceDays` for backward compatibility with existing tests.

3. **`backend/src/services/aiCopilotService.js`**
   - In `buildSystemPrompt`, added explicit grounding instructions clarifying that negative `variancePct` denotes milestone progress lag, while `projectedDelayDays <= 0` denotes a forecast ahead of the contractual deadline.
   - In `callGroq`, set default `maxTokens: 800` to prevent exceeding Groq free tier limit of 1000 OTPM.
   - In `callMockProvider`, updated delayed filter and response formatting to reference `variancePct`.

4. **`style.css`**
   - `.contractors-grid`: Set `grid-template-columns: repeat(3, 1fr)` with responsive breakpoints for 2 columns (tablet) and 1 column (mobile).
   - `.copilot-layout-container`: Removed fixed `calc(100vh - 210px)` height.
   - `.copilot-chat-stream`: Added `height: 420px; min-height: 380px; max-height: 450px; overflow-y: auto;`.
   - `.copilot-suggestions-bar`, `.suggestion-chips-wrapper`: Changed `flex-wrap: nowrap` and `overflow-x: auto` to `flex-wrap: wrap; overflow-x: visible;`, removing horizontal scrollbar.
   - Added styles for `.copilot-welcome-tags`, `.welcome-tag-pill`, and markdown lists inside `.copilot-bubble-ai`.

5. **`index.html`**
   - Updated stylesheet link cache-buster to `style.css?v=3`.
   - Replaced bulky static text in `#copilot-chat-stream` welcome bubble with a streamlined, compact intro card with capability tags.

6. **`script.js`**
   - `renderPortfolioCardsGrid`: Evaluated `if (p.delayDays > 3) statusLabel = ... else if (p.healthStatus === 'Behind Schedule') statusLabel = `${Math.abs(variance)}% Behind``.
   - `renderProjectSelector`: Mapped tab status badge directly to `project.healthStatus` (`Behind`, `Attention`, `On Track`).
   - `renderTradeMatrixView`: Fixed variance badge to render `On Plan` when `gap === 0`.
   - `renderContractorsDirectory`: Fixed pluralization for stores and open issues.
   - `selectProject`: Added synchronization to update `SitePulseState.copilot.selectedProjectId` and `#copilot-project-select`.
   - `formatMarkdownText`: Complete rewrite to cleanly parse headers, bullet lists, bold, italics, code blocks, and strip raw markdown artifacts.
   - `scrollCopilotStreamToBottom`: Implemented non-intrusive auto-scrolling.

---

## 4. Test Suite Execution & Verification

### Node.js Backend & API Tests
```bash
npm test
```
**Result:** **93 / 93 tests passing** (0 failures).  
All auth, projectService, portfolioService, contractorService, and aiCopilotService suites passed.

### Python ML Service Tests
```bash
npm run test:py
```
**Result:** **21 / 21 tests passed in 5.37s** (0 failures).  
All delay classifier, anomaly detection, synthetic training, and FastAPI inference endpoint tests passed.

---

## 5. Visual Verification Screenshots

All four views were exercised and captured using real browser automation with the active backend and Groq LLM:

1. **Executive Portfolio Cards:**  
   `executive_portfolio_cards_1793574202900.png`  
   - P.TAL Homeware displays `5% Behind`, `36% Completed`, `-5% vs Plan (41%)`, `25 / 35` workforce, and `Civil` bottleneck.
2. **Project Deep Dive:**  
   `project_deep_dive_1793574229675.png`  
   - Project selector tab displays `Behind` badge, matching the header `Behind Schedule` status.
   - `36%` progress, `25 / 35` workforce, `10 workers short`.
3. **Trade Analytics:**  
   `trade_analytics_1793574245801.png`  
   - Carpentry displays `On Plan` with green `Healthy` badge.
4. **Contractors Directory:**  
   `contractor_directory_1793574250705.png`  
   - 3-column desktop layout (3 top row, 2 bottom row).
   - Correct pluralization: `1 Open Issue` (singular) and `Zero Issues`.
5. **AI Copilot Response & Layout:**  
   `copilot_response_1793574305106.png` & `copilot_response_top_1793574311699.png`  
   - Prompt: *"Provide an executive briefing on P.TAL Homeware: current progress vs plan, primary bottleneck trade, and active workforce status."*
   - Real Groq LLM response correctly cites: **36% actual vs 41% planned**, **Civil bottleneck**, **5 Civil workers vs 14 required (9 shortfall)**, and **25/35 total workforce**.
   - No raw asterisks; clean HTML headings, bolding, and bullet lists.
   - Compact height (420px), no horizontal scrollbars on suggestion chips.
