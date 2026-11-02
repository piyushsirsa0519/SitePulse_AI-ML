/**
 * SitePulse — Copilot Grounded Context Retrieval Service
 * ========================================================
 * Extracts real-time, organization-isolated project and portfolio telemetry
 * to ground the LLM in verified operational facts.
 * 
 * Sources:
 *   - portfolioService (Rollup metrics, project health, contractor directory)
 *   - projectService (Project details, trades execution, delay events, store info)
 *   - mlInferenceService (Delay risk probability, factor attributions, anomaly alerts)
 * 
 * Guarantees:
 *   - Strict organization tenant isolation (enforces orgId on all queries)
 *   - No arbitrary SQL generation or execution
 *   - Explicit unavailable states for missing telemetry
 */

const portfolioService = require('./portfolioService');
const projectService = require('./projectService');
const mlInferenceService = require('./mlInferenceService');

/**
 * Retrieves portfolio-level grounded context scoped to organization.
 * @param {string} orgId - Organization UUID
 * @param {Date|string} referenceDate - Operational cutoff date
 * @returns {Promise<Object>} Formatted portfolio context
 */
async function getPortfolioContext(orgId, referenceDate = new Date()) {
    const refDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const dateStr = refDate.toISOString().split('T')[0];

    const portfolioItems = await portfolioService.getPortfolioData(orgId, refDate);
    const contractors = await portfolioService.getContractorsData(orgId);

    if (!portfolioItems || portfolioItems.length === 0) {
        return {
            scope: 'portfolio',
            referenceDate: dateStr,
            hasData: false,
            summary: 'No active retail fitout projects found for this organization.',
            projects: [],
            contractors: []
        };
    }

    // Rollup statistics
    const totalProjects = portfolioItems.length;
    let onTrackCount = 0;
    let atRiskCount = 0;
    let delayedCount = 0;
    let totalActualWeighted = 0;
    let totalPlannedWeighted = 0;
    let totalWorkersPresent = 0;
    let totalWorkersRequired = 0;
    let totalOpenDelays = 0;

    const projectSummaries = portfolioItems.map(p => {
        if (p.healthStatus === 'On Track') onTrackCount++;
        else if (p.healthStatus === 'Attention' || p.healthStatus === 'At Risk') atRiskCount++;
        else delayedCount++;

        totalActualWeighted += (p.overallActual || 0);
        totalPlannedWeighted += (p.overallPlanned || 0);
        totalWorkersPresent += (p.totalWorkersPresent || 0);
        totalWorkersRequired += (p.totalWorkersRequired || 0);
        totalOpenDelays += (p.activeDelayEventsCount || 0);

        return {
            id: p.id,
            name: p.name,
            storeId: p.store_id || 'N/A',
            city: p.city || p.location || 'Unknown',
            deadline: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : (p.deadlineStr || 'N/A'),
            healthStatus: p.healthStatus || 'On Track',
            overallActualPct: Number((p.overallActual || 0).toFixed(1)),
            overallPlannedPct: Number((p.overallPlanned || 0).toFixed(1)),
            variancePct: Number((p.variance ?? 0).toFixed(1)),
            varianceDays: p.variance ?? 0,
            projectedDelayDays: p.delayDays ?? 0,
            projectedFinishDate: p.projectedDateStr || 'On track',
            primaryBottleneck: p.bottleneckName || 'None',
            activeContractorCount: p.activeContractorCount || 0,
            activeDelayEventsCount: p.activeDelayEventsCount || 0,
            delayedTradesCount: p.delayedTradesCount || 0,
            workersPresent: p.totalWorkersPresent || 0,
            workersRequired: p.totalWorkersRequired || 0
        };
    });

    const avgActual = Number((totalActualWeighted / totalProjects).toFixed(1));
    const avgPlanned = Number((totalPlannedWeighted / totalProjects).toFixed(1));

    const contractorSummaries = (contractors || []).map(c => ({
        id: c.id,
        name: c.name,
        tradeSpecialty: c.trade_specialty,
        rating: c.rating ? Number(c.rating).toFixed(1) : 'N/A',
        activeProjects: c.active_projects_count || 0,
        activeDelays: c.active_delays_count || 0
    }));

    return {
        scope: 'portfolio',
        referenceDate: dateStr,
        hasData: true,
        metrics: {
            totalProjects,
            onTrackCount,
            atRiskCount,
            delayedCount,
            portfolioActualPct: avgActual,
            portfolioPlannedPct: avgPlanned,
            variancePct: Number((avgActual - avgPlanned).toFixed(1)),
            totalWorkersPresent,
            totalWorkersRequired,
            manpowerShortfallPct: totalWorkersRequired > 0
                ? Number(((totalWorkersRequired - totalWorkersPresent) / totalWorkersRequired * 100).toFixed(1))
                : 0,
            activeContractorsCount: contractorSummaries.length,
            totalOpenDelayEvents: totalOpenDelays
        },
        projects: projectSummaries,
        contractors: contractorSummaries
    };
}

/**
 * Retrieves detailed, grounded project context scoped to organization.
 * @param {string} projectId - Project UUID
 * @param {string} orgId - Organization UUID
 * @param {Date|string} referenceDate - Operational cutoff date
 * @returns {Promise<Object|null>} Formatted project context or null if not found
 */
async function getProjectContext(projectId, orgId, referenceDate = new Date()) {
    const refDate = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const dateStr = refDate.toISOString().split('T')[0];

    const dashboard = await projectService.getProjectDashboardData(projectId, orgId, refDate);
    if (!dashboard) return null;

    const fullProject = await projectService.getFullProjectData(projectId, orgId);

    // Retrieve ML inferences (defensive handling)
    let riskScore = null;
    let anomalies = null;

    if (fullProject) {
        try {
            riskScore = await mlInferenceService.predictProjectRisk(fullProject, refDate);
        } catch (err) {
            riskScore = { status: 'unavailable', reason: err.message };
        }

        try {
            anomalies = await mlInferenceService.detectProjectAnomalies(fullProject);
        } catch (err) {
            anomalies = { status: 'unavailable', reason: err.message };
        }
    }

    const p = dashboard.project;
    const m = dashboard.metrics || {};
    const store = dashboard.store;

    return {
        scope: 'project',
        referenceDate: dateStr,
        project: {
            id: p.id,
            name: p.name,
            location: p.location,
            startDate: p.startDate ? new Date(p.startDate).toISOString().split('T')[0] : 'N/A',
            deadline: p.deadline ? new Date(p.deadline).toISOString().split('T')[0] : 'N/A',
            status: p.status,
            store: store ? {
                code: store.store_code,
                brand: store.brand_name,
                format: store.format_type,
                sqft: store.square_footage
            } : null
        },
        metrics: {
            overallActualPct: Number((m.overallActual ?? 0).toFixed(1)),
            overallPlannedPct: Number((m.overallPlanned ?? 0).toFixed(1)),
            variancePct: Number((m.variance ?? 0).toFixed(1)),
            healthStatus: m.healthStatus || 'On Track',
            statusClass: m.statusClass || 'on-track',
            daysElapsed: m.daysElapsed ?? 0,
            totalProjectDays: m.totalProjectDays ?? 1,
            timeElapsedPct: Number((m.timeElapsedPct ?? 0).toFixed(1)),
            totalWorkersPresent: m.totalWorkersPresent ?? 0,
            totalWorkersRequired: m.totalWorkersRequired ?? 0,
            manpowerShortfallPct: m.totalWorkersRequired > 0
                ? Number(((m.totalWorkersRequired - m.totalWorkersPresent) / m.totalWorkersRequired * 100).toFixed(1))
                : 0,
            delayedTradesCount: m.delayedTradesCount ?? 0,
            totalTrades: m.totalTrades ?? (dashboard.trades ? dashboard.trades.length : 0)
        },
        trades: (dashboard.trades || []).map(t => ({
            id: t.id,
            name: t.name,
            actualPct: Number((t.actual ?? t.progress_pct ?? 0).toFixed(1)),
            plannedPct: Number((t.planned ?? t.planned_pct ?? 0).toFixed(1)),
            variance: Number(((t.actual ?? t.progress_pct ?? 0) - (t.planned ?? t.planned_pct ?? 0)).toFixed(1)),
            workersPresent: t.workersPresent ?? t.workers_present ?? 0,
            workersRequired: t.workersRequired ?? t.workers_required ?? 0,
            contractorName: t.contractor_name || 'Unassigned',
            contractorRating: t.contractor_rating ?? 'N/A',
            reason: t.reason || 'On Track'
        })),
        delayEvents: (dashboard.delayEvents || []).map(d => ({
            id: d.id,
            tradeId: d.trade_id,
            category: d.delay_category,
            severity: d.severity,
            impactDays: d.impact_days || 0,
            status: d.status,
            identifiedDate: d.identified_date ? new Date(d.identified_date).toISOString().split('T')[0] : 'N/A',
            description: d.description || d.root_cause || 'No description provided'
        })),
        bottleneck: dashboard.bottleneck || null,
        forecast: dashboard.forecast || null,
        recommendation: dashboard.recommendation || null,
        mlInsights: {
            riskScore: riskScore ? {
                probability: riskScore.delay_probability ?? riskScore.risk_score ?? null,
                riskCategory: riskScore.risk_category || 'UNKNOWN',
                isDelayedRisk: riskScore.is_delayed_risk ?? null,
                threshold: riskScore.threshold_used ?? 0.5700,
                topFactors: riskScore.top_contributing_factors || [],
                explanations: riskScore.explanations || [],
                modelType: riskScore.model_type || 'unknown',
                disclaimer: riskScore.disclaimer || 'Trained on synthetic simulation data for research & prototyping.'
            } : null,
            anomalies: anomalies ? {
                hasAnomalies: anomalies.has_anomalies ?? false,
                anomalyCount: anomalies.anomaly_count ?? 0,
                flaggedRecords: (anomalies.flagged_records || []).map(a => ({
                    tradeName: a.trade_name,
                    severity: a.severity,
                    category: a.category,
                    explanation: a.explanation
                })),
                disclaimer: anomalies.disclaimer || 'Trained on synthetic simulation data for research & prototyping.'
            } : null
        }
    };
}

module.exports = {
    getPortfolioContext,
    getProjectContext
};
