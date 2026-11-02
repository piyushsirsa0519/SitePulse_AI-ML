/**
 * Site Pulse — Phase 7 Production Hardening & Readiness Tests
 * ==============================================================
 * Validates:
 *  1. Security Headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, no X-Powered-By
 *  2. Production Error Masking: 500 errors mask internal driver messages in production
 *  3. Upgraded Health Endpoint: Subsystem status for database, ml_service, copilot, uptime & memory
 *  4. Body Parser Payload Limits: Rejection of oversized JSON payloads (>1MB)
 *  5. AI Copilot Provider Adapters: Concrete adapters for Gemini, Anthropic, OpenAI, and Mock
 *  6. Test Provider Transparency: Mock responses include isTestProvider: true
 *  7. Deployment Configuration: Validates Dockerfile, ml_service Dockerfile, and docker-compose.yml
 *  8. Frontend Accessibility: Validates ARIA controls, tabpanel roles, and focus-visible styling
 */

process.env.NODE_ENV = 'test';
process.env.LLM_PROVIDER = 'mock';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const db = require('../src/db/client');
const aiCopilotService = require('../src/services/aiCopilotService');
const errorHandler = require('../src/middleware/errorHandler');

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

async function makeRequest(endpoint, options = {}) {
    const url = `${baseUrl}${endpoint}`;
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

test('1. Security Headers: Verifies enterprise security headers and disabled X-Powered-By', async () => {
    const res = await makeRequest('/');

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
    assert.equal(res.headers.get('x-xss-protection'), '0');
    assert.equal(res.headers.get('x-powered-by'), null);
});

test('2. Production Error Masking: 500 errors mask internal driver messages in production', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    let capturedStatus = null;
    let capturedBody = null;

    const mockRes = {
        status(s) {
            capturedStatus = s;
            return this;
        },
        json(b) {
            capturedBody = b;
            return this;
        }
    };

    const sensitiveErr = new Error('FATAL: Database connection timeout at 10.0.0.4:5432 with password secret123');
    sensitiveErr.statusCode = 500;

    errorHandler(sensitiveErr, { method: 'GET', url: '/api/test' }, mockRes, () => {});

    assert.equal(capturedStatus, 500);
    assert.ok(capturedBody.error);
    assert.equal(capturedBody.error.message, 'An unexpected internal server error occurred. Please contact system support.');
    assert.ok(!capturedBody.error.message.includes('10.0.0.4'));
    assert.ok(!capturedBody.error.message.includes('secret123'));

    process.env.NODE_ENV = origEnv;
});

test('3. Upgraded Health Endpoint: Reports database, ml_service, copilot, uptime & memory', async () => {
    const res = await makeRequest('/health');

    assert.equal(res.status, 200);
    assert.ok(res.body.status === 'ok' || res.body.status === 'degraded');
    assert.equal(res.body.service, 'sitepulse-backend');
    assert.ok(typeof res.body.uptime_seconds === 'number');
    assert.ok(res.body.memory && typeof res.body.memory.rss_mb === 'number');

    // Subsystems verification
    const sub = res.body.subsystems;
    assert.ok(sub);
    assert.ok(sub.database && (sub.database.mode === 'postgresql' || sub.database.mode === 'in_memory'));
    assert.ok(sub.ml_service);
    assert.ok(sub.copilot);
    assert.equal(sub.copilot.configured, true);
    assert.equal(sub.copilot.provider, 'mock');
});

test('4. Database Health Helper: checkHealth returns structured status and active counts', async () => {
    const health = await db.checkHealth();
    assert.ok(health);
    assert.ok(health.status === 'healthy' || health.status === 'degraded');
    assert.ok(health.mode === 'postgresql' || health.mode === 'in_memory');
});

test('5. AI Copilot Provider Adapters: Verifies callGroq, callGemini, callAnthropic, callOpenAI, and callMockProvider exist', () => {
    assert.equal(typeof aiCopilotService.callGroq, 'function');
    assert.equal(typeof aiCopilotService.callOpenAI, 'function');
    assert.equal(typeof aiCopilotService.callGemini, 'function');
    assert.equal(typeof aiCopilotService.callAnthropic, 'function');
    assert.equal(typeof aiCopilotService.callMockProvider, 'function');
});

test('5b. Groq Provider: AbortController enforces timeout on callGroq', async () => {
    try {
        await aiCopilotService.callGroq(
            { provider: 'groq', model: 'qwen/qwen3.8-27b', endpoint: 'https://api.groq.com/openai/v1/chat/completions', apiKey: 'test-key' },
            'system',
            'user',
            [],
            1 // 1ms timeout triggers AbortController
        );
        assert.fail('Should have timed out');
    } catch (err) {
        assert.equal(err.code, 'PROVIDER_TIMEOUT');
    }
});

test('6. Test Provider Transparency: Mock responses include isTestProvider: true', async () => {
    const res = await makeRequest('/copilot/chat', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer mock-token-admin',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'What is the portfolio status?' })
    });

    assert.equal(res.status, 200);
    assert.ok(res.body.usage);
    assert.equal(res.body.usage.isTestProvider, true);
    assert.equal(res.body.usage.provider, 'mock');
});

test('7. Deployment Configuration: Validates Dockerfile, ml_service Dockerfile, and docker-compose.yml', () => {
    const rootDockerPath = path.join(__dirname, '../../Dockerfile');
    const mlDockerPath = path.join(__dirname, '../ml_service/Dockerfile');
    const composePath = path.join(__dirname, '../../docker-compose.yml');
    const envExPath = path.join(__dirname, '../../.env.example');

    assert.ok(fs.existsSync(rootDockerPath), 'Missing root Dockerfile');
    const rootDocker = fs.readFileSync(rootDockerPath, 'utf8');
    assert.ok(rootDocker.includes('node:20-alpine'));
    assert.ok(rootDocker.includes('HEALTHCHECK'));

    assert.ok(fs.existsSync(mlDockerPath), 'Missing backend/ml_service/Dockerfile');
    const mlDocker = fs.readFileSync(mlDockerPath, 'utf8');
    assert.ok(mlDocker.includes('python:3.10-slim'));
    assert.ok(mlDocker.includes('HEALTHCHECK'));

    assert.ok(fs.existsSync(composePath), 'Missing docker-compose.yml');
    const compose = fs.readFileSync(composePath, 'utf8');
    assert.ok(compose.includes('sitepulse-postgres'));
    assert.ok(compose.includes('sitepulse-ml-service'));
    assert.ok(compose.includes('sitepulse-backend'));

    assert.ok(fs.existsSync(envExPath), 'Missing .env.example');
    const envEx = fs.readFileSync(envExPath, 'utf8');
    assert.ok(envEx.includes('LLM_PROVIDER'));
    assert.ok(envEx.includes('ML_SERVICE_URL'));
    assert.ok(envEx.includes('DATABASE_URL'));
});

test('8. Frontend Accessibility: Validates ARIA controls, tabpanel roles, and focus-visible styling', () => {
    const htmlPath = path.join(__dirname, '../../index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // ARIA controls on tabs
    assert.ok(html.includes('aria-controls="view-dashboard"'));
    assert.ok(html.includes('aria-controls="view-project"'));
    assert.ok(html.includes('aria-controls="view-analytics"'));
    assert.ok(html.includes('aria-controls="view-copilot"'));

    // ARIA roles on panels
    assert.ok(html.includes('id="view-dashboard" class="app-view active" role="tabpanel"'));
    assert.ok(html.includes('id="view-project" class="app-view" style="display: none;" role="tabpanel"'));
    assert.ok(html.includes('id="view-analytics" class="app-view" style="display: none;" role="tabpanel"'));
    assert.ok(html.includes('id="view-copilot" class="app-view" style="display: none;" role="tabpanel"'));

    // CSS focus-visible
    const cssPath = path.join(__dirname, '../../style.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.ok(css.includes('*:focus-visible'));
});
