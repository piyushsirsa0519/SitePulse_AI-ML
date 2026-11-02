/**
 * Site Pulse — Portfolio Service
 * Data access and orchestration for portfolio risk aggregation.
 * Strictly enforces organization isolation.
 */

const db = require('../db/client');
const { getFullProjectData } = require('./projectService');
const { calculatePortfolioRisk, calculateProjectMetrics } = require('../analytics/index');

async function getPortfolioData(orgId, referenceDate = new Date()) {
    let projectIds = [];

    if (db.pool) {
        const res = await db.query(
            'SELECT id FROM projects WHERE organization_id = $1 AND status = $2',
            [orgId, 'active']
        );
        projectIds = res.rows.map(r => r.id);
    } else {
        projectIds = db.store.projects
            .filter(p => p.organization_id === orgId && p.status === 'active')
            .map(p => p.id);
    }

    const fullProjects = [];
    const projectMetricsMap = {};
    for (const pid of projectIds) {
        const p = await getFullProjectData(pid, orgId);
        if (p) {
            fullProjects.push(p);
            projectMetricsMap[p.id] = calculateProjectMetrics(p, referenceDate);
        }
    }

    const portfolioRiskData = calculatePortfolioRisk(fullProjects, referenceDate);

    // Enrich each portfolio item with executive metrics and contractor/delay summaries
    for (const item of portfolioRiskData) {
        const metrics = projectMetricsMap[item.id] || {};
        const projObj = fullProjects.find(p => p.id === item.id) || {};
        item.deadline = projObj.deadline;
        item.startDate = projObj.startDate || projObj.start_date;
        item.store_id = projObj.store_id;
        item.overallActual = metrics.overallActual ?? 0;
        item.overallPlanned = metrics.overallPlanned ?? 0;
        item.variance = metrics.variance ?? 0;
        item.healthStatus = metrics.healthStatus ?? 'On Track';
        item.statusClass = metrics.statusClass ?? 'on-track';
        item.totalWorkersPresent = metrics.totalWorkersPresent ?? 0;
        item.totalWorkersRequired = metrics.totalWorkersRequired ?? 0;
        item.totalTrades = metrics.totalTrades ?? 0;
        item.delayedTradesCount = metrics.delayedTradesCount ?? 0;
        item.daysElapsed = metrics.daysElapsed ?? 0;
        item.totalProjectDays = metrics.totalProjectDays ?? 1;
        item.timeElapsedPct = metrics.timeElapsedPct ?? 0;

        // Contractor count & active delay count
        if (db.pool) {
            const caRes = await db.query(
                "SELECT COUNT(DISTINCT contractor_id) as cnt FROM contractor_assignments WHERE project_id = $1 AND status = 'active'",
                [item.id]
            );
            item.activeContractorCount = parseInt((caRes.rows[0] && caRes.rows[0].cnt) || 0, 10);

            const deRes = await db.query(
                "SELECT COUNT(*) as cnt FROM delay_events WHERE project_id = $1 AND status IN ('open', 'mitigating')",
                [item.id]
            );
            item.activeDelayEventsCount = parseInt((deRes.rows[0] && deRes.rows[0].cnt) || 0, 10);
        } else {
            const assignments = (db.store.contractor_assignments || []).filter(ca => ca.project_id === item.id && ca.status === 'active');
            const uniqueContractors = new Set(assignments.map(ca => ca.contractor_id));
            item.activeContractorCount = uniqueContractors.size;

            const delays = (db.store.delay_events || []).filter(de => de.project_id === item.id && ['open', 'mitigating'].includes(de.status));
            item.activeDelayEventsCount = delays.length;
        }
    }

    return portfolioRiskData;
}

async function getContractorsData(orgId) {
    if (db.pool) {
        const res = await db.query(
            `SELECT c.*, 
                    COUNT(DISTINCT ca.project_id) as active_projects_count,
                    COUNT(DISTINCT de.id) FILTER (WHERE de.status IN ('open', 'mitigating')) as active_delays_count
             FROM contractors c
             LEFT JOIN contractor_assignments ca ON c.id = ca.contractor_id AND ca.status = 'active'
             LEFT JOIN delay_events de ON c.id = de.contractor_id
             WHERE c.organization_id = $1
             GROUP BY c.id
             ORDER BY c.name ASC`,
            [orgId]
        );
        return res.rows;
    }

    const contractors = (db.store.contractors || []).filter(c => c.organization_id === orgId);
    return contractors.map(c => {
        const assignments = (db.store.contractor_assignments || []).filter(ca => ca.contractor_id === c.id && ca.status === 'active');
        const uniqueProjects = new Set(assignments.map(ca => ca.project_id));
        const delays = (db.store.delay_events || []).filter(de => de.contractor_id === c.id && ['open', 'mitigating'].includes(de.status));
        return {
            ...c,
            active_projects_count: uniqueProjects.size,
            active_delays_count: delays.length
        };
    });
}

module.exports = {
    getPortfolioData,
    getContractorsData
};
