/**
 * Site Pulse — Supabase Auth Client Module
 * Manages Supabase browser authentication session, sign-in, and sign-out.
 * Production Safety: Dev mock fallback is strictly restricted to local development environments (localhost/127.0.0.1).
 */

const SitePulseAuth = (() => {
    let supabaseClient = null;
    let currentSession = null;

    // Helper to determine if frontend is running on local development host
    function isLocalhost() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '';
    }

    // Development mock token credentials mapping (local development only)
    const DEV_MOCK_TOKENS = {
        'executive@apexfitouts.com': 'mock-token-admin',
        'engineer@apexfitouts.com':  'mock-token-engineer',
        'viewer@apexfitouts.com':    'mock-token-viewer'
    };

    function init() {
        const config = window.SITE_PULSE_CONFIG || {};
        if (window.supabase && config.SUPABASE_URL && config.SUPABASE_URL !== 'https://your-project.supabase.co') {
            try {
                supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
            } catch (err) {
                console.warn('⚠️ Supabase client initialization warning:', err.message);
            }
        }

        // Restore session when Supabase is unconfigured (demo / dev mode)
        if (!supabaseClient) {
            const savedMockToken = localStorage.getItem('site_pulse_mock_token');
            if (savedMockToken) {
                // In production, reject legacy dev mock tokens ('mock-token-*') and require 'demo.*' tokens
                if (!isLocalhost() && !savedMockToken.startsWith('demo.')) {
                    localStorage.removeItem('site_pulse_mock_token');
                    localStorage.removeItem('site_pulse_mock_email');
                    currentSession = null;
                } else {
                    currentSession = {
                        access_token: savedMockToken,
                        user: { email: localStorage.getItem('site_pulse_mock_email') || 'executive@apexfitouts.com' }
                    };
                }
            }
        }
    }

    async function signIn(email, password) {
        if (!email || !password) {
            throw new Error('Please enter both email and password.');
        }

        // 1. Production / Configured Flow: Real Supabase Auth
        if (supabaseClient) {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                throw new Error(error.message);
            }
            currentSession = data.session;
            return currentSession;
        }

        // 2. Demo Auth Flow (When external Supabase is not configured)
        try {
            const config = window.SITE_PULSE_CONFIG || {};
            let baseUrl = '';
            if (typeof config.API_BASE_URL === 'string' && config.API_BASE_URL.trim() !== '') {
                baseUrl = config.API_BASE_URL.trim().replace(/\/+$/, '');
            } else if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
                baseUrl = window.location.origin.replace(/\/+$/, '');
            }
            const res = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password })
            });

            if (res.ok) {
                const data = await res.json();
                currentSession = {
                    access_token: data.access_token,
                    user: data.user
                };
                localStorage.setItem('site_pulse_mock_token', data.access_token);
                localStorage.setItem('site_pulse_mock_email', data.user.email);
                return currentSession;
            }

            const errData = await res.json().catch(() => ({}));
            if (errData && errData.error && errData.error.code === 'INVALID_CREDENTIALS') {
                throw new Error(errData.error.message || 'Invalid email or password.');
            }
        } catch (err) {
            if (err.message && !err.message.includes('fetch') && !err.message.includes('network') && !err.message.includes('Failed')) {
                throw err;
            }
        }

        // 3. Local Development Fallback (strictly localhost / 127.0.0.1)
        if (isLocalhost()) {
            const mockToken = DEV_MOCK_TOKENS[email.trim().toLowerCase()];
            if (mockToken) {
                currentSession = {
                    access_token: mockToken,
                    user: { email: email.trim() }
                };
                localStorage.setItem('site_pulse_mock_token', mockToken);
                localStorage.setItem('site_pulse_mock_email', email.trim());
                return currentSession;
            }
            throw new Error('Invalid email or password. (For demo mode, try: executive@apexfitouts.com / password)');
        }

        // 4. In non-local environment without Supabase or Demo Auth
        throw new Error('Authentication service is unconfigured for this environment.');
    }

    async function signOut() {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        currentSession = null;
        localStorage.removeItem('site_pulse_mock_token');
        localStorage.removeItem('site_pulse_mock_email');
    }

    function getAccessToken() {
        return currentSession ? currentSession.access_token : null;
    }

    function getSession() {
        return currentSession;
    }

    return {
        init,
        signIn,
        signOut,
        getAccessToken,
        getSession
    };
})();

// Auto-initialize on load
document.addEventListener('DOMContentLoaded', () => {
    SitePulseAuth.init();
});
