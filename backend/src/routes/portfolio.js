/**
 * Portfolio Executive Router
 * GET /portfolio (Authenticated, Scoped to Organization)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { getPortfolioData, getContractorsData } = require('../services/portfolioService');

router.get('/', authenticateToken, async (req, res, next) => {
    try {
        // Optional reference date parameter for testing or point-in-time checks
        const refDateStr = req.query.date;
        const referenceDate = refDateStr ? new Date(refDateStr) : new Date();

        const portfolioData = await getPortfolioData(req.user.organizationId, referenceDate);
        res.status(200).json(portfolioData);
    } catch (err) {
        next(err);
    }
});

router.get('/contractors', authenticateToken, async (req, res, next) => {
    try {
        const contractors = await getContractorsData(req.user.organizationId);
        res.status(200).json(contractors);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
