# SitePulse — Pre-Training Dataset Audit Report
**Phase 4: Dataset Integrity, Class Balance & Leakage Verification**
*Document Version: 1.0.0 | Date: October 2026 | Status: Pre-Training Audit Approved*

---

## 1. Executive Summary

Prior to training applied machine learning models, a comprehensive pre-flight audit was conducted across all synthetic datasets in `data/synthetic/`. This audit evaluated:
1. Target label consistency and class distributions.
2. Train/validation/test project separation and scenario representations.
3. Feature leakage guardrails at prediction cutoff Day 25.
4. Anomaly ground-truth labels and trade-level distributions.
5. Inconsistencies in the initial simulation parameters (specifically the `on_schedule` scenario).

All discovered discrepancies were rectified and re-simulated with fixed seed 42 before model training.

---

## 2. Investigation & Resolution: `on_schedule` Calibration

### 2.1 The Issue Identified
During the Phase 3 validation review, the `on_schedule` scenario exhibited an unexpected delay rate:
- **Observed:** 42.4% of projects in the `on_schedule` cohort were labeled as delayed by $> 3$ days, with an average delay of $+3.27$ days.
- **Root Cause Analysis:**
  1. *Unscheduled Calendar Non-Working Effects:* Commercial fitout trade productivity was calibrated assuming 7-day work weeks, but the daily simulation engine incorporated Sunday shift reductions (65% attendance) and contractor rating variances ($0.90 - 0.95$ factor for lower-rated contractors).
  2. *Contingency Misalignment:* Planned project durations were sampled uniformly between 38 and 48 days (mean 43 days), matching the theoretical critical path without calendar contingency buffers. Consequently, a smoothly executing project finishing in 44 calendar days was marked late when planned duration was sampled as 40 days.

### 2.2 Calibration Applied
1. **Planned Duration Contingency:** Updated planned durations to $44 - 52$ calendar days (mean 48 days), reflecting standard construction management Critical Path Method (CPM) contingency scheduling.
2. **Workforce Attendance Stability:** In `on_schedule`, stochastic attendance was stabilized around 100% nominal crew with zero-mean noise (`[-1, 0, 0, 1]`), eliminating downward worker truncation.

### 2.3 Post-Calibration Verification (Seed 42)
| Scenario Key | Count | Planned Days (Mean) | Actual Days (Mean) | Delay Days (Mean) | Delayed (>3d) Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `on_schedule` | 33 | 48.3 days | 38.8 days | **-9.5 days** | **0.0% (0 / 33)** |
| `recovery_intervention` | 32 | 47.7 days | 34.2 days | **-13.5 days** | **0.0% (0 / 32)** |
| `approval_bottleneck` | 33 | 48.1 days | 47.8 days | **-0.3 days** | 21.2% (7 / 33) |
| `material_delay` | 33 | 47.7 days | 51.7 days | **+4.0 days** | 54.5% (18 / 33) |
| `workforce_fluctuations` | 32 | 48.9 days | 53.7 days | **+4.8 days** | 59.4% (19 / 32) |
| `misleading_reporting` | 32 | 47.8 days | 55.2 days | **+7.4 days** | 75.0% (24 / 32) |
| `concurrent_delays` | 32 | 47.8 days | 72.9 days | **+25.1 days** | 100.0% (32 / 32) |
| `manpower_delay` | 33 | 48.5 days | 76.6 days | **+28.1 days** | 100.0% (33 / 33) |

**Result:** `on_schedule` projects now consistently complete on or ahead of deadline (mean delay $-9.5$ days, 0.0% delayed $> 3$ days), accurately capturing operational success.

---

## 3. Class Imbalance & Partition Distribution

The updated dataset exhibits a realistic and well-balanced class distribution across projects:

### 3.1 Project-Level Delay Target (`target_is_delayed_over_3d`)
- **Total Projects:** 260
- **Negative Class (On-Time / Recovered, `0`):** 127 projects (48.85%)
- **Positive Class (Delayed $> 3$ Days, `1`):** 133 projects (51.15%)
- **Imbalance Ratio:** 1 : 1.05 (Virtually balanced, optimal for training without aggressive resampling).

### 3.2 Partition Splits (Project-Level Grouping)
| Partition | Projects | Trade Rows | Delayed Projects (Count / %) | On-Time Projects (Count / %) |
| :--- | :---: | :---: | :---: | :---: |
| **Train Set (70%)** | 182 | 910 | 94 (51.6%) | 88 (48.4%) |
| **Validation Set (15%)**| 39 | 195 | 20 (51.3%) | 19 (48.7%) |
| **Test Set (15%)** | 39 | 195 | 19 (48.7%) | 20 (51.3%) |

**Disjoint Validation:** $\text{Train} \cap \text{Val} = \emptyset, \text{Train} \cap \text{Test} = \emptyset, \text{Val} \cap \text{Test} = \emptyset$. All 260 project IDs partition uniquely into their designated set.

---

## 4. Zero-Leakage Verification

A strict temporal audit confirms no future or post-cutoff information is present in the feature store:
1. **Cutoff Day Invariance:** Every record in `project_features_day25.csv` and `trade_features_day25.csv` has `eval_cutoff_day = 25`.
2. **Trajectory Temporal Bounds:** Feature calculations use strictly rows with `day_number <= 25`.
3. **Excluded Metadata:**
   - `project_id`, `store_id`, `contractor_id`: Excluded from feature inputs.
   - `scenario`: Excluded from predictive feature columns (preventing scenario-shortcut memorization).
   - `actual_completion_date`, `actual_duration_days`, `delay_days`: Excluded from feature inputs.
4. **Predictive Feature Surface:**
   Features comprise solely metrics calculable from site logs on or before Day 25: `timeline_elapsed_ratio`, `schedule_variance_pct`, `max_bottleneck_gap_pct`, `delayed_trades_ratio`, `workforce_deficit`, `workforce_fulfillment_ratio`, `recent_7d_progress_velocity`, `required_daily_velocity`, `velocity_health_ratio`, `active_delay_events_count`.

---

## 5. Anomaly Ground-Truth Audit

Ground-truth anomaly tags were verified across all 56,187 daily updates:
- **Normal Updates:** 55,931 rows (99.54%)
- **Anomalous Updates:** 256 rows (0.46%)
  - `phantom_workforce`: 160 occurrences (Carpentry package, days 18–22)
  - `implausible_progress_spike`: 32 occurrences (Civil package, day 28)
  - `unreported_workforce`: 64 occurrences (Painting package, day 15)

**Pre-Training Safeguard:** Injected anomaly labels (`is_anomaly`, `anomaly_type`) are completely masked during unsupervised Isolation Forest training. Models train exclusively on normal observations (`is_anomaly == 0`), ensuring rigorous unsupervised density learning.

---

## 6. Pre-Training Sign-Off

The dataset has passed all automated referential integrity, temporal ordering, and feature consistency checks (55 Node tests, 8 Python unit tests passing). The feature store is certified clean and ready for applied machine learning model training.
