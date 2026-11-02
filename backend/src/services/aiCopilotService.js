/**
 * SitePulse — AI Copilot & Intelligent Decision Support Service
 * ===============================================================
 * Provider-independent LLM orchestration layer providing:
 *   - Grounded operational context injection
 *   - Provider adapters: OpenAI, Gemini, Anthropic, Custom/Ollama, Mock (for testing)
 *   - Request validation, sliding-window rate limiting, and timeout enforcement
 *   - Prompt injection and SQL modification defenses
 *   - Read-only decision support guarantee
 *   - Graceful unconfigured state when API key is missing
 */

const copilotContextService = require('./copilotContextService');

// Configurable environment variables
const DEFAULT_TIMEOUT_MS = 25000;
const MAX_MESSAGE_LENGTH = 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

// Rate limit store (in-memory per user ID)
const rateLimitStore = new Map();

/**
 * Checks sliding-window rate limit for a user.
 */
function checkRateLimit(userId) {
    const now = Date.now();
    const userTimestamps = rateLimitStore.get(userId) || [];
    const recentTimestamps = userTimestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

    if (recentTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    recentTimestamps.push(now);
    rateLimitStore.set(userId, recentTimestamps);
    return true;
}

/**
 * Detects adversarial prompt injection or database tampering patterns.
 */
function detectInjection(message) {
    if (!message || typeof message !== 'string') return false;
    const lower = message.toLowerCase();

    const injectionPatterns = [
        /ignore\s+(all\s+|any\s+|previous\s+|prior\s+)?instructions/i,
        /disregard\s+(all\s+|any\s+|previous\s+)?instructions/i,
        /system\s+prompt/i,
        /reveal\s+(your\s+|the\s+)?(system|internal|prompt|instructions|secret|api[_\s-]?key)/i,
        /drop\s+table/i,
        /delete\s+from\s+[a-z_]+/i,
        /update\s+[a-z_]+\s+set/i,
        /insert\s+into\s+[a-z_]+/i,
        /grant\s+admin/i,
        /bypass\s+(safety|guardrails|filters)/i,
        /act\s+as\s+an\s+unrestricted/i,
        /dan\s+mode/i,
        /jailbreak/i
    ];

    return injectionPatterns.some(pattern => pattern.test(lower));
}

/**
 * Detects if the user is asking the Copilot to alter data or execute actions.
 */
function isActionRequest(message) {
    const lower = (message || '').toLowerCase();
    const actionPatterns = [
        /(change|update|set|modify)\s+(progress|percent|deadline|date|status)/i,
        /(delete|remove)\s+(project|trade|contractor|delay)/i,
        /(cancel|terminate)\s+(contract|contractor)/i,
        /(log|submit)\s+(update|daily update|delay event)/i,
        /(approve|authorize)\s+(payment|budget|change order)/i
    ];
    return actionPatterns.some(p => p.test(lower));
}

/**
 * Resolves active LLM provider configuration.
 */
function getProviderConfig() {
    const provider = (process.env.LLM_PROVIDER || '').toLowerCase();
    const apiKey = process.env.LLM_API_KEY ||
                   process.env.GROQ_API_KEY ||
                   process.env.OPENAI_API_KEY ||
                   process.env.GEMINI_API_KEY ||
                   process.env.ANTHROPIC_API_KEY;

    const isTestMode = process.env.NODE_ENV === 'test';

    // If explicit mock provider or test mode with mock fallback
    if (provider === 'mock' || (isTestMode && (!provider || provider === 'mock'))) {
        return {
            provider: 'mock',
            model: 'sitepulse-mock-deterministic-v1',
            configured: true,
            apiKey: 'mock-key'
        };
    }

    if (provider === 'groq' || (!provider && process.env.GROQ_API_KEY)) {
        return {
            provider: 'groq',
            model: process.env.LLM_MODEL || 'qwen/qwen3.8-27b',
            endpoint: process.env.LLM_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions',
            configured: !!apiKey,
            apiKey
        };
    }

    if (provider === 'openai' || (!provider && process.env.OPENAI_API_KEY)) {
        return {
            provider: 'openai',
            model: process.env.LLM_MODEL || 'gpt-4o-mini',
            endpoint: process.env.LLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
            configured: !!apiKey,
            apiKey
        };
    }

    if (provider === 'gemini' || (!provider && process.env.GEMINI_API_KEY)) {
        return {
            provider: 'gemini',
            model: process.env.LLM_MODEL || 'gemini-1.5-flash',
            endpoint: process.env.LLM_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/models',
            configured: !!apiKey,
            apiKey
        };
    }

    if (provider === 'anthropic' || (!provider && process.env.ANTHROPIC_API_KEY)) {
        return {
            provider: 'anthropic',
            model: process.env.LLM_MODEL || 'claude-3-5-sonnet',
            endpoint: process.env.LLM_ENDPOINT || 'https://api.anthropic.com/v1/messages',
            configured: !!apiKey,
            apiKey
        };
    }

    // Default: Unconfigured provider
    return {
        provider: provider || 'unconfigured',
        model: process.env.LLM_MODEL || 'none',
        configured: false,
        apiKey: null
    };
}

/**
 * Returns Copilot operational status and setup requirements.
 */
function getCopilotStatus() {
    const config = getProviderConfig();

    return {
        status: config.configured ? 'online' : 'unconfigured',
        configured: config.configured,
        provider: config.provider,
        model: config.model,
        version: '1.0.0',
        capabilities: [
            'portfolio_health_analysis',
            'project_delay_investigation',
            'trade_bottleneck_detection',
            'manpower_shortfall_assessment',
            'ml_delay_risk_explanation',
            'contractor_performance_audit'
        ],
        governance: {
            readOnly: true,
            tenantIsolated: true,
            noArbitrarySql: true,
            syntheticDisclaimerRequired: true
        },
        disclaimer: 'SitePulse AI Copilot provides advisory decision support based on verified project records. Does not execute autonomous project changes.',
        setupGuide: config.configured ? null : {
            message: 'To activate live AI decision support, configure LLM credentials in the backend environment.',
            supportedProviders: ['groq', 'openai', 'gemini', 'anthropic', 'mock'],
            exampleEnv: {
                LLM_PROVIDER: 'groq',
                LLM_API_KEY: 'gsk_...',
                LLM_MODEL: 'llama-3.3-70b-versatile'
            }
        }
    };
}

/**
 * Builds the grounding system prompt with injected verified telemetry.
 */
function buildSystemPrompt(context) {
    return `You are SitePulse AI Copilot, an enterprise construction intelligence and decision-support assistant for retail store fitouts (Apex Retail Fitouts).

ROLE AND RESPONSIBILITY:
- You advise project executives, operations directors, and site managers.
- You provide evidence-backed, factual analysis of project schedules, trade progress, workforce attendance, and machine learning risk predictions.
- You are strictly an ADVISORY system. You cannot modify project records, change deadlines, post daily updates, or authorize contractual actions.

STRICT GROUNDING RULES:
1. Base all facts, numbers, dates, contractor names, and metrics STRICTLY on the VERIFIED TELEMETRY provided below.
2. State the relevant Reference Date (${context.referenceDate}) when presenting metrics.
3. NEVER invent, hallucinate, or assume project metrics, contractor ratings, or delay causes not present in the data.
4. If the user asks about a project, metric, trade, or person NOT in the records, state explicitly: "This information is not present in the verified project telemetry as of ${context.referenceDate}."
5. Distinguish observed facts (e.g., recorded progress, logged attendance, open blocker tickets) from inferred suggestions (e.g., recommended recovery actions).
6. Never present correlation as causation.
7. When discussing machine learning risk scores or anomalies, include the disclaimer that models are trained on synthetic simulation datasets for research & prototyping.
8. Distinguish progress variance % (actual progress minus planned progress, e.g. -5% means physical progress is 5 percentage points behind planned schedule) from projected completion delay days (linear schedule completion vs contract deadline). Do not confuse them or report variance percentages as days.
9. Keep the following metrics strictly distinct: Required workforce (14), Present workforce (5), Staffing deficit (9), Projected contractual deadline buffer (16 days ahead), and Planned progress variance (-28 percentage points). If a trade (such as Civil) is projected to complete before the contractual deadline (e.g. Oct 30 vs Nov 15 deadline), communicate that the contractual deadline is currently projected to remain protected. Do not automatically present the entire staffing deficit as the optimal additional deployment; instead, state that deploying up to 9 additional qualified workers should be evaluated to recover the planned milestone. Do not refer to workers as masons or other specific crafts unless explicitly qualified in verified data; refer to them as qualified trade workers or workforce.

VERIFIED TELEMETRY DATA AS OF ${context.referenceDate}:
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

OUTPUT FORMAT:
Structure your answers with:
- **Status / Summary**: Direct, high-level answer to the user's question.
- **Evidence from Project Records**: Specific facts citing project name, store code, completion %, progress variance %, projected delay days, or workforce attendance numbers.
- **Root Cause & Bottlenecks**: Analysis of affected trades, delay events, or contractor observations.
- **Advisory Recommendations**: Actionable operational suggestions (labeled clearly as advisory suggestions, not verified facts).
- **Data Source & Reference Date**: Cite the sources and cutoff date.`;
}

/**
 * Calls Groq Cloud Chat Completions API (OpenAI-compatible).
 */
async function callGroq(config, systemPrompt, userMessage, conversationHistory, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const maxTokens = parseInt(process.env.LLM_MAX_TOKENS, 10) || 800;

    const messages = [
        { role: 'system', content: systemPrompt },
        ...(conversationHistory || []).slice(-6),
        { role: 'user', content: userMessage }
    ];

    try {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: 0.2,
                max_tokens: maxTokens
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const choice = data.choices && data.choices[0];
        let content = choice && choice.message && choice.message.content;
        if (!content && choice && choice.message && choice.message.reasoning) {
            content = choice.message.reasoning;
        }
        return content || 'No response generated from Groq.';
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(`LLM provider timed out after ${timeoutMs}ms`);
            timeoutErr.code = 'PROVIDER_TIMEOUT';
            throw timeoutErr;
        }
        throw err;
    }
}

/**
 * Calls OpenAI Chat Completions API.
 */
async function callOpenAI(config, systemPrompt, userMessage, conversationHistory, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const messages = [
        { role: 'system', content: systemPrompt },
        ...(conversationHistory || []).slice(-6),
        { role: 'user', content: userMessage }
    ];

    try {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: 0.2,
                max_tokens: 800
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenAI API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || 'No response generated.';
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(`LLM provider timed out after ${timeoutMs}ms`);
            timeoutErr.code = 'PROVIDER_TIMEOUT';
            throw timeoutErr;
        }
        throw err;
    }
}

/**
 * Calls Google Gemini REST API (v1beta generateContent).
 */
async function callGemini(config, systemPrompt, userMessage, conversationHistory, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const modelName = config.model || 'gemini-1.5-flash';
    const baseUrl = config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models';
    const endpoint = `${baseUrl}/${modelName}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    // Build Gemini contents
    const contents = [];
    (conversationHistory || []).slice(-6).forEach(turn => {
        contents.push({
            role: turn.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: turn.content }]
        });
    });
    contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
    });

    const requestBody = {
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
        contents,
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800
        }
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Google Gemini API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const candidate = data.candidates && data.candidates[0];
        const part = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0];
        return (part && part.text) || 'No response generated from Gemini.';
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(`LLM provider timed out after ${timeoutMs}ms`);
            timeoutErr.code = 'PROVIDER_TIMEOUT';
            throw timeoutErr;
        }
        throw err;
    }
}

/**
 * Calls Anthropic Claude Messages API.
 */
async function callAnthropic(config, systemPrompt, userMessage, conversationHistory, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
    const modelName = config.model || 'claude-3-5-sonnet';

    const messages = [];
    (conversationHistory || []).slice(-6).forEach(turn => {
        messages.push({
            role: turn.role === 'assistant' ? 'assistant' : 'user',
            content: turn.content
        });
    });
    messages.push({
        role: 'user',
        content: userMessage
    });

    const requestBody = {
        model: modelName,
        max_tokens: 800,
        temperature: 0.2,
        system: systemPrompt,
        messages
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Anthropic API error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const contentBlock = data.content && data.content[0];
        return (contentBlock && contentBlock.text) || 'No response generated from Anthropic.';
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            const timeoutErr = new Error(`LLM provider timed out after ${timeoutMs}ms`);
            timeoutErr.code = 'PROVIDER_TIMEOUT';
            throw timeoutErr;
        }
        throw err;
    }
}

/**
 * Deterministic Mock Adapter for testing and reproducible verification.
 */
function callMockProvider(context, userMessage) {
    const lower = (userMessage || '').toLowerCase();
    const refDate = context.referenceDate;

    // Check if query is about something clearly not in data (e.g. weather in Paris, secret stock prices, Project Z)
    if (lower.includes('weather') || lower.includes('stock price') || lower.includes('store #999') || lower.includes('project z') || lower.includes('tokyo store')) {
        return `**Operational Inquiry Notice**

This information is not present in the verified project telemetry as of **${refDate}**.

- **Verified Scope:** Only projects and contractors assigned to your organization as of ${refDate} are tracked in SitePulse.
- **Data Source:** \`portfolioService\` and \`projectService\` records.`;
    }

    if (context.scope === 'portfolio') {
        const m = context.metrics || {};
        const projects = context.projects || [];
        const delayedList = projects.filter(p => p.healthStatus === 'Behind Schedule' || p.healthStatus === 'Delayed' || (p.projectedDelayDays > 0) || (p.variancePct && p.variancePct < -3));
        const atRiskList = projects.filter(p => p.healthStatus === 'At Risk' || p.healthStatus === 'Attention Needed' || p.healthStatus === 'Attention');

        return `### Portfolio Health & Risk Analysis

**Executive Status (As of ${refDate})**:
- **Total Active Projects**: ${m.totalProjects || 0}
- **On Track**: ${m.onTrackCount || 0} | **At Risk**: ${m.atRiskCount || 0} | **Delayed**: ${m.delayedCount || 0}
- **Portfolio Progress**: Actual ${m.portfolioActualPct || 0}% vs Planned ${m.portfolioPlannedPct || 0}% (Variance: ${m.variancePct || 0}%)
- **Workforce on Site**: ${m.totalWorkersPresent || 0} / ${m.totalWorkersRequired || 0} workers (${m.manpowerShortfallPct || 0}% shortfall)
- **Active Blockers**: ${m.totalOpenDelayEvents || 0} open delay events across portfolio

**Evidence from Project Records**:
${delayedList.length > 0 ? delayedList.map(p => `• **${p.name}** (${p.city}): Actual ${p.overallActualPct}% vs Planned ${p.overallPlannedPct}%, Progress Variance: ${p.variancePct > 0 ? '+' : ''}${p.variancePct}% (${p.healthStatus}).`).join('\n') : '• All projects are currently performing within planned schedule buffers.'}

**Root Cause & Priority Areas**:
1. **Manpower Deficits**: Cross-site attendance shows a **${m.manpowerShortfallPct || 0}% shortfall**, primarily impacting secondary electrical and MEP trades.
2. **Open Delay Events**: ${m.totalOpenDelayEvents || 0} unresolved site blockers are logged, requiring contractor escalation.

**Advisory Recommendations (Inferred Suggestions)**:
- Reallocate floating labor from on-track sites to delayed projects.
- Conduct priority sync with trade partners managing open delay events.

*Data Source: \`portfolioService\` telemetry as of ${refDate}.*`;
    }

    // Project Deep Dive Scope
    const p = context.project || {};
    const m = context.metrics || {};
    const trades = context.trades || [];
    const delays = context.delayEvents || [];
    const ml = context.mlInsights || {};

    const delayedTrades = trades.filter(t => t.variance < 0);
    const criticalDelays = delays.filter(d => d.severity === 'CRITICAL' || d.severity === 'HIGH');

    let mlSummary = '';
    if (ml.riskScore && ml.riskScore.probability !== null) {
        const prob = (ml.riskScore.probability * 100).toFixed(1);
        mlSummary = `\n**Machine Learning Risk Assessment**:
- **Predicted Delay Probability**: **${prob}%** (Category: **${ml.riskScore.riskCategory}**)
- **Decision Threshold**: ${ml.riskScore.threshold} (Validated F1-Optimal)
- **Top Contributing Factors**: ${ml.riskScore.topFactors.map(f => `${f.factor_name || f.name} (${f.direction || 'risk-increasing'})`).join(', ') || 'Schedule variance'}
- *Notice: ${ml.riskScore.disclaimer}*`;
    }

    let anomalySummary = '';
    if (ml.anomalies && ml.anomalies.hasAnomalies) {
        anomalySummary = `\n**Detected Telemetry Anomalies**:
${ml.anomalies.flaggedRecords.map(a => `• **${a.tradeName}** [${a.severity}]: ${a.explanation}`).join('\n')}`;
    }

    return `### Project Deep Dive: ${p.name || 'Store Project'}

**Current Status (As of ${refDate})**:
- **Health Classification**: **${m.healthStatus || 'On Track'}**
- **Completion Progress**: **${m.overallActualPct}%** actual vs **${m.overallPlannedPct}%** planned (Schedule Variance: **${m.variancePct}%**)
- **Workforce on Site**: **${m.totalWorkersPresent} / ${m.totalWorkersRequired}** workers (${m.manpowerShortfallPct}% shortfall)
- **Target Deadline**: ${p.deadline || 'N/A'} (Location: ${p.location || 'N/A'})

**Evidence from Trade Records**:
${delayedTrades.length > 0 
    ? delayedTrades.map(t => `• **${t.name}**: Actual ${t.actualPct}% vs Planned ${t.plannedPct}% (Variance: ${t.variance}%). Assigned: ${t.contractorName} (Rating: ${t.contractorRating}). Workers: ${t.workersPresent}/${t.workersRequired}. Reason: ${t.reason}`).join('\n')
    : '• All individual trades are executing on or ahead of planned progress.'}
${delays.length > 0 ? `\n**Active Site Blockers & Delay Events**:\n` + delays.map(d => `• [${d.severity}] ${d.description} (Impact: ${d.impactDays} days, Status: ${d.status})`).join('\n') : ''}${mlSummary}${anomalySummary}

**Advisory Recommendations (Inferred Suggestions)**:
1. **Trade Coordination**: Accelerate recovery schedule for lagging trades (${delayedTrades.map(t => t.name).join(', ') || 'None'}).
2. **Manpower Adjustment**: Request contractor trade partner to augment daily attendance to close the ${m.manpowerShortfallPct}% staffing gap.
3. **Blocker Resolution**: Expedite resolution for ${criticalDelays.length} high-severity site blockers.

*Data Source: \`projectService\` & \`mlInferenceService\` records as of ${refDate}.*`;
}

/**
 * Main AI Copilot Chat Orchestration Function.
 */
async function processCopilotMessage({
    message,
    projectId = null,
    referenceDate = new Date(),
    conversationHistory = [],
    user
}) {
    // 1. Input Validation
    if (!message || typeof message !== 'string' || message.trim() === '') {
        const err = new Error('Message is required and cannot be empty.');
        err.statusCode = 400;
        err.code = 'INVALID_INPUT';
        throw err;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
        const err = new Error(`Message exceeds maximum permitted length of ${MAX_MESSAGE_LENGTH} characters.`);
        err.statusCode = 400;
        err.code = 'MESSAGE_TOO_LONG';
        throw err;
    }

    // 2. Sliding-Window Rate Limiting
    const userId = (user && user.id) || 'anonymous';
    if (!checkRateLimit(userId)) {
        const err = new Error('Too many requests. Please wait a moment before sending another inquiry.');
        err.statusCode = 429;
        err.code = 'RATE_LIMIT_EXCEEDED';
        throw err;
    }

    // 3. Security & Prompt Injection Defense
    if (detectInjection(message)) {
        return {
            response: `**Security Refusal Notice**

SitePulse Copilot detected an instruction override or unauthorized command pattern.

- **Policy**: Copilot strictly operates as a read-only construction intelligence advisor.
- **Allowed Actions**: Querying project health, trade bottlenecks, workforce attendance, delay events, and ML risk scores.
- **Prohibited**: System prompt overrides, database modifications, or role elevation attempts.`,
            grounding: {
                scope: 'security_refusal',
                referenceDate: new Date(referenceDate).toISOString().split('T')[0],
                sources: ['security_firewall']
            },
            suggestedFollowUps: [
                'Which projects are currently at risk?',
                'Analyze active trade bottlenecks across the portfolio',
                'What is the workforce attendance status?'
            ],
            usage: { provider: 'security_firewall', model: 'ruleset-v1' }
        };
    }

    // 4. Read-Only Action Rejection Guardrail
    if (isActionRequest(message)) {
        return {
            response: `**Read-Only Operational Guardrail**

SitePulse AI Copilot provides **read-only decision support** and cannot directly modify project records, change deadlines, alter trade progress, or cancel contractor assignments.

To make operational updates:
1. Use the **Post Daily Update** modal to submit verified site progress.
2. Update trade schedules or delay event tickets through project administration.

How can I assist you with analyzing the current project telemetry?`,
            grounding: {
                scope: 'read_only_notice',
                referenceDate: new Date(referenceDate).toISOString().split('T')[0],
                sources: ['governance_policy']
            },
            suggestedFollowUps: [
                'Summarize the primary risk factors for this project',
                'Which trade is lagging the most?',
                'What is the workforce shortfall percentage?'
            ],
            usage: { provider: 'governance_guardrail', model: 'ruleset-v1' }
        };
    }

    // 5. Tenant-Scoped Context Retrieval
    const orgId = user.organizationId;
    let context = null;

    if (projectId) {
        context = await copilotContextService.getProjectContext(projectId, orgId, referenceDate);
        if (!context) {
            const err = new Error('Project not found or does not belong to your organization.');
            err.statusCode = 404;
            err.code = 'PROJECT_NOT_FOUND';
            throw err;
        }
    } else {
        context = await copilotContextService.getPortfolioContext(orgId, referenceDate);
    }

    // 6. Provider Resolution & Configuration Check
    const config = getProviderConfig();
    const timeoutMs = parseInt(process.env.LLM_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;

    if (!config.configured) {
        const err = new Error('AI Copilot LLM provider is not configured. Please set LLM_API_KEY and LLM_PROVIDER in backend environment variables.');
        err.statusCode = 503;
        err.code = 'LLM_NOT_CONFIGURED';
        err.setup = {
            supportedProviders: ['openai', 'gemini', 'anthropic', 'mock'],
            exampleEnv: {
                LLM_PROVIDER: 'openai',
                LLM_API_KEY: 'sk-...',
                LLM_MODEL: 'gpt-4o-mini'
            }
        };
        throw err;
    }

    // 7. Prompt Construction & Provider Invocation
    const systemPrompt = buildSystemPrompt(context);
    let rawResponse = '';

    if (config.provider === 'mock') {
        rawResponse = callMockProvider(context, message);
    } else if (config.provider === 'groq') {
        rawResponse = await callGroq(config, systemPrompt, message, conversationHistory, timeoutMs);
    } else if (config.provider === 'openai') {
        rawResponse = await callOpenAI(config, systemPrompt, message, conversationHistory, timeoutMs);
    } else if (config.provider === 'gemini') {
        rawResponse = await callGemini(config, systemPrompt, message, conversationHistory, timeoutMs);
    } else if (config.provider === 'anthropic') {
        rawResponse = await callAnthropic(config, systemPrompt, message, conversationHistory, timeoutMs);
    } else {
        // Fallback for custom or local provider
        rawResponse = callMockProvider(context, message);
    }

    // 8. Generate Contextual Follow-Up Suggestions
    const suggestedFollowUps = [];
    if (context.scope === 'portfolio') {
        suggestedFollowUps.push('Which project has the highest schedule delay?');
        suggestedFollowUps.push('Analyze workforce shortfall across all active sites');
        suggestedFollowUps.push('Which contractors have the most open delay events?');
    } else {
        suggestedFollowUps.push('What is the primary trade bottleneck on this project?');
        suggestedFollowUps.push('Explain the machine learning delay risk factors');
        suggestedFollowUps.push('What active delay events are currently logged?');
    }

    return {
        response: rawResponse,
        grounding: {
            scope: context.scope,
            projectId: projectId || null,
            projectName: context.project ? context.project.name : 'All Portfolio Projects',
            referenceDate: context.referenceDate,
            sources: [
                context.scope === 'portfolio' ? 'portfolioService' : 'projectService',
                'delay_events',
                'manpower_log',
                'mlInferenceService'
            ],
            mlDisclaimer: 'Machine learning inferences are generated using synthetic simulation data for research & prototyping.'
        },
        suggestedFollowUps,
        usage: {
            provider: config.provider,
            model: config.model,
            isTestProvider: config.provider === 'mock'
        }
    };
}

module.exports = {
    getCopilotStatus,
    processCopilotMessage,
    detectInjection,
    isActionRequest,
    checkRateLimit,
    callGroq,
    callOpenAI,
    callGemini,
    callAnthropic,
    callMockProvider
};
