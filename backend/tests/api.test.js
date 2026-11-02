process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
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

test('0. GET / (Root Serves Frontend App)', async () => {
    const res = await makeRequest('/');
    assert.equal(res.status, 200);
    assert.ok(typeof res.body === 'string' && res.body.includes('Site Pulse'));
});

test('1. GET /health (Unauthenticated)', async () => {
    const res = await makeRequest('/health');
    assert.equal(res.status, 200);
    assert.ok(['ok', 'degraded'].includes(res.body.status));
});

test('1b. Unhandled Route Returns 404 JSON', async () => {
    const res = await makeRequest('/non-existent-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
});

test('2. Authentication Checks on GET /me (Stable Supabase Auth UUID Mapping)', async () => {
    // 2a. No token -> 401
    const resNoToken = await makeRequest('/me');
    assert.equal(resNoToken.status, 401);
    assert.equal(resNoToken.body.error.code, 'UNAUTHENTICATED');

    // 2b. Invalid token -> 401
    const resInvalid = await makeRequest('/me', {
        headers: { 'Authorization': 'Bearer invalid-token-xyz' }
    });
    assert.equal(resInvalid.status, 401);

    // 2c. Valid admin token mapped via Supabase Auth UUID -> 200
    const resValid = await makeRequest('/me', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(resValid.status, 200);
    assert.equal(resValid.body.user.id, 'usr-admin-01');
    assert.equal(resValid.body.user.email, 'executive@apexfitouts.com');
    assert.equal(resValid.body.user.role, 'admin');
    assert.equal(resValid.body.organization.id, 'org-apex-retail');
});

test('3. Unmapped Supabase Auth User Rejected (AUTH_USER_NOT_MAPPED)', async () => {
    const res = await makeRequest('/me', {
        headers: { 'Authorization': 'Bearer mock-token-unmapped' }
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'AUTH_USER_NOT_MAPPED');
});

test('4. Email Alone Cannot Authenticate Application User', async () => {
    const res = await makeRequest('/me', {
        headers: { 'Authorization': 'Bearer executive@apexfitouts.com' }
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHENTICATED');
});

test('5. Test Mock Tokens Rejected in Production Mode (NODE_ENV=production)', async () => {
    const origEnv = process.env.NODE_ENV;
    try {
        process.env.NODE_ENV = 'production';
        const res = await makeRequest('/me', {
            headers: { 'Authorization': 'Bearer mock-token-admin' }
        });
        assert.equal(res.status, 401);
        assert.equal(res.body.error.code, 'UNAUTHENTICATED');
    } finally {
        process.env.NODE_ENV = origEnv;
    }
});

test('6. Production Database Fail-Fast Verification', () => {
    const origEnv = process.env.NODE_ENV;
    const origDbUrl = process.env.DATABASE_URL;

    try {
        process.env.NODE_ENV = 'production';
        delete process.env.DATABASE_URL;

        delete require.cache[require.resolve('../src/db/client')];
        
        assert.throws(
            () => {
                require('../src/db/client');
            },
            /DATABASE_URL environment variable is required in production mode/
        );
    } finally {
        process.env.NODE_ENV = origEnv;
        if (origDbUrl) process.env.DATABASE_URL = origDbUrl;
        delete require.cache[require.resolve('../src/db/client')];
    }
});

test('6b. Production CORS Protection Verification (No wildcard in production without matching CORS_ORIGIN)', async () => {
    const origEnv = process.env.NODE_ENV;
    const origCors = process.env.CORS_ORIGIN;
    try {
        process.env.NODE_ENV = 'production';
        delete process.env.CORS_ORIGIN;

        const res = await makeRequest('/health', {
            method: 'OPTIONS',
            headers: { 'Origin': 'https://unauthorized-site.com' }
        });

        // In production without matching CORS_ORIGIN, Access-Control-Allow-Origin header is NOT set
        assert.equal(res.headers.get('access-control-allow-origin'), null);
    } finally {
        process.env.NODE_ENV = origEnv;
        if (origCors) process.env.CORS_ORIGIN = origCors;
        else delete process.env.CORS_ORIGIN;
    }
});

test('7. GET /portfolio (Authenticated & Risk Sorted)', async () => {
    const res = await makeRequest('/portfolio?date=2026-10-01', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 200);
    assert.equal(Array.isArray(res.body), true);
    assert.equal(res.body.length, 3);
    assert.equal(res.body[0].id, 'prj-biryani-blues');
    assert.equal(res.body[1].id, 'prj-chai-point');
    assert.equal(res.body[2].id, 'prj-ptal-homeware');
});

test('8. GET /projects/:id/dashboard', async () => {
    const res = await makeRequest('/projects/prj-biryani-blues/dashboard?date=2026-10-01', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.project.name, 'Biryani Blues - Gurugram');
    assert.equal(res.body.metrics.overallActual, 59);
    assert.equal(res.body.bottleneck, null);
});

test('9. Organization Isolation Check (User Org A cannot access Project Org B)', async () => {
    const res = await makeRequest('/projects/prj-other-org/dashboard', {
        headers: { 'Authorization': 'Bearer mock-token-admin' }
    });
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'PROJECT_NOT_FOUND');
});

test('10. Role Authorization: Viewer receives 403 on Daily Updates', async () => {
    const updatePayload = {
        tradeId: 'trd-bb-civil',
        date: '2026-10-01',
        progressPct: 95,
        workersPresent: 12,
        workersRequired: 12,
        reason: 'On Track'
    };

    const res = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-viewer'
        },
        body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
});

test('11. Role Authorization: Site Engineer can create/update Daily Updates', async () => {
    const updatePayload = {
        tradeId: 'trd-bb-civil',
        date: '2026-10-01',
        progressPct: 95,
        workersPresent: 14,
        workersRequired: 12,
        reason: 'Accelerated Pace'
    };

    const res = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-engineer'
        },
        body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'success');
    assert.equal(res.body.data.progress_pct, 95);
});

test('12. Input Validation: Invalid progress rejected', async () => {
    const updatePayload = {
        tradeId: 'trd-bb-civil',
        date: '2026-10-01',
        progressPct: 150,
        workersPresent: 12,
        workersRequired: 12
    };

    const res = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-admin'
        },
        body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_INPUT');
});

test('13. Input Validation: Future date rejected', async () => {
    const futureDate = '2099-12-31';
    const updatePayload = {
        tradeId: 'trd-bb-civil',
        date: futureDate,
        progressPct: 90,
        workersPresent: 10,
        workersRequired: 10
    };

    const res = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-admin'
        },
        body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'FUTURE_DATE_REJECTED');
});

test('14. Invalid Trade/Project Relationship Rejected', async () => {
    const updatePayload = {
        tradeId: 'trd-cp-civil',
        date: '2026-10-01',
        progressPct: 90,
        workersPresent: 10,
        workersRequired: 10
    };

    const res = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-admin'
        },
        body: JSON.stringify(updatePayload)
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_TRADE');
});

test('15. Daily Update UPSERT & Dashboard Analytics Integration', async () => {
    const logDate = '2026-10-01';
    const firstUpdate = {
        tradeId: 'trd-bb-civil',
        date: logDate,
        progressPct: 80,
        workersPresent: 15,
        workersRequired: 15,
        reason: 'On Track',
        notes: 'Initial update'
    };

    // First POST
    const res1 = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-engineer'
        },
        body: JSON.stringify(firstUpdate)
    });

    assert.equal(res1.status, 200);
    assert.equal(res1.body.data.progress_pct, 80);
    assert.equal(res1.body.data.notes, 'Initial update');

    // Second POST (UPSERT for same trade & date)
    const secondUpdate = {
        tradeId: 'trd-bb-civil',
        date: logDate,
        progressPct: 100,
        workersPresent: 18,
        workersRequired: 15,
        reason: 'On Track',
        notes: 'Final completion update'
    };

    const res2 = await makeRequest('/projects/prj-biryani-blues/updates', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token-engineer'
        },
        body: JSON.stringify(secondUpdate)
    });

    assert.equal(res2.status, 200);
    assert.equal(res2.body.data.progress_pct, 100);
    assert.equal(res2.body.data.notes, 'Final completion update');

    // Verify Dashboard recalculates and reflects updated trade progress
    const dashRes = await makeRequest('/projects/prj-biryani-blues/dashboard', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer mock-token-engineer'
        }
    });

    assert.equal(dashRes.status, 200);
    const civilTrade = dashRes.body.trades.find(t => t.id === 'trd-bb-civil');
    assert.ok(civilTrade);
    assert.equal(civilTrade.progress_pct, 100);
});

test('16. Demo Auth Mode: POST /auth/login verifies credentials and issues signed token', async () => {
    // 16a. When DEMO_AUTH is off, returns 403
    const origDemo = process.env.DEMO_AUTH;
    delete process.env.DEMO_AUTH;

    const resDisabled = await makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'executive@apexfitouts.com', password: 'password' })
    });
    assert.equal(resDisabled.status, 403);
    assert.equal(resDisabled.body.error.code, 'DEMO_AUTH_DISABLED');

    // 16b. When DEMO_AUTH=true, invalid credentials return 401
    process.env.DEMO_AUTH = 'true';
    const resBad = await makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'executive@apexfitouts.com', password: 'wrong' })
    });
    assert.equal(resBad.status, 401);

    // 16c. Valid demo credentials return signed token
    const resGood = await makeRequest('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'executive@apexfitouts.com', password: 'password' })
    });
    assert.equal(resGood.status, 200);
    assert.ok(resGood.body.access_token);
    assert.ok(resGood.body.access_token.startsWith('demo.'));
    assert.equal(resGood.body.user.email, 'executive@apexfitouts.com');

    // 16d. Access protected endpoint using issued signed demo token
    const meRes = await makeRequest('/me', {
        headers: { 'Authorization': `Bearer ${resGood.body.access_token}` }
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.organization.id, 'org-apex-retail');
    assert.equal(meRes.body.user.role, 'admin');

    if (origDemo) process.env.DEMO_AUTH = origDemo;
    else delete process.env.DEMO_AUTH;
});


