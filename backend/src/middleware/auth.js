/**
 * Site Pulse — Supabase Authentication Middleware
 * Validates Bearer tokens via Supabase Auth and maps immutable Supabase Auth UUID
 * (supabase_auth_id) to application user context.
 * Production Safety: Test tokens are strictly rejected in production (NODE_ENV=production).
 */

const { createClient } = require('@supabase/supabase-js');
const { getUserBySupabaseAuthId } = require('../services/userService');
const { verifyDemoToken } = require('../routes/auth');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// Test token mapping by Supabase Auth UUID (for headless API testing in dev/test mode ONLY)
const TEST_TOKEN_AUTH_MAP = {
    'mock-token-admin':     '11111111-1111-1111-1111-111111111111',
    'mock-token-engineer':  '22222222-2222-2222-2222-222222222222',
    'mock-token-viewer':    '33333333-3333-3333-3333-333333333333',
    'mock-token-other-org': '44444444-4444-4444-4444-444444444444',
    'mock-token-unmapped':  '99999999-9999-9999-9999-999999999999'
};

async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHENTICATED',
                message: 'Missing or invalid Authorization header'
            }
        });
    }

    const token = authHeader.split(' ')[1];
    const isProduction = process.env.NODE_ENV === 'production';

    try {
        let authId = null;

        // 1. In non-production mode ONLY, allow test mock tokens for automated unit testing
        if (!isProduction && TEST_TOKEN_AUTH_MAP[token]) {
            authId = TEST_TOKEN_AUTH_MAP[token];
        } else if (process.env.DEMO_AUTH === 'true' && token.startsWith('demo.')) {
            const demoPayload = verifyDemoToken(token);
            if (!demoPayload) {
                return res.status(401).json({
                    error: {
                        code: 'UNAUTHENTICATED',
                        message: 'Invalid or expired demo authentication token'
                    }
                });
            }
            authId = demoPayload.sub;
        } else if (supabase) {
            // 2. Real Supabase Auth verification
            const { data, error } = await supabase.auth.getUser(token);
            if (error || !data || !data.user) {
                return res.status(401).json({
                    error: {
                        code: 'UNAUTHENTICATED',
                        message: 'Invalid or expired Supabase authentication token'
                    }
                });
            }

            authId = data.user.id; // Immutable Supabase Auth UUID
        } else {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHENTICATED',
                    message: 'Authentication failed. Token not recognized.'
                }
            });
        }

        // 3. Stable Identity Mapping: Lookup by supabase_auth_id UUID
        const appUser = await getUserBySupabaseAuthId(authId);

        if (!appUser) {
            return res.status(401).json({
                error: {
                    code: 'AUTH_USER_NOT_MAPPED',
                    message: 'Authenticated Supabase user is not mapped to an application user'
                }
            });
        }

        // 4. Attach application user context to request
        req.user = {
            id: appUser.id,
            supabaseAuthId: appUser.supabase_auth_id,
            email: appUser.email,
            name: appUser.full_name || appUser.name,
            role: appUser.role,
            organizationId: appUser.organization_id || appUser.organizationId
        };

        next();
    } catch (err) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHENTICATED',
                message: 'Authentication processing failed'
            }
        });
    }
}

module.exports = {
    authenticateToken
};
