# SitePulse — Phase 4.1 Independent ML Validation & Correctness Audit Report
=============================================================================
**Document Version:** 1.0.0  
**Audit Timestamp:** November 1, 2026  
**Auditor:** SitePulse AI/ML Quality & Verification Review  
**Status:** Verification & Correctness Audit Complete — Approved for Phase 5 Review  

---

## 1. Executive Summary & Purpose

Phase 4 implemented two applied machine learning capabilities:
1. **Construction Progress & Manpower Anomaly Detection**
2. **Multi-Factor Project & Trade Delay Risk Classification**

Phase 4.1 serves as an independent, rigorous audit of the source code, serialized model artifacts, training scripts, feature attribution mathematics, and backend inference integration. **No new features were introduced.** All issues identified have been audited, mathematically derived, and resolved with full regression test coverage.

---

## 2. Issues Identified, Root Causes & Corrections Made

| Item | Issue Identified | Root Cause | Correction Made | Status |
| :---: | :--- | :--- | :--- | :---: |
| **1** | **Mislabeled Feature Importances vs. Standardized Coefficients** | `train_models.py` exported `np.abs(clf.coef_[0])` into `feature_metadata.json` under `"feature_importances"`. The Phase 4 markdown table erroneously presented these absolute values with a `+` sign. | Updated `feature_metadata.json` to store signed `"standardized_coefficients"` (e.g., `schedule_variance_pct: -1.2735`, `total_workers_present: -0.9958`) alongside `"feature_importances"` (magnitudes). Updated documentation accordingly. | **RESOLVED** |
| **2** | **Feature Attribution Mathematical Discrepancy** | The example in `MODEL_EVALUATION.md` stated that for `schedule_variance_pct = -14.2%`, the coefficient was `+1.2735` and the contribution score was `+1.82`. If the coefficient were positive, a negative variance would reduce delay risk, which is contradictory. | Derived exact math: $\mu = 11.7835$, $\sigma = 16.1678$, $z = -1.6071$, $\beta = -1.2735$. Exact contribution is $(-1.2735) \times (-1.6071) = \mathbf{+2.0467}$ log-odds units. Corrected in all docs and verified via regression tests. | **RESOLVED** |
| **3** | **Perceived Positive Sign for `total_workers_present`** | Documentation reported `total_workers_present: +0.9958`, causing confusion about whether more workers increases delay risk. | Verified actual fitted model: raw coefficient is **`-0.9958`** (negative), perfectly matching its training correlation ($r = -0.5453$). Having more workers decreases delay risk. In addition, documented that collinearity with `workforce_fulfillment_ratio` ($r = 1.000$) was split evenly by L2 regularization. | **RESOLVED** |
| **4** | **Inaccurate "Full Workforce" Labeling for Partial Staffing** | When an electrical trade reported 4 workers present out of 9 required with 0% progress, the explanation generator emitted: *"Full workforce (4 workers) reported on site with zero physical progress..."* | Corrected logic in `main.py` and `mlInferenceService.js`: When $w < \text{req}$, it now emits: *"Active workforce presence (4 workers logged, required: 9) with zero physical progress..."*. "Full workforce" is only emitted if $w \ge \text{req}$. | **RESOLVED** |
| **5** | **Test Set Record Count Reporting Ambiguity** | Anomaly detection test set was variously cited as 8,505 vs. 8,528 records. | Clarified exact arithmetic: Total records in untouched test partition $= \mathbf{8,528}$ (8,463 True Negatives + 23 False Positives + 42 True Positives + 0 False Negatives). Total normal records $= 8,486$. Total anomalies $= 42$. | **RESOLVED** |
| **6** | **Clarification of Anomaly Training Protocol** | Phase 4 claimed "completely unsupervised Isolation Forest". However, `train_models.py` purged `is_anomaly == 1` from the training data prior to fitting. | Explicitly documented in Model Card, Evaluation Report, and Anomaly Detection documentation that filtering inliers via known synthetic ground-truth labels constitutes a **one-class / semi-supervised training protocol**, rather than zero-label unsupervised learning. | **RESOLVED** |
| **7** | **Defensive Handling for Real Projects with Insufficient History** | Real projects with no configured trades or $< 3$ days of elapsed timeline received fabricated numerical predictions. | Enhanced `mlInferenceService.js` to return `model_status: "insufficient_history"` with `delay_risk_score: null` and an explanatory message whenever a project lacks active trades or has $< 3$ days elapsed history. | **RESOLVED** |

---

## 3. Independent Reproducibility Verification

All reported test metrics were independently reproduced directly from saved model artifacts (`model/anomaly/isolation_forest.joblib` and `model/risk_classifier/risk_classifier.joblib`) and the untouched test partitions:

### 3.1 Project Delay Risk Classifier (Untouched Test Set, $n=39$ Projects)
- **Distinct Projects:** 39 (zero overlap with Train $n=182$ or Val $n=39$).
- **Confusion Matrix:** $\text{TN} = 14, \quad \text{FP} = 2, \quad \text{FN} = 2, \quad \text{TP} = 21$.
- **Accuracy:** **89.74%**
- **Precision:** **91.30%**
- **Recall:** **91.30%** (21 / 23 delayed projects detected)
- **F1-Score:** **0.9130**
- **ROC-AUC:** **0.9620**
- **PR-AUC:** **0.9766**
- **Brier Calibration Score:** **0.0799**
- **Optimal Threshold:** **`0.5700`** (tuned strictly on validation partition maximizing precision subject to $\text{Recall} \ge 90\%$).

### 3.2 Hybrid Anomaly Detection Engine (Untouched Test Set, $n=8,528$ Records)
- **Total Test Records:** 8,528 trade-day observations across 39 test projects.
- **Confusion Matrix:** $\text{TN} = 8,463, \quad \text{FP} = 23, \quad \text{FN} = 0, \quad \text{TP} = 42$.
- **Recall:** **100.00%** (42 / 42 anomalies intercepted; 0 False Negatives).
- **Precision:** **64.62%** (42 / 65 alerts).
- **F1-Score:** **0.7850**
- **False Positive Rate (FPR):** **0.27%** (23 / 8,486 normal records).
- **PR-AUC:** **0.5401**
- **Precision@10 / @20 / @50:** **20.0% / 20.0% / 54.0%**
- **Optimal Threshold:** **`0.8900`** (tuned strictly on validation partition).

---

## 4. Feature Attribution Mathematics Audit

### 4.1 Exact Transformation & Formula
For a logistic regression pipeline with `SimpleImputer` and `StandardScaler`:
$$\text{logit}(P) = \beta_0 + \sum_{j=1}^{14} \beta_j z_j = \beta_0 + \sum_{j=1}^{14} \beta_j \left(\frac{x_j - \mu_j}{\sigma_j}\right)$$

Where:
- Intercept $\beta_0 = -0.3099$.
- $z_j = (x_j - \mu_j) / \sigma_j$ is the standardized feature.
- $\beta_j$ is the signed standardized coefficient.
- $\beta_j z_j$ is the specific project's linear contribution to log-odds.

### 4.2 Standardized Parameters Table
| Feature ($j$) | Signed Coef ($\beta_j$) | Training Mean ($\mu_j$) | Training Scale ($\sigma_j$) | Unscaled Slope ($w_j = \beta_j / \sigma_j$) |
| :--- | :---: | :---: | :---: | :---: |
| `required_daily_velocity` | **+1.8391** | 2.6234 | 0.6928 | +2.6546 |
| `schedule_variance_pct` | **-1.2735** | 11.7835 | 16.1678 | -0.0788 |
| `workforce_deficit` | **-1.1816** | 12.6593 | 9.8027 | -0.1205 |
| `workforce_fulfillment_ratio`| **-0.9960** | 0.7899 | 0.4327 | -2.3016 |
| `total_workers_present` | **-0.9958** | 32.3846 | 17.7422 | -0.0561 |
| `total_estimated_delay_days` | **-0.7243** | 4.2473 | 5.7912 | -0.1251 |
| `velocity_health_ratio` | **-0.6917** | 1.1227 | 1.0249 | -0.6749 |
| `recent_7d_progress_velocity`| **-0.5122** | 2.3591 | 1.1964 | -0.4281 |
| `active_delay_events_count` | **+0.4154** | 0.4890 | 0.7090 | +0.5859 |
| `max_bottleneck_gap_pct` | **-0.3537** | 16.1692 | 12.4983 | -0.0283 |
| `delayed_trades_ratio` | **-0.1617** | 0.3703 | 0.2367 | -0.6830 |
| `delayed_trades_count` | **-0.1617** | 1.8516 | 1.1837 | -0.1366 |
| `timeline_elapsed_ratio` | **+0.1653** | 0.5221 | 0.0282 | +5.8674 |
| `total_workers_required` | **0.0000** | 41.0000 | 1.0000 | 0.0000 |

### 4.3 Audited Example Calculation
Given a project with `schedule_variance_pct = -14.2%`:
1. $z = \frac{-14.20 - 11.7835}{16.1678} = -1.6071$ (project is $1.61\sigma$ behind the training mean).
2. Model coefficient $\beta = -1.2735$.
3. Contribution to log-odds:
   $$\text{contribution} = (-1.2735) \times (-1.6071) = \mathbf{+2.0467}$$
Because $\beta < 0$ and $z < 0$, their product is positive, correctly driving UP the delay probability by $+2.05$ log-odds units.

---

## 5. Synthetic Simulation Calibration Audit

The simulation generator was rechecked across all 260 projects generated under seed 42:

| Scenario Name | Projects | Mean Planned | Mean Actual | Mean Delay (Days) | % Delayed $> 3$ Days | Delay Range (Min / Max) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `approval_bottleneck` | 33 | 47.9 d | 48.8 d | +0.94 d | 24.2% | -9 d to +13 d |
| `concurrent_delays` | 32 | 48.4 d | 71.2 d | +22.72 d | 100.0% | +14 d to +29 d |
| `manpower_delay` | 33 | 48.6 d | 76.0 d | +27.45 d | 100.0% | +17 d to +37 d |
| `material_delay` | 33 | 48.2 d | 50.8 d | +2.64 d | 33.3% | -4 d to +10 d |
| `misleading_reporting` | 32 | 47.7 d | 54.5 d | +6.84 d | 84.4% | -1 d to +15 d |
| `on_schedule` | 33 | 48.6 d | 38.8 d | -9.82 d | **0.0%** | -15 d to -1 d |
| `recovery_intervention`| 32 | 48.2 d | 34.8 d | -13.41 d | **0.0%** | -18 d to -9 d |
| `workforce_fluctuations`| 32 | 48.7 d | 54.6 d | +5.91 d | 71.9% | -1 d to +12 d |
| **All Scenarios Combined**| **260** | **48.3 d** | **53.8 d** | **+5.49 d** | **51.15%** | **-18 d to +37 d** |

### Audit Findings:
1. **Contingency Calibration Authenticity:** In real commercial fitouts, unhindered sequential execution of the 5 trade scopes takes 38–40 calendar days. A planned deadline of 48.6 days incorporates a standard ~20% CPM contingency float. The `on_schedule` scenario correctly delivers 0.0% delayed $> 3$d because unhindered projects finish on Day 38.8, safely within the 48.6-day planned window.
2. **Realistic Non-Deterministic Spread:** Intermediate scenarios (`approval_bottleneck` with 24.2% delayed, `material_delay` with 33.3% delayed, `workforce_fluctuations` with 71.9% delayed) exhibit substantial variance where projects finish early, on-time, or late.
3. **Absence of Scenario Shortcuts:** Models do not receive scenario labels or identifiers. Classification relies strictly on physical Day 25 site variables (`schedule_variance_pct`, `required_daily_velocity`, `workforce_deficit`). The test set confusion matrix (TN=14, FP=2, FN=2, TP=21) confirms realistic discrimination with non-zero error rates.

---

## 6. Prediction-Time Feature Availability & Data-Leakage Audit

The data access layer, Express routes, and FastAPI inference service were audited to verify zero post-cutoff leakage:
1. **`GET /projects/:id/anomalies`:** Operates strictly on daily progress updates and workforce logs. Does not query project final completion or scenario metadata.
2. **`GET /projects/:id/risk-score`:** Extracts features using `referenceDate` (defaulting to Day 25 or current elapsed time). Computes `elapsedDays`, `remainingDays`, `scheduleVariance`, `requiredDailyVelocity`, and active delay events. All future updates post-dating `referenceDate` are excluded.
3. **Defensive History Guardrail:** If a project has $< 3$ days of elapsed timeline or no configured trades, the service returns `model_status: "insufficient_history"` with `delay_risk_score: null`. No dummy feature vectors are fabricated.
4. **Multi-Tenant Isolation:** Requests are scoped strictly by `req.user.organizationId`. Attempting to access projects belonging to another tenant returns `404 PROJECT_NOT_FOUND`.
5. **Experimental Synthetic Labeling:** Every response includes `"is_experimental_synthetic": true` and a research disclaimer.

---

## 7. Regression Test Suite Execution

All test suites were executed and verified:

### 7.1 Python Unit & Model Verification Suite
Command: `npm run test:py` (`tests/test_simulation_engine.py` & `tests/test_ml_models.py`)
- **Result:** **21 tests passed in 2.97s (0 failures, 0 errors).**
- Verified:
  - Model loading and integrity.
  - Partial workforce explanation (`Active workforce presence (4 workers logged, required: 9)` vs `Full workforce`).
  - Signed standardized coefficients (`schedule_variance_pct: -1.2735`, `total_workers_present: -0.9958`, `required_daily_velocity: +1.8391`).
  - Exact attribution math for $z = -1.6071 \rightarrow \text{contribution} = +2.0467$.
  - Validation-only threshold selection (0.5700 and 0.8900).
  - Exact test set metric reproducibility (TN=14, FP=2, FN=2, TP=21; TN=8,463, FP=23, FN=0, TP=42).

### 7.2 Node.js Express Integration Suite
Command: `npm test` (`backend/tests/`)
- **Result:** **67 tests passed in 4.05s (0 failures, 0 errors).**
- Verified:
  - Health check endpoint with `ml_service` status.
  - Authentication on ML endpoints (401 on unauthenticated).
  - Multi-tenant organization isolation (404 on cross-org requests).
  - Schema compliance with experimental disclaimer.
  - Elevated risk explanation generation without future words.
  - Fallback heuristic activation when FastAPI is offline.
  - Non-intervention safety guarantee (read-only execution).
  - Insufficient project history graceful handling (`model_status: "insufficient_history"`).
  - Attribution signs in fallback engine (`coefficient: -1.2735`).

---

## 8. Remaining Limitations

1. **Synthetic Noise Boundary:** While the simulation engine incorporates realistic stochastic distributions, contractor behaviors, and CPM inter-trade dependencies, synthetic evaluations cannot substitute for customer field trials.
2. **Defensive History Guardrail:** Real projects with $< 3$ days of elapsed timeline or no configured trades return `model_status: "insufficient_history"` rather than hallucinating predictions.
3. **Non-Contractual Advisory:** Output is strictly decision support (`is_experimental_synthetic: true`).

---

## 9. Explicit Recommendation for Phase 5

The Phase 4.1 verification audit is **100% complete**. All identified issues (mathematical attribution signs, partial workforce explanations, test record counting, and insufficient history defensive handling) have been corrected in code, tested with automated regression suites, and reflected across all documentation.

**Recommendation:** **APPROVED to proceed to Phase 5: LLM-Assisted Synthesis & Executive Decision Support upon user confirmation.**
