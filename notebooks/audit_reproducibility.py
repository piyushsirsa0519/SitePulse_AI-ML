"""
SitePulse — Independent Audit Script for Phase 4.1
===================================================
1. Reproduce Project Delay Classifier test metrics.
2. Reproduce Anomaly Detection test metrics.
3. Audit Feature Attribution Mathematics.
4. Audit Synthetic Simulation Scenarios & Calibration.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    average_precision_score, confusion_matrix, brier_score_loss, accuracy_score
)

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic")
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "model")

print("=================================================================")
print("AUDIT 1: PROJECT DELAY CLASSIFIER REPRODUCIBILITY")
print("=================================================================")

split_meta = json.load(open(os.path.join(DATA_DIR, "split_metadata.json")))
risk_pkg = joblib.load(os.path.join(MODEL_DIR, "risk_classifier", "risk_classifier.joblib"))
project_model = risk_pkg["project_model"]
feat_meta = json.load(open(os.path.join(MODEL_DIR, "risk_classifier", "feature_metadata.json")))
thresh_cfg = json.load(open(os.path.join(MODEL_DIR, "risk_classifier", "threshold_config.json")))
project_features = feat_meta["project_features"]
opt_thresh = thresh_cfg["project_threshold"]

test_p = pd.read_csv(os.path.join(DATA_DIR, "test_features.csv"))
X_test_p = test_p[project_features]
y_test_p = test_p["target_is_delayed_over_3d"].values

test_probs_p = project_model.predict_proba(X_test_p)[:, 1]
test_preds_p = (test_probs_p >= opt_thresh).astype(int)

cm_p = confusion_matrix(y_test_p, test_preds_p)
tn_p, fp_p, fn_p, tp_p = cm_p.ravel()

print(f"Projects count: Train={len(split_meta['train_projects'])}, Val={len(split_meta['val_projects'])}, Test={len(split_meta['test_projects'])}")
print(f"Test Projects Rows: {len(test_p)}, Unique PIDs: {test_p['project_id'].nunique()}")
print(f"Confusion Matrix: TN={tn_p}, FP={fp_p}, FN={fn_p}, TP={tp_p}")
print(f"Accuracy : {accuracy_score(y_test_p, test_preds_p):.4f}")
print(f"Precision: {precision_score(y_test_p, test_preds_p):.4f}")
print(f"Recall   : {recall_score(y_test_p, test_preds_p):.4f}")
print(f"F1-Score : {f1_score(y_test_p, test_preds_p):.4f}")
print(f"ROC-AUC  : {roc_auc_score(y_test_p, test_probs_p):.4f}")
print(f"PR-AUC   : {average_precision_score(y_test_p, test_probs_p):.4f}")
print(f"Brier    : {brier_score_loss(y_test_p, test_probs_p):.4f}")
print(f"Threshold: {opt_thresh:.4f}")

print("\n=================================================================")
print("AUDIT 2: ANOMALY DETECTION ENGINE REPRODUCIBILITY")
print("=================================================================")

anomaly_pkg = joblib.load(os.path.join(MODEL_DIR, "anomaly", "isolation_forest.joblib"))
anomaly_cfg = json.load(open(os.path.join(MODEL_DIR, "anomaly", "anomaly_config.json")))
iso_forest = anomaly_pkg["iso_forest"]
scaler = anomaly_pkg["scaler"]
anomaly_features = anomaly_pkg["features"]
anom_thresh = anomaly_cfg["optimal_threshold"]

trajectories_df = pd.read_csv(os.path.join(DATA_DIR, "consolidated_trajectories.csv"))
test_pids = set(split_meta["test_projects"])
test_traj = trajectories_df[trajectories_df["project_id"].isin(test_pids)].copy()

# Feature computation
test_traj["productivity_ratio"] = test_traj["daily_delta_pct"] / np.maximum(1, test_traj["workers_present"])
test_traj["shortfall_workers"] = np.maximum(0, test_traj["workers_required"] - test_traj["workers_present"])
test_traj["has_active_hold"] = test_traj["reason"].isin(["Material Delay", "Client Hold", "Waiting on Another Trade"]).astype(float)
test_traj["unexplained_zero_progress"] = ((test_traj["has_active_hold"] == 0) & (test_traj["workers_present"] >= 4) & (test_traj["daily_delta_pct"] <= 0.05)).astype(float)

X_test_a = test_traj[anomaly_features]
y_test_a = test_traj["is_anomaly"].values

X_test_a_scaled = scaler.transform(X_test_a)
raw_decisions = iso_forest.decision_function(X_test_a_scaled)
iso_scores = 1.0 / (1.0 + np.exp(raw_decisions * 45.0))

hybrid_scores = []
for idx, (_, r) in enumerate(test_traj.iterrows()):
    delta = r["daily_delta_pct"]
    w = r["workers_present"]
    req = r["workers_required"]
    st = r["consecutive_stagnant"]
    hold = bool(r["has_active_hold"] > 0.5)

    r_score = 0.0
    if delta >= 14.0:
        r_score = 0.98
    elif not hold and w >= 4 and delta <= 0.05 and st >= 1:
        r_score = 0.95
    elif w == 0 and delta >= 2.0:
        r_score = 0.96
    elif w >= 0.8 * req and st >= 4 and delta <= 0.05:
        r_score = 0.88
    hybrid_scores.append(max(iso_scores[idx], r_score))

hybrid_scores = np.array(hybrid_scores)
test_preds_a = (hybrid_scores >= anom_thresh).astype(int)

cm_a = confusion_matrix(y_test_a, test_preds_a)
tn_a, fp_a, fn_a, tp_a = cm_a.ravel()
fpr_a = fp_a / max(1, (fp_a + tn_a))

top_idx = np.argsort(hybrid_scores)[::-1]
p_10 = y_test_a[top_idx[:10]].mean()
p_20 = y_test_a[top_idx[:20]].mean()
p_50 = y_test_a[top_idx[:50]].mean()

print(f"Test Trajectory Records: {len(test_traj)}")
print(f"Confusion Matrix: TN={tn_a}, FP={fp_a}, FN={fn_a}, TP={tp_a}")
print(f"Precision: {precision_score(y_test_a, test_preds_a):.4f}")
print(f"Recall   : {recall_score(y_test_a, test_preds_a):.4f}")
print(f"F1-Score : {f1_score(y_test_a, test_preds_a):.4f}")
print(f"PR-AUC   : {average_precision_score(y_test_a, hybrid_scores):.4f}")
print(f"FPR      : {fpr_a:.4f} ({fpr_a*100:.2f}%)")
print(f"Precision@10: {p_10:.4f}")
print(f"Precision@20: {p_20:.4f}")
print(f"Precision@50: {p_50:.4f}")
print(f"Threshold: {anom_thresh:.4f}")

print("\n=================================================================")
print("AUDIT 3: FEATURE ATTRIBUTION MATHEMATICS & LOGISTIC REGRESSION")
print("=================================================================")

imputer = project_model.named_steps["imputer"]
scaler_risk = project_model.named_steps["scaler"]
clf = project_model.named_steps["clf"]

raw_coefs = clf.coef_[0]
intercept = clf.intercept_[0]
means = scaler_risk.mean_
scales = scaler_risk.scale_

print(f"Model Intercept (log-odds bias): {intercept:.4f}")
print(f"{'Feature':30s} | {'Raw Coef':10s} | {'Scaler Mean':12s} | {'Scaler Scale':12s} | {'Eff Unscaled Coef':18s}")
print("-" * 90)
for feat, coef, m, s in zip(project_features, raw_coefs, means, scales):
    eff_unscaled = coef / s
    print(f"{feat:30s} | {coef:+10.4f} | {m:12.4f} | {s:12.4f} | {eff_unscaled:+18.4f}")

print("\n=================================================================")
print("AUDIT 4: SCENARIO-LEVEL SIMULATION AUDIT")
print("=================================================================")

projects_df = pd.read_csv(os.path.join(DATA_DIR, "projects.csv"))
scenario_summary = []

for sc in sorted(projects_df["scenario"].unique()):
    sub = projects_df[projects_df["scenario"] == sc]
    n_proj = len(sub)
    mean_plan = sub["planned_duration_days"].mean()
    mean_act = sub["actual_duration_days"].mean()
    mean_del = sub["delay_days"].mean()
    pct_del_3d = (sub["delay_days"] > 3).mean() * 100.0
    min_del = sub["delay_days"].min()
    max_del = sub["delay_days"].max()
    scenario_summary.append({
        "scenario": sc,
        "n_projects": n_proj,
        "mean_planned": round(mean_plan, 1),
        "mean_actual": round(mean_act, 1),
        "mean_delay_days": round(mean_del, 2),
        "pct_delayed_over_3d": round(pct_del_3d, 1),
        "min_delay": int(min_del),
        "max_delay": int(max_del)
    })

sc_df = pd.DataFrame(scenario_summary)
print(sc_df.to_string(index=False))
