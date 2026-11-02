-- ============================================================================
-- Site Pulse — Analytical Query D: Manpower Shortfall Diagnostic
-- Identifies specific dates and trades where actual workforce presence fell 
-- below contractual staffing requirements.
-- Calculates absolute deficit, percentage shortfall, and cumulative project impact.
-- ============================================================================

WITH daily_manpower_shortfalls AS (
    SELECT 
        du.id AS update_id,
        du.date AS log_date,
        p.id AS project_id,
        p.organization_id,
        p.name AS project_name,
        p.location AS project_location,
        t.id AS trade_id,
        t.name AS trade_name,
        du.workers_present,
        du.workers_required,
        (du.workers_required - du.workers_present) AS worker_shortfall,
        ROUND(
            ((du.workers_required - du.workers_present)::numeric / NULLIF(du.workers_required, 0) * 100.00),
            2
        ) AS shortfall_percentage,
        du.progress_pct,
        t.planned_pct,
        du.reason,
        du.notes
    FROM daily_updates du
    JOIN trades t ON du.trade_id = t.id
    JOIN projects p ON t.project_id = p.id
    WHERE du.workers_present < du.workers_required
),
project_shortfall_summary AS (
    SELECT 
        dms.log_date,
        dms.project_id,
        dms.project_name,
        dms.project_location,
        dms.trade_id,
        dms.trade_name,
        dms.workers_present,
        dms.workers_required,
        dms.worker_shortfall,
        dms.shortfall_percentage,
        dms.progress_pct,
        dms.planned_pct,
        dms.reason,
        -- Severity classification
        CASE 
            WHEN dms.shortfall_percentage >= 50.00 OR dms.worker_shortfall >= 5 THEN 'Critical Staffing Deficit'
            WHEN dms.shortfall_percentage >= 25.00 THEN 'Moderate Shortage'
            ELSE 'Minor Variance'
        END AS deficit_severity,
        -- Window function: cumulative worker days lost for this trade up to this date
        SUM(dms.worker_shortfall) OVER (
            PARTITION BY dms.trade_id 
            ORDER BY dms.log_date ASC
        ) AS cumulative_trade_worker_days_lost
    FROM daily_manpower_shortfalls dms
)
SELECT 
    pss.log_date,
    pss.project_name,
    pss.project_location,
    pss.trade_name,
    pss.workers_present,
    pss.workers_required,
    pss.worker_shortfall,
    pss.shortfall_percentage,
    pss.deficit_severity,
    pss.cumulative_trade_worker_days_lost,
    pss.reason,
    ROUND(pss.planned_pct - pss.progress_pct, 2) AS current_trade_gap
FROM project_shortfall_summary pss
ORDER BY pss.worker_shortfall DESC, pss.shortfall_percentage DESC;
