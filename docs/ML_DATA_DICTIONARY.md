# SitePulse — Machine Learning Data Dictionary
**Phase 3: Synthetic Datasets & Feature Store Reference**
*Document Version: 1.0.0 | Status: Production Benchmark*

---

## 1. Overview of Generated Datasets

All synthetic files reside in `data/synthetic/` and are tagged with `is_synthetic = True`:

```
data/synthetic/
├── projects.csv                  # 260 rows (Project metadata, planned & actual dates)
├── stores.csv                    # 260 rows (Retail store locations, formats, square footage)
├── trades.csv                    # 1,300 rows (Trade packages, planned & actual completion)
├── daily_updates.csv             # 56,797 rows (Daily progress logs, workforce present, roadblocks)
├── manpower_log.csv              # 56,797 rows (Shift headcounts, contractor IDs, overtime)
├── contractor_assignments.csv    # 1,300 rows (Trade contractor contracts and values)
├── delay_events.csv              # 130 rows (Discrete roadblock incidents, severities, causes)
├── consolidated_trajectories.csv # 56,797 rows (Consolidated step-by-step analytical records)
├── project_features_day25.csv    # 260 rows (Zero-leakage project features at Cutoff Day 25)
├── trade_features_day25.csv      # 1,300 rows (Zero-leakage trade features at Cutoff Day 25)
├── train_features.csv            # 182 rows (70% Project Training Split)
├── val_features.csv              # 39 rows (15% Project Validation Split)
├── test_features.csv             # 39 rows (15% Project Test Split)
├── train_trade_features.csv      # 910 rows (70% Trade Training Split)
├── val_trade_features.csv        # 195 rows (15% Trade Validation Split)
├── test_trade_features.csv       # 195 rows (15% Trade Test Split)
└── split_metadata.json           # Splitting manifests, seed 42, project membership lists
```

---

## 2. Relational Table Schemas

### 2.1 `projects.csv`
| Column Name | Type | Nullable | References | Description |
| :--- | :---: | :---: | :--- | :--- |
| `id` | `VARCHAR(36)` | No | Primary Key | Project identifier (`prj-syn-0001` to `prj-syn-0260`) |
| `organization_id` | `VARCHAR(36)` | No | `organizations.id` | Organization owner (`org-apex-retail`) |
| `store_id` | `VARCHAR(36)` | No | `stores.id` | Associated retail store unit |
| `name` | `VARCHAR(100)` | No | - | Store fitout project display name |
| `location` | `VARCHAR(50)` | No | - | Metro city location |
| `start_date` | `DATE` | No | - | Mobilization start date (`YYYY-MM-DD`) |
| `deadline` | `DATE` | No | - | Contractual planned deadline (`YYYY-MM-DD`) |
| `actual_completion_date` | `DATE` | No | - | Realized physical handover date |
| `planned_duration_days` | `INTEGER` | No | - | Planned timeline duration ($38-48$ days) |
| `actual_duration_days` | `INTEGER` | No | - | Total days taken to finish all trades |
| `delay_days` | `INTEGER` | No | - | Variance: `actual_duration - planned_duration` |
| `scenario` | `VARCHAR(30)` | No | - | Simulated operational scenario key (1 of 8) |
| `status` | `VARCHAR(20)` | No | - | Lifecycle status (`completed`) |
| `is_delayed_over_3d` | `INTEGER` | No | - | Delay classification target (1 if `delay_days > 3`, else 0) |
| `is_synthetic` | `BOOLEAN` | No | - | Synthetic benchmark flag (`True`) |

---

### 2.2 `stores.csv`
| Column Name | Type | Nullable | References | Description |
| :--- | :---: | :---: | :--- | :--- |
| `id` | `VARCHAR(36)` | No | Primary Key | Store identifier (`str-syn-0001`) |
| `organization_id` | `VARCHAR(36)` | No | `organizations.id` | Organization owner |
| `store_code` | `VARCHAR(30)` | No | Unique | Retail unit code (e.g., `STR-BIR-GUR-001`) |
| `name` | `VARCHAR(100)` | No | - | Commercial brand & store name |
| `brand` | `VARCHAR(50)` | No | - | Retail chain brand name |
| `city` | `VARCHAR(50)` | No | - | City name |
| `location_address` | `VARCHAR(150)` | No | - | Unit and mall/street address |
| `format` | `VARCHAR(30)` | No | - | Format: `High Street`, `Mall`, `Food Court`, `Standalone Flagship` |
| `square_footage` | `FLOAT` | No | - | Store usable floor area ($1,200 - 4,500$ sq.ft.) |
| `status` | `VARCHAR(20)` | No | - | Store operational status (`completed`) |
| `is_synthetic` | `BOOLEAN` | No | - | Synthetic benchmark flag (`True`) |

---

### 2.3 `trades.csv`
| Column Name | Type | Nullable | References | Description |
| :--- | :---: | :---: | :--- | :--- |
| `id` | `VARCHAR(36)` | No | Primary Key | Trade identifier (`trd-syn-0001-civ`) |
| `project_id` | `VARCHAR(36)` | No | `projects.id` | Associated project ID |
| `name` | `VARCHAR(50)` | No | - | Discipline: `Civil`, `Electrical`, `Lighting`, `Carpentry`, `Painting` |
| `planned_start` | `DATE` | No | - | Scheduled package start date |
| `planned_end` | `DATE` | No | - | Scheduled package completion date |
| `actual_completion_date` | `DATE` | No | - | Realized package signoff date |
| `planned_pct` | `FLOAT` | No | - | Target scope percentage ($100.0\%$) |
| `default_workers_required` | `INTEGER` | No | - | Contractual required daily crew |
| `actual_completion_day` | `INTEGER` | No | - | Day number on which trade hit 100% |
| `delay_days` | `INTEGER` | No | - | Package delay beyond planned trade end date |
| `is_delayed_over_3d` | `INTEGER` | No | - | 1 if `delay_days > 3`, else 0 |
| `is_synthetic` | `BOOLEAN` | No | - | Synthetic benchmark flag (`True`) |

---

### 2.4 `daily_updates.csv`
| Column Name | Type | Nullable | References | Description |
| :--- | :---: | :---: | :--- | :--- |
| `id` | `VARCHAR(50)` | No | Primary Key | Daily update row ID |
| `trade_id` | `VARCHAR(36)` | No | `trades.id` | Trade package ID |
| `date` | `DATE` | No | - | Update calendar date |
| `progress_pct` | `FLOAT` | No | - | Cumulative actual progress ($0.00 - 100.00\%$) |
| `workers_present` | `INTEGER` | No | - | Actual workers attendance |
| `workers_required` | `INTEGER` | No | - | Required workers attendance |
| `reason` | `VARCHAR(100)` | No | - | Status label (e.g. `On Track`, `Labour Shortage`, `Material Delay`) |
| `notes` | `TEXT` | Yes | - | Contextual site comments |
| `created_by` | `VARCHAR(36)` | No | `users.id` | Submitting site engineer user ID |
| `is_synthetic` | `BOOLEAN` | No | - | Synthetic benchmark flag (`True`) |
| `anomaly_type` | `VARCHAR(50)` | Yes | - | Anomaly label if injected, else `None` |

---

### 2.5 `manpower_log.csv`
| Column Name | Type | Nullable | References | Description |
| :--- | :---: | :---: | :--- | :--- |
| `id` | `VARCHAR(50)` | No | Primary Key | Manpower log row ID |
| `trade_id` | `VARCHAR(36)` | No | `trades.id` | Trade package ID |
| `contractor_id` | `VARCHAR(36)` | No | `contractors.id` | Contractor entity responsible |
| `date` | `DATE` | No | - | Shift calendar date |
| `shift` | `VARCHAR(20)` | No | - | Operational shift (`day`) |
| `workers_present` | `INTEGER` | No | - | Actual headcount on site |
| `workers_required` | `INTEGER` | No | - | Contractually mandated headcount |
| `supervisor_name` | `VARCHAR(50)` | No | - | Site supervisor in charge |
| `overtime_hours` | `FLOAT` | No | - | Overtime recorded (e.g. 2.0 hrs during recovery surge) |
| `notes` | `TEXT` | Yes | - | Shift notes |
| `logged_by` | `VARCHAR(36)` | No | `users.id` | Logging user ID |
| `is_synthetic` | `BOOLEAN` | No | - | Synthetic benchmark flag (`True`) |

---

### 2.6 `delay_events.csv`
| Column Name | Type | Nullable | References | Description |
| :--- | :---: | :---: | :--- | :--- |
| `id` | `VARCHAR(50)` | No | Primary Key | Delay incident ID |
| `project_id` | `VARCHAR(36)` | No | `projects.id` | Affected project ID |
| `trade_id` | `VARCHAR(36)` | No | `trades.id` | Directly impacted trade |
| `contractor_id` | `VARCHAR(36)` | No | `contractors.id` | Responsible contractor entity |
| `category` | `VARCHAR(50)` | No | - | Category: `Material Delay`, `Client Hold`, `Quality Rework` |
| `severity` | `VARCHAR(20)` | No | - | Severity level: `medium`, `high`, `critical` |
| `identified_date` | `DATE` | No | - | Date roadblock was identified |
| `resolved_date` | `DATE` | No | - | Date roadblock was cleared |
| `estimated_delay_days` | `INTEGER` | No | - | Initial forecast of schedule slip |
| `actual_delay_days` | `INTEGER` | No | - | Final realized impact in days |
| `status` | `VARCHAR(20)` | No | - | Incident lifecycle status (`resolved`) |
| `root_cause` | `TEXT` | No | - | Root cause explanation |
| `mitigation_action` | `TEXT` | No | - | Recovery actions taken |
| `is_synthetic` | `BOOLEAN` | No | - | Synthetic benchmark flag (`True`) |

---

## 3. Machine Learning Feature Store Dictionary

### 3.1 `project_features_day25.csv` (Cutoff $T = 25$)
| Feature Column | Type | Target / Predictor | Formula / Logic |
| :--- | :---: | :---: | :--- |
| `project_id` | `VARCHAR(36)` | Identifier | Unique project ID |
| `scenario` | `VARCHAR(30)` | Metadata | Simulation scenario key |
| `eval_cutoff_day` | `INTEGER` | Metadata | Fixed decision cutoff day ($25$) |
| `timeline_elapsed_ratio` | `FLOAT` | Predictor | $25 / \max(1, \text{planned\_duration})$ |
| `days_elapsed` | `INTEGER` | Predictor | $\min(\text{planned\_duration}, 25)$ |
| `days_remaining` | `INTEGER` | Predictor | $\max(0, \text{planned\_duration} - 25)$ |
| `overall_planned_pct` | `FLOAT` | Predictor | Mean trade planned % at Day 25 |
| `overall_actual_pct` | `FLOAT` | Predictor | Mean trade actual % at Day 25 |
| `schedule_variance_pct` | `FLOAT` | Predictor | $\text{overall\_actual} - \text{overall\_planned}$ |
| `max_bottleneck_gap_pct`| `FLOAT` | Predictor | $\max(\text{planned} - \text{actual})$ across trades |
| `delayed_trades_ratio` | `FLOAT` | Predictor | Lagging trades count / Total trades count |
| `delayed_trades_count` | `INTEGER` | Predictor | Lagging trades count ($P_{actual} < P_{planned}$) |
| `total_workers_present` | `INTEGER` | Predictor | Total workers across all trades on Day 25 |
| `total_workers_required`| `INTEGER` | Predictor | Total workers required across trades |
| `workforce_deficit` | `INTEGER` | Predictor | $\max(0, W_{req} - W_{pres})$ |
| `workforce_fulfillment_ratio`| `FLOAT` | Predictor | $W_{pres} / \max(1, W_{req})$ |
| `recent_7d_progress_velocity`| `FLOAT` | Predictor | Trailing 7-day average daily progress delta |
| `required_daily_velocity`| `FLOAT` | Predictor | $(100 - P_{actual}) / \max(1, \text{days\_rem})$ |
| `velocity_health_ratio` | `FLOAT` | Predictor | $\text{recent\_velocity} / \text{required\_velocity}$ |
| `active_delay_events_count`| `INTEGER`| Predictor | Incidents identified on or before Day 25 |
| `total_estimated_delay_days`| `INTEGER`| Predictor | Sum of estimated delay days for active events |
| `target_is_delayed_over_3d` | `INTEGER` | **Target (Future)** | 1 if $\text{delay\_days} > 3$, else 0 |
| `target_actual_delay_days` | `INTEGER` | **Target (Future)** | Final continuous delay days |
| `target_has_anomaly` | `INTEGER` | **Target (Anomaly)**| 1 if anomaly occurred in historical window |
| `is_synthetic` | `BOOLEAN` | Metadata | `True` |

---

### 3.2 `trade_features_day25.csv` (Cutoff $T = 25$)
| Feature Column | Type | Target / Predictor | Formula / Logic |
| :--- | :---: | :---: | :--- |
| `project_id` | `VARCHAR(36)` | Identifier | Unique project ID |
| `trade_id` | `VARCHAR(36)` | Identifier | Unique trade ID |
| `trade_name` | `VARCHAR(50)` | Metadata | Trade discipline name |
| `scenario` | `VARCHAR(30)` | Metadata | Simulation scenario key |
| `eval_cutoff_day` | `INTEGER` | Metadata | Fixed decision cutoff day ($25$) |
| `trade_actual_pct` | `FLOAT` | Predictor | Cumulative actual % at Day 25 |
| `trade_planned_pct` | `FLOAT` | Predictor | Target planned % at Day 25 |
| `trade_progress_variance` | `FLOAT` | Predictor | $P_{actual} - P_{planned}$ |
| `trade_rolling_7d_velocity`| `FLOAT` | Predictor | Trailing 7-day average daily progress delta |
| `workers_present` | `INTEGER` | Predictor | Headcount for trade on Day 25 |
| `workers_required` | `INTEGER` | Predictor | Required crew for trade |
| `trade_manpower_utilization`| `FLOAT` | Predictor | $W_{present} / \max(1, W_{required})$ |
| `consecutive_stagnant_days`| `INTEGER` | Predictor | Consecutive days with $\Delta P \le 0.05\%$ |
| `days_until_planned_completion`| `INTEGER` | Predictor | Days until trade planned end date |
| `historical_delay_count` | `INTEGER` | Predictor | Incidents involving trade up to Day 25 |
| `trade_dependency_status` | `VARCHAR(20)` | Predictor | `'unblocked'` vs `'blocked'` |
| `target_trade_is_delayed_over_3d` | `INTEGER` | **Target (Future)** | 1 if trade actual completion $>$ planned $+ 3$d |
| `target_trade_delay_days` | `INTEGER` | **Target (Future)** | Final trade delay days |
| `target_has_anomaly` | `INTEGER` | **Target (Anomaly)**| 1 if trade experienced synthetic anomaly |
| `is_synthetic` | `BOOLEAN` | Metadata | `True` |
