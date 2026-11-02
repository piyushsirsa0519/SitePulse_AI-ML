/**
 * Site Pulse — Demo Authentication Router
 * ========================================
 * Provides lightweight demo authentication for standalone environments
 * when external Supabase Auth is unconfigured.
 *
 * Security & Governance:
 *   - Strictly active ONLY when DEMO_AUTH=true (OFF by default)
 *   - Restricts credentials strictly to the seeded demo account
 *   - Issues signed HMAC session tokens with expiration
 *   - Preserves full tenant scoping (mapped to org-apex-retail)
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Secret for signing demo session tokens (generated per boot if not provided)
const DEMO_SECRET = process.env.DEMO_AUTH_SECRET || crypto.randomBytes(32).toString('hex');

// Seeded demo account
const DEMO_USER = {
    id: 'usr-admin-01',
    supabase_auth_id: '11111111-1111-1111-1111-111111111111',
    organization_id: 'org-apex-retail',
    email: 'executive@apexfitouts.com',
    full_name: 'Executive Fitout Manager',
    role: 'admin'
};

/**
 * Creates a signed demo token: demo.<base64url-payload>.<hmac-signature>
 */
function createSignedDemoToken(user) {
    const payload = JSON.stringify({
        sub: user.supabase_auth_id,
        email: user.email,
        role: user.role,
        org: user.organization_id,
        iat: Date.now()
    });
    const b64 = Buffer.from(payload).toString('base64url');
    const sig = crypto.createHmac('sha256', DEMO_SECRET).update(b64).digest('base64url');
    return `demo.${b64}.${sig}`;
}

/**
 * Verifies a signed demo token. Returns decoded payload or null.
 */
function verifyDemoToken(token) {
    if (!token || typeof token !== 'string' || !token.startsWith('demo.')) {
        return null;
    }
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [, b64, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', DEMO_SECRET).update(b64).digest('base64url');

    try {
        const sigBuf = Buffer.from(sig);
        const expBuf = Buffer.from(expectedSig);
        if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
            return null;
        }
        return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

/**
 * POST /auth/login — Demo login endpoint
 */
router.post('/login', (req, res) => {
    if (process.env.DEMO_AUTH !== 'true') {
        return res.status(403).json({
            error: {
                code: 'DEMO_AUTH_DISABLED',
                message: 'Demo authentication is disabled. Configure Supabase authentication or set DEMO_AUTH=true.'
            }
        });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({
            error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Please provide both email and password.'
            }
        });
    }

    const normEmail = email.trim().toLowerCase();
    if (normEmail !== DEMO_USER.email || password !== 'password') {
        return res.status(401).json({
            error: {
                code: 'INVALID_CREDENTIALS',
                message: 'Invalid email or password for demo account.'
            }
        });
    }

    const token = createSignedDemoToken(DEMO_USER);

    return res.status(200).json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 86400,
        user: {
            id: DEMO_USER.id,
            email: DEMO_USER.email,
            name: DEMO_USER.full_name,
            role: DEMO_USER.role,
            organization_id: DEMO_USER.organization_id
        }
    });
});

module.exports = {
    router,
    verifyDemoToken,
    createSignedDemoToken
};

