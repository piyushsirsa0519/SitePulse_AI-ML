"""
SitePulse — Feature Validation & Statistical Exploratory Data Analysis
======================================================================
Performs comprehensive statistical validation and generates diagnostic
visualizations for synthetic fitout datasets.

Validates:
  1. Duration and delay distributions across the 8 scenarios.
  2. Workforce utilization vs. schedule delay correlation.
  3. Trade-level productivity and velocity distributions.
  4. Anomaly injection rates and scenario distributions.
  5. Leakage-free feature vector distributions.

Saves diagnostic visualization figures to `notebooks/figures/`.
"""

import os
import json
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend for headless environments
import matplotlib.pyplot as plt


def run_feature_validation(data_dir: str = "data/synthetic", figures_dir: str = "notebooks/figures") -> dict:
    print(f"[INFO] Running Feature Validation & Statistical EDA on {data_dir}...")
    os.makedirs(figures_dir, exist_ok=True)

    # 1. Load Datasets
    projects_df = pd.read_csv(os.path.join(data_dir, "projects.csv"))
    trades_df = pd.read_csv(os.path.join(data_dir, "trades.csv"))
    updates_df = pd.read_csv(os.path.join(data_dir, "daily_updates.csv"))
    delay_events_df = pd.read_csv(os.path.join(data_dir, "delay_events.csv"))
    trajectories_df = pd.read_csv(os.path.join(data_dir, "consolidated_trajectories.csv"))
    features_df = pd.read_csv(os.path.join(data_dir, "project_features_day25.csv"))

    metrics = {}

    # -------------------------------------------------------------------------
    # Analysis 1: Project Duration & Delay Distributions
    # -------------------------------------------------------------------------
    n_total = len(projects_df)
    n_delayed_over_3d = projects_df["is_delayed_over_3d"].sum()
    delay_rate = round(n_delayed_over_3d / n_total * 100, 2)
    avg_delay = round(projects_df["delay_days"].mean(), 2)
    max_delay = int(projects_df["delay_days"].max())
    min_delay = int(projects_df["delay_days"].min())

    metrics["n_projects"] = n_total
    metrics["delayed_rate_pct"] = delay_rate
    metrics["avg_delay_days"] = avg_delay
    metrics["max_delay_days"] = max_delay
    metrics["min_delay_days"] = min_delay

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    axes[0].hist(projects_df["actual_duration_days"], bins=20, color="#3b82f6", alpha=0.8, edgecolor="black", label="Actual Duration")
    axes[0].hist(projects_df["planned_duration_days"], bins=20, color="#10b981", alpha=0.5, edgecolor="black", label="Planned Duration")
    axes[0].set_title("Project Duration Distribution (Planned vs. Actual)", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Days")
    axes[0].set_ylabel("Number of Projects")
    axes[0].legend()
    axes[0].grid(True, linestyle="--", alpha=0.4)

    scenario_delays = projects_df.groupby("scenario")["delay_days"].mean().sort_values()
    axes[1].barh(scenario_delays.index, scenario_delays.values, color="#f59e0b", edgecolor="black")
    axes[1].set_title("Average Delay Days by Scenario Type", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Mean Delay Days")
    axes[1].axvline(0, color="gray", linestyle="--")
    axes[1].grid(True, linestyle="--", alpha=0.4)

    plt.tight_layout()
    chart1_path = os.path.join(figures_dir, "01_project_duration_and_delays.png")
    plt.savefig(chart1_path, dpi=200)
    plt.close()
    print(f"  -> Saved {chart1_path}")

    # -------------------------------------------------------------------------
    # Analysis 2: Manpower Shortfall vs. Delay Correlation
    # -------------------------------------------------------------------------
    # Aggregate cumulative workforce deficit per project
    proj_manpower = trajectories_df.groupby("project_id").agg(
        total_shortfall_hours=("shortfall_workers", "sum"),
        avg_fulfillment=("workers_present", lambda x: np.mean(x) / (np.mean(trajectories_df.loc[x.index, "workers_required"]) + 1e-4))
    ).reset_index()

    merged_corr = pd.merge(projects_df, proj_manpower, left_on="id", right_on="project_id")
    corr_val = round(merged_corr["total_shortfall_hours"].corr(merged_corr["delay_days"]), 3)
    metrics["shortfall_delay_correlation"] = corr_val

    plt.figure(figsize=(8, 5))
    plt.scatter(merged_corr["total_shortfall_hours"], merged_corr["delay_days"], c=merged_corr["is_delayed_over_3d"], cmap="coolwarm", alpha=0.7, edgecolors="k")
    plt.title(f"Cumulative Worker Shortfall vs. Final Delay Days (r = {corr_val})", fontsize=12, fontweight="bold")
    plt.xlabel("Total Cumulative Worker Shortfall (Worker-Days)")
    plt.ylabel("Actual Delay Days")
    plt.axhline(3, color="red", linestyle="--", label="Target Threshold (> 3 Days)")
    # Linear fit
    if len(merged_corr) > 1:
        m, b = np.polyfit(merged_corr["total_shortfall_hours"], merged_corr["delay_days"], 1)
        plt.plot(merged_corr["total_shortfall_hours"], m * merged_corr["total_shortfall_hours"] + b, color="black", linestyle="-", linewidth=2, label="Trendline")
    plt.legend()
    plt.grid(True, linestyle="--", alpha=0.4)
    plt.tight_layout()
    chart2_path = os.path.join(figures_dir, "02_manpower_shortfall_vs_delays.png")
    plt.savefig(chart2_path, dpi=200)
    plt.close()
    print(f"  -> Saved {chart2_path}")

    # -------------------------------------------------------------------------
    # Analysis 3: Trade Productivity & Velocity Distribution
    # -------------------------------------------------------------------------
    trade_summary = trajectories_df.groupby("trade_name")["daily_delta_pct"].describe()
    metrics["trade_productivity"] = trade_summary["mean"].round(2).to_dict()

    fig, ax = plt.subplots(figsize=(9, 5))
    trade_names = [t for t in trajectories_df["trade_name"].unique()]
    trade_deltas = [trajectories_df[(trajectories_df["trade_name"] == tn) & (trajectories_df["daily_delta_pct"] > 0)]["daily_delta_pct"] for tn in trade_names]
    ax.boxplot(trade_deltas, tick_labels=trade_names, patch_artist=True, boxprops=dict(facecolor="#c7d2fe"))
    ax.set_title("Active Daily Progress Velocity by Trade Discipline (%/Day)", fontsize=12, fontweight="bold")
    ax.set_ylabel("Daily Progress Delta (%)")
    ax.grid(True, linestyle="--", alpha=0.4)
    plt.tight_layout()
    chart3_path = os.path.join(figures_dir, "03_trade_productivity_and_velocity.png")
    plt.savefig(chart3_path, dpi=200)
    plt.close()
    print(f"  -> Saved {chart3_path}")

    # -------------------------------------------------------------------------
    # Analysis 4: Anomaly Detection Distribution
    # -------------------------------------------------------------------------
    anomaly_counts = trajectories_df["anomaly_type"].value_counts()
    metrics["anomaly_counts"] = anomaly_counts.to_dict()

    plt.figure(figsize=(8, 4))
    non_none_anomalies = anomaly_counts[anomaly_counts.index != "none"]
    plt.bar(non_none_anomalies.index, non_none_anomalies.values, color=["#ef4444", "#f97316", "#8b5cf6"], edgecolor="black")
    plt.title("Distribution of Injected Synthetic Anomalies", fontsize=12, fontweight="bold")
    plt.xlabel("Anomaly Type")
    plt.ylabel("Occurrences Across Trajectories")
    for i, v in enumerate(non_none_anomalies.values):
        plt.text(i, v + 20, str(v), ha="center", fontweight="bold")
    plt.grid(True, linestyle="--", alpha=0.4)
    plt.tight_layout()
    chart4_path = os.path.join(figures_dir, "04_anomaly_scenario_distribution.png")
    plt.savefig(chart4_path, dpi=200)
    plt.close()
    print(f"  -> Saved {chart4_path}")

    # -------------------------------------------------------------------------
    # Analysis 5: Feature vs Target Correlation (Day 25 Feature Store)
    # -------------------------------------------------------------------------
    feature_cols = [
        "timeline_elapsed_ratio", "overall_actual_pct", "schedule_variance_pct",
        "max_bottleneck_gap_pct", "delayed_trades_ratio", "workforce_deficit",
        "workforce_fulfillment_ratio", "recent_7d_progress_velocity",
        "velocity_health_ratio", "active_delay_events_count"
    ]

    target_corr = features_df[feature_cols].apply(lambda s: s.corr(features_df["target_is_delayed_over_3d"])).sort_values()

    plt.figure(figsize=(10, 5))
    colors = ["#10b981" if x < 0 else "#ef4444" for x in target_corr.values]
    plt.barh(target_corr.index, target_corr.values, color=colors, edgecolor="black")
    plt.title("Feature Correlation with Delay Target (is_delayed_over_3d) at Cutoff Day 25", fontsize=12, fontweight="bold")
    plt.xlabel("Pearson Correlation Coefficient (r)")
    plt.axvline(0, color="gray", linestyle="--")
    plt.grid(True, linestyle="--", alpha=0.4)
    plt.tight_layout()
    chart5_path = os.path.join(figures_dir, "05_feature_target_correlation.png")
    plt.savefig(chart5_path, dpi=200)
    plt.close()
    print(f"  -> Saved {chart5_path}")

    print("\n=======================================================")
    print("STATISTICAL VALIDATION SUMMARY:")
    print(f"  Total Projects Simulated: {n_total}")
    print(f"  Overall Delay Rate (> 3 days): {delay_rate}%")
    print(f"  Average Project Delay: {avg_delay} days (Range: {min_delay} to {max_delay} days)")
    print(f"  Correlation (Worker Shortfall vs Delay): r = {corr_val}")
    print(f"  Top Delay Predictors (Day 25):")
    for feat, r in target_corr.tail(3).items():
        print(f"    - {feat}: r = {round(r, 3)}")
    for feat, r in target_corr.head(2).items():
        print(f"    - {feat}: r = {round(r, 3)} (Protective)")
    print("=======================================================")

    return metrics


if __name__ == "__main__":
    run_feature_validation()
