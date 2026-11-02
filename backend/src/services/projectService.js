/**
 * Site Pulse — Project Service
 * Data access and orchestration for projects & dashboard analytics.
 * Strictly enforces organization isolation.
 */

const db = require('../db/client');
const {
    calculateProjectMetrics,
    getProjectBottleneck,
    calculateProjectedCompletion,
    getRecommendation
} = require('../analytics/index');

/**
 * Loads project and trades with latest daily update data, scoped by organization_id.
 */
async function getFullProjectData(projectId, orgId) {
    if (db.pool) {
        const projRes = await db.query(
            'SELECT * FROM projects WHERE id = $1 AND organization_id = $2',
            [projectId, orgId]
        );
        if (projRes.rows.length === 0) return null;

        const projectRow = projRes.rows[0];

        const tradesRes = await db.query(
            'SELECT * FROM trades WHERE project_id = $1',
            [projectId]
        );

        const tradeIds = tradesRes.rows.map(t => t.id);

        let updatesMap = {};
        if (tradeIds.length > 0) {
            const updatesRes = await db.query(
                `SELECT DISTINCT ON (trade_id) * 
                 FROM daily_updates 
                 WHERE trade_id = ANY($1) 
                 ORDER BY trade_id, date DESC`,
                [tradeIds]
            );
            updatesRes.rows.forEach(u => {
                updatesMap[u.trade_id] = u;
            });
        }

        const trades = tradesRes.rows.map(t => {
            const upd = updatesMap[t.id];
            return {
                id: t.id,
                name: t.name,
                planned_pct: Number(t.planned_pct) || 0,
                progress_pct: upd ? Number(upd.progress_pct) : 0,
                workers_present: upd ? Number(upd.workers_present) : 0,
                workers_required: upd ? Number(upd.workers_required) : Number(t.default_workers_required) || 0,
                reason: upd ? upd.reason : 'On Track'
            };
        });

        return {
            id: projectRow.id,
            name: projectRow.name,
            location: projectRow.location,
            city: projectRow.location,
            startDate: projectRow.start_date,
            start_date: projectRow.start_date,
            deadline: projectRow.deadline,
            status: projectRow.status,
            organization_id: projectRow.organization_id,
            store_id: projectRow.store_id,
            trades: trades
        };
    }

    // In-memory fallback
    const projectRow = db.store.projects.find(p => p.id === projectId && p.organization_id === orgId);
    if (!projectRow) return null;

    const trades = db.store.trades
        .filter(t => t.project_id === projectId)
        .map(t => {
            // Find latest update
            const upd = db.store.daily_updates
                .filter(u => u.trade_id === t.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

            return {
                id: t.id,
                name: t.name,
                planned: t.planned_pct ?? t.planned,
                planned_pct: t.planned_pct ?? t.planned,
                actual: upd ? upd.progress_pct : (t.actual ?? 0),
                progress_pct: upd ? upd.progress_pct : (t.actual ?? 0),
                workersPresent: upd ? upd.workers_present : (t.workersPresent ?? 0),
                workers_present: upd ? upd.workers_present : (t.workersPresent ?? 0),
                workersRequired: upd ? upd.workers_required : (t.workersRequired ?? t.default_workers_required),
                workers_required: upd ? upd.workers_required : (t.workersRequired ?? t.default_workers_required),
                reason: upd ? upd.reason : 'On Track'
            };
        });

    return {
        id: projectRow.id,
        name: projectRow.name,
        location: projectRow.location,
        city: projectRow.location,
        startDate: projectRow.start_date || projectRow.startDate,
        deadline: projectRow.deadline,
        status: projectRow.status,
        organization_id: projectRow.organization_id,
        store_id: projectRow.store_id,
        trades: trades
    };
}

/**
 * Generates project dashboard analysis response scoped by organization.
 */
async function getProjectDashboardData(projectId, orgId, referenceDate = new Date()) {
    const fullProject = await getFullProjectData(projectId, orgId);
    if (!fullProject) return null;

    const metrics = calculateProjectMetrics(fullProject, referenceDate);
    const bottleneck = getProjectBottleneck(fullProject);
    const forecast = calculateProjectedCompletion(fullProject, referenceDate);
    const recommendation = getRecommendation(fullProject, referenceDate);

    // Fetch associated delay events and contractor assignments
    let delayEvents = [];
    let contractors = [];
    let storeInfo = null;

    if (db.pool) {
        const deRes = await db.query(
            "SELECT * FROM delay_events WHERE project_id = $1 ORDER BY identified_date DESC",
            [projectId]
        );
        delayEvents = deRes.rows;

        const caRes = await db.query(
            `SELECT c.id, c.name, c.trade_specialty, c.contact_person, c.contact_email, c.rating, ca.trade_id, ca.contract_value 
             FROM contractor_assignments ca 
             JOIN contractors c ON ca.contractor_id = c.id 
             WHERE ca.project_id = $1 AND ca.status = 'active'`,
            [projectId]
        );
        contractors = caRes.rows;

        if (fullProject.store_id) {
            const stRes = await db.query("SELECT * FROM stores WHERE id = $1", [fullProject.store_id]);
            storeInfo = stRes.rows[0] || null;
        }
    } else {
        delayEvents = (db.store.delay_events || []).filter(d => d.project_id === projectId);
        const assignments = (db.store.contractor_assignments || []).filter(ca => ca.project_id === projectId && ca.status === 'active');
        contractors = assignments.map(ca => {
            const c = (db.store.contractors || []).find(cnt => cnt.id === ca.contractor_id) || {};
            return {
                id: c.id,
                name: c.name,
                trade_specialty: c.trade_specialty,
                contact_person: c.contact_person,
                contact_email: c.contact_email,
                rating: c.rating,
                trade_id: ca.trade_id,
                contract_value: ca.contract_value
            };
        });

        if (fullProject.store_id) {
            storeInfo = (db.store.stores || []).find(s => s.id === fullProject.store_id) || null;
        }
    }

    // Attach contractor details to individual trade objects
    const contractorByTradeMap = {};
    contractors.forEach(c => {
        if (c.trade_id) contractorByTradeMap[c.trade_id] = c;
    });

    const enrichedTrades = fullProject.trades.map(t => {
        const assignedContractor = contractorByTradeMap[t.id];
        return {
            ...t,
            contractor_name: assignedContractor ? assignedContractor.name : 'Apex Retail Crew',
            contractor_id: assignedContractor ? assignedContractor.id : null,
            contractor_rating: assignedContractor ? assignedContractor.rating : null
        };
    });

    return {
        project: {
            id: fullProject.id,
            name: fullProject.name,
            location: fullProject.location,
            startDate: fullProject.startDate,
            deadline: fullProject.deadline,
            status: fullProject.status,
            store_id: fullProject.store_id,
            store: storeInfo
        },
        metrics,
        trades: enrichedTrades,
        bottleneck,
        forecast,
        recommendation,
        delayEvents,
        contractors,
        store: storeInfo
    };
}

module.exports = {
    getFullProjectData,
    getProjectDashboardData
};
