# SitePulse — Data Dictionary (Phase 2 Modernized Schema)

This document provides a comprehensive data dictionary for all relational tables, constraints, foreign keys, and analytical views in the **SitePulse** platform.

---

## 1. Table Definitions

### 1.1 `organizations`
Represents the top-level tenant boundary. Every project, user, store, and contractor belongs to an organization.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Unique identifier for the organization (e.g., `org-apex-retail`). |
| `name` | `VARCHAR(255)` | NO | | Legal or operational name of the organization. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record last modification timestamp. |

---

### 1.2 `users`
Application user identity, role-based access level, and mapping to external Supabase Auth.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Application user ID (e.g., `usr-admin-01`). |
| `supabase_auth_id` | `UUID` | YES | UNIQUE | Immutable UUID from Supabase Auth (`auth.users.id`). |
| `organization_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `organizations(id)` ON DELETE CASCADE | Scoped organization tenant ID. |
| `email` | `VARCHAR(255)` | NO | UNIQUE | Corporate login email address. |
| `full_name` | `VARCHAR(255)` | NO | | User's full display name. |
| `role` | `VARCHAR(50)` | NO | DEFAULT `'project_manager'` | Role for RBAC: `admin`, `manager`, `site_engineer`, `viewer`. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Timestamp when user was provisioned. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Timestamp when user was updated. |

---

### 1.3 `stores`
Physical retail store real estate asset master. Projects are executed within stores.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Store ID (e.g., `str-bb-cyberhub`). |
| `organization_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `organizations(id)` ON DELETE CASCADE | Tenant organization ID. |
| `store_code` | `VARCHAR(50)` | NO | UNIQUE per org (`uq_org_store_code`) | Client internal retail store identifier (e.g., `STR-BB-01`). |
| `name` | `VARCHAR(255)` | NO | | Display store name. |
| `brand` | `VARCHAR(100)` | NO | | Retail brand name (e.g., `Biryani Blues`, `Cafe Chai Point`). |
| `city` | `VARCHAR(100)` | NO | | Metro location / municipality (e.g., `Gurugram`, `Delhi`, `Hyderabad`). |
| `location_address` | `TEXT` | NO | | Detailed street or mall address. |
| `format` | `VARCHAR(50)` | NO | DEFAULT `'High Street'` | Retail format: `High Street`, `Mall`, `Food Court`, `Standalone`. |
| `target_launch_date` | `DATE` | YES | | Official retail store public opening milestone. |
| `square_footage` | `NUMERIC(8,2)` | YES | CHECK (`square_footage > 0`) | Gross floor area in square feet. |
| `status` | `VARCHAR(50)` | NO | DEFAULT `'fitout_in_progress'` | Status: `planning`, `fitout_in_progress`, `handover_ready`, `open`. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record update timestamp. |

---

### 1.4 `projects`
Specific interior fitout execution cycle for a store.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Unique project ID (e.g., `prj-biryani-blues`). |
| `organization_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `organizations(id)` ON DELETE CASCADE | Tenant organization ID. |
| `store_id` | `VARCHAR(64)` | YES | FK $\rightarrow$ `stores(id)` ON DELETE SET NULL | Associated physical store master record. |
| `name` | `VARCHAR(255)` | NO | | Project execution title. |
| `location` | `VARCHAR(255)` | NO | | City/regional location label (preserved for backward compatibility). |
| `start_date` | `DATE` | NO | | Site possession / construction start date. |
| `deadline` | `DATE` | NO | CHECK (`deadline >= start_date`) | Contractual handover target finish date. |
| `status` | `VARCHAR(50)` | NO | DEFAULT `'active'` | Project state: `active`, `completed`, `on_hold`. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Project record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Project record update timestamp. |

---

### 1.5 `contractors`
Subcontractor directory detailing specialized vendor trade capabilities and performance.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Contractor ID (e.g., `cnt-apex-civil`). |
| `organization_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `organizations(id)` ON DELETE CASCADE | Tenant organization ID. |
| `name` | `VARCHAR(255)` | NO | UNIQUE per org (`uq_org_contractor_name`) | Vendor company legal name. |
| `trade_specialty` | `VARCHAR(100)` | NO | | Primary trade capability: `Civil`, `Electrical`, `Lighting`, `Carpentry`, `Painting`. |
| `contact_person` | `VARCHAR(255)` | NO | | Lead project representative / account manager. |
| `contact_email` | `VARCHAR(255)` | YES | | Official vendor contact email. |
| `contact_phone` | `VARCHAR(50)` | YES | | Mobile or direct office phone number. |
| `rating` | `NUMERIC(3,2)` | YES | DEFAULT `4.00`, CHECK (`rating BETWEEN 1 AND 5`) | Historical contractor reliability rating (1.0 to 5.0). |
| `is_active` | `BOOLEAN` | NO | DEFAULT `true` | Vendor approval and active operational status. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Vendor registration timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Vendor last update timestamp. |

---

### 1.6 `trades`
Specialized execution work packages within a fitout project.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Unique trade package ID (e.g., `trd-bb-civil`). |
| `project_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `projects(id)` ON DELETE CASCADE | Parent project ID. |
| `name` | `VARCHAR(100)` | NO | UNIQUE (`project_id`, `name`) | Discipline name: `Civil`, `Electrical`, `Lighting`, `Carpentry`, `Painting`. |
| `planned_start` | `DATE` | YES | | Scheduled start date for this trade package. |
| `planned_end` | `DATE` | YES | | Scheduled handover date for this trade package. |
| `planned_pct` | `NUMERIC(5,2)` | NO | DEFAULT `0.00`, CHECK (`BETWEEN 0 AND 100`) | Baseline planned target percentage completion. |
| `default_workers_required` | `INTEGER` | NO | DEFAULT `0`, CHECK (`>= 0`) | Nominal planned daily workforce headcount quota. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record update timestamp. |

---

### 1.7 `contractor_assignments`
Formal assignment of a contractor to a project trade package with commercial valuation.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Assignment ID (e.g., `ca-bb-01`). |
| `project_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `projects(id)` ON DELETE CASCADE | Project ID. |
| `trade_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `trades(id)` ON DELETE CASCADE | Trade package ID. |
| `contractor_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `contractors(id)` ON DELETE CASCADE | Subcontractor company ID. |
| `assigned_date` | `DATE` | NO | DEFAULT `CURRENT_DATE` | Date contract was awarded/mobilized. |
| `contract_value` | `NUMERIC(12,2)` | YES | DEFAULT `0.00`, CHECK (`>= 0`) | Agreed contract package value in local currency (INR). |
| `status` | `VARCHAR(50)` | NO | DEFAULT `'active'` | Assignment status: `active`, `completed`, `terminated`. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record update timestamp. |

---

### 1.8 `daily_updates`
**Canonical site progress log table**. Records daily progress percentages, overall on-site headcounts, and delay reasons per trade.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Log ID (e.g., `upd-bb-civil-01` or `upd-<tradeId>-<date>`). |
| `trade_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `trades(id)` ON DELETE CASCADE | Associated trade package. |
| `date` | `DATE` | NO | UNIQUE (`trade_id`, `date`) | Date of progress execution (YYYY-MM-DD). |
| `progress_pct` | `NUMERIC(5,2)` | NO | CHECK (`progress_pct BETWEEN 0 AND 100`) | Cumulative completed progress percentage to date. |
| `workers_present` | `INTEGER` | NO | CHECK (`workers_present >= 0`) | Headcount of tradespeople actively on site. |
| `workers_required` | `INTEGER` | NO | CHECK (`workers_required >= 0`) | Quota of tradespeople required for this shift. |
| `reason` | `VARCHAR(255)` | NO | DEFAULT `'On Track'` | Primary status code or delay bottleneck category. |
| `notes` | `TEXT` | YES | | Free-form site supervisor observation log. |
| `created_by` | `VARCHAR(64)` | YES | FK $\rightarrow$ `users(id)` ON DELETE SET NULL | Author user ID submitting the update. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Record submission timestamp. |

---

### 1.9 `manpower_log`
Granular contractor-level workforce attendance per trade, shift, and supervisor.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Log ID (e.g., `mpl-cp-elec-01`). |
| `trade_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `trades(id)` ON DELETE CASCADE | Associated trade package. |
| `contractor_id` | `VARCHAR(64)` | YES | FK $\rightarrow$ `contractors(id)` ON DELETE SET NULL | Subcontractor supplying workforce. |
| `date` | `DATE` | NO | | Date of shift (YYYY-MM-DD). |
| `shift` | `VARCHAR(20)` | NO | DEFAULT `'day'` | Shift identifier: `day`, `night`. |
| `workers_present` | `INTEGER` | NO | CHECK (`workers_present >= 0`) | Number of verified workers clocked in on site. |
| `workers_required` | `INTEGER` | NO | CHECK (`workers_required >= 0`) | Contractually agreed workforce headcount. |
| `supervisor_name` | `VARCHAR(255)` | YES | | On-site contractor supervisor or gang leader. |
| `overtime_hours` | `NUMERIC(4,1)` | NO | DEFAULT `0.0`, CHECK (`>= 0`) | Total contractor overtime hours executed. |
| `notes` | `TEXT` | YES | | Specific workforce notes. |
| `logged_by` | `VARCHAR(64)` | YES | FK $\rightarrow$ `users(id)` ON DELETE SET NULL | User who verified headcount. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Log creation timestamp. |

---

### 1.10 `delay_events`
Discrete incident ticket log tracking specific bottlenecks, root causes, and mitigations.

| Column Name | Data Type | Nullable | Constraints & Defaults | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | NO | PRIMARY KEY | Incident ID (e.g., `del-cp-elec-01`). |
| `project_id` | `VARCHAR(64)` | NO | FK $\rightarrow$ `projects(id)` ON DELETE CASCADE | Associated project. |
| `trade_id` | `VARCHAR(64)` | YES | FK $\rightarrow$ `trades(id)` ON DELETE CASCADE | Affected trade package. |
| `contractor_id` | `VARCHAR(64)` | YES | FK $\rightarrow$ `contractors(id)` ON DELETE SET NULL | Implicated or responsible contractor (if applicable). |
| `category` | `VARCHAR(100)` | NO | | Taxonomy category (e.g. `Material Delay`, `Labour Shortage`, `Quality Rework`). |
| `severity` | `VARCHAR(20)` | NO | DEFAULT `'medium'`, CHECK (`IN ('low', 'medium', 'high', 'critical')`) | Impact severity level. |
| `identified_date` | `DATE` | NO | | Date roadblock was first detected. |
| `resolved_date` | `DATE` | YES | CHECK (`resolved_date >= identified_date`) | Date roadblock was fully cleared. |
| `estimated_delay_days` | `INTEGER` | NO | DEFAULT `1`, CHECK (`>= 0`) | Projected schedule impact in days. |
| `actual_delay_days` | `INTEGER` | YES | DEFAULT `0`, CHECK (`>= 0`) | Actual recorded milestone slippage. |
| `status` | `VARCHAR(50)` | NO | DEFAULT `'open'`, CHECK (`IN ('open', 'mitigating', 'resolved', 'escalated')`) | Ticket workflow status. |
| `root_cause` | `TEXT` | NO | | Factual engineering explanation of root cause. |
| `mitigation_action` | `TEXT` | YES | | Remedial intervention plan executed. |
| `logged_by` | `VARCHAR(64)` | YES | FK $\rightarrow$ `users(id)` ON DELETE SET NULL | Logging engineer user ID. |
| `created_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Ticket creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | NO | DEFAULT `CURRENT_TIMESTAMP` | Ticket update timestamp. |

---

## 2. Analytical View Dictionaries

### 2.1 `vw_project_health`
Consolidated single-view query summarizing real-time health across projects:

- `project_id`: Project identifier
- `organization_id`: Tenant identifier
- `total_project_days`: Total duration from start to deadline
- `days_elapsed`: Days elapsed to current date
- `days_remaining`: Calendar days remaining to deadline
- `timeline_elapsed_pct`: Percentage of schedule timeline consumed
- `overall_planned_pct`: Average planned progress across trades
- `overall_actual_pct`: Average actual progress across trades
- `schedule_variance`: Actual % minus Planned %
- `delayed_trades_count`: Count of trades behind schedule
- `bottleneck_trade_name`: Name of the trade furthest behind plan
- `bottleneck_gap_pct`: Max gap ($Planned - Actual$)
- `bottleneck_reason`: Delay reason for bottleneck trade
- `total_workforce_deficit`: Total headcounts short across trades
- `active_delay_events_count`: Count of unresolved delay tickets
- `health_status`: Categorical label: `On Track`, `Attention Needed`, `Behind Schedule`
- `status_css_class`: Corresponding CSS class: `on-track`, `attention`, `behind`

---

### 2.2 `vw_ml_project_features`
Engineered feature vector table for downstream machine learning:

- `timeline_elapsed_ratio`: $\frac{\text{Days Elapsed}}{\text{Total Days}}$
- `planned_progress_pct`: Average target progress
- `actual_progress_pct`: Average actual progress
- `schedule_variance_pct`: Progress variance
- `delayed_trades_ratio`: Ratio of lagging trades to total trades
- `max_bottleneck_gap_pct`: Magnitude of single largest trade deficit
- `workforce_deficit`: Absolute headcount shortage
- `workforce_fulfillment_ratio`: $\frac{\text{Workers Present}}{\text{Workers Required}}$
- `active_delay_events_count`: Count of open roadblocks
- `critical_delay_events_count`: Count of high/critical roadblocks
- `recent_7d_progress_velocity`: Empirical progress rate over trailing update window
- `required_daily_velocity`: Velocity required to achieve $100\%$ by deadline
- `velocity_health_ratio`: $\frac{\text{Actual Velocity}}{\text{Required Velocity}}$ ($< 1.0$ indicates schedule shortfall)
