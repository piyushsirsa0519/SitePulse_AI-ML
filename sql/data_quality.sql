-- ============================================================================
-- Site Pulse — Step 4: Data Quality & Integrity Audit Queries
-- Non-destructive diagnostic queries designed to detect anomalies, duplicates,
-- referential defects, and boundary violations without modifying production data.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Check for Duplicate Daily Progress Records
-- Detects if multiple updates exist for the same trade on the same date.
-- ----------------------------------------------------------------------------
SELECT 
    'Duplicate Progress Record' AS anomaly_type,
    du.trade_id,
    du.date,
    COUNT(du.id) AS occurrences,
    ARRAY_AGG(du.id) AS duplicate_record_ids
FROM daily_updates du
GROUP BY du.trade_id, du.date
HAVING COUNT(du.id) > 1;

-- ----------------------------------------------------------------------------
-- 2. Check for Missing Daily Updates
-- Flags active projects and trades that have received no updates in >= 3 days.
-- ----------------------------------------------------------------------------
SELECT 
    'Missing Daily Update Stagnation' AS anomaly_type,
    p.id AS project_id,
    p.name AS project_name,
    t.id AS trade_id,
    t.name AS trade_name,
    MAX(du.date) AS last_update_date,
    (CURRENT_DATE - MAX(du.date)) AS days_since_last_update
FROM projects p
JOIN trades t ON p.id = t.project_id
LEFT JOIN daily_updates du ON t.id = du.trade_id
WHERE p.status = 'active'
GROUP BY p.id, p.name, t.id, t.name
HAVING (CURRENT_DATE - MAX(du.date)) > 3 OR MAX(du.date) IS NULL;

-- ----------------------------------------------------------------------------
-- 3. Check for Invalid Progress Percentages
-- Identifies records with progress_pct < 0, > 100, or non-monotonic regressions
-- (e.g. progress dropping by more than 5% without an associated rework delay).
-- ----------------------------------------------------------------------------
WITH progress_deltas AS (
    SELECT 
        du.id,
        du.trade_id,
        du.date,
        du.progress_pct,
        LAG(du.progress_pct, 1) OVER (PARTITION BY du.trade_id ORDER BY du.date ASC) AS prev_progress_pct,
        du.reason
    FROM daily_updates du
)
SELECT 
    'Invalid or Regressive Progress' AS anomaly_type,
    id AS update_id,
    trade_id,
    date,
    progress_pct,
    prev_progress_pct,
    reason,
    CASE 
        WHEN progress_pct < 0.00 OR progress_pct > 100.00 THEN 'Out of range [0, 100]'
        WHEN (prev_progress_pct - progress_pct) > 5.00 THEN 'Unexpected progress regression > 5%'
        ELSE 'Suspicious Delta'
    END AS defect_description
FROM progress_deltas
WHERE progress_pct < 0.00 
   OR progress_pct > 100.00 
   OR (prev_progress_pct - progress_pct) > 5.00;

-- ----------------------------------------------------------------------------
-- 4. Check for Impossible Project Dates
-- Identifies start_date > deadline, or daily update dates outside project duration.
-- ----------------------------------------------------------------------------
SELECT 
    'Impossible Project Schedule Dates' AS anomaly_type,
    p.id AS project_id,
    p.name AS project_name,
    p.start_date,
    p.deadline,
    'Deadline before Start Date' AS defect_description
FROM projects p
WHERE p.deadline < p.start_date

UNION ALL

SELECT 
    'Update Date Outside Project Bounds' AS anomaly_type,
    p.id AS project_id,
    p.name AS project_name,
    du.date AS update_date,
    p.deadline,
    CASE 
        WHEN du.date < p.start_date THEN 'Update before project start_date'
        WHEN du.date > CURRENT_DATE THEN 'Update logged in future date'
        ELSE 'Invalid date boundary'
    END AS defect_description
FROM daily_updates du
JOIN trades t ON du.trade_id = t.id
JOIN projects p ON t.project_id = p.id
WHERE du.date < p.start_date OR du.date > CURRENT_DATE;

-- ----------------------------------------------------------------------------
-- 5. Check for Negative or Unrealistic Manpower Values
-- Identifies workers_present < 0, workers_required < 0, or present > 10x required.
-- ----------------------------------------------------------------------------
SELECT 
    'Negative or Absurd Manpower Record' AS anomaly_type,
    du.id AS update_id,
    du.trade_id,
    du.date,
    du.workers_present,
    du.workers_required,
    CASE 
        WHEN du.workers_present < 0 THEN 'Negative workers present'
        WHEN du.workers_required < 0 THEN 'Negative workers required'
        WHEN du.workers_present > 200 THEN 'Extreme worker count (> 200)'
        ELSE 'Unusual workforce entry'
    END AS defect_description
FROM daily_updates du
WHERE du.workers_present < 0 
   OR du.workers_required < 0 
   OR du.workers_present > 200;

-- ----------------------------------------------------------------------------
-- 6. Check for Missing Contractor Assignments
-- Identifies active trades that have no contractor assigned.
-- ----------------------------------------------------------------------------
SELECT 
    'Trade Lacks Assigned Contractor' AS anomaly_type,
    p.id AS project_id,
    p.name AS project_name,
    t.id AS trade_id,
    t.name AS trade_name,
    p.organization_id
FROM trades t
JOIN projects p ON t.project_id = p.id
LEFT JOIN contractor_assignments ca ON t.id = ca.trade_id AND ca.status = 'active'
WHERE p.status = 'active' AND ca.id IS NULL;

-- ----------------------------------------------------------------------------
-- 7. Check for Orphaned Records
-- Validates referential integrity for foreign keys without matching parents.
-- ----------------------------------------------------------------------------
SELECT 'Orphaned Trade (No Project)' AS anomaly_type, t.id, t.project_id
FROM trades t
LEFT JOIN projects p ON t.project_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 'Orphaned Daily Update (No Trade)' AS anomaly_type, du.id, du.trade_id
FROM daily_updates du
LEFT JOIN trades t ON du.trade_id = t.id
WHERE t.id IS NULL

UNION ALL

SELECT 'Orphaned Assignment (No Contractor)' AS anomaly_type, ca.id, ca.contractor_id
FROM contractor_assignments ca
LEFT JOIN contractors c ON ca.contractor_id = c.id
WHERE c.id IS NULL

UNION ALL

SELECT 'Orphaned Delay Event (No Project)' AS anomaly_type, de.id, de.project_id
FROM delay_events de
LEFT JOIN projects p ON de.project_id = p.id
WHERE p.id IS NULL;
