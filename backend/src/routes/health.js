/**
 * Site Pulse — Comprehensive Subsystem Health Router
 * GET /health (Unauthenticated for load balancers & monitoring)
 * Reports:
 *   - Application status, version, uptime, memory usage
 *   - Database connectivity (Postgres or in-memory repository)
 *   - ML inference microservice health and model artifact flags
 *   - AI Copilot provider configuration and operational status
 */

const express = require('express');
const router = express.Router();
const db = require('../db/client');
const mlInferenceService = require('../services/mlInferenceService');
const aiCopilotService = require('../services/aiCopilotService');

router.get('/', async (req, res) => {
    const dbHealth = await db.checkHealth();
    const mlHealth = await mlInferenceService.checkHealth();
    const copilotStatus = aiCopilotService.getCopilotStatus();

    const isDegraded = dbHealth.status === 'degraded' || mlHealth.status === 'offline';
    const mem = process.memoryUsage();

    res.status(200).json({
        status: isDegraded ? 'degraded' : 'ok',
        service: 'sitepulse-backend',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        memory: {
            rss_mb: Number((mem.rss / 1024 / 1024).toFixed(1)),
            heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(1))
        },
        subsystems: {
            database: dbHealth,
            ml_service: mlHealth,
            copilot: {
                status: copilotStatus.status,
                configured: copilotStatus.configured,
                provider: copilotStatus.provider,
                model: copilotStatus.model
            }
        },
        // Maintained top-level ml_service for backward compatibility
        ml_service: mlHealth
    });
});

module.exports = router;
