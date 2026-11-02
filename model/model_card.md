# SitePulse — Model Card: Phase 4 Applied Machine Learning
**Release Version:** 1.0.0 | **Training Date:** October 2026 | **Status:** Validated Synthetic Benchmark

---

## 1. Model Details
- **Architecture 1 (Anomaly Detection):** Hybrid Isolation Forest (Hybrid Isolation Forest + Rule-Based Engine) with domain-specific statistical rule bounds.
- **Architecture 2 (Delay Risk Classification):** LogisticRegression with median imputation and standardized numerical feature pipeline.
- **Task 1:** Detect irregular progress reporting (phantom workforce, implausible spikes, unreported progress).
- **Task 2:** Binary classification predicting whether a retail store fitout project exceeds planned completion by $> 3$ days (`target_is_delayed_over_3d`).
- **Prediction Cutoff:** Day 25 ($T = 25$) after mobilization (zero-leakage temporal guardrail).

---

## 2. Intended Users & Use Cases
- **Intended Users:** Retail fitout project managers, construction executives, procurement leads, and site monitoring engineers.
- **Primary Use Case:** Proactive decision support and risk mitigation at project mid-point ($T = 25$).
- **Out of Scope:** Automated punitive contractor actions or autonomous schedule re-baselining without human engineering inspection.

---

## 3. Training & Evaluation Datasets
- **Source:** SitePulse Construction Simulation Engine (Seed 42).
- **Volume:** 260 projects across 8 operational construction scenarios.
- **Partition:** Project-Level Grouped Splitting (Train: 182 projects / 70%, Val: 39 projects / 15%, Test: 39 projects / 15%).
- **Class Balance:** 51.15% Delayed ($>3$d), 48.85% On-Time/Recovered.

---

## 4. Test Performance Metrics (Untouched Test Set)

### A. Anomaly Detection
- **Precision:** 64.62%
- **Recall:** 100.00%
- **F1-Score:** 0.7850
- **PR-AUC:** 0.5401
- **False Positive Rate:** 0.27%
- **Precision@10:** 20.0%

### B. Project Delay Risk Classification (LogisticRegression)
- **Accuracy:** 89.74%
- **Precision:** 91.30%
- **Recall:** 91.30%
- **F1-Score:** 0.9130
- **ROC-AUC:** 0.9620
- **PR-AUC:** 0.9766
- **Brier Calibration Score:** 0.0799
- **Confusion Matrix:** TP=21, FP=2, FN=2, TN=14

---

## 5. Explainability & Top Predictive Drivers
1. **Schedule Variance (%)**: Leading indicator of physical progress lag ($r = -0.700$).
2. **Maximum Bottleneck Gap (%)**: Identifies critical-path lagging trades holding downstream predecessors.
3. **Delayed Trades Ratio**: Reflects breadth of multi-trade site distress.
4. **Velocity Health Ratio**: Compares trailing 7-day speed to required deadline burn-rate.
5. **Workforce Deficit**: Staffing shortfall directly driving downstream completion slip.

---

## 6. Caveats & Ethical Considerations
- **Synthetic Simulation Disclaimer:** These models were trained on physics-based synthetic simulations. While structurally rigorous, **metrics do not reflect real-world customer field validation.**
- **Human-in-the-Loop:** Predictions must serve as advisory decision support; site interventions require contractor and site engineer confirmation.
