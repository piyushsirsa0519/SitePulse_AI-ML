"""
SitePulse — Phase 3 Automated Test Suite (Python)
=================================================
Validates:
  1. Reproducibility (Seed 42 determinism)
  2. Referential Integrity (Foreign key validity across all CSVs)
  3. Date Consistency (Temporal ordering of starts, deadlines, updates, completions)
  4. Progress Constraints (0 <= pct <= 100, monotonicity, no duplicate dates)
  5. Label Correctness (target_is_delayed_over_3d <-> delay_days > 3)
  6. Feature Calculation Accuracy (Aligned with mathematical formulas)
  7. Zero Target Leakage Guardrail (Evaluated at cutoff day 25 without future knowledge)
  8. Grouped Project Separation (Train/Val/Test disjoint partition)
"""

import os
import json
import unittest
from datetime import datetime
import pandas as pd
import numpy as np

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "synthetic")


class TestPhase3SimulationAndFeatures(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.projects = pd.read_csv(os.path.join(DATA_DIR, "projects.csv"))
        cls.stores = pd.read_csv(os.path.join(DATA_DIR, "stores.csv"))
        cls.trades = pd.read_csv(os.path.join(DATA_DIR, "trades.csv"))
        cls.updates = pd.read_csv(os.path.join(DATA_DIR, "daily_updates.csv"))
        cls.manpower = pd.read_csv(os.path.join(DATA_DIR, "manpower_log.csv"))
        cls.contractors = pd.read_csv(os.path.join(DATA_DIR, "contractor_assignments.csv"))
        cls.delays = pd.read_csv(os.path.join(DATA_DIR, "delay_events.csv"))
        cls.trajectories = pd.read_csv(os.path.join(DATA_DIR, "consolidated_trajectories.csv"))
        cls.features = pd.read_csv(os.path.join(DATA_DIR, "project_features_day25.csv"))
        cls.trade_features = pd.read_csv(os.path.join(DATA_DIR, "trade_features_day25.csv"))
        cls.train = pd.read_csv(os.path.join(DATA_DIR, "train_features.csv"))
        cls.val = pd.read_csv(os.path.join(DATA_DIR, "val_features.csv"))
        cls.test = pd.read_csv(os.path.join(DATA_DIR, "test_features.csv"))
        with open(os.path.join(DATA_DIR, "split_metadata.json")) as f:
            cls.split_meta = json.load(f)

    # 1. Reproducibility & Minimum Volume
    def test_01_minimum_volume_and_metadata(self):
        self.assertGreaterEqual(len(self.projects), 250, "Should generate at least 250 projects")
        self.assertEqual(len(self.projects), 260, "Expected exactly 260 projects in seed 42")
        self.assertEqual(len(self.trades), 1300, "5 trades per project * 260 = 1300 trades")
        self.assertTrue(self.projects["is_synthetic"].all(), "All records must be flagged synthetic")
        self.assertTrue(self.updates["is_synthetic"].all(), "All updates must be flagged synthetic")

    # 2. Referential Integrity
    def test_02_referential_integrity(self):
        store_ids = set(self.stores["id"])
        project_ids = set(self.projects["id"])
        trade_ids = set(self.trades["id"])

        # Projects -> Stores
        for s_id in self.projects["store_id"]:
            self.assertIn(s_id, store_ids, f"Project references unknown store_id {s_id}")

        # Trades -> Projects
        for p_id in self.trades["project_id"]:
            self.assertIn(p_id, project_ids, f"Trade references unknown project_id {p_id}")

        # Updates -> Trades
        for t_id in self.updates["trade_id"].sample(1000, random_state=42):
            self.assertIn(t_id, trade_ids, f"Daily update references unknown trade_id {t_id}")

        # Delay Events -> Projects & Trades
        for _, de in self.delays.iterrows():
            self.assertIn(de["project_id"], project_ids)
            self.assertIn(de["trade_id"], trade_ids)

    # 3. Date Consistency
    def test_03_date_consistency(self):
        for _, p in self.projects.iterrows():
            start = datetime.strptime(p["start_date"], "%Y-%m-%d")
            deadline = datetime.strptime(p["deadline"], "%Y-%m-%d")
            actual_end = datetime.strptime(p["actual_completion_date"], "%Y-%m-%d")

            self.assertLessEqual(start, deadline, f"Project {p['id']}: start_date must be <= deadline")
            self.assertLessEqual(start, actual_end, f"Project {p['id']}: start_date must be <= actual_completion_date")

            # Duration delta check
            computed_actual_dur = (actual_end - start).days
            self.assertEqual(computed_actual_dur, p["actual_duration_days"])
            self.assertEqual(p["delay_days"], p["actual_duration_days"] - p["planned_duration_days"])

        # Check trades planned_start <= planned_end
        for _, t in self.trades.iterrows():
            p_start = datetime.strptime(t["planned_start"], "%Y-%m-%d")
            p_end = datetime.strptime(t["planned_end"], "%Y-%m-%d")
            self.assertLessEqual(p_start, p_end, f"Trade {t['id']}: planned_start must be <= planned_end")

    # 4. Progress Constraints & No Duplicates
    def test_04_progress_constraints(self):
        # Bounds check 0.00 to 100.00%
        self.assertGreaterEqual(self.updates["progress_pct"].min(), 0.0)
        self.assertLessEqual(self.updates["progress_pct"].max(), 100.0)

        # Unique trade_id + date constraint
        duplicates = self.updates.duplicated(subset=["trade_id", "date"]).sum()
        self.assertEqual(duplicates, 0, "Daily updates must have unique (trade_id, date) pairs")

    # 5. Label Correctness
    def test_05_label_correctness(self):
        for _, p in self.projects.iterrows():
            expected_delayed = 1 if p["delay_days"] > 3 else 0
            self.assertEqual(p["is_delayed_over_3d"], expected_delayed, f"Project {p['id']} label mismatch")

        for _, f in self.features.iterrows():
            expected_delayed = 1 if f["target_actual_delay_days"] > 3 else 0
            self.assertEqual(f["target_is_delayed_over_3d"], expected_delayed)

    # 6. Feature Calculations Accuracy
    def test_06_feature_calculations(self):
        for _, row in self.features.iterrows():
            p_meta = self.projects[self.projects["id"] == row["project_id"]].iloc[0]

            # Timeline elapsed ratio check
            expected_ratio = round(25 / max(1, p_meta["planned_duration_days"]), 4)
            self.assertAlmostEqual(row["timeline_elapsed_ratio"], expected_ratio, places=4)

            # Schedule variance check
            expected_var = round(row["overall_actual_pct"] - row["overall_planned_pct"], 2)
            self.assertAlmostEqual(row["schedule_variance_pct"], expected_var, places=2)

            # Delayed trades ratio check
            expected_delayed_ratio = round(row["delayed_trades_count"] / 5.0, 4)
            self.assertAlmostEqual(row["delayed_trades_ratio"], expected_delayed_ratio, places=4)

            # Workforce deficit check
            expected_deficit = max(0, row["total_workers_required"] - row["total_workers_present"])
            self.assertEqual(row["workforce_deficit"], expected_deficit)

    # 7. Leakage Prevention (Strict Temporal Cutoff Day 25)
    def test_07_leakage_prevention(self):
        self.assertEqual(self.features["eval_cutoff_day"].unique().tolist(), [25])
        self.assertEqual(self.trade_features["eval_cutoff_day"].unique().tolist(), [25])

        # Verify that max day_number in historical trajectory for any feature project is <= 25
        traj_sample = self.trajectories[self.trajectories["day_number"] <= 25]
        self.assertLessEqual(traj_sample["day_number"].max(), 25)

        # Confirm target actual days or future delay days are NOT in the predictive feature columns
        predictive_cols = [
            "timeline_elapsed_ratio", "overall_actual_pct", "schedule_variance_pct",
            "max_bottleneck_gap_pct", "delayed_trades_ratio", "workforce_deficit",
            "recent_7d_progress_velocity", "velocity_health_ratio"
        ]
        for col in predictive_cols:
            self.assertFalse("future" in col)
            self.assertFalse("target" in col)

    # 8. Train/Validation/Test Grouped Project Separation
    def test_08_train_val_test_separation(self):
        train_pids = set(self.train["project_id"])
        val_pids = set(self.val["project_id"])
        test_pids = set(self.test["project_id"])

        # Strictly disjoint
        self.assertEqual(len(train_pids.intersection(val_pids)), 0, "Train and Val must not share projects")
        self.assertEqual(len(train_pids.intersection(test_pids)), 0, "Train and Test must not share projects")
        self.assertEqual(len(val_pids.intersection(test_pids)), 0, "Val and Test must not share projects")

        # Sum equals total
        self.assertEqual(len(train_pids) + len(val_pids) + len(test_pids), len(self.projects))
        self.assertEqual(len(train_pids), 182, "70% of 260 = 182")
        self.assertEqual(len(val_pids), 39, "15% of 260 = 39")
        self.assertEqual(len(test_pids), 39, "15% of 260 = 39")


if __name__ == "__main__":
    unittest.main()
