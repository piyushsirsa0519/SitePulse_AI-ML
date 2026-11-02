/**
 * Site Pulse — Backend Analytics Module
 * Extracted pure calculation engine from prototype logic.
 * Zero DOM / browser dependencies.
 */

/**
 * Calculates comprehensive metrics for a single project.
 * @param {Object} project - Canonical project object with trades array
 * @param {Date} [todayDate=new Date()] - Reference date for timeline calculations
 * @returns {Object} Project metrics summary
 */
function calculateProjectMetrics(project, todayDate = new Date()) {
    if (!project || !Array.isArray(project.trades) || project.trades.length === 0) {
        return {
            overallActual: 0,
            overallPlanned: 0,
            variance: 0,
            totalProjectDays: 1,
            daysElapsed: 0,
            daysRemaining: 0,
            timeElapsedPct: 0,
            totalTrades: 0,
            delayedTradesCount: 0,
            onTrackTradesCount: 0,
            totalWorkersPresent: 0,
            totalWorkersRequired: 0,
            healthStatus: 'On Track',
            statusClass: 'on-track'
        };
    }

    const totalTrades = project.trades.length;
    
    // Support both canonical fields (progress_pct, planned_pct) and legacy fields (actual/actualPct, planned/plannedPct)
    const sumActual = project.trades.reduce((acc, t) => {
        const val = Number(t.progress_pct ?? t.actual ?? t.actualPct) || 0;
        return acc + val;
    }, 0);

    const sumPlanned = project.trades.reduce((acc, t) => {
        const val = Number(t.planned_pct ?? t.planned ?? t.plannedPct) || 0;
        return acc + val;
    }, 0);
    
    const overallActual = Math.round(sumActual / totalTrades);
    const overallPlanned = Math.round(sumPlanned / totalTrades);
    const variance = overallActual - overallPlanned;

    const start = new Date(project.startDate || project.start_date);
    const deadline = new Date(project.deadline || project.deadlineDate);
    const today = new Date(todayDate);

    const oneDay = 24 * 60 * 60 * 1000;
    
    let totalProjectDays = Math.round((deadline - start) / oneDay);
    if (isNaN(totalProjectDays) || totalProjectDays <= 0) {
        totalProjectDays = 1;
    }

    let daysElapsed = Math.round((today - start) / oneDay);
    if (isNaN(daysElapsed) || daysElapsed < 0) {
        daysElapsed = 0;
    } else if (daysElapsed > totalProjectDays) {
        daysElapsed = totalProjectDays;
    }

    let daysRemaining = Math.round((deadline - today) / oneDay);
    if (isNaN(daysRemaining) || daysRemaining < 0) {
        daysRemaining = 0;
    }

    const timeElapsedPct = Math.min(100, Math.round((daysElapsed / totalProjectDays) * 100));

    let delayedTradesCount = 0;
    let onTrackTradesCount = 0;
    let totalWorkersPresent = 0;
    let totalWorkersRequired = 0;

    project.trades.forEach(t => {
        const actual = Number(t.progress_pct ?? t.actual ?? t.actualPct) || 0;
        const planned = Number(t.planned_pct ?? t.planned ?? t.plannedPct) || 0;
        const reason = t.reason ?? t.reasonBehind ?? 'On Track';

        totalWorkersPresent += Number(t.workersPresent ?? t.workers_present) || 0;
        totalWorkersRequired += Number(t.workersRequired ?? t.workers_required) || 0;

        if (reason !== 'On Track' || actual < planned) {
            delayedTradesCount++;
        } else {
            onTrackTradesCount++;
        }
    });

    let healthStatus = 'On Track';
    let statusClass = 'on-track';
    if (delayedTradesCount >= 2 || variance < -5) {
        healthStatus = 'Behind Schedule';
        statusClass = 'behind';
    } else if (delayedTradesCount === 1) {
        healthStatus = 'Attention Needed';
        statusClass = 'behind';
    }

    return {
        overallActual,
        overallPlanned,
        variance,
        totalProjectDays,
        daysElapsed,
        daysRemaining,
        timeElapsedPct,
        totalTrades,
        delayedTradesCount,
        onTrackTradesCount,
        totalWorkersPresent,
        totalWorkersRequired,
        healthStatus,
        statusClass
    };
}

/**
 * Calculates the single trade furthest behind plan (the bottleneck).
 * Formula: gap = planned - actual. Picks largest positive gap (> 0).
 * Ties resolve deterministically to the first trade in array.
 * @param {Object} project - Canonical project object with trades array
 * @returns {Object|null} Bottleneck summary or null if all trades on track
 */
function getProjectBottleneck(project) {
    if (!project || !Array.isArray(project.trades) || project.trades.length === 0) {
        return null;
    }

    let bottleneckTrade = null;
    let maxGap = 0;

    project.trades.forEach(trade => {
        const rawPlanned = Number(trade.planned_pct ?? trade.planned ?? trade.plannedPct);
        const rawActual = Number(trade.progress_pct ?? trade.actual ?? trade.actualPct);

        const planned = (!isNaN(rawPlanned) && rawPlanned >= 0) ? Math.min(100, rawPlanned) : 0;
        const actual = (!isNaN(rawActual) && rawActual >= 0) ? Math.min(100, rawActual) : 0;

        const gap = planned - actual;

        if (gap > 0 && gap > maxGap) {
            maxGap = gap;
            bottleneckTrade = trade;
        }
    });

    if (!bottleneckTrade || maxGap <= 0) {
        return null;
    }

    const rawReason = bottleneckTrade.reason ?? bottleneckTrade.reasonBehind ?? 'On Track';
    const reason = (rawReason !== 'On Track') ? rawReason : 'Site Delays';
    const tradeName = bottleneckTrade.name;
    const planned = Number(bottleneckTrade.planned_pct ?? bottleneckTrade.planned ?? bottleneckTrade.plannedPct) || 0;
    const actual = Number(bottleneckTrade.progress_pct ?? bottleneckTrade.actual ?? bottleneckTrade.actualPct) || 0;

    return {
        trade: bottleneckTrade,
        tradeName: tradeName,
        gapPercentage: maxGap,
        reason: reason,
        planned: planned,
        actual: actual
    };
}

/**
 * Calculates linear projected completion date and delay days.
 * @param {Object} project - Canonical project object
 * @param {Date} [todayDate=new Date()] - Reference today date
 * @returns {Object} Projected completion details
 */
function calculateProjectedCompletion(project, todayDate = new Date()) {
    if (!project) return null;

    const bottleneck = getProjectBottleneck(project);
    const start = new Date(project.startDate || project.start_date);
    const deadline = new Date(project.deadline || project.deadlineDate);
    const today = new Date(todayDate);
    const oneDay = 24 * 60 * 60 * 1000;

    const formattedDeadline = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    if (!bottleneck) {
        return {
            hasBottleneck: false,
            bottleneckName: null,
            projectedDate: null,
            formattedProjectedDate: 'On track',
            formattedDeadline: formattedDeadline,
            delayDays: 0,
            statusText: 'No bottleneck — project currently on track',
            statusClass: 'ok',
            isUnavailable: false
        };
    }

    let daysElapsed = Math.round((today - start) / oneDay);
    daysElapsed = Math.max(0, daysElapsed);

    const actual = Math.min(100, Math.max(0, Number(bottleneck.actual) || 0));
    const remainingProgress = Math.max(0, 100 - actual);

    if (daysElapsed === 0 || actual === 0) {
        return {
            hasBottleneck: true,
            bottleneckName: bottleneck.tradeName,
            projectedDate: null,
            formattedProjectedDate: 'Unavailable',
            formattedDeadline: formattedDeadline,
            delayDays: 0,
            statusText: 'Projection unavailable — insufficient progress history',
            statusClass: 'warning',
            isUnavailable: true
        };
    }

    if (actual >= 100) {
        const formattedToday = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const delayDays = Math.round((today - deadline) / oneDay);
        return {
            hasBottleneck: true,
            bottleneckName: bottleneck.tradeName,
            projectedDate: today,
            formattedProjectedDate: formattedToday,
            formattedDeadline: formattedDeadline,
            delayDays: delayDays,
            statusText: delayDays > 0 ? `${delayDays} days delayed` : (delayDays < 0 ? `${Math.abs(delayDays)} days ahead of deadline` : 'On schedule — projected to finish by deadline'),
            statusClass: delayDays > 0 ? 'alert' : 'ok',
            isUnavailable: false
        };
    }

    const currentDailyProgressRate = actual / daysElapsed;
    const remainingDays = remainingProgress / Math.max(0.0001, currentDailyProgressRate);
    const projectedDate = new Date(today.getTime() + (remainingDays * oneDay));

    const formattedProjectedDate = projectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const delayDays = Math.round((projectedDate - deadline) / oneDay);

    let statusText = '';
    let statusClass = 'ok';

    if (delayDays > 0) {
        statusText = `${delayDays} days delayed`;
        statusClass = 'alert';
    } else if (delayDays < 0) {
        statusText = `${Math.abs(delayDays)} days ahead of deadline`;
        statusClass = 'ok';
    } else {
        statusText = 'On schedule — projected to finish by deadline';
        statusClass = 'ok';
    }

    return {
        hasBottleneck: true,
        bottleneckName: bottleneck.tradeName,
        actual: actual,
        daysElapsed: daysElapsed,
        dailyRate: currentDailyProgressRate,
        remainingDays: remainingDays,
        projectedDate: projectedDate,
        formattedProjectedDate: formattedProjectedDate,
        formattedDeadline: formattedDeadline,
        delayDays: delayDays,
        statusText: statusText,
        statusClass: statusClass,
        isUnavailable: false
    };
}

/**
 * Calculates smart action and manpower recommendations for bottleneck trade.
 * @param {Object} project - Canonical project object
 * @param {Date} [todayDate=new Date()] - Reference today date
 * @returns {Object} Action recommendation
 */
function getRecommendation(project, todayDate = new Date()) {
    if (!project) return null;

    const bottleneck = getProjectBottleneck(project);
    if (!bottleneck) {
        return {
            hasBottleneck: false,
            actionText: "No action required — all trades are on track.",
            isManpower: false
        };
    }

    const trade = bottleneck.trade;
    const tradeName = bottleneck.tradeName;
    const reason = bottleneck.reason;

    const rawPresent = Number(trade.workersPresent ?? trade.workers_present);
    const rawRequired = Number(trade.workersRequired ?? trade.workers_required);
    const workersPresent = (!isNaN(rawPresent) && rawPresent >= 0) ? Math.floor(rawPresent) : 0;
    const workersRequired = (!isNaN(rawRequired) && rawRequired >= 0) ? Math.floor(rawRequired) : 0;

    const start = new Date(project.startDate || project.start_date);
    const deadline = new Date(project.deadline || project.deadlineDate);
    const today = new Date(todayDate);
    const oneDay = 24 * 60 * 60 * 1000;

    const daysElapsed = Math.max(0, Math.round((today - start) / oneDay));
    const daysLeft = Math.round((deadline - today) / oneDay);
    const actual = Math.min(100, Math.max(0, Number(bottleneck.actual) || 0));
    const remainingProgress = Math.max(0, 100 - actual);

    const normReason = reason.trim().toLowerCase();

    if (normReason.includes('labour') || normReason.includes('labor') || normReason.includes('waiting')) {
        if (daysElapsed <= 0 || workersPresent <= 0 || daysLeft <= 0 || actual <= 0) {
            return {
                hasBottleneck: true,
                tradeName: tradeName,
                reason: reason,
                actionText: "Manpower estimate unavailable — insufficient progress history.",
                isManpower: false,
                isUnavailable: true
            };
        }

        const currentProgressPerWorkerPerDay = actual / (daysElapsed * workersPresent);
        const requiredDailyProgress = remainingProgress / daysLeft;
        const requiredWorkers = requiredDailyProgress / Math.max(0.00001, currentProgressPerWorkerPerDay);
        
        let extraWorkers = Math.ceil(requiredWorkers - workersPresent);
        extraWorkers = Math.max(0, extraWorkers);

        const staffingDeficit = Math.max(0, workersRequired - workersPresent);

        const dailyRate = actual / daysElapsed;
        const remainingDays = remainingProgress / Math.max(0.0001, dailyRate);
        const projectedDate = new Date(today.getTime() + (remainingDays * oneDay));
        const delayDays = Math.round((projectedDate - deadline) / oneDay);

        let deadlinePrefix = '';
        let deadlineSupporting = '';

        if (delayDays < 0) {
            const bufferDays = Math.abs(delayDays);
            deadlinePrefix = `Contractual deadline projected to remain protected (${bufferDays}d buffer).`;
            deadlineSupporting = `Current ${workersPresent}-worker crew projects completion ${bufferDays} days ahead of deadline (+${bufferDays}d buffer)`;
        } else if (delayDays === 0) {
            deadlinePrefix = `Completion projected on the contractual deadline (0d buffer).`;
            deadlineSupporting = `Current ${workersPresent}-worker crew projects completion on the contractual deadline (0d buffer)`;
        } else {
            deadlinePrefix = `Contractual deadline at risk (projected ${delayDays}d late).`;
            deadlineSupporting = `Current ${workersPresent}-worker crew projects completion ${delayDays} days late`;
        }

        const depClause = normReason.includes('waiting') ? ' once dependency is cleared' : '';

        let actionText = '';
        let supportingText = '';

        if (staffingDeficit > 0) {
            actionText = `${deadlinePrefix} Evaluate deploying up to ${staffingDeficit} additional qualified workers to ${tradeName}${depClause} to recover planned milestone.`;
            supportingText = `${deadlineSupporting}, but trade operates with a ${staffingDeficit}-worker deficit against scheduled staffing (${workersPresent}/${workersRequired}).`;
        } else if (delayDays > 0) {
            const neededWorkers = extraWorkers > 0 ? extraWorkers : 1;
            actionText = `${deadlinePrefix} Evaluate deploying ${neededWorkers} additional qualified workers to ${tradeName}${depClause} to protect deadline.`;
            supportingText = `${deadlineSupporting}. Trade operates at full planned staffing (${workersPresent}/${workersRequired}), but daily pace is insufficient.`;
        } else {
            actionText = `Maintain current crew of ${workersPresent} workers on ${tradeName}.`;
            supportingText = `${deadlineSupporting}. Trade is operating at full planned staffing (${workersPresent}/${workersRequired}).`;
        }

        return {
            hasBottleneck: true,
            tradeName: tradeName,
            reason: reason,
            actionText: actionText,
            supportingText: supportingText,
            manpowerText: `Current staffing: ${workersPresent} / ${workersRequired} workers (${staffingDeficit > 0 ? `${staffingDeficit} worker staffing deficit` : 'Fully staffed'})`,
            extraWorkers: extraWorkers,
            staffingDeficit: staffingDeficit,
            delayDays: delayDays,
            deadlineBufferDays: delayDays < 0 ? Math.abs(delayDays) : 0,
            workersPresent: workersPresent,
            workersRequired: workersRequired,
            isManpower: true,
            isUnavailable: false
        };
    }

    if (normReason.includes('material')) {
        return {
            hasBottleneck: true,
            tradeName: tradeName,
            reason: reason,
            actionText: "Recommended action: Expedite material delivery.",
            supportingText: "Additional manpower is unlikely to resolve the current constraint.",
            isManpower: false
        };
    }

    if (normReason.includes('rework') || normReason.includes('quality')) {
        return {
            hasBottleneck: true,
            tradeName: tradeName,
            reason: reason,
            actionText: "Recommended action: Resolve rework / quality issue before increasing manpower.",
            isManpower: false
        };
    }

    if (normReason.includes('weather') || normReason.includes('access')) {
        return {
            hasBottleneck: true,
            tradeName: tradeName,
            reason: reason,
            actionText: "Recommended action: Resolve site access / weather constraint.",
            isManpower: false
        };
    }

    return {
        hasBottleneck: true,
        tradeName: tradeName,
        reason: reason,
        actionText: "No additional action required.",
        isManpower: false
    };
}

/**
 * Aggregates portfolio projects and sorts them by risk severity.
 * Sorting order: delayDays descending -> maxGap descending -> original index.
 * @param {Array<Object>} projects - Array of project objects
 * @param {Date} [todayDate=new Date()] - Reference today date
 * @returns {Array<Object>} Sorted portfolio objects
 */
function calculatePortfolioRisk(projects, todayDate = new Date()) {
    if (!Array.isArray(projects)) return [];

    const portfolioData = projects.map((project, originalIndex) => {
        const bottleneck = getProjectBottleneck(project);
        const projection = calculateProjectedCompletion(project, todayDate);

        const delayDays = (projection && !projection.isUnavailable) ? projection.delayDays : 0;
        const bottleneckName = bottleneck ? bottleneck.tradeName : 'None';
        const bottleneckReason = bottleneck ? bottleneck.reason : 'On Track';
        const maxGap = bottleneck ? bottleneck.gapPercentage : 0;

        const formattedProjectedDate = projection ? projection.formattedProjectedDate : 'On track';
        const deadlineDateObj = new Date(project.deadline || project.deadlineDate || project.start_date);
        const formattedDeadline = projection ? projection.formattedDeadline : deadlineDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const statusText = projection ? projection.statusText : 'On track';

        return {
            id: project.id,
            name: project.name,
            city: project.city || project.location,
            originalIndex,
            bottleneckName,
            bottleneckReason,
            maxGap,
            delayDays,
            projectedDateStr: formattedProjectedDate,
            deadlineStr: formattedDeadline,
            statusText,
            needsUrgentManpower: delayDays > 3
        };
    });

    portfolioData.sort((a, b) => {
        if (b.delayDays !== a.delayDays) {
            return b.delayDays - a.delayDays;
        }
        if (b.maxGap !== a.maxGap) {
            return b.maxGap - a.maxGap;
        }
        return a.originalIndex - b.originalIndex;
    });

    return portfolioData;
}

module.exports = {
    calculateProjectMetrics,
    getProjectBottleneck,
    calculateProjectedCompletion,
    getRecommendation,
    calculatePortfolioRisk
};
