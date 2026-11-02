/**
 * SitePulse — Phase 4 ML Integration & Safety Guardrail Tests
 * ============================================================
 * Tests:
 *   1. Health Check & ML Service Status
 *   2. Authentication enforcement on ML endpoints (401 on missing token)
 *   3. Multi-Tenant Organization Isolation (Cross-org requests return 404)
 *   4. Strict Input Validation (invalid/empty IDs)
 *   5. Anomaly Detection Schema & Disclaimer Verification
 *   6. Delay Risk Classification Schema & Calibration Verification
 *   7. Human-Readable Explainability & Factor Attribution
 *   8. Model Failure Fallback (FastAPI offline resilience)
 *   9. Non-Intervention Safety Guarantee (Read-only execution)
 *  10. Insufficient Project History Handling (Graceful degradation)
 *  11. Phantom Workforce Partial vs Full Workforce Explanation Audit
 *  12. Feature Attribution Mathematical Sign Verification in Fallback
 */

process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/db/client');

let server = null;
let baseUrl = '';

test.before((t, done) => {
    server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        done();
    });
});

test.after((t, done) => {
    if (server) {
        server.close(done);
    } else {
        done();
    }
});

async function makeRequest(path, options = {}) {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, options);
    const text = await res.text();
    let body = null;
    try {
        body = JSON.parse(text);
    } catch (e) {
        body = text;
    }
    return { status: res.status, headers: res.headers, body };
}

test('1. GET /health includes ML Inference Service status', async () => {
    const res = await makeRequest('/health');
    assert.equal(res.status, 200);
    assert.ok(['ok', 'degraded'].includes(res.body.status));
    assert.ok(res.body.ml_service, 'ml_service object must be returned in health response');
    assert.ok(
        ['online', 'offline', 'fallback_heuristic_active'].includes(res.body.ml_service.status) || res.body.ml_service.mode,
        'ml_service status must be recognized'
    );
});

test('2. Authentication: Unauthenticated requests to ML endpoints return 401', async () => {
    // 2a. Anomaly endpoint
    const resAnom = await makeRequest('/projects/prj-biryani-blues/anomalies');
    assert.equal(resAnom.status, 401);
    assert.equal(resAnom.body.error.code, 'UNAUTHENTICATED');

    // 2b. Risk score endpoint
    const resRisk = await makeRequest('/projects/prj-biryani-blues/risk-score');
    assert.equal(resRisk.status, 401);
    assert.equal(resRisk.body.error.code, 'UNAUTHENTICATED');
});

test('3. Organization Isolation: Cross-tenant access strictly returns 404 PROJECT_NOT_FOUND', async () => {
    // Other Org user attempting to query Apex Retail project
    const resAnomCross = await makeRequest('/projects/prj-biryani-blues/anomalies', {
        headers: { 'Authorization': 'Bearer mock-token-other-org' }
    });
    assert.equal(resAnomCross.status, 404);
    assert.equal(resAnomCross.body.error.code, 'PROJECT_NOT_FOUND');

    const resRiskCross = await makeRequest('/projects/prj-biryani-blues/risk-score', {
        headers: { 'Authorization': 'Bearer mock-token-other-org' }
    });
    assert.equal(resRiskCross.status, 404);
    assert.equal(resRiskCross.body.error.code, 'PROJECT_NOT_FOUND');

    // Apex Retail user attempting to query Other Org project
    const resOtherOrg = await makeRequest('/projects/prj-other-org/risk-score', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(resOtherOrg.status, 404);
    assert.equal(resOtherOrg.body.error.code, 'PROJECT_NOT_FOUND');
});

test('4. Input Validation: Invalid or missing project IDs return structured error', async () => {
    const resInvalid = await makeRequest('/projects/prj-non-existent-999/anomalies', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(resInvalid.status, 404);
    assert.equal(resInvalid.body.error.code, 'PROJECT_NOT_FOUND');
});

test('5. GET /projects/:id/anomalies returns compliant schema with synthetic data disclaimer', async () => {
    const res = await makeRequest('/projects/prj-chai-point/anomalies', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.project_id, 'prj-chai-point');
    assert.equal(typeof res.body.anomalies_detected_count, 'number');
    assert.ok(Array.isArray(res.body.anomalies));
    assert.equal(res.body.is_experimental_synthetic, true);
    assert.ok(res.body.disclaimer.includes('synthetic simulation data'));
    assert.ok(['active', 'fallback_heuristic'].includes(res.body.model_status));

    // If anomalies detected, check structure
    if (res.body.anomalies.length > 0) {
        const a = res.body.anomalies[0];
        assert.ok(a.trade_id);
        assert.ok(typeof a.anomaly_score === 'number');
        assert.ok(['Low', 'Medium', 'High', 'Critical'].includes(a.severity));
        assert.ok(a.category);
        assert.ok(typeof a.explanation === 'string');
        assert.ok(a.supporting_features);
    }
});

test('6. GET /projects/:id/risk-score returns calibrated probabilities and threshold metadata', async () => {
    const res = await makeRequest('/projects/prj-biryani-blues/risk-score', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.project_id, 'prj-biryani-blues');
    assert.ok(res.body.delay_risk_score >= 0.0 && res.body.delay_risk_score <= 1.0);
    assert.equal(typeof res.body.predicted_delay_over_3d, 'boolean');
    assert.equal(res.body.decision_threshold, 0.57);
    assert.ok(['Low', 'Moderate', 'High', 'Critical'].includes(res.body.risk_category));
    assert.equal(res.body.is_experimental_synthetic, true);
    assert.ok(res.body.disclaimer.includes('synthetic simulation data'));
    assert.ok(Array.isArray(res.body.top_factors));
    assert.ok(Array.isArray(res.body.explanations));
    assert.ok(res.body.feature_values);
    assert.equal(typeof res.body.feature_values.schedule_variance_pct, 'number');
    assert.equal(typeof res.body.feature_values.required_daily_velocity, 'number');
});

test('7. Explainability: Elevated risk produces actionable natural language explanations', async () => {
    // Chai Point is delayed due to switchgear material delay and schedule variance
    const res = await makeRequest('/projects/prj-chai-point/risk-score', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.explanations.length > 0, 'Must produce explanation points');

    // Confirm explanations only reference prediction-time indicators
    for (const exp of res.body.explanations) {
        assert.ok(typeof exp === 'string');
        assert.ok(exp.length > 10);
        // Ensure no post-cutoff or future-leakage words appear
        assert.ok(!exp.includes('actual_completion_date'));
        assert.ok(!exp.includes('scenario_id'));
    }
});

test('8. Model Failure Fallback: Domain heuristic activates when FastAPI is unreachable', async () => {
    const mlService = require('../src/services/mlInferenceService');

    // Test fallback anomaly calculation directly
    const mockAnomalyRecord = {
        trade_id: 'trd-mock',
        trade_name: 'Mock Trade',
        daily_delta_pct: 18.0,
        workers_present: 5,
        workers_required: 5,
        consecutive_stagnant: 0,
        has_active_hold: 0,
        reason: 'On Track'
    };
    const fallbackAnomaly = mlService.fallbackScoreAnomaly(mockAnomalyRecord);
    assert.equal(fallbackAnomaly.is_anomaly, true);
    assert.equal(fallbackAnomaly.category, 'implausible_progress_spike');
    assert.equal(fallbackAnomaly.severity, 'Critical');

    // Test fallback risk calculation directly
    const mockFeatures = {
        project_id: 'prj-mock-fallback',
        schedule_variance_pct: -20.0,
        required_daily_velocity: 3.5,
        workforce_fulfillment_ratio: 0.55,
        velocity_health_ratio: 0.40,
        active_delay_events_count: 2
    };
    const fallbackRisk = mlService.fallbackPredictProjectRisk(mockFeatures);
    assert.equal(fallbackRisk.model_status, 'fallback_heuristic');
    assert.equal(fallbackRisk.predicted_delay_over_3d, true);
    assert.ok(fallbackRisk.delay_risk_score >= 0.57);
    assert.equal(fallbackRisk.is_experimental_synthetic, true);
});

test('9. Non-Intervention Safety Guarantee: Predictions do not alter database or project state', async () => {
    // Verify initial project status
    const initialProject = db.store.projects.find(p => p.id === 'prj-chai-point');
    const initialStatus = initialProject.status;
    const initialUpdatesCount = db.store.daily_updates.length;

    // Execute multiple ML inference queries
    await makeRequest('/projects/prj-chai-point/anomalies', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    await makeRequest('/projects/prj-chai-point/risk-score', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });

    // Verify state is completely unchanged (read-only decision support)
    const postProject = db.store.projects.find(p => p.id === 'prj-chai-point');
    assert.equal(postProject.status, initialStatus, 'Project status must remain unchanged by ML inference');
    assert.equal(db.store.daily_updates.length, initialUpdatesCount, 'No automatic daily updates may be generated by ML');
});

test('10. Insufficient Project History Handling: Project with no trades returns explicit unavailable status', async () => {
    // Add empty project with no trades to in-memory store
    const emptyProjId = 'prj-empty-no-trades';
    db.store.projects.push({
        id: emptyProjId,
        organization_id: 'org-apex-retail',
        store_id: 'str-bb-cyberhub',
        name: 'Empty Shell Store',
        location: 'Gurugram',
        start_date: '2026-10-01',
        deadline: '2026-11-15',
        status: 'planning'
    });

    try {
        const resRisk = await makeRequest(`/projects/${emptyProjId}/risk-score`, {
            headers: { 'Authorization': 'Bearer mock-token-admin' }
        });
        assert.equal(resRisk.status, 200);
        assert.equal(resRisk.body.model_status, 'insufficient_history');
        assert.equal(resRisk.body.delay_risk_score, null);
        assert.equal(resRisk.body.predicted_delay_over_3d, null);
        assert.ok(resRisk.body.message.includes('no configured trades'));
        assert.equal(resRisk.body.is_experimental_synthetic, true);

        const resAnom = await makeRequest(`/projects/${emptyProjId}/anomalies`, {
            headers: { 'Authorization': 'Bearer mock-token-admin' }
        });
        assert.equal(resAnom.status, 200);
        assert.equal(resAnom.body.model_status, 'insufficient_history');
        assert.equal(resAnom.body.total_analyzed, 0);
        assert.equal(resAnom.body.anomalies_detected_count, 0);
    } finally {
        // Clean up mock project
        const idx = db.store.projects.findIndex(p => p.id === emptyProjId);
        if (idx !== -1) db.store.projects.splice(idx, 1);
    }
});

test('11. Phantom Workforce Explanation: Correctly distinguishes partial vs full workforce', async () => {
    const mlService = require('../src/services/mlInferenceService');

    // 11a. Partial workforce presence (4 present < 9 required)
    const partialRecord = {
        trade_id: 'trd-elec',
        trade_name: 'Electrical',
        daily_delta_pct: 0.0,
        workers_present: 4,
        workers_required: 9,
        consecutive_stagnant: 2,
        has_active_hold: 0,
        reason: 'On Track'
    };
    const resPartial = mlService.fallbackScoreAnomaly(partialRecord);
    assert.equal(resPartial.is_anomaly, true);
    assert.equal(resPartial.category, 'phantom_workforce');
    assert.ok(!resPartial.explanation.includes('Full workforce'), 'Must NOT call 4/9 workers a full workforce');
    assert.ok(resPartial.explanation.includes('Active workforce presence (4 workers logged, required: 9)'));

    // 11b. Full workforce presence (8 present >= 8 required)
    const fullRecord = {
        trade_id: 'trd-elec',
        trade_name: 'Electrical',
        daily_delta_pct: 0.0,
        workers_present: 8,
        workers_required: 8,
        consecutive_stagnant: 2,
        has_active_hold: 0,
        reason: 'On Track'
    };
    const resFull = mlService.fallbackScoreAnomaly(fullRecord);
    assert.equal(resFull.is_anomaly, true);
    assert.ok(resFull.explanation.includes('Full workforce (8/8 workers logged)'));
});

test('12. Feature Attribution Sign Verification: schedule_variance_pct has negative coefficient', async () => {
    const mlService = require('../src/services/mlInferenceService');

    const mockFeatures = {
        project_id: 'prj-test-signs',
        schedule_variance_pct: -14.2,
        required_daily_velocity: 2.8,
        workforce_fulfillment_ratio: 0.65,
        velocity_health_ratio: 0.50,
        active_delay_events_count: 1
    };
    const riskResult = mlService.fallbackPredictProjectRisk(mockFeatures);
    assert.ok(Array.isArray(riskResult.top_factors));

    const varFactor = riskResult.top_factors.find(f => f.feature === 'schedule_variance_pct');
    assert.ok(varFactor, 'schedule_variance_pct must be present in top factors');
    assert.equal(varFactor.coefficient, -1.2735, 'Coefficient must carry negative sign (-1.2735)');
});
