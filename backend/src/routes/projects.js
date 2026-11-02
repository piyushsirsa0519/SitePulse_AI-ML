/**
 * Projects Router
 * GET /projects/:id/dashboard (Authenticated)
 * POST /projects/:id/updates (Authenticated, Authorized roles: admin, manager, site_engineer)
 * GET /projects/:id/anomalies (Authenticated, Phase 4 ML Anomaly Detection)
 * GET /projects/:id/risk-score (Authenticated, Phase 4 ML Delay Risk Classification)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireRoles } = require('../middleware/authorization');
const { getFullProjectData, getProjectDashboardData } = require('../services/projectService');
const { createOrUpdateDailyUpdate } = require('../services/updateService');
const mlInferenceService = require('../services/mlInferenceService');

// GET /projects/:id/dashboard
router.get('/:id/dashboard', authenticateToken, async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const refDateStr = req.query.date;
        const referenceDate = refDateStr ? new Date(refDateStr) : new Date();

        const dashboardData = await getProjectDashboardData(projectId, req.user.organizationId, referenceDate);
        if (!dashboardData) {
            return res.status(404).json({
                error: {
                    code: 'PROJECT_NOT_FOUND',
                    message: 'Project not found or does not belong to your organization'
                }
            });
        }

        res.status(200).json(dashboardData);
    } catch (err) {
        next(err);
    }
});

// GET /projects/:id/anomalies
router.get('/:id/anomalies', authenticateToken, async (req, res, next) => {
    try {
        const projectId = req.params.id;
        if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
            return res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid or missing project ID'
                }
            });
        }

        const fullProject = await getFullProjectData(projectId, req.user.organizationId);
        if (!fullProject) {
            return res.status(404).json({
                error: {
                    code: 'PROJECT_NOT_FOUND',
                    message: 'Project not found or does not belong to your organization'
                }
            });
        }

        const anomalyReport = await mlInferenceService.detectProjectAnomalies(fullProject);
        res.status(200).json(anomalyReport);
    } catch (err) {
        next(err);
    }
});

// GET /projects/:id/risk-score
router.get('/:id/risk-score', authenticateToken, async (req, res, next) => {
    try {
        const projectId = req.params.id;
        if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
            return res.status(400).json({
                error: {
                    code: 'INVALID_INPUT',
                    message: 'Invalid or missing project ID'
                }
            });
        }

        const fullProject = await getFullProjectData(projectId, req.user.organizationId);
        if (!fullProject) {
            return res.status(404).json({
                error: {
                    code: 'PROJECT_NOT_FOUND',
                    message: 'Project not found or does not belong to your organization'
                }
            });
        }

        const refDateStr = req.query.date;
        const referenceDate = refDateStr ? new Date(refDateStr) : new Date();

        const riskReport = await mlInferenceService.predictProjectRisk(fullProject, referenceDate);
        res.status(200).json(riskReport);
    } catch (err) {
        next(err);
    }
});

// POST /projects/:id/updates
router.post(
    '/:id/updates',
    authenticateToken,
    requireRoles('admin', 'manager', 'site_engineer'),
    async (req, res, next) => {
        try {
            const projectId = req.params.id;
            const { tradeId, date, progressPct, workersPresent, workersRequired, reason, notes } = req.body;

            const updatedRecord = await createOrUpdateDailyUpdate({
                projectId,
                tradeId,
                date,
                progressPct,
                workersPresent,
                workersRequired,
                reason,
                notes,
                user: req.user
            });

            res.status(200).json({
                status: 'success',
                data: updatedRecord
            });
        } catch (err) {
            next(err);
        }
    }
);

module.exports = router;
