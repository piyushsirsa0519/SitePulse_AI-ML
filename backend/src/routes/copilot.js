/**
 * SitePulse — AI Copilot Router
 * ==============================
 * Endpoints:
 *   - GET  /copilot/status            (Authenticated: provider status, capabilities, setup instructions)
 *   - POST /copilot/chat              (Authenticated: grounded conversational decision support)
 *   - GET  /copilot/suggested-prompts (Authenticated: contextual prompt pills)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const aiCopilotService = require('../services/aiCopilotService');

// GET /copilot/status
router.get('/status', authenticateToken, (req, res) => {
    try {
        const status = aiCopilotService.getCopilotStatus();
        res.status(200).json(status);
    } catch (err) {
        res.status(500).json({
            error: {
                code: 'COPILOT_STATUS_ERROR',
                message: err.message
            }
        });
    }
});

// POST /copilot/chat
router.post('/chat', authenticateToken, async (req, res, next) => {
    try {
        const { message, projectId, referenceDate, conversationHistory } = req.body;

        const result = await aiCopilotService.processCopilotMessage({
            message,
            projectId: projectId || null,
            referenceDate: referenceDate || new Date(),
            conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
            user: req.user
        });

        res.status(200).json(result);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({
                error: {
                    code: err.code || 'COPILOT_ERROR',
                    message: err.message,
                    setup: err.setup || undefined
                }
            });
        }
        next(err);
    }
});

// GET /copilot/suggested-prompts
router.get('/suggested-prompts', authenticateToken, (req, res) => {
    const projectId = req.query.projectId;

    if (projectId) {
        return res.status(200).json({
            scope: 'project',
            projectId,
            prompts: [
                'Which trade on this project is the primary bottleneck?',
                'Explain the machine learning delay risk factors and confidence',
                'What is the current workforce shortfall on this site?',
                'Summarize all active delay events and blocker descriptions',
                'What recovery actions are advised to protect the target deadline?'
            ]
        });
    }

    return res.status(200).json({
        scope: 'portfolio',
        prompts: [
            'Which projects are currently at risk and why?',
            'What is the overall workforce availability across all sites?',
            'Rank delayed projects by schedule variance',
            'Which contractors are associated with the most active delay events?',
            'Summarize portfolio progress against planned milestone targets'
        ]
    });
});

module.exports = router;
