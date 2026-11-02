/**
 * Site Pulse — Express Application Setup
 */

const express = require('express');
const healthRouter = require('./routes/health');
const meRouter = require('./routes/me');
const portfolioRouter = require('./routes/portfolio');
const projectsRouter = require('./routes/projects');
const copilotRouter = require('./routes/copilot');
const { router: authRouter } = require('./routes/auth');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Disable X-Powered-By header
app.disable('x-powered-by');

// Security Headers Middleware
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Body Parser Middleware with size limits (prevents payload-based DoS)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// CORS Middleware (Same-Origin enabled by default; cross-origin guarded by CORS_ORIGIN)
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isProduction = process.env.NODE_ENV === 'production';
    const allowedOrigin = process.env.CORS_ORIGIN;

    if (isProduction) {
        const host = req.headers.host;
        const isSameOrigin = !origin || (host && origin.includes(host));

        if (isSameOrigin) {
            if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
        } else if (allowedOrigin) {
            const allowedList = allowedOrigin.split(',').map(o => o.trim());
            if (allowedList.includes(origin) || (allowedList.includes('*') && origin)) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                res.setHeader('Vary', 'Origin');
            }
        }
    } else {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// Serve Static Frontend Assets (Single-Origin Delivery)
const path = require('path');
const frontendPath = path.join(__dirname, '../../');
app.use(express.static(frontendPath));

// Mount Root Route: Serve Single-Page App (or API Info if JSON explicitly requested)
app.get('/', (req, res) => {
    const acceptsJson = req.headers.accept && req.headers.accept.includes('application/json');
    const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
    if (acceptsJson && !acceptsHtml) {
        return res.status(200).json({
            name: 'Site Pulse API',
            status: 'ok'
        });
    }
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// Mount API Routes
app.use('/auth', authRouter);
app.use('/health', healthRouter);
app.use('/me', meRouter);
app.use('/portfolio', portfolioRouter);
app.use('/projects', projectsRouter);
app.use('/copilot', copilotRouter);

app.get('/app', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// 404 Unhandled Route Handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.url} not found`
        }
    });
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
