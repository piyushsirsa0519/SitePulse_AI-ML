/**
 * Site Pulse — Centralized Error Handler Middleware
 * Formats all backend API errors consistently.
 * Security: Masks internal server errors in production to prevent stack trace
 * or database driver information disclosure.
 */

function errorHandler(err, req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';
    const statusCode = err.statusCode || err.status || 500;
    const errorCode = err.code || 'INTERNAL_SERVER_ERROR';

    // In production mode, mask internal 500+ error details to prevent information leakage
    let clientMessage = err.message || 'An unexpected internal server error occurred';
    if (isProduction && statusCode >= 500) {
        clientMessage = 'An unexpected internal server error occurred. Please contact system support.';
    }

    // Structured sanitized server log (excludes sensitive credentials or JWTs)
    if (statusCode >= 500) {
        const sanitizedUrl = req.originalUrl ? req.originalUrl.split('?')[0] : req.url;
        console.error(`[ERROR] [${new Date().toISOString()}] ${req.method} ${sanitizedUrl} - ${statusCode} ${errorCode}: ${err.message}`);
    }

    const responsePayload = {
        error: {
            code: errorCode,
            message: clientMessage
        }
    };

    if (err.setup) {
        responsePayload.error.setup = err.setup;
    }

    res.status(statusCode).json(responsePayload);
}

module.exports = errorHandler;
