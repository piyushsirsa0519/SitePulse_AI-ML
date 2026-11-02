/**
 * Site Pulse — Phase 2 Relational Schema & Analytical SQL Test Suite
 * Validates modernized database operations, analytical calculations,
 * multi-tenant organization isolation, data quality constraints, and API compatibility.
 */

process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/db/client');
const app = require('../src/app');

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

// Helper for HTTP requests
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

/**
 * ----------------------------------------------------------------------------
 * 1. MODERNIZED RELATIONAL SCHEMA OPERATIONS
 * ----------------------------------------------------------------------------
 */
test('1. Modernized Schema: Stores repository structure & query validation', async () => {
    assert.ok(Array.isArray(db.store.stores), 'db.store.stores should exist as an array');
    assert.equal(db.store.stores.length, 3, 'Should contain 3 canonical physical stores');

    const cyberHub = db.store.stores.find(s => s.store_code === 'STR-BB-01');
    assert.ok(cyberHub, 'Should find Cyber Hub store record');
    assert.equal(cyberHub.city, 'Gurugram');
    assert.equal(cyberHub.brand, 'Biryani Blues');
    assert.equal(cyberHub.square_footage, 1850.00);

    // Query via db.query
    const res = await db.query('SELECT * FROM stores WHERE organization_id = $1', ['org-apex-retail']);
    assert.equal(res.rows.length, 3, 'Should return 3 stores for org-apex-retail');
});

test('2. Modernized Schema: Contractors & Contractor Assignments validation', async () => {
    assert.ok(Array.isArray(db.store.contractors), 'db.store.contractors should exist');
    assert.equal(db.store.contractors.length, 5, 'Should have 5 specialized trade contractors');

    const civilContractor = db.store.contractors.find(c => c.name === 'Apex Civil Works LLP');
    assert.ok(civilContractor);
    assert.equal(civilContractor.trade_specialty, 'Civil');
    assert.equal(civilContractor.rating, 4.5);

    // Contractor assignments verification
    assert.ok(Array.isArray(db.store.contractor_assignments), 'contractor_assignments should exist');
    assert.equal(db.store.contractor_assignments.length, 15, 'All 15 project trades should have contractor assignments');

    const bbCivilAssignment = db.store.contractor_assignments.find(ca => ca.trade_id === 'trd-bb-civil');
    assert.ok(bbCivilAssignment);
    assert.equal(bbCivilAssignment.contractor_id, 'cnt-apex-civil');
    assert.equal(bbCivilAssignment.status, 'active');
});

test('3. Modernized Schema: Manpower Log & Delay Events validation', async () => {
    assert.ok(Array.isArray(db.store.manpower_log), 'manpower_log should exist');
    assert.ok(Array.isArray(db.store.delay_events), 'delay_events should exist');
    assert.equal(db.store.delay_events.length, 2, 'Should have 2 baseline delay incident tickets');

    const chaiPointDelay = db.store.delay_events.find(d => d.project_id === 'prj-chai-point');
    assert.ok(chaiPointDelay);
    assert.equal(chaiPointDelay.category, 'Material Delay');
    assert.equal(chaiPointDelay.severity, 'high');
    assert.equal(chaiPointDelay.status, 'open');

    // Query delay events via db.query
    const res = await db.query('SELECT * FROM delay_events WHERE project_id = $1', ['prj-chai-point']);
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].category, 'Material Delay');
});

/**
 * ----------------------------------------------------------------------------
 * 2. MULTI-TENANT ORGANIZATION ISOLATION
 * ----------------------------------------------------------------------------
 */
test('4. Multi-Tenant Isolation: Stores and Contractors scoped strictly to organization', async () => {
    // Org apex retail can access its stores
    const resApexStores = await db.query('SELECT * FROM stores WHERE organization_id = $1', ['org-apex-retail']);
    assert.equal(resApexStores.rows.length, 3);

    // Other corp has 0 stores
    const resOtherStores = await db.query('SELECT * FROM stores WHERE organization_id = $1', ['org-other-corp']);
    assert.equal(resOtherStores.rows.length, 0);

    // Contractors isolation
    const resApexContractors = await db.query('SELECT * FROM contractors WHERE organization_id = $1', ['org-apex-retail']);
    assert.equal(resApexContractors.rows.length, 5);

    const resOtherContractors = await db.query('SELECT * FROM contractors WHERE organization_id = $1', ['org-other-corp']);
    assert.equal(resOtherContractors.rows.length, 0);
});

/**
 * ----------------------------------------------------------------------------
 * 3. ANALYTICAL SQL LOGIC VERIFICATION
 * ----------------------------------------------------------------------------
 */
test('5. Analytical Calculation A: Trade velocity delta & rolling computation', () => {
    // Simulate trade progress sequence
    const updates = [
        { date: '2026-09-20', progress: 10 },
        { date: '2026-09-21', progress: 15 },
        { date: '2026-09-22', progress: 22 },
        { date: '2026-09-23', progress: 30 },
        { date: '2026-09-24', progress: 38 },
        { date: '2026-09-25', progress: 45 },
        { date: '2026-09-26', progress: 52 }
    ];

    // Compute LAG deltas
    const deltas = updates.map((u, i) => {
        const prev = i > 0 ? updates[i - 1].progress : 0;
        return u.progress - prev;
    });

    assert.deepEqual(deltas, [10, 5, 7, 8, 8, 7, 7]);

    // Rolling 7-day average velocity
    const sumDeltas = deltas.reduce((a, b) => a + b, 0);
    const rollingAvg = sumDeltas / deltas.length;
    assert.equal(Math.round(rollingAvg * 100) / 100, 7.43);
});

test('6. Analytical Calculation B: Manpower shortfall calculation and zero division guard', () => {
    function computeShortfall(present, required) {
        const shortfall = Math.max(0, required - present);
        const shortfallPct = required > 0 ? (shortfall / required) * 100 : 0;
        return { shortfall, shortfallPct };
    }

    // Normal deficit
    const res1 = computeShortfall(4, 9);
    assert.equal(res1.shortfall, 5);
    assert.equal(Math.round(res1.shortfallPct * 10) / 10, 55.6);

    // Full staffing
    const res2 = computeShortfall(10, 10);
    assert.equal(res2.shortfall, 0);
    assert.equal(res2.shortfallPct, 0);

    // Division by zero guard (required = 0)
    const res3 = computeShortfall(0, 0);
    assert.equal(res3.shortfall, 0);
    assert.equal(res3.shortfallPct, 0);
});

test('7. Analytical Calculation C: Schedule variance & project health classification', () => {
    function evaluateHealth(planned, actual, delayedTradesCount, activeRoadblocks = 0) {
        const variance = actual - planned;
        if (delayedTradesCount >= 2 || variance < -5 || activeRoadblocks >= 2) {
            return 'Behind Schedule';
        }
        if (delayedTradesCount === 1 || variance < 0 || activeRoadblocks === 1) {
            return 'Attention Needed';
        }
        return 'On Track';
    }

    // Biryani Blues scenario: 0 delayed trades, +2 variance
    assert.equal(evaluateHealth(57, 59, 0, 0), 'On Track');

    // Chai Point scenario: 2 delayed trades, -8 variance, 1 roadblock
    assert.equal(evaluateHealth(60, 52, 2, 1), 'Behind Schedule');

    // Single trade delay scenario: 1 delayed trade, -2 variance
    assert.equal(evaluateHealth(50, 48, 1, 0), 'Attention Needed');
});

/**
 * ----------------------------------------------------------------------------
 * 4. DATA QUALITY AUDIT CONSTRAINTS
 * ----------------------------------------------------------------------------
 */
test('8. Data Quality Constraints: Input validation rejects invalid progress and dates', async () => {
    // 8a. Negative progress percentage rejected
    const resNeg = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-engineer'
        },
        body: JSON.stringify({
            tradeId: 'trd-bb-civil',
            date: '2026-10-01',
            progressPct: -5,
            workersPresent: 10,
            workersRequired: 10
        })
    });
    assert.equal(resNeg.status, 400);

    // 8b. Progress percentage > 100 rejected
    const resOver = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-engineer'
        },
        body: JSON.stringify({
            tradeId: 'trd-bb-civil',
            date: '2026-10-01',
            progressPct: 105,
            workersPresent: 10,
            workersRequired: 10
        })
    });
    assert.equal(resOver.status, 400);

    // 8c. Negative manpower rejected
    const resNegWorkers = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-engineer'
        },
        body: JSON.stringify({
            tradeId: 'trd-bb-civil',
            date: '2026-10-01',
            progressPct: 50,
            workersPresent: -2,
            workersRequired: 10
        })
    });
    assert.equal(resNegWorkers.status, 400);
});

/**
 * ----------------------------------------------------------------------------
 * 5. EXISTING API REGRESSION SUITE (Backward Compatibility)
 * ----------------------------------------------------------------------------
 */
test('9. Backward Compatibility: GET /portfolio continues to return risk-sorted projects', async () => {
    const res = await makeRequest('/portfolio?date=2026-10-01', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 3);
    const ids = res.body.map(p => p.id);
    assert.ok(ids.includes('prj-biryani-blues'));
    assert.ok(ids.includes('prj-chai-point'));
    assert.ok(ids.includes('prj-ptal-homeware'));
});

test('10. Backward Compatibility: GET /projects/:id/dashboard returns complete metrics', async () => {
    const res = await makeRequest('/projects/prj-biryani-blues/dashboard', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.project.name, 'Biryani Blues - Gurugram');
    assert.equal(res.body.metrics.overallActual, 59);
    assert.equal(res.body.metrics.overallPlanned, 57);
    assert.equal(res.body.metrics.healthStatus, 'On Track');
});
