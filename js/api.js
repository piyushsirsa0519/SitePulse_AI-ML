/**
 * Site Pulse — Frontend API Client Module
 * Centralizes all HTTP communication with Express backend.
 */

const SitePulseAPI = (() => {
    function getBaseUrl() {
        const config = window.SITE_PULSE_CONFIG || {};
        if (typeof config.API_BASE_URL === 'string' && config.API_BASE_URL.trim() !== '') {
            return config.API_BASE_URL.trim().replace(/\/+$/, '');
        }
        if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
            return window.location.origin.replace(/\/+$/, '');
        }
        return 'http://localhost:3000';
    }

    async function request(endpoint, options = {}) {
        const url = `${getBaseUrl()}${endpoint}`;
        const token = SitePulseAuth.getAccessToken();

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        let response = null;
        try {
            response = await fetch(url, config);
        } catch (netErr) {
            const err = new Error('Unable to connect to backend server. Please check network connection.');
            err.statusCode = 0;
            err.code = 'NETWORK_ERROR';
            throw err;
        }

        let body = null;
        const text = await response.text();
        try {
            body = text ? JSON.parse(text) : {};
        } catch (e) {
            body = { message: text };
        }

        if (!response.ok) {
            const errorMsg = (body && body.error && body.error.message) || body.message || `HTTP ${response.status} Error`;
            const err = new Error(errorMsg);
            err.statusCode = response.status;
            err.code = (body && body.error && body.error.code) || 'API_ERROR';
            
            // Handle 401 Session Expiration
            if (response.status === 401) {
                document.dispatchEvent(new CustomEvent('sitepulse:unauthorized', { detail: err }));
            }

            throw err;
        }

        return body;
    }

    /**
     * GET /me — Authenticated user profile and organization details
     */
    async function getMe() {
        return request('/me');
    }

    /**
     * GET /portfolio — Risk-sorted executive portfolio list
     */
    async function getPortfolio(date = '2026-10-01') {
        const dateParam = date ? `?date=${encodeURIComponent(date)}` : '';
        return request(`/portfolio${dateParam}`);
    }

    /**
     * GET /projects/:id/dashboard — Complete metrics and analytics for a project
     */
    async function getProjectDashboard(projectId, date = '2026-10-01') {
        const dateParam = date ? `?date=${encodeURIComponent(date)}` : '';
        return request(`/projects/${projectId}/dashboard${dateParam}`);
    }

    /**
     * POST /projects/:id/updates — Create or update daily update for a trade
     */
    async function createDailyUpdate(projectId, updateData) {
        return request(`/projects/${projectId}/updates`, {
            method: 'POST',
            body: JSON.stringify(updateData)
        });
    }

    /**
     * GET /projects/:id/risk-score — Phase 4 ML delay risk score & top factor attributions
     */
    async function getProjectRiskScore(projectId, date = '2026-10-01') {
        const dateParam = date ? `?date=${encodeURIComponent(date)}` : '';
        return request(`/projects/${projectId}/risk-score${dateParam}`);
    }

    /**
     * GET /projects/:id/anomalies — Phase 4 ML trade-level anomaly detection
     */
    async function getProjectAnomalies(projectId) {
        return request(`/projects/${projectId}/anomalies`);
    }

    /**
     * GET /portfolio/contractors — Active contractors across organization
     */
    async function getContractors() {
        return request('/portfolio/contractors');
    }

    /**
     * GET /copilot/status — Active Copilot provider configuration and status
     */
    async function getCopilotStatus() {
        return request('/copilot/status');
    }

    /**
     * POST /copilot/chat — Conversational grounded decision support query
     */
    async function sendCopilotMessage(chatData) {
        return request('/copilot/chat', {
            method: 'POST',
            body: JSON.stringify(chatData)
        });
    }

    /**
     * GET /copilot/suggested-prompts — Contextual decision-support prompts
     */
    async function getSuggestedPrompts(projectId = null) {
        const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
        return request(`/copilot/suggested-prompts${query}`);
    }

    return {
        getMe,
        getPortfolio,
        getProjectDashboard,
        createDailyUpdate,
        getProjectRiskScore,
        getProjectAnomalies,
        getContractors,
        getCopilotStatus,
        sendCopilotMessage,
        getSuggestedPrompts
    };
})();
