# SitePulse — Machine Learning Model Card
======================================================
**Document Version:** 1.1.0 (Audited & Calibrated)  
**Release Date:** October 2026 (Audited November 2026)  
**Status:** Experimental Synthetic-Trained Benchmark  
**Developers:** SitePulse AI/ML Engineering Team  

---

## 1. Model Details

### 1.1 Overview
SitePulse incorporates two distinct applied machine learning capabilities designed specifically for retail and commercial fitout construction monitoring:
1. **Hybrid Anomaly Detection Engine:** A one-class / semi-supervised Isolation Forest coupled with deterministic statistical domain rules for trade-level progress spikes, phantom manpower, and unreported labor.
2. **Multi-Factor Delay Risk Classifier:** A supervised classification pipeline that predicts whether a fitout project or trade will complete more than 3 days past its contractual deadline (`target_is_delayed_over_3d`) based on Day 25 cutoff indicators.

### 1.2 Serialization & Runtime
- **Anomaly Detection:** Serialized at `model/anomaly/isolation_forest.joblib` (scikit-learn `IsolationForest`, `StandardScaler`). Configuration at `model/anomaly/anomaly_config.json`.
- **Delay Risk Classifier:** Serialized at `model/risk_classifier/risk_classifier.joblib` (`LogisticRegression` pipeline with `SimpleImputer` and `StandardScaler`, plus secondary trade-level `RandomForestClassifier`). Configuration at `model/risk_classifier/threshold_config.json` and metadata at `model/risk_classifier/feature_metadata.json`.
- **Runtime Environment:** Python 3.12, scikit-learn 1.9+, served via lightweight FastAPI microservice (`backend/ml_service/main.py`) with Express.js fallback integration (`backend/src/services/mlInferenceService.js`).

---

## 2. Intended Use & Target Users

### 2.1 Intended Users
- **Executive Fitout Managers & Project Directors:** Identifying portfolio-level schedule slip risks early enough to reallocate resources or negotiate phased handovers.
- **Site Engineers & Project Managers:** Identifying fraudulent or erroneous contractor manpower reporting and abnormal progress stagnation.

### 2.2 In-Scope Applications
- Advisory decision support during daily operational reviews.
- Early warning alerts for potential trade bottlenecks.
- Flagging suspicious daily log entries for on-site physical auditing.

### 2.3 Out-of-Scope & Prohibited Uses
- **Autonomous Interventions:** Automatic termination of contractor contracts or withholding payments without human investigation.
- **Safety-Critical Automation:** Not certified or intended for structural engineering, life safety, or fire compliance validation.
- **Sole Source of Truth:** Models are experimental decision-support tools trained on synthetic data and must never supersede physical site inspections.

---

## 3. Training Data & Preprocessing

### 3.1 Data Source
- Generated via the SitePulse stochastic construction fitout simulation engine (`notebooks/simulation_engine.py`, Seed 42).
- Comprises **260 retail fitout projects**, **1,300 trades**, and **56,000+ daily trade records**.
- Calibrated to retail fitout CPM (Critical Path Method) sequences: Civil (Lead), Electrical, Lighting, Carpentry, Painting across planned durations of 44 to 52 days.

### 3.2 Partitioning & Project Separation
To prevent data leakage, dataset partitioning is strictly executed at the **project level** (`split_metadata.json`):
- **Training Set:** 182 projects (70.0%)
- **Validation Set:** 39 projects (15.0%)
- **Test Set:** 39 projects (15.0%, untouched until final evaluation)

No records from validation or test projects ever entered feature fitting or model training.

### 3.3 Target Definition & Cutoff
- **Prediction Cutoff:** Day 25 of the project timeline.
- **Target Label:** `target_is_delayed_over_3d` = 1 if final completion date exceeds planned deadline by $> 3$ days; 0 otherwise.
- **Class Balance (Day 25):** 51.15% positive (133 delayed projects), 48.85% negative (127 on-time projects).

---

## 4. Model Architectures & Training Protocol

### 4.1 Hybrid Anomaly Detection Engine (One-Class / Semi-Supervised Setup)
> [!NOTE]
> **Methodological Precision on Training Setup:**
> The Isolation Forest was trained strictly on verified normal training observations (`is_anomaly == 0`). Because ground-truth synthetic labels were used to filter out anomalies prior to fitting, this setup constitutes a **one-class / semi-supervised training protocol** (learning a clean operational baseline), rather than a completely label-free unsupervised deployment.

- **Score Calibration:** Raw `decision_function` outputs are calibrated through a steep logistic sigmoid:
  $$S_{\text{iso}} = \frac{1}{1 + e^{45.0 \times \text{raw}}}$$
- **Domain Rule Integration:** Rule engine evaluates deterministic boundaries:
  - Single-day progress leap $\ge 14.0\%$ (`implausible_progress_spike`).
  - Active workforce present ($\ge 4$) with 0% progress, stagnant $\ge 1$ days, and no active hold (`phantom_workforce`).
  - Zero workforce present with progress advance $\ge 2.0\%$ (`unreported_workforce`).
  - Stagnation $\ge 4$ consecutive days despite staffing $\ge 80\%$ (`stagnant_despite_presence`).
- **Aggregated Score:** $\max(S_{\text{iso}}, S_{\text{rule}})$.
- **Decision Threshold:** Calibrated on validation partition at **0.8900**.

### 4.2 Delay Risk Classifier
- **Selected Architecture:** `LogisticRegression` with `SimpleImputer(strategy='median')`, `StandardScaler()`, and `class_weight='balanced'`.
- **Candidate Comparison:** Evaluated against `RandomForestClassifier` and `HistGradientBoostingClassifier`. Logistic Regression was selected due to superior probability calibration (Brier score 0.0275 on validation), clean linear interpretability, and robust generalization.
- **Threshold Tuning:** Calibrated on validation set to achieve **$\ge 90\%$ recall** (selected threshold: **0.5700**).

---

## 5. Quantitative Evaluation (Untouched Test Partition)

### 5.1 Project Delay Risk Classifier Performance ($n=39$)
| Metric | Untouched Test Set Result | Baseline Heuristic |
| :--- | :---: | :---: |
| **Accuracy** | **89.74%** | 71.79% |
| **Precision** | **91.30%** | 68.75% |
| **Recall** | **91.30% (21 / 23)** | 81.48% |
| **F1-Score** | **0.9130** | 0.7458 |
| **ROC-AUC** | **0.9620** | 0.7180 |
| **PR-AUC** | **0.9766** | 0.7340 |
| **Brier Calibration Score** | **0.0799** | 0.2820 |

**Test Confusion Matrix:**
- True Positives (TP): 21
- False Positives (FP): 2
- False Negatives (FN): 2
- True Negatives (TN): 14

### 5.2 Hybrid Anomaly Detection Performance ($n=8,528$ Trade-Day Records)
Total records in test partition: **8,528 records** (8,463 true negatives + 23 false positives + 42 true positives + 0 false negatives).

| Metric | Untouched Test Set Result | Uncalibrated Baseline |
| :--- | :---: | :---: |
| **Recall** | **100.00% (42 / 42)** | 92.86% |
| **Precision** | **64.62%** | 4.30% |
| **F1-Score** | **0.7850** | 0.0822 |
| **False Positive Rate (FPR)** | **0.27% (23 / 8,486)** | 10.99% |
| **Precision@10 / @20 / @50** | **20.0% / 20.0% / 54.0%** | 10% / 8% / 5% |

**Test Confusion Matrix:**
- True Positives: 42
- False Positives: 23
- False Negatives: 0
- True Negatives: 8,463

---

## 6. Model Explainability & Feature Attribution Mathematics

### 6.1 Standardized Coefficients vs. Feature Importances
Logistic regression calculates log-odds via:
$$\text{logit}(p) = \beta_0 + \sum_{i=1}^{14} \beta_i \left(\frac{x_i - \mu_i}{\sigma_i}\right)$$
where $\beta_0 = -0.3099$.

The true signed standardized coefficients ($\beta_i$) and training standardization parameters ($\mu_i, \sigma_i$) are:

| Feature Name | Signed Coef ($\beta_i$) | Training Mean ($\mu_i$) | Training Scale ($\sigma_i$) | Directional Impact on Delay |
| :--- | :---: | :---: | :---: | :--- |
| `required_daily_velocity` | **+1.8391** | 2.6234 | 0.6928 | Higher required pace strongly increases delay log-odds. |
| `schedule_variance_pct` | **-1.2735** | 11.7835 | 16.1678 | Higher positive variance (ahead) decreases delay log-odds. Lagging behind ($\text{variance} < \mu$) increases delay log-odds. |
| `workforce_deficit` | **-1.1816** | 12.6593 | 9.8027 | Headcount shortage relative to requirement. |
| `workforce_fulfillment_ratio`| **-0.9960** | 0.7899 | 0.4327 | Higher fulfillment decreases delay log-odds. |
| `total_workers_present` | **-0.9958** | 32.3846 | 17.7422 | Higher labor presence decreases delay log-odds ($r = -0.5453$). Collinear with fulfillment ratio. |
| `total_estimated_delay_days` | **-0.7243** | 4.2473 | 5.7912 | Active blocker severity. |
| `velocity_health_ratio` | **-0.6917** | 1.1227 | 1.0249 | Recent velocity relative to required pace. |
| `recent_7d_progress_velocity`| **-0.5122** | 2.3591 | 1.1964 | Recent pace decreases delay log-odds. |
| `active_delay_events_count` | **+0.4154** | 0.4890 | 0.7090 | Active blockers increase delay log-odds. |
| `max_bottleneck_gap_pct` | **-0.3537** | 16.1692 | 12.4983 | Pacing gap on critical path. |
| `delayed_trades_ratio` | **-0.1617** | 0.3703 | 0.2367 | Proportion of lagging trades. |
| `delayed_trades_count` | **-0.1617** | 1.8516 | 1.1837 | Count of lagging trades. |
| `timeline_elapsed_ratio` | **+0.1653** | 0.5221 | 0.0282 | Proportion of timeline elapsed. |
| `total_workers_required` | **0.0000** | 41.0000 | 1.0000 | Constant across all projects (zero variance). |

### 6.2 Mathematical Derivation of Example Attribution
For a project with `schedule_variance_pct = -14.2%`:
1. Standardized value:
   $$z = \frac{-14.20 - 11.7835}{16.1678} = -1.6071$$
2. Model coefficient: $\beta = -1.2735$.
3. Contribution to delay log-odds:
   $$\text{contribution} = \beta \times z = (-1.2735) \times (-1.6071) = \mathbf{+2.0467}$$
Because the project is $1.61\sigma$ behind the training mean, the negative coefficient correctly yields a **positive log-odds contribution of $+2.05$**, driving UP the delay risk score.

*(Note: Earlier draft documentation erroneously omitted the negative sign from the coefficient and approximated the contribution as $+1.82$; the correct mathematical contribution is $+2.0467$.)*

### 6.3 Understanding `total_workers_present`
`total_workers_present` has a raw coefficient of **`-0.9958`** (negative), perfectly aligning with its training correlation of **`-0.5453`** (more workers on site correlates with finishing on time). Because `total_workers_required` is constant (41 workers) across all 5-trade projects in the simulation, `total_workers_present` and `workforce_fulfillment_ratio` are perfectly collinear ($r = 1.0000$). L2 regularization split the negative weight evenly between them ($-0.9958$ and $-0.9960$).

---

## 7. Known Limitations & Defensive Integration

1. **Synthetic Simulation vs. Real-World Dynamics:** The simulation assumes parameterized Gamma, Beta, and Poisson distributions. It cannot model macroeconomic shocks, city-wide lockdowns, or vendor bankruptcies.
2. **Defensive History Guardrail:** Real projects with $< 3$ days of elapsed timeline or no configured trades return `model_status: "insufficient_history"` rather than hallucinating predictions.
3. **Non-Contractual Advisory:** Output is strictly decision support (`is_experimental_synthetic: true`).
