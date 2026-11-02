-- ============================================================================
-- Site Pulse — Analytical Query A: Trade Progress Velocity
-- Calculates daily progress delta and rolling progress velocity per trade.
-- Employs LAG() and frame-bounded window functions.
-- Differentiates between:
--   1. rolling_7_records_velocity: Moving average across last 7 update entries (ROWS)
--   2. rolling_7_calendar_days_velocity: Moving average over trailing 7 calendar days (RANGE)
-- Handles NULLs, sparse updates, and edge conditions safely.
-- ============================================================================

WITH ordered_trade_updates AS (
    SELECT 
        du.id AS update_id,
        du.trade_id,
        t.name AS trade_name,
        t.project_id,
        p.name AS project_name,
        p.organization_id,
        du.date AS update_date,
        du.progress_pct,
        -- Calculate daily progress delta using LAG()
        COALESCE(
            du.progress_pct - LAG(du.progress_pct, 1) OVER (
                PARTITION BY du.trade_id 
                ORDER BY du.date ASC
            ),
            du.progress_pct -- If first record, delta is progress from 0%
        ) AS daily_progress_delta,
        du.workers_present,
        du.workers_required,
        du.reason
    FROM daily_updates du
    JOIN trades t ON du.trade_id = t.id
    JOIN projects p ON t.project_id = p.id
),
velocity_metrics AS (
    SELECT 
        update_id,
        trade_id,
        trade_name,
        project_id,
        project_name,
        organization_id,
        update_date,
        progress_pct,
        daily_progress_delta,
        -- Method 1: Record-based (7 most recent shifts/entries regardless of calendar gaps)
        ROUND(
            AVG(daily_progress_delta) OVER (
                PARTITION BY trade_id 
                ORDER BY update_date ASC 
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ), 
            2
        ) AS rolling_7_records_velocity,
        -- Method 2: Calendar-based (Trailing 7 calendar days, accounting for missing/skipped days)
        ROUND(
            AVG(daily_progress_delta) OVER (
                PARTITION BY trade_id 
                ORDER BY update_date ASC 
                RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW
            ), 
            2
        ) AS rolling_7_calendar_days_velocity,
        -- Rolling 7-shift average manpower present
        ROUND(
            AVG(workers_present) OVER (
                PARTITION BY trade_id 
                ORDER BY update_date ASC 
                ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
            ), 
            1
        ) AS rolling_7d_workers_avg,
        workers_present,
        workers_required,
        reason
    FROM ordered_trade_updates
)
SELECT 
    trade_id,
    trade_name,
    project_id,
    project_name,
    update_date,
    progress_pct,
    daily_progress_delta,
    rolling_7_records_velocity,
    rolling_7_calendar_days_velocity,
    rolling_7d_workers_avg,
    workers_present,
    workers_required,
    reason
FROM velocity_metrics
ORDER BY project_name, trade_name, update_date DESC;
