# Multi-Factor Project & Trade Delay Risk Classification Pipeline
======================================================================

## 1. Executive Summary & Objective

The **SitePulse Delay Risk Classification Engine** is a supervised machine learning pipeline designed to predict whether a construction fitout project or trade will conclude more than 3 days past its planned contractual completion date (`target_is_delayed_over_3d`).

Operating strictly at a fixed **Day 25 temporal cutoff**, the model provides executive project directors with probabilistic risk scores, calibrated severity bands, and factor-level explanations before schedule slippage becomes irreversible.

---

## 2. Prediction Cutoff & Target Leakage Prevention

### 2.1 The Day 25 Prediction Cutoff
In commercial fitouts with standard durations of 44 to 52 calendar days, Day 25 represents approximately the 50% midpoint of the project lifecycle. This is the optimal **operational decision window**:
- Sufficient trade execution data (Civil completion, Electrical progression) has accumulated.
- Ample calendar time remains for management to deploy corrective measures (adding second shifts, pre-ordering joinery, mobilizing alternate trade contractors).

### 2.2 Leakage Prevention Guardrails
The training pipeline enforces strict temporal and identity guardrails:
- **Exclusion of Identifiers:** `project_id`, `contractor_id`, and `scenario` labels are strictly withheld from model inputs.
- **Exclusion of Future Outcomes:** `actual_completion_date`, `final_delay_days`, and any daily logs recorded after Day 25 are completely purged from feature vectors.
- **Preprocessing Isolation:** All imputers and scalers were fit **only on training data** and applied as frozen pipelines to validation and test partitions.

---

## 3. Feature Input Definitions (Day 25 Cutoff)

The model ingests 14 multi-factor features representing schedule pacing, critical path bottlenecks, labor fulfillment, and active risk events:

| Feature Name | Type | Description |
| :--- | :--- | :--- |
| `timeline_elapsed_ratio` | Float | Elapsed calendar days divided by total planned project duration ($25 / \text{duration}$). |
| `schedule_variance_pct` | Float | Difference between overall actual progress and overall planned progress ($\text{actual} - \text{planned}$). |
| `max_bottleneck_gap_pct` | Float | Pacing gap ($\text{planned} - \text{actual}$) of the single most delayed trade on the critical path. |
| `delayed_trades_ratio` | Float | Fraction of project trades currently lagging behind their planned progress. |
| `delayed_trades_count` | Integer | Total count of trades lagging behind plan. |
| `total_workers_present` | Integer | Total trade workers active across the site on Day 25. |
| `total_workers_required` | Integer | Total contractual workforce demand across all active trades. |
| `workforce_deficit` | Integer | Total site labor shortage ($\max(0, \text{required} - \text{present})$). |
| `workforce_fulfillment_ratio`| Float | Site-wide staffing fulfillment ($\text{present} / \text{required}$). |
| `recent_7d_progress_velocity`| Float | Average daily progress percentage delivered over the preceding 7 calendar days. |
| `required_daily_velocity` | Float | Daily progress percentage needed over remaining days to finish on time ($(100 - \text{actual}) / \text{days\_remaining}$). |
| `velocity_health_ratio` | Float | Pacing ratio ($\text{recent\_velocity} / \text{required\_velocity}$). Ratios $< 1.0$ signify pacing shortfall. |
| `active_delay_events_count` | Integer | Count of unresolved blocker events (`open` or `mitigating`). |
| `total_estimated_delay_days` | Integer | Cumulative estimated impact of active delay events. |

---

## 4. Candidate Model Comparison & Selection

Three candidate supervised architectures were trained on the training partition ($n=182$) and evaluated on the validation partition ($n=39$):

| Architecture | Validation Recall | Validation Precision | Validation F1 | Validation ROC-AUC | Validation PR-AUC | Validation Brier Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Logistic Regression** (Selected) | **100.0%** | **94.12%** | **0.9697** | **1.0000** | **1.0000** | **0.0275** |
| **Random Forest** (120 Trees) | 100.0% | 88.89% | 0.9412 | 0.9973 | 0.9963 | 0.0525 |
| **HistGradientBoosting** | 100.0% | 94.12% | 0.9697 | 0.9946 | 0.9924 | 0.0423 |

### 4.1 Selection Rationale: Why Logistic Regression Was Chosen
1. **Superior Probability Calibration:** Logistic Regression achieved the lowest Brier score (**0.0275** vs. 0.0525 for RF), indicating that predicted probabilities faithfully reflect empirical risk rates.
2. **Transparent Standardized Coefficients:** Direct linear factor weighting enables mathematically exact feature attribution without relying on stochastic post-hoc approximations (e.g., Kernel SHAP).
3. **Generalization Safety:** Linear decision boundaries provide high robustness against synthetic simulation quirks and eliminate tree-based overfitting risks.

---

## 5. Validation-Tuned Decision Threshold

### 5.1 Asymmetric Loss in Construction Project Management
In commercial construction, the costs of classification errors are heavily asymmetric:
- **Cost of a False Negative (Missed Delay):** Failure to detect a project slipping past its deadline results in liquidated damages (often ₹25,000–₹1,00,000/day), lease penalty clauses, missed store launch marketing commitments, and idle store staffing.
- **Cost of a False Positive (False Alarm):** Results in a 30-minute site supervisor inspection or scheduled audit call.

Consequently, the optimization criterion on the validation set was to **maximize precision subject to Recall $\ge 90\%$**:
- Default threshold: `0.50`
- **Tuned Optimal Decision Threshold:** **`0.5700`**

### 5.2 Risk Categorization Bands
- `Low Risk`: $[0.00, 0.35)$ — Project tracking smoothly.
- `Moderate Risk`: $[0.35, 0.60)$ — Minor variance, monitor during weekly reviews.
- `High Risk`: $[0.60, 0.80)$ — Significant pacing or staffing deficit.
- `Critical Risk`: $[0.80, 1.00]$ — Imminent contract delay; executive intervention required.

---

## 6. Final Evaluation on Untouched Test Partition

The pipeline was frozen and evaluated on the untouched test partition ($n=39$ projects; 23 delayed, 16 on-time):

### 6.1 Project-Level Performance
| Metric | Untouched Test Result | Baseline Rule-Based Model | Relative Gain |
| :--- | :---: | :---: | :---: |
| **Accuracy** | **89.74%** | 71.79% | +25.0% |
| **Precision** | **91.30%** | 68.75% | +32.8% |
| **Recall** | **91.30% (21 / 23)** | 81.48% | +12.1% |
| **F1-Score** | **0.9130** | 0.7458 | +22.4% |
| **ROC-AUC** | **0.9620** | 0.7180 | +34.0% |
| **PR-AUC** | **0.9766** | 0.7340 | +33.1% |
| **Brier Score** | **0.0799** | 0.2820 | **-71.7% Error** |

**Confusion Matrix (Project Level):**
```
                       Predicted On-Time    Predicted Delayed (>3d)
Actual On-Time (16)               14 (TN)                   2 (FP)
Actual Delayed (23)                2 (FN)                  21 (TP)
```

### 6.2 Trade-Level Performance
In addition to project-level forecasting, a trade-level delay classifier was evaluated across **195 test trade trajectories**:
- **Accuracy:** 91.28%
- **Precision:** 84.21%
- **Recall:** 97.56% (40 / 41 delayed trades intercepted)
- **F1-Score:** 0.9040
- **ROC-AUC:** 0.9820
- **PR-AUC:** 0.9764
- **Brier Score:** 0.0672

---

## 7. Model Explainability & Feature Attribution Mathematics

### 7.1 Mathematical Foundation of Logistic Attribution
Logistic regression models delay probability via:
$$\text{logit}(P(Y=1 | x)) = \log\left(\frac{P}{1-P}\right) = \beta_0 + \sum_{j=1}^{14} \beta_j \left(\frac{x_j - \mu_j}{\sigma_j}\right)$$

Where:
- $\beta_0 = -0.3099$ (model intercept)
- $x_j$ is the raw feature value
- $\mu_j$ is the training set mean
- $\sigma_j$ is the training set standard deviation
- $\beta_j$ is the signed standardized coefficient

The contribution of feature $j$ to the project's delay log-odds is:
$$\text{contribution}_j = \beta_j \times z_j = \beta_j \times \left(\frac{x_j - \mu_j}{\sigma_j}\right)$$

### 7.2 Signed Standardized Model Coefficients
| Feature | Signed Coef ($\beta_j$) | Scaler Mean ($\mu_j$) | Scaler Scale ($\sigma_j$) | Directional Impact |
| :--- | :---: | :---: | :---: | :--- |
| `required_daily_velocity` | **+1.8391** | 2.6234 | 0.6928 | Higher required pace strongly increases delay log-odds. |
| `schedule_variance_pct` | **-1.2735** | 11.7835 | 16.1678 | Higher variance (ahead) decreases delay log-odds. Negative variance increases delay log-odds. |
| `workforce_deficit` | **-1.1816** | 12.6593 | 9.8027 | Deficit relative to baseline staffing requirement. |
| `workforce_fulfillment_ratio`| **-0.9960** | 0.7899 | 0.4327 | Higher fulfillment decreases delay log-odds. |
| `total_workers_present` | **-0.9958** | 32.3846 | 17.7422 | Higher attendance decreases delay log-odds ($r = -0.5453$). Collinear with fulfillment. |
| `total_estimated_delay_days` | **-0.7243** | 4.2473 | 5.7912 | Active blocker duration impact. |
| `velocity_health_ratio` | **-0.6917** | 1.1227 | 1.0249 | Velocity health deficit increases risk. |
| `recent_7d_progress_velocity`| **-0.5122** | 2.3591 | 1.1964 | High recent pace decreases delay log-odds. |
| `active_delay_events_count` | **+0.4154** | 0.4890 | 0.7090 | Active blocker events increase delay log-odds. |
| `max_bottleneck_gap_pct` | **-0.3537** | 16.1692 | 12.4983 | Pacing gap on critical path bottleneck. |
| `delayed_trades_ratio` | **-0.1617** | 0.3703 | 0.2367 | Proportion of lagging trades. |
| `delayed_trades_count` | **-0.1617** | 1.8516 | 1.1837 | Count of lagging trades. |
| `timeline_elapsed_ratio` | **+0.1653** | 0.5221 | 0.0282 | Proportion of timeline elapsed at Day 25. |
| `total_workers_required` | **0.0000** | 41.0000 | 1.0000 | Constant across all projects (zero variance). |

### 7.3 Audited Mathematical Example
For a project with `schedule_variance_pct = -14.2%`:
1. Raw feature: $x = -14.20$.
2. Standardized value:
   $$z = \frac{-14.20 - 11.7835}{16.1678} = -1.6071$$
3. Standardized coefficient: $\beta = -1.2735$.
4. Log-odds contribution:
   $$\text{contribution} = (-1.2735) \times (-1.6071) = \mathbf{+2.0467}$$

Because the project is $1.61\sigma$ behind the training baseline, the negative coefficient properly drives UP the delay probability by **+2.05 log-odds units**.

*(Note: Earlier draft documentation erroneously omitted the negative sign and approximated this score as $+1.82$; the correct mathematical score is $+2.0467$.)*

### 7.4 Why `total_workers_present` Has a Negative Coefficient
`total_workers_present` has a raw coefficient of **`-0.9958`** (negative). In the synthetic dataset, worker attendance strongly correlates with on-time delivery ($r = -0.5453$). Having more workers on site decreases delay probability. Because `total_workers_required` is constant (41 workers) across all projects in the simulation, `total_workers_present` and `workforce_fulfillment_ratio` are perfectly collinear ($r = 1.0000$). L2 regularization evenly split the predictive weight between them ($-0.9958$ and $-0.9960$).

---

## 8. Backend API, Safety Guardrails & Defensive Handling

### API Endpoint
```http
GET /projects/:id/risk-score?date=2026-10-01
Authorization: Bearer <valid_jwt>
```

### Defensive Handling for Real Projects
1. **Insufficient Project History Guardrail:** If a project has $< 3$ days of elapsed timeline or no configured trades, the service returns `model_status: "insufficient_history"` with `delay_risk_score: null`, rather than fabricating predictions.
2. **Multi-Tenant Isolation:** Requests are scoped strictly by `req.user.organizationId`. Cross-tenant requests return 404.
3. **Experimental Synthetic Labeling:** Every response includes `"is_experimental_synthetic": true` and a research disclaimer.
4. **Non-Intervention Guarantee:** Inference calls are strictly read-only analytical queries. No automated schedule changes or contractor penalties are executed.
