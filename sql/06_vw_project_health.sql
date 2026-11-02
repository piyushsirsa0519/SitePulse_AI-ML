-- ============================================================================
-- Site Pulse — Analytical View F: vw_project_health
-- Canonical real-time project health evaluation view.
-- Encapsulates multi-trade variance, bottleneck isolation, workforce coverage,
-- and active delay events into a consolidated executive health status.
-- Safe math: guards against NULLs and division by zero.
-- ============================================================================

CREATE OR REPLACE VIEW vw_project_health AS
WITH latest_trade_updates AS (
    SELECT DISTINCT ON (du.trade_id)
        du.trade_id,
        du.date AS latest_update_date,
        du.progress_pct AS actual_pct,
        du.workers_present,
        du.workers_required,
        du.reason,
        du.notes
    FROM daily_updates du
    ORDER BY du.trade_id, du.date DESC
),
trade_assessments AS (
    SELECT 
        t.id AS trade_id,
        t.project_id,
        t.name AS trade_name,
        t.planned_pct,
        COALESCE(ltu.actual_pct, 0.00) AS actual_pct,
        ROUND(COALESCE(ltu.actual_pct, 0.00) - t.planned_pct, 2) AS variance,
        COALESCE(ltu.workers_present, 0) AS workers_present,
        COALESCE(ltu.workers_required, t.default_workers_required) AS workers_required,
        COALESCE(ltu.reason, 'On Track') AS reason,
        ltu.latest_update_date,
        -- Trade Bottleneck Gap: planned - actual (only positive gaps are behind)
        GREATEST(0.00, t.planned_pct - COALESCE(ltu.actual_pct, 0.00)) AS bottleneck_gap,
        CASE 
            WHEN COALESCE(ltu.actual_pct, 0.00) < t.planned_pct OR COALESCE(ltu.reason, 'On Track') != 'On Track' THEN 1
            ELSE 0
        END AS is_delayed
    FROM trades t
    LEFT JOIN latest_trade_updates ltu ON t.id = ltu.trade_id
),
project_bottleneck_ranked AS (
    SELECT 
        project_id,
        trade_name AS bottleneck_trade_name,
        bottleneck_gap AS bottleneck_gap_pct,
        reason AS bottleneck_reason,
        ROW_NUMBER() OVER (
            PARTITION BY project_id 
            ORDER BY bottleneck_gap DESC, trade_name ASC
        ) AS rank_order
    FROM trade_assessments
),
project_active_delays AS (
    SELECT 
        de.project_id,
        COUNT(de.id) AS active_delay_events_count,
        SUM(de.estimated_delay_days) AS total_estimated_delay_days
    FROM delay_events de
    WHERE de.status IN ('open', 'mitigating', 'escalated')
    GROUP BY de.project_id
)
SELECT 
    p.id AS project_id,
    p.organization_id,
    p.name AS project_name,
    p.location AS project_location,
    p.store_id,
    p.start_date,
    p.deadline,
    p.status AS project_status,
    
    -- Timeline Metrics
    GREATEST(1, (p.deadline - p.start_date)) AS total_project_days,
    GREATEST(0, LEAST((p.deadline - p.start_date), (CURRENT_DATE - p.start_date))) AS days_elapsed,
    GREATEST(0, (p.deadline - CURRENT_DATE)) AS days_remaining,
    ROUND(
        (GREATEST(0, (CURRENT_DATE - p.start_date))::numeric / 
        NULLIF(GREATEST(1, (p.deadline - p.start_date)), 0) * 100.00), 
        1
    ) AS timeline_elapsed_pct,

    -- Progress Metrics
    COUNT(ta.trade_id) AS total_trades_count,
    ROUND(AVG(ta.planned_pct), 2) AS overall_planned_pct,
    ROUND(AVG(ta.actual_pct), 2) AS overall_actual_pct,
    ROUND(AVG(ta.actual_pct) - AVG(ta.planned_pct), 2) AS schedule_variance,
    SUM(ta.is_delayed) AS delayed_trades_count,
    (COUNT(ta.trade_id) - SUM(ta.is_delayed)) AS on_track_trades_count,

    -- Workforce Metrics
    SUM(ta.workers_present) AS total_workers_present,
    SUM(ta.workers_required) AS total_workers_required,
    GREATEST(0, SUM(ta.workers_required) - SUM(ta.workers_present)) AS total_workforce_deficit,
    ROUND(
        (SUM(ta.workers_present)::numeric / NULLIF(SUM(ta.workers_required), 0) * 100.00),
        1
    ) AS workforce_fulfillment_pct,

    -- Bottleneck Diagnostics
    COALESCE(pbr.bottleneck_trade_name, 'None') AS bottleneck_trade_name,
    COALESCE(pbr.bottleneck_gap_pct, 0.00) AS bottleneck_gap_pct,
    COALESCE(pbr.bottleneck_reason, 'On Track') AS bottleneck_reason,

    -- Delay Incidents
    COALESCE(pad.active_delay_events_count, 0) AS active_delay_events_count,
    COALESCE(pad.total_estimated_delay_days, 0) AS total_estimated_delay_days,

    -- Executive Health Status Classification
    CASE 
        WHEN SUM(ta.is_delayed) >= 2 
             OR (AVG(ta.actual_pct) - AVG(ta.planned_pct)) < -5.00 
             OR COALESCE(pad.active_delay_events_count, 0) >= 2 THEN 'Behind Schedule'
        WHEN SUM(ta.is_delayed) = 1 
             OR (AVG(ta.actual_pct) - AVG(ta.planned_pct)) < 0.00 
             OR COALESCE(pad.active_delay_events_count, 0) = 1 THEN 'Attention Needed'
        ELSE 'On Track'
    END AS health_status,

    CASE 
        WHEN SUM(ta.is_delayed) >= 2 
             OR (AVG(ta.actual_pct) - AVG(ta.planned_pct)) < -5.00 
             OR COALESCE(pad.active_delay_events_count, 0) >= 2 THEN 'behind'
        WHEN SUM(ta.is_delayed) = 1 
             OR (AVG(ta.actual_pct) - AVG(ta.planned_pct)) < 0.00 
             OR COALESCE(pad.active_delay_events_count, 0) = 1 THEN 'attention'
        ELSE 'on-track'
    END AS status_css_class,

    MAX(ta.latest_update_date) AS last_progress_update_date

FROM projects p
JOIN trade_assessments ta ON p.id = ta.project_id
LEFT JOIN project_bottleneck_ranked pbr ON p.id = pbr.project_id AND pbr.rank_order = 1
LEFT JOIN project_active_delays pad ON p.id = pad.project_id
GROUP BY 
    p.id, 
    p.organization_id, 
    p.name, 
    p.location, 
    p.store_id, 
    p.start_date, 
    p.deadline, 
    p.status,
    pbr.bottleneck_trade_name,
    pbr.bottleneck_gap_pct,
    pbr.bottleneck_reason,
    pad.active_delay_events_count,
    pad.total_estimated_delay_days;
