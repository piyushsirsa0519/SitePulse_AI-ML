"""
SitePulse — Construction Project Simulation Engine
===================================================
A reproducible, physics-based discrete-event simulation engine for retail
and commercial interior fitout projects.

Models multi-trade execution, non-linear trade dependencies, daily manpower
attendance, material bottlenecks, approval freezes, and realistic site anomalies.

Generates relational CSV datasets ready for database ingestion and ML feature pipelines.
All generated records are strictly flagged with `is_synthetic = True`.
"""

import os
import json
import math
import random
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Any

import numpy as np
import pandas as pd


# -----------------------------------------------------------------------------
# 1. DOMAIN CONSTANTS & TAXONOMY
# -----------------------------------------------------------------------------

FITOUT_TRADES = [
    {
        "name": "Civil",
        "seq": 1,
        "weight": 0.25,
        "default_workers": 12,
        "worker_min": 6,
        "worker_max": 18,
        "base_productivity": 0.42,  # % progress per worker-day (~5.0% / day on full crew)
        "preceding_trade": None,
        "prereq_milestone": 0.0,
    },
    {
        "name": "Electrical",
        "seq": 2,
        "weight": 0.25,
        "default_workers": 8,
        "worker_min": 4,
        "worker_max": 14,
        "base_productivity": 0.56,  # % progress per worker-day (~4.5% / day on full crew)
        "preceding_trade": "Civil",
        "prereq_milestone": 25.0,  # Civil must reach 25% before Electrical rough-in starts
    },
    {
        "name": "Lighting",
        "seq": 3,
        "weight": 0.15,
        "default_workers": 6,
        "worker_min": 3,
        "worker_max": 10,
        "base_productivity": 1.04,  # % progress per worker-day (~6.2% / day on full crew)
        "preceding_trade": "Electrical",
        "prereq_milestone": 45.0,  # Electrical must reach 45% before Lighting wiring starts
    },
    {
        "name": "Carpentry",
        "seq": 4,
        "weight": 0.20,
        "default_workers": 10,
        "worker_min": 5,
        "worker_max": 16,
        "base_productivity": 0.45,  # % progress per worker-day (~4.5% / day on full crew)
        "preceding_trade": "Civil",
        "prereq_milestone": 40.0,  # Civil must reach 40% before Carpentry framing
    },
    {
        "name": "Painting",
        "seq": 5,
        "weight": 0.15,
        "default_workers": 5,
        "worker_min": 2,
        "worker_max": 8,
        "base_productivity": 1.25,  # % progress per worker-day (~6.25% / day on full crew)
        "preceding_trade": "Carpentry",
        "prereq_milestone": 60.0,  # Carpentry must reach 60% before Painting primer/finishes
    },
]

CITIES = ["Gurugram", "Delhi", "Hyderabad", "Mumbai", "Bengaluru", "Pune", "Noida", "Chennai"]
FORMATS = ["High Street", "Mall", "Food Court", "Standalone Flagship"]
BRANDS = [
    "Biryani Blues", "Cafe Chai Point", "P.TAL Homeware", "Blue Tokai Coffee",
    "Third Wave Coffee", "FabIndia Home", "Chumbak Lifestyle", "Subway Fresh",
    "Burger Singh", "Barista Coffee", "Nicobar Living", "Chaayos Express"
]

SCENARIO_TYPES = [
    "on_schedule",               # 1. Smooth execution, on or ahead of deadline
    "manpower_delay",            # 2. Chronic or severe labor deficit
    "material_delay",            # 3. Supply chain stockout holding trade
    "approval_bottleneck",       # 4. Mall / client design freeze
    "concurrent_delays",         # 5. Compound failures (material + labor + cascading holds)
    "recovery_intervention",     # 6. Slips mid-project, recovers via workforce surge
    "misleading_reporting",      # 7. Optimism bias, phantom progress, followed by correction
    "workforce_fluctuations",    # 8. Erratic absenteeism / festival fluctuations
]

CONTRACTOR_POOL = [
    {"id": "cnt-apex-civil",      "name": "Apex Civil Works LLP",         "trade": "Civil",      "base_rating": 4.5},
    {"id": "cnt-bharat-infra",   "name": "Bharat Fitout Structures",     "trade": "Civil",      "base_rating": 3.8},
    {"id": "cnt-volt-electrical", "name": "VoltCraft Electricals Ltd",    "trade": "Electrical", "base_rating": 4.0},
    {"id": "cnt-spark-systems",   "name": "Sparkline Power & Energy",     "trade": "Electrical", "base_rating": 3.5},
    {"id": "cnt-lumina-lighting", "name": "Lumina Retail Lighting Ltd",   "trade": "Lighting",   "base_rating": 4.4},
    {"id": "cnt-radiant-lux",     "name": "Radiant Lux Architectural",    "trade": "Lighting",   "base_rating": 3.9},
    {"id": "cnt-artisan-wood",    "name": "Artisan Wood & Fitouts",       "trade": "Carpentry",  "base_rating": 4.7},
    {"id": "cnt-heritage-craft",  "name": "Heritage Millwork LLP",        "trade": "Carpentry",  "base_rating": 3.6},
    {"id": "cnt-prism-coatings",  "name": "Prism Coatings & Finishes",    "trade": "Painting",   "base_rating": 4.2},
    {"id": "cnt-metro-colors",    "name": "Metro Finishes & Paintworks",  "trade": "Painting",   "base_rating": 3.7},
]


# -----------------------------------------------------------------------------
# 2. CORE SIMULATION ENGINE CLASS
# -----------------------------------------------------------------------------

class FitoutSimulationEngine:
    """
    Simulates retail store interior fitout projects with realistic dependencies,
    daily workforce fluctuations, roadblock events, and empirical progression.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)

    def generate_projects(self, n_projects: int = 260) -> Dict[str, Any]:
        """
        Generates simulated project trajectories spanning diverse scenarios,
        ensuring referential integrity and realistic project behavior.
        """
        print(f"[INFO] Initializing Simulation of {n_projects} Retail Fitout Projects (Seed={self.seed})...")

        stores = []
        projects = []
        trades = []
        daily_updates = []
        manpower_logs = []
        contractor_assignments = []
        delay_events = []
        trajectories = []

        base_start_calendar = datetime(2025, 1, 15)

        for p_idx in range(1, n_projects + 1):
            scenario = SCENARIO_TYPES[(p_idx - 1) % len(SCENARIO_TYPES)]
            brand = self.rng.choice(BRANDS)
            city = self.rng.choice(CITIES)
            store_format = self.rng.choice(FORMATS)

            store_id = f"str-syn-{p_idx:04d}"
            project_id = f"prj-syn-{p_idx:04d}"
            store_code = f"STR-{brand[:3].upper()}-{city[:3].upper()}-{p_idx:03d}"
            store_name = f"{brand} — {city} Store #{p_idx:03d}"
            sq_ft = round(self.rng.uniform(1200, 4500), 2)

            stores.append({
                "id": store_id,
                "organization_id": "org-apex-retail",
                "store_code": store_code,
                "name": store_name,
                "brand": brand,
                "city": city,
                "location_address": f"Unit {100 + p_idx}, Sector {10 + (p_idx % 40)}, {city}",
                "format": store_format,
                "square_footage": sq_ft,
                "status": "completed",
                "is_synthetic": True
            })

            # Staggered project starts over 18 months
            start_offset_days = (p_idx * 2) + self.rng.randint(-3, 3)
            p_start_date = base_start_calendar + timedelta(days=start_offset_days)
            planned_duration_days = self.rng.randint(44, 52)

            # Assign contractors
            project_contractor_map = {}
            for t_def in FITOUT_TRADES:
                t_name = t_def["name"]
                matching = [c for c in CONTRACTOR_POOL if c["trade"] == t_name]
                assigned_cnt = self.rng.choice(matching)
                project_contractor_map[t_name] = assigned_cnt

                ca_id = f"ca-syn-{p_idx:04d}-{t_name[:3].lower()}"
                trade_id = f"trd-syn-{p_idx:04d}-{t_name[:3].lower()}"
                contract_val = round(self.rng.uniform(150000, 600000), 2)

                contractor_assignments.append({
                    "id": ca_id,
                    "project_id": project_id,
                    "trade_id": trade_id,
                    "contractor_id": assigned_cnt["id"],
                    "assigned_date": p_start_date.strftime("%Y-%m-%d"),
                    "contract_value": contract_val,
                    "status": "completed",
                    "is_synthetic": True
                })

            # Simulate Daily Execution Trajectory for all trades
            proj_data = self._simulate_project_trajectory(
                project_id=project_id,
                store_id=store_id,
                scenario=scenario,
                start_date=p_start_date,
                planned_duration=planned_duration_days,
                project_contractor_map=project_contractor_map
            )

            projects.append(proj_data["project"])
            trades.extend(proj_data["trades"])
            daily_updates.extend(proj_data["daily_updates"])
            manpower_logs.extend(proj_data["manpower_logs"])
            delay_events.extend(proj_data["delay_events"])
            trajectories.extend(proj_data["trajectories"])

        print(f"[OK] Simulation Generated: {len(projects)} Projects, {len(trades)} Trades, {len(daily_updates)} Daily Logs, {len(delay_events)} Delay Incidents.")

        return {
            "stores": stores,
            "projects": projects,
            "trades": trades,
            "daily_updates": daily_updates,
            "manpower_log": manpower_logs,
            "contractor_assignments": contractor_assignments,
            "delay_events": delay_events,
            "trajectories": trajectories
        }

    def _simulate_project_trajectory(
        self,
        project_id: str,
        store_id: str,
        scenario: str,
        start_date: datetime,
        planned_duration: int,
        project_contractor_map: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Simulates daily multi-trade progress step-by-step from day 1 until all trades hit 100%.
        """
        planned_deadline = start_date + timedelta(days=planned_duration)

        # Initialize Trade States
        trade_states = {}
        for t_def in FITOUT_TRADES:
            t_name = t_def["name"]
            t_id = f"trd-syn-{project_id.split('-')[-1]}-{t_name[:3].lower()}"
            trade_states[t_name] = {
                "id": t_id,
                "name": t_name,
                "seq": t_def["seq"],
                "def": t_def,
                "contractor": project_contractor_map[t_name],
                "actual_pct": 0.0,
                "planned_pct": 0.0,
                "workers_required": t_def["default_workers"],
                "is_completed": False,
                "completed_day": None,
                "active_hold": None,       # Hold reason if blocked
                "hold_remaining_days": 0,
                "rework_pending": 0.0,
                "consecutive_stagnant": 0,
            }

        # Scenario modifiers
        scenario_params = self._get_scenario_parameters(scenario, planned_duration)

        current_day = 0
        max_simulation_days = planned_duration + 50  # Safety ceiling
        daily_updates = []
        manpower_logs = []
        delay_events = []
        trajectories = []

        all_trades_finished = False
        active_roadblocks = []

        while not all_trades_finished and current_day < max_simulation_days:
            current_day += 1
            current_date = start_date + timedelta(days=current_day)
            is_weekend = (current_date.weekday() >= 6)  # Sunday light shift

            # 1. Check for Roadblock / Scenario Event Trigger
            self._trigger_scenario_events(
                scenario, scenario_params, current_day, trade_states,
                active_roadblocks, delay_events, project_id, current_date
            )

            # 2. Advance Each Trade
            trades_done_count = 0

            for t_def in FITOUT_TRADES:
                t_name = t_def["name"]
                state = trade_states[t_name]

                # Compute Planned Target Curve (S-curve distribution across planned timeline)
                norm_time = min(1.0, current_day / max(1, planned_duration))
                seq_delay = (t_def["seq"] - 1) * 0.12
                adjusted_norm = max(0.0, min(1.0, (norm_time - seq_delay) / (1.0 - seq_delay + 0.001)))
                t_planned_pct = min(100.0, round(100.0 / (1.0 + math.exp(-9.0 * (adjusted_norm - 0.48))), 2))
                state["planned_pct"] = t_planned_pct

                if state["is_completed"]:
                    trades_done_count += 1
                    continue

                # Check Trade Precedence Dependency
                prereq_name = t_def["preceding_trade"]
                prereq_threshold = t_def["prereq_milestone"]
                is_dependency_blocked = False

                if prereq_name:
                    prereq_actual = trade_states[prereq_name]["actual_pct"]
                    if prereq_actual < prereq_threshold:
                        is_dependency_blocked = True

                # Handle active delay holds
                if state["hold_remaining_days"] > 0:
                    state["hold_remaining_days"] -= 1
                    if state["hold_remaining_days"] == 0:
                        state["active_hold"] = None

                # Determine Workforce Present
                req_workers = state["workers_required"]
                actual_workers = self._calculate_daily_workers(
                    req_workers, scenario, scenario_params, current_day, is_weekend, state
                )

                # Determine Daily Progress Delta
                daily_delta = 0.0
                status_reason = "On Track"
                notes = None
                anomaly_type = None

                # Compute baseline productivity components
                productivity_factor = t_def["base_productivity"]
                contractor_factor = state["contractor"]["base_rating"] / 4.0
                noise = self.rng.uniform(0.90, 1.10)
                norm_delta = max(0.0, round(actual_workers * productivity_factor * contractor_factor * noise, 2))

                # Check for controlled anomaly injection in misleading_reporting scenario
                anomaly_delta, anomaly_workers, anomaly_type = self._check_anomaly_injection(
                    scenario, current_day, t_name, actual_workers, req_workers, norm_delta
                )

                if anomaly_type:
                    actual_workers = anomaly_workers
                    daily_delta = anomaly_delta
                    status_reason = "On Track"
                    notes = f"Reported daily progress ({anomaly_type})."
                elif is_dependency_blocked:
                    status_reason = "Waiting on Another Trade"
                    notes = f"Waiting for {prereq_name} to reach {prereq_threshold}%."
                    daily_delta = 0.0
                elif state["active_hold"]:
                    status_reason = state["active_hold"]
                    notes = f"Trade hold active: {status_reason}."
                    daily_delta = 0.0
                elif actual_workers == 0:
                    status_reason = "Labour Shortage"
                    notes = "Zero crew reported on site today."
                    daily_delta = 0.0
                else:
                    daily_delta = norm_delta

                    if state["rework_pending"] > 0:
                        status_reason = "Quality Rework"
                        notes = "Rectifying non-compliant work from previous inspection."
                        state["rework_pending"] -= daily_delta
                    elif actual_workers < req_workers:
                        status_reason = "Labour Shortage"
                    else:
                        status_reason = "On Track"

                # Update cumulative progress
                old_prog = state["actual_pct"]
                new_prog = min(100.0, round(old_prog + daily_delta, 2))
                state["actual_pct"] = new_prog

                if daily_delta <= 0.05 and new_prog < 100.0:
                    state["consecutive_stagnant"] += 1
                else:
                    state["consecutive_stagnant"] = 0

                if new_prog >= 100.0 and not state["is_completed"]:
                    state["is_completed"] = True
                    state["completed_day"] = current_day
                    trades_done_count += 1

                # Record Daily Update Row
                update_id = f"upd-syn-{state['id']}-{current_date.strftime('%Y%m%d')}"
                daily_updates.append({
                    "id": update_id,
                    "trade_id": state["id"],
                    "date": current_date.strftime("%Y-%m-%d"),
                    "progress_pct": new_prog,
                    "workers_present": actual_workers,
                    "workers_required": req_workers,
                    "reason": status_reason,
                    "notes": notes,
                    "created_by": "usr-engineer-01",
                    "is_synthetic": True,
                    "anomaly_type": anomaly_type
                })

                # Record Manpower Log Row
                mpl_id = f"mpl-syn-{state['id']}-{current_date.strftime('%Y%m%d')}"
                manpower_logs.append({
                    "id": mpl_id,
                    "trade_id": state["id"],
                    "contractor_id": state["contractor"]["id"],
                    "date": current_date.strftime("%Y-%m-%d"),
                    "shift": "day",
                    "workers_present": actual_workers,
                    "workers_required": req_workers,
                    "supervisor_name": state["contractor"]["name"].split()[0] + " Supervisor",
                    "overtime_hours": 2.0 if (actual_workers > req_workers and scenario == "recovery_intervention") else 0.0,
                    "notes": notes,
                    "logged_by": "usr-engineer-01",
                    "is_synthetic": True
                })

                # Consolidated trajectory record for ML analysis
                trajectories.append({
                    "project_id": project_id,
                    "trade_id": state["id"],
                    "trade_name": t_name,
                    "scenario": scenario,
                    "day_number": current_day,
                    "date": current_date.strftime("%Y-%m-%d"),
                    "planned_pct": t_planned_pct,
                    "actual_pct": new_prog,
                    "daily_delta_pct": round(new_prog - old_prog, 2),
                    "variance_pct": round(new_prog - t_planned_pct, 2),
                    "workers_present": actual_workers,
                    "workers_required": req_workers,
                    "shortfall_workers": max(0, req_workers - actual_workers),
                    "is_blocked": is_dependency_blocked,
                    "reason": status_reason,
                    "consecutive_stagnant": state["consecutive_stagnant"],
                    "is_anomaly": 1 if anomaly_type else 0,
                    "anomaly_type": anomaly_type or "none",
                    "is_synthetic": True
                })

            if trades_done_count == len(FITOUT_TRADES):
                all_trades_finished = True

        actual_duration = current_day
        actual_completion_date = start_date + timedelta(days=actual_duration)
        delay_days = actual_duration - planned_duration

        # Final Project Record
        project_record = {
            "id": project_id,
            "organization_id": "org-apex-retail",
            "store_id": store_id,
            "name": f"Store Fitout #{project_id.split('-')[-1]}",
            "location": CITIES[(int(project_id.split('-')[-1]) - 1) % len(CITIES)],
            "start_date": start_date.strftime("%Y-%m-%d"),
            "deadline": planned_deadline.strftime("%Y-%m-%d"),
            "actual_completion_date": actual_completion_date.strftime("%Y-%m-%d"),
            "planned_duration_days": planned_duration,
            "actual_duration_days": actual_duration,
            "delay_days": delay_days,
            "scenario": scenario,
            "status": "completed",
            "is_delayed_over_3d": 1 if delay_days > 3 else 0,
            "is_synthetic": True
        }

        # Final Trade Records
        trade_records = []
        for t_def in FITOUT_TRADES:
            s = trade_states[t_def["name"]]
            planned_start_dt = start_date + timedelta(days=(s["seq"] - 1) * 5)
            planned_end_dt = planned_deadline - timedelta(days=(5 - s["seq"]) * 3)
            planned_end_day = (planned_end_dt - start_date).days
            actual_comp_day = s["completed_day"] or actual_duration
            actual_comp_dt = start_date + timedelta(days=actual_comp_day)
            trade_delay_days = actual_comp_day - planned_end_day

            trade_records.append({
                "id": s["id"],
                "project_id": project_id,
                "name": s["name"],
                "planned_start": planned_start_dt.strftime("%Y-%m-%d"),
                "planned_end": planned_end_dt.strftime("%Y-%m-%d"),
                "actual_completion_date": actual_comp_dt.strftime("%Y-%m-%d"),
                "planned_pct": 100.0,
                "default_workers_required": s["workers_required"],
                "actual_completion_day": actual_comp_day,
                "delay_days": trade_delay_days,
                "is_delayed_over_3d": 1 if trade_delay_days > 3 else 0,
                "is_synthetic": True
            })

        return {
            "project": project_record,
            "trades": trade_records,
            "daily_updates": daily_updates,
            "manpower_logs": manpower_logs,
            "delay_events": delay_events,
            "trajectories": trajectories
        }

    # -------------------------------------------------------------------------
    # Scenario Mechanics & Event Handlers
    # -------------------------------------------------------------------------

    def _get_scenario_parameters(self, scenario: str, planned_duration: int) -> Dict[str, Any]:
        """Returns probabilistic triggers and thresholds per scenario."""
        if scenario == "on_schedule":
            return {"labor_availability": 0.98, "roadblock_prob": 0.05}
        elif scenario == "manpower_delay":
            return {"labor_availability": 0.58, "roadblock_prob": 0.15, "shortage_start": int(planned_duration * 0.20)}
        elif scenario == "material_delay":
            return {"labor_availability": 0.90, "material_hold_day": int(planned_duration * 0.35), "material_duration": self.rng.randint(8, 14)}
        elif scenario == "approval_bottleneck":
            return {"labor_availability": 0.95, "approval_freeze_day": int(planned_duration * 0.25), "freeze_duration": self.rng.randint(7, 12)}
        elif scenario == "concurrent_delays":
            return {"labor_availability": 0.65, "material_hold_day": int(planned_duration * 0.25), "rework_day": int(planned_duration * 0.45)}
        elif scenario == "recovery_intervention":
            return {"labor_availability": 0.65, "surge_day": int(planned_duration * 0.50), "surge_workers": 6}
        elif scenario == "misleading_reporting":
            return {"labor_availability": 0.80, "discovery_day": int(planned_duration * 0.60)}
        elif scenario == "workforce_fluctuations":
            return {"festival_start": int(planned_duration * 0.40), "festival_len": 8}
        return {"labor_availability": 0.90}

    def _calculate_daily_workers(
        self, req_workers: int, scenario: str, params: Dict[str, Any],
        day: int, is_weekend: bool, state: Dict[str, Any]
    ) -> int:
        """Computes daily present headcounts incorporating scenario dynamics."""
        base_rate = params.get("labor_availability", 0.90)

        # Recovery surge
        if scenario == "recovery_intervention" and day >= params.get("surge_day", 999):
            extra = params.get("surge_workers", 4)
            return req_workers + self.rng.randint(extra - 2, extra + 3)

        # Festival drop
        if scenario == "workforce_fluctuations":
            f_start = params.get("festival_start", 999)
            if f_start <= day <= f_start + params.get("festival_len", 0):
                return max(1, int(req_workers * 0.30))

        # Manpower delay chronic deficit
        if scenario == "manpower_delay" and day >= params.get("shortage_start", 0):
            return max(2, int(req_workers * self.rng.uniform(0.40, 0.70)))

        # Weekend reduction
        if is_weekend:
            return max(1, int(req_workers * 0.65))

        # Standard stochastic attendance
        if scenario == "on_schedule":
            variance = self.rng.choice([-1, 0, 0, 1])
            return max(req_workers - 1, min(req_workers + 2, req_workers + variance))
        variance = self.rng.choice([-2, -1, 0, 0, 0, 1])
        return max(0, min(req_workers + 4, int(req_workers * base_rate) + variance))

    def _trigger_scenario_events(
        self, scenario: str, params: Dict[str, Any], day: int,
        trade_states: Dict[str, Any], active_roadblocks: List[Any],
        delay_events: List[Dict[str, Any]], project_id: str, current_date: datetime
    ):
        """Injects discrete delay events based on scenario timeline."""
        # Material delay trigger
        if scenario in ["material_delay", "concurrent_delays"]:
            if day == params.get("material_hold_day", -1):
                elec_state = trade_states["Electrical"]
                hold_days = params.get("material_duration", 9)
                elec_state["active_hold"] = "Material Delay"
                elec_state["hold_remaining_days"] = hold_days

                delay_events.append({
                    "id": f"del-syn-{project_id.split('-')[-1]}-mat",
                    "project_id": project_id,
                    "trade_id": elec_state["id"],
                    "contractor_id": elec_state["contractor"]["id"],
                    "category": "Material Delay",
                    "severity": "high",
                    "identified_date": current_date.strftime("%Y-%m-%d"),
                    "resolved_date": (current_date + timedelta(days=hold_days)).strftime("%Y-%m-%d"),
                    "estimated_delay_days": hold_days,
                    "actual_delay_days": hold_days,
                    "status": "resolved",
                    "root_cause": "Distribution switchgear delivery held at customs/manufacturing plant",
                    "mitigation_action": "Dispatched emergency logistics expediter; sourced alternative breaker panels",
                    "is_synthetic": True
                })

        # Approval freeze trigger
        if scenario == "approval_bottleneck":
            if day == params.get("approval_freeze_day", -1):
                freeze_days = params.get("freeze_duration", 8)
                trade_states["Civil"]["active_hold"] = "Client Hold"
                trade_states["Civil"]["hold_remaining_days"] = freeze_days

                delay_events.append({
                    "id": f"del-syn-{project_id.split('-')[-1]}-appr",
                    "project_id": project_id,
                    "trade_id": trade_states["Civil"]["id"],
                    "contractor_id": trade_states["Civil"]["contractor"]["id"],
                    "category": "Client Hold",
                    "severity": "critical",
                    "identified_date": current_date.strftime("%Y-%m-%d"),
                    "resolved_date": (current_date + timedelta(days=freeze_days)).strftime("%Y-%m-%d"),
                    "estimated_delay_days": freeze_days,
                    "actual_delay_days": freeze_days,
                    "status": "resolved",
                    "root_cause": "Mall management suspended ceiling drilling; tenant layout redesign pending",
                    "mitigation_action": "Secured night-shift drilling variance permit; finalized updated partition drawings",
                    "is_synthetic": True
                })

        # Quality Rework in concurrent delays
        if scenario == "concurrent_delays":
            if day == params.get("rework_day", -1):
                carp_state = trade_states["Carpentry"]
                carp_state["rework_pending"] = 12.0  # 12% progress lost
                carp_state["actual_pct"] = max(0.0, carp_state["actual_pct"] - 12.0)

                delay_events.append({
                    "id": f"del-syn-{project_id.split('-')[-1]}-rewk",
                    "project_id": project_id,
                    "trade_id": carp_state["id"],
                    "contractor_id": carp_state["contractor"]["id"],
                    "category": "Quality Rework",
                    "severity": "medium",
                    "identified_date": current_date.strftime("%Y-%m-%d"),
                    "resolved_date": (current_date + timedelta(days=5)).strftime("%Y-%m-%d"),
                    "estimated_delay_days": 5,
                    "actual_delay_days": 4,
                    "status": "resolved",
                    "root_cause": "Laminate adhesive failed humidity inspection; peeling detected on display gondolas",
                    "mitigation_action": "Stripped defective laminate; reapplied water-resistant polymer adhesive",
                    "is_synthetic": True
                })

    def _check_anomaly_injection(
        self, scenario: str, day: int, trade_name: str,
        workers: int, req_workers: int, normal_delta: float
    ) -> Tuple[float, int, Any]:
        """
        Injects controlled, known synthetic anomaly patterns for ML anomaly detection.
        Returns: (daily_delta, actual_workers, anomaly_type)
        """
        if scenario != "misleading_reporting":
            return normal_delta, workers, None

        # Scenario 7: Injected Anomaly Patterns
        # Pattern A: Phantom Workforce (Full crew reported, but 0 progress made)
        if 18 <= day <= 22 and trade_name == "Carpentry":
            return 0.0, req_workers, "phantom_workforce"

        # Pattern B: Implausible Progress Spike (Progress leaps massively in 1 day on active work)
        if day == 12 and trade_name == "Civil":
            return round(normal_delta + 16.0, 2), workers, "implausible_progress_spike"

        # Pattern C: Unreported Workforce (Progress made with zero workers)
        if day == 24 and trade_name == "Painting":
            return 8.5, 0, "unreported_workforce"

        return normal_delta, workers, None


# -----------------------------------------------------------------------------
# 3. FEATURE EXTRACTION PIPELINES (ZERO-LEAKAGE GUARDRAIL)
# -----------------------------------------------------------------------------

def extract_project_features(
    trajectories_df: pd.DataFrame,
    projects_df: pd.DataFrame,
    delay_events_df: pd.DataFrame,
    eval_day: int = 25
) -> pd.DataFrame:
    """
    Extracts strictly leakage-free project-level features evaluated
    at prediction cutoff day `eval_day`.
    Uses ONLY information available up to `eval_day` (day_number <= eval_day).
    """
    print(f"[FEAT] Extracting Project ML Features at Cutoff Day = {eval_day} (Leakage-Free Guardrail)...")

    # Filter historical trajectory strictly up to eval_day
    hist_traj = trajectories_df[trajectories_df["day_number"] <= eval_day].copy()

    records = []

    for p_id, p_grp in hist_traj.groupby("project_id"):
        proj_meta = projects_df[projects_df["id"] == p_id].iloc[0]
        planned_duration = proj_meta["planned_duration_days"]
        actual_delay_days = proj_meta["delay_days"]

        # Target Labels (Derived from future outcome at project end)
        target_delayed_over_3d = 1 if actual_delay_days > 3 else 0
        target_delay_days = actual_delay_days

        # 1. Timeline features
        days_elapsed = min(planned_duration, eval_day)
        days_remaining = max(0, planned_duration - eval_day)
        timeline_elapsed_ratio = round(eval_day / max(1, planned_duration), 4)

        # 2. Latest trade snapshot at eval_day
        latest_trades = p_grp.sort_values("day_number").groupby("trade_name").last().reset_index()

        avg_planned_pct = round(latest_trades["planned_pct"].mean(), 2)
        avg_actual_pct = round(latest_trades["actual_pct"].mean(), 2)
        schedule_variance_pct = round(avg_actual_pct - avg_planned_pct, 2)

        # 3. Bottleneck and Lagging Trades
        latest_trades["trade_gap"] = latest_trades["planned_pct"] - latest_trades["actual_pct"]
        max_bottleneck_gap = round(max(0.0, latest_trades["trade_gap"].max()), 2)
        delayed_trades_count = (latest_trades["trade_gap"] > 0).sum()
        total_trades = len(latest_trades)
        delayed_trades_ratio = round(delayed_trades_count / max(1, total_trades), 4)

        # 4. Workforce Fulfillment
        total_present = latest_trades["workers_present"].sum()
        total_required = latest_trades["workers_required"].sum()
        workforce_deficit = max(0, total_required - total_present)
        workforce_fulfillment_ratio = round(total_present / max(1, total_required), 4)

        # 5. Trailing 7-day progress velocity (using only days [eval_day - 6, eval_day])
        recent_7d_traj = p_grp[(p_grp["day_number"] > (eval_day - 7)) & (p_grp["day_number"] <= eval_day)]
        if len(recent_7d_traj) > 0:
            recent_7d_velocity = round(recent_7d_traj["daily_delta_pct"].mean(), 3)
        else:
            recent_7d_velocity = 0.0

        required_daily_velocity = round((100.0 - avg_actual_pct) / max(1, days_remaining), 3) if days_remaining > 0 else 0.0
        velocity_health_ratio = round(recent_7d_velocity / max(0.001, required_daily_velocity), 3)

        # 6. Delay Events strictly identified prior to eval_day
        p_date_cutoff = (datetime.strptime(proj_meta["start_date"], "%Y-%m-%d") + timedelta(days=eval_day)).strftime("%Y-%m-%d")
        if not delay_events_df.empty:
            p_delays = delay_events_df[
                (delay_events_df["project_id"] == p_id) &
                (delay_events_df["identified_date"] <= p_date_cutoff)
            ]
            active_delays_count = len(p_delays)
            total_est_delay_days = p_delays["estimated_delay_days"].sum()
        else:
            active_delays_count = 0
            total_est_delay_days = 0

        # Anomaly label in historical window
        has_anomaly_occurred = 1 if (p_grp["is_anomaly"] == 1).any() else 0

        records.append({
            "project_id": p_id,
            "scenario": proj_meta["scenario"],
            "eval_cutoff_day": eval_day,
            # Features
            "timeline_elapsed_ratio": timeline_elapsed_ratio,
            "days_elapsed": days_elapsed,
            "days_remaining": days_remaining,
            "overall_planned_pct": avg_planned_pct,
            "overall_actual_pct": avg_actual_pct,
            "schedule_variance_pct": schedule_variance_pct,
            "max_bottleneck_gap_pct": max_bottleneck_gap,
            "delayed_trades_ratio": delayed_trades_ratio,
            "delayed_trades_count": delayed_trades_count,
            "total_workers_present": total_present,
            "total_workers_required": total_required,
            "workforce_deficit": workforce_deficit,
            "workforce_fulfillment_ratio": workforce_fulfillment_ratio,
            "recent_7d_progress_velocity": recent_7d_velocity,
            "required_daily_velocity": required_daily_velocity,
            "velocity_health_ratio": velocity_health_ratio,
            "active_delay_events_count": active_delays_count,
            "total_estimated_delay_days": total_est_delay_days,
            # Target Labels (Future Outcomes)
            "target_is_delayed_over_3d": target_delayed_over_3d,
            "target_actual_delay_days": target_delay_days,
            "target_has_anomaly": has_anomaly_occurred,
            "is_synthetic": True
        })

    features_df = pd.DataFrame(records)
    print(f"[OK] Extracted {len(features_df)} project feature vectors at cutoff day {eval_day}.")
    return features_df


def extract_trade_features(
    trajectories_df: pd.DataFrame,
    trades_df: pd.DataFrame,
    delay_events_df: pd.DataFrame,
    eval_day: int = 25
) -> pd.DataFrame:
    """
    Extracts strictly leakage-free trade-level features evaluated at prediction cutoff day `eval_day`.
    Computes:
      - Trade progress variance (actual - planned)
      - Rolling 7-day progress velocity
      - Manpower utilization ratio (workers_present / workers_required)
      - Consecutive stagnant progress days
      - Days until planned trade completion
      - Historical delay count (events logged up to eval_day)
      - Trade dependency status ('unblocked' vs 'blocked')
      - Target labels: target_trade_is_delayed_over_3d, target_trade_delay_days
    """
    print(f"[FEAT] Extracting Trade-Level ML Features at Cutoff Day = {eval_day}...")
    hist_traj = trajectories_df[trajectories_df["day_number"] <= eval_day].copy()
    records = []

    for (p_id, t_name), grp in hist_traj.groupby(["project_id", "trade_name"]):
        trade_meta_match = trades_df[(trades_df["project_id"] == p_id) & (trades_df["name"] == t_name)]
        if trade_meta_match.empty:
            continue
        trade_meta = trade_meta_match.iloc[0]

        grp_sorted = grp.sort_values("day_number")
        latest_row = grp_sorted.iloc[-1]

        trade_actual_pct = latest_row["actual_pct"]
        trade_planned_pct = latest_row["planned_pct"]
        trade_progress_variance = round(trade_actual_pct - trade_planned_pct, 2)

        # Rolling 7-day velocity for this trade
        recent_7d = grp_sorted[grp_sorted["day_number"] > (eval_day - 7)]
        if len(recent_7d) > 0:
            rolling_7d_velocity = round(recent_7d["daily_delta_pct"].mean(), 3)
        else:
            rolling_7d_velocity = 0.0

        workers_present = latest_row["workers_present"]
        workers_required = latest_row["workers_required"]
        manpower_utilization = round(workers_present / max(1, workers_required), 4)

        consecutive_stagnant = int(latest_row["consecutive_stagnant"])

        # Days until planned trade completion from cutoff date
        planned_end_dt = datetime.strptime(trade_meta["planned_end"], "%Y-%m-%d")
        cutoff_date_str = latest_row["date"]
        cutoff_dt = datetime.strptime(cutoff_date_str, "%Y-%m-%d")
        days_until_planned_completion = (planned_end_dt - cutoff_dt).days

        # Historical delay count up to cutoff date
        trade_id = latest_row["trade_id"]
        if not delay_events_df.empty:
            trade_delays = delay_events_df[
                (delay_events_df["trade_id"] == trade_id) &
                (delay_events_df["identified_date"] <= cutoff_date_str)
            ]
            hist_delay_count = len(trade_delays)
        else:
            hist_delay_count = 0

        dependency_status = "blocked" if latest_row["is_blocked"] else "unblocked"

        # Future Target Labels
        target_trade_is_delayed = int(trade_meta["is_delayed_over_3d"])
        target_trade_delay_days = int(trade_meta["delay_days"])

        records.append({
            "project_id": p_id,
            "trade_id": trade_id,
            "trade_name": t_name,
            "scenario": latest_row["scenario"],
            "eval_cutoff_day": eval_day,
            # Features
            "trade_actual_pct": trade_actual_pct,
            "trade_planned_pct": trade_planned_pct,
            "trade_progress_variance": trade_progress_variance,
            "trade_rolling_7d_velocity": rolling_7d_velocity,
            "workers_present": workers_present,
            "workers_required": workers_required,
            "trade_manpower_utilization": manpower_utilization,
            "consecutive_stagnant_days": consecutive_stagnant,
            "days_until_planned_completion": days_until_planned_completion,
            "historical_delay_count": hist_delay_count,
            "trade_dependency_status": dependency_status,
            # Target Labels (Future Outcomes)
            "target_trade_is_delayed_over_3d": target_trade_is_delayed,
            "target_trade_delay_days": target_trade_delay_days,
            "target_has_anomaly": int(latest_row["is_anomaly"]),
            "is_synthetic": True
        })

    trade_features_df = pd.DataFrame(records)
    print(f"[OK] Extracted {len(trade_features_df)} trade feature vectors at cutoff day {eval_day}.")
    return trade_features_df


# -----------------------------------------------------------------------------
# 4. EXECUTION RUNNER & EXPORTER
# -----------------------------------------------------------------------------

def run_simulation(n_projects: int = 260, seed: int = 42, output_dir: str = "data/synthetic") -> Dict[str, pd.DataFrame]:
    """
    Main orchestration routine. Runs simulation, exports relational tables,
    extracts ML features, and generates project-level grouped train/val/test splits.
    """
    os.makedirs(output_dir, exist_ok=True)
    engine = FitoutSimulationEngine(seed=seed)
    data = engine.generate_projects(n_projects=n_projects)

    dfs = {
        "projects": pd.DataFrame(data["projects"]),
        "stores": pd.DataFrame(data["stores"]),
        "trades": pd.DataFrame(data["trades"]),
        "daily_updates": pd.DataFrame(data["daily_updates"]),
        "manpower_log": pd.DataFrame(data["manpower_log"]),
        "contractor_assignments": pd.DataFrame(data["contractor_assignments"]),
        "delay_events": pd.DataFrame(data["delay_events"]),
        "consolidated_trajectories": pd.DataFrame(data["trajectories"])
    }

    # Save relational CSVs
    print(f"[EXPORT] Exporting Relational CSVs to {output_dir}...")
    for name, df in dfs.items():
        csv_path = os.path.join(output_dir, f"{name}.csv")
        df.to_csv(csv_path, index=False)
        print(f"  -> {name}.csv ({len(df):,} rows)")

    # Extract Project-Level ML Features (evaluated at prediction cutoff Day 25)
    project_features_df = extract_project_features(
        trajectories_df=dfs["consolidated_trajectories"],
        projects_df=dfs["projects"],
        delay_events_df=dfs["delay_events"],
        eval_day=25
    )
    proj_features_path = os.path.join(output_dir, "project_features_day25.csv")
    project_features_df.to_csv(proj_features_path, index=False)
    print(f"  -> project_features_day25.csv ({len(project_features_df)} rows)")

    # Extract Trade-Level ML Features (evaluated at prediction cutoff Day 25)
    trade_features_df = extract_trade_features(
        trajectories_df=dfs["consolidated_trajectories"],
        trades_df=dfs["trades"],
        delay_events_df=dfs["delay_events"],
        eval_day=25
    )
    trade_features_path = os.path.join(output_dir, "trade_features_day25.csv")
    trade_features_df.to_csv(trade_features_path, index=False)
    print(f"  -> trade_features_day25.csv ({len(trade_features_df)} rows)")

    # Project-Level Grouped Splitting (70% Train, 15% Val, 15% Test)
    # Strictly ensures NO rows from the same project cross splits
    project_ids = dfs["projects"]["id"].unique().tolist()
    rng = random.Random(seed)
    rng.shuffle(project_ids)

    n_total = len(project_ids)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)

    train_ids = set(project_ids[:n_train])
    val_ids = set(project_ids[n_train:n_train + n_val])
    test_ids = set(project_ids[n_train + n_val:])

    # Project feature splits
    train_df = project_features_df[project_features_df["project_id"].isin(train_ids)].copy()
    val_df = project_features_df[project_features_df["project_id"].isin(val_ids)].copy()
    test_df = project_features_df[project_features_df["project_id"].isin(test_ids)].copy()

    train_df.to_csv(os.path.join(output_dir, "train_features.csv"), index=False)
    val_df.to_csv(os.path.join(output_dir, "val_features.csv"), index=False)
    test_df.to_csv(os.path.join(output_dir, "test_features.csv"), index=False)

    # Trade feature splits
    train_trade_df = trade_features_df[trade_features_df["project_id"].isin(train_ids)].copy()
    val_trade_df = trade_features_df[trade_features_df["project_id"].isin(val_ids)].copy()
    test_trade_df = trade_features_df[trade_features_df["project_id"].isin(test_ids)].copy()

    train_trade_df.to_csv(os.path.join(output_dir, "train_trade_features.csv"), index=False)
    val_trade_df.to_csv(os.path.join(output_dir, "val_trade_features.csv"), index=False)
    test_trade_df.to_csv(os.path.join(output_dir, "test_trade_features.csv"), index=False)

    split_metadata = {
        "dataset_version": "1.0.0-synthetic",
        "random_seed": seed,
        "n_projects_total": n_total,
        "train_projects_count": len(train_ids),
        "val_projects_count": len(val_ids),
        "test_projects_count": len(test_ids),
        "eval_cutoff_day": 25,
        "train_projects": sorted(list(train_ids)),
        "val_projects": sorted(list(val_ids)),
        "test_projects": sorted(list(test_ids)),
        "generated_at": datetime.now().isoformat(),
        "is_synthetic": True
    }

    with open(os.path.join(output_dir, "split_metadata.json"), "w") as f:
        json.dump(split_metadata, f, indent=2)

    print(f"[SPLIT] Project Splits: Train={len(train_df)}, Val={len(val_df)}, Test={len(test_df)}")
    print(f"[SPLIT] Trade Splits: Train={len(train_trade_df)}, Val={len(val_trade_df)}, Test={len(test_trade_df)}")
    print(f"[DONE] Simulation Pipeline Completed Successfully!")

    return dfs


if __name__ == "__main__":
    run_simulation(n_projects=260, seed=42)
