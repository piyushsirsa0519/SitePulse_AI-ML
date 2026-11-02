-- ============================================================================
-- Site Pulse — Analytical View G: vw_ml_project_features
-- Engineered feature store view for downstream ML risk classification
-- and completion forecasting models.
-- Features extracted:
--   1. Timeline: days_elapsed, days_remaining, total_project_days, timeline_elapsed_ratio
--   2. Progress: planned_progress_pct, actual_progress_pct, schedule_variance_pct
--   3. Trade Bottlenecks: max_bottleneck_gap_pct, delayed_trades_ratio
--   4. Workforce: workers_present, workers_required, workforce_deficit, workforce_fulfillment_ratio
--   5. Incident Delays: active_delay_events_count, critical_delay_events_count, total_estimated_delay_days
--   6. Velocity: recent_7d_progress_velocity, required_daily_velocity, velocity_health_ratio
-- All calculations strictly prevent division by zero using NULLIF() and handle NULLs.
-- Pre-flight fix: Calculates daily progress deltas over full history before date filtering
-- to prevent LAG() boundary truncation artifacts.
-- ============================================================================

CREATE OR REPLACE VIEW vw_ml_project_features AS
WITH latest_trade_states AS (
    SELECT DISTINCT ON (du.trade_id)
        du.trade_id,
        t.project_id,
        t.name AS trade_name,
        t.planned_pct,
        du.date AS update_date,
        du.progress_pct AS actual_pct,
        du.workers_present,
        du.workers_required,
        GREATEST(0.00, t.planned_pct - du.progress_pct) AS trade_gap,
        CASE WHEN du.progress_pct < t.planned_pct THEN 1 ELSE 0 END AS is_lagging
    FROM daily_updates du
    JOIN trades t ON du.trade_id = t.id
    ORDER BY du.trade_id, du.date DESC
),
all_trade_deltas AS (
    -- Compute daily deltas across entire update timeline to prevent window boundary truncation
    SELECT 
        du.trade_id,
        t.project_id,
        du.date,
        COALESCE(
            du.progress_pct - LAG(du.progress_pct, 1) OVER (
                PARTITION BY du.trade_id ORDER BY du.date ASC
            ),
            du.progress_pct
        ) AS daily_delta
    FROM daily_updates du
    JOIN trades t ON du.trade_id = t.id
),
recent_project_velocity AS (
    -- Filter to trailing 7 calendar days after accurate delta calculation
    SELECT 
        project_id,
        ROUND(AVG(GREATEST(0.00, daily_delta)), 3) AS avg_project_7d_velocity
    FROM all_trade_deltas
    WHERE date >= (CURRENT_DATE - INTERVAL '7 days')
    GROUP BY project_id
),
delay_events_summary AS (
    SELECT 
        de.project_id,
        COUNT(de.id) AS active_delay_events_count,
        COUNT(CASE WHEN de.severity IN ('high', 'critical') THEN 1 END) AS critical_delay_events_count,
        COALESCE(SUM(de.estimated_delay_days), 0) AS total_estimated_delay_days
    FROM delay_events de
    WHERE de.status IN ('open', 'mitigating', 'escalated')
    GROUP BY de.project_id
)
SELECT 
    p.id AS project_id,
    p.organization_id,
    p.store_id,
    p.status AS project_status,
    
    -- 1. Timeline Features
    GREATEST(1, (p.deadline - p.start_date)) AS total_project_days,
    GREATEST(0, (CURRENT_DATE - p.start_date)) AS days_elapsed,
    GREATEST(0, (p.deadline - CURRENT_DATE)) AS days_remaining,
    ROUND(
        (GREATEST(0, (CURRENT_DATE - p.start_date))::numeric / 
        NULLIF(GREATEST(1, (p.deadline - p.start_date)), 0)), 
        4
    ) AS timeline_elapsed_ratio,

    -- 2. Progress & Variance Features
    ROUND(AVG(lts.planned_pct), 2) AS planned_progress_pct,
    ROUND(AVG(COALESCE(lts.actual_pct, 0.00)), 2) AS actual_progress_pct,
    ROUND(AVG(COALESCE(lts.actual_pct, 0.00)) - AVG(lts.planned_pct), 2) AS schedule_variance_pct,

    -- 3. Trade Bottleneck Diagnostics
    COUNT(lts.trade_id) AS total_trades_count,
    SUM(lts.is_lagging) AS delayed_trades_count,
    ROUND(
        (SUM(lts.is_lagging)::numeric / NULLIF(COUNT(lts.trade_id), 0)), 
        4
    ) AS delayed_trades_ratio,
    COALESCE(MAX(lts.trade_gap), 0.00) AS max_bottleneck_gap_pct,

    -- 4. Workforce Fulfillment Features
    SUM(COALESCE(lts.workers_present, 0)) AS total_workers_present,
    SUM(COALESCE(lts.workers_required, 0)) AS total_workers_required,
    GREATEST(0, SUM(COALESCE(lts.workers_required, 0)) - SUM(COALESCE(lts.workers_present, 0))) AS workforce_deficit,
    ROUND(
        (SUM(COALESCE(lts.workers_present, 0))::numeric / 
        NULLIF(SUM(COALESCE(lts.workers_required, 0)), 0)), 
        4
    ) AS workforce_fulfillment_ratio,

    -- 5. Incident & Roadblock Features
    COALESCE(des.active_delay_events_count, 0) AS active_delay_events_count,
    COALESCE(des.critical_delay_events_count, 0) AS critical_delay_events_count,
    COALESCE(des.total_estimated_delay_days, 0) AS total_estimated_delay_days,

    -- 6. Velocity & Run-Rate Features
    COALESCE(rpv.avg_project_7d_velocity, 0.000) AS recent_7d_progress_velocity,
    -- Required daily progress velocity to hit contractual deadline on time
    ROUND(
        ((100.00 - AVG(COALESCE(lts.actual_pct, 0.00))) / 
        NULLIF(GREATEST(1, (p.deadline - CURRENT_DATE)), 0)), 
        3
    ) AS required_daily_velocity,
    -- Ratio of actual recent velocity to required velocity (values < 1.0 indicate insufficient pace)
    ROUND(
        (COALESCE(rpv.avg_project_7d_velocity, 0.000) / 
        NULLIF(((100.00 - AVG(COALESCE(lts.actual_pct, 0.00))) / NULLIF(GREATEST(1, (p.deadline - CURRENT_DATE)), 0)), 0)),
        3
    ) AS velocity_health_ratio

FROM projects p
LEFT JOIN latest_trade_states lts ON p.id = lts.project_id
LEFT JOIN recent_project_velocity rpv ON p.id = rpv.project_id
LEFT JOIN delay_events_summary des ON p.id = des.project_id
GROUP BY 
    p.id, 
    p.organization_id, 
    p.store_id, 
    p.start_date, 
    p.deadline, 
    p.status,
    rpv.avg_project_7d_velocity,
    des.active_delay_events_count,
    des.critical_delay_events_count,
    des.total_estimated_delay_days;
