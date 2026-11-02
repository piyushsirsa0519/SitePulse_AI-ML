"""
SitePulse — Lightweight ML Inference Service (FastAPI)
======================================================
Serves serialized applied machine learning models:
  1. Hybrid Anomaly Detection Engine (Isolation Forest + Domain Rules)
  2. Multi-factor Delay Risk Classifier (Project & Trade Level)

Strictly marked as experimental synthetic-data-trained models.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

# Base Directory Resolution
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(BASE_DIR, "model"))
ANOMALY_DIR = os.path.join(MODEL_DIR, "anomaly")
RISK_DIR = os.path.join(MODEL_DIR, "risk_classifier")

app = FastAPI(
    title="SitePulse ML Inference Service",
    description="Applied Machine Learning inference layer for Construction Progress Anomaly Detection and Delay Risk Prediction.",
    version="1.0.0-synthetic"
)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# ARTIFACT INITIALIZATION
# -----------------------------------------------------------------------------
anomaly_pkg = None
anomaly_cfg = None
risk_pkg = None
feature_meta = None
thresh_cfg = None

try:
    anomaly_pkg = joblib.load(os.path.join(ANOMALY_DIR, "isolation_forest.joblib"))
    with open(os.path.join(ANOMALY_DIR, "anomaly_config.json")) as f:
        anomaly_cfg = json.load(f)
except Exception as e:
    print(f"[WARN] Could not load anomaly artifacts: {e}")

try:
    risk_pkg = joblib.load(os.path.join(RISK_DIR, "risk_classifier.joblib"))
    with open(os.path.join(RISK_DIR, "feature_metadata.json")) as f:
        feature_meta = json.load(f)
    with open(os.path.join(RISK_DIR, "threshold_config.json")) as f:
        thresh_cfg = json.load(f)
except Exception as e:
    print(f"[WARN] Could not load risk classifier artifacts: {e}")


# -----------------------------------------------------------------------------
# PYDANTIC SCHEMAS
# -----------------------------------------------------------------------------
class AnomalyInput(BaseModel):
    trade_id: Optional[str] = "trd-01"
    trade_name: Optional[str] = "Trade"
    date: Optional[str] = "2026-10-01"
    daily_delta_pct: float = Field(..., ge=0.0, le=100.0)
    workers_present: int = Field(..., ge=0)
    workers_required: int = Field(..., ge=0)
    consecutive_stagnant: int = Field(default=0, ge=0)
    has_active_hold: float = Field(default=0.0, ge=0.0, le=1.0)
    reason: Optional[str] = "On Track"

class BatchAnomalyInput(BaseModel):
    records: List[AnomalyInput]

class ProjectRiskInput(BaseModel):
    project_id: Optional[str] = "prj-01"
    timeline_elapsed_ratio: float = Field(..., ge=0.0)
    schedule_variance_pct: float
    max_bottleneck_gap_pct: float = Field(..., ge=0.0)
    delayed_trades_ratio: float = Field(..., ge=0.0, le=1.0)
    delayed_trades_count: int = Field(..., ge=0)
    total_workers_present: int = Field(..., ge=0)
    total_workers_required: int = Field(..., ge=0)
    workforce_deficit: int
    workforce_fulfillment_ratio: float = Field(..., ge=0.0)
    recent_7d_progress_velocity: float = Field(..., ge=0.0)
    required_daily_velocity: float = Field(..., ge=0.0)
    velocity_health_ratio: float = Field(..., ge=0.0)
    active_delay_events_count: int = Field(..., ge=0)
    total_estimated_delay_days: int = Field(..., ge=0)

class TradeRiskInput(BaseModel):
    trade_id: Optional[str] = "trd-01"
    trade_name: Optional[str] = "Trade"
    trade_actual_pct: float = Field(..., ge=0.0, le=100.0)
    trade_planned_pct: float = Field(..., ge=0.0, le=100.0)
    trade_progress_variance: float
    trade_rolling_7d_velocity: float = Field(..., ge=0.0)
    workers_present: int = Field(..., ge=0)
    workers_required: int = Field(..., ge=0)
    trade_manpower_utilization: float = Field(..., ge=0.0)
    consecutive_stagnant_days: int = Field(..., ge=0)
    days_until_planned_completion: int
    historical_delay_count: int = Field(..., ge=0)


# -----------------------------------------------------------------------------
# HELPER LOGIC: ANOMALY SCORING
# -----------------------------------------------------------------------------
def score_single_anomaly(record: AnomalyInput) -> Dict[str, Any]:
    if anomaly_pkg is None:
        raise HTTPException(status_code=503, detail="Anomaly detection model not loaded")

    iso_forest = anomaly_pkg["iso_forest"]
    scaler = anomaly_pkg["scaler"]
    features_list = anomaly_pkg["features"]

    shortfall = max(0, record.workers_required - record.workers_present)
    productivity = record.daily_delta_pct / max(1, record.workers_present)
    unexplained_zero = 1.0 if (record.has_active_hold == 0 and record.workers_present >= 4 and record.daily_delta_pct <= 0.05) else 0.0

    raw_feat = {
        "daily_delta_pct": float(record.daily_delta_pct),
        "workers_present": float(record.workers_present),
        "workers_required": float(record.workers_required),
        "shortfall_workers": float(shortfall),
        "productivity_ratio": float(productivity),
        "consecutive_stagnant": float(record.consecutive_stagnant),
        "has_active_hold": float(record.has_active_hold),
        "unexplained_zero_progress": float(unexplained_zero)
    }

    df_feat = pd.DataFrame([raw_feat])[features_list]
    vec_scaled = scaler.transform(df_feat)
    raw_score = iso_forest.decision_function(vec_scaled)[0]
    iso_score = 1.0 / (1.0 + np.exp(raw_score * 45.0))

    # Evaluate Domain Rules
    rule_score = 0.0
    category = "unsupervised_statistical"
    explanation = "Flagged by multivariate Isolation Forest: statistical outlier across progress and manpower dimensions."

    delta = record.daily_delta_pct
    w = record.workers_present
    req = record.workers_required
    st = record.consecutive_stagnant
    hold = bool(record.has_active_hold > 0.5)

    if delta >= 14.0:
        rule_score = 0.98
        category = "implausible_progress_spike"
        explanation = f"Daily progress jumped by {delta:.1f}%, which exceeds single-day physical work capacity limits."
    elif not hold and w >= 4 and delta <= 0.05 and st >= 1:
        rule_score = 0.95
        category = "phantom_workforce"
        if req > 0 and w >= req:
            explanation = f"Full workforce ({w}/{req} workers logged) with zero physical progress and no active hold or blocker event."
        else:
            explanation = f"Active workforce presence ({w} workers logged, required: {req}) with zero physical progress and no active hold or blocker event."
    elif w == 0 and delta >= 2.0:
        rule_score = 0.96
        category = "unreported_workforce"
        explanation = f"Progress increased by {delta:.1f}% with zero workers logged on site (unreported crew or reporting anomaly)."
    elif w >= 0.8 * req and st >= 4 and delta <= 0.05:
        rule_score = 0.88
        category = "stagnant_despite_presence"
        explanation = f"Extended trade stagnation ({st} consecutive days) despite regular workforce presence ({w}/{req} workers)."

    final_score = round(float(max(iso_score, rule_score)), 4)
    threshold = anomaly_cfg["optimal_threshold"] if anomaly_cfg else 0.89

    if final_score >= 0.85:
        severity = "Critical"
    elif final_score >= 0.65:
        severity = "High"
    elif final_score >= 0.45:
        severity = "Medium"
    else:
        severity = "Low"

    return {
        "trade_id": record.trade_id,
        "trade_name": record.trade_name,
        "date": record.date,
        "anomaly_score": final_score,
        "is_anomaly": bool(final_score >= threshold),
        "severity": severity,
        "category": category,
        "explanation": explanation,
        "supporting_features": raw_feat
    }


# -----------------------------------------------------------------------------
# HELPER LOGIC: DELAY RISK PREDICTION & EXPLAINABILITY
# -----------------------------------------------------------------------------
def predict_project_delay_risk(data: ProjectRiskInput) -> Dict[str, Any]:
    if risk_pkg is None:
        raise HTTPException(status_code=503, detail="Risk classification model not loaded")

    project_pipe = risk_pkg["project_model"]
    project_features = feature_meta["project_features"]
    threshold = thresh_cfg.get("project_threshold", 0.57)

    feat_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    df_feat = pd.DataFrame([feat_dict])[project_features]

    proba = float(project_pipe.predict_proba(df_feat)[0][1])
    is_delayed = bool(proba >= threshold)

    # Risk Category
    if proba >= 0.80:
        risk_category = "Critical"
    elif proba >= 0.60:
        risk_category = "High"
    elif proba >= 0.35:
        risk_category = "Moderate"
    else:
        risk_category = "Low"

    # Compute Feature Contributions for Explainability
    # Using Logistic Regression standardized coefficients
    scaler = project_pipe.named_steps["scaler"]
    clf = project_pipe.named_steps["clf"]
    imputer = project_pipe.named_steps["imputer"]

    imputed_vec = imputer.transform(df_feat)
    scaled_vec = scaler.transform(imputed_vec)[0]
    coefficients = clf.coef_[0]

    contributions = []
    for idx, feat_name in enumerate(project_features):
        contrib = float(scaled_vec[idx] * coefficients[idx])
        contributions.append({
            "feature": feat_name,
            "value": float(feat_dict[feat_name]),
            "coefficient": round(float(coefficients[idx]), 4),
            "contribution_score": round(contrib, 4)
        })

    # Sort positive delay risk contributors
    contributions.sort(key=lambda x: x["contribution_score"], reverse=True)
    top_factors = contributions[:5]

    # Rule-augmented human explanations
    explanations = []
    if data.required_daily_velocity > 2.5:
        explanations.append(f"Required daily velocity is critically high ({data.required_daily_velocity:.2f}%/day) to achieve planned deadline.")
    if data.schedule_variance_pct < -5.0:
        explanations.append(f"Project overall progress schedule variance is lagging behind by {data.schedule_variance_pct:.1f}%.")
    if data.workforce_fulfillment_ratio < 0.80:
        explanations.append(f"Workforce fulfillment is deficient at {data.workforce_fulfillment_ratio*100:.1f}% of required staffing.")
    if data.velocity_health_ratio < 0.80:
        explanations.append(f"Recent 7-day progress velocity ({data.recent_7d_progress_velocity:.2f}%/day) is failing to keep required pace.")
    if data.active_delay_events_count > 0:
        explanations.append(f"Project is impeded by {data.active_delay_events_count} unresolved delay event(s) totaling ~{data.total_estimated_delay_days} days.")
    if not explanations:
        if is_delayed:
            explanations.append("Combined multi-factor trajectory indicates elevated delay risk across trade timelines.")
        else:
            explanations.append("Project indicators are tracking safely within nominal operating thresholds.")

    return {
        "project_id": data.project_id,
        "delay_risk_score": round(proba, 4),
        "predicted_delay_over_3d": is_delayed,
        "decision_threshold": threshold,
        "risk_category": risk_category,
        "top_factors": top_factors,
        "explanations": explanations,
        "feature_values": feat_dict,
        "is_experimental_synthetic": True,
        "disclaimer": "Trained on synthetic simulation data for research & prototyping. Not validated for production life-safety or contractual execution."
    }


# -----------------------------------------------------------------------------
# API ENDPOINTS
# -----------------------------------------------------------------------------
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "sitepulse-ml-inference",
        "version": "1.0.0-synthetic",
        "models_loaded": {
            "anomaly": anomaly_pkg is not None,
            "risk_classifier": risk_pkg is not None
        },
        "thresholds": {
            "anomaly": anomaly_cfg.get("optimal_threshold") if anomaly_cfg else 0.89,
            "project_risk": thresh_cfg.get("project_threshold") if thresh_cfg else 0.57,
            "trade_risk": thresh_cfg.get("trade_threshold") if thresh_cfg else 0.50
        },
        "is_experimental_synthetic": True
    }


@app.post("/predict/anomaly")
def predict_anomaly(record: AnomalyInput):
    return score_single_anomaly(record)


@app.post("/predict/anomaly/batch")
def predict_anomaly_batch(batch: BatchAnomalyInput):
    results = [score_single_anomaly(r) for r in batch.records]
    anomalies_only = [r for r in results if r["is_anomaly"]]
    return {
        "total_analyzed": len(results),
        "anomalies_detected_count": len(anomalies_only),
        "anomalies": anomalies_only,
        "all_results": results,
        "is_experimental_synthetic": True,
        "disclaimer": "Trained on synthetic simulation data for research & prototyping. Not validated for production life-safety or contractual execution."
    }


@app.post("/predict/risk-score")
def predict_risk_score(data: ProjectRiskInput):
    return predict_project_delay_risk(data)


@app.post("/predict/trade-risk")
def predict_trade_risk(data: TradeRiskInput):
    if risk_pkg is None:
        raise HTTPException(status_code=503, detail="Risk classification model not loaded")

    trade_pipe = risk_pkg["trade_model"]
    trade_features = feature_meta["trade_features"]
    threshold = thresh_cfg.get("trade_threshold", 0.50)

    feat_dict = data.model_dump() if hasattr(data, "model_dump") else data.dict()
    df_feat = pd.DataFrame([feat_dict])[trade_features]
    proba = float(trade_pipe.predict_proba(df_feat)[0][1])
    is_delayed = bool(proba >= threshold)

    return {
        "trade_id": data.trade_id,
        "trade_name": data.trade_name,
        "delay_risk_score": round(proba, 4),
        "predicted_delay_over_3d": is_delayed,
        "decision_threshold": threshold,
        "risk_category": "High" if proba >= 0.6 else ("Moderate" if proba >= 0.35 else "Low"),
        "is_experimental_synthetic": True,
        "disclaimer": "Trained on synthetic simulation data for research & prototyping. Not validated for production life-safety or contractual execution."
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
