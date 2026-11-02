-- ============================================================================
-- Site Pulse — Analytical Query B: Planned vs. Actual Variance
-- Calculates trade-wise and project-wise schedule variance using CTEs.
-- Variance = Actual Progress % - Planned Progress %
-- Negative variance indicates lag/delay; positive indicates advance.
-- ============================================================================

-- 1. Latest Progress per Trade CTE
WITH latest_trade_updates AS (
    SELECT DISTINCT ON (du.trade_id)
        du.trade_id,
        du.date AS latest_date,
        du.progress_pct AS actual_pct,
        du.workers_present,
        du.workers_required,
        du.reason,
        du.notes
    FROM daily_updates du
    ORDER BY du.trade_id, du.date DESC
),
-- 2. Granular Trade-Level Variance CTE
trade_level_variance AS (
    SELECT 
        p.id AS project_id,
        p.organization_id,
        p.name AS project_name,
        p.location AS project_location,
        p.start_date,
        p.deadline,
        t.id AS trade_id,
        t.name AS trade_name,
        t.planned_pct,
        COALESCE(ltu.actual_pct, 0.00) AS actual_pct,
        ROUND(COALESCE(ltu.actual_pct, 0.00) - t.planned_pct, 2) AS trade_variance,
        ltu.workers_present,
        ltu.workers_required,
        COALESCE(ltu.reason, 'No Update') AS trade_reason,
        CASE 
            WHEN COALESCE(ltu.actual_pct, 0.00) >= t.planned_pct THEN 'On Track'
            WHEN (t.planned_pct - COALESCE(ltu.actual_pct, 0.00)) <= 10.00 THEN 'Slightly Behind'
            ELSE 'Behind Schedule'
        END AS trade_status
    FROM trades t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN latest_trade_updates ltu ON t.id = ltu.trade_id
),
-- 3. Project-Level Aggregation CTE
project_level_variance AS (
    SELECT 
        tlv.project_id,
        tlv.organization_id,
        tlv.project_name,
        tlv.project_location,
        tlv.start_date,
        tlv.deadline,
        COUNT(tlv.trade_id) AS total_trades,
        ROUND(AVG(tlv.planned_pct), 2) AS overall_planned_pct,
        ROUND(AVG(tlv.actual_pct), 2) AS overall_actual_pct,
        ROUND(AVG(tlv.actual_pct) - AVG(tlv.planned_pct), 2) AS overall_variance,
        COUNT(CASE WHEN tlv.trade_status = 'Behind Schedule' THEN 1 END) AS critical_trades_delayed_count,
        COUNT(CASE WHEN tlv.trade_status = 'Slightly Behind' THEN 1 END) AS attention_trades_count,
        SUM(COALESCE(tlv.workers_present, 0)) AS total_workers_present,
        SUM(COALESCE(tlv.workers_required, 0)) AS total_workers_required,
        MAX(tlv.planned_pct - tlv.actual_pct) AS max_bottleneck_gap
    FROM trade_level_variance tlv
    GROUP BY 
        tlv.project_id, 
        tlv.organization_id, 
        tlv.project_name, 
        tlv.project_location, 
        tlv.start_date, 
        tlv.deadline
)
-- Output Project Variance Rollup
SELECT 
    plv.project_id,
    plv.project_name,
    plv.project_location,
    plv.start_date,
    plv.deadline,
    plv.total_trades,
    plv.overall_planned_pct,
    plv.overall_actual_pct,
    plv.overall_variance,
    plv.critical_trades_delayed_count,
    plv.max_bottleneck_gap,
    plv.total_workers_present,
    plv.total_workers_required,
    CASE 
        WHEN plv.critical_trades_delayed_count >= 2 OR plv.overall_variance < -5.00 THEN 'Behind Schedule'
        WHEN plv.critical_trades_delayed_count = 1 OR plv.attention_trades_count >= 1 THEN 'Attention Needed'
        ELSE 'On Track'
    END AS project_health_status
FROM project_level_variance plv
ORDER BY plv.overall_variance ASC;
