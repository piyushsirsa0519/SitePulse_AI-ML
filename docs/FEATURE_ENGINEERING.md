# SitePulse — Feature Engineering Pipeline
**Phase 3: Machine Learning Feature Store & Leakage-Free Design**
*Document Version: 1.0.0 | Status: Production Benchmark*

---

## 1. Zero-Leakage Temporal Cutoff Architecture

A common pitfall in project monitoring ML is **target leakage** (using full-lifecycle aggregates or future metrics to predict mid-project risk). 

SitePulse enforces a strict **temporal cutoff guardrail**:
- All prediction-time features are evaluated at a fixed decision cutoff: **$T_{eval} = 25$ calendar days** after project start.
- Any trajectory update, manpower record, or roadblock event occurring on $t > 25$ is **strictly inaccessible** to the feature extraction pipeline.
- Future targets (`target_is_delayed_over_3d`, `target_actual_delay_days`) are computed solely from the completed project records for ground-truth labeling.

```
Project Timeline:
|--------------------- Historical Feature Window (t <= 25) --------------------->|-------- Future Outcome (t > 25) -------->|
[Day 1: Start] ..................................................... [Day 25: Prediction Cutoff] .................. [Actual End]
                                                                                |
                                                                   Extract Features at t=25
                                                               (Velocity, Bottlenecks, Workforce)
                                                                                |
                                                                                v
                                                                 Future Target: Delay > 3 Days?
```

---

## 2. Project-Level Features (Aligned with `vw_ml_project_features`)

All project-level features map directly to the PostgreSQL analytical view `vw_ml_project_features`:

### 2.1 Timeline Features

#### `timeline_elapsed_ratio`
- **Definition:** Proportion of planned project duration elapsed at the prediction cutoff.
- **Formula:** $\frac{T_{eval}}{\max(1, \text{planned\_duration\_days})}$
- **Data Type:** `FLOAT (4 decimals)`
- **Interpretation:** Benchmark timeline index. $0.50$ represents project mid-point.

#### `days_elapsed`
- **Definition:** Total calendar days elapsed since project mobilization up to cutoff.
- **Formula:** $\min(\text{planned\_duration\_days}, T_{eval})$
- **Data Type:** `INTEGER`
- **Interpretation:** Raw operational duration elapsed.

#### `days_remaining`
- **Definition:** Scheduled calendar days remaining until planned project deadline.
- **Formula:** $\max(0, \text{planned\_duration\_days} - T_{eval})$
- **Data Type:** `INTEGER`
- **Interpretation:** Remaining buffer window to complete all remaining scopes.

---

### 2.2 Progress & Schedule Variance Features

#### `overall_planned_pct`
- **Definition:** Mean planned progress percentage across all project trades at cutoff.
- **Formula:** $\frac{1}{N} \sum_{i=1}^N P_{planned, i}(T_{eval})$
- **Data Type:** `FLOAT (2 decimals)`
- **Interpretation:** Target milestone expectation across all packages.

#### `overall_actual_pct`
- **Definition:** Mean cumulative actual progress percentage recorded across all trades at cutoff.
- **Formula:** $\frac{1}{N} \sum_{i=1}^N P_{actual, i}(T_{eval})$
- **Data Type:** `FLOAT (2 decimals)`
- **Interpretation:** True physical completion percentage of the overall store fitout.

#### `schedule_variance_pct`
- **Definition:** Difference between cumulative actual progress and planned target progress.
- **Formula:** $\text{overall\_actual\_pct} - \text{overall\_planned\_pct}$
- **Data Type:** `FLOAT (2 decimals)`
- **Interpretation:** Primary schedule health metric. Negative values indicate schedule slippage; positive values indicate ahead of schedule.

---

### 2.3 Trade Bottleneck Diagnostics

#### `max_bottleneck_gap_pct`
- **Definition:** The maximum individual trade deficit between planned and actual progress across all trades.
- **Formula:** $\max_{i=1 \dots N} \max(0.0, P_{planned, i} - P_{actual, i})$
- **Data Type:** `FLOAT (2 decimals)`
- **Interpretation:** Identifies the single most severely delayed critical path trade holding up downstream activities.

#### `delayed_trades_ratio`
- **Definition:** Proportion of trades currently performing behind their planned target milestone.
- **Formula:** $\frac{\sum_{i=1}^N \mathbf{1}(P_{actual, i} < P_{planned, i})}{N}$
- **Data Type:** `FLOAT (4 decimals)`
- **Interpretation:** Breadth of site distress. Ratios $> 0.50$ indicate systemic multi-trade coordination failure.

#### `delayed_trades_count`
- **Definition:** Absolute count of trades currently behind planned schedule.
- **Formula:** $\sum_{i=1}^N \mathbf{1}(P_{actual, i} < P_{planned, i})$
- **Data Type:** `INTEGER`
- **Interpretation:** Raw count of lagging disciplines requiring project management intervention.

---

### 2.4 Workforce Fulfillment Features

#### `total_workers_present`
- **Definition:** Total headcounts reported across all active trades at the latest cutoff snapshot.
- **Formula:** $\sum_{i=1}^N W_{present, i}$
- **Data Type:** `INTEGER`
- **Interpretation:** Gross manpower deployed on site.

#### `total_workers_required`
- **Definition:** Total headcounts required by contracts across all active trades.
- **Formula:** $\sum_{i=1}^N W_{required, i}$
- **Data Type:** `INTEGER`
- **Interpretation:** Contractually budgeted workforce capacity.

#### `workforce_deficit`
- **Definition:** Net labor shortfall below planned staffing requirement.
- **Formula:** $\max(0, \text{total\_workers\_required} - \text{total\_workers\_present})$
- **Data Type:** `INTEGER`
- **Interpretation:** Daily staffing shortfall. Directly drives productivity loss and schedule slip ($r = 0.828$).

#### `workforce_fulfillment_ratio`
- **Definition:** Ratio of present workforce to required workforce.
- **Formula:** $\frac{\text{total\_workers\_present}}{\max(1, \text{total\_workers\_required})}$
- **Data Type:** `FLOAT (4 decimals)`
- **Interpretation:** Attendance fulfillment efficiency. Ratios $< 0.80$ signal high delay probability.

---

### 2.5 Progress Velocity & Health Features

#### `recent_7d_progress_velocity`
- **Definition:** Trailing 7-day average daily progress percentage delta per trade.
- **Formula:** $\text{AVG}(\Delta P_{t})$ for $t \in [T_{eval} - 6, T_{eval}]$
- **Data Type:** `FLOAT (3 decimals)`
- **Interpretation:** Current empirical progress speed. Bypasses stagnant early-stage biases.

#### `required_daily_velocity`
- **Definition:** Theoretical daily progress required across remaining timeline to achieve 100% completion by deadline.
- **Formula:** $\frac{100.0 - \text{overall\_actual\_pct}}{\max(1, \text{days\_remaining})}$
- **Data Type:** `FLOAT (3 decimals)`
- **Interpretation:** Burn-rate required to deliver project on schedule.

#### `velocity_health_ratio`
- **Definition:** Ratio of recent empirical velocity to required daily burn velocity.
- **Formula:** $\frac{\text{recent\_7d\_progress\_velocity}}{\max(0.001, \text{required\_daily\_velocity})}$
- **Data Type:** `FLOAT (3 decimals)`
- **Interpretation:** Key forward-looking health metric ($r = -0.746$). Values $\ge 1.0$ indicate on-track execution; values $< 0.70$ signal impending completion breach.

---

### 2.6 Incident Roadblocks

#### `active_delay_events_count`
- **Definition:** Number of discrete roadblock incidents identified on or before cutoff date.
- **Formula:** $\text{COUNT}(de.id)$ where $de.date \le T_{eval}$
- **Data Type:** `INTEGER`
- **Interpretation:** Volume of external disruptions (permits, material delivery, client changes).

#### `total_estimated_delay_days`
- **Definition:** Sum of estimated delay days across all active delay events.
- **Formula:** $\sum de.\text{estimated\_delay\_days}$
- **Data Type:** `INTEGER`
- **Interpretation:** Cumulative quantified site impact from logged incidents.

---

## 3. Trade-Level Features (`trade_features_day25.csv`)

In addition to project-level metrics, fine-grained trade-level vectors allow discipline-specific risk modeling:

| Feature Name | Data Type | Formula / Method | Operational Interpretation |
| :--- | :---: | :--- | :--- |
| `trade_actual_pct` | `FLOAT` | Latest cumulative progress % for trade at cutoff | Physical completion status of this trade |
| `trade_planned_pct` | `FLOAT` | Target S-curve progress % for trade at cutoff | Scheduled progress expectation |
| `trade_progress_variance` | `FLOAT` | $P_{actual} - P_{planned}$ | Trade schedule slippage ($<0$ indicates lagging) |
| `trade_rolling_7d_velocity`| `FLOAT` | Trailing 7d mean daily progress delta | Recent trade execution speed (%/day) |
| `trade_manpower_utilization`| `FLOAT` | $W_{present} / \max(1, W_{required})$ | Staffing fulfillment for this specific trade |
| `consecutive_stagnant_days`| `INTEGER` | Consecutive days with $\Delta P \le 0.05\%$ | Detects frozen or blocked contractor scopes |
| `days_until_planned_completion`| `INTEGER` | $\text{planned\_end\_date} - T_{eval}$ | Time buffer remaining for trade completion |
| `historical_delay_count` | `INTEGER` | Logged delay events involving trade up to $T$ | Trade-specific disruption frequency |
| `trade_dependency_status` | `VARCHAR` | `'unblocked'` vs. `'blocked'` | Upstream milestone completion status |

---

## 4. Target Label Formulations

All targets are derived strictly from finalized future project outcomes:

### A. Delay Risk Classification Target
- **Column:** `target_is_delayed_over_3d`
- **Data Type:** `INTEGER (0 or 1)`
- **Logic:**
  $$\text{target\_is\_delayed\_over\_3d} = \begin{cases} 1 & \text{if } (\text{actual\_duration\_days} - \text{planned\_duration\_days}) > 3 \\ 0 & \text{otherwise} \end{cases}$$
- **Continuous Variant:** `target_actual_delay_days` (actual days beyond deadline; negative indicates early finish).

### B. Anomaly Target
- **Column:** `target_has_anomaly`
- **Data Type:** `INTEGER (0 or 1)`
- **Logic:** 1 if any known anomalous reporting pattern (`phantom_workforce`, `implausible_progress_spike`, `unreported_workforce`) was injected in the project trajectory.

---

## 5. Grouped Project-Level Train / Validation / Test Splitting

To prevent **data leakage and cluster contamination**:
- Individual daily rows or trade rows from the same project **never appear across different splits**.
- Splitting is performed exclusively at the **Project ID** level using a seeded permutation (`seed = 42`):
  - **Training Set (70%):** 182 projects (910 trade rows)
  - **Validation Set (15%):** 39 projects (195 trade rows)
  - **Test Set (15%):** 39 projects (195 trade rows)
- All split assignments are permanently logged in `split_metadata.json` for deterministic reproducibility.
