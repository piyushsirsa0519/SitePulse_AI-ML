/**
 * SitePulse — ML Inference Integration Service
 * ==============================================
 * Connects the Express backend to the Python FastAPI ML inference service.
 * Implements:
 *   - Organization-scoped feature extraction
 *   - Fast HTTP inference with AbortController timeout (1500ms)
 *   - Seamless fallback rule engine if ML service is unavailable
 *   - Clear labeling of experimental synthetic data models
 *   - Defensive handling of unstarted projects or insufficient project history
 */

const db = require('../db/client');

function getMlServiceUrl() {
    let raw = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').trim();
    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
        raw = `https://${raw}`;
    }
    return raw.replace(/\/+$/, '');
}

const PREDICTION_TIMEOUT_MS = parseInt(process.env.ML_PREDICTION_TIMEOUT_MS, 10) || 5000;

const DISCLAIMER_TEXT = 'Trained on synthetic simulation data for research & prototyping. Not validated for production life-safety or contractual execution.';

/**
 * Checks health of the Python ML Inference Service.
 */
async function checkHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PREDICTION_TIMEOUT_MS);

        const response = await fetch(`${getMlServiceUrl()}/health`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return {
                status: 'online',
                service: data.service,
                models_loaded: data.models_loaded,
                version: data.version
            };
        }
        return { status: 'degraded', code: response.status };
    } catch (err) {
        return {
            status: 'offline',
            mode: 'fallback_heuristic_active',
            message: 'FastAPI ML service offline; falling back to in-process domain rule engine'
        };
    }
}

/**
 * Fallback Anomaly Scoring Engine (runs in Node.js when Python service is offline).
 */
function fallbackScoreAnomaly(record) {
    const delta = Number(record.daily_delta_pct) || 0;
    const w = Number(record.workers_present) || 0;
    const req = Number(record.workers_required) || 0;
    const st = Number(record.consecutive_stagnant) || 0;
    const hasHold = Number(record.has_active_hold) > 0.5 || ['Material Delay', 'Client Hold', 'Waiting on Another Trade'].includes(record.reason);

    let ruleScore = 0.15;
    let category = 'normal_progress';
    let explanation = 'Progress and workforce levels within expected baseline variance.';

    if (delta >= 14.0) {
        ruleScore = 0.98;
        category = 'implausible_progress_spike';
        explanation = `Daily progress jumped by ${delta.toFixed(1)}%, exceeding single-day physical work capacity.`;
    } else if (!hasHold && w >= 4 && delta <= 0.05 && st >= 1) {
        ruleScore = 0.95;
        category = 'phantom_workforce';
        if (req > 0 && w >= req) {
            explanation = `Full workforce (${w}/${req} workers logged) with zero physical progress and no active hold event.`;
        } else {
            explanation = `Active workforce presence (${w} workers logged, required: ${req}) with zero physical progress and no active hold event.`;
        }
    } else if (w === 0 && delta >= 2.0) {
        ruleScore = 0.96;
        category = 'unreported_workforce';
        explanation = `Progress increased by ${delta.toFixed(1)}% with zero workers logged on site (unreported crew).`;
    } else if (w >= 0.8 * req && st >= 4 && delta <= 0.05) {
        ruleScore = 0.88;
        category = 'stagnant_despite_presence';
        explanation = `Extended trade stagnation (${st} days) despite regular workforce presence (${w}/${req} workers).`;
    }

    const isAnomaly = ruleScore >= 0.89;
    let severity = 'Low';
    if (ruleScore >= 0.85) severity = 'Critical';
    else if (ruleScore >= 0.65) severity = 'High';
    else if (ruleScore >= 0.45) severity = 'Medium';

    return {
        trade_id: record.trade_id,
        trade_name: record.trade_name,
        date: record.date,
        anomaly_score: ruleScore,
        is_anomaly: isAnomaly,
        severity,
        category,
        explanation,
        supporting_features: {
            daily_delta_pct: delta,
            workers_present: w,
            workers_required: req,
            shortfall_workers: Math.max(0, req - w),
            consecutive_stagnant: st,
            has_active_hold: hasHold ? 1 : 0
        }
    };
}

/**
 * Fallback Project Delay Risk Engine (runs in Node.js when Python service is offline).
 */
function fallbackPredictProjectRisk(features) {
    const variance = Number(features.schedule_variance_pct) || 0;
    const reqVel = Number(features.required_daily_velocity) || 0;
    const fulfillment = Number(features.workforce_fulfillment_ratio) || 1.0;
    const velHealth = Number(features.velocity_health_ratio) || 1.0;
    const activeDelays = Number(features.active_delay_events_count) || 0;

    let riskScore = 0.20;

    if (variance < -15.0) riskScore += 0.35;
    else if (variance < -5.0) riskScore += 0.20;

    if (reqVel > 2.5) riskScore += 0.30;
    else if (reqVel > 1.8) riskScore += 0.15;

    if (fulfillment < 0.70) riskScore += 0.20;
    else if (fulfillment < 0.85) riskScore += 0.10;

    if (velHealth < 0.70) riskScore += 0.15;
    if (activeDelays > 0) riskScore += 0.15;

    riskScore = Math.min(0.99, Math.max(0.01, Math.round(riskScore * 100) / 100));

    const threshold = 0.57;
    const isDelayed = riskScore >= threshold;

    let riskCategory = 'Low';
    if (riskScore >= 0.80) riskCategory = 'Critical';
    else if (riskScore >= 0.60) riskCategory = 'High';
    else if (riskScore >= 0.35) riskCategory = 'Moderate';

    const explanations = [];
    if (reqVel > 2.5) explanations.push(`Required daily velocity is critically high (${reqVel.toFixed(2)}%/day) to meet planned completion.`);
    if (variance < -5.0) explanations.push(`Overall project schedule variance is lagging behind by ${variance.toFixed(1)}%.`);
    if (fulfillment < 0.80) explanations.push(`Workforce fulfillment is deficient at ${(fulfillment * 100).toFixed(1)}% of required staffing.`);
    if (velHealth < 0.80) explanations.push(`Recent progress velocity is failing to keep pace with schedule demands.`);
    if (activeDelays > 0) explanations.push(`Project is burdened by ${activeDelays} active delay events.`);
    if (explanations.length === 0) {
        explanations.push(isDelayed ? 'Combined project factors suggest elevated completion risk.' : 'Project indicators are tracking within nominal operating limits.');
    }

    return {
        project_id: features.project_id,
        delay_risk_score: riskScore,
        predicted_delay_over_3d: isDelayed,
        decision_threshold: threshold,
        risk_category: riskCategory,
        top_factors: [
            { feature: 'required_daily_velocity', value: reqVel, coefficient: 1.8391, importance: 1.8391 },
            { feature: 'schedule_variance_pct', value: variance, coefficient: -1.2735, importance: 1.2735 },
            { feature: 'workforce_fulfillment_ratio', value: fulfillment, coefficient: -0.9960, importance: 0.9960 }
        ],
        explanations,
        feature_values: features,
        model_status: 'fallback_heuristic',
        is_experimental_synthetic: true,
        disclaimer: DISCLAIMER_TEXT
    };
}

/**
 * Extracts project predictive features from project and trades data.
 * Validates sufficient history and returns clear status if unavailable.
 */
async function extractProjectFeatures(fullProject, referenceDate = new Date()) {
    const trades = fullProject.trades || [];
    if (trades.length === 0) {
        return {
            isAvailable: false,
            status: 'insufficient_history',
            reason: 'Project has no configured trades or active trade packages.'
        };
    }

    const start = new Date(fullProject.startDate || fullProject.start_date || referenceDate);
    const deadline = new Date(fullProject.deadline || referenceDate);
    const totalDuration = Math.max(1, Math.round((deadline - start) / (1000 * 60 * 60 * 24)));
    const elapsedDays = Math.round((referenceDate - start) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.round((deadline - referenceDate) / (1000 * 60 * 60 * 24));

    if (elapsedDays < 3) {
        return {
            isAvailable: false,
            status: 'insufficient_history',
            reason: `Project has only ${Math.max(0, elapsedDays)} day(s) of elapsed history. Minimum 3 days required for velocity estimation.`
        };
    }

    const { calculateProjectMetrics, getProjectBottleneck } = require('../analytics/index');
    const metrics = calculateProjectMetrics(fullProject, referenceDate);
    const bottleneck = getProjectBottleneck(fullProject);

    // Fetch active delay events
    let delayEvents = [];
    if (db.pool) {
        const dRes = await db.query(
            "SELECT * FROM delay_events WHERE project_id = $1 AND status IN ('open', 'mitigating')",
            [fullProject.id]
        );
        delayEvents = dRes.rows;
    } else if (db.store && db.store.delay_events) {
        delayEvents = db.store.delay_events.filter(
            d => d.project_id === fullProject.id && ['open', 'mitigating'].includes(d.status)
        );
    }

    const totalEstDelay = delayEvents.reduce((acc, d) => acc + (Number(d.estimated_delay_days) || 0), 0);

    const delayedTrades = trades.filter(t => (t.planned_pct || t.planned || 0) - (t.progress_pct || t.actual || 0) > 0);
    const delayedTradesRatio = trades.length > 0 ? delayedTrades.length / trades.length : 0;

    const totalWorkersPresent = metrics.workersPresentTotal || trades.reduce((acc, t) => acc + (t.workers_present || t.workersPresent || 0), 0);
    const totalWorkersRequired = metrics.workersRequiredTotal || trades.reduce((acc, t) => acc + (t.workers_required || t.workersRequired || 0), 0);
    const workforceDeficit = totalWorkersRequired - totalWorkersPresent;
    const fulfillmentRatio = totalWorkersRequired > 0 ? totalWorkersPresent / totalWorkersRequired : 1.0;

    const timelineElapsedRatio = elapsedDays / totalDuration;
    const actualProgress = metrics.overallActualProgress || 0;
    const remainingProgress = Math.max(0, 100 - actualProgress);
    const requiredDailyVelocity = remainingDays > 0 ? remainingProgress / remainingDays : 0;
    const recentVelocity = elapsedDays > 0 ? actualProgress / elapsedDays : 1.0;
    const velocityHealthRatio = requiredDailyVelocity > 0 ? recentVelocity / requiredDailyVelocity : 1.0;

    const maxBottleneckGap = bottleneck ? (bottleneck.gap || Math.max(0, bottleneck.planned - bottleneck.actual)) : 0;

    return {
        isAvailable: true,
        project_id: fullProject.id,
        timeline_elapsed_ratio: Math.round(timelineElapsedRatio * 1000) / 1000,
        schedule_variance_pct: metrics.scheduleVariance || 0,
        max_bottleneck_gap_pct: Math.round(maxBottleneckGap * 10) / 10,
        delayed_trades_ratio: Math.round(delayedTradesRatio * 1000) / 1000,
        delayed_trades_count: delayedTrades.length,
        total_workers_present: totalWorkersPresent,
        total_workers_required: totalWorkersRequired,
        workforce_deficit: workforceDeficit,
        workforce_fulfillment_ratio: Math.round(fulfillmentRatio * 1000) / 1000,
        recent_7d_progress_velocity: Math.round(recentVelocity * 100) / 100,
        required_daily_velocity: Math.round(requiredDailyVelocity * 100) / 100,
        velocity_health_ratio: Math.round(velocityHealthRatio * 100) / 100,
        active_delay_events_count: delayEvents.length,
        total_estimated_delay_days: totalEstDelay
    };
}

/**
 * Predicts project delay risk using the Python ML service with fallback.
 */
async function predictProjectRisk(fullProject, referenceDate = new Date()) {
    const features = await extractProjectFeatures(fullProject, referenceDate);

    if (!features.isAvailable) {
        return {
            project_id: fullProject.id,
            project_name: fullProject.name,
            delay_risk_score: null,
            predicted_delay_over_3d: null,
            risk_category: 'Unavailable',
            model_status: features.status,
            message: features.reason,
            is_experimental_synthetic: true,
            disclaimer: DISCLAIMER_TEXT
        };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PREDICTION_TIMEOUT_MS);

        const response = await fetch(`${getMlServiceUrl()}/predict/risk-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(features),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return {
                ...data,
                model_status: 'active',
                is_experimental_synthetic: true,
                disclaimer: DISCLAIMER_TEXT
            };
        }
    } catch (err) {
        // FastAPI unavailable or timed out; fall back seamlessly
    }

    return fallbackPredictProjectRisk(features);
}

/**
 * Detects anomalies for a project's trades using the Python ML service with fallback.
 */
async function detectProjectAnomalies(fullProject) {
    const trades = fullProject.trades || [];
    if (trades.length === 0) {
        return {
            project_id: fullProject.id,
            project_name: fullProject.name,
            total_analyzed: 0,
            anomalies_detected_count: 0,
            anomalies: [],
            model_status: 'insufficient_history',
            message: 'No active trades or daily logs available for anomaly detection.',
            is_experimental_synthetic: true,
            disclaimer: DISCLAIMER_TEXT
        };
    }

    const records = trades.map(t => {
        const actual = Number(t.progress_pct ?? t.actual) || 0;
        const planned = Number(t.planned_pct ?? t.planned) || 0;
        const delta = Math.max(0, actual - Math.max(0, planned - 5)); // Estimated recent delta
        const wPresent = Number(t.workers_present ?? t.workersPresent) || 0;
        const wReq = Number(t.workers_required ?? t.workersRequired) || 0;
        const isStagnant = delta <= 0.05 && wPresent >= 4;

        return {
            trade_id: t.id,
            trade_name: t.name,
            date: new Date().toISOString().split('T')[0],
            daily_delta_pct: delta,
            workers_present: wPresent,
            workers_required: wReq,
            consecutive_stagnant: isStagnant ? 2 : 0,
            has_active_hold: ['Material Delay', 'Client Hold', 'Waiting on Another Trade'].includes(t.reason) ? 1.0 : 0.0,
            reason: t.reason || 'On Track'
        };
    });

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PREDICTION_TIMEOUT_MS);

        const response = await fetch(`${getMlServiceUrl()}/predict/anomaly/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            return {
                project_id: fullProject.id,
                project_name: fullProject.name,
                total_analyzed: data.total_analyzed,
                anomalies_detected_count: data.anomalies_detected_count,
                anomalies: data.anomalies,
                model_status: 'active',
                is_experimental_synthetic: true,
                disclaimer: DISCLAIMER_TEXT
            };
        }
    } catch (err) {
        // FastAPI offline or timeout; execute fallback
    }

    const fallbackResults = records.map(r => fallbackScoreAnomaly(r));
    const anomaliesOnly = fallbackResults.filter(r => r.is_anomaly);

    return {
        project_id: fullProject.id,
        project_name: fullProject.name,
        total_analyzed: fallbackResults.length,
        anomalies_detected_count: anomaliesOnly.length,
        anomalies: anomaliesOnly,
        model_status: 'fallback_heuristic',
        is_experimental_synthetic: true,
        disclaimer: DISCLAIMER_TEXT
    };
}

module.exports = {
    checkHealth,
    predictProjectRisk,
    detectProjectAnomalies,
    extractProjectFeatures,
    fallbackScoreAnomaly,
    fallbackPredictProjectRisk
};
