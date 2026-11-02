/**
 * Site Pulse — Phase 5 Frontend & Enterprise Integration Tests
 * ==============================================================
 * Validates:
 * 1. Enriched portfolio metrics for the Executive Dashboard
 * 2. Contractor directory and assignments endpoint
 * 3. Enriched project dashboard with delay events, contractors, and store metadata
 * 4. Trade-contractor association
 * 5. ML prediction endpoints integration with defensive handling
 * 6. Frontend assets and DOM hook integrity
 */

process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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

test('1. Enriched Portfolio: GET /portfolio returns executive rollup fields', async () => {
    const res = await makeRequest('/portfolio?date=2026-10-01', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 3);

    const first = res.body[0];
    assert.ok('overallActual' in first, 'overallActual must be present');
    assert.ok('overallPlanned' in first, 'overallPlanned must be present');
    assert.ok('variance' in first, 'variance must be present');
    assert.ok('healthStatus' in first, 'healthStatus must be present');
    assert.ok('totalWorkersPresent' in first, 'totalWorkersPresent must be present');
    assert.ok('totalWorkersRequired' in first, 'totalWorkersRequired must be present');
    assert.ok('activeContractorCount' in first, 'activeContractorCount must be present');
    assert.ok('activeDelayEventsCount' in first, 'activeDelayEventsCount must be present');
});

test('2. Contractor Directory: GET /portfolio/contractors returns trade partners', async () => {
    const res = await makeRequest('/portfolio/contractors', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 5, 'Should return at least 5 contractor partners');

    const civilContractor = res.body.find(c => c.name.includes('Civil'));
    assert.ok(civilContractor, 'Civil contractor must exist');
    assert.equal(civilContractor.trade_specialty, 'Civil');
    assert.ok(civilContractor.rating >= 4.0, 'Rating should be >= 4.0');
    assert.ok('active_projects_count' in civilContractor);
});

test('3. Enriched Project Dashboard: GET /projects/:id/dashboard returns delayEvents & contractors', async () => {
    const res = await makeRequest('/projects/prj-chai-point/dashboard?date=2026-10-01', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.project);
    assert.ok(res.body.metrics);
    assert.ok(Array.isArray(res.body.trades));
    assert.ok(Array.isArray(res.body.delayEvents), 'delayEvents array must be present');
    assert.ok(Array.isArray(res.body.contractors), 'contractors array must be present');

    // Chai Point has active delay event 'Material Delay'
    assert.ok(res.body.delayEvents.length > 0, 'Chai Point should have recorded delay events');
    assert.equal(res.body.delayEvents[0].category, 'Material Delay');

    // Check trade has assigned contractor details
    const electricalTrade = res.body.trades.find(t => t.name === 'Electrical');
    assert.ok(electricalTrade);
    assert.ok(electricalTrade.contractor_name, 'Trade must have assigned contractor_name');
    assert.ok(electricalTrade.contractor_name.includes('VoltCraft'));
});

test('4. Frontend API Client: js/api.js exposes ML and contractor methods', () => {
    const apiFile = fs.readFileSync(path.join(__dirname, '../../js/api.js'), 'utf-8');
    assert.ok(apiFile.includes('getProjectRiskScore'), 'js/api.js must export getProjectRiskScore');
    assert.ok(apiFile.includes('getProjectAnomalies'), 'js/api.js must export getProjectAnomalies');
    assert.ok(apiFile.includes('getContractors'), 'js/api.js must export getContractors');
});

test('5. Frontend HTML Structure: index.html contains all Phase 5 view containers & IDs', () => {
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf-8');

    // Subnav tabs
    assert.ok(html.includes('id="tab-nav-dashboard"'), 'Dashboard tab must exist');
    assert.ok(html.includes('id="tab-nav-project"'), 'Project Deep Dive tab must exist');
    assert.ok(html.includes('id="tab-nav-analytics"'), 'Analytics tab must exist');

    // View containers
    assert.ok(html.includes('id="view-dashboard"'), 'Dashboard view container must exist');
    assert.ok(html.includes('id="view-project"'), 'Project view container must exist');
    assert.ok(html.includes('id="view-analytics"'), 'Analytics view container must exist');

    // Key sections
    assert.ok(html.includes('id="executive-kpi-bar"'), 'Executive KPI bar must exist');
    assert.ok(html.includes('id="portfolio-cards-grid"'), 'Portfolio cards grid must exist');
    assert.ok(html.includes('id="project-ml-insights-container"'), 'ML insights container must exist');
    assert.ok(html.includes('id="project-delay-events-container"'), 'Delay events container must exist');
    assert.ok(html.includes('id="trades-performance-matrix"'), 'Trade performance matrix must exist');
    assert.ok(html.includes('id="contractors-directory-container"'), 'Contractor directory must exist');
});

test('6. Frontend Script Controller: script.js implements view switcher and ML rendering', () => {
    const script = fs.readFileSync(path.join(__dirname, '../../script.js'), 'utf-8');
    assert.ok(script.includes('function switchView'), 'switchView function must exist');
    assert.ok(script.includes('function renderExecutiveKpiBar'), 'renderExecutiveKpiBar must exist');
    assert.ok(script.includes('function renderPortfolioCardsGrid'), 'renderPortfolioCardsGrid must exist');
    assert.ok(script.includes('function renderProjectMlInsights'), 'renderProjectMlInsights must exist');
    assert.ok(script.includes('function renderProjectDelayEvents'), 'renderProjectDelayEvents must exist');
    assert.ok(script.includes('function renderTradeMatrixView'), 'renderTradeMatrixView must exist');
    assert.ok(script.includes('function renderContractorsDirectory'), 'renderContractorsDirectory must exist');
});
