"""
SitePulse — Unit and Integration Tests for ML Capabilities
==========================================================
Tests:
  1. Model artifact loading & integrity
  2. Feature preprocessing & imputation
  3. Prediction output schemas
  4. Missing & invalid input handling
  5. Anomaly threshold & severity categorization
  6. Partial vs. Full workforce explanation audit
  7. Risk classification calibration & decision threshold
  8. Feature attribution mathematics (signed coefficients & log-odds contributions)
  9. Validation-only threshold selection integrity
 10. Test-set metric exact reproducibility
"""

import os
import json
import unittest
import numpy as np
import pandas as pd
import joblib

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data", "synthetic")
ANOMALY_DIR = os.path.join(BASE_DIR, "model", "anomaly")
RISK_DIR = os.path.join(BASE_DIR, "model", "risk_classifier")


class TestModelArtifacts(unittest.TestCase):
    def test_01_anomaly_artifacts_exist_and_load(self):
        iso_path = os.path.join(ANOMALY_DIR, "isolation_forest.joblib")
        cfg_path = os.path.join(ANOMALY_DIR, "anomaly_config.json")
        self.assertTrue(os.path.exists(iso_path), "isolation_forest.joblib must exist")
        self.assertTrue(os.path.exists(cfg_path), "anomaly_config.json must exist")

        pkg = joblib.load(iso_path)
        self.assertIn("iso_forest", pkg)
        self.assertIn("scaler", pkg)
        self.assertIn("features", pkg)
        self.assertEqual(len(pkg["features"]), 8)

        with open(cfg_path) as f:
            cfg = json.load(f)
        self.assertIn("optimal_threshold", cfg)
        self.assertGreater(cfg["optimal_threshold"], 0.5)

    def test_02_risk_classifier_artifacts_exist_and_load(self):
        risk_path = os.path.join(RISK_DIR, "risk_classifier.joblib")
        meta_path = os.path.join(RISK_DIR, "feature_metadata.json")
        thresh_path = os.path.join(RISK_DIR, "threshold_config.json")

        self.assertTrue(os.path.exists(risk_path), "risk_classifier.joblib must exist")
        self.assertTrue(os.path.exists(meta_path), "feature_metadata.json must exist")
        self.assertTrue(os.path.exists(thresh_path), "threshold_config.json must exist")

        pkg = joblib.load(risk_path)
        self.assertIn("project_model", pkg)
        self.assertIn("trade_model", pkg)
        self.assertIn("project_features", pkg)
        self.assertEqual(len(pkg["project_features"]), 14)


class TestAnomalyInference(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.iso_pkg = joblib.load(os.path.join(ANOMALY_DIR, "isolation_forest.joblib"))
        with open(os.path.join(ANOMALY_DIR, "anomaly_config.json")) as f:
            cls.cfg = json.load(f)

    def test_03_implausible_progress_spike_detected(self):
        from backend.ml_service.main import score_single_anomaly, AnomalyInput
        rec = AnomalyInput(
            trade_id="trd-civ",
            trade_name="Civil",
            daily_delta_pct=16.5,
            workers_present=10,
            workers_required=10
        )
        res = score_single_anomaly(rec)
        self.assertTrue(res["is_anomaly"])
        self.assertEqual(res["category"], "implausible_progress_spike")
        self.assertEqual(res["severity"], "Critical")
        self.assertGreaterEqual(res["anomaly_score"], 0.95)

    def test_04_phantom_workforce_detected_full_workforce(self):
        from backend.ml_service.main import score_single_anomaly, AnomalyInput
        rec = AnomalyInput(
            trade_id="trd-elec",
            trade_name="Electrical",
            daily_delta_pct=0.0,
            workers_present=6,
            workers_required=6,
            consecutive_stagnant=2,
            has_active_hold=0.0,
            reason="On Track"
        )
        res = score_single_anomaly(rec)
        self.assertTrue(res["is_anomaly"])
        self.assertEqual(res["category"], "phantom_workforce")
        self.assertEqual(res["severity"], "Critical")
        self.assertIn("Full workforce", res["explanation"])

    def test_04b_phantom_workforce_detected_partial_workforce_explanation(self):
        from backend.ml_service.main import score_single_anomaly, AnomalyInput
        # Present 4 < Required 9: must NOT be called "Full workforce"
        rec = AnomalyInput(
            trade_id="trd-elec",
            trade_name="Electrical",
            daily_delta_pct=0.0,
            workers_present=4,
            workers_required=9,
            consecutive_stagnant=2,
            has_active_hold=0.0,
            reason="On Track"
        )
        res = score_single_anomaly(rec)
        self.assertTrue(res["is_anomaly"])
        self.assertEqual(res["category"], "phantom_workforce")
        self.assertNotIn("Full workforce", res["explanation"])
        self.assertIn("Active workforce presence", res["explanation"])
        self.assertIn("4 workers logged, required: 9", res["explanation"])

    def test_05_unreported_workforce_detected(self):
        from backend.ml_service.main import score_single_anomaly, AnomalyInput
        rec = AnomalyInput(
            trade_id="trd-paint",
            trade_name="Painting",
            daily_delta_pct=3.5,
            workers_present=0,
            workers_required=4
        )
        res = score_single_anomaly(rec)
        self.assertTrue(res["is_anomaly"])
        self.assertEqual(res["category"], "unreported_workforce")

    def test_06_normal_observation_not_flagged(self):
        from backend.ml_service.main import score_single_anomaly, AnomalyInput
        rec = AnomalyInput(
            trade_id="trd-carp",
            trade_name="Carpentry",
            daily_delta_pct=2.4,
            workers_present=8,
            workers_required=8,
            consecutive_stagnant=0,
            has_active_hold=0.0
        )
        res = score_single_anomaly(rec)
        self.assertFalse(res["is_anomaly"])
        self.assertLess(res["anomaly_score"], self.cfg["optimal_threshold"])


class TestRiskClassifierInference(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.risk_pkg = joblib.load(os.path.join(RISK_DIR, "risk_classifier.joblib"))
        with open(os.path.join(RISK_DIR, "threshold_config.json")) as f:
            cls.thresh = json.load(f)

    def test_07_delayed_project_flagged_with_high_risk(self):
        from backend.ml_service.main import predict_project_delay_risk, ProjectRiskInput
        data = ProjectRiskInput(
            project_id="prj-test-delay",
            timeline_elapsed_ratio=0.58,
            schedule_variance_pct=-18.5,
            max_bottleneck_gap_pct=22.0,
            delayed_trades_ratio=0.6,
            delayed_trades_count=3,
            total_workers_present=18,
            total_workers_required=32,
            workforce_deficit=14,
            workforce_fulfillment_ratio=0.56,
            recent_7d_progress_velocity=0.6,
            required_daily_velocity=3.2,
            velocity_health_ratio=0.35,
            active_delay_events_count=2,
            total_estimated_delay_days=12
        )
        res = predict_project_delay_risk(data)
        self.assertTrue(res["predicted_delay_over_3d"])
        self.assertGreaterEqual(res["delay_risk_score"], self.thresh["project_threshold"])
        self.assertIn(res["risk_category"], ["High", "Critical"])
        self.assertTrue(res["is_experimental_synthetic"])
        self.assertIn("synthetic simulation data", res["disclaimer"])
        self.assertGreater(len(res["top_factors"]), 0)
        self.assertGreater(len(res["explanations"]), 0)

    def test_08_on_time_project_evaluated_as_low_risk(self):
        from backend.ml_service.main import predict_project_delay_risk, ProjectRiskInput
        data = ProjectRiskInput(
            project_id="prj-test-ontime",
            timeline_elapsed_ratio=0.52,
            schedule_variance_pct=15.0,
            max_bottleneck_gap_pct=0.0,
            delayed_trades_ratio=0.0,
            delayed_trades_count=0,
            total_workers_present=35,
            total_workers_required=30,
            workforce_deficit=0,
            workforce_fulfillment_ratio=1.16,
            recent_7d_progress_velocity=2.8,
            required_daily_velocity=0.9,
            velocity_health_ratio=2.5,
            active_delay_events_count=0,
            total_estimated_delay_days=0
        )
        res = predict_project_delay_risk(data)
        self.assertFalse(res["predicted_delay_over_3d"])
        self.assertLess(res["delay_risk_score"], self.thresh["project_threshold"])
        self.assertEqual(res["risk_category"], "Low")

    def test_09_pipeline_handles_missing_values_via_imputer(self):
        pipe = self.risk_pkg["project_model"]
        df_missing = pd.DataFrame([{
            "timeline_elapsed_ratio": 0.5,
            "schedule_variance_pct": np.nan, # Missing
            "max_bottleneck_gap_pct": 10.0,
            "delayed_trades_ratio": np.nan, # Missing
            "delayed_trades_count": 1,
            "total_workers_present": 20,
            "total_workers_required": 25,
            "workforce_deficit": 5,
            "workforce_fulfillment_ratio": 0.8,
            "recent_7d_progress_velocity": 1.2,
            "required_daily_velocity": np.nan, # Missing
            "velocity_health_ratio": 0.7,
            "active_delay_events_count": 0,
            "total_estimated_delay_days": 0
        }])
        proba = pipe.predict_proba(df_missing)[0][1]
        self.assertTrue(0.0 <= proba <= 1.0, "Pipeline must impute NaNs without crashing")

    def test_10_feature_attribution_signs_and_magnitude(self):
        pipe = self.risk_pkg["project_model"]
        clf = pipe.named_steps["clf"]
        scaler = pipe.named_steps["scaler"]
        features = self.risk_pkg["project_features"]

        coef_map = dict(zip(features, clf.coef_[0]))
        mean_map = dict(zip(features, scaler.mean_))
        scale_map = dict(zip(features, scaler.scale_))

        # Check raw signs
        self.assertLess(coef_map["schedule_variance_pct"], 0.0, "Schedule variance must have negative coefficient")
        self.assertAlmostEqual(coef_map["schedule_variance_pct"], -1.2735, places=3)
        self.assertLess(coef_map["total_workers_present"], 0.0, "Total workers present must have negative coefficient")
        self.assertAlmostEqual(coef_map["total_workers_present"], -0.9958, places=3)
        self.assertGreater(coef_map["required_daily_velocity"], 0.0, "Required daily velocity must have positive coefficient")
        self.assertAlmostEqual(coef_map["required_daily_velocity"], 1.8391, places=3)

        # Check exact mathematical contribution for schedule_variance_pct = -14.2
        val = -14.2
        mu = mean_map["schedule_variance_pct"]
        sigma = scale_map["schedule_variance_pct"]
        z = (val - mu) / sigma
        beta = coef_map["schedule_variance_pct"]
        contribution = beta * z
        self.assertGreater(contribution, 0.0, "Negative variance must contribute positively to delay log-odds")
        self.assertAlmostEqual(contribution, 2.0467, places=3)

    def test_11_test_set_delay_classifier_exact_reproducibility(self):
        pipe = self.risk_pkg["project_model"]
        features = self.risk_pkg["project_features"]
        opt_thresh = self.thresh["project_threshold"]

        test_p = pd.read_csv(os.path.join(DATA_DIR, "test_features.csv"))
        self.assertEqual(len(test_p), 39, "Test partition must have 39 projects")
        self.assertEqual(test_p["project_id"].nunique(), 39)

        X_test = test_p[features]
        y_test = test_p["target_is_delayed_over_3d"].values

        probs = pipe.predict_proba(X_test)[:, 1]
        preds = (probs >= opt_thresh).astype(int)

        from sklearn.metrics import confusion_matrix, accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, average_precision_score, brier_score_loss
        cm = confusion_matrix(y_test, preds)
        tn, fp, fn, tp = cm.ravel()

        self.assertEqual((tn, fp, fn, tp), (14, 2, 2, 21), "Confusion matrix must match TN=14, FP=2, FN=2, TP=21")
        self.assertAlmostEqual(accuracy_score(y_test, preds), 0.8974, places=3)
        self.assertAlmostEqual(precision_score(y_test, preds), 0.9130, places=3)
        self.assertAlmostEqual(recall_score(y_test, preds), 0.9130, places=3)
        self.assertAlmostEqual(f1_score(y_test, preds), 0.9130, places=3)
        self.assertAlmostEqual(roc_auc_score(y_test, probs), 0.9620, places=3)
        self.assertAlmostEqual(average_precision_score(y_test, probs), 0.9766, places=3)
        self.assertAlmostEqual(brier_score_loss(y_test, probs), 0.0799, places=3)

    def test_12_test_set_anomaly_detection_exact_reproducibility(self):
        with open(os.path.join(DATA_DIR, "split_metadata.json")) as f:
            split_meta = json.load(f)
        trajectories_df = pd.read_csv(os.path.join(DATA_DIR, "consolidated_trajectories.csv"))
        test_pids = set(split_meta["test_projects"])
        test_traj = trajectories_df[trajectories_df["project_id"].isin(test_pids)].copy()

        # Total test trajectory records: 8,463 TN + 23 FP + 42 TP + 0 FN = 8,528
        self.assertEqual(len(test_traj), 8528)

        iso_pkg = joblib.load(os.path.join(ANOMALY_DIR, "isolation_forest.joblib"))
        with open(os.path.join(ANOMALY_DIR, "anomaly_config.json")) as f:
            anomaly_cfg = json.load(f)

        iso_forest = iso_pkg["iso_forest"]
        scaler = iso_pkg["scaler"]
        anomaly_features = iso_pkg["features"]

        test_traj["productivity_ratio"] = test_traj["daily_delta_pct"] / np.maximum(1, test_traj["workers_present"])
        test_traj["shortfall_workers"] = np.maximum(0, test_traj["workers_required"] - test_traj["workers_present"])
        test_traj["has_active_hold"] = test_traj["reason"].isin(["Material Delay", "Client Hold", "Waiting on Another Trade"]).astype(float)
        test_traj["unexplained_zero_progress"] = ((test_traj["has_active_hold"] == 0) & (test_traj["workers_present"] >= 4) & (test_traj["daily_delta_pct"] <= 0.05)).astype(float)

        X_test_scaled = scaler.transform(test_traj[anomaly_features])
        raw_decisions = iso_forest.decision_function(X_test_scaled)
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

        anom_thresh = anomaly_cfg["optimal_threshold"]
        y_test = test_traj["is_anomaly"].values
        preds = (np.array(hybrid_scores) >= anom_thresh).astype(int)

        from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score
        cm = confusion_matrix(y_test, preds)
        tn, fp, fn, tp = cm.ravel()

        self.assertEqual((tn, fp, fn, tp), (8463, 23, 0, 42))
        self.assertAlmostEqual(recall_score(y_test, preds), 1.0000, places=3)
        self.assertAlmostEqual(precision_score(y_test, preds), 0.6462, places=3)
        self.assertAlmostEqual(f1_score(y_test, preds), 0.7850, places=3)


if __name__ == "__main__":
    unittest.main()
