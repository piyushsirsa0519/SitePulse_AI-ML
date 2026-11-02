-- ============================================================================
-- Site Pulse — Analytical Query C: Contractor Performance Scorecard
-- Evaluates contractor-level execution progress, delay event frequency, 
-- and manpower fulfillment/utilization efficiency.
-- Safe math: guards against division by zero via NULLIF().
-- ============================================================================

WITH contractor_assignments_summary AS (
    SELECT 
        c.id AS contractor_id,
        c.organization_id,
        c.name AS contractor_name,
        c.trade_specialty,
        c.rating AS recorded_rating,
        COUNT(DISTINCT ca.project_id) AS total_assigned_projects,
        COUNT(DISTINCT ca.trade_id) AS total_assigned_trades,
        SUM(ca.contract_value) AS total_contract_value
    FROM contractors c
    LEFT JOIN contractor_assignments ca ON c.id = ca.contractor_id AND ca.status = 'active'
    GROUP BY c.id, c.organization_id, c.name, c.trade_specialty, c.rating
),
contractor_manpower_stats AS (
    SELECT 
        ml.contractor_id,
        COUNT(ml.id) AS total_log_entries,
        SUM(ml.workers_present) AS total_workers_deployed,
        SUM(ml.workers_required) AS total_workers_demanded,
        ROUND(
            (SUM(ml.workers_present)::numeric / NULLIF(SUM(ml.workers_required), 0) * 100.00), 
            2
        ) AS manpower_fulfillment_pct,
        ROUND(AVG(ml.overtime_hours), 1) AS avg_overtime_hours_per_shift
    FROM manpower_log ml
    WHERE ml.contractor_id IS NOT NULL
    GROUP BY ml.contractor_id
),
contractor_delay_stats AS (
    SELECT 
        de.contractor_id,
        COUNT(de.id) AS total_delay_events_caused,
        SUM(de.estimated_delay_days) AS total_estimated_delay_days,
        SUM(COALESCE(de.actual_delay_days, 0)) AS total_actual_delay_days,
        COUNT(CASE WHEN de.severity IN ('high', 'critical') THEN 1 END) AS severe_delay_count
    FROM delay_events de
    WHERE de.contractor_id IS NOT NULL
    GROUP BY de.contractor_id
),
contractor_trade_progress AS (
    SELECT 
        ca.contractor_id,
        ROUND(AVG(t.planned_pct), 2) AS avg_planned_pct,
        ROUND(AVG(COALESCE(latest_u.progress_pct, 0.00)), 2) AS avg_actual_pct,
        ROUND(AVG(COALESCE(latest_u.progress_pct, 0.00)) - AVG(t.planned_pct), 2) AS avg_progress_variance
    FROM contractor_assignments ca
    JOIN trades t ON ca.trade_id = t.id
    LEFT JOIN LATERAL (
        SELECT progress_pct 
        FROM daily_updates du 
        WHERE du.trade_id = t.id 
        ORDER BY du.date DESC 
        LIMIT 1
    ) latest_u ON TRUE
    GROUP BY ca.contractor_id
)
SELECT 
    cas.contractor_id,
    cas.contractor_name,
    cas.trade_specialty,
    cas.recorded_rating,
    cas.total_assigned_projects,
    cas.total_assigned_trades,
    cas.total_contract_value,
    COALESCE(ctp.avg_planned_pct, 0.00) AS avg_planned_pct,
    COALESCE(ctp.avg_actual_pct, 0.00) AS avg_actual_pct,
    COALESCE(ctp.avg_progress_variance, 0.00) AS avg_progress_variance,
    COALESCE(cms.manpower_fulfillment_pct, 100.00) AS manpower_fulfillment_pct,
    COALESCE(cms.total_workers_deployed, 0) AS total_workers_deployed,
    COALESCE(cds.total_delay_events_caused, 0) AS total_delay_events_caused,
    COALESCE(cds.total_estimated_delay_days, 0) AS total_estimated_delay_days,
    -- Composite Contractor Performance Tier
    CASE 
        WHEN COALESCE(cds.severe_delay_count, 0) > 0 OR COALESCE(ctp.avg_progress_variance, 0) < -15.00 THEN 'At Risk / Deficient'
        WHEN COALESCE(ctp.avg_progress_variance, 0) < -5.00 OR COALESCE(cms.manpower_fulfillment_pct, 100) < 80.00 THEN 'Needs Supervision'
        ELSE 'Reliable / On Track'
    END AS contractor_performance_tier
FROM contractor_assignments_summary cas
LEFT JOIN contractor_manpower_stats cms ON cas.contractor_id = cms.contractor_id
LEFT JOIN contractor_delay_stats cds ON cas.contractor_id = cds.contractor_id
LEFT JOIN contractor_trade_progress ctp ON cas.contractor_id = ctp.contractor_id
ORDER BY ctp.avg_progress_variance ASC;
