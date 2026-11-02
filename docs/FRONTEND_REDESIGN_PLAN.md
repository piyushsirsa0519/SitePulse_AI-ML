# SitePulse — Frontend Redesign Plan: Refined Data Visualization & Understated Enterprise Aesthetics

**Date:** November 2026  
**Reference Design:** [Aniket Aslaliya Case Studies](https://www.aniketaslaliya.dev/case-studies) & Refined Data Visualization Framework  
**Theme:** Calm, Sophisticated, Minimal, Professional & Comfortable for Extended Daily Usage  
**Palette:** Warm Neutrals, Muted Sage / Deep Forest Green, Architectural Slate & Charcoal  

---

## 1. Visual Inspection & Design Principles

### 1.1 Inspiration from Reference Site (`aniketaslaliya.dev/case-studies`)
- **Atmosphere**: Deep, warm, low-contrast dark canvas with subtle warmth (not cold neon blue).
- **Typography**: Dual-font hierarchy using `Sora` for confident headings / metrics and `DM Sans` for comfortable reading and data labels.
- **Micro-Kickers**: Section prefix lines and small tracked uppercase category labels (`— PORTFOLIO INTELLIGENCE`, `— ML RISK INFERENCE`).
- **Card Styling**: 1px delicate hairline borders (`rgba(255, 255, 255, 0.08)` in dark, `#e5e2da` in light), rounded corners (14px–18px), understated elevation, generous whitespace.
- **Index Badges**: Squircle pill counters (`01`, `02`, `03`) for projects and stages.
- **Subtle Accents**: Muted sage and warm terracotta used purposefully for status and hierarchy, never as loud decorative clutter.

### 1.2 Refined Data Visualization Principles
- **High Data-to-Ink Ratio**: Elimination of heavy drop shadows, plastic gradients, and thick borders.
- **Calm, Meaningful Color Mapping**:
  - *On Track / Optimal*: Muted Sage / Forest Green (`#48bb78` / `#2d5a4c`).
  - *Attention / Minor Variance*: Muted Warm Ochre / Terracotta (`#d97736` / `#c07d32`).
  - *Delayed / Critical Blocker*: Muted Brick Red (`#e0564c` / `#b91c1c`).
  - *Baseline / Target*: Architectural Slate (`#94a3b8` / `#64748b`).
- **Information-Rich KPI Cards**: Large delicate numerals with tabular spacing, small uppercase descriptors, and clean inline context pills.
- **Clear Visual Hierarchy**: Distinct primary metrics, secondary run-rate trends, and tertiary contractor tags.
- **Scannable Tables**: Hairline horizontal dividers, generous padding, muted column headers, and unobtrusive status badges.

---

## 2. Redesign Architecture & Color System

### 2.1 Color Tokens

#### Dark Theme (Default Canvas)
```css
--bg-primary: #0e1011;           /* Warm obsidian canvas */
--bg-secondary: #141719;         /* Elevated surface */
--bg-tertiary: #1b1f22;          /* Inset cards / inputs */
--bg-card: rgba(20, 23, 25, 0.88); /* Translucent glass card */
--bg-card-hover: #1f2428;        /* Interactive card hover */

--border-color: rgba(255, 255, 255, 0.07);
--border-highlight: rgba(72, 187, 120, 0.35); /* Subtle sage highlight */

--text-primary: #f4f4f0;         /* Warm ivory text */
--text-secondary: #9ca3af;       /* Slate grey */
--text-muted: #64748b;           /* Deep stone */

/* Accents */
--accent-sage: #52a488;          /* Primary brand sage */
--accent-forest: #2d5a4c;        /* Deep forest accent */
--accent-amber: #d97736;         /* Warm terracotta */
--accent-red: #e0564c;           /* Muted brick */
--accent-slate: #64748b;         /* Slate neutral */
```

#### Light Theme (Warm Architectural Canvas)
```css
--bg-primary: #f7f6f2;           /* Warm stone canvas */
--bg-secondary: #ffffff;         /* Pure white surface */
--bg-tertiary: #f1efe9;          /* Inset surfaces */
--bg-card: #ffffff;
--bg-card-hover: #f9f8f5;

--border-color: #e5e2da;         /* Warm stone border */
--border-highlight: #2d5a4c;

--text-primary: #181a1b;         /* Charcoal black */
--text-secondary: #4a4e51;       /* Medium slate */
--text-muted: #767c82;           /* Light stone */
```

---

## 3. View-by-View Implementation Plan

### 3.1 Global Header & Navigation
- Top navigation bar: Slimmer profile (64px), warm backdrop blur, minimalist brand logo with sage pulsing indicator.
- Subnav tabs: Restrained pill tabs with indicator dot and clean typography.
- Reference date picker & refresh button: Minimalist toolbar controls with hairline borders.

### 3.2 View 1: Executive Portfolio (`#view-dashboard`)
- **Executive KPI Bar**: Redesigned as a row of 7 minimalist metric cards with large tabular numbers, subtle micro-progress tracks, and small uppercase labels.
- **Filter & Search Toolbar**: Clean search bar with inset icon, status filter pills in muted sage/amber/red tints, and custom sort select.
- **Store Project Cards**: Inspired by reference site case-study modules:
  - Squircle index badges (`01`, `02`, `03`).
  - Dual-tone progress tracks with smooth percentage indicators.
  - Three-column quantitative metrics (Variance, Elapsed Days, Workforce).
  - Primary trade bottleneck callout with left accent border.
- **Cross-Portfolio Distribution Panels**: Clean progress comparison charts, contractor workforce allocations, and active blocker distributions.

### 3.3 View 2: Project Deep Dive (`#view-project`)
- Project selector bar: Clean toolbar with quick project switching.
- Core project metrics: 4 minimal stat cards.
- **ML Delay Risk Model Gauge**: Calibrated gauge displaying probability, optimal decision threshold (0.57), risk category badge, and top factor attribution bars.
- **Telemetry Anomaly Alert**: Refined callout box detailing phantom workforce or progress stall detections.
- **Trade Execution Breakdown**: Clean progress bars per trade, assigned contractor tags, and daily update button.
- **Active Delay Events Log**: Incident ticket cards with severity badges (`CRITICAL`, `HIGH`, `MEDIUM`), impact days, and root cause descriptions.

### 3.4 View 3: Trade & Contractor Analytics (`#view-analytics`)
- Section kicker: `— TRADE PARTNER DIRECTORY & PERFORMANCE AUDIT`.
- Contractor directory table: Restrained borders, star rating indicators, active assignment counts, and delay event counts.
- Trade matrix & workforce density charts: Clean data visualization grids.

### 3.5 View 4: AI Copilot Interface (`#view-copilot`)
- Provider status banner: Live Groq status badge (`GROQ qwen/qwen3.8-27b ● Online`) in muted sage.
- Suggested prompt chips: Clean pill tags with subtle hover states.
- Chat stream: Minimalist chat bubbles, botanical spark assistant icon, clean markdown typography, and evidence grounding callouts.
- Textarea input bar: Inset clean form with character counter and send button.

---

## 4. Execution Steps

1. **Step 1: Typography & Headings in `index.html`**
   - Include Google Fonts `DM Sans` and `Sora`.
   - Add kicker tags and clean up visual hierarchy while preserving all IDs and attributes.
2. **Step 2: Core CSS Overhaul in `style.css`**
   - Update CSS custom properties for warm neutral dark/light themes.
   - Refactor navigation, buttons, cards, typography, forms, and badges.
   - Implement minimal KPI cards and refined chart styles.
   - Style all 4 views cohesively.
3. **Step 3: Script & Dynamic Component Polish in `script.js`**
   - Enhance dynamic markup rendering for KPI cards, store cards, and project details to match the new design tokens.
4. **Step 4: Automated Testing**
   - Run `npm test` and `npm run test:py` to guarantee zero functional regressions.
5. **Step 5: Browser Verification**
   - Capture screenshots of all 4 redesigned views and review with user.
