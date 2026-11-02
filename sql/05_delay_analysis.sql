-- ============================================================================
-- Site Pulse — Analytical Query E: Root-Cause Delay Incident Analysis
-- Identifies the most frequent delay categories by project and contractor.
-- Uses DENSE_RANK() to pinpoint the primary delay drivers per site.
-- ============================================================================

-- 1. Project-Level Delay Root-Cause Ranking CTE
WITH project_delay_categorization AS (
    SELECT 
        de.project_id,
        p.name AS project_name,
        p.location AS project_location,
        de.category AS delay_category,
        COUNT(de.id) AS event_count,
        SUM(de.estimated_delay_days) AS total_estimated_delay_days,
        SUM(COALESCE(de.actual_delay_days, 0)) AS total_actual_delay_days,
        COUNT(CASE WHEN de.status = 'open' THEN 1 END) AS open_delay_events_count,
        -- Rank categories within each project by frequency and severity
        DENSE_RANK() OVER (
            PARTITION BY de.project_id 
            ORDER BY COUNT(de.id) DESC, SUM(de.estimated_delay_days) DESC
        ) AS category_rank_within_project
    FROM delay_events de
    JOIN projects p ON de.project_id = p.id
    GROUP BY de.project_id, p.name, p.location, de.category
),
-- 2. Contractor-Level Delay Attribution CTE
contractor_delay_attribution AS (
    SELECT 
        de.contractor_id,
        c.name AS contractor_name,
        c.trade_specialty,
        de.category AS delay_category,
        COUNT(de.id) AS contractor_event_count,
        SUM(de.estimated_delay_days) AS contractor_estimated_delay_days,
        DENSE_RANK() OVER (
            PARTITION BY de.contractor_id 
            ORDER BY COUNT(de.id) DESC
        ) AS category_rank_within_contractor
    FROM delay_events de
    JOIN contractors c ON de.contractor_id = c.id
    GROUP BY de.contractor_id, c.name, c.trade_specialty, de.category
)
-- Primary Report: Top Project Delay Drivers
SELECT 
    pdc.project_name,
    pdc.project_location,
    pdc.delay_category,
    pdc.event_count,
    pdc.total_estimated_delay_days,
    pdc.total_actual_delay_days,
    pdc.open_delay_events_count,
    pdc.category_rank_within_project,
    CASE 
        WHEN pdc.category_rank_within_project = 1 THEN 'Primary Bottleneck Driver'
        WHEN pdc.category_rank_within_project = 2 THEN 'Secondary Contributor'
        ELSE 'Minor Factor'
    END AS driver_significance
FROM project_delay_categorization pdc
ORDER BY pdc.project_name, pdc.category_rank_within_project ASC;
